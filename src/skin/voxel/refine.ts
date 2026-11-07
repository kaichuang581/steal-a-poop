import type { Voxel, VoxelMap } from './mesher';
import { hash3 } from './primitives';

const SIDES = [-1, 1];

/**
 * Halves a voxel model's cell size, so scenery built on a coarse grid sits at the detail of everything around it. Each
 * cell becomes eight, and the shape gets finer rather than just cut up: a cell's outermost corners are taken off, and
 * so are the edges where a solid mass turns a corner, which softens stairsteps and leaves one-cell rails and branches
 * whole. Build the result with half the size. `grain` is how far each small cell's brightness wanders from its parent's.
 */
export function refine(map: VoxelMap, grain = 0.04, only?: (v: Voxel) => boolean): VoxelMap {
  const out: VoxelMap = new Map();
  const has = (x: number, y: number, z: number) => map.has(`${x},${y},${z}`);
  for (const v of map.values()) {
    if (only && !only(v)) continue; // left out of the result, but still solid to what stands on it
    const { x, y, z, c } = v;
    // Whether each side is open, looked up once for all eight small cells.
    const open: Record<'x' | 'y' | 'z', Record<number, boolean>> = {
      x: { [-1]: !has(x - 1, y, z), 1: !has(x + 1, y, z) },
      y: { [-1]: !has(x, y - 1, z), 1: !has(x, y + 1, z) },
      z: { [-1]: !has(x, y, z - 1), 1: !has(x, y, z + 1) },
    };
    for (const dx of SIDES) for (const dy of SIDES) for (const dz of SIDES) {
      const ox = open.x[dx], oy = open.y[dy], oz = open.z[dz];
      if (ox && oy && oz) continue; // the very corner
      const bx = !open.x[-dx], by = !open.y[-dy], bz = !open.z[-dz];
      if ((ox && oy && bx && by) || (ox && oz && bx && bz) || (oy && oz && by && bz)) continue; // an outer edge
      const X = x * 2 + (dx > 0 ? 1 : 0), Y = y * 2 + (dy > 0 ? 1 : 0), Z = z * 2 + (dz > 0 ? 1 : 0);
      const k = 1 + (hash3(X, Y, Z, 101) - 0.5) * 2 * grain;
      out.set(`${X},${Y},${Z}`, { x: X, y: Y, z: Z, c: grain ? [c[0] * k, c[1] * k, c[2] * k] : c });
    }
  }
  return out;
}

/** Touch screens skip the refinement: the same farm at the coarser grid, at a third of the triangles. */
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** `refine`, unless this device should stay coarse. Returns the voxels and the cell size to build them at. */
export function detailed(map: VoxelMap, size: number, grain?: number, only?: (v: Voxel) => boolean): { map: VoxelMap; size: number } {
  if (!coarse()) return { map: refine(map, grain, only), size: size / 2 };
  if (!only) return { map, size };
  return { map: new Map([...map].filter(([, v]) => only(v))), size };
}
