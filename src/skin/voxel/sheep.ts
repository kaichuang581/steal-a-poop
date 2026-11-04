import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, T } from './palette';
import { cone, ellipsoid, Grid, hash3, line, rng, solid } from './primitives';
import type { RGB, V3 } from './primitives';

/** Characters are built on the 0.04 m grid (plan V3 Part 4.1). */
export const CHAR = 0.04;

export type Brows = 'neutral' | 'up' | 'worried';
export type Mouth = 'flat' | 'smile' | 'o' | 'chewL' | 'chewDown' | 'chewR';
export type Lids = 'closed' | 'arc';
export type WoolLevel = 0 | 1 | 2 | 3 | 4;

/** One geometry per moving part, with the point it pivots about (the geometry is built around that pivot). */
export interface Part { geo: BufferGeometry; pivot: V3; voxels: number }

export interface SheepModel {
  /** The body's wool lobes per coat level 1..4 (the thick levels add lobes down the flanks). Pivot at the ground. */
  wools: Record<1 | 2 | 3 | 4, Part>;
  /** Frost that settles on each fleece's upper surface while freezing. */
  frosts: Record<1 | 2 | 3 | 4, Part>;
  /** The head sphere with the muzzle, nose, cheeks and nostrils painted on. Pivot at the neck. */
  head: Part;
  /** The wool hood around the face and the top tuft; part of the head group. Shearing takes the body fleece only. */
  hood: Part;
  /** Two lobes on the rump, wagged about their pivot. */
  tail: Part;
  /** Left and right eye, each scaled about its own centre. */
  eyes: [Part, Part];
  /** Closed lids: a flat line for blinks and sleep, an arc for happy. */
  lids: Record<Lids, Part>;
  brows: Record<Brows, Part>;
  mouths: Record<Mouth, Part>;
  /** Left and right ear, built pointing straight out; the component droops them 20 degrees. */
  ears: [Part, Part];
  /** Front left, front right, back left, back right; pivot at the top. */
  legs: [Part, Part, Part, Part];
  collar: Part;
  bell: Part;
  /** The bare body at level 0, with stubble. */
  sheared: Part;
  breath: Part;
  /** Lobe counts, for the plan's acceptance check. */
  lobes: { body: number; hood: number; tuft: number; tail: number };
  /** Distinct colours in the normal fleece: two creams and the crease tone, nothing per voxel. */
  woolTones: number;
  /** Voxels before face culling at coat level 2. */
  voxels: number;
}

/** The cute palette (plan V3.3 Part 3.2): a warm light grey face so the features read, two creams for the wool. */
export const FACE = ['#B9B0AC', '#A79E9A', '#8E8582'] as const;
export const MUZZLE = '#6F6764';
export const IRIS = '#2B2522';
export const NOSE = '#E79C94';
export const NOSTRIL = '#C97C74';
export const CHEEK = '#F2B6B0';
export const CREAM = ['#FAF6EC', '#EFE8D7'] as const;
export const CREASE = '#DDD3BE';
export const LEG = '#6F6764';
export const HOOF = '#8E8582';
export const EYE_WHITE = '#FBFBF8';
export const MOUTH = '#332C2A';

/** The model is centred on voxel column 0, whose centre is 0.02 m, so the face has a middle column. */
export const CX = 0.02;
export const HEAD_CENTRE: V3 = [CX, 0.79, 0.26];
export const HEAD_R = 0.26;
/** The neck: the head group turns about this point. */
export const HEAD_PIVOT: V3 = [CX, 0.62, 0.18];
/** How much bigger each coat level's fleece is than the normal coat (level 2). */
export const LEVEL_K = [0, 0.88, 1, 1.12, 1.26] as const;

function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count };
}

interface Lobe { c: V3; r: V3; tone: 0 | 1 }
/** Whether a wool cell may exist, given its centre in metres and its grid position. */
type Keep = (xm: number, ym: number, zm: number, x: number, y: number, z: number) => boolean;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/**
 * Paints wool as a few smooth lobes: every voxel takes its lobe's cream, and the crease tone only where a lobe meets
 * a later one, so the fleece reads as lobes with folds between them rather than noise (plan V3.3 Part 3.2).
 */
