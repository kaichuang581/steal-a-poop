import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { LOOK } from '../look';
import { FACE_SHADE } from '../voxel/mesher';
import { solid } from '../voxel/paint';
import type { Mat } from '../voxel/paint';
import type { ModelData } from './models.gen';

/**
 * The dream's voxel models (docs/dream/v3/03-models.md): the pack's boxes, cell for cell, never retyped or rounded.
 * Each model is filled into a dense grid of its own cell size (the first box to claim a cell keeps it, as the pack's
 * renderer has it), and its outside faces are meshed with the game's corner shade and face shade (voxel/mesher.ts),
 * joining runs of one colour and one shade on a plane into one rectangle. The pack's 69 models hold about a million
 * cells; the house mesher, string-keyed, takes seconds on that, so the dream has this one: the same look, a grid of
 * numbers. Boxes that give light (`glow:<name>`) are meshed apart, unlit, in their own colour.
 */

/** Colours as linear RGB, from a token: "material:step" of LADDER, "glow:<name>" from the pack's glows, or "#hex" / "lit:#hex". */
const tokenCache = new Map<string, [number, number, number]>();
export function tokenColour(token: string, glow: Record<string, string>, festive = true): [number, number, number] {
  // Out of season every coloured bulb burns plain (v3/03, section 9, check 5).
  const t = !festive && /^glow:bulb/.test(token) ? 'glow:lit' : token;
  let c = tokenCache.get(t);
  if (!c) {
    const [mat, step] = t.split(':');
    // A plain hex (the Trading Post pack's bomb skins and bursts, kept out of LADDER), lit or not.
    if (t.startsWith('#') || mat === 'lit') { const k = new Color(t.startsWith('#') ? t : step); c = [k.r, k.g, k.b]; }
    else if (mat === 'glow') { const k = new Color(glow[step]); c = [k.r, k.g, k.b]; }
    else c = solid(mat as Mat, Number(step));
    tokenCache.set(t, c);
  }
  return c;
}
export const isGlow = (token: string): boolean => token.startsWith('glow:') || token.startsWith('lit:');

/** One mesh's arrays: positions in metres (the model's own origin), normals, colours, triangle indices. */
export interface Arrays { pos: number[]; nor: number[]; col: number[]; idx: number[] }
const fresh = (): Arrays => ({ pos: [], nor: [], col: [], idx: [] });
/** A model meshed: what is lit, and what gives light. */
export interface ModelMesh { lit: Arrays; glow: Arrays; cells: number }

export interface MeshOptions {
  /** Only these parts: a mask of bits by part index (0 for every part). */
  parts?: number;
  /** The season's boxes (wreaths, garlands, roof bulbs) and coloured bulbs, or neither. */
  festive: boolean;
  /** Faces turned away from the camera (-z) too: only for what casts a shadow. The camera never turns. */
  back?: boolean;
  /** Corner shade: on near the lane, off further back, where it cannot be seen and only splits faces apart. */
  ao?: boolean;
}

const AO_STEP = LOOK.ao ?? 0.2;
const FACES = [
  { axis: 0, sign: 1, t1: 1, t2: 2 }, { axis: 0, sign: -1, t1: 1, t2: 2 },
  { axis: 1, sign: 1, t1: 0, t2: 2 }, { axis: 1, sign: -1, t1: 0, t2: 2 },
  { axis: 2, sign: 1, t1: 0, t2: 1 }, { axis: 2, sign: -1, t1: 0, t2: 1 },
] as const;
/** Counter-clockwise corner order on (t1, t2) for a face (mesher.ts's `cornersFor`). */
const cornersFor = (axis: number, sign: number): [number, number][] => {
  const ccw: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return (sign > 0) === (axis !== 1) ? ccw : [...ccw].reverse();
};

const cache = new Map<string, ModelMesh>();
/**
 * A model meshed once for a set of options (then shared by every placement). `colours` and `glow` are the pack's
 * colour list and glow table (models.gen.ts).
 */
