import { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, IRIS, PUPIL, T, WHITE, WOLF_EYE } from './palette';
import type { Tone } from './palette';
import { box, ellipsoid, Grid, hash3, helix, line, norm, ring, rng, taperedBox } from './primitives';
import type { Paint, V3 } from './primitives';
import { CHAR } from './sheep';
import type { Part } from './sheep';

const s = CHAR;
const RED = '#C24E45';
const tone = (t: Tone, seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);

function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count };
}

/** Index of the frontmost (+z) voxel in column (x, y), or null when the column is empty. */
function frontZ(g: Grid, x: number, y: number): number | null {
  for (let z = 80; z > -80; z--) if (g.has(x, y, z)) return z;
  return null;
}
/** Sets voxels one layer in front of the surface of `src` at each (x, y), into `dst`. */
function onFront(dst: Grid, src: Grid, px: [number, number][], hex: string) {
  for (const [x, y] of px) {
    const z = frontZ(src, x, y);
    if (z !== null) dst.set(x, y, z + 1, lin(hex));
  }
}

// ---------------------------------------------------------------- wolf

export interface WolfModel { body: Part; head: Part; tail: Part; legs: [Part, Part, Part, Part]; eyes: Part }
let wolf: WolfModel | null = null;

/** Lean grey wolf, ~1.1 m long and ~0.7 m at the shoulder; front is +z, origin between the feet. */
export function wolfModel(): WolfModel {
  if (wolf) return wolf;
  const fur: Paint = (x, y, z) =>
    y * s < 0.49 || (z * s > 0.3 && y * s < 0.62) ? pick(T.wolf, hash3(x, y, z, 3) * 0.5) : pick(T.wolf, hash3(x, y, z, 5), [0.15, 0.8]);

  const body = new Grid(s);
  ellipsoid(body, [0, 0.56, -0.04], [0.15, 0.15, 0.34], fur, 0.06, 7);
  ellipsoid(body, [0, 0.58, 0.2], [0.16, 0.17, 0.17], fur, 0.06, 9);
  ellipsoid(body, [0, 0.66, 0.34], [0.1, 0.11, 0.1], fur);

  const headPivot: V3 = [0, 0.66, 0.36];
  const head = new Grid(s);
  ellipsoid(head, [0, 0.74, 0.46], [0.1, 0.1, 0.11], tone(T.wolf, 11, [0.2, 0.8]));
  box(head, [-0.06, 0.64, 0.5], [0.06, 0.74, 0.68], (x, y, z) => (y * s < 0.68 ? lin(T.wolf[0]) : pick(T.wolf, hash3(x, y, z, 13), [0.3, 0.9])), 1);
  box(head, [-0.04, 0.7, 0.68], [0.04, 0.74, 0.72], tone(T.hoof, 15)); // nose
  for (const x of [-1, 1]) head.set(x, head.i(0.64) - 1, head.i(0.64), lin(WHITE)); // fangs
  for (const sx of [-1, 1]) taperedBox(head, [sx * 0.06, 0.8, 0.42], [0.12, 0.16, 0.08], 0.25, tone(T.wolf, 17, [0.1, 0.7]));
  for (const v of [...head.map.values()]) // inner ear: the middle column of each ear's front face
    if (v.z === head.i(0.44) && v.y >= 21 && v.y <= 22 && head.has(v.x - 1, v.y, v.z) && head.has(v.x + 1, v.y, v.z)) v.c = lin(T.pink[2]);
  const eyes = new Grid(s);
  onFront(eyes, head, [[1, 19], [1, 20], [-2, 19], [-2, 20]], WOLF_EYE);

  const tailPivot: V3 = [0, 0.62, -0.36];
  const tail = new Grid(s);
  const tailFur: Paint = (x, y, z) => (z * s < -0.64 ? lin(T.wolf[0]) : pick(T.wolf, hash3(x, y, z, 19), [0.2, 0.75]));
  const at = (t: number): V3 => [0, 0.62 - 0.2 * t, -0.38 - 0.3 * t];
  const rad = (t: number) => 0.05 + 0.04 * Math.sin(Math.PI * Math.min(1, t * 1.2));
  for (let i = 0; i <= 6; i++) {
    const r = rad(i / 6);
    ellipsoid(tail, at(i / 6), [r, r, r * 1.2], tailFur, 0.15, 21 + i);
  }
  const rt = rng(23);
  for (let i = 0; i < 10; i++) {
    const t = 0.15 + rt() * 0.8, a = rt() * Math.PI * 2, c = at(t), r = rad(t);
    helix(tail, [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]], [Math.cos(a), Math.sin(a), -0.3], tailFur);
  }

  const legs = ([[-0.08, 0.24], [0.08, 0.24], [-0.08, -0.26], [0.08, -0.26]] as const).map(([lx, lz]) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0.04, lz - 0.04], [lx + 0.04, 0.46, lz + 0.04], tone(T.wolf, 25, [0.2, 0.8]));
    box(g, [lx - 0.04, 0, lz - 0.04], [lx + 0.04, 0.04, lz + 0.08], tone(T.wolf, 27, [0, 0.3]));
    return part(g, [lx, 0.46, lz]);
  }) as [Part, Part, Part, Part];

  wolf = { body: part(body, [0, 0.56, 0]), head: part(head, headPivot), tail: part(tail, tailPivot), legs, eyes: part(eyes, headPivot) };
  return wolf;
}

