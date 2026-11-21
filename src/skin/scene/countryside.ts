import type { BufferGeometry } from 'three';
import { buildGeometry, packGeometry, triangles } from '../voxel/mesher';
import type { BuildOptions } from '../voxel/mesher';
import { unseenFrom } from '../voxel/unseen';
import { asBefore, lin, pick, T } from '../voxel/palette';
import { snowAt, snowPaint } from '../voxel/snow';
import { tieredPine } from './style/pine';
import { standsInWendigoZone } from './wendigoZone';
import { box, ellipsoid, Grid, hash3, line, rng } from '../voxel/primitives';
import type { Paint, RGB } from '../voxel/primitives';
import { backHillHeight } from './distance';
import { noteShade } from '../voxel/groundShade';
import { chunkMaps, landHeight } from './farmstead';
import { finish } from './slices';
import type { Steps } from './slices';
import type { ChunkMap } from './yard';
import { YARD } from './layout';

/**
 * The land around the farm, seen only from the start screen, so it reads as a place rather than a flat white board:
 * woods standing in uneven clumps, drifts that give the snow some shape, shrubs, rocks and dead grass, a dry stone wall
 * round the orchard. All of it is placed by `isClear`, which keeps it
 * off the farm and out of the way of every camera on the tour.
 */

const S = 0.2;
const F = 0.1;
const snow: Paint = snowPaint(S, 201);
/**
 * Builds a thing that stands at (x, z). In the wendigo's zone (scene/wendigoZone.ts: its stand, and the paddock camera's
 * line to it) it is built exactly as it always was, voxel for voxel: that zone is pinned (tools/scenes/wendigo.pins.json).
 * Everywhere else it takes the flat colours of 2026-11-18 (Brian, 2026-11-19, of changing this land: "yes, remodel").
 */
const stands = (x: number, z: number, build: () => void): void => {
  if (standsInWendigoZone(x, z)) asBefore(build);
  else if (!taken(x, z)) build();
};
/**
 * Ground the farm has taken since isClear was frozen: the whole farmstead, from the windbreak to the pasture's far side
 * and from the field's fence to the road. Nothing of the open land's (no bush, rock or forest pine) stands on it.
 */
const TAKEN: [number, number, number, number][] = [[-41, 32, -15, YARD.maxZ]];
/**
 * The tour camera that has moved since the freeze to stand off the farm's own ground (computer 1 in the tour's shot
 * list), as [position, target]: its first stretch is kept open as CLEAR_SIGHT_LINES keeps the others'. Written out,
 * because this file may never read the live tour (wendigoFence.test.ts); countryside.test.ts holds it to it.
 */
const LATER_SIGHT_LINES: [number[], number[]][] = [[[12, 22, 52], [-10, 0.5, 8]]];
const taken = (x: number, z: number) => TAKEN.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)
  || LATER_SIGHT_LINES.some(([position, target]) => fromSightLine(x, z, position, target) <= 3);
/** Whether the open ground's bushes and rocks may be built at (x, z) today: clear at the freeze, and not taken since. */
export const isOpen = (x: number, z: number) => isClear(x, z) && !taken(x, z);
/**
 * Litter the open ground no longer has (Brian, 2026-11-19: no "random shapes"; everything "intentionally placed"): built
 * only in the wendigo's zone, where it stands as it always did. Its random draws are still taken, so what is kept
 * (bushes, rocks) stands where it stood.
 */
const kept = (x: number, z: number, build: () => void): void => { if (standsInWendigoZone(x, z)) asBefore(build); };

/**
 * The yard as `isClear` knew it on 2026-11-16. isClear's answers are frozen with the wendigo's zone (the land is planted
 * through it from shared random streams: scene/__tests__/wendigoFence.test.ts), so it never follows the yard's later
 * moves. What the yard has taken since then is `taken`, which only leaves a thing unbuilt.
 */
const FROZEN = {
  fence: { z: 15, minX: -16, maxX: 16 },
  tractor: { x: 9.6, z: 8.6 },
  pines: [[-14, 20], [-17, 26], [13, 33], [17, 19], [-6, 40], [7, 42], [-22, 34], [22, 30], [-9.8, 12.7], [-10.9, 16.8]],
} as const;

