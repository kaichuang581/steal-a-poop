import type { BufferGeometry } from 'three';
import { tieredPine, pinePaint } from '../scene/style/pine';
import { buildGeometry } from '../voxel/mesher';
import { shade, solid } from '../voxel/paint';
import type { Mat } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';

/**
 * The leaderboards' ground (docs/leaderboards/LEADERBOARDS-PLAN-V3.md, section 4, Brian, 2026-11-22; version 2's 8.1
 * replaced). One connected diorama piece under the three crates, on the 0.1 m grid (M cells) with nothing on the snow
 * smaller than a cell: a level top with one step down in front of the crates, drifts against the crates, the fence, the
 * pines and the bales, three wind ripples, three trails of footprints; a rim of snow 0.2 m thick overhanging its soil by
 * a cell with icicles under it, two soil layers with stones in the lower one and roots under the pines; an underside of
 * stone bands to a tip under the champion and a smaller lobe under third; two floating rocks; the props of section 4.4;
 * and three small pale islands far off. Pure: no three.js scene, so the tests can count its pieces.
 */

/** The grid: 0.1 m (M cells), the podium's own. */
export const CELL = 0.1;
/** The fine grid for the lantern (S cells) and the icicles. */
export const FINE = 0.05;
/** A crate, as the podium builds it (Podium.tsx: STEP), and the three heights as the stage has them. */
export const CRATE = { w: 1.4, d: 1.2 } as const;
export const CRATE_HEIGHTS = [2.9, 2.1, 1.8] as const;
/** The crates' front faces, and how far the island reaches in front of them and behind their centres. */
const FRONT = CRATE.d / 2;
export const RIM_Z = FRONT + 1.8;
const BACK_Z = -1.5;
/** The one step in the top: a cell down, 0.5 m in front of the crates' faces. */
export const STEP_Z = FRONT + 0.5;
/** How deep each layer is under the top's edge: snow (0.2 at the front edge), soil 0.2, the lower soil 0.3. */
const SNOW_ROWS = [-2, -3], SOIL_ROWS = [-4, -5], LOW_SOIL_ROWS = [-6, -7, -8];
/** The underside: bands 0.2 m thick, each narrower per side than the one above by these, in turn, down to a tip. */
const NARROW = [0.5, 0.3, 0.4, 0.3, 0.5];
const UNDER_DEPTH = 2.2;

export interface StageLayout {
  /** Each crate's middle on x: second (left), first (middle), third (right). */
  x: [number, number, number];
  /** Half the island's width and depth, and the middle of its depth, in metres. */
  halfW: number;
  halfD: number;
  midZ: number;
}

/**
 * Where the crates stand: the same width, depth and distance from the camera, 2nd left, 1st in the middle, 3rd right,
 * a quarter of a crate apart (desktop) or 0.15 of one (phone). The island is 1.6 times the three crates' width; its
 * depth reaches 1.8 m in front of the crates (room for the ripples, kept 0.3 m from the rim and the crates).
 */
export function stageLayout(phone: boolean): StageLayout {
  const gap = (phone ? 0.15 : 0.25) * CRATE.w, step = CRATE.w + gap;
  const span = 3 * CRATE.w + 2 * gap;
  return { x: [-step, 0, step], halfW: (span * 1.6) / 2, halfD: (RIM_Z - BACK_Z) / 2, midZ: (RIM_Z + BACK_Z) / 2 };
}

/** The props' places (4.4), in crate widths from the champion's crate: X across, Z from the crates' fronts. */
export const PROPS = {
  tallPine: { X: -2.15, Z: -1.0, h: 1.8 },
  smallPine: { X: 2.2, Z: -1.0, h: 1.4 },
  fence: { front: [-2.4, 0.55], back: [-2.0, -0.2], h: 0.6 },
  bales: { X: 2.0, Z: -0.2 },
  lantern: { X: 2.4, Z: 0.6, h: 1.0 },
} as const;
/** A prop's place in metres (crate-local x and z). */
export const placeOf = (X: number, Z: number): [number, number] => [X * CRATE.w, FRONT + Z * CRATE.w];

const c = (m: Mat, step = 0) => solid(m, step);
/** The diorama's soil tokens (scene/style/palette.ts: soil, soil-1), and soil-1's foot two steps under it: the plan's
 * 0.3 m of soil-1 in one colour is 28 px tall at 1440 x 900, past 4.2.6's 24, so its lowest 0.1 m is a planned value
 * step (two steps, because one rendered within 6 levels of soil-1 and read as the same colour). */