export function meshModel(id: string, m: ModelData, colours: readonly string[], glow: Record<string, string>, o: MeshOptions): ModelMesh {
  const key = `${id}|${o.parts ?? 0}|${o.festive ? 1 : 0}|${o.back ? 1 : 0}|${o.ao === false ? 0 : 1}`;
  let built = cache.get(key);
  if (!built) cache.set(key, (built = build(m, colours, glow, o)));
  return built;
}

function build(m: ModelData, colours: readonly string[], glow: Record<string, string>, o: MeshOptions): ModelMesh {
  const [bx0, by0, bz0, bx1, by1, bz1] = m.bounds;
  const n = [bx1 - bx0, by1 - by0, bz1 - bz0];
  const grid = new Int16Array(n[0] * n[1] * n[2]);
  const at = (x: number, y: number, z: number) => (x * n[1] + y) * n[2] + z;
  const stride = [n[1] * n[2], n[2], 1];
  let cells = 0;
  for (const b of m.boxes) {
    const [x0, y0, z0, x1, y1, z1, c, part, season] = b;
    if (o.parts && !(o.parts & (1 << part))) continue;
    if (season && !o.festive) continue;
    for (let x = x0 - bx0; x < x1 - bx0; x++)
      for (let y = y0 - by0; y < y1 - by0; y++)
        for (let z = z0 - bz0; z < z1 - bz0; z++) {
          const i = at(x, y, z);
          if (grid[i] === 0) { grid[i] = c + 1; cells++; } // the first box to claim a cell keeps it
        }
  }
  const filled = (p: number[]) => p[0] >= 0 && p[1] >= 0 && p[2] >= 0 && p[0] < n[0] && p[1] < n[1] && p[2] < n[2] && grid[at(p[0], p[1], p[2])] !== 0;
  const lit = fresh(), light = fresh();
  const size = m.cell, origin = [bx0, by0, bz0];
  // Every grid point where a face has a corner, so a long rectangle keeps a vertex where a neighbour's corner meets
  // its side (no T-junctions: they open single-pixel cracks once drawn; mesher.ts does the same).
  const corner = new Set<number>();
  const ck = (p: number[]) => ((p[0] + 1) * 4096 + (p[1] + 1)) * 4096 + (p[2] + 1);
  type Rect = { out: Arrays; f: (typeof FACES)[number]; at: number; a0: number; a1: number; b0: number; b1: number; c: number[]; ao?: number[] };
  const rects: Rect[] = [];
  for (const f of FACES) {
    if (f.axis === 2 && f.sign < 0 && !o.back) continue;
    const na = n[f.t1], nb = n[f.t2];
    const mask = new Int32Array(na * nb);
    const aoOf = new Uint8Array(na * nb * 4);
    const corners = cornersFor(f.axis, f.sign);
    for (let layer = 0; layer < n[f.axis]; layer++) {
      mask.fill(0);
      for (let a = 0; a < na; a++)
        for (let b = 0; b < nb; b++) {
          // Most of the grid is empty: look before making anything.
          const v = grid[layer * stride[f.axis] + a * stride[f.t1] + b * stride[f.t2]];
          if (!v) continue;
          const P = [0, 0, 0];
          P[f.axis] = layer; P[f.t1] = a; P[f.t2] = b;
          const out = [...P]; out[f.axis] += f.sign;
          if (filled(out)) continue;
          const glowing = isGlow(colours[v - 1]);
          const aos = [0, 0, 0, 0];
          if (!glowing && o.ao !== false) corners.forEach(([u, w], k) => {
            const d1 = u ? 1 : -1, d2 = w ? 1 : -1;
            const s1 = [...out]; s1[f.t1] += d1;
            const s2 = [...out]; s2[f.t2] += d2;
            const cn = [...out]; cn[f.t1] += d1; cn[f.t2] += d2;
            const p = filled(s1) ? 1 : 0, q = filled(s2) ? 1 : 0;
            aos[k] = p && q ? 3 : p + q + (filled(cn) ? 1 : 0);
          });
          const i = a * nb + b;
          aoOf.set(aos, i * 4);
          // One tone at all four corners: it may join a rectangle of its colour and tone. Otherwise it stands alone.
          mask[i] = aos[0] === aos[1] && aos[1] === aos[2] && aos[2] === aos[3] ? (v * 4 + aos[0]) : -(v * 4);
        }
      const base = origin[f.axis] + layer + (f.sign > 0 ? 1 : 0);
      for (let a = 0; a < na; a++)
        for (let b = 0; b < nb; b++) {
          const k = mask[a * nb + b];
          if (k === 0) continue;
          const v = Math.floor(Math.abs(k) / 4), tok = colours[v - 1], glowing = isGlow(tok);
          let a1 = a, b1 = b;
          if (k > 0) {
            while (b1 + 1 < nb && mask[a * nb + b1 + 1] === k) b1++;
            for (let whole = true; whole && a1 + 1 < na;) {
              for (let bb = b; bb <= b1 && whole; bb++) whole = mask[(a1 + 1) * nb + bb] === k;
              if (whole) a1++;
            }
          }
          for (let aa = a; aa <= a1; aa++) for (let bb = b; bb <= b1; bb++) mask[aa * nb + bb] = 0;
          const rgb = tokenColour(tok, glow, o.festive);
          const shade = glowing ? 1 : FACE_SHADE(f.axis, f.sign);
          rects.push({ out: glowing ? light : lit, f, at: base, a0: a + origin[f.t1], a1: a1 + origin[f.t1], b0: b + origin[f.t2], b1: b1 + origin[f.t2], c: [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade], ao: k < 0 || glowing ? (glowing ? [0, 0, 0, 0] : [...aoOf.subarray((a * nb + b) * 4, (a * nb + b) * 4 + 4)]) : [k % 4, k % 4, k % 4, k % 4] });
          for (const aa of [a, a1 + 1]) for (const bb of [b, b1 + 1]) { const q = [0, 0, 0]; q[f.axis] = base; q[f.t1] = aa + origin[f.t1]; q[f.t2] = bb + origin[f.t2]; corner.add(ck(q)); }
        }
    }
  }
  for (const r of rects) emit(r, size, corner, ck);
  return { lit, glow: light, cells };
}

