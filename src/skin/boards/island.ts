import type { BufferGeometry } from 'three';
import { tieredPine, pinePaint } from '../scene/style/pine';
import { buildGeometry } from '../voxel/mesher';
import { solid } from '../voxel/paint';
import type { Mat } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

/**
 * The leaderboards' ground (docs/leaderboards/LEADERBOARDS-PLAN.md, section 8.1, Brian, 2026-11-21: no blocky voxel
 * clouds). One connected diorama piece under the three crates: a stepped snow top in two tones (a repeating pattern,
 * nothing random), two soil layers, a stepped underside narrowing to a point; on it two tiered pines at the back corners,
 * a lantern post at the front right, a short fence behind the crates on the left, two snow-capped hay bales at the back
 * right, and a low snow mound against the foot of each crate. Two small pale islands far behind it. Pure: no three.js
 * scene, so the tests can count its pieces.
 */

/** The grid: 0.1 m, the podium's own (one "small voxel"). */
export const CELL = 0.1;
/** A crate, as the podium builds it (Podium.tsx: STEP), and the three heights as the stage has them. */
export const CRATE = { w: 1.4, d: 1.2 } as const;
export const CRATE_HEIGHTS = [2.9, 2.1, 1.8] as const;

export interface StageLayout {
  /** Each crate's middle on x: second (left), first (middle), third (right). */
  x: [number, number, number];
  /** Half the island's width and depth, in metres. */
  halfW: number;
  halfD: number;
}

/**
 * Where the crates stand: the same width, depth and distance from the camera, 2nd left, 1st in the middle, 3rd right,
 * a quarter of a crate apart (desktop) or 0.15 of one (phone). The island is 1.6 times the three crates' width and 2.5
 * times a crate's depth.
 */
export function stageLayout(phone: boolean): StageLayout {
  const gap = (phone ? 0.15 : 0.25) * CRATE.w, step = CRATE.w + gap;
  const span = 3 * CRATE.w + 2 * gap;
  return { x: [-step, 0, step], halfW: (span * 1.6) / 2, halfD: (CRATE.d * 2.5) / 2 };
}

type Put = (x: number, y: number, z: number, c: RGB) => void;
const c = (m: Mat, step = 0) => solid(m, step);

/** Inside the island's outline at cell (x, z): a rounded rectangle (|x/a|^4 + |z/b|^4 <= 1), stepped by the grid. */
const inside = (x: number, z: number, a: number, b: number, p = 4) => Math.abs((x + 0.5) / a) ** p + Math.abs((z + 0.5) / b) ** p <= 1;

export interface IslandGeo { body: BufferGeometry; glow: BufferGeometry; lamp: [number, number, number] }
export interface IslandVoxels { body: Grid; glow: Grid; lamp: [number, number, number] }

/** The main island as meshes: everything on it in one, the lantern's glass in a second, lit one. */
export function islandGeometry(layout: StageLayout): IslandGeo {
  const v = islandVoxels(layout);
  return { body: buildGeometry(v.body.map, CELL), glow: buildGeometry(v.glow.map, CELL), lamp: v.lamp };
}

/**
 * The main island with everything that stands on it, as voxels. Its top is at y = 0, where the crates stand; x and z are
 * centred on the middle crate.
 */