/** Written out, not read from the layout: the barn, the paddock, the run, the field, the orchard, the tractor, the farmhouse, the pond, the path, the fence. */
const RECTS: [number, number, number, number][] = [
  [-8, 8, -6, 10],
  [11, 23, -15, 8],
  [-20, -7.6, -6, 9],
  [-27, 31, -28, -14],
  [-39, -21, -16, 12],
  [FROZEN.tractor.x - 3, FROZEN.tractor.x + 5, FROZEN.tractor.z - 3, FROZEN.tractor.z + 4],
  [-15, -2, 24, 35],
  [2.5, 17.5, 18, 30],
  [-3, 3, 7, 26],
  [FROZEN.fence.minX - 1, FROZEN.fence.maxX + 1, FROZEN.fence.z - 1, FROZEN.fence.z + 1],
];

/** How far a point is from the first stretch of a camera's line of sight. */
function fromSightLine(x: number, z: number, from: readonly number[], to: readonly number[]): number {
  const dx = to[0] - from[0], dz = to[2] - from[2], length = Math.hypot(dx, dz) || 1;
  const t = Math.min(12, Math.max(0, ((x - from[0]) * dx + (z - from[2]) * dz) / length));
  return Math.hypot(x - (from[0] + (dx / length) * t), z - (from[2] + (dz / length) * t));
}

type V3 = readonly [number, number, number];
/**
 * The fourteen sight lines `isClear` keeps the land out of: where each camera of the start screen's tour stood and what
 * it looked at on 2026-11-16 (POV_SHOTS in homePov.ts at commit 6edc7fe), the eight computer shots, then the six phone
 * shots. FROZEN: a copy on purpose, never read from POV_SHOTS again. Every builder below asks `isClear` while drawing
 * from shared random streams, so a tour camera moved a few metres used to re-plant the scrub and the woods round the
 * wendigo. A camera may move in homePov.ts; these numbers may not (plan file 04, section 4.1), and
 * __tests__/wendigoFence.test.ts holds them.
 */
export const CLEAR_SIGHT_LINES: readonly (readonly [position: V3, target: V3])[] = [
  [[-12.5, 7, 23], [0.6, 1.6, 4.5]], // computer 0, the avatar in the doorway
  [[-40, 21, 40], [-8, 1, 1]], // computer 1, the whole farm
  [[21.2, 2.3, 6.2], [12.5, 0.9, -2.5]], // computer 2, the paddock
  [[0.2, 1.1, 2.6], [1.5, 1.7, 8.2]], // computer 3, over the avatar's shoulder
  [[-6.2, 2.9, 12.2], [-15.4, 0.7, 3.2]], // computer 4, the hens' run
  [[6, 1.2, 14.4], [7.4, 1.7, 7.4]], // computer 5, the tractor
  [[-1.6, 0.95, 15], [-1.5, 1.25, 8.2]], // computer 6, down the path
  [[14.8, 3.4, 31], [3.6, 2.2, 10]], // computer 7, across the pond
  [[-6.5, 4.6, 21], [0, -0.9, 8.2]], // phone 0, the avatar in the doorway
  [[-38, 26, 42], [-4, -9, 9]], // phone 1, the whole farm
  [[21.2, 3.4, 7.8], [15, -3, -1.5]], // phone 2, the paddock
  [[0.2, 1.6, -3.2], [0, -1.1, 8.2]], // phone 3, through the barn
  [[-6.5, 4.2, 13], [-12.2, -2.6, 3.8]], // phone 4, the hens' run
  [[0.3, 1.1, 22], [0, -1, 8.2]], // phone 5, down the path
];

/** Somewhere open: off the farm, off the yard's pines, and not in front of any camera on the tour. */
export function isClear(x: number, z: number): boolean {
  if (RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return false;
  if (FROZEN.pines.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3)) return false;
  return CLEAR_SIGHT_LINES.every(([position, target]) => fromSightLine(x, z, position, target) > 3);
}