const SOIL = shade('#6B4A2E'), SOIL_LOW = shade('#53392A'), SOIL_FOOT = shade('#53392A', -2);
const cellAt = (m: number) => Math.floor(m / CELL + 1e-9);
/** Inside a rounded rectangle (|dx/a|^p + |dz/b|^p <= 1) at a cell's middle. */
const inRound = (x: number, z: number, cx: number, cz: number, a: number, b: number, p = 4) =>
  a > 0 && b > 0 && Math.abs(((x + 0.5) * CELL - cx) / a) ** p + Math.abs(((z + 0.5) * CELL - cz) / b) ** p <= 1;

export interface IslandVoxels {
  /** The island and everything fixed on it, on M cells. */
  body: Grid;
  /** The lantern's head (S cells) and its lit glass, standing on the post's top. */
  lantern: Grid;
  glass: Grid;
  /** Where the lantern's light hangs, inside its glass (metres). */
  lamp: [number, number, number];
  /** The two pines, each on its own grid in its own frame (its trunk's foot at the origin), and where they stand. */
  pines: { grid: Grid; at: [number, number, number] }[];
  /** The icicles' lips: the bottom middle of every rim cell of the overhang the camera sees (metres). */
  lips: [number, number, number][];
  /** The two floating rocks, each in its own frame, and where they hover. */
  rocks: { grid: Grid; at: [number, number, number] }[];
  /** The top's height at a point (metres), for anything placed on it. */
  topAt: (x: number, z: number) => number;
  /** The front of the third underside band's foot, under the champion (y, z in metres): kept on screen, so the first two
   * bands 4.3.4 wants on screen show below the soil's icicles, not only behind them. */
  foot: [number, number];
  /** The underside's stone bands (M cells), under the soil. */
  under: Grid;
}

/**
 * The island as voxels. Its top is y = 0 behind the step (the crates stand there) and y = -0.1 in front of it; x and z
 * are the crates' own (the champion's crate's middle at the origin, the crates' fronts at z = 0.6).
 */