export function islandVoxels(layout: StageLayout): IslandVoxels {
  const g = new Grid(CELL), glow = new Grid(CELL);
  const put: Put = (x, y, z, col) => g.set(x, y, z, col);
  const a = Math.round(layout.halfW / CELL), b = Math.round(layout.halfD / CELL);
  const crateCells = layout.x.map((cx) => ({ x0: Math.round((cx - CRATE.w / 2) / CELL), x1: Math.round((cx + CRATE.w / 2) / CELL) - 1 }));
  /**
   * How far a cell is from a crate's footprint: 0 for a cell wholly under one, 1 for a cell touching or overlapping its
   * edge, then a cell more for each 0.1 m out. In metres, because the outer crates' edges fall between cells.
   */
  const fromCrate = (x: number, z: number) => Math.min(...layout.x.map((cx) => {
    const x0 = cx - CRATE.w / 2, x1 = cx + CRATE.w / 2, z0 = -CRATE.d / 2, z1 = CRATE.d / 2, e = 1e-6;
    const lx = x * CELL, hx = lx + CELL, lz = z * CELL, hz = lz + CELL;
    if (lx >= x0 - e && hx <= x1 + e && lz >= z0 - e && hz <= z1 + e) return 0;
    const dx = Math.max(x0 - hx, lx - x1, 0), dz = Math.max(z0 - hz, lz - z1, 0);
    return 1 + Math.floor((dx + dz) / CELL + e);
  }));
  const snowLow = c('snow', -1), snowHigh = c('snow', 1), snowSide = c('snow', -2);

  // Props first, so the snow's pattern can leave their feet flat.
  const props = new Grid(CELL);
  const pp: Put = (x, y, z, col) => props.set(x, y, z, col);
  const feet = new Set<string>();
  const foot = (x: number, z: number) => feet.add(`${x},${z}`);

  // Two tiered pines at the back corners: about 1.8 m on the left, 1.4 m on the right.
  const pine = (cx: number, cz: number, h: number, k: number) => {
    tieredPine(pp, (x, y, z) => props.has(x, y, z), cx, cz, 0, h, CELL, 5, pinePaint(k));
    for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) foot(cx + dx, cz + dz);
  };
  // (The left one stands a little forward, so the fence behind the crates shows beside it.)
  pine(-a + 5, -6, 1.8, 1);
  pine(a - 9, -b + 6, 1.4, 2);

  // A short fence behind the crates on the left: three posts and two rails, about 1.6 m long, snow on every top.
  const wood = c('wood', 0), woodDark = c('wood', -1), cap = c('snow', 0);
  const fz = -b + 4, fx0 = crateCells[0].x0 - 6; // three posts 0.8 m apart, the first 0.6 m left of the left crate
  for (let k = 0; k < 3; k++) {
    const x = fx0 + k * 8;
    for (let y = 0; y < 8; y++) { pp(x, y, fz, woodDark); pp(x + 1, y, fz, woodDark); }
    pp(x, 8, fz, cap); pp(x + 1, 8, fz, cap);
    foot(x, fz); foot(x + 1, fz);
  }
  for (const y of [3, 6]) for (let x = fx0 + 2; x < fx0 + 16; x++) { pp(x, y, fz, wood); if (y === 6) pp(x, y + 1, fz, cap); }

  // Two hay bales at the back right, one stacked half on the other, each with a cap of snow.
  const hay = c('hay', 0), strap = c('hay', -2);
  const bale = (x0: number, y0: number, z0: number) => {
    for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) pp(x0 + x, y0 + y, z0 + z, x === 1 || x === 4 ? strap : hay);
    for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) pp(x0 + x, y0 + 4, z0 + z, cap);
    if (y0 === 0) for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) foot(x0 + x, z0 + z);
  };
  const bx = crateCells[2].x1 + 4, bz = -4;
  bale(bx, 0, bz);
  bale(bx + 3, 4, bz);
  // The stacked bale's snow cap would sit under the upper one where they overlap: take it out there.
  for (let x = 3; x < 6; x++) for (let z = 0; z < 4; z++) props.del(bx + x, 4, bz + z), pp(bx + x, 4, bz + z, hay);

  // The lantern post at the front right corner: a post, an iron lantern on it with its glass lit, a snow cap.
  const iron = c('iron', 0), ironHi = c('iron', 1), lx = a - 9, lz = b - 6;
  for (let y = 0; y < 11; y++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) pp(lx + dx, y, lz + dz, woodDark);
  for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) foot(lx + dx, lz + dz);
  for (let dx = -1; dx < 3; dx++) for (let dz = -1; dz < 3; dz++) {
    pp(lx + dx, 11, lz + dz, iron); // the lantern's floor
    const edge = dx === -1 || dx === 2 || dz === -1 || dz === 2, corner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
    for (let y = 12; y < 15; y++) {
      if (corner) pp(lx + dx, y, lz + dz, iron);
      else if (edge) glow.set(lx + dx, y, lz + dz, c('brass', 2));
      else glow.set(lx + dx, y, lz + dz, c('brass', 1));
    }
    pp(lx + dx, 15, lz + dz, ironHi); // its roof
  }
  for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) { pp(lx + dx, 16, lz + dz, iron); pp(lx + dx, 17, lz + dz, cap); }

  // The top: snow in two tones. A rim two cells wide one step lower, and over the rest low ridges one cell high in a
  // repeating pattern (a ridge three cells wide every eight, stepped one cell along every two rows), never under a crate
  // or a prop, and never in the crates' snow mounds.
  for (let x = -a; x < a; x++) for (let z = -b; z < b; z++) {
    if (!inside(x, z, a, b)) continue;
    const rim = !inside(x, z, a - 2, b - 2);
    const top = rim ? -2 : -1;
    for (let y = -3; y <= top; y++) put(x, y, z, y === top ? (rim ? snowSide : snowLow) : snowSide);
    if (rim) continue;
    const d = fromCrate(x, z);
    // The mound at a crate's foot: three cells high against it, then two, then one.
    if (d >= 1 && d <= 3) { for (let y = 0; y < 4 - d; y++) put(x, y, z, snowHigh); continue; }
    if (d === 0 || feet.has(`${x},${z}`)) continue;
    const ridge = ((x + Math.floor((z + 64) / 2)) % 8 + 8) % 8 < 3;
    if (ridge) put(x, 0, z, snowHigh);
  }
  // Two soil layers.
  for (let x = -a; x < a; x++) for (let z = -b; z < b; z++) if (inside(x, z, a, b)) { put(x, -4, z, c('darkWood', 0)); put(x, -5, z, c('roofBrown', -1)); }
  // The underside: tiers two cells tall, each a step narrower, rock in alternate steps, down to a point.
  const tiers = 9;
  for (let k = 0; k < tiers; k++) {
    const s = (1 - (k + 1) / (tiers + 1)) ** 1.15, ak = Math.max(1, Math.round(a * s)), bk = Math.max(1, Math.round(b * s));
    const tone = c('stone', k % 2 ? -1 : 0);
    for (let x = -ak; x < ak; x++) for (let z = -bk; z < bk; z++) if (inside(x, z, ak, bk, 2.6)) for (let y = 0; y < 2; y++) put(x, -6 - k * 2 - y, z, tone);
  }
  for (const v of props.map.values()) put(v.x, v.y, v.z, v.c);
  return { body: g, glow, lamp: [(lx + 1) * CELL, 13.5 * CELL, (lz + 1) * CELL] };
}

