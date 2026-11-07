import { FIELD } from '../../dream/dream';

/**
 * Counting Sheep's stage, V4 (docs/REDESIGN_PLAN_V4_DREAM.md Part 4): the dream's logical field (src/dream/dream.ts,
 * in pixels) laid over a cloud island in metres. +x is screen-right and the sheep runs toward it, staying at x = 0;
 * the world scrolls toward -x. The camera stands at +z and looks toward -z (the plan's z is mirrored so that +x is
 * the right of the screen); the lane's near edge, toward the camera, is at z = +2 and its far edge at z = -3.
 * Everything here is pure, so the layout, the chunk ring and the island recycling can be tested.
 */

/** Metres per logical pixel: the 20 px sheep is 0.72 m long (the real model at scale 1), the fence 0.43 x 0.58 m. */
export const PX = 0.036;
/** The world x of a logical x (a fence's near edge), measured from the sheep's nose at FIELD.sheepX. */
export const worldX = (logicalX: number): number => (logicalX - FIELD.sheepX) * PX;
/** How far the world has scrolled, in metres, after `distPx` logical pixels of running. */
export const scrollOf = (distPx: number): number => distPx * PX;

/** The lane: the top of the cloud island, from the near edge (toward the camera) to the far edge. */
export const LANE = { nearZ: 2.0, farZ: -3.0, width: 1.6, ridgeBottom: -1.6 } as const;
/** The cloud sea beyond the far edge, and its scroll factor. */
export const SEA = { fromZ: -6, toZ: -10, y: -1.5, factor: 0.5, period: 28 } as const;
/** Depth layers: nearer layers scroll faster. */
export const LAYER = { lane: 1.0, near: 0.35, mid: 0.2, far: 0.1, hills: 0.05, mountains: 0.02, sky: 0 } as const;
export const HILLS = { ranges: [[-14, -22], [-24, -32]] as const, period: 48 };
export const MOUNTAINS = { fromZ: -40, toZ: -70, period: 96 };

/** The lane's chunk ring: 4 m chunks, six on a 24 m ring from x = -8 to 16. */
export const CHUNK = { size: 4, count: 6, from: -8 } as const;
export interface ChunkPlacement { index: number; x: number; gen: number }
/** Where each chunk is after `scroll` metres: its x, and how many times it has gone round (its variant is its index). */
export function chunkPlacements(scroll: number): ChunkPlacement[] {
  const span = CHUNK.size * CHUNK.count;
  return Array.from({ length: CHUNK.count }, (_, index) => {
    const p = CHUNK.from + index * CHUNK.size - scroll;
    const gen = p < CHUNK.from ? Math.ceil((CHUNK.from - p) / span) : 0;
    return { index, x: p + gen * span, gen };
  });
}

/** An island (V4 Part 6.2): its layer, size, where it spawns, and what it carries. */
export type Layer = 'near' | 'mid' | 'far';
export interface Island { id: number; layer: Layer; across: number; tall: number; x: number; y: number; z: number; period: number; kind: 'pines-bench' | 'pine-lantern' | 'barn' | 'pines' | 'windmill' | 'haystack' }
export const ISLANDS: readonly Island[] = [
  // y is the snow top; each island's lowest lobe stays at least 2.2 m above the lane (its underside hangs ~0.85 of `tall`).
  { id: 1, layer: 'near', across: 4.5, tall: 2.6, x: 7.5, y: 4.6, z: -1.5, period: 7, kind: 'pines-bench' },
  { id: 2, layer: 'near', across: 3.2, tall: 2.0, x: 13.5, y: 4.2, z: -2.5, period: 9, kind: 'pine-lantern' },
  { id: 3, layer: 'mid', across: 6.0, tall: 3.2, x: 3.5, y: 5.2, z: -6, period: 11, kind: 'barn' },
  { id: 4, layer: 'mid', across: 4.0, tall: 2.4, x: 11.5, y: 4.5, z: -7, period: 8, kind: 'pines' },
  { id: 5, layer: 'far', across: 7.0, tall: 3.5, x: 0, y: 5.6, z: -12, period: 10, kind: 'windmill' },
  { id: 6, layer: 'far', across: 5.0, tall: 2.8, x: 10, y: 5.0, z: -13, period: 9, kind: 'haystack' },
];
/** An island leaves at x < -12 (in its layer's scroll) and comes back at 14 plus a seeded offset. */
export const RECYCLE = { leave: -12, enter: 14 } as const;
export function islandX(island: Island, scroll: number): number {
  const span = RECYCLE.enter - RECYCLE.leave + 2 + (island.id * 1.7) % 5;
  const p = island.x - scroll * LAYER[island.layer];
  return ((((p - RECYCLE.leave) % span) + span) % span) + RECYCLE.leave;
}

/** The camera (V4 Part 4.2), fixed; the phone looks along the lane from the lower left. */
export interface Shot { position: [number, number, number]; target: [number, number, number]; fov: number }
export const DESKTOP_SHOT: Shot = { position: [1.5, 2.3, 8.7], target: [1.5, 0.9, 0], fov: 30 };
export const PHONE_SHOT: Shot = { position: [3.2, 3.0, 9.5], target: [1.2, 0.9, -1.5], fov: 46 };
export const LANDSCAPE_PHONE_FOV = 34;
export function dreamShot(phone: boolean, landscapePhone = false): Shot {
  if (phone) return PHONE_SHOT;
  return landscapePhone ? { ...DESKTOP_SHOT, fov: LANDSCAPE_PHONE_FOV } : DESKTOP_SHOT;
}

/** The bedroom (V4 Part 5.1): its group's position and yaw, and the three trail puffs between the sleeper and the dream. */
/**
 * Tuned to the frame targets (Part 4.3) rather than the plan's metres, which fall outside its own camera: the farmer's
 * head lands at (10%, 86%) of the desktop frame, the foot of the bed is cropped by the bottom edge, and the puffs
 * climb from (14%, 79%) to (22%, 70%).
 */
export const BEDROOM = { position: [-0.52, 0.07, 4.2] as const, phonePosition: [1.67, 0.55, 5.4] as const, yaw: -(55 * Math.PI) / 180, phoneScale: 0.8 };
export const TRAIL: readonly { c: [number, number, number]; r: number }[] = [
  { c: [-0.1, 0.98, 4.1], r: 0.12 },
  { c: [-0.05, 1.08, 3.6], r: 0.18 },
  { c: [0.05, 1.2, 3.0], r: 0.26 },
];
/** The moon's place (Part 6.1), its size, and the dream sky's colours. */
export const DREAM_SKY = { top: '#5B4AA6', middle: '#8A78D2', horizon: '#D2C6F4', moon: '#FFF1B8', night: '#1E1A33', fogDensity: 0.035 } as const;
export const MOON = { position: [36, 24, -60] as const, across: 6 };
/** The wake-up timeline (Part 5.5), in ms from the bump. */
export const WAKE = { stir: 350, pop: 600, popMs: 500, dark: 1100, finish: 1500, reducedFinish: 600, shakeMs: 300, shake: 0.03 } as const;
/** Where the first fence waits before the first key (Part 5.6), in logical pixels ahead of the sheep's nose. */
export const FIRST_FENCE_AHEAD = 150;