export function islandVoxels(layout: StageLayout): IslandVoxels {
  const g = new Grid(CELL);
  const a = layout.halfW, b = layout.halfD, cz = layout.midZ;
  const X0 = cellAt(-a) - 1, X1 = cellAt(a) + 1, Z0 = cellAt(cz - b) - 1, Z1 = cellAt(cz + b) + 1;
  const inside = (x: number, z: number) => inRound(x, z, 0, cz, a, b);
  const soilIn = (x: number, z: number) => inRound(x, z, 0, cz, a - CELL, b - CELL);
  const low = (z: number) => (z + 0.5) * CELL > STEP_Z;
  /** The top cell's row at a column: -1 behind the step, -2 in front. */
  const topRow = (z: number) => (low(z) ? -2 : -1);
  const snow = c('snow', 0), snowDn = c('snow', -1), snowUp = c('snow', 1);

  // ---- What stands on the top, worked out first so the drifts know where it is --------------------------------------
  const lay = new Map<string, number>();            // extra snow height (cells) on a column of the top
  const raise = (x: number, z: number, h: number) => { const k = `${x},${z}`; lay.set(k, Math.max(lay.get(k) ?? 0, h)); };
  const taken = new Set<string>();                  // columns a prop or a crate stands on: no drift, ripple or print
  const take = (x: number, z: number) => taken.add(`${x},${z}`);

  // Drifts against the back and both sides of every crate: 2 cells high for 2 cells out, then 1 for 2 more. Never in
  // front (the plates and the trails are there). In metres, because the outer crates' edges fall between cells.
  for (const cx of layout.x) {
    const x0 = cx - CRATE.w / 2, x1 = cx + CRATE.w / 2, z0 = -FRONT, z1 = FRONT, e = 1e-6;
    for (let x = cellAt(x0) - 5; x <= cellAt(x1) + 5; x++) for (let z = cellAt(z0) - 5; z <= cellAt(z1); z++) {
      const lx = x * CELL, hx = lx + CELL, lz = z * CELL, hz = lz + CELL;
      if (lx >= x0 - e && hx <= x1 + e && lz >= z0 - e && hz <= z1 + e) { take(x, z); continue; }
      if (hz > z1 + e) continue;
      const dx = Math.max(x0 - hx, lx - x1, 0), dz = Math.max(z0 - hz, 0);
      const d = 1 + Math.floor((dx + dz) / CELL + e);
      if (d <= 4) raise(x, z, d <= 2 ? 2 : 1);
    }
  }

  // ---- The props on the top (4.4) ----------------------------------------------------------------------------------
  const wood = c('wood', 0), woodDn = c('wood', -1), cap = snow;
  // The fence: three posts and two rails from its front post to its back post, 0.6 m over the higher ground, snow on
  // every top; a drift on its outer (left) side, 3 cells at the posts, a cell lower every 2 cells out. The front post
  // stands on the lower ground in front of the step, so it is one cell longer; the rails stay level.
  const [fx0, fz0] = placeOf(...PROPS.fence.front), [fx1, fz1] = placeOf(...PROPS.fence.back);
  const fenceH = Math.round(PROPS.fence.h / CELL);
  const posts = [0, 0.5, 1].map((t) => [cellAt(fx0 + (fx1 - fx0) * t), cellAt(fz0 + (fz1 - fz0) * t)] as const);
  const put = (x: number, y: number, z: number, col: RGB) => g.set(x, y, z, col);
  for (const [px, pz] of posts) {
    for (let y = topRow(pz) + 1; y < fenceH; y++) put(px, y, pz, woodDn);
    put(px, fenceH, pz, cap);
    take(px, pz);
  }
  // The rails: a line that steps one axis at a time between the posts (so it is one piece), at two heights.
  for (let s = 0; s < posts.length - 1; s++) {
    const [ax, az] = posts[s], [bx2, bz2] = posts[s + 1];
    let x = ax, z = az;
    while (x !== bx2 || z !== bz2) {
      const tx = bx2 === ax ? 1 : (x - ax) / (bx2 - ax), tz = bz2 === az ? 1 : (z - az) / (bz2 - az);
      if (x !== bx2 && tx <= tz) x += Math.sign(bx2 - ax); else z += Math.sign(bz2 - az);
      if (x === bx2 && z === bz2) break;
      for (const y of [2, 4]) put(x, y, z, wood);
      put(x, 5, z, cap);
      take(x, z);
    }
  }
  const fdx = fx1 - fx0, fdz = fz1 - fz0, flen = Math.hypot(fdx, fdz);
  const outward: [number, number] = fdz > 0 ? [fdz / flen, -fdx / flen] : [-fdz / flen, fdx / flen];
  if (outward[0] > 0) { outward[0] *= -1; outward[1] *= -1; }
  for (let x = cellAt(Math.min(fx0, fx1)) - 8; x <= cellAt(Math.max(fx0, fx1)) + 8; x++) for (let z = cellAt(Math.min(fz0, fz1)) - 8; z <= cellAt(Math.max(fz0, fz1)) + 8; z++) {
    const px = (x + 0.5) * CELL - fx0, pz = (z + 0.5) * CELL - fz0;
    const along = (px * fdx + pz * fdz) / flen, out = px * outward[0] + pz * outward[1];
    if (along < -0.05 || along > flen + 0.05 || out < -0.05) continue;
    const d = Math.floor(out / CELL + 0.5);                    // cells out from the fence line
    const h = 3 - Math.floor((d + 1) / 2);                     // 3 at the line and the next two cells, then a cell less every 2
    if (h > 0) raise(x, z, h);
  }

  // The hay bales: two, the top one turned 20 degrees and set half back, snow caps, a drift in front.
  const hay = c('hay', 0), strap = c('hay', -2);
  const [bx, bz] = placeOf(PROPS.bales.X, PROPS.bales.Z);
  const bale = (cxm: number, czm: number, y0: number, turn: number) => {
    const ca = Math.cos(turn), sa = Math.sin(turn), hw = 0.3, hd = 0.2;
    for (let x = cellAt(cxm - 0.45); x <= cellAt(cxm + 0.45); x++) for (let z = cellAt(czm - 0.45); z <= cellAt(czm + 0.45); z++) {
      const px = (x + 0.5) * CELL - cxm, pz = (z + 0.5) * CELL - czm;
      const u = px * ca - pz * sa, v = px * sa + pz * ca;
      if (Math.abs(u) > hw || Math.abs(v) > hd) continue;
      const band = Math.abs(Math.abs(u) - 0.15) < 0.05;
      for (let y = y0; y < y0 + 4; y++) put(x, y, z, band ? strap : hay);
      put(x, y0 + 4, z, cap);
      if (y0 === 0) take(x, z);
    }
  };
  bale(bx, bz, 0, 0);
  bale(bx + 0.12, bz - 0.18, 4, (20 * Math.PI) / 180);
  for (let x = cellAt(bx - 0.3); x <= cellAt(bx + 0.3); x++) for (const dz of [1, 2]) raise(x, cellAt(bz + 0.2) + dz - 1, 2);

  // The lantern post: one cell square, 0.7 m, and on it the lantern (S cells, 0.2 m across, about half version 2's)
  // with its light inside the glass: 1.0 m in all.
  const [lx, lz] = placeOf(PROPS.lantern.X, PROPS.lantern.Z);
  const lcx = cellAt(lx), lcz = cellAt(lz), postH = 7, lanternBase = topRow(lcz) + 1;
  for (let y = lanternBase; y < lanternBase + postH; y++) put(lcx, y, lcz, woodDn);
  take(lcx, lcz);
  const lantern = new Grid(FINE), glass = new Grid(FINE);
  const iron = c('iron', 0), ironHi = c('iron', 1);
  const fx = lcx * 2, fz = lcz * 2, fy = (lanternBase + postH) * 2;
  for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 2; dz++) {
    lantern.set(fx + dx, fy, fz + dz, iron);
    const corner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
    for (let y = fy + 1; y < fy + 4; y++) (corner ? lantern : glass).set(fx + dx, y, fz + dz, corner ? iron : c('brass', 2));
    lantern.set(fx + dx, fy + 4, fz + dz, ironHi);
  }
  for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) lantern.set(fx + dx, fy + 5, fz + dz, cap);
  const lamp: [number, number, number] = [(fx + 1) * FINE, (fy + 2.5) * FINE, (fz + 1) * FINE];

  // The pines: their own grids (they sway about the trunk's foot), a ring of drift round each trunk.
  const pines: IslandVoxels['pines'] = [];
  [PROPS.tallPine, PROPS.smallPine].forEach((p, k) => {
    const [px, pz] = placeOf(p.X, p.Z);
    const tx = Math.round(px / CELL), tz = Math.round(pz / CELL);
    const grid = new Grid(CELL);
    tieredPine((x, y, z, col) => grid.set(x, y, z, col), (x, y, z) => grid.has(x, y, z), 0, 0, 0, p.h, CELL, 5, pinePaint(k + 1));
    pines.push({ grid, at: [tx * CELL, (topRow(tz) + 1) * CELL, tz * CELL] });
    for (let x = tx - 3; x <= tx + 2; x++) for (let z = tz - 3; z <= tz + 2; z++) {
      if (x >= tx - 1 && x <= tx && z >= tz - 1 && z <= tz) { take(x, z); continue; }
      raise(x, z, 2);
    }
  });

  // ---- Wind ripples and trails of footprints (4.1.4, 4.1.5) --------------------------------------------------------
  const dents = new Set<string>(), path = new Set<string>();
  const free = (x: number, z: number) => inside(x, z) && !taken.has(`${x},${z}`) && !lay.has(`${x},${z}`);
  const dent = (xm: number, zm: number) => { const x = cellAt(xm), z = cellAt(zm); if (free(x, z)) dents.add(`${x},${z}`); };
  // Three trails from the middle of the front rim, sharing their first three pairs, then one to the foot of each crate.
  // A pair is two dents a cell apart sideways; pairs 2 cells apart along the trail.
  const start: [number, number] = [0.05, RIM_Z - 0.25];
  const pairAt = (x: number, z: number, dx: number, dz: number) => {
    const n = Math.hypot(dx, dz), sx = -dz / n, sz = dx / n;
    dent(x - sx * 0.1, z - sz * 0.1); dent(x + sx * 0.1, z + sz * 0.1);
    for (const o of [-0.1, 0, 0.1]) path.add(`${cellAt(x + sx * o)},${cellAt(z + sz * o)}`);
  };
  for (let i = 0; i < 3; i++) pairAt(start[0], start[1] - i * 0.2, 0, -1);
  const split: [number, number] = [start[0], start[1] - 0.6];
  for (const cx of layout.x) {
    const tx = cx + 0.05, tz = FRONT + 0.15;
    const dx = tx - split[0], dz = tz - split[1], n = Math.hypot(dx, dz);
    for (let s = 0; s <= n; s += 0.2) pairAt(split[0] + (dx * s) / n, split[1] + (dz * s) / n, dx, dz);
  }
  // Three straight ridges at 30 degrees to the crates' line, rising toward screen right, 0.6 m apart, 1.2, 1.8 and 1.5 m
  // long from the left, a cell high in snow +1, a cell of snow -1 along their far side; each broken where a trail crosses.
  const ridge = new Map<string, RGB>(), lee = new Set<string>();
  const dirX = Math.cos(Math.PI / 6), dirZ = -Math.sin(Math.PI / 6), mz = (STEP_Z + 0.1 + RIM_Z - 0.3) / 2;
  /** Open snow for a ripple: 0.3 m inside the rim, 0.3 m in front of the crates, on the lower ground. */
  const open = (x: number, z: number) => inRound(x, z, 0, cz, a - 0.3, b - 0.3) && z * CELL >= Math.max(FRONT + 0.3, STEP_Z) && free(x, z);
  [[-1.2, 1.2], [0, 1.8], [1.2, 1.5]].forEach(([mx, len]) => {
    // A line that steps one axis at a time, so the ridge is one cell wide and every cell meets the next by a face.
    const x0 = cellAt(mx - (dirX * len) / 2), z0 = cellAt(mz - (dirZ * len) / 2);
    const x1 = cellAt(mx + (dirX * len) / 2), z1 = cellAt(mz + (dirZ * len) / 2);
    let x = x0, z = z0;
    for (;;) {
      const k = `${x},${z}`;
      if (open(x, z) && !path.has(k)) ridge.set(k, snowUp);
      if (x === x1 && z === z1) break;
      const tx = x1 === x0 ? 1 : (x - x0) / (x1 - x0), tz = z1 === z0 ? 1 : (z - z0) / (z1 - z0);
      if (x !== x1 && tx <= tz) x += Math.sign(x1 - x0); else z += Math.sign(z1 - z0);
    }
  });
  for (const k of ridge.keys()) {
    const [x, z] = k.split(',').map(Number), far = `${x},${z - 1}`;
    if (!ridge.has(far) && !path.has(far) && free(x, z - 1)) lee.add(far);
  }

  // ---- The island: snow, soil, stones, the rim's overhang ----------------------------------------------------------
  const lips: [number, number, number][] = [];
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    if (!inside(x, z)) continue;
    const t = topRow(z), k = `${x},${z}`;
    const rows = low(z) ? SNOW_ROWS : [-1, ...SNOW_ROWS];
    for (const y of rows) put(x, y, z, snow);
    if (dents.has(k)) { g.del(x, t, z); put(x, t - 1, z, snowDn); }
    else if (lee.has(k)) put(x, t, z, snowDn);
    if (ridge.has(k)) put(x, t + 1, z, ridge.get(k)!);
    const h = taken.has(k) ? 0 : lay.get(k) ?? 0;
    // A drift: its top cell snow, the cells under the top (its sides) a step down.
    for (let y = 1; y <= h; y++) if (!g.has(x, t + y, z)) put(x, t + y, z, y === h ? snow : snowDn);
    if (soilIn(x, z)) {
      for (const y of SOIL_ROWS) put(x, y, z, SOIL);
      for (const y of LOW_SOIL_ROWS) put(x, y, z, y === LOW_SOIL_ROWS[2] ? SOIL_FOOT : SOIL_LOW);
    } else if (z * CELL + CELL / 2 > cz && !g.has(x, SNOW_ROWS[1] - 1, z)) {
      // A cell of the overhang the camera sees (the island's front half): an icicle's lip.
      lips.push([(x + 0.5) * CELL, SNOW_ROWS[1] * CELL, (z + 0.5) * CELL]);
    }
  }
  // Stones in the lower soil's front face: 2 x 2 cells, flush, stone and stone -1 by turns, every 0.8 m, by turns a cell
  // higher and lower.
  const front = (x: number) => { for (let z = Z1; z >= Z0; z--) if (soilIn(x, z)) return z; return null; };
  for (let i = 0, xm = -a + 0.5; xm < a - 0.5; xm += 0.8, i++) {
    const x = cellAt(xm), fz2 = front(x), fz3 = front(x + 1);
    if (fz2 === null || fz3 === null) continue;
    const ys = i % 2 ? [-7, -8] : [-6, -7], col = c('stone', i % 2 ? -1 : 0);
    for (const y of ys) { put(x, y, fz2, col); put(x + 1, y, fz3, col); }
  }
  // Roots: two under each pine, hanging from the soil's foot at the front face, a cell thick, 0.3 and 0.5 m, each a cell
  // to one side halfway down.
  const root = c('darkWood', -1);
  for (const p of [PROPS.tallPine, PROPS.smallPine]) {
    const [px] = placeOf(p.X, p.Z);
    [[cellAt(px) - 1, 3, 1], [cellAt(px) + 2, 5, -1]].forEach(([x, len, side]) => {
      const fz = front(x);
      if (fz === null) return;
      for (let s = 0; s < len; s++) put(x + (s >= Math.ceil(len / 2) ? side : 0), LOW_SOIL_ROWS[2] - 1 - s, fz, root);
      put(x + side, LOW_SOIL_ROWS[2] - 1 - Math.ceil(len / 2) + 1, fz, root);
    });
  }

  // ---- The underside: stone bands to a tip under the champion, 0.4 m left of its middle; a smaller lobe under third --
  // Their own grid, so the stage can leave them out of the island's shadow: in it, both tones went one dark grey.
  const under = new Grid(CELL);
  const band = (cxm: number, czm: number, ha: number, hb: number, y: number, k: number) => {
    const col = c('stone', k % 2 ? -1 : 0);
    for (let x = cellAt(cxm - ha) - 1; x <= cellAt(cxm + ha) + 1; x++) for (let z = cellAt(czm - hb) - 1; z <= cellAt(czm + hb) + 1; z++)
      if (inRound(x, z, cxm, czm, Math.max(ha, CELL), Math.max(hb, CELL), 2.6) && !g.has(x, y, z) && !under.has(x, y, z)) { under.set(x, y, z, col); under.set(x, y - 1, z, col); }
  };
  const bands = Math.round(UNDER_DEPTH / 0.2);
  let ha = a - CELL, top = LOW_SOIL_ROWS[2] - 1;
  for (let i = 0; i < bands; i++) {
    ha = Math.max(CELL, ha - NARROW[i % NARROW.length]);
    // The middle drifts toward the tip as the band narrows, so neither side of a band ever stands out past the band above.
    const f = Math.min(1, (a - CELL - ha) / (a - 2 * CELL)), hb = Math.max(CELL, (b - CELL) * (ha / (a - CELL)));
    band(-0.4 * f, cz + (0 - cz) * f, ha, hb, top - 2 * i, i);
  }
  const lobeBands = Math.round(bands * 0.6);
  let la = 1.1;
  for (let i = 0; i < lobeBands; i++) {
    la = Math.max(CELL, la - NARROW[i % NARROW.length] * 0.5);
    band(layout.x[2], 0, la, la * 0.7, top - 2 * i, i);
  }
  // Two floating rocks under the main tip, 0.4 and 0.25 m across, stepped.
  const tipY = (top - 2 * bands + 1) * CELL;   // the bottom face of the last band
  // Two stepped chunks of stone (S cells: 0.25 m is not a whole number of M cells), each a step narrower per row, their
  // top face 0.4 m and 0.7 m under the tip, one a little left of it and one a little right. In their own frame: the top
  // face at y = 0, centred on x and z.
  const rock = (w: number) => {
    const r = new Grid(FINE), n = Math.round(w / FINE), st = c('stone', 0), dn = c('stone', -1);
    for (let y = -1, m = n; m > 0; y--, m -= 2) for (let x = 0; x < m; x++) for (let z = 0; z < m; z++) r.set(x + (n - m) / 2 - Math.floor(n / 2), y, z + (n - m) / 2 - Math.floor(n / 2), y === -1 ? st : dn);
    return r;
  };
  const rocks: IslandVoxels['rocks'] = [
    { grid: rock(0.4), at: [-0.4 - 0.35, tipY - 0.4, -0.05] },
    { grid: rock(0.25), at: [-0.4 + 0.3, tipY - 0.7, 0.1] },
  ];

  const row = top - 5;   // the third band's lower row: the first two then show clear of the soil and its icicles
  let front2 = -Infinity;
  for (const c2 of under.map.values()) if (c2.y === row && Math.abs(c2.x) <= 3) front2 = Math.max(front2, c2.z);
  const foot: [number, number] = [row * CELL, (front2 + 1) * CELL];
  const topAt = (xm: number, zm: number) => (topRow(cellAt(zm)) + 1) * CELL + (lay.get(`${cellAt(xm)},${cellAt(zm)}`) ?? 0) * CELL;
  return { body: g, under, lantern, glass, lamp, pines, lips, rocks, topAt, foot };
}

