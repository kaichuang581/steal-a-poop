import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { EDGE, ROUND } from './rounded';
import { LOOK } from '../look';

export type Voxel = { x: number; y: number; z: number; c: [number, number, number] }; // colour as linear RGB 0..1
export type VoxelMap = Map<string, Voxel>; // key "x,y,z"

// For each face: its normal axis and sign, and the two tangent axes used for ambient occlusion.
const FACES: { axis: 0 | 1 | 2; sign: 1 | -1; t1: 0 | 1 | 2; t2: 0 | 1 | 2 }[] = [
  { axis: 0, sign: 1, t1: 1, t2: 2 }, { axis: 0, sign: -1, t1: 1, t2: 2 },
  { axis: 1, sign: 1, t1: 0, t2: 2 }, { axis: 1, sign: -1, t1: 0, t2: 2 },
  { axis: 2, sign: 1, t1: 0, t2: 1 }, { axis: 2, sign: -1, t1: 0, t2: 1 },
];
/** A little per-face shading so a cube's faces read apart where the light is flat; the sun and sky fill do the rest. */
const FACE_SHADE = (axis: number, sign: number) =>
  axis === 1 ? (sign > 0 ? 1.0 : 0.78) : axis === 0 ? (sign > 0 ? 0.93 : 0.88) : sign > 0 ? 0.91 : 0.86;
/** How much each occluded corner darkens (0..3 corners). */
const AO_STEP = LOOK.ao ?? 0.2; // ?ao= on a development server (look.ts), for the diorama's pairs

const cellKey = (x: number, y: number, z: number) => (x + 8192) * 268435456 + (y + 8192) * 16384 + (z + 8192);
const solids = new WeakMap<object, Set<number>>();
/**
 * Every filled cell as a number, for neighbour lookups. A chunk of a bigger model names the whole model as `all`, so its
 * faces cull against its neighbours; the set is worked out once per model, however many chunks share it.
 */
function solidOf(vox: VoxelMap): Set<number> {
  const all = (vox as VoxelMap & { all?: VoxelMap }).all ?? vox;
  let set = solids.get(all);
  if (!set) {
    set = new Set();
    for (const v of all.values()) set.add(cellKey(v.x, v.y, v.z));
    solids.set(all, set);
  }
  return set;
}

/** Counter-clockwise (outward-facing) corner order for each face, as offsets on (t1, t2). */
function cornersFor(axis: number, sign: number): [number, number][] {
  const ccw: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // (t1, t2) is right-handed with the +normal for x (y,z) and z (x,y), left-handed for y (x,z).
  const rightHanded = axis !== 1;
  return (sign > 0) === rightHanded ? ccw : [...ccw].reverse();
}

/**
 * Coplanar faces of one tone merge into rectangles in the meshes that ask for it (`merge`): the far land, which is
 * mostly flat snow of one colour. Set to false to get one quad a face back everywhere. (Plan file 17, change 13, step 2.)
 *
 * What it does to the picture, measured on fifteen shots: nothing where no face was merged; where faces were, about
 * one pixel in a thousand of a picture moves by one step of 255 (never more than five), because the same surface drawn
 * as different triangles is worked out to the last bit a little differently. Merging where a shadow's edge can fall
 * moved more than that, so the land is merged only out of the sun's reach (`sunReaches` in unseen.ts).
 */
export const MERGE_FLAT = true;
/** The most cells a merged rectangle runs along either side. */
const MERGE_SPAN = 8;

export interface BuildOptions {
  /** Corner shading (ambient occlusion). On unless set to false. */
  ao?: boolean;
  /**
   * Leaves out every face this says no camera can be in front of: the face square to `axis` (0 x, 1 y, 2 z), looking
   * along `sign`, in the plane at `plane` metres. Only for meshes that cast no shadow (see voxel/unseen.ts).
   */
  unseen?: (axis: 0 | 1 | 2, sign: 1 | -1, plane: number) => boolean;
  /**
   * Draws runs of faces that lie in one plane, have one tone at all four corners (so no corner shading across them),
   * round no edge and share a colour as one rectangle each: the same surface in fewer triangles (see `MERGE_FLAT`).
   * Given a function, only the voxels it says yes to take part (their centres, in metres).
   */
  merge?: boolean | ((x: number, y: number, z: number) => boolean);
  /**
   * Whether something that is not this model fills a cell (asked in the model's own cube indices): the ground, a wall
   * the model stands against. Read only where corner shade is worked out, so a crate gets a soft dark line where it
   * meets the wall and the snow; never used to hide a face. (docs/miniature/04, section 4.)
   */
  near?: (x: number, y: number, z: number) => boolean;
}

