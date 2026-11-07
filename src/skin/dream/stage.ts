import type { BufferGeometry } from 'three';
import { FIELD } from '../../dream/dream';
import { BARN, YARD } from '../scene/layout';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import type { Tone } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import type { Paint } from '../voxel/primitives';

/**
 * Counting Sheep's stage: the dream's logical field (src/dream/dream.ts, in pixels) laid over the winter farm in
 * metres. The sheep runs on the spot at x = 0 along a lane in front of the barn's open side, and the farm itself
 * rolls past and comes round again, the way scenery does in a dream. Everything here is pure, so the layout and the
 * wrap can be tested.
 */

/** Metres per logical pixel: a 20 px sheep is a metre long, a 16 px fence 0.8 m high, a 28 px jump 1.4 m. */
export const PX = 0.05;
/** The lane: z of the run, in front of the barn's cut-away (the yard's snow only starts at z = -7, so the stage lays its own). */
export const LANE_Z = -12;
/** The strip of snow the lane runs on, from just behind the camera to the yard's own ground. */
export const STRIP = { minZ: -24, maxZ: -7 };
/** The world comes round every WRAP metres: the farm (80 m) and a stretch of open snow with pines (64 m). */
export const WRAP = 144;
/** Where the farm's origin sits on the ring (its barn is 12 m wide about x = 0, its yard 80 m). */
export const FARM_BASE = 72;
/** The open snow either side of the farm, as two 32 m chunks centred here. */
export const FILLER_BASES = [16, 128] as const;
export const FILLER_HALF = 16;
/** The sheep's draw scale: the model is about 1.3 m long at 1; at 0.85 it is the logical metre. */
export const SHEEP_SCALE = 0.85;

/**
 * The camera looks along +z, so screen-right is -x: the sheep runs toward -x and fences come from there. The world x
 * of a logical fence x (its near edge, in pixels), measured from the sheep's nose at pixel SX.
 */
export function fenceWorldX(fenceX: number): number {
  return -(fenceX - FIELD.sheepX) * PX;
}

/** The centre of a fence (its posts) in world x. */
export function fenceCentreX(fenceX: number): number {
  return fenceWorldX(fenceX) - (FIELD.fenceW / 2) * PX;
}

/** How far the world has rolled (toward +x, the way the sheep came from) after `distPx` logical pixels of running. */
export function scrollOf(distPx: number): number {
  return (distPx * PX) % WRAP;
}

/** A ring piece's world x for a scroll offset: its base, moved and wrapped into [-WRAP/2, WRAP/2). */
export function ringX(base: number, scroll: number): number {
  const half = WRAP / 2;
  return ((((base + scroll + half) % WRAP) + WRAP) % WRAP) - half;
}

/**
 * The camera: a side view from a little ahead of the sheep (so its face shows), framed by the screen's shape: the
 * sheep sits a quarter of the way in from the left edge whatever the aspect, and all the room to the right is for
 * seeing fences coming. A tall phone screen is too narrow for that, so the phone looks down the lane from behind the
 * sheep's shoulder and the fences come at it.
 */
export interface Shot { position: [number, number, number]; target: [number, number, number]; fov: number }
export const SIDE_SHOT = { distance: 9.5, height: 2.6, aimY: 1.3, fov: 40, sheepAt: 0.24, lead: 1.0 };
export function dreamShot(phone: boolean, aspect = 16 / 9): Shot {
  if (phone) return { position: [5.5, 2.9, LANE_Z - 4.5], target: [-4.5, 1.1, LANE_Z], fov: 62 };
  const c = SIDE_SHOT;
  const halfW = c.distance * Math.tan((c.fov / 2) * Math.PI / 180) * aspect;
  const targetX = -halfW * (1 - 2 * c.sheepAt);
  // The camera stands a little ahead of the sheep (toward -x), so its face shows.
  return { position: [targetX - c.lead, c.height, LANE_Z - c.distance], target: [targetX, c.aimY, LANE_Z], fov: c.fov };
}