function paintLobes(g: Grid, lobes: Lobe[], keep: Keep, noise = 0.04) {
  const owner = new Map<string, number>();
  const cells = new Map<string, [number, number, number]>();
  lobes.forEach((l, i) => {
    const tmp = new Grid(g.size);
    ellipsoid(tmp, l.c, l.r, solid([0, 0, 0]), noise, 3 + i);
    for (const v of tmp.map.values()) {
      if (!keep((v.x + 0.5) * g.size, (v.y + 0.5) * g.size, (v.z + 0.5) * g.size, v.x, v.y, v.z)) continue;
      const key = `${v.x},${v.y},${v.z}`;
      owner.set(key, i);
      cells.set(key, [v.x, v.y, v.z]);
    }
  });
  for (const [key, i] of owner) {
    const [x, y, z] = cells.get(key)!;
    const crease = NEIGHBOURS.some(([dx, dy, dz]) => {
      const o = owner.get(`${x + dx},${y + dy},${z + dz}`);
      return o !== undefined && o > i;
    });
    g.set(x, y, z, lin(crease ? CREASE : CREAM[lobes[i].tone]));
  }
}

/** The face window: no wool in front of the head between the chin and the brow. */
function inFace(xm: number, ym: number, zm: number): boolean {
  return zm > HEAD_CENTRE[2] + 0.06 && Math.abs(xm - CX) < 0.22 && ym > 0.5 && ym < 0.99;
}

/**
 * The body's seven lobes (0.34 to 0.44 m across) filling 0.62 by 0.52 by 0.74 m at the normal coat, scaled about the
 * body's centre for the other levels. Thick coats hang more lobes down the flanks; the thickest reaches the ground.
 */
function bodyLobes(level: 1 | 2 | 3 | 4): Lobe[] {
  const k = LEVEL_K[level];
  const at = (x: number, y: number, z: number): V3 => [CX + x * k, 0.4 + (y - 0.4) * k, z * k];
  const rr = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k];
  const lobes: Lobe[] = [
    { c: at(0, 0.5, 0.17), r: rr(0.19, 0.17, 0.19), tone: 0 },
    { c: at(0, 0.5, -0.17), r: rr(0.19, 0.17, 0.19), tone: 1 },
    { c: at(-0.15, 0.37, 0.18), r: rr(0.17, 0.18, 0.19), tone: 1 },
    { c: at(0.15, 0.37, 0.18), r: rr(0.17, 0.18, 0.19), tone: 0 },
    { c: at(-0.15, 0.37, -0.18), r: rr(0.17, 0.18, 0.19), tone: 0 },
    { c: at(0.15, 0.37, -0.18), r: rr(0.17, 0.18, 0.19), tone: 1 },
    { c: at(0, 0.4, 0), r: rr(0.2, 0.2, 0.22), tone: 0 },
  ];
  if (level >= 3) {
    for (const [x, z] of [[-0.28, 0.16], [0.28, 0.16], [-0.28, -0.16], [0.28, -0.16]] as const) {
      lobes.push({ c: [CX + x * k, level === 4 ? 0.18 : 0.22, z * k], r: rr(0.15, 0.13, 0.17), tone: 1 });
    }
  }
  if (level === 4) {
    for (const [x, z, tone] of [[0, 0.44, 0], [0, -0.44, 1], [-0.24, 0.4, 1], [0.24, 0.4, 0], [-0.24, -0.4, 0], [0.24, -0.4, 1]] as const) {
      lobes.push({ c: [CX + x, 0.16, z], r: [0.16, 0.15, 0.14], tone });
    }
  }
  return lobes;
}

let cached: SheepModel | null = null;

/**
 * The default sheep (plan V3.3 Part 3): chibi proportions (a 0.52 m head on a 0.62 by 0.52 by 0.74 m body, 0.14 m
 * legs, 1.05 m to the top of the head), a light grey face with big low eyes, pink nose and cheeks, drooping ears,
 * and wool as smooth lobes. One model for every player, built once and shared.
 *
 * Parts never share a cell: the wool, the hood and the sheared body are built around the head, collar, bell and
 * legs, so no two parts can put a face on the same plane and flicker against each other.
 */
