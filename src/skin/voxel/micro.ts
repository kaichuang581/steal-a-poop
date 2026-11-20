/**
 * The micro layer's builder (docs/miniature/04, section 2): small things a farm really has, in cubes of 0.05 m, a
 * quarter of a structure block's side. Home only (scene/farmMicro.ts places them; table/Farmstead.tsx draws them).
 */
import type { Grid } from './primitives';

export const MICRO = 0.05;

/**
 * One micro object: cubes on its own 0.05 m grid, origin at its minimum corner, x right, y up, z back. `lit` holds the
 * cubes that are drawn glowing, as the farmhouse's panes are (a lantern's glass).
 */
export interface MicroObject { name: string; size: [w: number, h: number, d: number]; cubes: Grid; lit?: Grid }

/** Where an object stands: minimum corner in metres (on the 0.05 m grid), and quarter turns about y (0 to 3). */
export interface Placement { kind: string; at: [x: number, y: number, z: number]; turn?: 0 | 1 | 2 | 3; options?: Record<string, unknown>; cluster: string }

/** An object's footprint in cubes, [along x, along z], once turned. */
export const footprint = (o: MicroObject, turn = 0): [number, number] => (turn % 2 ? [o.size[2], o.size[0]] : [o.size[0], o.size[2]]);

/** Where a cube of an object stands in its footprint after `turn` quarter turns: turn 1 carries the object's +x to +z. */
function turned(o: MicroObject, x: number, z: number, turn: number): [number, number] {
  const [w, , d] = o.size;
  return turn === 1 ? [d - 1 - z, x] : turn === 2 ? [w - 1 - x, d - 1 - z] : turn === 3 ? [z, w - 1 - x] : [x, z];
}

/**
 * Stamps an object's cubes into a cluster's world grid at a placement (its glowing cubes into `lit`). Throws if a
 * cube lands on an occupied cell.
 */
export function place(world: Grid, object: MicroObject, p: Placement, lit?: Grid): void {
  const [bx, by, bz] = p.at.map((m) => Math.round(m / MICRO));
  for (const [from, into] of [[object.cubes, world], [object.lit, lit]] as const) {
    if (!from || !into) continue;
    for (const v of from.map.values()) {
      const [x, z] = turned(object, v.x, v.z, p.turn ?? 0);
      if (world.has(bx + x, by + v.y, bz + z) || lit?.has(bx + x, by + v.y, bz + z))
        throw new Error(`micro: ${p.kind} at ${p.at.join(', ')} lands on another object of ${p.cluster}`);
      into.set(bx + x, by + v.y, bz + z, v.c);
    }
  }
}
