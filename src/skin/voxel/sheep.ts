import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, IRIS, PUPIL, T, WHITE } from './palette';
import { box, cone, ellipsoid, Grid, hash3, line, norm, rng } from './primitives';
import type { Paint, RGB, V3 } from './primitives';

/** Characters are built on the 0.04 m grid (plan V3 Part 4.1). */
export const CHAR = 0.04;

export type Brows = 'neutral' | 'worried' | 'scared';
export type Mouth = 'flat' | 'smile' | 'grimace';
export type WoolLevel = 0 | 1 | 2 | 3 | 4;

/** One geometry per moving part, with the point it pivots about (the geometry is built around that pivot). */
export interface Part { geo: BufferGeometry; pivot: V3; voxels: number }

export interface SheepModel {
  /** One fleece per wool level 1..4, each built to fit the head, collar and legs, so nothing scales or interpenetrates. */
  wools: Record<1 | 2 | 3 | 4, Part>;
  /** Frost that settles on each fleece's upper surface while freezing. */
  frosts: Record<1 | 2 | 3 | 4, Part>;
  head: Part;            // head block, nose, cheeks
  tuft: Part;            // forehead tuft, hidden on a sheared sheep
  eyes: [Part, Part];    // whites, iris, pupil and catchlight; each scales about its own centre
  lids: Part;            // closed eyelids, shown for blinks and sleep
  ears: [Part, Part];
  legs: [Part, Part, Part, Part]; // front left, front right, back left, back right
  collar: Part;
  bell: Part;
  sheared: Part;         // the bare body at level 0, with stubble
  breath: Part;
  brows: Record<Brows, Part>;
  mouths: Record<Mouth, Part>;
  /** Voxels before face culling at wool level 2, for the plan's 9k to 14k budget. */
  voxels: number;
}

const tone = (t: readonly [string, string, string], seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);
/** Wool in patches a few voxels wide rather than per-voxel speckle, so the fleece reads as locks, not noise. */
const woolPatches = (seed: number): Paint => (x, y, z) => pick(T.wool, hash3(x >> 2, y >> 2, z >> 2, seed));

function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count };
}