export function sheepModel(): SheepModel {
  if (cached) return cached;
  const s = CHAR;
  const i = (m: number) => Math.round(m / s);
  const lobes = { body: 7, hood: 5, tuft: 3, tail: 2 };

  // ---- Head: a sphere in warm light grey (a few mid-grey patches, nothing per voxel).
  const head = new Grid(s);
  ellipsoid(head, HEAD_CENTRE, [HEAD_R, HEAD_R, HEAD_R], (x, y, z) => lin(hash3(x >> 2, y >> 2, z >> 2, 31) < 0.3 ? FACE[1] : FACE[0]));
  // The front-most head voxel in each column, so features follow the curve of the face.
  const front = new Map<string, number>();
  for (const v of head.map.values()) front.set(`${v.x},${v.y}`, Math.max(front.get(`${v.x},${v.y}`) ?? -99, v.z));
  const proud = (g: Grid, x: number, y: number, c: RGB, extra = 1) => {
    const z = front.get(`${x},${y}`);
    if (z !== undefined) g.set(x, y, z + extra, c);
  };
  // Muzzle: a darker rounded patch 0.20 m wide on the lower face.
  for (let x = -2; x <= 2; x++) for (let y = 15; y <= 18; y++) if (Math.abs(x) < 2 || (y > 15 && y < 18)) proud(head, x, y, lin(MUZZLE), 0);
  // Nose: a small pink bump with a nostril marked either side of it.
  proud(head, 0, 18, lin(NOSE));
  proud(head, 0, 17, lin(NOSE));
  proud(head, -1, 17, lin(NOSTRIL), 0);
  proud(head, 1, 17, lin(NOSTRIL), 0);
  // Cheeks: round pink patches beside the muzzle, under the eyes.
  for (const sx of [-1, 1]) for (const dx of [3, 4]) for (const y of [17, 18]) proud(head, sx * dx, y, lin(CHEEK));

  // Eyes: 0.12 by 0.16 m ovals, low and wide (rows 19..22, a column either side of the nose): a big dark iris with
  // a two-voxel catchlight at the upper left as the viewer sees it (the model's -x).
  const EYE: [number, number, string][] = [
    [1, 22, 'W'], [2, 22, 'D'],
    [0, 21, 'W'], [1, 21, 'D'], [2, 21, 'D'],
    [0, 20, 'D'], [1, 20, 'D'], [2, 20, 'D'],
    [1, 19, 'D'],
  ];
  const eyes = ([-3, 1] as const).map((base) => {
    const eye = new Grid(s);
    for (const [c, y, kind] of EYE) proud(eye, base + c, y, lin(kind === 'D' ? IRIS : EYE_WHITE));
    return part(eye, [(base + 1.5) * s, 21 * s, 13 * s]);
  }) as [Part, Part];
  const lids = {} as Record<Lids, Part>;
  for (const kind of ['closed', 'arc'] as Lids[]) {
    const g = new Grid(s);
    for (const base of [-3, 1]) {
      for (const [c, y] of EYE) proud(g, base + c, y, lin(FACE[1]), 2);
      const dark = kind === 'closed' ? [[0, 20], [1, 20], [2, 20]] : [[0, 20], [1, 21], [2, 20]];
      for (const [c, y] of dark) proud(g, base + c, y, lin(MOUTH), 2);
    }
    lids[kind] = part(g, HEAD_PIVOT);
  }
  // Brows: short bars that tilt. Rows run outer to inner; the sphere recedes above the eyes, so the bars sit a voxel
  // or two behind the eye plane and read best from the table's high camera. At rest they are a faint two-voxel
  // mark in the muzzle grey; the emotions draw them dark and full.
  const brows = {} as Record<Brows, Part>;
  const BROW_ROWS: Record<Brows, [number, number, number]> = { neutral: [24, 24, 24], up: [24, 25, 25], worried: [23, 24, 25] };
  for (const kind of ['neutral', 'up', 'worried'] as Brows[]) {
    const g = new Grid(s);
    const cols = kind === 'neutral' ? [3, 2] : [3, 2, 1];
    [-1, 1].forEach((sx) => cols.forEach((dx, n) => proud(g, sx * dx, BROW_ROWS[kind][n], lin(kind === 'neutral' ? MUZZLE : MOUTH))));
    brows[kind] = part(g, HEAD_PIVOT);
  }
  // Mouths: five voxels along the bottom of the muzzle; a small "o"; three chewing frames between flats.
  const MOUTHS: Record<Mouth, [number, number][]> = {
    flat: [[-2, 15], [-1, 15], [0, 15], [1, 15], [2, 15]],
    smile: [[-2, 16], [-1, 15], [0, 15], [1, 15], [2, 16]],
    o: [[-1, 16], [0, 16], [1, 16], [-1, 15], [1, 15], [-1, 14], [0, 14], [1, 14]],
    chewL: [[-3, 15], [-2, 15], [-1, 15], [0, 15], [1, 15]],
    chewDown: [[-2, 14], [-1, 14], [0, 14], [1, 14], [2, 14]],
    chewR: [[-1, 15], [0, 15], [1, 15], [2, 15], [3, 15]],
  };
  const mouths = {} as Record<Mouth, Part>;
  for (const kind of Object.keys(MOUTHS) as Mouth[]) {
    const g = new Grid(s);
    for (const [x, y] of MOUTHS[kind]) proud(g, x, y, lin(MOUTH));
    if (kind === 'o') proud(g, 0, 15, lin(T.hoof[1])); // the open mouth
    mouths[kind] = part(g, HEAD_PIVOT);
  }

  // Ears: 0.20 m paddles out from the sides of the head at eye height, three voxels tall and two thick, the front
  // (inner) face pink, the tip narrowed to one row. Pivot at the head's edge.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const px = sx < 0 ? -7 : 7;
    for (let k = 0; k < 5; k++) {
      for (const y of k < 4 ? [20, 21, 22] : [21]) {
        g.set(px + sx * k, y, 6, lin(FACE[k === 4 ? 2 : 1]));
        g.set(px + sx * k, y, 7, lin(CHEEK));
      }
    }
    return part(g, [(px + 0.5) * s, 21.5 * s, 7 * s]);
  }) as [Part, Part];

  // Legs: 0.12 m square stubs, the hoof a lighter voxel row splayed one voxel outward. The top 0.06 m sits in the wool.
  const legGrids: Grid[] = [];
  const legs = ([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sz]) => {
    const g = new Grid(s);
    const xs = sx < 0 ? [-5, -4, -3] : [3, 4, 5];
    const zs = sz < 0 ? [-7, -6, -5] : [4, 5, 6];
    for (const x of xs) for (const z of zs) {
      for (let y = 1; y <= 4; y++) g.set(x, y, z, lin(LEG));
      g.set(x + sx, 0, z, lin(HOOF));
    }
    legGrids.push(g);
    return part(g, [(xs[1] + 0.5) * s, 0.2, (zs[1] + 0.5) * s]);
  }) as [Part, Part, Part, Part];

  // Collar: a thin red band at the neck, under the chin, with a brass bell hanging from its front.
  const collar = new Grid(s);
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    const x = Math.floor((CX + 0.22 * Math.cos(a)) / s), z = Math.floor((0.2 + 0.2 * Math.sin(a)) / s);
    for (const y of [13, 14]) collar.set(x, y, z, pick(T.collar, hash3(k >> 3, y, 0, 47), [0.6, 1]));
  }
  const bell = new Grid(s);
  ellipsoid(bell, [CX, 0.46, 0.42], [0.05, 0.05, 0.05], (x, y, z) => pick(T.brass, hash3(x >> 1, y >> 1, z >> 1, 51), [0.6, 1]));
  bell.set(0, 9, 10, lin(T.brass[2])); // clapper

  // Cells the wool and the bare body must leave alone.
  const taken = (x: number, y: number, z: number) => head.has(x, y, z) || collar.has(x, y, z) || bell.has(x, y, z) || legGrids.some((g) => g.has(x, y, z));

  // ---- Wool per coat level, with frost for the freeze.
  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  let woolTones = 0;
  for (const level of [1, 2, 3, 4] as const) {
    const g = new Grid(s);
    paintLobes(g, bodyLobes(level), (xm, ym, zm, x, y, z) => ym >= 0.02 && !inFace(xm, ym, zm) && !taken(x, y, z));
    wools[level] = part(g, [0, 0, 0]);
    if (level === 2) woolTones = new Set([...g.map.values()].map((v) => v.c.join(','))).size;
    const frost = new Grid(s);
    const rf = rng(57 + level);
    const k = LEVEL_K[level];
    for (let n = 0; n < 30; n++) {
      const a = rf() * Math.PI * 2, b = rf() * 0.9;
      const x = Math.round((CX + Math.cos(a) * b * 0.3 * k) / s), z = Math.round((Math.sin(a) * b * 0.36 * k) / s);
      let y = i(0.9);
      while (y > 0 && !g.has(x, y, z)) y--;
      if (y > 0) frost.set(x, y + 1, z, lin(T.ice[0]));
    }
    frosts[level] = part(frost, [0, 0, 0]);
  }

  // Wool hood: five lobes around the face (top, both sides, back, a fringe over the brow) and a three-lobe top
  // tuft, keeping the face clear and never sharing a cell with the head.
  const hood = new Grid(s);
  paintLobes(hood, [
    { c: [CX, 0.97, 0.18], r: [0.21, 0.13, 0.2], tone: 0 },
    { c: [CX - 0.22, 0.84, 0.06], r: [0.14, 0.17, 0.17], tone: 1 },
    { c: [CX + 0.22, 0.84, 0.06], r: [0.14, 0.17, 0.17], tone: 1 },
    { c: [CX, 0.8, -0.04], r: [0.2, 0.2, 0.18], tone: 0 },
    { c: [CX, 1.04, 0.3], r: [0.16, 0.08, 0.12], tone: 1 },
    { c: [CX, 1.08, 0.2], r: [0.09, 0.07, 0.09], tone: 0 },
    { c: [CX - 0.09, 1.06, 0.14], r: [0.065, 0.06, 0.065], tone: 1 },
    { c: [CX + 0.1, 1.05, 0.18], r: [0.065, 0.06, 0.065], tone: 1 },
  ], (xm, ym, zm, x, y, z) => !inFace(xm, ym, zm) && !taken(x, y, z), 0.03);

  // Tail: two lobes on the rump.
  const tail = new Grid(s);
  paintLobes(tail, [{ c: [CX, 0.5, -0.42], r: [0.09, 0.08, 0.1], tone: 0 }, { c: [CX, 0.56, -0.46], r: [0.06, 0.06, 0.07], tone: 1 }], () => true, 0.03);

  // The sheared body for coat level 0, with a little stubble.
  const sheared = new Grid(s);
  ellipsoid(sheared, [CX, 0.42, 0.02], [0.3, 0.25, 0.37], (x, y, z) => (taken(x, y, z) ? null : pick(T.skin, hash3(x >> 2, y >> 2, z >> 2, 53))));
  for (const v of [...sheared.map.values()]) {
    if (hash3(v.x, v.y, v.z, 55) < 0.08 && !sheared.has(v.x, v.y + 1, v.z) && !taken(v.x, v.y + 1, v.z)) sheared.set(v.x, v.y + 1, v.z, lin(CREAM[0]));
  }

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, 18 + y, 14 + z, lin(EYE_WHITE));

  const parts = {
    wools, frosts, head: part(head, HEAD_PIVOT), hood: part(hood, HEAD_PIVOT), tail: part(tail, [CX, 0.5, -0.36]), eyes, lids, brows, mouths, ears, legs,
    collar: part(collar, [0, 0, 0]), bell: part(bell, [CX, 0.5, 0.42]), sheared: part(sheared, [CX, 0.42, 0.02]), breath: part(breath, [CX, 0.72, 0.56]),
    lobes, woolTones,
  };
  const voxels = wools[2].voxels + parts.head.voxels + parts.hood.voxels + parts.tail.voxels + eyes[0].voxels + eyes[1].voxels
    + ears[0].voxels + ears[1].voxels + legs.reduce((n, l) => n + l.voxels, 0) + parts.collar.voxels + parts.bell.voxels;
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
  ellipsoid(g, [0, 0, 0], [0.09, 0.07, 0.09], (x, y, z) => lin(hash3(x >> 1, y >> 1, z >> 1, seed) < 0.6 ? CREAM[0] : CREAM[1]), 0.2, seed);
  return buildGeometry(g.map, CHAR);
}