const planeCell = (a: number, b: number) => (a + 8192) * 16384 + (b + 8192);

/**
 * Face-culled mesh with per-vertex colour and ambient occlusion baked in (plan V3 Part 8). Positions are in metres:
 * voxel indices times `size`. Every face is four vertices and six indices, in order, but for the merged rectangles
 * (`merge`) at the end, which may be fans.
 */
export function buildGeometry(vox: VoxelMap, size: number, { ao: occlude = true, unseen, merge = false, near }: BuildOptions = {}): BufferGeometry {
  // tools/floatingVoxels.ts listens here to find voxels that touch nothing; nothing else sets it.
  (globalThis as { __voxelHook?: (vox: VoxelMap, size: number) => void }).__voxelHook?.(vox, size);
  const solid = solidOf(vox);
  // UVs are kept so a material may map a texture, but the voxel material carries none (plan V3.1 Part 1.1).
  const has = (p: number[]) => solid.has(cellKey(p[0], p[1], p[2]));
  const shut = near ? (p: number[]) => has(p) || near(p[0], p[1], p[2]) : has; // for corner shade only
  const pos: number[] = [], col: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [], bev: number[] = [];
  const merging = !!merge && MERGE_FLAT;
  const mergeable = typeof merge === 'function' ? merge : null;
  /** Flat faces held back to be merged: by face direction and layer, each cell's place in the plane and its colour. */
  const flat = new Map<string, Map<number, [number, number, number, number, number]>>();
  /** Every point of the grid where a face of this mesh has a corner (kept only while merging). */
  const corner = new Set<number>();
  for (const v of vox.values()) {
    const P = [v.x, v.y, v.z];
    for (const f of FACES) {
      const N = [0, 0, 0];
      N[f.axis] = f.sign;
      const outside = [P[0] + N[0], P[1] + N[1], P[2] + N[2]];
      if (has(outside)) continue; // face culling: never emit a hidden face
      if (unseen?.(f.axis, f.sign, (P[f.axis] + (f.sign > 0 ? 1 : 0)) * size)) continue; // nor one no camera can face
      const corners = cornersFor(f.axis, f.sign);
      // Rounded corners (rounded.ts): an edge of this face rounds when nothing stands beside the voxel that way, in its
      // own layer or one out, so coplanar runs of voxels stay one flat surface and concave steps stay sharp.
      let mask = 0;
      if (ROUND) {
        const open = (t: number, d: number) => {
          const q = [...P]; q[t] += d;
          const o = [...outside]; o[t] += d;
          return !has(q) && !has(o);
        };
        mask = (open(f.t1, -1) ? EDGE.t1Lo : 0) | (open(f.t1, 1) ? EDGE.t1Hi : 0) | (open(f.t2, -1) ? EDGE.t2Lo : 0) | (open(f.t2, 1) ? EDGE.t2Hi : 0);
      }
      const aos: number[] = [];
      for (const [u, w] of corners) {
        // ambient occlusion: the two edge neighbours and the diagonal neighbour around this corner, one layer out
        const d1 = u ? 1 : -1, d2 = w ? 1 : -1;
        const s1 = [...outside]; s1[f.t1] += d1;
        const s2 = [...outside]; s2[f.t2] += d2;
        const cn = [...outside]; cn[f.t1] += d1; cn[f.t2] += d2;
        const a = shut(s1) ? 1 : 0, b = shut(s2) ? 1 : 0, cc = shut(cn) ? 1 : 0;
        aos.push(a && b ? 3 : a + b + cc); // 0 open .. 3 fully occluded
      }
      const shade = FACE_SHADE(f.axis, f.sign);
      // One tone and no rounded edge: this face may join its neighbours in a rectangle, once every face is known.
      if (merging && mask === 0 && aos[0] === aos[1] && aos[1] === aos[2] && aos[2] === aos[3] && (!mergeable || mergeable((P[0] + 0.5) * size, (P[1] + 0.5) * size, (P[2] + 0.5) * size))) {
        const k = (1 - AO_STEP * (occlude ? aos[0] : 0)) * shade;
        const key = `${FACES.indexOf(f)}|${P[f.axis]}`;
        let cells = flat.get(key);
        if (!cells) flat.set(key, (cells = new Map()));
        cells.set(planeCell(P[f.t1], P[f.t2]), [P[f.t1], P[f.t2], v.c[0] * k, v.c[1] * k, v.c[2] * k]);
        continue;
      }
      const base = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        const [u, w] = corners[i];
        const c = [0, 0, 0];
        c[f.axis] = f.sign > 0 ? 1 : 0;
        c[f.t1] = u;
        c[f.t2] = w;
        pos.push((P[0] + c[0]) * size, (P[1] + c[1]) * size, (P[2] + c[2]) * size);
        if (merging) corner.add(cellKey(P[0] + c[0], P[1] + c[1], P[2] + c[2]));
        nor.push(N[0], N[1], N[2]);
        uv.push(u, w);
        if (ROUND) bev.push(u, w, mask);
        const k = (1 - AO_STEP * (occlude ? aos[i] : 0)) * shade;
        col.push(v.c[0] * k, v.c[1] * k, v.c[2] * k);
      }
      // flip the quad diagonal when needed so AO gradients have no seam
      if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  // The flat faces, plane by plane: each cell grows along t2 while the colour holds, then that run grows along t1.
  const rects: { f: (typeof FACES)[number]; at: number; a0: number; a1: number; b0: number; b1: number; c: [number, number, number] }[] = [];
  for (const [key, cells] of flat) {
    const [fi, layer] = key.split('|').map(Number);
    const f = FACES[fi], at = layer + (f.sign > 0 ? 1 : 0);
    for (const [a0, b0, r, gr, bl] of cells.values()) {
      const same = (a: number, b: number) => {
        const c = cells.get(planeCell(a, b));
        return !!c && c[2] === r && c[3] === gr && c[4] === bl;
      };
      let b1 = b0;
      while (b1 - b0 + 1 < MERGE_SPAN && same(a0, b1 + 1)) b1++;
      let a1 = a0;
      while (a1 - a0 + 1 < MERGE_SPAN) {
        let whole = true;
        for (let b = b0; b <= b1 && whole; b++) whole = same(a1 + 1, b);
        if (!whole) break;
        a1++;
      }
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) cells.delete(planeCell(a, b));
      rects.push({ f, at, a0, a1, b0, b1, c: [r, gr, bl] });
      for (const a of [a0, a1 + 1]) for (const b of [b0, b1 + 1]) { const q = [0, 0, 0]; q[f.axis] = at; q[f.t1] = a; q[f.t2] = b; corner.add(cellKey(q[0], q[1], q[2])); }
    }
  }
  // A rectangle whose side passes a corner of another face must have a vertex there too, or the two sides are not quite
  // the same line once drawn and single pixels of whatever lies behind show through (a T-junction). So each rectangle
  // keeps every point of its outline where another face of this mesh has a corner, or where a neighbouring chunk of the
  // same model has voxels (that chunk does the same). With none it is two triangles; with some, a fan round its middle.
  const all = (vox as VoxelMap & { all?: VoxelMap }).all ?? vox;
  let own: Set<number> | null = null;
  if (rects.length && all !== vox) {
    own = new Set();
    for (const v of vox.values()) own.add(cellKey(v.x, v.y, v.z));
  }
  const beside = (x: number, y: number, z: number) => {
    if (!own) return false;
    for (let dx = -1; dx <= 0; dx++) for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 0; dz++) {
      const k = cellKey(x + dx, y + dy, z + dz);
      if (solid.has(k) && !own.has(k)) return true;
    }
    return false;
  };
  const outlineOf = ({ f, at, a0, a1, b0, b1 }: (typeof rects)[number]) => {
    const ends = cornersFor(f.axis, f.sign).map(([u, w]) => [u ? a1 + 1 : a0, w ? b1 + 1 : b0]);
    const outline: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const [fa, fb] = ends[i], [ta, tb] = ends[(i + 1) % 4];
      const da = Math.sign(ta - fa), db = Math.sign(tb - fb);
      for (let a = fa, b = fb; a !== ta || b !== tb; a += da, b += db) {
        const q = [0, 0, 0]; q[f.axis] = at; q[f.t1] = a; q[f.t2] = b;
        if ((a === fa && b === fb) || corner.has(cellKey(q[0], q[1], q[2])) || beside(q[0], q[1], q[2])) outline.push(q);
      }
    }
    return outline;
  };
  // A rectangle that would need as many triangles as its cells did is drawn cell by cell after all. That gives its
  // neighbours more corners to meet, so they are looked at again until nothing changes.
  const split = new Set<(typeof rects)[number]>();
  for (let changed = true; changed;) {
    changed = false;
    for (const r of rects) {
      if (split.has(r) || outlineOf(r).length < 2 * (r.a1 - r.a0 + 1) * (r.b1 - r.b0 + 1)) continue;
      split.add(r);
      changed = true;
      for (let a = r.a0; a <= r.a1 + 1; a++) for (let b = r.b0; b <= r.b1 + 1; b++) { const q = [0, 0, 0]; q[r.f.axis] = r.at; q[r.f.t1] = a; q[r.f.t2] = b; corner.add(cellKey(q[0], q[1], q[2])); }
    }
  }
  for (const r of rects) {
    const { f, at, a0, a1, b0, b1, c } = r;
    const put = (x: number, y: number, z: number, u = 0, w = 0) => {
      pos.push(x * size, y * size, z * size);
      nor.push(f.axis === 0 ? f.sign : 0, f.axis === 1 ? f.sign : 0, f.axis === 2 ? f.sign : 0);
      uv.push(u, w);
      if (ROUND) bev.push(u, w, 0);
      col.push(c[0], c[1], c[2]);
    };
    const quad = (a: number, a2: number, b: number, b2: number) => {
      const base = pos.length / 3;
      for (const [u, w] of cornersFor(f.axis, f.sign)) { const q = [0, 0, 0]; q[f.axis] = at; q[f.t1] = u ? a2 : a; q[f.t2] = w ? b2 : b; put(q[0], q[1], q[2], u, w); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    if (split.has(r)) { for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) quad(a, a + 1, b, b + 1); continue; }
    const outline = outlineOf(r);
    if (outline.length === 4) { quad(a0, a1 + 1, b0, b1 + 1); continue; }
    const base = pos.length / 3;
    for (const q of outline) put(q[0], q[1], q[2]);
    const mid = [0, 0, 0]; mid[f.axis] = at; mid[f.t1] = (a0 + a1 + 1) / 2; mid[f.t2] = (b0 + b1 + 1) / 2;
    put(mid[0], mid[1], mid[2]);
    const n = outline.length;
    for (let i = 0; i < n; i++) idx.push(base + n, base + i, base + ((i + 1) % n));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  if (ROUND) g.setAttribute('bevel', new Float32BufferAttribute(bev, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Whether `packGeometry` packs colour to 16 bits (see there); false keeps it a 32-bit float. */
export const PACK_COLOR = true;
/** A packed colour holds 0..COLOR_RANGE: it is stored at 1 / COLOR_RANGE of its value and multiplied back in the shader. */
export const COLOR_RANGE = 2;

/**
 * Repacks a built geometry in place to half the bytes (plan file 17, change 13, step 4; the colour in milestone 4):
 * 28 a vertex with rounded corners, 24 without, against 56 and 44.
 * - positions stay 32-bit floats;
 * - colours go to 16-bit whole numbers read as 0..1 (normalized), at HALF their value, since snow's glints are brighter
 *   than white (1.15, voxel/snow.ts). They are padded to four with a 1 in the fourth, which is what tells three to
 *   compile the colour-with-alpha variant of a material; `voxelMaterial` doubles the colour back in that variant
 *   (voxel/material.ts). So a packed geometry must be drawn with `voxelMaterial` (every one is): any other
 *   vertex-coloured material would draw it at half brightness. The doubled colour is within 1/65,535 of the float;
 * - normals, which are only ever -1, 0 or 1, go to signed bytes, which hold those exactly;
 * - the rounded-corner marks (0, 1 and a mask to 15) go to bytes;
 * - `uv` goes: no material that draws voxels has a texture.
 * Normals and marks are padded to four numbers, a size every graphics chip takes as it is.
 * The arrays are kept on the page as before, only smaller. For scenery; anything that reads a normal by its array
 * rather than by `getX` must be given the geometry before this.
 */
export function packGeometry(g: BufferGeometry): BufferGeometry {
  if (g.userData.packed) return g;
  const n = g.getAttribute('normal'), b = g.getAttribute('bevel'), c = g.getAttribute('color');
  const count = n.count;
  if (PACK_COLOR && c && c.itemSize === 3) {
    const C = new Uint16Array(count * 4);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++) C[i * 4 + k] = Math.round(Math.min(1, Math.max(0, (c.array[i * 3 + k] as number) / COLOR_RANGE)) * 65535);
      C[i * 4 + 3] = 65535;
    }
    g.setAttribute('color', new BufferAttribute(C, 4, true));
  }
  const N = new Int8Array(count * 4);
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) N[i * 4 + k] = Math.round((n.array[i * 3 + k] as number) * 127);
  g.setAttribute('normal', new BufferAttribute(N, 4, true));
  if (b) {
    const B = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) B[i * 4 + k] = b.array[i * 3 + k] as number;
    g.setAttribute('bevel', new BufferAttribute(B, 4));
  }
  g.deleteAttribute('uv');
  g.userData.packed = true;
  return g;
}

/** Triangle count of a built geometry, for the dev overlay's budget line. */
export function triangles(g: BufferGeometry): number {
  return (g.index?.count ?? 0) / 3;
}
