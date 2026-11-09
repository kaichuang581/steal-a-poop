import { FIELD } from '../../dream/dream';

/**
 * Counting Sheep's stage, V4.1 (docs/REDESIGN_PLAN_V4_1.md): the dream's logical field (src/dream/dream.ts, in pixels)
 * laid over a cloud raft in metres. +x is screen-right and the sheep runs toward it, staying at x = 0; the world
 * scrolls toward -x. The camera stands at +z and looks toward -z, so every z in the plan is mirrored here: its far
 * layers at z 50 are at z -50 (with the camera on the plan's side +x would be screen-left). The raft's near edge,
 * toward the camera, is at z = +2 and its far edge at z = -3. Everything here is pure, so it can be tested.
 */

/** Metres per logical pixel: the 20 px sheep is 0.72 m long (the real model at scale 1), the fence 0.43 x 0.58 m. */
export const PX = 0.036;
/** The world x of a logical x (a fence's near edge), measured from the sheep's nose at FIELD.sheepX. */
export const worldX = (logicalX: number): number => (logicalX - FIELD.sheepX) * PX;
/** How far the world has scrolled, in metres, after `distPx` logical pixels of running. */
export const scrollOf = (distPx: number): number => distPx * PX;

/** The raft: its snow top, from the near edge (toward the camera) to the far edge, and the flat lane along it. */
export const RAFT = { nearZ: 2.0, farZ: -3.0, laneNear: 1.0, laneFar: -1.0 } as const;

/** The raft's chunk ring: 4 m chunks, six on a 24 m ring from x = -8 to 16. */
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

/**
 * The camera (V4.1 Part 4.1), fixed. The phone looks along the lane from the lower left; the plan's phone numbers leave
 * the sheep at the frame's left edge and the fence out of it, so these are solved from its targets: the hooves at
 * (30%, 58%) with the first fence in view.
 */
export interface Shot { position: [number, number, number]; target: [number, number, number]; fov: number }
export const DESKTOP_SHOT: Shot = { position: [2.5, 1.6, 8.8], target: [2.5, 0.83, 0], fov: 32 };
export const PHONE_SHOT: Shot = { position: [-9.5, 3.8, 10], target: [1, 0.9, 0.5], fov: 44 };
export const LANDSCAPE_PHONE_FOV = 36;
export function dreamShot(phone: boolean, landscapePhone = false): Shot {
  if (phone) return PHONE_SHOT;
  return landscapePhone ? { ...DESKTOP_SHOT, fov: LANDSCAPE_PHONE_FOV } : DESKTOP_SHOT;
}