// ---------- voxels (the yard's 0.2 m grid) ----------
const S = 0.2;
const snowTone: Paint = (x, y, z) => pick(T.snow, hash3(x >> 3, y, z >> 3, 2), [0.6, 0.97]);
const pathTone: Paint = (x, y, z) => pick(T.path, hash3(x, y, z, 5), [0.5, 0.85]);
const snow: Paint = (x, y, z) => pick(T.snow, hash3(x, y, z, 3), [0.55, 0.9]);
/** The dream's clouds: lavender-white, like wool in moonlight. */
export const CLOUD: Tone = ['#F7F2FF', '#E3D9F8', '#C3B2E4'];
const cloudTone: Paint = (x, y, z) => pick(CLOUD, hash3(x, y, z, 9), [0.55, 0.9]);

/** A flat snowfield from (x0, z0) to (x1, z1) metres, its top at y = 0, the lane trodden to path tones. */
function field(g: Grid, x0: number, x1: number, z0: number, z1: number, lane: boolean) {
  for (let xi = Math.round(x0 / S); xi < Math.round(x1 / S); xi++)
    for (let zi = Math.round(z0 / S); zi < Math.round(z1 / S); zi++) {
      const z = (zi + 0.5) * S;
      const onLane = lane && Math.abs(z - LANE_Z) < 1.1;
      const c = (onLane ? pathTone : snowTone)(xi, -1, zi);
      if (c) g.set(xi, -1, zi, c);
      // A few low drifts, all beyond the lane: nothing sits between the sheep and the camera.
      if (z > LANE_Z + 2 && hash3(xi >> 1, 7, zi >> 1, 11) > 0.992 && hash3(xi, 8, zi, 12) > 0.3) g.set(xi, 0, zi, snow(xi, 0, zi)!);
    }
}

/** A snowy pine like the yard's: a two-voxel trunk and tiers of radial branches, snow on every branch. */
function pine(g: Grid, wx: number, wz: number, seed: number, wy = 0, height = 5 + 4 * rng(seed * 97)()) {
  const r = rng(seed * 97 + 1);
  const H = height;
  const yb = Math.round(wy / S), hv = Math.round(H / S) + yb, tx = Math.round(wx / S) - 1, tz = Math.round(wz / S) - 1;
  const bark: Paint = (x, y, z) => pick(T.trunk, hash3(x, y, z, seed), [0.4, 0.85]);
  const needles: Paint = (x, y, z) => pick(T.pine, hash3(x, y, z, seed + 50), [0.45, 0.85]);
  for (let y = yb; y < hv - 2; y++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) g.set(tx + dx, y, tz + dz, bark(tx + dx, y, tz + dz)!);
  const y0 = yb + Math.round(1.4 / S), rMax = (H * 0.27) / S;
  const branch: [number, number, number][] = [];
  for (let y = y0, tier = 0; y < hv - 1; y += 3, tier++) {
    const t = (y - y0) / (hv - y0);
    const R = Math.max(1.5, (1 - t) * rMax + 1);
    const dirs = Math.max(5, Math.round(R * 1.4));
    const off = tier * 2.399 + r();
    for (let d = 0; d < dirs; d++) {
      const a = off + (d / dirs) * Math.PI * 2;
      const L = R * (0.8 + hash3(d, tier, seed, 31) * 0.3);
      for (let i = 1; i <= L; i += 0.6) {
        branch.push([Math.round(tx + 0.5 + Math.cos(a) * i), y - (i > L * 0.7 ? 1 : 0), Math.round(tz + 0.5 + Math.sin(a) * i)]);
      }
    }
  }
  for (const [x, y, z] of branch) g.set(x, y, z, needles(x, y, z)!);
  for (const [x, y, z] of branch) if (!g.has(x, y + 1, z)) g.set(x, y + 1, z, snow(x, y, z)!);
  g.set(tx, hv - 1, tz, needles(tx, hv - 1, tz)!);
  g.set(tx, hv, tz, needles(tx, hv, tz)!);
  g.set(tx, hv + 1, tz, snow(tx, hv + 1, tz)!);
}

/**
 * The snow the farm itself leaves bare (the yard only builds what Home's camera can see): the lane's strip in front
 * of the barn, and the ground beside the barn's walls. Built in the farm's own coordinates.
 */