/** Points spread evenly over an ellipsoid's surface above `minY` (−1..1 of the radius): a Fibonacci spiral with seeded jitter. */
function surfacePoints(n: number, c: V3, r: V3, seed: number, minY = -0.35): { p: V3; nrm: V3 }[] {
  const out: { p: V3; nrm: V3 }[] = [];
  const rand = rng(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const span = (1 - minY) / 2; // fraction of the sphere above minY
  const total = Math.ceil(n / span);
  for (let i = 0; out.length < n && i < total * 2; i++) {
    const y = 1 - ((i + 0.5) / total) * 2;
    if (y < minY) continue;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i + rand() * 0.4;
    const u: V3 = [Math.cos(th) * rad, y, Math.sin(th) * rad];
    out.push({ p: [c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], nrm: norm([u[0] / r[0], u[1] / r[1], u[2] / r[2]]) });
  }
  return out;
}

/** The face and collar sit in this hollow at the fleece's front, so the head always shows at every wool level. */
function inFaceHollow(xm: number, ym: number, zm: number): boolean {
  return zm >= 0.46 && (xm / 0.3) ** 2 + ((ym - 0.64) / 0.4) ** 2 <= 1;
}

interface WoolSpec {
  cy: number;
  r: V3;
  bumps: number;
  bumpR: number;
  /** Below the body's equator the fleece hangs as a bell down to minY, flaring to `flare` × the body radius at the hem. */
  skirt?: { minY: number; flare: number; rows: number[] };
  /** Level 4: the hem spreads out on the floor. */
  pool?: boolean;
}

const WOOL: Record<1 | 2 | 3 | 4, WoolSpec> = {
  1: { cy: 0.64, r: [0.36, 0.30, 0.48], bumps: 40, bumpR: 0.06 },
  2: { cy: 0.64, r: [0.43, 0.38, 0.56], bumps: 72, bumpR: 0.075 },
  3: { cy: 0.64, r: [0.47, 0.41, 0.60], bumps: 84, bumpR: 0.08, skirt: { minY: 0.2, flare: 1.08, rows: [0.42, 0.28] } },
  4: { cy: 0.66, r: [0.52, 0.45, 0.66], bumps: 96, bumpR: 0.09, skirt: { minY: 0.0, flare: 1.16, rows: [0.5, 0.34, 0.18] }, pool: true },
};

/** One fleece: a smooth body, a draped skirt where the level has one, rows of locks, scalloped hem, baked tail. */
function buildWool(level: 1 | 2 | 3 | 4, s: number): { grid: Grid; frost: Grid } {
  const spec = WOOL[level];
  const g = new Grid(s);
  const keep: Paint = (x, y, z) => (inFaceHollow(x * s, y * s, z * s) ? null : woolPatches(11 + level)(x, y, z));
  const [rx, ry, rz] = spec.r;
  const cy = spec.cy;
  ellipsoid(g, [0, cy, 0], spec.r, keep);

  if (spec.skirt) {
    // The bell: from the equator down, every row is an ellipse whose radius grows toward the hem.
    const { minY, flare } = spec.skirt;
    const yTop = Math.round(cy / s), yBot = Math.round(minY / s);
    for (let y = yBot; y <= yTop; y++) {
      const t = (yTop - y) / Math.max(1, yTop - yBot);
      const k = 1 + (flare - 1) * t ** 1.4;
      const ex = (rx * k) / s, ez = (rz * k) / s;
      for (let x = Math.floor(-ex); x <= Math.ceil(ex); x++)
        for (let z = Math.floor(-ez); z <= Math.ceil(ez); z++) {
          if (((x + 0.5) / ex) ** 2 + ((z + 0.5) / ez) ** 2 > 1) continue;
          const c = keep(x, y, z);
          if (c) g.set(x, y, z, c);
        }
    }
    // Scalloped hem: a bump every ~0.1 m around the rim, so the edge is wavy rather than a cut.
    const hemR: V3 = [rx * flare, 0, rz * flare];
    const per = Math.PI * (3 * (hemR[0] + hemR[2]) - Math.sqrt((3 * hemR[0] + hemR[2]) * (hemR[0] + 3 * hemR[2])));
    const nScallop = Math.round(per / 0.1);
    for (let i = 0; i < nScallop; i++) {
      const a = (i / nScallop) * Math.PI * 2;
      const out = 1 + (i % 2 ? 0.04 : 0);
      ellipsoid(g, [Math.cos(a) * hemR[0] * out, minY + 0.03, Math.sin(a) * hemR[2] * out], [0.06, 0.05, 0.06], keep);
    }
    if (spec.pool) {
      // Wool resting on the floor: a flat lip one voxel high just outside the hem.
      const ex = (rx * flare * 1.08) / s, ez = (rz * flare * 1.08) / s;
      for (let x = Math.floor(-ex); x <= Math.ceil(ex); x++)
        for (let z = Math.floor(-ez); z <= Math.ceil(ez); z++) {
          if (((x + 0.5) / ex) ** 2 + ((z + 0.5) / ez) ** 2 > 1) continue;
          if (hash3(x, 0, z, 90 + level) < 0.15) continue; // a ragged outer edge
          const c = keep(x, 0, z);
          if (c) g.set(x, 0, z, c);
        }
    }
    // Rows of locks down the skirt.
    for (const yRow of spec.skirt.rows) {
      const t = (cy - yRow) / (cy - minY);
      const k = 1 + (flare - 1) * t ** 1.4;
      const rr: V3 = [rx * k, 0, rz * k];
      const perRow = Math.PI * (rr[0] + rr[2]);
      const n = Math.round(perRow / 0.11);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (spec.skirt.rows.indexOf(yRow) % 2) * (Math.PI / n);
        const toneR = hash3(i, Math.round(yRow * 100), level, 7);
        const c = lin(toneR < 0.55 ? T.wool[0] : toneR < 0.9 ? T.wool[1] : T.wool[2]);
        ellipsoid(g, [Math.cos(a) * rr[0] * 0.97, yRow, Math.sin(a) * rr[2] * 0.97], [spec.bumpR * 0.9, spec.bumpR * 0.8, spec.bumpR * 0.9], (x, y, z) => (inFaceHollow(x * s, y * s, z * s) ? null : c));
      }
    }
  }

  // Locks over the body: evenly spaced rounded bumps, each one tone, half proud of the surface.
  for (const [i, { p }] of surfacePoints(spec.bumps, [0, cy, 0], [rx * 0.95, ry * 0.95, rz * 0.95], 21 + level, spec.skirt ? -0.05 : -0.45).entries()) {
    const toneR = hash3(i, level, 0, 5);
    const c: RGB = lin(toneR < 0.55 ? T.wool[0] : toneR < 0.9 ? T.wool[1] : T.wool[2]);
    ellipsoid(g, p, [spec.bumpR, spec.bumpR * 0.85, spec.bumpR], (x, y, z) => (inFaceHollow(x * s, y * s, z * s) ? null : c));
  }

  // Tail: a small puff on the rump, part of the fleece so it never floats.
  ellipsoid(g, [0, cy + 0.08, -(rz + 0.03)], [0.11, 0.1, 0.1], woolPatches(23 + level));

  // Frost for the freeze: 30 flakes on the top surface.
  const frost = new Grid(s);
  const rf = rng(57 + level);
  for (let i = 0; i < 30; i++) {
    const a = rf() * Math.PI * 2, b = rf() * 0.9;
    const x = Math.round((Math.cos(a) * b * rx) / s), z = Math.round((Math.sin(a) * b * rz) / s);
    let y = Math.round((cy + ry * 1.3) / s);
    while (y > 0 && !g.has(x, y, z)) y--;
    frost.set(x, y + 1, z, lin(T.ice[0]));
  }
  return { grid: g, frost };
}