/**
 * A far island: a snow top, a stepped underside and one small pine, in two flat pale tones (`top` for the snow and the
 * pine, `under` for the rock), for a material that takes no light. `k` is its size against the main island's.
 */
export function farIsland(layout: StageLayout, k: number, top: RGB, under: RGB): BufferGeometry {
  const g = new Grid(CELL);
  const a = Math.max(4, Math.round((layout.halfW * k) / CELL)), b = Math.max(3, Math.round((layout.halfD * k) / CELL));
  for (let x = -a; x < a; x++) for (let z = -b; z < b; z++) if (inside(x, z, a, b)) for (let y = -2; y < 0; y++) g.set(x, y, z, top);
  const tiers = 6;
  for (let t = 0; t < tiers; t++) {
    const s = (1 - (t + 1) / (tiers + 1)) ** 0.85, at = Math.max(1, Math.round(a * s)), bt = Math.max(1, Math.round(b * s));
    for (let x = -at; x < at; x++) for (let z = -bt; z < bt; z++) if (inside(x, z, at, bt, 2.6)) for (let y = 0; y < 2; y++) g.set(x, -3 - t * 2 - y, z, under);
  }
  const flat = { trunk: top, needles: () => top, under: () => top, snow: top };
  tieredPine((x, y, z, col) => g.set(x, y, z, col), (x, y, z) => g.has(x, y, z), Math.round(-a * 0.3), 0, 0, 1.6 * k / 0.35, CELL, 4, flat);
  return buildGeometry(g.map, CELL, { ao: false });
}
