import type { BufferGeometry } from 'three';
import { buildGeometry, packGeometry, triangles } from '../voxel/mesher';
import type { BuildOptions, VoxelMap } from '../voxel/mesher';
import { barnWalls } from './barn';
import { sunReaches, unseenFrom } from '../voxel/unseen';
import { detailedSteps, structureSteps } from '../voxel/refine';
import { each, finish } from './slices';
import type { Steps } from './slices';
import { asBefore, pick, T } from '../voxel/palette';
import { inWendigoZone, nearWendigo } from './wendigoZone';
import { blanket, SNOW, snowAt, snowPaint } from '../voxel/snow';
import type { Tone } from '../voxel/palette';
import { ellipsoid, Grid, hash3, line, rng } from '../voxel/primitives';
import { noteShade } from '../voxel/groundShade';
import { byPart, paint, seededPart, solid, SOLID_SNOW } from '../voxel/paint';
import { pinePaint, tieredPine } from './style/pine';
import type { Paint, V3 } from '../voxel/primitives';
import { backHillHeight } from './distance';
import { buildFarmMicroSteps, noteStructure, underMicro } from './farmMicro';
import type { FarmMicro } from './farmMicro';
import { BARN, YARD } from './layout';
import { ChunkMap, plain } from './yard';

/**
 * The working farm around the barn, seen only from the start screen. The barn itself is a stage set for the game's
 * table camera: no front wall, a roof over the back third, gaps in the back boards. This file finishes it from the
 * outside and fills the land around it, in meshes the table never mounts, so nothing here touches the game's view.
 * Fine work is on the 0.10 m grid, buildings and props on the 0.20 m grid, the land on the 1 m grid (plan V3 Part 4.1).
 */
const F = 0.1;
const S = 0.2;
const CHUNK = 8;

/** Where everything stands, in metres. The shot list in FarmBackdrop frames these. */
export const FARM = {
  /** Against the barn's east wall, joined to it by its feed room. */
  silo: { x: 9.7, z: -0.8, r: 1.9, h: 10.5 },
  /** On the court's west side, its pop door into the run. */
  coop: { x: -13, z: 8.4 },
  /**
   * Parked at the back between the pens and the field, where the barn hides it from the paddock camera (Brian,
   * 2026-11-19: "seeing a tractor isnt very pretty"; it stood by the barn doors, in the middle of the forecourt).
   */
  tractor: { x: -8, z: -10.5 },
  paddock: { minX: 12, maxX: 22, minZ: -14, maxZ: 7 },
  /** The hens' run, from the coop down to the court's fence; the pig's sty shares its north side. */
  run: { minX: -17.4, maxX: -9.8, minZ: 6.6, maxZ: 15 },
  sty: { minZ: 0.4 },
  /** Behind the hens, north-west of the house. */
  orchard: { minX: -29.5, minZ: -7, cols: 2, rows: 4, gap: 5.2 },
  field: { minX: -26, maxX: 30, minZ: -27, maxZ: -16 },
  /**
   * The windbreak: two staggered rows of pines down the farm's west side, the side the winter wind comes from, turning
   * the corner at the north end. Each [x, z, height in metres].
   */
  windbreak: [
    ...[-12, -7.5, -3, 1.5, 6, 10.5, 15, 19.5, 24, 28.5, 33].map((z, i) => [-35, z, [8.6, 7.4, 9.2, 8, 7, 9, 8.2, 7.6, 9.4, 8, 6.8][i]] as const),
    ...[-9.8, -5.2, -0.8, 3.8, 8.2, 12.8, 17.2, 21.8, 26.2, 30.8].map((z, i) => [-38.8, z, [7, 8.8, 7.8, 9.4, 8.2, 7.2, 8.8, 9, 7.4, 8.4][i]] as const),
    [-31, -12.6, 7.8], [-27, -12, 6.6],
  ] as [number, number, number][],
};

/** The old paint, a tone chosen per cube: only for what stands behind the line z = -16 (the field's stubble and bales), which keeps the look it had. */
const tone = (t: Tone, seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);
/** The old painted snow: the field's six bales, behind the line. */
const oldSnow = snowPaint(F, 3);
/** A cap of snow (docs/miniature/03, section 3): one white, a step over the open ground's. */
const cap: Paint = SOLID_SNOW ? paint('snow', 1) : oldSnow;
/** The roofs' blankets and the drifts, which are their own unshaded mesh. */
const CAP_SNOW = SOLID_SNOW ? solid('snow', 1) : SNOW;
const white = paint('trimWhite', 0);

/** Top of the barn's own roof boards at column x (0.1 m index), as in barn.ts. */
const barnRoofY = (x: number) => 42 + Math.floor(22 * Math.max(0, 1 - Math.abs(x + 0.5) / 60));
/**
 * The barn's outer roof, a rounded gambrel as Brian's farm picture draws it (2026-11-19): steep from the eaves, easing
 * over two breaks to the ridge. Its underside's height in metres at `ax` metres from the ridge line; it stands over the
 * barn's own roof boards everywhere.
 */
const GAMBREL: readonly (readonly [number, number])[] = [[6.8, 4.05], [6.2, 4.2], [5.2, 6.0], [2.8, 7.1], [0, 7.6]]; // its eaves where the old roof's were: the lights hang from them
function gambrel(ax: number): number {
  for (let i = 0; i + 1 < GAMBREL.length; i++) {
    const [a0, h0] = GAMBREL[i], [a1, h1] = GAMBREL[i + 1];
    if (ax >= a1) return h0 + ((h1 - h0) * (a0 - Math.min(a0, ax))) / (a0 - a1);
  }
  return GAMBREL[GAMBREL.length - 1][1];
}
/** The outer roof's lowest row on the 0.2 m grid at column `xi`, and the same line on the walls' 0.1 m grid at column `x`. */
const roofRow = (xi: number) => Math.ceil(gambrel(Math.abs((xi + 0.5) * S)) / S);
const roofY = (x: number) => 2 * roofRow(Math.floor(x / 2));