let eyePair: BufferGeometry | null = null;
/** Two glowing 3 x 2 eye boxes, 0.12 m apart, centred on the origin (the dark side door). */
export function wolfEyes(): BufferGeometry {
  if (eyePair) return eyePair;
  const g = new Grid(s);
  for (const x0 of [0, 6]) for (let x = x0; x < x0 + 3; x++) for (let y = 0; y < 2; y++) g.set(x, y, 0, lin(WOLF_EYE));
  eyePair = buildGeometry(g.map, s).translate(-4.5 * s, -s, -s / 2);
  return eyePair;
}

// ---------------------------------------------------------------- sheepdog

export interface SheepdogModel { body: Part; head: Part; tail: Part; ears: [Part, Part]; legs: [Part, Part, Part, Part] }
let dog: SheepdogModel | null = null;

/** Black-and-white collie with a red bandana, ~0.8 m long, built sitting upright; front is +z. */
export function sheepdogModel(): SheepdogModel {
  if (dog) return dog;
  const black = tone(T.face, 31), white = tone(T.wool, 33);
  const above0: (p: Paint) => Paint = (p) => (x, y, z) => (y < 0 ? null : p(x, y, z));
  const coat: Paint = (x, y, z) => {
    const Y = y * s, axis = -0.1 + 0.2 * Math.min(1, Math.max(0, (Y - 0.2) / 0.3));
    return Y > 0.2 && z * s > axis + 0.05 ? white(x, y, z) : black(x, y, z);
  };

  const body = new Grid(s);
  ellipsoid(body, [0, 0.16, -0.12], [0.16, 0.15, 0.18], above0(coat), 0.06, 35);
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    ellipsoid(body, [0, 0.2 + 0.3 * t, -0.1 + 0.2 * t], [0.13 - 0.02 * t, 0.12, 0.12 - 0.02 * t], coat, 0.05, 37);
  }
  const red = tone([RED, T.collar[1], T.collar[2]], 39);
  ring(body, [0, 0.54, 0.1], 0.13, 0.13, 0.06, red);
  for (let r = 0; r < 4; r++) for (let x = -3 + r; x <= 2 - r; x++) { // the bandana's point on the chest
    const y = body.i(0.52) - r, z = frontZ(body, x, y);
    if (z !== null) body.set(x, y, z + 1, red(x, y, z + 1)!);
  }

  const headPivot: V3 = [0, 0.58, 0.1];
  const head = new Grid(s);
  ellipsoid(head, [0, 0.7, 0.12], [0.11, 0.1, 0.1], (x, y, z) => ((x === -1 || x === 0) && z * s > 0.14 ? white(x, y, z) : black(x, y, z)));
  box(head, [-0.06, 0.6, 0.18], [0.06, 0.68, 0.32], white, 1); // muzzle
  box(head, [-0.04, 0.66, 0.32], [0.04, 0.7, 0.34], tone(T.hoof, 41)); // nose
  onFront(head, head, [[1, 18], [-2, 18]], IRIS);
  head.set(1, 19, (frontZ(head, 1, 18) ?? 0) - 1, lin(PUPIL));

  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const x0 = sx > 0 ? 0.12 : -0.16;
    box(g, [x0, 0.58, 0.06], [x0 + 0.04, 0.8, 0.18], black);
    box(g, [sx > 0 ? 0.08 : -0.12, 0.76, 0.06], [sx > 0 ? 0.12 : -0.08, 0.82, 0.16], black); // fold over the skull
    return part(g, [sx * 0.12, 0.8, 0.12]);
  }) as [Part, Part];

  const tailPivot: V3 = [0, 0.1, -0.28];
  const tail = new Grid(s);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    ellipsoid(tail, [0, 0.08 + 0.14 * t * t, -0.3 - 0.22 * t], [0.05, 0.05, 0.06], t > 0.75 ? white : black, 0.1, 43 + i);
  }

  const legPaint: Paint = (x, y, z) => (y * s < 0.2 ? white(x, y, z) : black(x, y, z));
  const front = ([-0.06, 0.06] as const).map((lx) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0.04, 0.1], [lx + 0.04, 0.4, 0.18], legPaint);
    box(g, [lx - 0.04, 0, 0.1], [lx + 0.04, 0.04, 0.22], white);
    return part(g, [lx, 0.4, 0.14]);
  });
  const back = ([-0.12, 0.12] as const).map((lx) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0, 0], [lx + 0.04, 0.06, 0.14], white);
    return part(g, [lx, 0.06, 0]);
  });

  dog = { body: part(body, [0, 0.3, 0]), head: part(head, headPivot), tail: part(tail, tailPivot), ears, legs: [front[0], front[1], back[0], back[1]] };
  return dog;
}