export function farmApron(): BufferGeometry {
  const g = new Grid(S);
  field(g, YARD.minX, YARD.maxX, STRIP.minZ, STRIP.maxZ, true);
  // Beside the barn, and the front corners the yard skips.
  field(g, BARN.maxX + 1, YARD.maxX, BARN.minZ + S, BARN.maxZ, false);
  field(g, YARD.minX, BARN.minX - 1, BARN.minZ + S, BARN.maxZ, false);
  field(g, 14, YARD.maxX, -7, BARN.minZ + S, false);
  field(g, YARD.minX, -14, -7, BARN.minZ + S, false);
  // The farm's edges, lipped with cloud: both sides and the far end, so the yard reads as afloat.
  cloudLip(g, [YARD.minX, STRIP.minZ], [YARD.minX, YARD.maxZ], 41);
  cloudLip(g, [YARD.maxX, STRIP.minZ], [YARD.maxX, YARD.maxZ], 42);
  cloudLip(g, [YARD.minX, YARD.maxZ], [YARD.maxX, YARD.maxZ], 43);
  return buildGeometry(g.map, S);
}

/**
 * The 32 m between farms: nothing but the lane's strip of snow, afloat, and beyond its edge two little islands of
 * snow and pines hanging in the air at their own heights (the cloud sea below them is `fillerClouds`).
 */
export function fillerChunk(seed: number): BufferGeometry {
  const g = new Grid(S);
  field(g, -FILLER_HALF, FILLER_HALF, STRIP.minZ, STRIP.maxZ, true);
  cloudLip(g, [-FILLER_HALF, STRIP.maxZ], [FILLER_HALF, STRIP.maxZ], seed);
  const r = rng(seed * 131);
  islandInto(g, -FILLER_HALF + 5 + r() * 6, 2.5 + r() * 3, 14 + r() * 8, 3 + r() * 1.5, seed * 10 + 1);
  islandInto(g, FILLER_HALF - 5 - r() * 6, 4 + r() * 4, 26 + r() * 10, 3.5 + r() * 1.5, seed * 10 + 2);
  return buildGeometry(g.map, S);
}

/** The cloud grid: coarser than the snow (clouds are soft things; their voxels can be big). */
const C = 0.5;

/** The sea of cloud beyond the strip's edge, between farms. */
export function fillerClouds(seed: number): BufferGeometry {
  const g = new Grid(C);
  const r = rng(seed * 173);
  for (let i = 0; i < 10; i++) {
    const w = 5 + r() * 5;
    ellipsoid(g, [-FILLER_HALF + r() * FILLER_HALF * 2, -3.2 - r() * 1.5, STRIP.maxZ + 4 + r() * 34], [w, 2.2 + r() * 1.2, w * 0.8], cloudTone, 0.12, seed * 5 + i);
  }
  return buildGeometry(g.map, C);
}

/** Puffs of cloud every few metres along a line, sitting just proud of the ground so the edge shows as cloud. */
function cloudLip(g: Grid, a: [number, number], b: [number, number], seed: number) {
  const r = rng(seed * 59);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 3.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * 1.5, z = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 1.5;
    const w = 2.2 + r() * 1.4;
    ellipsoid(g, [x, -0.9 - r() * 0.3, z], [w, 1.1 + r() * 0.3, w], cloudTone, 0.2, seed * 11 + i);
  }
}

/**
 * The fence the sheep jumps: a short run of fence set along the lane the way a side-scroller's fences are, so the
 * camera sees it face on: two posts FIELD.fenceW apart with two rails on the near face and snow along the top, on the
 * barn's finer 0.1 m grid. Built about x = 0 at ground level, FIELD.fenceH px tall.
 */
export function jumpFence(): BufferGeometry {
  const F = 0.1;
  const g = new Grid(F);
  const wood: Paint = (x, y, z) => pick(T.beam, hash3(x, y, z, 17), [0.45, 0.85]);
  const h = Math.round((FIELD.fenceH * PX) / F); // 8 voxels
  const half = Math.round((FIELD.fenceW * PX) / 2 / F); // 3 voxels
  for (const px of [-half, half - 1]) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) {
    for (let y = 0; y < h; y++) g.set(px + dx, y, dz, wood(px + dx, y, dz)!);
    g.set(px + dx, h, dz, snow(px + dx, h, dz)!);
  }
  for (const y of [Math.round(h * 0.35), h - 2]) for (let x = -half - 1; x <= half + 1; x++) {
    g.set(x, y, -1, wood(x, y, -1)!);
    if (y === h - 2 && hash3(x, y, 1, 8) > 0.3) g.set(x, y + 1, -1, snow(x, y + 1, -1)!);
  }
  return buildGeometry(g.map, F);
}