class Builder {
  /** The roofs' snow, kept apart: it is meshed with no corner shading, so a blanket's steps do not stripe it. */
  readonly caps: Grid;
  constructor(readonly g: Grid) { this.caps = new Grid(g.size); }
  /** A blanket of snow over a roof's top cells (voxel/snow.ts). */
  blanket(tops: readonly (readonly [number, number, number])[], thick: number | ((x: number) => number) = 2) {
    blanket(tops, (x, y, z) => { if (!this.g.has(x, y, z)) this.caps.set(x, y, z, CAP_SNOW); }, thick);
  }
  ix = (m: number) => Math.round(m / this.g.size);
  set(x: number, y: number, z: number, p: Paint) {
    // Snow takes this builder's own cell size, so the roof's 0.2 m grid and the yard's 0.1 m grid get the same marks.
    const paint = () => (p === oldSnow ? snowAt(x, y, z, this.g.size, 3) : p(x, y, z));
    const c = inWendigoZone(x * this.g.size, z * this.g.size) ? asBefore(paint) : paint(); // the wendigo's zone keeps its colours
    if (c) this.g.set(x, y, z, c);
  }
  /** An inclusive box of cells, by index. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, p: Paint) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, p);
  }
  /** Snow on a cell's upper face, unless something sits there. */
  cap(x: number, y: number, z: number, p: Paint = cap) {
    if (!this.g.has(x, y + 1, z)) this.set(x, y + 1, z, p);
  }
  /** Caps the top of everything in this box of columns. */
  capAll(x0: number, x1: number, y1: number, z0: number, z1: number, chance = 0.8, p: Paint = cap) {
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++)
        for (let y = y1; y >= 0; y--)
          if (this.g.has(x, y, z)) {
            // An even cap of snow: gaps scattered through it read as static (Brian, 2026-11-18). In the wendigo's
            // zone it keeps the gaps it had (`chance`), voxel for voxel.
            if (!inWendigoZone(x * this.g.size, z * this.g.size) || hash3(x, y, z, 9) < chance) this.cap(x, y, z, p);
            break;
          }
  }
}

/** The steps the barn's boards take, by board number (docs/miniature/01, section 5). */
export const BOARD_STEPS = [0, -1, 0, 1] as const;

/** The barn's missing outside on the 0.10 m grid: front wall, solid boards, trim, loft door, windows, foundation. */
function barnShell(): BufferGeometry {
  const b = barnShellGrid();
  noteStructure(b.g.map.values(), F);
  noteShade(b.g.map.values(), F);
  return buildGeometry(b.g.map, F);
}
function barnShellGrid(): Builder {
  const b = new Builder(new Grid(F));
  // Boards three cubes wide, each one red, in a rhythm of four by board number (the same in scene/barn.ts, whose boards
  // these continue); the seam between two boards two steps down; the top 0.4 m under the roof a step darker, the eave's
  // shade. Foundation stones 0.4 m long and 0.2 m high in a running bond, each its own step.
  const seam = solid('barnRed', -2);
  const board = (i: number): Paint => (x, y) => solid('barnRed', BOARD_STEPS[i % 4] - (y >= roofY(x) - 4 ? 1 : 0));
  const stone = seededPart('stone', 51, (x, y, z) => ((x + 2 * ((y >> 1) & 1)) >> 2) * 31 + (y >> 1) * 7 + (z >> 2));

  // The gaps between the back boards, closed from just inside the outer face.
  for (let xa = -62; xa <= 61; xa += 3) {
    const x = xa + 2;
    if (x > 61) break;
    for (let y = 0; y < barnRoofY(x); y++) {
      if (x >= -18 && x < 18 && y < 34) continue;
      b.set(x, y, 70, () => seam);
    }
  }

  // Front wall: the side walls' boards, up into the gable, with big closed doors in the middle.
  for (let i = 0, xa = -62; xa <= 61; i++, xa += 3) {
    for (let x = xa; x <= Math.min(61, xa + 2); x++)
      for (let y = 0; y < roofY(x); y++)
        for (const z of [-44, -43]) b.set(x, y, z, x === xa + 2 ? () => seam : board(i));
    // The back gable, from over the barn's own roof boards (two cells thick) up to the outer roof.
    for (let x = xa; x <= Math.min(61, xa + 2); x++)
      for (let y = barnRoofY(x) + 2; y < roofY(x); y++)
        for (const z of [70, 71]) b.set(x, y, z, x === xa + 2 ? () => seam : board(i));
  }
  const frame = (x0: number, x1: number, y0: number, y1: number, z: number, w = 2) => {
    b.box(x0, x1, y0, y0 + w - 1, z, z, white);
    b.box(x0, x1, y1 - w + 1, y1, z, z, white);
    b.box(x0, x0 + w - 1, y0, y1, z, z, white);
    b.box(x1 - w + 1, x1, y0, y1, z, z, white);
  };
  const cross = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    for (let t = 0; t <= 80; t++) {
      const x = Math.round(x0 + (x1 - x0) * (t / 80)), y = Math.round(y0 + (y1 - y0) * (t / 80));
      for (const [px, py] of [[x, y], [x, y + 1], [x0 + x1 - x, y], [x0 + x1 - x, y + 1]]) b.set(px, py, z, white);
    }
  };
  for (const [x0, x1] of [[-20, -1], [0, 19]]) {
    frame(x0, x1, 4, 34, -45);
    cross(x0 + 1, x1 - 1, 5, 32, -45);
  }

  // Foundation: a course of stone round the foot of the walls.
  b.box(-63, 62, 0, 3, -45, -45, stone);
  b.box(-63, -63, 0, 3, -45, 72, stone);
  b.box(62, 62, 0, 3, -45, 72, stone);
  b.box(-63, -21, 0, 3, 72, 72, stone);
  b.box(20, 62, 0, 3, 72, 72, stone);

  // The wolf's side door, boarded up properly from outside.
  const SD = { z0: 17, z1: 30, y1: 23 };
  b.box(-63, -63, 4, SD.y1, SD.z0, SD.z1, byPart('barnRed', [-1, 0], (_x, _y, z) => z >> 1));
  frame2z(b, -63, SD.z0 - 2, SD.z1 + 2, 4, SD.y1 + 2);

  // Windows along both sides: white frame, dark panes, a sill with snow.
  for (const x of [-63, 62])
    for (const zc of x < 0 ? [-24, 50] : [-24, 12, 50]) {
      b.box(x, x, 20, 33, zc - 6, zc + 6, white);
      for (const z0 of [zc - 4, zc + 1]) { b.box(x, x, 22, 26, z0, z0 + 3, paint('glass', 0)); b.box(x, x, 28, 31, z0, z0 + 3, paint('glass', 1)); }
      const out = x < 0 ? x - 1 : x + 1;
      b.box(out, out, 19, 19, zc - 7, zc + 7, paint('trimWhite', -1));
      b.box(out, out, 20, 20, zc - 7, zc + 7, cap);
    }

  // Trim: corner boards, the rake under the roof on both gables, and the frame of the open doors.
  for (const x of [-64, -63, 62, 63]) { b.box(x, x, 4, 42, -46, -43, white); b.box(x, x, 4, 42, 70, 73, white); }
  for (const z of [-45, 72]) {
    b.box(-62, -60, 4, 42, z, z, white);
    b.box(59, 61, 4, 42, z, z, white);
    for (let x = -62; x <= 61; x++) for (let k = 1; k <= 3; k++) b.set(x, roofY(x) - k, z, paint('trimWhite', -1)); // the rake, under the roof's line
  }
  b.box(-20, -19, 0, 35, 72, 72, white);
  b.box(18, 19, 0, 35, 72, 72, white);
  b.box(-20, 19, 34, 36, 72, 72, white);

  // Hay loft over the open doors: a white-framed door with a cross, and the hoist beam above it.
  b.box(-9, 8, 39, 55, 72, 72, byPart('barnRed', [1, 0], (x) => x >> 2));
  frame(-9, 8, 39, 55, 73);
  cross(-8, 7, 40, 53, 73);
  b.box(-1, 0, 58, 59, 72, 84, paint('wood', -1));
  b.box(-1, 0, 56, 57, 83, 83, paint('iron', 0));
  b.box(-1, 0, 60, 60, 74, 84, cap);
  // Round vent high on the front gable.
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) {
    const r = Math.hypot(x, y);
    if (r <= 6.4) b.set(x, 58 + y, -45, r > 4.6 ? white : paint('barnRed', -2));
  }
  return b;
}