function emit(r: { out: Arrays; f: (typeof FACES)[number]; at: number; a0: number; a1: number; b0: number; b1: number; c: number[]; ao?: number[] }, size: number, corner: Set<number>, ck: (p: number[]) => number) {
  const { out, f, at, a0, a1, b0, b1, c } = r;
  const ao = r.ao ?? [0, 0, 0, 0];
  const nor = [f.axis === 0 ? f.sign : 0, f.axis === 1 ? f.sign : 0, f.axis === 2 ? f.sign : 0];
  const put = (q: number[], k: number) => {
    out.pos.push(q[0] * size, q[1] * size, q[2] * size);
    out.nor.push(nor[0], nor[1], nor[2]);
    out.col.push(c[0] * k, c[1] * k, c[2] * k);
  };
  const pt = (a: number, b: number) => { const q = [0, 0, 0]; q[f.axis] = at; q[f.t1] = a; q[f.t2] = b; return q; };
  const ends = cornersFor(f.axis, f.sign).map(([u, w]) => [u ? a1 + 1 : a0, w ? b1 + 1 : b0]);
  const single = a1 === a0 && b1 === b0;
  const base = out.pos.length / 3;
  if (single || ao.some((v) => v !== ao[0])) {
    // A face with its own corner shade: four corners, the diagonal turned so the shade has no seam.
    ends.forEach(([a, b], i) => put(pt(a, b), 1 - AO_STEP * ao[i]));
    if (ao[0] + ao[2] > ao[1] + ao[3]) out.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return;
  }
  const k = 1 - AO_STEP * ao[0];
  const outline: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [fa, fb] = ends[i], [ta, tb] = ends[(i + 1) % 4];
    const da = Math.sign(ta - fa), db = Math.sign(tb - fb);
    for (let a = fa, b = fb; a !== ta || b !== tb; a += da, b += db) {
      const q = pt(a, b);
      if ((a === fa && b === fb) || corner.has(ck(q))) outline.push(q);
    }
  }
  if (outline.length === 4) {
    outline.forEach((q) => put(q, k));
    out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return;
  }
  outline.forEach((q) => put(q, k));
  put(pt((a0 + a1 + 1) / 2, (b0 + b1 + 1) / 2), k);
  const m = outline.length;
  for (let i = 0; i < m; i++) out.idx.push(base + m, base + i, base + ((i + 1) % m));
}

