import type { BufferGeometry } from 'three';
import { buildGeometry, triangles } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { snowAt, snowPaint } from '../voxel/snow';
import { box, ellipsoid, Grid, hash3, line, rng } from '../voxel/primitives';
import type { Paint, RGB } from '../voxel/primitives';
import { backHillHeight } from './distance';
import { chunks, FARM, landHeight } from './farmstead';
import { POV_SHOTS } from './homePov';
import { BARN, YARD } from './layout';

/**
 * The land around the farm, seen only from the start screen, so it reads as a place rather than a flat white board:
 * woods standing in uneven clumps, drifts that give the snow some shape, shrubs, rocks and dead grass, a dry stone wall
 * round the orchard, and tracks worn between the things people walk to. All of it is placed by `isClear`, which keeps it
 * off the farm and out of the way of every camera on the tour.
 */

const S = 0.2;
const F = 0.1;
const snow: Paint = snowPaint(S, 201);

const RECTS: [number, number, number, number][] = [
  [BARN.minX - 2, BARN.maxX + 2, BARN.minZ - 2, BARN.maxZ + 3],
  [FARM.paddock.minX - 1, FARM.paddock.maxX + 1, FARM.paddock.minZ - 1, FARM.paddock.maxZ + 1],
  [FARM.run.minX - 1, FARM.run.maxX + 1, FARM.run.minZ - 1, FARM.run.maxZ + 1],
  [FARM.field.minX - 1, FARM.field.maxX + 1, FARM.field.minZ - 1, FARM.field.maxZ + 2],
  [FARM.orchard.minX - 3, -21, FARM.orchard.minZ - 3, 12],
  [FARM.tractor.x - 3, FARM.tractor.x + 5, FARM.tractor.z - 3, FARM.tractor.z + 4],
  [YARD.farmhouse.x - 6, YARD.farmhouse.x + 7, YARD.farmhouse.z - 6, YARD.farmhouse.z + 5],
  [YARD.pond.x - YARD.pond.rx - 3, YARD.pond.x + YARD.pond.rx + 3, YARD.pond.z - YARD.pond.rz - 3, YARD.pond.z + YARD.pond.rz + 3],
  [-3, 3, BARN.maxZ, 26], // the path
  [YARD.fence.minX - 1, YARD.fence.maxX + 1, YARD.fence.z - 1, YARD.fence.z + 1],
];

/** How far a point is from the first stretch of a camera's line of sight. */
function fromSightLine(x: number, z: number, from: readonly number[], to: readonly number[]): number {
  const dx = to[0] - from[0], dz = to[2] - from[2], length = Math.hypot(dx, dz) || 1;
  const t = Math.min(12, Math.max(0, ((x - from[0]) * dx + (z - from[2]) * dz) / length));
  return Math.hypot(x - (from[0] + (dx / length) * t), z - (from[2] + (dz / length) * t));
}