/** Clumps of woodland: [x, z, radius, trees]. Uneven on purpose, with gaps between them to see through. The land behind
 *  the field is not clumps but a forest (`forest`). */
const WOODS: [number, number, number, number][] = [
  [47, -29, 12, 7], [-54, -14, 11, 7], [-60, 13, 13, 8], [-44, 33, 8, 4], [37, -13, 7, 4], [42, 11, 10, 6], [33, 33, 7, 3],
];

/** Where the wendigo stands (src/skin/table/Wendigo.tsx): up on the back hills, past the step up from the field, in
 *  among the trees, so from the paddock the lip of the step hides its feet. */
export const WENDIGO_AT: [number, number] = [-9.6, -36.1];

/** The ground's own height at (x, z): the terrain's columns (round(landHeight)) in front, the back hills' behind. */
export function groundAt(x: number, z: number): number {
  return z < -34 && Math.abs(x) < 100 ? Math.max(1, Math.round(backHillHeight(x, z))) : Math.round(landHeight(x, z));
}
/** Where a trunk goes in: the ground under it, a little sunk. None stands near the step up to the back hills (`steep`),
 *  where any one height would leave it buried in the face or standing out on a stilt. */
const footing = (x: number, z: number) => groundAt(x, z) - 0.2;
const steep = (x: number, z: number) => Math.max(...[[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].map(([a, b]) => Math.abs(groundAt(x + a, z + b) - groundAt(x, z)))) > 1.5;

/**
 * A pine for the woods, seen from twenty metres and more: solid tiers of needles, each a skirt that slopes up and in, with
 * a ragged rim and snow lying on what each tier leaves open to the sky. The yard's pine (`pine` in yard.ts) is built from
 * single-voxel branches with snow on every one; from far off, and above all at the forest's coarser grid, that became a
 * white and green checker that crawled as the camera moved. `ground` is in metres; the tree is drawn at the grid's size.
 */
function forestPine(g: Grid, wx: number, wz: number, H: number, seed: number, ground: number) {
  // Outside the wendigo's zone: the diorama's tiered pine (style/pine.ts), as Brian's farm picture draws them.
  if (!standsInWendigoZone(wx, wz)) {
    if (taken(wx, wz)) return;
    const k = g.size;
    tieredPine((x, y, z, c) => g.set(x, y, z, c), (x, y, z) => g.has(x, y, z), Math.round(wx / k), Math.round(wz / k), Math.round(ground / k), H, k);
    return;
  }
  asBefore(() => raggedPine(g, wx, wz, H, seed, ground));
}

/** The forest's pine as it was before 2026-11-19, kept for the wendigo's zone. */
function raggedPine(g: Grid, wx: number, wz: number, H: number, seed: number, ground: number) {
  const k = g.size, r = rng(seed * 131);
  const cx = wx / k, cz = wz / k, y0 = Math.round(ground / k);
  const cells = new Map<string, [number, number, number, number]>(); // x, y, z, how far out (0 at the trunk, 1 at the rim)
  const put = (x: number, y: number, z: number, out: number) => cells.set(`${x},${y},${z}`, [x, y, z, out]);
  const bare = H * 0.2, top = H;
  // The trunk, round, up into the crown.
  const tr = Math.max(0.5, 0.17 / k);
  for (let y = 0; y < (top * 0.8) / k; y++)
    for (let x = Math.floor(cx - tr); x <= Math.ceil(cx + tr); x++)
      for (let z = Math.floor(cz - tr); z <= Math.ceil(cz + tr); z++) if ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2 <= tr * tr) put(x, y, z, -1);
  // Tiers from the bottom of the crown to the top, overlapping, each smaller than the one below.
  const n = Math.max(3, Math.round((top - bare) / 0.95));
  const span = (top - bare) / n;
  for (let i = 0; i < n; i++) {
    const t = i / n, yb = bare + (top - bare) * t * 0.94, R = (0.3 * H * (1 - t) ** 0.9 + 0.3) * (0.9 + r() * 0.2);
    const turn = r() * Math.PI * 2;
    for (let y = Math.round(yb / k); y <= Math.round((yb + span * 1.35) / k); y++) {
      const f = (y * k - yb) / (span * 1.35), rr = (R * (1 - 0.7 * f)) / k;
      for (let x = Math.floor(cx - rr - 1); x <= Math.ceil(cx + rr + 1); x++)
        for (let z = Math.floor(cz - rr - 1); z <= Math.ceil(cz + rr + 1); z++) {
          const dx = x + 0.5 - cx, dz = z + 0.5 - cz, d = Math.hypot(dx, dz);
          // A ragged rim: the edge comes and goes in a dozen boughs round the tier.
          const a = Math.atan2(dz, dx) + turn, bough = 0.82 + 0.18 * Math.abs(Math.sin(a * 6)) + (hash3(Math.floor(a * 2), i, seed, 91) - 0.5) * 0.16;
          if (d <= rr * bough) put(x, y, z, d / Math.max(1, rr));
        }
    }
  }
  // A leader above the top tier, from the tier's own top: started at the drawn height it could leave a cell of air
  // under it (Brian, 2026-11-09: "a lot of them are floating").
  const lx = Math.floor(cx), lz = Math.floor(cz);
  let crown = 0;
  for (const [x, y, z] of cells.values()) if (x === lx && z === lz) crown = Math.max(crown, y);
  for (let y = crown + 1; y < Math.max(crown + 2, Math.round((top + 0.5) / k)); y++) put(lx, y, lz, 0);
  const bark = pick(T.trunk, hash3(seed, 0, 0, 93), [0.3, 0.8]);
  for (const [x, y, z, out] of cells.values()) {
    // Colour comes in patches a few voxels across, never voxel by voxel: single-voxel flecks are what read as noise.
    const h = hash3(x >> 1, y >> 1, z >> 1, 95), open = !cells.has(`${x},${y + 1},${z}`);
    let c: RGB;
    if (out < 0) c = bark;
    // Snow lies where the tier is open to the sky, set back from its rim: on the rim itself it striped every step white.
    else if (open && out > 0.2 && out < 0.8 && h > 0.12) c = lin(h > 0.6 ? T.snow[0] : T.snow[1]);
    else c = lin(out > 0.7 ? (h > 0.5 ? T.pine[0] : T.pine[1]) : T.pine[h > 0.4 ? 1 : 2]); // darker in toward the trunk
    g.set(x, y + y0, z, c);
  }
}