/** A white frame on an x-facing wall. */
function frame2z(b: Builder, x: number, z0: number, z1: number, y0: number, y1: number) {
  b.box(x, x, y0, y0 + 1, z0, z1, white);
  b.box(x, x, y1 - 1, y1, z0, z1, white);
  b.box(x, x, y0, y1, z0, z0 + 1, white);
  b.box(x, x, y0, y1, z1 - 1, z1, white);
}

/**
 * The whole roof on the 0.20 m grid, over the barn's own: a rounded gambrel of one grey, a white fascia under its edges,
 * and its snow as a gambrel holds it (`blanket` in voxel/snow.ts): a blanket over the shallow upper slopes, thinner on
 * the windward side, none on the steep lower slope, which sheds it, and a strip caught on the flare at the eaves.
 */
function barnRoof(b: Builder) {
  const X0 = b.ix(-6.8), X1 = b.ix(6.8) - 1, Z0 = b.ix(-4.8), Z1 = b.ix(7.8) - 1;
  const rise = roofRow;
  // Slate in courses two rows deep, three steps in turn; the fascia and soffit a step under the trim's white.
  const roofing: Paint = (_x, y) => solid('slate', [0, -1, 1][(y >> 1) % 3]), fascia = paint('trimWhite', -1);
  const tops: [number, number, number][] = [];
  for (let x = X0; x <= X1; x++) {
    const y = rise(x);
    // Down to the row under its lower neighbour's top, so the steep part shows no gap between one step and the next.
    const lower = Math.min(rise(x - 1), rise(x + 1), y);
    for (let z = Z0; z <= Z1; z++) {
      for (let yy = Math.min(y, lower + 1); yy <= y + 1; yy++) b.set(x, yy, z, roofing);
      const end = z === Z0 || z === Z1;
      const eave = x <= X0 + 3 || x >= X1 - 3;
      // A soffit under the roof's edges, so nothing shows under it: white along the eaves, the roof's own grey at the
      // gable ends, where a white one striped the rake (white trim, grey roof, white snow is all the picture shows).
      if (end || eave) b.set(x, Math.min(y, lower + 1) - 1, z, eave ? fascia : roofing);
      tops.push([x, y + 1, z]);
    }
  }
  b.blanket(tops, (x) => (x < 0 ? 1 : 2)); // less on the windward slope
  // Cupola on the ridge: white louvred box, little pitched roof, weathervane.
  const zc = b.ix(1.4), base = rise(0) + 2, h = 7;
  for (let y = base; y < base + h; y++)
    for (let x = -4; x <= 3; x++)
      for (let z = zc - 4; z <= zc + 3; z++) {
        const rim = x === -4 || x === 3 || z === zc - 4 || z === zc + 3;
        if (!rim) continue;
        const corner = (x === -4 || x === 3) && (z === zc - 4 || z === zc + 3);
        b.set(x, y, z, corner || y === base || y === base + h - 1 || (y - base) % 2 === 0 ? white : paint('slate', -1));
      }
  for (let k = 0; k < 4; k++) {
    const y = base + h + k;
    for (let x = -6 + k; x <= 5 - k; x++) for (let z = zc - 6; z <= zc + 5; z++) b.set(x, y, z, paint('slate', 0));
    for (let z = zc - 6; z <= zc + 5; z++) for (const x of [-6 + k, 5 - k]) b.cap(x, y, z);
  }
  const top = base + h + 4;
  for (let z = zc - 6; z <= zc + 5; z++) b.box(-2, 1, top, top, z, z, cap);
  const iron = paint('iron', 0);
  b.box(0, 0, top + 1, top + 4, zc, zc, iron);
  b.box(-4, 4, top + 5, top + 5, zc, zc, iron);
  b.box(3, 3, top + 4, top + 6, zc, zc, iron);
  b.box(-4, -4, top + 4, top + 6, zc, zc, iron), b.box(-5, -5, top + 4, top + 6, zc, zc, iron);
}

