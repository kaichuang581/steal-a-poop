import { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { T, WHITE, WOLF_EYE } from './palette';
import { shade, shadeRaw } from './paint';
import type { Tone } from './palette';
import { box, ellipsoid, Grid, hash3, helix, line, norm, ring, rng, taperedBox } from './primitives';
import type { Paint, V3 } from './primitives';
import { step } from './animals/rig';
import { CHAR } from './sheep';
import type { Part } from './sheep';

const s = CHAR;
const RED = '#C24E45';
/** One solid colour a part, the tone's middle value, not desaturated (docs/miniature/06, section 3.2): it was a random tone a cube. */
const pick = (t: Tone, _r?: number, _w?: readonly [number, number]) => shade(t[1]);
const tone = (t: Tone, _seed: number, _w?: [number, number]): Paint => () => pick(t);
/** The lowest row of a body, a step darker (docs/miniature/06, section 3). */
const belly = (g: Grid) => { const low = Math.min(...[...g.map.values()].map((v) => v.y)); step(g, -1, (v) => v.y === low); };

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
    if (z !== null) dst.set(x, y, z + 1, shade(hex));
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
  belly(body);

  const headPivot: V3 = [0, 0.66, 0.36];
  const head = new Grid(s);
  ellipsoid(head, [0, 0.74, 0.46], [0.1, 0.1, 0.11], tone(T.wolf, 11, [0.2, 0.8]));
  box(head, [-0.06, 0.64, 0.5], [0.06, 0.74, 0.68], (x, y, z) => (y * s < 0.68 ? shade(T.wolf[0]) : pick(T.wolf, hash3(x, y, z, 13), [0.3, 0.9])), 1);
  step(head, 1);
  box(head, [-0.04, 0.7, 0.68], [0.04, 0.74, 0.72], tone(T.hoof, 15)); // nose
  for (const x of [-1, 1]) head.set(x, head.i(0.64) - 1, head.i(0.64), shade(WHITE)); // fangs
  const earG = new Grid(s);
  for (const sx of [-1, 1]) taperedBox(earG, [sx * 0.06, 0.8, 0.42], [0.12, 0.16, 0.08], 0.25, tone(T.wolf, 17, [0.1, 0.7]));
  step(earG, -1);
  for (const v of earG.map.values()) head.set(v.x, v.y, v.z, v.c);
  for (const v of [...head.map.values()]) // inner ear: the middle column of each ear's front face
    if (v.z === head.i(0.44) && v.y >= 21 && v.y <= 22 && head.has(v.x - 1, v.y, v.z) && head.has(v.x + 1, v.y, v.z)) v.c = shade(T.pink[2]);
  const eyes = new Grid(s);
  onFront(eyes, head, [[1, 19], [1, 20], [-2, 19], [-2, 20]], WOLF_EYE);

  const tailPivot: V3 = [0, 0.62, -0.36];
  const tail = new Grid(s);
  const tailFur: Paint = (x, y, z) => (z * s < -0.64 ? shade(T.wolf[0]) : pick(T.wolf, hash3(x, y, z, 19), [0.2, 0.75]));
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
  step(tail, -1);

  const legs = ([[-0.08, 0.24], [0.08, 0.24], [-0.08, -0.26], [0.08, -0.26]] as const).map(([lx, lz]) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0.04, lz - 0.04], [lx + 0.04, 0.46, lz + 0.04], tone(T.wolf, 25, [0.2, 0.8]));
    step(g, -1); // the leg, before its foot is added
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
  for (const x0 of [0, 6]) for (let x = x0; x < x0 + 3; x++) for (let y = 0; y < 2; y++) g.set(x, y, 0, shadeRaw(WOLF_EYE));
  eyePair = buildGeometry(g.map, s).translate(-4.5 * s, -s, -s / 2);
  return eyePair;
}

// ---------------------------------------------------------------- sheepdog

export interface SheepdogModel { body: Part; head: Part; tail: Part; ears: [Part, Part]; legs: [Part, Part, Part, Part] }
let dog: SheepdogModel | null = null;