const FAR = 0.4;

/**
 * The forest on the rising land behind the field, the paddock camera's whole background. Its edge wanders, a few young
 * trees stray out in front of it, it has the odd clearing, and the trees are tallest deep in. The near rows are built on
 * a 0.2 m grid; further back, where no camera comes near, at 0.4 m. Every tree here is a `forestPine`.
 * Round the wendigo the trees are placed by hand: it stands up on the step to the back hills with pines either side and
 * close behind, and two tall pines at the foot of the step leave only a narrow gap through to the paddock camera.
 */
function forest(near: Grid, far: Grid, r: () => number) {
  const [wx, wz] = WENDIGO_AT;
  // From the wendigo: toward the paddock camera, and that camera's right.
  const tc = [0.58, 0.82], rt = [0.82, -0.58];
  const at = (side: number, toward: number, h: number): [number, number, number] => [wx + rt[0] * side + tc[0] * toward, wz + rt[1] * side + tc[1] * toward, h];
  const placed: [number, number, number][] = [
    at(3.6, -0.6, 9.5), at(-3.5, 0.1, 7), at(2.8, 0.9, 4.2), at(0.2, -4.3, 9), at(-1.6, -6, 10.5), at(3.4, -4.8, 8), at(-4.4, 1.4, 6),
    // Below it, at the foot of the step: two tall pines either side of the line to the paddock, a young one between them.
    at(-2.7, 3.6, 8.6), at(2.9, 3.9, 7.6), at(0.2, 6.6, 4.4),
  ];
  const edge = (x: number) => -28.9 + Math.sin(x / 5.3) * 1.6 + Math.sin(x / 2.3 + 1.7) * 0.9 + Math.sin(x / 11 + 0.4) * 1.2;
  const clearing = (x: number, z: number) => Math.sin(x / 7.1 + 2) * Math.sin(z / 4.3 + 1) > 0.82;
  const CELL = 3;
  for (let gx = -58; gx < 32; gx += CELL)
    for (let gz = -27; gz > -66; gz -= CELL) {
      const x = gx + r() * CELL, z = gz - r() * CELL;
      const into = edge(x) - z; // metres inside the edge; negative in front of it
      const keep = into > 0 ? (clearing(x, z) ? 0.15 : into > 9 ? 0.6 : 0.9) : into > -4 ? 0.14 * (1 + into / 4) : 0;
      // Nothing between it and the paddock camera.
      const ahead = (x - wx) * tc[0] + (z - wz) * tc[1], aside = Math.abs((x - wx) * rt[0] + (z - wz) * rt[1]);
      if (r() > keep || !isClear(x, z) || Math.hypot(x - wx, z - wz) < 2.6 || (ahead > 0 && ahead < 14 && aside < 1.2)) continue;
      if (steep(x, z) || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.2)) continue;
      const deep = Math.min(1, Math.max(0, into / 14));
      placed.push([x, z, into < 0 ? 2.2 + r() * 2.4 : 4.5 + deep * 4 + r() * 3.5]);
    }
  let seed = 600;
  for (const [x, z, h] of placed) {
    const fine = Math.hypot(x - wx, z - wz) < 9 || (z > -35 && x > -30 && x < 12);
    forestPine(fine ? near : far, x, z, h, seed++, footing(x, z));
  }
}