function silo(b: Builder) {
  const { x, z, r, h } = FARM.silo;
  const cx = b.ix(x), cz = b.ix(z), R = Math.round(r / S), H = b.ix(h);
  // The feed room that joins it to the barn: plank walls, a roof sloping away from the barn's eave.
  const link: [number, number, number][] = [];
  b.box(32, cx - 5, 0, 11, cz - 4, cz + 6, byPart('barnRed', [0, -1], (px) => px >> 1)); // planks two cubes wide, along its long sides
  for (let px = 32; px <= cx - 5; px++)
    for (let pz = cz - 5; pz <= cz + 7; pz++) {
      b.set(px, 12, pz, paint('slate', 0));
      link.push([px, 12, pz]);
    }
  for (let dx = -R - 1; dx <= R + 1; dx++)
    for (let dz = -R - 1; dz <= R + 1; dz++) {
      const d = Math.hypot(dx + 0.5, dz + 0.5);
      if (d > R || d < R - 1.6) continue;
      for (let y = 0; y < H; y++) {
        const a = Math.floor((Math.atan2(dz + 0.5, dx + 0.5) + Math.PI) * 7);
        const band = y % 8 === 0;
        b.set(cx + dx, y, cz + dz, () => (band ? solid('stone', -1) : solid('trimWhite', a % 2 ? -1 : -2))); // hoops, and staves in two steps
      }
    }
  ellipsoid(b.g, [x + S / 2, h, z + S / 2], [r + 0.1, r * 0.8, r + 0.1], (_px, py) => (py < H ? null : solid('stone', 0)));
  b.capAll(cx - R - 2, cx + R + 2, H + 12, cz - R - 2, cz + R + 2, 0.95);
  b.blanket(link, 1);
  // Ladder and chute down the side that faces the yard.
  const iron = paint('iron', 1);
  const lz = cz + R + 1;
  for (let y = 0; y < H + 3; y++) {
    b.set(cx - 2, y, lz, iron), b.set(cx + 1, y, lz, iron);
    if (y % 3 === 0) b.box(cx - 1, cx, y, y, lz, lz, iron);
  }
}

/** A straight rail fence along x or z from a to b, with posts every 2 m, two rails and snow on top. */
function fenceRun(b: Builder, a: [number, number], c: [number, number], skip?: (x: number, z: number) => boolean) {
  // Posts a step under the lower rail, the upper rail a step over it; snow along the whole upper rail and on each post.
  // Where a run crosses the wendigo's zone (the field's fence does, for a few metres), it keeps the paint it had.
  const old = tone(T.beam, 31, [0.45, 0.85]);
  const along = a[0] === c[0] ? 'z' : 'x';
  const n = Math.round(Math.abs(along === 'x' ? c[0] - a[0] : c[1] - a[1]) / S);
  const sx = Math.sign(c[0] - a[0]), sz = Math.sign(c[1] - a[1]);
  for (let i = 0; i <= n; i++) {
    const x = b.ix(a[0]) + sx * i, z = b.ix(a[1]) + sz * i;
    if (skip?.(x * S, z * S)) continue;
    const kept = inWendigoZone(x * S, z * S), snow = kept ? oldSnow : cap;
    b.set(x, 2, z, kept ? old : paint('wood', 0));
    b.set(x, 4, z, kept ? old : paint('wood', 1));
    b.cap(x, 4, z, snow); // an even line of snow along the top rail
    if (i % 10 === 0) {
      b.box(x, x, 0, 5, z, z, kept ? old : paint('wood', -1));
      b.cap(x, 5, z, snow);
    }
  }
}

function paddock(b: Builder) {
  const P = FARM.paddock;
  fenceRun(b, [P.minX, P.minZ], [P.maxX, P.minZ]);
  fenceRun(b, [P.maxX, P.minZ], [P.maxX, P.maxZ]);
  fenceRun(b, [P.minX, P.maxZ], [P.maxX, P.maxZ], (x) => x > 15.6 && x < 18);
  fenceRun(b, [P.minX, P.minZ], [P.minX, P.maxZ]);
  // Run-in shed along the back: three plank walls, a roof sloping to the rear, the open side toward the yard.
  const x0 = b.ix(13), x1 = b.ix(20.4), z0 = b.ix(-13.4), z1 = b.ix(-10.2);
  // Planks two cubes wide, two steps in turn: along x on the back wall, along z on the sides.
  b.box(x0, x1, 0, 11, z0, z0, byPart('barnRed', [0, -1], (x) => x >> 1));
  b.box(x0, x0, 0, 13, z0, z1, byPart('barnRed', [0, -1], (_x, _y, z) => z >> 1));
  b.box(x1, x1, 0, 13, z0, z1, byPart('barnRed', [0, -1], (_x, _y, z) => z >> 1));
  b.box(x0, x0, 0, 13, z1, z1, paint('wood', -1));
  b.box(x1, x1, 0, 13, z1, z1, paint('wood', -1));
  const shed: [number, number, number][] = [];
  for (let z = z0 - 2; z <= z1 + 2; z++) {
    const y = 12 + Math.round(((z - z0) / (z1 - z0)) * 2);
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      b.set(x, y, z, () => solid('slate', [0, -1][x & 1]));
      shed.push([x, y, z]);
    }
  }
  b.blanket(shed);
  // Hay rack in the middle of the paddock.
  const rx = b.ix(16.6), rz = b.ix(-3.4);
  b.box(rx - 7, rx + 7, 3, 3, rz - 2, rz + 2, paint('wood', 0));
  for (const x of [rx - 7, rx + 7]) for (const z of [rz - 2, rz + 2]) b.box(x, x, 0, 5, z, z, paint('wood', -1));
  b.box(rx - 6, rx + 6, 4, 6, rz - 1, rz + 1, paint('hay', 0));
  b.capAll(rx - 5, rx + 5, 7, rz - 1, rz + 1, 0.6); // the whole top but the end column at each end, where the hay shows
}

