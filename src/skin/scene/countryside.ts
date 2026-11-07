import type { BufferGeometry } from 'three';
import { buildGeometry, triangles } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, line, rng } from '../voxel/primitives';
import type { Paint } from '../voxel/primitives';
import { chunks, FARM, landHeight } from './farmstead';
import { POV_SHOTS } from './homePov';
import { BARN, YARD } from './layout';
import { pine } from './yard';

/**
 * The land around the farm, seen only from the start screen, so it reads as a place rather than a flat white board:
 * woods standing in uneven clumps, drifts that give the snow some shape, shrubs, rocks and dead grass, a dry stone wall
 * round the orchard, and tracks worn between the things people walk to. All of it is placed by `isClear`, which keeps it
 * off the farm and out of the way of every camera on the tour.
 */

const S = 0.2;
const F = 0.1;
const snow: Paint = (x, y, z) => pick(T.snow, hash3(x >> 2, y, z >> 2, 201), [0.55, 1.01]);

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

/** Clumps of woodland: [x, z, radius, trees]. Uneven on purpose, with gaps between them to see through. */
const WOODS: [number, number, number, number][] = [
  [-31, -33, 10, 7], [-11, -31, 6, 3], [6, -37, 11, 8], [25, -33, 7, 4], [47, -29, 12, 7],
  [-54, -14, 11, 7], [-60, 13, 13, 8], [-44, 33, 8, 4], [37, -13, 7, 4], [42, 11, 10, 6], [33, 33, 7, 3],
];

function woods(): Grid {
  const g = new Grid(S);
  const r = rng(301);
  const placed: [number, number][] = [];
  let seed = 400;
  for (const [cx, cz, radius, count] of WOODS) {
    for (let i = 0, tries = 0; i < count && tries < count * 8; tries++) {
      // Summing two draws bunches the trees toward the middle of the clump and thins them at its edge.
      const a = r() * Math.PI * 2, d = ((r() + r()) / 2) * radius;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!isClear(x, z) || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.6)) continue;
      placed.push([x, z]);
      i++;
      // Tall in the heart of a clump, young at the edge.
      const height = 3 + (1 - d / radius) * 4 + r() * 3;
      const base = Math.round(landHeight(x, z) / S);
      pine(g, (px, py, pz, p) => { const c = p(px, py, pz); if (c) g.set(px, py + base, pz, c); }, x, z, seed++, height);
    }
  }
  return g;
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
      box(g, [x - 0.2, height, z - 0.2], [x + 0.2, height + F, z + 0.2], (a, b, c) => (hash3(a, 0, c, 347) > 0.2 ? snow(a, b, c) : null));
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

export interface Countryside { woods: BufferGeometry[]; scrub: BufferGeometry[]; drifts: BufferGeometry[]; tracks: BufferGeometry; triangles: number }

let built: Countryside | null = null;
export function buildCountryside(): Countryside {
  if (built) return built;
  const trees = chunks(woods().map, S);
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
  const parts = { woods: trees, scrub: chunks(small.map, F), drifts: chunks(mounds.map, S), tracks: flat };
  return (built = { ...parts, triangles: [...parts.woods, ...parts.scrub, ...parts.drifts, flat].reduce((n, g) => n + triangles(g), 0) });
}