function woods(): { near: Grid; far: Grid } {
  const g = new Grid(S), far = new Grid(FAR);
  const r = rng(301);
  const placed: [number, number][] = [];
  let seed = 400;
  for (const [cx, cz, radius, count] of WOODS) {
    for (let i = 0, tries = 0; i < count && tries < count * 8; tries++) {
      // Summing two draws bunches the trees toward the middle of the clump and thins them at its edge.
      const a = r() * Math.PI * 2, d = ((r() + r()) / 2) * radius;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!isClear(x, z) || steep(x, z) || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.6)) continue;
      placed.push([x, z]);
      i++;
      // Tall in the heart of a clump, young at the edge.
      const height = 3 + (1 - d / radius) * 4 + r() * 3;
      forestPine(g, x, z, height, seed++, footing(x, z));
    }
  }
  forest(g, far, rng(303));
  return { near: g, far };
}

/** Long low drifts, so the open ground rises and falls instead of lying dead flat. */
function drifts(g: Grid) {
  const r = rng(311);
  for (let i = 0, tries = 0; i < 26 && tries < 500; tries++) {
    const x = -62 + r() * 124, z = -28 + r() * 72;
    if (!isClear(x, z) || landHeight(x, z) > 0.5) continue;
    i++;
    const long = 2.2 + r() * 3.6;
    const wide = r() > 0.5;
    const high = 0.3 + r() * 0.35;
    // Outside the wendigo's zone there are none: a low mound on the 0.2 m grid is a flat plate lying on the snow.
    kept(x, z, () => ellipsoid(g, [x, -0.1, z], [wide ? long : long * 0.55, high, wide ? long * 0.55 : long], (a, b, c) => (b < 0 ? null : snow(a, b, c)), 0.12, i));
  }
}