function coop(b: Builder) {
  const { x, z } = FARM.coop;
  const x0 = b.ix(x - 1.8), x1 = b.ix(x + 1.8) - 1, z0 = b.ix(z - 1.3), z1 = b.ix(z + 1.3) - 1, W = 8, y0 = 2;
  // Clapboards a row each, two steps in turn; the top row under the roof a step darker (the eave's shade).
  const wall: Paint = (_x, py) => solid('coopYellow', (py % 2 ? 1 : 0) - (py >= y0 + W ? 1 : 0));
  for (const px of [x0, x1]) for (const pz of [z0, z1]) b.box(px, px, 0, y0 - 1, pz, pz, paint('wood', -1));
  b.box(x0, x1, y0, y0, z0, z1, paint('wood', 0));
  for (let px = x0; px <= x1; px++)
    for (let pz = z0; pz <= z1; pz++) {
      if (px !== x0 && px !== x1 && pz !== z0 && pz !== z1) continue;
      b.box(px, px, y0 + 1, y0 + W, pz, pz, wall);
    }
  const zc = (z0 + z1 + 1) / 2, half = (z1 - z0 + 1) / 2;
  const roof: [number, number, number][] = [];
  for (let px = x0 - 2; px <= x1 + 2; px++)
    for (let pz = z0 - 2; pz <= z1 + 2; pz++) {
      const d = Math.abs(pz + 0.5 - zc);
      const y = y0 + W + 1 + Math.floor((half + 1 - d) * 0.75);
      b.set(px, y, pz, () => solid('tractorRed', [0, -1][(pz >> 1) & 1])); // courses along the ridge
      if (px >= x0 && px <= x1) for (let f = y0 + W + 1; f < y; f++) if (px === x0 || px === x1) b.set(px, f, pz, wall);
      roof.push([px, y, pz]);
    }
  b.blanket(roof, 1);
  // Pop door and ramp on the side toward the barn path, a little window, and a nest box on the end.
  const dz = z1;
  b.box(x0 + 3, x0 + 5, y0 + 1, y0 + 4, dz + 1, dz + 1, paint('darkWood', 0));
  for (let k = 0; k < 4; k++) b.box(x0 + 3, x0 + 5, y0 - k, y0 - k, dz + 1 + k, dz + 1 + k, paint('wood', 0));
  b.box(x1 - 6, x1 - 3, y0 + 4, y0 + 6, dz + 1, dz + 1, white);
  b.box(x1 - 5, x1 - 4, y0 + 5, y0 + 5, dz + 1, dz + 1, paint('brass', 1));
  // The hens' run, fenced round from corner to corner, its gate toward the court; and the pig's sty on its north side,
  // with a low shelter in the corner out of the wind: plank walls on three sides, open to the south.
  const R = FARM.run, sz = FARM.sty.minZ;
  fenceRun(b, [R.minX, R.minZ], [R.minX, R.maxZ]);
  fenceRun(b, [R.minX, R.maxZ], [R.maxX, R.maxZ]);
  fenceRun(b, [R.maxX, R.maxZ], [R.maxX, R.minZ], (_x, pz) => pz > 9.9 && pz < 11.3);
  fenceRun(b, [R.maxX, R.minZ], [R.minX, R.minZ]);
  fenceRun(b, [R.minX, R.minZ], [R.minX, sz]);
  fenceRun(b, [R.minX, sz], [R.maxX, sz]);
  fenceRun(b, [R.maxX, sz], [R.maxX, R.minZ]);
  const sx0 = b.ix(R.minX + 0.6), sx1 = b.ix(R.minX + 3.4), sz0 = b.ix(sz + 0.6), sz1 = b.ix(sz + 2.6);
  const plank = byPart('wood', [0, -1], (px, _y, pz) => (px + pz) >> 1);
  b.box(sx0, sx1, 0, 5, sz0, sz0, plank);
  for (const px of [sx0, sx1]) b.box(px, px, 0, 6, sz0, sz1, plank);
  const sty: [number, number, number][] = [];
  for (let pz = sz0 - 1; pz <= sz1 + 1; pz++)
    for (let px = sx0 - 1; px <= sx1 + 1; px++) {
      const y = 6 + Math.round((pz - sz0) / (sz1 - sz0));
      b.set(px, y, pz, () => solid('roofBrown', [0, -1][px & 1]));
      sty.push([px, y, pz]);
    }
  b.blanket(sty);
}

/**
 * What the hens actually use, on the 0.1 m grid: a bed of straw spread out from the pop door and thinning into wisps at
 * its edge, a feed trough full of grain, a water pan with a skin of ice, and a perch.
 */
function henYard(b: Builder) {
  // One flat layer, a clean ellipse: straw, and a step darker in its trodden middle.
  const cx = FARM.coop.x, cz = FARM.coop.z + 3.1;
  for (let px = b.ix(cx - 4.2); px <= b.ix(cx + 3); px++)
    for (let pz = b.ix(cz - 1.7); pz <= b.ix(cz + 2.6); pz++) {
      const d = Math.hypot((px * F - cx + 0.6) / 3, (pz * F - cz - 0.4) / 2.1);
      if (d > 1.0) continue;
      b.set(px, 0, pz, paint('straw', d <= 0.45 ? -1 : 0));
    }
  // The feed trough: a long open box on two trestles, heaped with grain.
  const tx = b.ix(cx - 3.6), tz = b.ix(cz + 0.5), wood = paint('wood', 0);
  for (const leg of [tx, tx + 15]) b.box(leg, leg + 1, 0, 2, tz - 2, tz + 3, paint('wood', -1));
  b.box(tx - 1, tx + 16, 3, 3, tz - 1, tz + 2, wood);
  for (const side of [tz - 2, tz + 3]) b.box(tx - 1, tx + 16, 3, 4, side, side, wood);
  for (const end of [tx - 2, tx + 17]) b.box(end, end, 3, 4, tz - 2, tz + 3, wood);
  b.box(tx - 1, tx + 16, 4, 4, tz - 1, tz + 2, paint('brass', -1));
  // The water pan: a low dark rim round a frozen middle.
  const wx = b.ix(cx + 2.2), wz = b.ix(cz + 0.6);
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++) {
      const r = Math.hypot(dx, dz);
      if (r > 4.3) continue;
      b.set(wx + dx, 0, wz + dz, paint('stone', -1));
      b.set(wx + dx, 1, wz + dz, r > 3.2 ? paint('stone', 0) : paint('ice', 0));
    }
  // A perch: two posts and a rail, at hen height.
  const hx = b.ix(cx - 3.8), hz = b.ix(cz + 2.0);
  for (const leg of [hx, hx + 18]) b.box(leg, leg, 0, 5, hz, hz, paint('wood', -1));
  b.box(hx, hx + 18, 6, 6, hz, hz, paint('darkWood', 1));
}