let cached: SheepModel | null = null;

/** The default sheep (plan V3 Part 5): one model for every player, built once and shared. */
export function sheepModel(): SheepModel {
  if (cached) return cached;
  const s = CHAR;
  const i = (m: number) => Math.round(m / s);

  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  for (const level of [1, 2, 3, 4] as const) {
    const { grid, frost } = buildWool(level, s);
    wools[level] = part(grid, [0, 0, 0]);
    frosts[level] = part(frost, [0, 0, 0]);
  }

  // Head: a 7 x 9 x 7 block (x -0.14..0.14, y 0.58..0.96, z 0.50..0.80) with its back edges knocked off.
  // The face is the front slice z = 19; every feature sits one layer proud of it at z = 20.
  const head = new Grid(s);
  box(head, [-0.14, 0.58, 0.5], [0.14, 0.96, 0.8], tone(T.face, 31));
  const zBack = i(0.5), zFront = i(0.8) - 1, rowBottom = i(0.58), rowTop = i(0.96) - 1;
  for (let y = rowBottom; y <= rowTop; y++) { head.del(-3, y, zBack); head.del(3, y, zBack); }
  for (let x = -3; x <= 3; x++) { head.del(x, rowTop, zBack); head.del(x, rowBottom, zBack); head.del(x, rowTop, zFront); }
  const F = zFront + 1; // the proud layer
  // Nose: a pink patch with two darker nostrils. Cheeks: blush either side of it.
  for (let x = -1; x <= 1; x++) for (let y = 17; y <= 18; y++) head.set(x, y, F, lin(T.pink[1]));
  head.set(-1, 17, F, lin(T.pink[2]));
  head.set(1, 17, F, lin(T.pink[2]));
  for (const sx of [-1, 1]) for (const dx of [2, 3]) for (let y = 17; y <= 18; y++) head.set(sx * dx, y, F, lin(T.pink[0]));
  const headPivot: V3 = [0, 0.66, 0.5];
  // Forehead tuft on top of the head, its own part.
  const tuft = new Grid(s);
  ellipsoid(tuft, [0, 1.0, 0.48], [0.2, 0.11, 0.17], woolPatches(37), 0.08, 11);

  // Eyes: a 3 x 3 white with a 2 x 2 iris toward the nose, pupils below, a catchlight upper left.
  const eyes = ([-1, 1] as const).map((sx) => {
    const eye = new Grid(s);
    const ex = sx * 2, ey = 20;
    for (let x = ex - 1; x <= ex + 1; x++) for (let y = ey - 1; y <= ey + 1; y++) eye.set(x, y, F, lin(WHITE));
    const ix = sx > 0 ? ex - 1 : ex;
    for (let x = ix; x <= ix + 1; x++) {
      eye.set(x, ey, F, lin(IRIS));
      eye.set(x, ey - 1, F, lin(PUPIL));
    }
    eye.set(ix, ey, F, lin(WHITE));
    return part(eye, [ex * s, ey * s, F * s]);
  }) as [Part, Part];

  // Brows above the eyes (row 22); worried lifts the inner ends, scared is high and thick.
  const brows = {} as Record<Brows, Part>;
  for (const kind of ['neutral', 'worried', 'scared'] as Brows[]) {
    const g = new Grid(s);
    for (const sx of [-1, 1]) {
      for (const dx of [1, 2, 3]) g.set(sx * dx, 22, F, lin(T.face[2]));
      if (kind === 'worried') g.set(sx * 1, 23, F, lin(T.face[2]));
      if (kind === 'scared') for (const dx of [1, 2]) g.set(sx * dx, 23, F, lin(T.face[2]));
    }
    brows[kind] = part(g, headPivot);
  }
  // Mouths at the chin: flat and smile on row 16; the grimace zigzags over rows 15..16 with two teeth.
  const mouths = {} as Record<Mouth, Part>;
  for (const kind of ['flat', 'smile', 'grimace'] as Mouth[]) {
    const g = new Grid(s);
    if (kind === 'grimace') {
      for (let x = -3; x <= 3; x++) g.set(x, x % 2 === 0 ? 15 : 16, F, lin(T.face[2]));
      g.set(-2, 16, F, lin(WHITE));
      g.set(2, 16, F, lin(WHITE));
    } else {
      for (let x = -2; x <= 2; x++) g.set(x, 16 + (kind === 'smile' && Math.abs(x) === 2 ? 1 : 0), F, lin(T.face[2]));
    }
    mouths[kind] = part(g, headPivot);
  }
  // Lids: a dark 3 x 3 over each eye, one layer further out, with a lash line.
  const lids = new Grid(s);
  for (const sx of [-1, 1]) {
    for (let x = sx * 2 - 1; x <= sx * 2 + 1; x++) {
      for (let y = 19; y <= 21; y++) lids.set(x, y, F + 1, lin(T.face[0]));
      lids.set(x, 19, F + 1, lin(T.face[2]));
    }
  }

  // Ears: tapered, two voxels thick, growing out from the head's sides at eye height; the inner face is pink.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const pivot: V3 = [sx * 0.16, 0.84, 0.6];
    const px = i(pivot[0]), pz = i(pivot[2]);
    for (let k = 0; k < 4; k++) {
      const hw = k < 3 ? 1 : 0;
      const x = px + sx * k;
      for (let z = pz - 1 - hw; z <= pz + hw; z++) {
        g.set(x, 21, z, pick(T.face, hash3(x, 1, z, 41)));
        g.set(x, 20, z, lin(T.pink[1]));
      }
    }
    return part(g, pivot);
  }) as [Part, Part];

  // Legs with a knee notch, and split hooves.
  const legs = ([[-0.19, 0.34], [0.19, 0.34], [-0.19, -0.3], [0.19, -0.3]] as const).map(([lx, lz]) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0.04, lz - 0.04], [lx + 0.04, 0.34, lz + 0.04], tone(T.face, 43));
    g.del(i(lx + 0.04) - 1, i(0.18), i(lz + 0.04) - 1); // knee notch
    box(g, [lx - 0.05, 0, lz - 0.05], [lx + 0.05, 0.06, lz + 0.05], tone(T.hoof, 45));
    for (let y = 0; y < i(0.06); y++) g.del(i(lx), y, i(lz + 0.05) - 1); // groove
    return part(g, [lx, 0.34, lz]);
  }) as [Part, Part, Part, Part];

  // Collar: a ring around the neck at the mouth of the face hollow, with a buckle; the bell hangs under the chin.
  const collar = new Grid(s);
  for (let k = 0; k < 160; k++) {
    const a = (k / 160) * Math.PI * 2;
    const x = Math.round((0.29 * Math.cos(a)) / s), y = Math.round((0.6 + 0.2 * Math.sin(a)) / s);
    for (const z of [12, 13]) collar.set(x, y, z, pick(T.collar, hash3(x, y, z, 47)));
  }
  box(collar, [-0.06, 0.37, 0.48], [0.06, 0.43, 0.56], tone(T.brass, 49));
  const bell = new Grid(s);
  ellipsoid(bell, [0, 0.31, 0.5], [0.05, 0.05, 0.05], tone(T.brass, 51));
  bell.set(0, i(0.25), i(0.5), lin(T.brass[2])); // clapper
  bell.set(-1, i(0.31), i(0.55), lin(T.face[2])); // slit
  bell.set(0, i(0.31), i(0.55), lin(T.face[2]));

  const sheared = new Grid(s);
  ellipsoid(sheared, [0, 0.58, -0.02], [0.32, 0.27, 0.46], (x, y, z) => pick(T.skin, hash3(x >> 1, y >> 1, z >> 1, 53)));
  for (const v of [...sheared.map.values()]) {
    if (hash3(v.x, v.y, v.z, 55) < 0.08 && !sheared.has(v.x, v.y + 1, v.z)) sheared.set(v.x, v.y + 1, v.z, lin(T.wool[0])); // stubble
  }

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, i(0.72) + y, i(0.86) + z, lin(WHITE));

  const parts = {
    wools, frosts, head: part(head, headPivot), tuft: part(tuft, headPivot), eyes, lids: part(lids, headPivot), ears, legs,
    collar: part(collar, headPivot), bell: part(bell, [0, 0.36, 0.5]), sheared: part(sheared, [0, 0.58, -0.02]),
    breath: part(breath, [0, 0.72, 0.86]), brows, mouths,
  };
  const voxels = wools[2].voxels + parts.head.voxels + parts.tuft.voxels + eyes[0].voxels + eyes[1].voxels + ears[0].voxels + ears[1].voxels
    + legs.reduce((n, l) => n + l.voxels, 0) + parts.collar.voxels + parts.bell.voxels;
  cached = { ...parts, voxels };
  return cached;
}