/**
 * The sheepdog, cell for cell from Brian's six-view sheet (2026-11-23): a charcoal collie standing four-square, 7 cells
 * wide, a white blaze, muzzle, chest, socks and tail tip, a red bandana knotted at the nape with its point on the chest,
 * ears up and folded over at the tips, and the tail curling up behind. Cells are CHAR (0.04 m); front is +z.
 */
export function sheepdogModel(): SheepdogModel {
  if (dog) return dog;
  const COAT = '#484B50', WHITE_FUR = '#ECEBE6', INK = '#080808', MOUTH = '#9C9B97', BANDANA = '#C8321F';
  const fill = (g: Grid, [x0, x1]: [number, number], [y0, y1]: [number, number], [z0, z1]: [number, number], hex: string) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) g.set(x, y, z, shade(hex));
  };
  const paint = (g: Grid, x: number, y: number, z: number, hex: string) => { if (g.has(x, y, z)) g.set(x, y, z, shade(hex)); };

  // Body: rows 5 to 11 over the legs, the rump at z 0, the chest at z 11.
  const body = new Grid(s);
  fill(body, [-3, 3], [5, 11], [0, 11], COAT);
  for (let y = 5; y <= 10; y++) for (let x = -2; x <= 2; x++) { // the white chest, narrower low down, wrapping one cell round
    if (y <= 7 && Math.abs(x) === 2) continue;
    paint(body, x, y, 11, WHITE_FUR); paint(body, x, y, 10, WHITE_FUR);
  }
  for (const x of [-3, 3]) for (let y = 7; y <= 9; y++) for (let z = 10; z <= 11; z++) paint(body, x, y, z, WHITE_FUR); // the chest's white, seen from the side
  for (const x of [-3, 3]) for (let z = 4; z <= 6; z++) paint(body, x, 5, z, WHITE_FUR); // a white flash under the belly
  for (let z = 4; z <= 6; z++) for (let x = -2; x <= 2; x++) paint(body, x, 5, z, WHITE_FUR);
  // The bandana: a band round the neck, its knot at the nape and its point down the chest (8, 5, 3 and 1 across).
  for (let x = -3; x <= 3; x++) body.set(x, 11, 12, shade(BANDANA));
  for (const x of [-4, 4]) for (let z = 8; z <= 12; z++) body.set(x, 11, z, shade(BANDANA));
  for (let x = -3; x <= 3; x++) body.set(x, 12, 8, shade(BANDANA));
  for (const [x, y] of [[-1, 13], [1, 13], [0, 12]] as const) body.set(x, y, 7, shade(BANDANA));
  for (let y = 10, w = 2; w >= 0; y--, w--) for (let x = -w; x <= w; x++) body.set(x, y, 12, shade(BANDANA));

  // Head: rows 12 to 17, z 9 to 14, its top row one in from each side; the white blaze runs up its middle and over.
  const headPivot: V3 = [0, 12 * s, 11 * s];
  const head = new Grid(s);
  fill(head, [-3, 3], [12, 16], [9, 14], COAT);
  fill(head, [-2, 2], [17, 17], [9, 14], COAT);
  for (let y = 15; y <= 17; y++) paint(head, 0, y, 14, WHITE_FUR);
  for (let z = 11; z <= 14; z++) paint(head, 0, 17, z, WHITE_FUR);
  for (const x of [-2, 2]) head.set(x, 15, 14, shadeRaw(INK)); // eyes, raw: `shade` lifts them to the palette's floor, the coat's grey
  // Muzzle: 5 across, the lowest row a cell shorter; the nose 3 across on its top front, the mouth's line under it.
  fill(head, [-2, 2], [13, 14], [15, 17], WHITE_FUR);
  fill(head, [-2, 2], [12, 12], [15, 16], WHITE_FUR);
  for (let x = -1; x <= 1; x++) head.set(x, 14, 18, shadeRaw(INK)); // the nose stands out a cell, so it shows from the side
  head.set(0, 13, 17, shade(MOUTH));

  // Ears: up from the head's outer columns, folded over outward at the tips.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    for (const [x, y] of [[3, 17], [5, 17], [2, 18], [3, 18], [4, 18], [5, 18], [2, 19], [3, 19], [4, 19]] as const) fill(g, [sx * x, sx * x], [y, y], [11, 12], COAT);
    { const cells = [...g.map.values()]; g.map.clear(); for (const v of cells) g.set(v.x, v.y - 1, v.z, v.c); } // down with the head (below)
    return part(g, [sx * 3 * s, 16 * s, 11.5 * s]);
  }) as [Part, Part];

  // Tail: three across at the root, stepping up and back, one across at the top with a white tip.
  const tailPivot: V3 = [0, 10 * s, 0];
  const tail = new Grid(s);
  fill(tail, [-1, 1], [9, 11], [-1, -1], COAT);
  fill(tail, [-1, 1], [10, 12], [-2, -2], COAT);
  fill(tail, [0, 0], [11, 13], [-3, -3], COAT);
  fill(tail, [0, 0], [12, 13], [-4, -4], COAT);
  fill(tail, [0, 0], [14, 15], [-4, -4], WHITE_FUR);

  // Legs: 2 by 2, white socks three cells high; the hind legs widen into the haunch.
  const leg = (x0: number, z0: number, hind: boolean) => {
    const g = new Grid(s);
    fill(g, [x0, x0 + 1], [0, 2], [z0, z0 + 1], WHITE_FUR);
    fill(g, [x0, x0 + 1], [0, 0], [z0 + 2, z0 + 2], WHITE_FUR); // the paw, a cell forward
    fill(g, [x0, x0 + 1], [3, 3], [z0, z0 + 1], COAT);
    if (hind) fill(g, [x0, x0 + 1], [3, 3], [z0 + 2, z0 + 3], COAT);
    return part(g, [(x0 + 1) * s, 4 * s, (z0 + 1) * s]);
  };
  const legs = [leg(-3, 9, false), leg(2, 9, false), leg(-3, 0, true), leg(2, 0, true)] as [Part, Part, Part, Part];

  // Legs four cells high, as the sheet's stocky dog: everything above them was laid out on five, so it comes down one.
  for (const g of [body, head, tail]) { const cells = [...g.map.values()]; g.map.clear(); for (const v of cells) g.set(v.x, v.y - 1, v.z, v.c); }
  const down = (p: V3): V3 => [p[0], p[1] - s, p[2]];
  dog = { body: part(body, [0, 7 * s, 6 * s]), head: part(head, down(headPivot)), tail: part(tail, down(tailPivot)), ears, legs };
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
        g.set(x, layer, i, shade(k === w - 1 && w > 1 ? T.stone[1] : T.stone[0])); // light edge, mid spine
      }
    }
    const y = layer * s;
    line(g, [0, y, -0.04], [-sx * 0.08, y, -0.14], handle);
    ring(g, [-sx * 0.1, y, -0.22], 0.06, 0.08, 0.02, handle);
    ring(g, [-sx * 0.1, y, -0.22], 0.08, 0.1, 0.02, handle);
    if (layer) g.set(0, 2, 0, shade(T.brass[1])); // screw head
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
      if (x * x + z * z <= Math.max(0.3, rr * rr)) g.set(x, -i, z, x === 0 ? shade(T.ice[0]) : pick(T.ice, hash3(x, i, z, 81), [0, 0.6]));
  }
  const d = new Grid(s);
  d.set(0, 0, 0, shade(T.ice[0]));
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
      g.set(n * 6 + c, 6 - r, 1, shadeRaw(T.lantern[0]));
      g.set(n * 6 + c, 6 - r, 0, shadeRaw(T.lantern[2]));
    }));
  });
  const width = Math.max(0, text.length * 6 - 1);
  geo = buildGeometry(g.map, cell).translate((-width * cell) / 2, -3.5 * cell, -cell);
  digits.set(key, geo);
  return geo;
}