/** A round bale lying with its axis along z. */
function roundBale(b: Builder, x: number, z: number, seed: number) {
  const cx = b.ix(x), cz = b.ix(z), R = 3.6, L = 3;
  const twist: Paint = (px, py, pz) => pick(T.hay, hash3(Math.round(Math.hypot(px - cx, py - R)), 0, pz >> 1, seed), [0.35, 0.85]);
  for (let px = -4; px <= 4; px++)
    for (let py = 0; py <= 8; py++)
      if (Math.hypot(px, py + 0.5 - R) <= R)
        for (let pz = -L; pz <= L; pz++) b.set(cx + px, py, cz + pz, twist);
  b.capAll(cx - 4, cx + 4, 9, cz - L, cz + L, 0.9, oldSnow); // the field's bales stand behind the line: as they were
}

/** A bare apple tree: forked branches, snow along the tops of the limbs. */
/** Where the orchard's branches end, for the baubles to hang from. Filled in as the trees are built. */
export const ORCHARD_TIPS: V3[] = [];

function bareTree(b: Builder, x: number, z: number, seed: number, size = 1) {
  const r = rng(seed * 31 + 7);
  // Trunk a step under the limbs, twigs a step over them; snow along every limb, none on the twigs or the trunk.
  const trunk = paint('darkWood', -1), limbs: [number, number, number][] = [];
  const limbPaint: Paint = (px, py, pz) => { limbs.push([px, py, pz]); return solid('darkWood', 0); };
  const trunkH = (1.4 + r() * 0.5) * size;
  line(b.g, [x, 0, z], [x, trunkH, z], trunk, true);
  line(b.g, [x + S, 0, z], [x + S, trunkH * 0.8, z], trunk, true);
  line(b.g, [x, 0, z + S], [x, trunkH * 0.7, z + S], trunk, true);
  const limb = (from: V3, a: number, up: number, len: number, depth: number) => {
    const to: V3 = [from[0] + Math.cos(a) * len, from[1] + up * len, from[2] + Math.sin(a) * len];
    line(b.g, from, to, depth === 0 ? paint('darkWood', 1) : limbPaint, true);
    if (depth === 0) {
      ORCHARD_TIPS.push(to);
      return;
    }
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) limb(to, a + (r() - 0.5) * 2, 0.35 + r() * 0.5, len * (0.6 + r() * 0.2), depth - 1);
  };
  const top: V3 = [x, trunkH, z];
  for (let i = 0; i < 4; i++) limb(top, i * 1.57 + r(), 0.5 + r() * 0.4, 1.1 * size, 2);
  for (const [px, py, pz] of limbs) b.cap(px, py, pz);
}

function fieldAndTrees(b: Builder) {
  const P = FARM.field;
  // Stubble: short rows of cut corn standing out of the snow, the plough lines running across the view.
  const stalk = tone(T.hay, 51, [0.5, 1]);
  for (let z = b.ix(P.minZ); z < b.ix(P.maxZ); z += 4)
    for (let x = b.ix(P.minX); x < b.ix(P.maxX); x++) {
      if (nearWendigo(x * S, z * S)) {
        // By the wendigo the stubble is the scatter it always was (its stand is pinned, voxel for voxel).
        const h = hash3(x, 0, z, 52);
        if (h < 0.5) continue;
        b.set(x, 0, z, stalk);
        if (h > 0.82) b.set(x, 1, z, stalk);
        continue;
      }
      // Drilled rows: two stalks and a gap, every sixth stalk left a little taller, each row set off from the last.
      const along = (((x + (z >> 2) * 2) % 6) + 6) % 6;
      if (along % 3 === 2) continue;
      b.set(x, 0, z, stalk);
      if (along === 0) b.set(x, 1, z, stalk);
    }
  fenceRun(b, [P.minX - 1, P.maxZ + 1], [P.maxX + 1, P.maxZ + 1], (x) => x > -2 && x < 2);
  [[-14, -21], [-8, -24], [-3, -19.5], [6, -23], [13, -20], [21, -24.5]].forEach(([x, z], i) => roundBale(b, x, z, 60 + i));
  // The windbreak, on this coarser grid: the tour only ever sees it from across the farm.
  FARM.windbreak.forEach(([x, z, h], i) => tieredPine((px, py, pz, c) => b.g.set(px, py, pz, c), (px, py, pz) => b.g.has(px, py, pz), b.ix(x), b.ix(z), 0, h, S, 6, pinePaint(i)));
}

/**
 * Where the snow has gathered, one step high with a clean outline: the berm of what slid off the barn's and the
 * farmhouse's windward eaves, standing clear of the wall, and the long drifts in the lee of the windbreak and of the
 * pines by the pond. Open rail fences gather none. They go with the roofs' snow, in the mesh that is not refined (a low
 * slab with its edges taken off reads as two stacked planks).
 */
function drifts(b: Builder) {
  const H = YARD.farmhouse;
  for (const [cx, cz, rx, rz] of [[-7.5, 1.5, 0.5, 5], [H.x - H.halfX - 1.1, H.z, 0.5, 4.2], [-31.6, 9, 1.4, 20], [30.6, 29.6, 1.5, 3.4]])
    for (let x = b.ix(cx - rx - 0.6); x <= b.ix(cx + rx + 0.6); x++)
      for (let z = b.ix(cz - rz - 0.6); z <= b.ix(cz + rz + 0.6); z++) {
        const mx = (x + 0.5) * S, mz = (z + 0.5) * S;
        if (((mx - cx) / rx) ** 2 + ((mz - cz) / rz) ** 2 < 1 && !underMicro(mx, mz)) b.caps.set(x, 0, z, CAP_SNOW); // a clean outline (docs/miniature/03, 3.1)
      }
}