export interface IslandGeo {
  body: BufferGeometry; under: BufferGeometry; lantern: BufferGeometry; glass: BufferGeometry; icicles: BufferGeometry | null;
  lamp: [number, number, number]; foot: [number, number];
  pines: { geo: BufferGeometry; at: [number, number, number] }[];
  rocks: { geo: BufferGeometry; at: [number, number, number] }[];
}
/** The island as meshes: the body with everything fixed on it, the lantern and its glass, the icicles, each pine and rock. */
export function islandGeometry(layout: StageLayout): IslandGeo {
  const v = islandVoxels(layout);
  return {
    body: buildGeometry(v.body.map, CELL), under: buildGeometry(v.under.map, CELL), lantern: buildGeometry(v.lantern.map, FINE), glass: buildGeometry(v.glass.map, FINE),
    icicles: buildIcicles(v.lips, CELL), lamp: v.lamp, foot: v.foot,
    pines: v.pines.map((p) => ({ geo: buildGeometry(p.grid.map, CELL), at: p.at })),
    rocks: v.rocks.map((r) => ({ geo: buildGeometry(r.grid.map, FINE), at: r.at })),
  };
}

/**
 * Icicles under every lip (docs/depth/DEPTH-PLAN.md, Appendix F, `buildIcicles`), on S cells: some lips bare, the rest one
 * or two icicles of their own length, 0.1 to 0.55 m, the top third two cells square, `ice +1` with an `ice +2` tip. Each
 * lip is the bottom middle of a cube of `cube` metres (the appendix's 0.2; here the island's 0.1).
 */