// ---------------------------------------------------------------- shears

export interface ShearsModel { bladeA: Part; bladeB: Part }
let shears: ShearsModel | null = null;

/** Big shears ~0.6 m long, blades along +z, handles toward -z; each blade rotates about y at the screw (origin). */
export function shearsModel(): ShearsModel {
  if (shears) return shears;
  const handle = tone([RED, T.collar[1], T.collar[2]], 51);
  const [bladeA, bladeB] = ([1, -1] as const).map((sx, layer) => {
    const g = new Grid(s);
    for (let i = 0; i < 9; i++) {
      const w = Math.max(1, Math.round(3 * (1 - i / 10)));
      for (let k = 0; k < w; k++) {
        const x = sx > 0 ? k - 1 : 1 - k;
        g.set(x, layer, i, lin(k === w - 1 && w > 1 ? T.stone[1] : T.stone[0])); // light edge, mid spine
      }
    }
    const y = layer * s;
    line(g, [0, y, -0.04], [-sx * 0.08, y, -0.14], handle);
    ring(g, [-sx * 0.1, y, -0.22], 0.06, 0.08, 0.02, handle);
    ring(g, [-sx * 0.1, y, -0.22], 0.08, 0.1, 0.02, handle);
    if (layer) g.set(0, 2, 0, lin(T.brass[1])); // screw head
    return part(g, [s / 2, 0, s / 2]);
  });
  shears = { bladeA, bladeB };
  return shears;
}

// ---------------------------------------------------------------- tuft, heap

/** A small wool tuft (~40 to 80 voxels) around the origin. */
export function tuftGeometry(seed: number): BufferGeometry {
  const g = new Grid(s);
  ellipsoid(g, [0, 0, 0], [0.1, 0.08, 0.1], tone(T.wool, seed), 0.2, seed);
  return buildGeometry(g.map, s);
}