/** The orchard's bare trees, right under the tour's wide shot. */
function orchard(b: Builder) {
  const O = FARM.orchard;
  for (let i = 0; i < O.cols; i++)
    for (let k = 0; k < O.rows; k++) {
      // Old trees: planted in rows once, some long gone, the rest grown out of line and to their own size.
      if (hash3(i, k, 0, 55) > 0.84) continue;
      const x = O.minX + i * O.gap + (hash3(i, k, 1, 56) - 0.5) * 3, z = O.minZ + k * O.gap + (hash3(i, k, 2, 57) - 0.5) * 3;
      bareTree(b, x, z, i * 7 + k + 1, 0.7 + hash3(i, k, 3, 58) * 0.55);
    }
}

/** The tractor on the 0.10 m grid, parked by the barn, its nose toward -x. */
function tractor(b: Builder) {
  const X = b.ix(FARM.tractor.x), Z = b.ix(FARM.tractor.z);
  // Hood, body and fenders in three reds; tyres a step under the seat's and grille's iron, axles and rods a step over.
  const red = paint('tractorRed', 0), iron = paint('iron', 1), tyre = paint('iron', -1), hub = paint('brass', 0), seat = paint('iron', 0);
  const wheel = (cx: number, cy: number, z0: number, z1: number, R: number) => {
    for (let x = -R; x <= R; x++)
      for (let y = -R; y <= R; y++) {
        const d = Math.hypot(x, y);
        if (d > R) continue;
        const lug = d > R - 2 && Math.floor((Math.atan2(y, x) + Math.PI) * 5) % 2 === 0;
        const rim = d < R * 0.32;
        for (let z = z0; z <= z1; z++) {
          if (d > R - 1 && !lug) continue;
          b.set(cx + x, cy + y, z, rim ? hub : tyre);
        }
      }
    // The tyre's foot, pressed a little into the snow: unsmoothed, its lowest row stood 0.05 m over the land.
    for (let x = -1; x <= 1; x++) for (let z = z0; z <= z1; z++) b.set(cx + x, cy - R, z, tyre);
  };
  // Each wheel's centre one cell under its radius: the tyre's bottom row is a gap between lugs, so a centre at the
  // radius left every tyre 0.1 m over the snow (Brian, 2026-11-09: "a lot of them are floating").
  for (const s of [-1, 1]) {
    wheel(X + 11, 7, s < 0 ? Z - 12 : Z + 8, s < 0 ? Z - 8 : Z + 12, 8);
    wheel(X - 13, 4, s < 0 ? Z - 10 : Z + 7, s < 0 ? Z - 7 : Z + 10, 5);
  }
  // Axles, and a post from the front axle up into the hood: nothing joined the wheels to the body.
  b.box(X + 10, X + 12, 6, 8, Z - 12, Z + 12, iron);
  b.box(X - 14, X - 12, 3, 5, Z - 10, Z + 10, iron);
  b.box(X - 14, X - 12, 5, 7, Z - 1, Z + 1, iron);
  b.box(X - 19, X + 6, 7, 14, Z - 4, Z + 4, red); // hood
  b.box(X - 19, X - 19, 8, 13, Z - 3, Z + 3, seat); // grille
  b.box(X - 20, X - 20, 12, 13, Z - 3, Z - 2, paint('brass', 1));
  b.box(X - 20, X - 20, 12, 13, Z + 2, Z + 3, paint('brass', 1));
  b.box(X + 6, X + 15, 6, 11, Z - 5, Z + 5, paint('tractorRed', -1)); // body
  b.box(X + 7, X + 16, 12, 13, Z - 9, Z - 5, paint('tractorRed', 1)); // fenders, run in to the body's sides
  b.box(X + 7, X + 16, 12, 13, Z + 5, Z + 9, paint('tractorRed', 1));
  b.box(X + 9, X + 13, 12, 13, Z - 2, Z + 2, seat); // seat
  b.box(X + 13, X + 14, 14, 18, Z - 2, Z + 2, seat);
  b.box(X + 5, X + 5, 15, 19, Z, Z, iron); // steering column
  b.box(X + 4, X + 6, 20, 20, Z - 2, Z + 2, iron);
  b.box(X - 12, X - 11, 15, 25, Z, Z + 1, iron); // exhaust
  b.capAll(X - 17, X + 6, 16, Z - 4, Z + 4, 0.85); // the hood's whole top but its front two columns
  b.capAll(X + 7, X + 16, 15, Z - 9, Z + 9, 0.55); // the fenders' whole tops
}

/** The land past the yard, on the 1 m grid: flat near the buildings, rising into the hills on every side. */
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** How high the land stands at a point: flat around the farm, rising to the back hills and at the far sides. */
export function landHeight(x: number, z: number): number {
  const back = backHillHeight(x, Math.min(z, -34)) * smooth((-29 - z) / 12);
  const side = Math.max(0, Math.abs(x) - 50);
  const rise = Math.min(13, side * 0.16) * (0.65 + 0.35 * Math.sin(x / 13 + z / 17));
  return Math.max(back, rise);
}

const TERRAIN_LIFT = -0.05;
function* terrainSteps(): Steps<BufferGeometry> {
  const g = new Grid(1);
  const yardCovers = (x: number, z: number) => {
    if (x < YARD.minX + 1 || x >= YARD.maxX - 1 || z < -7 + 1 || z >= YARD.maxZ) return false;
    if (z >= BARN.minZ - 1 && z < BARN.maxZ + 1 && Math.abs(x) >= BARN.maxX + 1) return false;
    if (z < BARN.minZ && Math.abs(x) >= 13) return false;
    return true;
  };
  // Behind the line z = -16 the land is painted as it was (voxel/snow.ts). In front of it the snow is one solid colour,
  // and between -16 and -10 the two are mixed, so no seam runs along the field's fence: the plan's one blend
  // (docs/miniature/03, section 7.1).
  const old = (x: number, y: number, z: number) => (inWendigoZone(x, z) ? asBefore(() => snowAt(x, y, z, 1, 71)) : snowAt(x, y, z, 1, 71));
  const open = solid('snow', 0);
  const landPaint = (x: number, y: number, z: number): [number, number, number] => {
    if (!SOLID_SNOW || z < -16 || inWendigoZone(x, z)) return old(x, y, z);
    if (z >= -10) return open;
    const o = old(x, y, z), t = (z + 16) / 6;
    return [o[0] + (open[0] - o[0]) * t, o[1] + (open[1] - o[1]) * t, o[2] + (open[2] - o[2]) * t];
  };
  for (let x = -150; x < 150; x++)
    for (let z = -60; z < YARD.maxZ; z++) {
      if (yardCovers(x, z)) continue;
      if (z < -34 && Math.abs(x) < 100) continue; // the back hills stand there already
      const top = Math.round(landHeight(x, z));
      for (let y = Math.max(-1, top - 3); y < top; y++) g.set(x, y, z, landPaint(x, y, z));
      if (top <= 0) g.set(x, -1, z, landPaint(x, -1, z));
    }
  yield;
  const land = yield* detailedSteps(g.map, 1, 0);
  yield;
  // It casts no shadow and only the start screen draws it: faces none of that screen's cameras can be in front of are left out.
  // Nor is any face that looks down: the land has no overhangs.
  const home = unseenFrom([{ screens: 'home', lift: TERRAIN_LIFT }]);
  const geo = buildGeometry(land.map, land.size, { unseen: (axis, sign, plane) => (axis === 1 && sign < 0) || home(axis, sign, plane), merge: (x, _y, z) => !sunReaches(x, z, 'home') });
  geo.translate(0, TERRAIN_LIFT, 0); // just under the yard's snow, so the two never share a plane
  return geo;
}