export function buildIcicles(lips: [number, number, number][], cube = 0.2): BufferGeometry | null {
  if (!lips.length) return null;
  const C = FINE, g = new Grid(C), top = solid('ice', 1), tip = solid('ice', 2);
  const hash = (a: number, b: number, d: number) => { const s = Math.sin(a * 127.1 + b * 311.7 + d * 74.7) * 43758.5453; return s - Math.floor(s); };
  const span = Math.max(1, Math.round(cube / C) - 1);
  for (const [x, y, z] of lips) {
    const h0 = hash(x, y, z);
    if (h0 > 0.62) continue;
    const n = h0 < 0.25 ? 2 : 1;
    for (let m = 0; m < n; m++) {
      const ox = Math.floor(hash(x, z, m + 3) * span), oz = Math.floor(hash(z, x, m + 7) * span);
      const cx = Math.round((x - cube / 2) / C) + ox, cz = Math.round((z - cube / 2) / C) + oz, cy = Math.round(y / C) - 1;
      const L = 2 + Math.floor(hash(x + m, y, z) ** 1.6 * 10);
      for (let s = 0; s < L; s++) {
        const wide = s < Math.ceil(L / 3);
        g.set(cx, cy - s, cz, s === L - 1 ? tip : top);
        if (wide) { g.set(cx + 1, cy - s, cz, top); g.set(cx, cy - s, cz + 1, top); g.set(cx + 1, cy - s, cz + 1, top); }
      }
    }
  }
  if (!g.map.size) return null;
  const geo = buildGeometry(g.map, C, { ao: false, merge: true });
  if (geo.getAttribute('bevel')) geo.deleteAttribute('bevel');
  return geo;
}