/** Somewhere open: off the farm, off the yard's pines, and not in front of any camera on the tour. */
export function isClear(x: number, z: number): boolean {
  if (RECTS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return false;
  if (YARD.pines.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3)) return false;
  return [...POV_SHOTS.desktop, ...POV_SHOTS.phone].every((s) => fromSightLine(x, z, s.position, s.target) > 3);
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
  // A leader above the top tier.
  for (let y = Math.round(top / k); y < Math.round((top + 0.5) / k); y++) put(Math.floor(cx), y, Math.floor(cz), 0);
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
    ellipsoid(g, [x, -0.1, z], [wide ? long : long * 0.55, 0.3 + r() * 0.35, wide ? long * 0.55 : long], (a, b, c) => (b < 0 ? null : snow(a, b, c)), 0.12, i);
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
    ellipsoid(g, [x, h * 0.6, z], [w, h, w * (0.7 + r() * 0.4)], (a, b, c) => {
      if (b < 0) return null;
      return hash3(a, b, c, 323) > 0.55 && b > h * 7 ? pick(T.snow, hash3(a, b, c, 325)) : pick(T.pine, hash3(a, b, c, 327), [0.2, 0.7]);
    }, 0.2, i + 1);
  }
  const twig: Paint = (a, b, c) => pick(T.trunk, hash3(a, b, c, 329));
  for (let i = 0; i < 26; i++) {
    const at = spot();
    if (!at) continue;
    const [x, z] = at;
    for (let k = 0, n = 4 + Math.floor(r() * 3); k < n; k++) {
      const a = r() * Math.PI * 2, lean = 0.25 + r() * 0.45, h = 0.6 + r() * 0.7;
      line(g, [x, 0, z], [x + Math.cos(a) * lean, h, z + Math.sin(a) * lean], twig);
    }
  }
  for (let i = 0; i < 12; i++) {
    const at = spot();
    if (!at) continue;
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const x = at[0] + (r() - 0.5) * 2.4, z = at[1] + (r() - 0.5) * 2.4, w = 0.35 + r() * 0.5;
      ellipsoid(g, [x, w * 0.3, z], [w, w * 0.7, w * 0.8], (a, b, c) => {
        if (b < 0) return null;
        return b > w * 7 ? pick(T.snow, hash3(a, b, c, 331)) : pick(T.stone, hash3(a, b, c, 333), [0.3, 0.75]);
      }, 0.25, i + k + 1);
    }
  }
  const grass: Paint = (a, b, c) => pick(T.hay, hash3(a, b, c, 335), [0.1, 0.6]);
  for (let i = 0; i < 90; i++) {
    const at = spot();
    if (!at) continue;
    for (let k = 0, n = 5 + Math.floor(r() * 7); k < n; k++) {
      const x = Math.round((at[0] + (r() - 0.5) * 1.2) / F), z = Math.round((at[1] + (r() - 0.5) * 1.2) / F);
      for (let y = 0, h = 2 + Math.floor(r() * 3); y < h; y++) { const c = grass(x, y, z); if (c) g.set(x, y, z, c); }
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
      box(g, [x - 0.2, height, z - 0.2], [x + 0.2, height + F, z + 0.2], (a, b, c) => (hash3(a, 0, c, 347) > 0.2 ? snowAt(a, b, c, F, 201) : null)); // the wall is on the fine grid
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

/** Tracks worn in the snow: two ruts and a trodden strip, wandering a little from point to point. */
function tracks(g: Grid, points: [number, number][]) {
  const worn = (a: number, c: number) => lin(hash3(a >> 1, 0, c >> 1, 361) > 0.5 ? T.path[1] : T.path[0]);
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const length = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / length, nz = (bx - ax) / length;
    for (let d = 0; d <= length; d += S / 2) {
      const wander = Math.sin((d + i * 7) / 3.1) * 0.35;
      for (let w = -0.7; w <= 0.7; w += S / 2) {
        const x = ax + ((bx - ax) * d) / length + nx * (w + wander), z = az + ((bz - az) * d) / length + nz * (w + wander);
        const a = Math.round(x / S), c = Math.round(z / S);
        if (Math.abs(Math.abs(w) - 0.45) < 0.11) g.set(a, 0, c, lin(T.path[2]));
        else if (!g.has(a, 0, c) && hash3(a, 1, c, 363) > 0.25) g.set(a, 0, c, worn(a, c));
      }
    }
  }
}

export interface Countryside { woods: BufferGeometry[]; forest: BufferGeometry[]; scrub: BufferGeometry[]; drifts: BufferGeometry[]; tracks: BufferGeometry; triangles: number }

let built: Countryside | null = null;
export function buildCountryside(): Countryside {
  if (built) return built;
  const wood = woods();
  const trees = chunks(wood.near.map, S), far = chunks(wood.far.map, FAR);
  const mounds = new Grid(S);
  drifts(mounds);
  const small = new Grid(F);
  scrub(small);
  wall(small, [[-62, 21], [-48, 15], [-39, 13], [-29, 13.4], [-21, 12.6], [-20.4, 0], [-21, -15], [-30, -16]]);
  scarecrow(small, 8.6, -21.4);
  const worn = new Grid(S);
  tracks(worn, [[-1.4, 12.6], [-6, 11.6], [-12, 10.4], [-12.2, 8.6]]);
  tracks(worn, [[-12, 10.4], [-20, 11], [-29, 11.8]]);
  tracks(worn, [[1.6, 12.4], [6, 12], [11, 11.2], [16.8, 8.2]]);
  const flat = buildGeometry(worn.map, S);
  flat.translate(0, -0.16, 0); // all but flush with the snow: a mark in it, not a slab on it
  const parts = { woods: trees, forest: far, scrub: chunks(small.map, F), drifts: chunks(mounds.map, S), tracks: flat };
  return (built = { ...parts, triangles: [...parts.woods, ...parts.forest, ...parts.scrub, ...parts.drifts, flat].reduce((n, g) => n + triangles(g), 0) });
}