/** Low evergreen bushes under snow, bare twiggy ones, rocks in twos and threes, and dead grass poking through. */
function scrub(g: Grid) {
  const r = rng(321);
  const spot = (): [number, number] | null => {
    for (let t = 0; t < 40; t++) {
      const x = -60 + r() * 120, z = -28 + r() * 72;
      if (isClear(x, z) && landHeight(x, z) < 0.5) return [x, z];
    }
    return null;
  };
  for (let i = 0; i < 34; i++) {
    const at = spot();
    if (!at) continue;
    const [x, z] = at, w = 0.5 + r() * 0.6, h = 0.35 + r() * 0.35;
    const deep = w * (0.7 + r() * 0.4), old = standsInWendigoZone(x, z);
    stands(x, z, () => ellipsoid(g, [x, h * 0.6, z], [w, h, deep], (a, b, c) => {
      if (b < 0) return null;
      // Snow on its top; in the wendigo's zone, the speckle it always had.
      return (old ? hash3(a, b, c, 323) > 0.55 : true) && b > h * 7 ? pick(T.snow, hash3(a, b, c, 325)) : pick(T.pine, hash3(a, b, c, 327), [0.2, 0.7]);
    }, 0.2, i + 1));
  }
  const twig: Paint = (a, b, c) => pick(T.trunk, hash3(a, b, c, 329));
  for (let i = 0; i < 26; i++) {
    const at = spot();
    if (!at) continue;
    const [x, z] = at;
    for (let k = 0, n = 4 + Math.floor(r() * 3); k < n; k++) {
      const a = r() * Math.PI * 2, lean = 0.25 + r() * 0.45, h = 0.6 + r() * 0.7;
      kept(x, z, () => line(g, [x, 0, z], [x + Math.cos(a) * lean, h, z + Math.sin(a) * lean], twig, true)); // bare twigs: scratches on the snow
    }
  }
  for (let i = 0; i < 12; i++) {
    const at = spot();
    if (!at) continue;
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const x = at[0] + (r() - 0.5) * 2.4, z = at[1] + (r() - 0.5) * 2.4, w = 0.35 + r() * 0.5;
      stands(x, z, () => ellipsoid(g, [x, w * 0.3, z], [w, w * 0.7, w * 0.8], (a, b, c) => {
        if (b < 0) return null;
        return b > w * 7 ? pick(T.snow, hash3(a, b, c, 331)) : pick(T.stone, hash3(a, b, c, 333), [0.3, 0.75]);
      }, 0.25, i + k + 1));
    }
  }
  const grass: Paint = (a, b, c) => pick(T.hay, hash3(a, b, c, 335), [0.1, 0.6]);
  for (let i = 0; i < 90; i++) {
    const at = spot();
    if (!at) continue;
    for (let k = 0, n = 5 + Math.floor(r() * 7); k < n; k++) {
      const x = Math.round((at[0] + (r() - 0.5) * 1.2) / F), z = Math.round((at[1] + (r() - 0.5) * 1.2) / F);
      const h = 2 + Math.floor(r() * 3);
      kept(x * F, z * F, () => { for (let y = 0; y < h; y++) { const c = grass(x, y, z); if (c) g.set(x, y, z, c); } }); // dead grass: specks
    }
  }
}

/** A dry stone wall along a line of points, a few courses of mixed stones with snow on top and the odd gap fallen in. */
function wall(g: Grid, points: [number, number][]) {
  const stone: Paint = (a, b, c) => pick(T.stone, hash3(a >> 1, b >> 1, c >> 1, 341), [0.35, 0.8]);
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < length; d += F) {
      const x = ax + ((bx - ax) * d) / length, z = az + ((bz - az) * d) / length;
      const crumble = hash3(Math.floor(x / 1.5), 0, Math.floor(z / 1.5), 343);
      if (crumble > 0.9) continue;
      const height = crumble > 0.72 ? 0.3 : 0.6 + hash3(Math.floor(x / 0.6), 1, Math.floor(z / 0.6), 345) * 0.2;
      box(g, [x - 0.2, 0, z - 0.2], [x + 0.2, height, z + 0.2], stone);
      box(g, [x - 0.2, height, z - 0.2], [x + 0.2, height + F, z + 0.2], (a, b, c) => snowAt(a, b, c, F, 201)); // the wall is on the fine grid; an even cap of snow
    }
  }
}