// ---------------------------------------------------------------------------------------------------------------------
// The far islands (4.5)
// ---------------------------------------------------------------------------------------------------------------------

export interface FarSpec { top: number; mirror: boolean; things: 'barn' | 'fence' | 'pines'; mix: number }
/** A, B and C: their top's width, which way their tip leans, what stands on them, and how far toward the sky they fade. */
export const FAR: Record<'A' | 'B' | 'C', FarSpec> = {
  A: { top: 2.6, mirror: false, things: 'barn', mix: 0.55 },
  B: { top: 1.8, mirror: true, things: 'fence', mix: 0.55 },
  C: { top: 1.2, mirror: false, things: 'pines', mix: 0.7 },
};

/**
 * A far island: a flat, wide top; snow and soil together 0.15 of its width thick; three stepped bands under it to a blunt
 * tip off the middle (its left side stepping in twice as fast as its right, or the other way when mirrored); about 0.6
 * of its width tall in all. Every colour mixed toward `sky` by the spec's share, for a material that takes no light.
 */
export function farIsland(spec: FarSpec, sky: RGB): Grid {
  const g = new Grid(CELL);
  const mix = (col: RGB): RGB => [col[0] + (sky[0] - col[0]) * spec.mix, col[1] + (sky[1] - col[1]) * spec.mix, col[2] + (sky[2] - col[2]) * spec.mix];
  const n = Math.round(spec.top / CELL), hw = n / 2, depth = Math.max(4, Math.round(n * 0.5));
  const slab = Math.max(2, Math.round(n * 0.15)), bandH = Math.max(1, Math.round(n * 0.15));
  const snow = mix(c('snow', 0)), soil = mix(SOIL), st = mix(c('stone', 0)), stDn = mix(c('stone', -1));
  for (let x = -Math.floor(hw); x < Math.ceil(hw); x++) for (let z = 0; z < depth; z++) for (let y = 0; y < slab; y++) g.set(x, -1 - y, z, y < Math.ceil(slab / 3) ? snow : soil);
  const s = (0.8 * n) / 9;
  let left = -Math.floor(hw), right = Math.ceil(hw), d0 = 0, d1 = depth;
  for (let k = 0; k < 3; k++) {
    const fast = Math.max(1, Math.round(2 * s)), slow = Math.max(1, Math.round(s));
    if (spec.mirror) { left += slow; right -= fast; } else { left += fast; right -= slow; }
    d0 += 1; d1 -= 1;
    if (right - left < 1) { right = left + 1; }
    for (let x = left; x < right; x++) for (let z = Math.max(0, d0); z < Math.max(d0 + 1, d1); z++) for (let y = 0; y < bandH; y++) g.set(x, -1 - slab - k * bandH - y, z, k % 2 ? stDn : st);
  }
  // What stands on it: pale pines (never white), a small barn, a short fence.
  const paint = { trunk: mix(c('darkWood', 0)), needles: () => mix(c('pine', 0)), under: () => mix(c('pine', -1)), snow };
  const pine = (x: number, z: number, h: number) => tieredPine((px, py, pz, col) => g.set(px, py, pz, col), (px, py, pz) => g.has(px, py, pz), x, z, 0, h, CELL, 4, paint);
  const mid = Math.floor(depth / 2);
  if (spec.things === 'barn') {
    pine(-Math.floor(hw) + 3, mid, 1.2);
    pine(-Math.floor(hw) + 7, mid + 1, 0.9);
    const red = mix(c('barnRed', 0)), roof = snow, bx0 = Math.ceil(hw) - 12, bz0 = mid - 4;
    for (let x = 0; x < 10; x++) for (let z = 0; z < 8; z++) for (let y = 0; y < 6; y++) g.set(bx0 + x, y, bz0 + z, red);
    for (let y = 0; y < 4; y++) for (let x = y; x < 10 - y; x++) for (let z = -1; z < 9; z++) g.set(bx0 + x, 6 + y, bz0 + z, roof);
  } else if (spec.things === 'fence') {
    pine(spec.mirror ? Math.ceil(hw) - 3 : -Math.floor(hw) + 3, mid, 1.0);
    const post = mix(c('wood', -1)), fx0 = spec.mirror ? -Math.floor(hw) + 3 : Math.ceil(hw) - 7;
    for (const x of [fx0, fx0 + 4]) for (let y = 0; y < 5; y++) g.set(x, y, mid, post);
    for (let x = fx0; x <= fx0 + 4; x++) g.set(x, 3, mid, post);
  } else {
    pine(-Math.floor(hw) + 3, mid, 0.9);
    pine(Math.ceil(hw) - 3, mid, 0.7);
  }
  return g;
}