/** Evenly spread points on the upper part of an ellipsoid, with outward normals (Fibonacci spiral, seeded jitter). */
function surfacePoints(n: number, c: V3, r: V3, seed: number, minY = 0): { p: V3; nrm: V3 }[] {
  const out: { p: V3; nrm: V3 }[] = [];
  const rand = rng(seed);
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const y = 1 - ((i + 0.5) / (n * 1.4)) * 2;
    if (y < minY) continue;
    const rad = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i + rand() * 0.4;
    const u: V3 = [Math.cos(th) * rad, y, Math.sin(th) * rad];
    out.push({ p: [c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], nrm: norm([u[0] / r[0], u[1] / r[1], u[2] / r[2]]) });
  }
  return out;
}

const heaps = new Map<number, BufferGeometry>();
/** The wool heap on the barn floor: level 0 empty .. level 8 about 1.4 m wide and 0.8 m tall; origin at the floor centre. */
export function heapModel(): (level: number) => BufferGeometry {
  return (level) => {
    const L = Math.max(0, Math.min(8, Math.round(level)));
    let geo = heaps.get(L);
    if (geo) return geo;
    const g = new Grid(s);
    if (L > 0) {
      const k = 0.35 + 0.65 * (L / 8), W = 1.4 * k, H = 0.8 * k;
      const wool: Paint = (x, y, z) => (y < 0 ? null : pick(T.wool, hash3(x, y, z, 61 + L)));
      const coreR: V3 = [0.4 * W, 0.75 * H, 0.4 * W];
      ellipsoid(g, [0, 0, 0], coreR, wool, 0.08, 63);
      for (const { p } of surfacePoints(6 + L * 2, [0, 0, 0], coreR, 65 + L, 0.05)) ellipsoid(g, p, [0.16 * k, 0.13 * k, 0.16 * k], wool, 0.12, 67);
      const curl: Paint = (x, y, z) => (y < 0 ? null : pick(T.wool, hash3(x, y, z, 69) * 0.9));
      const outer: V3 = [coreR[0] + 0.12 * k, coreR[1] + 0.12 * k, coreR[2] + 0.12 * k];
      for (const { p, nrm } of surfacePoints(10 + L * 6, [0, 0, 0], outer, 71 + L, 0.05)) helix(g, p, nrm, curl);
    }
    geo = buildGeometry(g.map, s);
    heaps.set(L, geo);
    return geo;
  };
}

// ---------------------------------------------------------------- icicle

let icicle: { ice: Part; drip: BufferGeometry } | null = null;
/** The speaker's icicle timer: 20 voxels long, hanging down from its pivot at the top; plus a 1-voxel drip. */
export function icicleModel(): { ice: Part; drip: BufferGeometry } {
  if (icicle) return icicle;
  const g = new Grid(s);
  for (let i = 0; i < 20; i++) {
    const rr = 2.5 * (1 - i / 20);
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++)
      if (x * x + z * z <= Math.max(0.3, rr * rr)) g.set(x, -i, z, x === 0 ? lin(T.ice[0]) : pick(T.ice, hash3(x, i, z, 81), [0, 0.6]));
  }
  const d = new Grid(s);
  d.set(0, 0, 0, lin(T.ice[0]));
  icicle = { ice: part(g, [s / 2, s, s / 2]), drip: buildGeometry(d.map, s).translate(-s / 2, -s / 2, -s / 2) };
  return icicle;
}

// ---------------------------------------------------------------- digits

const FONT: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};
const digits = new Map<string, BufferGeometry>();
/** Voxel digits (5 x 7 font, 2 voxels deep, lit front and darker back) centred on the origin. Unknown characters are blanks. */
export function digitGeometry(text: string, cell = 0.06): BufferGeometry {
  const key = `${text}@${cell}`;
  let geo = digits.get(key);
  if (geo) return geo;
  const g = new Grid(cell);
  [...text].forEach((ch, n) => {
    const rows = FONT[ch];
    if (rows) rows.forEach((row, r) => [...row].forEach((bit, c) => {
      if (bit !== '1') return;
      g.set(n * 6 + c, 6 - r, 1, lin(T.lantern[0]));
      g.set(n * 6 + c, 6 - r, 0, lin(T.lantern[2]));
    }));
  });
  const width = Math.max(0, text.length * 6 - 1);
  geo = buildGeometry(g.map, cell).translate((-width * cell) / 2, -3.5 * cell, -cell);
  digits.set(key, geo);
  return geo;
}