/** A scarecrow still standing in the stubble, in a coat and a hat for the season. */
function scarecrow(g: Grid, x: number, z: number) {
  const pole: Paint = (a, b, c) => pick(T.trunk, hash3(a, b, c, 351));
  box(g, [x - 0.1, 0, z - 0.1], [x + 0.1, 2.1, z + 0.1], pole);
  box(g, [x - 0.8, 1.5, z - 0.1], [x + 0.8, 1.6, z + 0.1], pole);
  box(g, [x - 0.3, 0.9, z - 0.2], [x + 0.3, 1.7, z + 0.2], (a, b, c) => pick(T.collar, hash3(a, b, c, 353)));
  box(g, [x - 0.2, 1.8, z - 0.2], [x + 0.2, 2.2, z + 0.2], (a, b, c) => pick(T.linen, hash3(a, b, c, 355)));
  box(g, [x - 0.3, 2.2, z - 0.3], [x + 0.3, 2.3, z + 0.3], () => lin(T.snow[1]));
  box(g, [x - 0.2, 2.3, z - 0.2], [x + 0.2, 2.6, z + 0.2], () => lin(T.collar[0]));
  box(g, [x - 0.1, 2.6, z - 0.1], [x + 0.1, 2.8, z + 0.1], () => lin(T.snow[0]));
}

const WALL: [number, number][] = [[-62, 21], [-48, 15], [-39, 13], [-29, 13.4], [-21, 12.6], [-20.4, 0], [-21, -15], [-30, -16]];
const SCARECROW: [number, number] = [8.6, -21.4];

/** Low leaves out scrub and drifts wholly more than this far from the wendigo (plan file 17, change 15, "World detail"). */
export const LOW_DROP_M = 30;

/**
 * The scrub and drift pieces Low leaves out: each one wholly more than LOW_DROP_M from WENDIGO_AT along the ground
 * that the paddock shot can neither see nor see the shadow of (`seen`, asked of the piece's bounding ball) and that
 * holds none of the stone wall or the scarecrow. The voxels are built as always; the pieces are only not mounted, so
 * nothing the wendigo's shot sees changes and the scene checker's countryside stays as pinned.
 */
export function lowDrops(c: CountryPart, seen: (center: [number, number, number], radius: number) => boolean): Set<BufferGeometry> {
  const out = new Set<BufferGeometry>();
  const consider = (g: BufferGeometry | undefined, fixed = false) => {
    if (!g || fixed) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const { center, radius } = g.boundingSphere!;
    if (Math.hypot(center.x - WENDIGO_AT[0], center.z - WENDIGO_AT[1]) - radius <= LOW_DROP_M) return;
    if (seen([center.x, center.y, center.z], radius)) return;
    out.add(g);
  };
  c.scrub.forEach((g, i) => consider(g, c.scrubFixed?.[i] ?? true));
  for (const g of c.drifts) consider(g);
  return out;
}
/** The wendigo's stand is the trees within 12 m of it; a chunk within a metre more of that is left exactly as built. */
const STAND = 13;
function inStand(chunk: Iterable<[string, { x: number; z: number }]>, size: number): boolean {
  for (const [, v] of chunk) if (Math.hypot((v.x + 0.5) * size - WENDIGO_AT[0], (v.z + 0.5) * size - WENDIGO_AT[1]) < STAND) return true;
  return false;
}

export interface Countryside { woods: BufferGeometry[]; forest: BufferGeometry[]; scrub: BufferGeometry[]; drifts: BufferGeometry[]; triangles: number;
  /** Which scrub pieces hold any of the stone wall or the scarecrow (Low keeps those: see `lowDrops`). */
  scrubFixed: boolean[] }
/** The countryside part built: the same lists, with a hole where a piece is still to come. */
export interface CountryPart { woods: (BufferGeometry | undefined)[]; forest: (BufferGeometry | undefined)[]; scrub: (BufferGeometry | undefined)[]; drifts: (BufferGeometry | undefined)[]; scrubFixed?: boolean[] }
type Box = [number, number, number];

let built: Countryside | null = null;
export function buildCountryside(): Countryside {
  if (built) return built;
  return (built = finish(buildCountrysideSteps()));
}

const LISTS = ['woods', 'forest', 'scrub', 'drifts'] as const;
/** The box a chunk's voxels fill, in metres. */
function boxOf(chunk: Iterable<{ x: number; y: number; z: number }>, size: number, lift: number): [Box, Box] {
  const min: Box = [Infinity, Infinity, Infinity], max: Box = [-Infinity, -Infinity, -Infinity];
  for (const v of chunk) {
    min[0] = Math.min(min[0], v.x * size); max[0] = Math.max(max[0], (v.x + 1) * size);
    min[1] = Math.min(min[1], v.y * size + lift); max[1] = Math.max(max[1], (v.y + 1) * size + lift);
    min[2] = Math.min(min[2], v.z * size); max[2] = Math.max(max[2], (v.z + 1) * size);
  }
  return [min, max];
}