type V = readonly [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
function axes(shot: Shot) {
  const f = unit(sub(shot.target, shot.position));
  const r = unit(cross(f, [0, 1, 0]));
  return { f, r, u: cross(r, f) };
}
/** Where a world point lands, as percentages of the frame's width and height from the top-left. */
export function frameOf(shot: Shot, aspect: number, p: V): [number, number] {
  const { f, r, u } = axes(shot);
  const d = sub(p, shot.position), depth = dot(d, f), t = Math.tan((shot.fov * Math.PI) / 360);
  return [50 + (dot(d, r) / (depth * t * aspect)) * 50, 50 - (dot(d, u) / (depth * t)) * 50];
}
/** The world point at (`xPct`, `yPct`) of the frame that lies on the plane z = `z`. */
export function atFrame(shot: Shot, aspect: number, xPct: number, yPct: number, z: number): [number, number, number] {
  const { f, r, u } = axes(shot);
  const t = Math.tan((shot.fov * Math.PI) / 360);
  const ray = unit([0, 1, 2].map((i) => f[i] + r[i] * ((xPct - 50) / 50) * t * aspect + u[i] * ((50 - yPct) / 50) * t) as unknown as V);
  const k = (z - shot.position[2]) / ray[2];
  return [shot.position[0] + ray[0] * k, shot.position[1] + ray[1] * k, z];
}

/** The fog and the sky's horizon (V4.1 Part 4.3). */
export const DREAM_FOG = { color: '#A99BDD', density: 0.012, phoneDensity: 0.0085 } as const;
/** The moon's place in the frame. On a phone it drops below the board. */
export const moonFrame = (aspect: number): readonly [number, number] => (aspect < 1 ? [86, 14] : [88, 10]);
/**
 * The sky, by elevation in degrees from the camera. The plan gives its stops as shares of the dome's height, but the
 * camera only sees 11 degrees above the horizon, so the stops are set to land where the frame map and gate G1 put them.
 */
export const SKY_STOPS: readonly [number, string][] = [[-30, '#B8ADE6'], [-1, '#B8ADE6'], [0, '#A99BDD'], [4.8, '#7E6FC4'], [8.2, '#5B4C9F'], [10, '#3F3480'], [90, '#3F3480']];
/** The far ranges' tones (V4.1 Part 4.2), before the light and the fog. */
export const FAR = { hillSide: '#4A3D85', hillCap: '#9A91CC', mountain: '#5A5090', mountainCap: '#A59DCC' } as const;
/** The raft's tones (V4.1 Parts 4.2 and 5). */
export const RAFT_TONES = {
  snow: '#F3F0FA', lane: '#E7E2F4', pit: '#CFC8EA', lip: '#DCD5F3', ridge: '#FAF8FE', ridgeSide: '#F1EDFB', sea: '#E0D9F5', seaSide: '#C9C0EC',
  grass: '#5E7A5A', flowerA: '#E9B4C8', flowerB: '#FFF1B8', rock: '#B9B0DC', rockSide: '#9C92C8',
} as const;
/** An island's tones (V4.1 Part 4.2). */
export const ISLAND_TONES = { snow: '#F3F0FA', cloud: '#D8D0F2', crease: '#BCB1E6', wisp: '#E6E0F8' } as const;

/**
 * The three islands (V4.1 Part 6), placed by the on-screen boxes the plan gives them. Its metres (3.6 m across at z 11)
 * overflow its own boxes and its limit of 16% of the frame's width, so the boxes win, as they did in v4.
 */
export type IslandKind = 'pine-lantern' | 'windmill' | 'bench';
export type Box = [number, number, number, number];
export interface Island { id: 'A' | 'B' | 'C'; kind: IslandKind; box: Box; phoneBox: Box; z: number; factor: number; bob: number }
export const ISLANDS: readonly Island[] = [
  { id: 'A', kind: 'pine-lantern', box: [12, 26, 19, 30], phoneBox: [6, 38, 13, 21], z: -11, factor: 0.12, bob: 8 },
  { id: 'B', kind: 'windmill', box: [62, 76, 13, 22], phoneBox: [50, 78, 17, 23], z: -14, factor: 0.08, bob: 11 },
  { id: 'C', kind: 'bench', box: [40, 50, 25, 33], phoneBox: [14, 38, 25, 31], z: -12, factor: 0.12, bob: 9.5 },
];
/** Where an island's snow top sits and how big it is, on the shot it was laid out for. */
export function islandPlace(it: Island, phone = false, aspect = phone ? 390 / 844 : 16 / 9) {
  const shot = phone ? PHONE_SHOT : DESKTOP_SHOT;
  const [x0, x1, y0, y1] = phone ? it.phoneBox : it.box;
  const a = atFrame(shot, aspect, x0, y0, it.z), b = atFrame(shot, aspect, x1, y1, it.z);
  return { x: (a[0] + b[0]) / 2, y: a[1], across: b[0] - a[0], tall: a[1] - b[1] };
}
/** An island leaves past the left of the frame and comes back on the right 20 m later, at the same height. */
export function islandX(it: Island, scroll: number, x: number, across: number): number {
  const width = Math.abs(atFrame(DESKTOP_SHOT, 16 / 9, 100, 50, it.z)[0] - atFrame(DESKTOP_SHOT, 16 / 9, 0, 50, it.z)[0]);
  const left = x - width * 0.9 - across, span = width + across * 2 + 20;
  return ((((x - scroll * it.factor - left) % span) + span) % span) + left;
}
/** The wisps: thin lobes high in the sky. */
export const WISPS = [{ frame: [40, 14] as const, z: -7, factor: 0.06 }, { frame: [84, 21] as const, z: -8, factor: 0.06 }];

/**
 * Where the gate's samples land through a camera (V4.1 Part 9, E5): the desktop numbers are percentages of that frame,
 * so a phone's are found by projecting the same world points. Sky samples are taken by elevation.
 */
export function dreamFrame(shot: Shot, aspect: number, phone: boolean): Record<string, [number, number]> {
  const p = (w: V) => frameOf(shot, aspect, w);
  const [cx, cy, cz] = shot.position;
  const look = Math.atan2(shot.target[0] - cx, -(shot.target[2] - cz));
  const sky = (el: number, off = 0): [number, number] => {
    const d = 1000, a = look + (off * Math.PI) / 180;
    return p([cx + Math.sin(a) * d, cy + Math.tan((el * Math.PI) / 180) * d, cz - Math.cos(a) * d]);
  };
  const side = phone ? 8 : 16;
  const under = (i: number): [number, number] => { const it = ISLANDS[i], q = islandPlace(it, phone, aspect); return p([q.x, q.y - q.tall * 0.86, it.z + 0.1]); };
  const mid = atFrame(shot, aspect, 50, 50, -54)[0];
  return {
    skyTop: phone ? sky(10.1) : sky(10.6), skyA: sky(8.6, -side), skyB: sky(8.6, side * 0.4), moon: phone ? [moonFrame(aspect)[0] - 1.1, moonFrame(aspect)[1] + 0.5] : [...moonFrame(aspect)], skyAbove: sky(8.8),
    // The moon's sample sits in the body of the crescent: at phone size a 9 x 9 patch at its centre reaches the cut.
    laneA: p([1.8, 0, 0.55]), laneB: p([3.2, 0, 0.55]), ridgeA: p([1.3, -0.45, 2.75]), ridgeB: p([3.1, -0.45, 2.75]), sea: p([mid, 0, -24]),
    hillA: p([mid - 4, 4.4, -54]), hillB: p([mid + 3, 4.4, -54]), hillRow: p([mid, 5.7, -58]), mountA: p([mid - 8, 12, -112]), mountB: p([mid, 13.2, -112]),
    underA: under(0), underB: under(1), underC: under(2),
  };
}

/** How fast each layer scrolls against the lane. */
export const LAYER = { hills: 0.02, mountains: 0.01 } as const;
/** The wake-up timeline (V4.1 Part 7.4), in ms from the bump. */
export const WAKE = { stir: 350, pop: 600, popMs: 500, dark: 1100, finish: 1500, reducedFinish: 600, shakeMs: 300, shake: 0.03 } as const;
/**
 * The thought trail, as a share of the frame: x, y and width. The plan's third puff at (22, 66) would sit on the sheep's
 * hooves at (22, 67), so the trail runs clear of the sheep and ends on the near ridge, which is what the plan asks of it.
 */
export const PUFFS = [[12, 72, 3], [18.5, 71, 4.5], [27, 74, 6]] as const;
/** The drift-off (V4 Part 15), in ms from the last fence: how long the board holds before the results. */
export const DRIFT = { finish: 2000, reducedFinish: 600 } as const;
/** Where the first fence waits before the first key, in logical pixels ahead of the sheep's nose. */
export const FIRST_FENCE_AHEAD = 560; // about 5 s before the first jump (Brian: "you get barely any time")