/**
 * Many copies of meshes gathered into one: each placed at a point (metres), scaled, its colours multiplied by a tint.
 * Scenery is merged, not instanced (the game's rule), one mesh a row group.
 */
export class Gather {
  readonly a: Arrays = fresh();
  add(src: Arrays, x: number, y: number, z: number, tint = 1, scale: readonly [number, number, number] = [1, 1, 1]): void {
    const { a } = this, base = a.pos.length / 3;
    for (let i = 0; i < src.pos.length; i += 3) a.pos.push(x + src.pos[i] * scale[0], y + src.pos[i + 1] * scale[1], z + src.pos[i + 2] * scale[2]);
    for (let i = 0; i < src.nor.length; i++) a.nor.push(src.nor[i]);
    for (let i = 0; i < src.col.length; i++) a.col.push(src.col[i] * tint);
    for (let i = 0; i < src.idx.length; i++) a.idx.push(base + src.idx[i]);
  }
  /**
   * A plain box in metres (the ground's slabs, the far hills, threads): its faces in one flat colour with the face
   * shade and no corner shade, as Home's roof snow is meshed. Faces the camera can never see are left out: the back,
   * and the underside of anything standing on the ground.
   */
  box(b: readonly number[], rgb: readonly number[], tint = 1, glowing = false): void {
    const [x0, y0, z0, x1, y1, z1] = b;
    const P = [[x0, x1], [y0, y1], [z0, z1]];
    for (const f of FACES) {
      if (f.axis === 2 && f.sign < 0) continue;
      if (f.axis === 1 && f.sign < 0 && y0 <= 0.15) continue;
      const shade = (glowing ? 1 : FACE_SHADE(f.axis, f.sign)) * tint;
      const base = this.a.pos.length / 3;
      for (const [u, w] of cornersFor(f.axis, f.sign)) {
        const q = [0, 0, 0];
        q[f.axis] = P[f.axis][f.sign > 0 ? 1 : 0]; q[f.t1] = P[f.t1][u]; q[f.t2] = P[f.t2][w];
        this.a.pos.push(q[0], q[1], q[2]);
        this.a.nor.push(f.axis === 0 ? f.sign : 0, f.axis === 1 ? f.sign : 0, f.axis === 2 ? f.sign : 0);
        this.a.col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
      }
      this.a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  get empty(): boolean { return this.a.idx.length === 0; }
  geometry(): BufferGeometry { return toGeometry(this.a); }
}

export function toGeometry(a: Arrays): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(a.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(a.col, 3));
  g.setIndex(new Uint32BufferAttribute(a.idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** The filled cells of a model, and their count by colour: what check 2 of v3/03 compares with the pack's JSON. */
export function cellCounts(m: ModelData, colours: readonly string[]): { cells: number; byColour: Record<string, number> } {
  const [bx0, by0, bz0, bx1, by1, bz1] = m.bounds;
  const n = [bx1 - bx0, by1 - by0, bz1 - bz0];
  const grid = new Int16Array(n[0] * n[1] * n[2]);
  const byColour: Record<string, number> = {};
  let cells = 0;
  for (const [x0, y0, z0, x1, y1, z1, c] of m.boxes)
    for (let x = x0 - bx0; x < x1 - bx0; x++) for (let y = y0 - by0; y < y1 - by0; y++) for (let z = z0 - bz0; z < z1 - bz0; z++) {
      const i = (x * n[1] + y) * n[2] + z;
      if (grid[i]) continue;
      grid[i] = c + 1; cells++;
      byColour[colours[c]] = (byColour[colours[c]] ?? 0) + 1;
    }
  return { cells, byColour };
}