/** The lamp colour the dream borrows from the barn's lanterns. */
export const DREAM_GLOW = lin(T.lantern[0]);

// ---------- the dream itself: a sky of violet, and everything afloat ----------

/** The dream's colours: the sky's zenith, horizon (which is also the fog) and nadir, and the moon's halo. */
export const DREAM_SKY = { zenith: '#1A0F3A', horizon: '#8A6DB5', nadir: '#2B1A55', halo: '#F3B4D4', fogDensity: 0.0045 } as const;

/**
 * Where the far scenery floats, all of it well beyond the yard's far edge (z > YARD.maxZ) so nothing ever crosses the
 * lane, and spread over the width the camera sees. Islands carry pines; clouds make the sea below and the sky above.
 */
export interface Afloat { x: number; y: number; z: number; seed: number; scale: number }
export const ISLANDS: readonly Afloat[] = [
  { x: -70, y: 6, z: 95, seed: 1, scale: 1 },
  { x: 30, y: -8, z: 120, seed: 2, scale: 1.2 },
  { x: 95, y: 14, z: 150, seed: 3, scale: 0.9 },
  { x: -25, y: 24, z: 190, seed: 4, scale: 1.1 },
  { x: -120, y: -4, z: 170, seed: 5, scale: 1.3 },
  { x: 60, y: 30, z: 240, seed: 6, scale: 1 },
];
export const CLOUDS: readonly Afloat[] = [
  { x: -40, y: -22, z: 80, seed: 11, scale: 1.4 },
  { x: 50, y: -26, z: 100, seed: 12, scale: 1.6 },
  { x: -110, y: -18, z: 130, seed: 13, scale: 1.3 },
  { x: 120, y: -30, z: 160, seed: 14, scale: 1.8 },
  { x: 0, y: -34, z: 200, seed: 15, scale: 2.2 },
  { x: -70, y: -28, z: 250, seed: 16, scale: 2 },
  { x: 90, y: -12, z: 230, seed: 17, scale: 1.5 },
  { x: -150, y: 40, z: 210, seed: 18, scale: 1.2 },
  { x: 140, y: 50, z: 260, seed: 19, scale: 1.4 },
  { x: 20, y: 62, z: 280, seed: 20, scale: 1.6 },
];
/** The sheep-shaped clouds crossing the sky the way the hero runs (toward -x), at these heights and depths. */
export const CLOUD_SHEEP: readonly Afloat[] = [
  { x: 60, y: 16, z: 150, seed: 31, scale: 1 },
  { x: -80, y: 28, z: 220, seed: 32, scale: 1.4 },
  { x: 130, y: 12, z: 190, seed: 33, scale: 0.8 },
];
/** How far (m) a sheep-cloud drifts before it comes round the other side, and how fast. */
export const CLOUD_SHEEP_SPAN = 320;
export const CLOUD_SHEEP_SPEED = 1.6;
/** The dream moon: huge, low over the far edge on the side the sheep runs toward. */
export const MOON = { position: [-34, 24, 230] as const, scale: 3, haloRadius: 70 };

/** A floating island: a disc of snow with cloud piled under it and a few pines on top. Built about its own centre. */
export function skyIsland(seed: number): BufferGeometry {
  const g = new Grid(S);
  islandInto(g, 0, 0, 0, 4.5 + rng(seed * 211)() * 3.5, seed);
  return buildGeometry(g.map, S);
}