/**
 * The countryside in steps (scene/slices.ts). Given `wanted` (whether the screen's opening shot needs what fills a box,
 * in metres, or its shadow), the pieces it wants are meshed first and yielded as a `CountryPart`, then the rest. Every
 * piece is built exactly as it would be in one go; only the order of the work changes.
 */
export function* buildCountrysideSteps(wanted?: (min: Box, max: Box) => boolean): Steps<Countryside, CountryPart> {
  if (built) return built;
  const wood = woods();
  yield;
  // The far forest and the drifts cast no shadow and only the start screen draws them: faces none of its
  // cameras can be in front of are left out (voxel/unseen.ts). A chunk with any tree of the wendigo's stand in it is
  // built as it always was. (Their faces are not merged: trees and drifts have next to no flat runs of one tone.)
  const home = unseenFrom([{ screens: 'home' }]);
  const mounds = new Grid(S);
  drifts(mounds);
  yield;
  const small = new Grid(F);
  scrub(small);
  wall(small, WALL);
  stands(SCARECROW[0], SCARECROW[1], () => scarecrow(small, ...SCARECROW));
  yield;
  // No tracks worn in the snow any more: speckled strips and ruts in the ground read as a fault (Brian, 2026-11-19).
  // Read, never changed: what stands in front of the line shades the ground at its foot (voxel/groundShade.ts keeps to its own area).
  noteShade(wood.near.map.values(), S);
  noteShade(small.map.values(), F);
  const lists: Record<(typeof LISTS)[number], { maps: ChunkMap[]; size: number; options?: (chunk: ChunkMap) => BuildOptions | undefined }> = {
    woods: { maps: chunkMaps(wood.near.map, S), size: S },
    forest: { maps: chunkMaps(wood.far.map, FAR), size: FAR, options: (chunk) => (inStand(chunk, FAR) ? undefined : { unseen: home }) },
    scrub: { maps: chunkMaps(small.map, F), size: F },
    drifts: { maps: chunkMaps(mounds.map, S), size: S, options: () => ({ unseen: home }) },
  };
  // The wall and the scarecrow share the scrub's grid; their cells, on a grid of their own, mark the pieces Low keeps.
  const fixedGrid = new Grid(F);
  wall(fixedGrid, WALL);
  scarecrow(fixedGrid, ...SCARECROW);
  const scrubFixed = lists.scrub.maps.map((chunk) => { for (const key of chunk.keys()) if (fixedGrid.map.has(key)) return true; return false; });
  const out: CountryPart = { woods: [], forest: [], scrub: [], drifts: [], scrubFixed };
  for (const k of LISTS) out[k] = lists[k].maps.map(() => undefined);
  const make = (k: (typeof LISTS)[number], i: number) => {
    const { maps, size, options } = lists[k];
    const g = buildGeometry(maps[i], size, options?.(maps[i]));
    packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
    out[k][i] = g;
  };
  if (wanted) {
    for (const k of LISTS) for (let i = 0; i < lists[k].maps.length; i++) if (wanted(...boxOf(lists[k].maps[i].values(), lists[k].size, 0))) { make(k, i); yield; }
    yield { woods: [...out.woods], forest: [...out.forest], scrub: [...out.scrub], drifts: [...out.drifts], scrubFixed };
  }
  for (const k of LISTS) for (let i = 0; i < lists[k].maps.length; i++) if (!out[k][i]) { make(k, i); yield; }
  const parts = { woods: out.woods as BufferGeometry[], forest: out.forest as BufferGeometry[], scrub: out.scrub as BufferGeometry[], drifts: out.drifts as BufferGeometry[] };
  return (built = { ...parts, scrubFixed, triangles: [...parts.woods, ...parts.forest, ...parts.scrub, ...parts.drifts].reduce((n, g) => n + triangles(g), 0) });
}