type ChunkOptions = BuildOptions | ((chunk: ChunkMap) => BuildOptions | undefined);

/** A model cut into 8 m chunks, one mesh each. `options` are the mesher's, for all of them or chosen chunk by chunk. */
export function chunks(map: Grid['map'], size: number, options?: ChunkOptions): BufferGeometry[] {
  return finish(chunksSteps(map, size, options));
}

/** `chunks`, a mesh a step. */
export function* chunksSteps(map: Grid['map'], size: number, options?: ChunkOptions): Steps<BufferGeometry[]> {
  return yield* each(chunkMaps(map, size), (m) => buildGeometry(m, size, typeof options === 'function' ? options(m) : options));
}

/** The 8 m chunks of a model, before they are meshed. */
export function chunkMaps(map: Grid['map'], size: number): ChunkMap[] {
  const byChunk = new Map<string, ChunkMap>();
  for (const [k, v] of map) {
    const ck = `${Math.floor((v.x * size) / CHUNK)},${Math.floor((v.z * size) / CHUNK)}`;
    let m = byChunk.get(ck);
    if (!m) byChunk.set(ck, (m = new ChunkMap(map)));
    Map.prototype.set.call(m, k, v);
  }
  return [...byChunk.values()];
}

/** A model's cubes for the review page: `plain` is snow meshed with no corner shade, `glow` is lit glass. */
export interface PieceGrid { vox: VoxelMap; size: number; plain?: boolean; glow?: boolean }
/**
 * One of the farm's models alone, as cubes, for the review page (`?preview=mini`; docs/miniature/04, section 7).
 * Development only: the game never calls it.
 */
export function farmPiece(name: string): PieceGrid[] | null {
  const big = new Builder(new Grid(S)), small = new Builder(new Grid(F));
  const of = (b: Builder): PieceGrid[] => [{ vox: b.g.map, size: b.g.size }, { vox: b.caps.map, size: b.g.size, plain: true }];
  if (name === 'barn') { barnRoof(big); return [{ vox: barnShellGrid().g.map, size: F }, { vox: barnWalls().map, size: F }, ...of(big)]; }
  if (name === 'silo') { silo(big); return of(big); }
  if (name === 'coop') { coop(big); return of(big); }
  if (name === 'orchardTree') { bareTree(big, 0, 0, 3); return of(big); }
  if (name === 'tractor') { tractor(small); return of(small); }
  return null;
}

export interface Farmstead {
  fine: BufferGeometry[]; props: BufferGeometry[]; shell: BufferGeometry; terrain: BufferGeometry; triangles: number;
  /** The micro layer (scene/farmMicro.ts): its own budget, not counted in `triangles`. */
  micro: FarmMicro;
}

/** The farm round the barn, built in steps (scene/slices.ts). */
export function buildFarmstead(): Farmstead {
  return finish(buildFarmsteadSteps());
}

export function* buildFarmsteadSteps(): Steps<Farmstead> {
  const shell = barnShell();
  yield;
  const big = new Builder(new Grid(S));
  barnRoof(big);
  yield;
  silo(big);
  yield;
  paddock(big);
  yield;
  coop(big);
  yield;
  orchard(big);
  yield;
  drifts(big);
  // What the tour gets close to is refined to the barn's 0.1 m, and the tractor, seen closest of all, to 0.05 m. The field
  // and the trees past it stay on their 0.2 m grid: the camera never comes near them and the fog takes the rest.
  const near = yield* structureSteps(big.g.map, S);
  yield;
  const far = new Builder(new Grid(S));
  fieldAndTrees(far);
  yield;
  const props = [...(yield* chunksSteps(near.map, near.size)), ...(yield* chunksSteps(far.g.map, S)), ...(yield* chunksSteps(big.caps.map, S, { ao: false })).map(plain)];
  const small = new Builder(new Grid(F));
  tractor(small);
  yield;
  const close = yield* structureSteps(small.g.map, F);
  yield;
  const litter = new Builder(new Grid(F));
  henYard(litter);
  yield;
  const fine = [...(yield* chunksSteps(close.map, close.size)), ...(yield* chunksSteps(litter.g.map, F))];
  const land = yield* terrainSteps();
  yield;
  // What stands on the farm, for the micro layer (what its objects stand against) and the ground's shade map. The
  // hens' straw bed is ground; what stands on it is not.
  for (const [grid, size] of [[big.g, S], [small.g, F], [litter.g, F]] as const) noteStructure(grid.map.values(), size);
  for (const [grid, size, keep] of [[big.g, S], [far.g, S], [small.g, F], [litter.g, F, (v: { y: number }) => v.y >= 1]] as const) noteShade(grid.map.values(), size, 0, keep);
  const micro = yield* buildFarmMicroSteps();
  yield* each([shell, land, ...props, ...fine], packGeometry); // half the bytes, the same picture (voxel/mesher.ts)
  return { fine, props, shell, terrain: land, triangles: [shell, land, ...props, ...fine].reduce((n, g) => n + triangles(g), 0), micro };
}