/** An island of radius R (m) into a 0.2 m grid, its snow top at (cx, cy, cz): snow disc, cloud below, pines above. */
function islandInto(g: Grid, cx: number, cy: number, cz: number, R: number, seed: number) {
  const r = rng(seed * 211 + 1);
  const rv = R / S, ox = Math.round(cx / S), oy = Math.round(cy / S), oz = Math.round(cz / S);
  const under: Paint = (x, y, z) => (y >= oy - 1 ? null : cloudTone(x, y, z));
  for (let x = Math.floor(-rv) - 1; x <= Math.ceil(rv) + 1; x++)
    for (let z = Math.floor(-rv) - 1; z <= Math.ceil(rv) + 1; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5) / rv;
      const edge = 1 + (hash3(x >> 2, 0, z >> 2, seed) - 0.5) * 0.3;
      if (d <= edge) g.set(ox + x, oy - 1, oz + z, snowTone(ox + x, oy - 1, oz + z)!);
    }
  ellipsoid(g, [cx, cy - R * 0.3, cz], [R * 0.95, R * 0.32, R * 0.95], under, 0.3, seed);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + r();
    ellipsoid(g, [cx + Math.cos(a) * R * 0.5, cy - R * 0.2 - r() * R * 0.2, cz + Math.sin(a) * R * 0.5], [R * 0.4, R * 0.28, R * 0.4], under, 0.3, seed + k + 1);
  }
  const pines = 1 + Math.floor(r() * 3);
  for (let i = 0; i < pines; i++) pine(g, cx + (r() - 0.5) * R * 1.1, cz + (r() - 0.5) * R * 1.1, seed * 10 + i, cy, Math.min(2.5 + R * 0.7, 5 + r() * 3));
}

/** A cloud: a few rough ellipsoids on a 1 m grid (they live far off, where the voxels read as paint). */
export function cloudBlob(seed: number): BufferGeometry {
  const g = new Grid(1);
  const r = rng(seed * 331);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const w = 6 + r() * 8;
    ellipsoid(g, [(r() - 0.5) * 18, (r() - 0.5) * 3, (r() - 0.5) * 8], [w, 2.5 + r() * 2, w * 0.7], cloudTone, 0.35, seed * 7 + i);
  }
  return buildGeometry(g.map, 1);
}

/** A sheep-shaped cloud (what else would cross a counting dream?), facing -x like the hero, on a 1 m grid. */
export function cloudSheep(seed: number): BufferGeometry {
  const g = new Grid(1);
  ellipsoid(g, [0.5, 0.5, 0.5], [5.5, 3.4, 3.2], cloudTone, 0.3, seed);
  ellipsoid(g, [-5.5, 1.5, 0.5], [2.4, 2, 1.9], cloudTone, 0.2, seed + 1);
  for (const [x, z] of [[-3, -1.5], [-3, 1.5], [3, -1.5], [3, 1.5]]) box(g, [x, -5, z], [x + 1, -2, z + 1], cloudTone);
  box(g, [5, 1, 0], [6, 2, 1], cloudTone);
  return buildGeometry(g.map, 1);
}

/** A paper lantern to drift up through the dream: a little box of lantern tones with a darker cap, 0.1 m voxels. */
export function dreamLantern(): BufferGeometry {
  const g = new Grid(0.1);
  const paper: Paint = (x, y, z) => pick(T.lantern, hash3(x, y, z, 21), [0.7, 0.95]);
  const cap: Paint = (x, y, z) => pick(T.beam, hash3(x, y, z, 22), [0.4, 0.8]);
  box(g, [-0.15, 0, -0.15], [0.15, 0.4, 0.15], paper, 1);
  box(g, [-0.2, 0.4, -0.2], [0.2, 0.5, 0.2], cap);
  box(g, [-0.2, -0.1, -0.2], [0.2, 0, 0.2], cap);
  return buildGeometry(g.map, 0.1);
}

/** A sleepy Z, 1 m tall, built face-on to the camera (which looks along +z, so screen-right is -x). */
export function sleepZ(): BufferGeometry {
  const g = new Grid(0.2);
  const c = cloudTone;
  for (let x = -2; x <= 2; x++) { g.set(x, 5, 0, c(x, 5, 0)!); g.set(x, 0, 0, c(x, 0, 0)!); }
  for (let y = 1; y <= 4; y++) { const x = 2 - y; g.set(x, y, 0, c(x, y, 0)!); }
  return buildGeometry(g.map, 0.2);
}

/** The dream moon: a 1 m voxel disc 14 m across with a few craters, face-on to the camera. */
export function dreamMoon(): BufferGeometry {
  const g = new Grid(1);
  for (let x = -7; x < 7; x++) for (let y = -7; y < 7; y++) if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= 48) g.set(x, y, 0, lin('#F8F1E2'));
  for (const [x, y] of [[-4, 1], [-1, 3], [2, -3], [3, 2], [-2, -4]]) g.set(x, y, 0, lin('#D8CFBC'));
  return buildGeometry(g.map, 1);
}
