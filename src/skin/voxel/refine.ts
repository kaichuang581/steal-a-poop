import type { Voxel, VoxelMap } from './mesher';
import { hash3 } from './primitives';
import { finish } from '../scene/slices';

const SIDES = [-1, 1];

/**
 * Halves a voxel model's cell size, so scenery built on a coarse grid sits at the detail of everything around it. Each
 * cell becomes eight, and the shape gets finer rather than just cut up: a cell's outermost corners are taken off, and
 * so are the edges where a solid mass turns a corner, which softens stairsteps and leaves one-cell rails and branches
 * whole. Build the result with half the size. `grain` is how far each small cell's brightness wanders from its parent's:
 * none by default (Brian, 2026-11-18: "remove all glitchy/static textures").
 */
export function refine(map: VoxelMap, grain = 0, only?: (v: Voxel) => boolean): VoxelMap {
  return finish(refineSteps(map, grain, only));
}

/** How many cells `refineSteps` takes between two yields (a few ms of work). */
const REFINE_STEP = 8192;

/** `refine` in steps, for a build in slices (scene/slices.ts): the same cells, in the same order. */
export function* refineSteps(map: VoxelMap, grain = 0, only?: (v: Voxel) => boolean): Generator<undefined, VoxelMap, void> {
  const out: VoxelMap = new Map();
  let n = 0;
  // Below y = 0 is the ground in every scene, whether or not it is in this map: a post or a tyre standing on it keeps
  // its foot. Taking the bottom corners off as if it stood in the air lifted every thin thing half a cell off the snow
  // (Brian, 2026-11-09: "a lot of them are floating").
  const has = (x: number, y: number, z: number) => y < 0 || map.has(`${x},${y},${z}`);
  for (const v of map.values()) {
    if (++n % REFINE_STEP === 0) yield;
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
      // A small cell that is the only bridge to a diagonal neighbour stays (Brian, 2026-11-09: "a lot of them are
      // floating"): a pine branch drooping one step, a rail turning a corner, any two cells meeting at an edge or a
      // corner. Taking it off as a corner or an edge left the far one hanging in the air.
      const bridge = has(x + dx, y + dy, z) || has(x + dx, y, z + dz) || has(x, y + dy, z + dz) || has(x + dx, y + dy, z + dz);
      if (!bridge) {
        if (ox && oy && oz) continue; // the very corner
        const bx = !open.x[-dx], by = !open.y[-dy], bz = !open.z[-dz];
        if ((ox && oy && bx && by) || (ox && oz && bx && bz) || (oy && oz && by && bz)) continue; // an outer edge
      }
      const X = x * 2 + (dx > 0 ? 1 : 0), Y = y * 2 + (dy > 0 ? 1 : 0), Z = z * 2 + (dz > 0 ? 1 : 0);
      const k = 1 + (hash3(X, Y, Z, 101) - 0.5) * 2 * grain;
      out.set(`${X},${Y},${Z}`, { x: X, y: Y, z: Z, c: grain ? [c[0] * k, c[1] * k, c[2] * k] : c });
    }
  }
  return out;
}

/** Touch screens skip the refinement: the same farm at the coarser grid, at a third of the triangles. */
export const coarseDevice = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/**
 * The detail a quality tier builds the world at (plan file 17, change 15, "World detail"): High builds today's detail
 * for the device (the desktop's on a fine pointer), Medium and Low the touch detail on every device.
 */
export const coarseFor = (tier: 'low' | 'medium' | 'high'): boolean => tier !== 'high' || coarseDevice();

/**
 * The detail every `detailed` call is told to use while a build runs under `inDetail` / `withDetail` (it wins over the
 * argument); null: the argument, by default the device's.
 */
let told: boolean | null = null;

/** The detail a build running now is told to use (true: touch detail), or null when none is told. */
export const toldDetail = (): boolean | null => told;

/**
 * Runs a builder in steps with every `detailed` inside it at one detail (`coarse`), whatever the device. Only its own
 * steps are affected: the setting is put back between them, so a build queued beside it (scene/slices.ts) keeps its own.
 */
export function* inDetail<T, Part>(coarse: boolean, steps: Generator<Part | undefined, T, void>): Generator<Part | undefined, T, void> {
  for (;;) {
    const was = told;
    told = coarse;
    let r: IteratorResult<Part | undefined, T>;
    try { r = steps.next(); } finally { told = was; }
    if (r.done) return r.value;
    yield r.value;
  }
}

/** `inDetail` for a build that runs in one go. */
export function withDetail<T>(coarse: boolean, build: () => T): T {
  const was = told;
  told = coarse;
  try { return build(); } finally { told = was; }
}

/**
 * `refine`, unless `coarse` (by default: this device should stay coarse). Returns the voxels and the cell size to build
 * them at. A caller may ask for either detail on any device, to build the touch detail first and the finer one later;
 * a build run under `inDetail` or `withDetail` is told which.
 */
export function detailed(map: VoxelMap, size: number, grain?: number, only?: (v: Voxel) => boolean, coarse = coarseDevice()): { map: VoxelMap; size: number } {
  return finish(detailedSteps(map, size, grain, only, told ?? coarse));
}

/** `detailed` in steps (scene/slices.ts). */
export function* detailedSteps(map: VoxelMap, size: number, grain?: number, only?: (v: Voxel) => boolean, coarse = coarseDevice(), deaf = false): Generator<undefined, { map: VoxelMap; size: number }, void> {
  if (told !== null && !deaf) coarse = told; // `deaf`: this one keeps `coarse` whatever the build is told
  if (!coarse) return { map: yield* refineSteps(map, grain, only), size: size / 2 };
  if (!only) return { map, size };
  return { map: new Map([...map].filter(([, v]) => only(v))), size };
}
