/** What the dream's loop tells the voxel world (DreamWorld.tsx), kept apart so the world itself can load later. */
export type WorldN = 1 | 2 | 3;
export interface DreamWorldState {
  /** The world the sheep is in, and the lap each world was last entered on (v3/01, section 5). */
  world: WorldN;
  laps: Record<WorldN, number>;
  /** A change of world under way: from, to, the lane distance of the gate's mark (logical px), and when (dream ms). */
  change: { from: WorldN; to: WorldN; dist: number; at: number } | null;
  /** The gates on the lane: which (1 the farm gate, 2 the foot of his bed, 3 its head) and where (logical px). */
  gates: { type: 1 | 2 | 3; dist: number; to: WorldN; lap: number; passed: boolean }[];
  /** When the moon show began (dream ms), or null (v3/07, section 5). */
  moonShowAt: number | null;
  beats: number;
  /** The farmer's breath, 0 to 1: his window on the farmhouse glows with it. */
  breath: number;
  /** Each fence's world, by its index: what the sheep jumps there. */
  worldOf: (index: number) => WorldN;
}
export const freshWorldState = (worldOf: (index: number) => WorldN): DreamWorldState => ({ world: 1, laps: { 1: 1, 2: 1, 3: 1 }, change: null, gates: [], moonShowAt: null, beats: 0, breath: 0, worldOf });

/** World ms for each change of world (v3/data/timings.json). */
export const CHANGE_MS: Record<WorldN, number> = { 2: 1400, 3: 1600, 1: 1400 };
