import { BufferGeometry, Float32BufferAttribute } from 'three';

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
const AO_STEP = 0.2;

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
 * Face-culled mesh with per-vertex colour and ambient occlusion baked in (plan V3 Part 8). Positions are in metres:
 * voxel indices times `size`.
 */
export function buildGeometry(vox: VoxelMap, size: number, { ao: occlude = true }: { ao?: boolean } = {}): BufferGeometry {
  const solid = solidOf(vox);
  // UVs are kept so a material may map a texture, but the voxel material carries none (plan V3.1 Part 1.1).
  const has = (p: number[]) => solid.has(cellKey(p[0], p[1], p[2]));
  const pos: number[] = [], col: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const v of vox.values()) {
    const P = [v.x, v.y, v.z];
    for (const f of FACES) {
      const N = [0, 0, 0];
      N[f.axis] = f.sign;
      const outside = [P[0] + N[0], P[1] + N[1], P[2] + N[2]];
      if (has(outside)) continue; // face culling: never emit a hidden face
      const corners = cornersFor(f.axis, f.sign);
      const base = pos.length / 3;
      const aos: number[] = [];
      for (const [u, w] of corners) {
        const c = [0, 0, 0];
        c[f.axis] = f.sign > 0 ? 1 : 0;
        c[f.t1] = u;
        c[f.t2] = w;
        pos.push((P[0] + c[0]) * size, (P[1] + c[1]) * size, (P[2] + c[2]) * size);
        nor.push(N[0], N[1], N[2]);
        uv.push(u, w);
        // ambient occlusion: the two edge neighbours and the diagonal neighbour around this corner, one layer out
        const d1 = u ? 1 : -1, d2 = w ? 1 : -1;
        const s1 = [...outside]; s1[f.t1] += d1;
        const s2 = [...outside]; s2[f.t2] += d2;
        const cn = [...outside]; cn[f.t1] += d1; cn[f.t2] += d2;
        const a = has(s1) ? 1 : 0, b = has(s2) ? 1 : 0, cc = has(cn) ? 1 : 0;
        const ao = a && b ? 3 : a + b + cc; // 0 open .. 3 fully occluded
        aos.push(ao);
        const k = (1 - AO_STEP * (occlude ? ao : 0)) * FACE_SHADE(f.axis, f.sign);
        col.push(v.c[0] * k, v.c[1] * k, v.c[2] * k);
      }
      // flip the quad diagonal when needed so AO gradients have no seam
      if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Triangle count of a built geometry, for the dev overlay's budget line. */
export function triangles(g: BufferGeometry): number {
  return (g.index?.count ?? 0) / 3;
}