/** Ice block parts for the freeze sequence: nine icicles hanging from the top edge and snow in scattered patches on top. */
export function iceDressing(size: V3): { icicles: BufferGeometry; cap: BufferGeometry } {
  const s = CHAR;
  const [w, h, d] = size;
  const ic = new Grid(s);
  const r = rng(61);
  for (let k = 0; k < 9; k++) {
    const x = -w / 2 + 0.08 + (k / 8) * (w - 0.16);
    const len = 0.08 + r() * 0.14;
    cone(ic, [x, h / 2, d / 2], 0.035, len, -1, (xx, yy, zz) => pick(T.ice, hash3(xx, yy, zz, 63), [0.5, 0.85]));
  }
  // Snow lies in a few drifts, one voxel deep, with bare ice between them: patches of 4 x 4 voxels chosen by a
  // coarse hash, thinned at their edges, and a little deeper only where two drifts meet.
  const cap = new Grid(s);
  const top = Math.round(h / 2 / s);
  for (let x = Math.round(-w / 2 / s); x < Math.round(w / 2 / s); x++)
    for (let z = Math.round(-d / 2 / s); z < Math.round(d / 2 / s); z++) {
      const patch = hash3(x >> 2, 0, z >> 2, 65) < 0.42;
      if (!patch) continue;
      const inner = hash3((x >> 2) + 1, 0, z >> 2, 65) < 0.42 || hash3(x >> 2, 0, (z >> 2) + 1, 65) < 0.42;
      if (hash3(x, 1, z, 67) < (inner ? 0.12 : 0.3)) continue; // ragged edges
      cap.set(x, top, z, pick(T.snow, hash3(x, 2, z, 69), [0.7, 0.95]));
      if (inner && hash3(x, 3, z, 71) < 0.08) cap.set(x, top + 1, z, lin(T.snow[0]));
    }
  return { icicles: buildGeometry(ic.map, s), cap: buildGeometry(cap.map, s) };
}

/** A wind curl: a flat voxel spiral of radius 0.25 m, 1 voxel thick. */
export function windCurl(): BufferGeometry {
  const g = new Grid(CHAR);
  for (let k = 0; k <= 90; k++) {
    const a = (k / 90) * Math.PI * 3.2;
    const rr = 0.25 * (1 - k / 140);
    line(g, [Math.cos(a) * rr, 0, Math.sin(a) * rr], [Math.cos(a) * rr, 0, Math.sin(a) * rr], () => lin(T.ice[0]));
  }
  return buildGeometry(g.map, CHAR);
}

/** A small wool tuft (about 40 voxels) for the effects. */
export function tuftGeometry(seed = 71): BufferGeometry {
  const g = new Grid(CHAR);
  ellipsoid(g, [0, 0, 0], [0.09, 0.07, 0.09], woolPatches(seed), 0.2, seed);
  return buildGeometry(g.map, CHAR);
}
