import { ANIMAL_AVATAR_IDS } from '../../avatars/ids';
import { lin, pick, T } from './palette';
import { cone, ellipsoid, Grid, hash3, rng } from './primitives';
import type { Paint, RGB, V3 } from './primitives';
import { CHAR, CX, EYE_BASES, EYE_WHITE, HEAD_PIVOT, HEAD_ROWS, IRIS, LEVEL_K, part, sheepModel } from './sheep';
import type { Brows, Lids, Mouth, Part, SheepModel } from './sheep';

export type Animal = (typeof ANIMAL_AVATAR_IDS)[number];

/**
 * The other farm animals, built to the sheep's rig (src/skin/voxel/sheep.ts) so the Sheep component animates them
 * with the sheep's own poses, after reports/Cute voxel farm animal design.md: one shared face (the sheep's wedge head,
 * its 3 x 2 eyes with a catchlight, its lids, brows and mouths) and every species difference spent on three things:
 * a height-and-neck ladder (hen 15, pig 20, goat 23, cow 27, horse 30 rows to the crown), one signature attached
 * to the head (snout disc, horns over leaf ears, beard, mane and blaze, comb), and one colour family each with a
 * tail that points a different way. Three tones a material, cool shadows and warm lights, no pure black, nothing
 * under two voxels unless it contrasts, and one knit accessory beside (never over) the signature. 0.04 m grid.
 */
interface Spec {
  /** Rows the head is moved from the sheep's (its chin is at row 13 + dy). */
  dy: number;
  /** The wedge is `stretch` columns deeper (horse) or shallower (pig) at the muzzle. */
  stretch: number;
  /** The body: an ellipsoid, centre in metres and radii in metres. */
  body: { c: V3; r: V3 };
  /** Legs: section in voxels, height in rows; how many (a hen has two). */
  legs: { w: number; h: number; count: 2 | 4 };
  /** Where the tail hangs or stands, in metres. */
  tailPivot: V3;
  colors: {
    body: readonly [string, string, string]; // base, shadow, highlight
    face: string; faceLight: string;
    nose: string; noseShadow: string; nostril: string;
    hoof: string; earInside: string; blush: string;
    point?: string; // mane, tail, socks (horse); tuft (cow)
  };
}

const SPEC: Record<Exclude<Animal, 'sheep'>, Spec> = {
  pig: {
    dy: -3, stretch: -2,
    body: { c: [CX, 0.38, 0], r: [0.26, 0.21, 0.34] }, legs: { w: 3, h: 5, count: 4 }, tailPivot: [CX, 0.42, -0.34],
    colors: { body: ['#E3A79A', '#C27D7A', '#F1C3B3'], face: '#E3A79A', faceLight: '#F1C3B3', nose: '#F2D2C6', noseShadow: '#D5A39A', nostril: '#7A5A55', hoof: '#7A5A55', earInside: '#D5A39A', blush: '#C27D7A' },
  },
  cow: {
    dy: 4, stretch: 0,
    body: { c: [CX, 0.58, 0], r: [0.32, 0.24, 0.4] }, legs: { w: 3, h: 9, count: 4 }, tailPivot: [CX, 0.66, -0.4],
    colors: { body: ['#F1ECE2', '#C9C6C0', '#FBF8F0'], face: '#F1ECE2', faceLight: '#FBF8F0', nose: '#D9AA9F', noseShadow: '#B98680', nostril: '#B98680', hoof: '#6A5A52', earInside: '#D9AA9F', blush: '#D9AA9F', point: '#3B3A3F' },
  },
  goat: {
    dy: 0, stretch: 0,
    body: { c: [CX, 0.5, 0], r: [0.22, 0.2, 0.34] }, legs: { w: 2, h: 8, count: 4 }, tailPivot: [CX, 0.6, -0.34],
    colors: { body: ['#B9AD9B', '#857B70', '#D4CAB8'], face: '#B9AD9B', faceLight: '#D4CAB8', nose: '#5B5049', noseShadow: '#5B5049', nostril: '#4A413B', hoof: '#6E6256', earInside: '#C9908A', blush: '#C9908A', point: '#E2D9C8' },
  },
  horse: {
    dy: 7, stretch: 3,
    body: { c: [CX, 0.66, 0], r: [0.26, 0.22, 0.4] }, legs: { w: 3, h: 12, count: 4 }, tailPivot: [CX, 0.74, -0.4],
    colors: { body: ['#8C5A3C', '#5E3C2C', '#AD7A55'], face: '#8C5A3C', faceLight: '#AD7A55', nose: '#AD7A55', noseShadow: '#8C5A3C', nostril: '#4C4438', hoof: '#4C4438', earInside: '#5E3C2C', blush: '#AD7A55', point: '#3A3133' },
  },
  chicken: {
    dy: -8, stretch: 0,
    body: { c: [CX, 0.36, -0.02], r: [0.24, 0.2, 0.28] }, legs: { w: 2, h: 5, count: 2 }, tailPivot: [CX, 0.42, -0.28],
    colors: { body: ['#EAD9BD', '#BFAE95', '#F6EBD6'], face: '#EAD9BD', faceLight: '#F6EBD6', nose: '#D9A052', noseShadow: '#B07A38', nostril: '#B07A38', hoof: '#D9A052', earInside: '#EAD9BD', blush: '#D9AA9F', point: '#9C8A70' },
  },
};

/** Rows to the crown on the 0.04 m grid, the set's height ladder (the sheep is 23): the camera aims by it. */
export const CROWN_ROWS: Record<Animal, number> = { chicken: 15, pig: 20, goat: 23, sheep: 23, cow: 27, horse: 30 };

/** The set's knit family: every accessory is one of these, so the scarves read as one set. */
const KNIT = { teal: '#3F5F65', mustard: '#DC8B4D', berry: '#B35F47', cream: '#E7DCCD', leather: '#6B4A3A', brass: ['#D9B35A', '#A67C2E'] as const };
const COMB = ['#D9433B', '#9D3F3A'] as const;
const BLAZE = '#E7DCCD';

const cache = new Map<Animal, SheepModel>();

/** The model for an animal avatar; the sheep is the game's own sheep. Built once each and shared. */
export function animalModel(animal: Animal): SheepModel {
  if (animal === 'sheep') return sheepModel();
  const hit = cache.get(animal);
  if (hit) return hit;
  const m = build(animal);
  cache.set(animal, m);
  return m;
}

/** Shifts a head-attached part's pivot by the animal's head offset; its geometry is already relative to the pivot. */
const shifted = (p: Part, dy: number): Part => ({ ...p, pivot: [p.pivot[0], p.pivot[1] + dy * CHAR, p.pivot[2]] });

function build(animal: Exclude<Animal, 'sheep'>): SheepModel {
  const s = CHAR;
  const S = SPEC[animal];
  const K = S.colors;
  const dy = S.dy;
  // Mostly the base tone: the lighting already shades the flanks, so the painted shadow is only a few patches.
  const bodyTone: Paint = (x, y, z) => pick(K.body, hash3(x >> 2, y >> 2, z >> 2, 11), [0.74, 0.94]);
  const face = (light: boolean) => lin(light ? K.faceLight : K.face);

  // ---- Head, in the sheep's own rows (13..22) so the face parts match; the whole group is placed `dy` rows up or down.
  const head = new Grid(s);
  for (const [y, hw, zb, zf0] of HEAD_ROWS) {
    const zf = zf0 + S.stretch;
    for (let x = -hw; x <= hw; x++) for (let z = zb; z <= zf; z++) {
      if (Math.abs(x) === hw && (z === zb || (z === zf && (y < 17 || y > 18)))) continue;
      const bridge = z === zf && Math.abs(x) <= 1 && y >= 15 && y <= 20;
      const blaze = animal === 'horse' && z >= zf - 1 && Math.abs(x) <= 0.5 && y >= 14 && y <= 21;
      head.set(x, y, z, blaze ? lin(BLAZE) : face(bridge));
    }
  }
  const front = new Map<string, number>();
  for (const v of head.map.values()) front.set(`${v.x},${v.y}`, Math.max(front.get(`${v.x},${v.y}`) ?? -99, v.z));
  const zFront = (x: number, y: number) => front.get(`${x},${y}`) ?? 15;
  const proud = (g: Grid, x: number, y: number, c: RGB, extra = 1) => {
    const z = front.get(`${x},${y}`);
    if (z !== undefined) g.set(x, y, z + extra, c);
  };

  // Muzzle, snout or beak: wide and flat, never long (a small nose is a cute nose, but the width is the species).
  switch (animal) {
    case 'pig':
      // A 4 x 4 disc one voxel proud of the face, corners cut, two nostrils a voxel deeper.
      for (let x = -2; x <= 1; x++) for (let y = 13; y <= 16; y++) {
        if ((x === -2 || x === 1) && (y === 13 || y === 16)) continue;
        proud(head, x, y, lin(y === 16 || x === 1 ? K.nose : K.nose), 1);
      }
      for (const x of [-2, 1]) for (let y = 14; y <= 15; y++) proud(head, x, y, lin(K.noseShadow), 1);
      proud(head, -1, 14, lin(K.nostril), 2);
      proud(head, 0, 14, lin(K.nostril), 2);
      break;
    case 'cow':
    case 'horse':
      // A broad soft muzzle flush over the lower face, two nostrils.
      for (let x = -3; x <= 2; x++) for (let y = 13; y <= 15; y++) proud(head, x, y, lin(y === 13 ? K.noseShadow : K.nose), 0);
      proud(head, -2, 14, lin(K.nostril), 0);
      proud(head, 1, 14, lin(K.nostril), 0);
      break;
    case 'goat':
      for (const x of [-1, 0]) for (const y of [14, 15]) proud(head, x, y, lin(K.nose), 0);
      break;
    case 'chicken': {
      // A short orange beak off the face and a red wattle under it.
      const z0 = (zFront(0, 15) + 1) * s;
      cone(head, [CX, 15 * s, z0], 0.05, 0.11, 1, (x, y, z) => lin(hash3(x, y, z, 5) < 0.65 ? K.nose : K.noseShadow));
      for (const y of [12, 13]) for (const x of [-1, 0]) head.set(x, y, zFront(x, 14), lin(y === 12 ? COMB[1] : COMB[0]));
      break;
    }
  }
  // No lid line (on a light face it reads as a squint); blush under the eyes.
  const lidTone = lin(K.body[1]);
  for (const x of [-2, 2]) proud(head, x, 16, lin(K.blush), 0);

  // The head's signature: horns, a comb, a beard, a mane and forelock.
  if (animal === 'cow') for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) head.set(sx * (3 + k), 22 + k, 10, lin(T.hay[0]));
    head.set(sx * 5, 25, 10, lin(T.hay[2]));
  }
  if (animal === 'goat') {
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) head.set(sx * 2, 22 + k, 9 - k, lin('#5B4B3C'));
    for (let y = 10; y <= 12; y++) for (const x of [-1, 0]) head.set(x, y, zFront(x, 13) - 1 + (y === 10 ? -1 : 0), lin(K.point!));
  }
  if (animal === 'chicken') {
    // A small scalloped comb flopped a little to one side: a hen's, not a rooster's.
    for (const [x, y] of [[-1, 23], [0, 23], [1, 23], [2, 23], [-1, 24], [1, 24], [2, 25], [0, 25]]) head.set(x, y, 10, lin(y === 23 ? COMB[1] : COMB[0]));
    for (const [x, y] of [[-1, 23], [0, 23], [1, 23], [2, 23], [0, 24], [2, 24]]) head.set(x, y, 11, lin(COMB[0]));
  }
  if (animal === 'horse') for (let z = 6; z <= 12; z++) for (const x of [-1, 0]) { head.set(x, 23, z, lin(K.point!)); if (z <= 8) head.set(x, 24, z, lin('#57494A')); }

  // Eyes: taller than wide (2 x 3, rows 17..19), a big dark iris with one catchlight in the same top-outer corner
  // of each, set in the face's outer columns. The sheep's low wide eyes read as a squint on a light face.
  const EYE_COLS: Record<number, [number, number]> = { [-3]: [-3, -2], [1]: [2, 3] };
  const EYE_ROWS = [17, 18, 19];
  const eyes = EYE_BASES.map((base) => {
    const eye = new Grid(s);
    const cols = EYE_COLS[base];
    let zc = 0;
    for (const x of cols) for (const y of EYE_ROWS) {
      const z = front.get(`${x},${y}`)!;
      head.del(x, y, z);
      zc = Math.max(zc, z);
      // The catchlight sits top-left in both eyes (mirrored ones read cross-eyed); the bottom row is a warmer iris.
      eye.set(x, y, z, lin(x === cols[0] && y === 19 ? EYE_WHITE : y === 17 ? '#5A4036' : IRIS));
    }
    return shifted(part(eye, [(cols[0] + 1) * s, 18.5 * s, (zc + 0.5) * s]), dy);
  }) as [Part, Part];
  const lids = {} as Record<Lids, Part>;
  for (const kind of ['closed', 'arc'] as Lids[]) {
    const g = new Grid(s);
    for (const base of EYE_BASES) {
      const cols = EYE_COLS[base];
      for (const x of cols) for (const y of EYE_ROWS) proud(g, x, y, face(false), 1);
      const light = kind === 'closed' ? [[0, 18], [1, 18]] : [[0, 19], [1, 19]];
      for (const [c, y] of light) proud(g, cols[0] + c, y, lidTone, 1);
    }
    lids[kind] = shifted(part(g, HEAD_PIVOT), dy);
  }
  const brows = {} as Record<Brows, Part>;
  const BROW_ROWS: Record<Brows, [number, number, number] | null> = { neutral: null, up: [21, 21, 21], worried: [20, 21, 21] };
  for (const kind of ['neutral', 'up', 'worried'] as Brows[]) {
    const g = new Grid(s);
    const rows = BROW_ROWS[kind];
    if (rows) [-1, 1].forEach((sx) => [4, 3, 2].forEach((dx, n) => proud(g, sx * dx, rows[n], lidTone)));
    brows[kind] = shifted(part(g, HEAD_PIVOT), dy);
  }
  const MOUTHS: Record<Mouth, [number, number][]> = {
    flat: [[-1, 13], [0, 13], [1, 13]],
    smile: [[-2, 14], [-1, 13], [0, 13], [1, 13], [2, 14]],
    o: [[-1, 13], [0, 13], [-1, 12], [0, 12]],
    chewL: [[-2, 13], [-1, 13], [0, 13]],
    chewDown: [[-1, 12], [0, 12], [1, 12]],
    chewR: [[0, 13], [1, 13], [2, 13]],
  };
  const mouths = {} as Record<Mouth, Part>;
  for (const kind of Object.keys(MOUTHS) as Mouth[]) {
    const g = new Grid(s);
    if (animal !== 'chicken') for (const [x, y] of MOUTHS[kind]) g.set(x, y, zFront(x, Math.max(13, y)) + (animal === 'pig' ? 2 : 1), lin(K.nostril));
    mouths[kind] = shifted(part(g, HEAD_PIVOT), dy);
  }

  // Ears: pig triangles up with the tip folded forward, cow leaves straight out, goat long leaves hanging, horse
  // small upright wedges, none on a hen (her comb is the crown).
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const px = sx < 0 ? -4 : 4;
    const out = (k: number, y: number, z: number, inside = false) => g.set(px + sx * k, y, z, inside ? lin(K.earInside) : face(false));
    switch (animal) {
      case 'cow': for (let k = 0; k < 5; k++) { out(k, 19, 11); out(k, 19, 12); if (k < 4) out(k, 18, 11, true); } break;
      case 'goat': for (let k = 0; k < 6; k++) { const drop = Math.floor(k / 2); out(k, 19 - drop, 11); out(k, 19 - drop, 12); if (k < 5) out(k, 18 - drop, 11, true); } break;
      case 'pig': for (let k = 0; k < 4; k++) { for (const dx of [0, 1]) g.set(px + sx * dx, 19 + k, k === 3 ? 12 : 11, face(false)); if (k < 3) g.set(px, 19 + k, 12, lin(K.earInside)); } break;
      case 'horse': for (let k = 0; k < 3; k++) { g.set(px, 20 + k, 10, face(false)); if (k < 2) g.set(px + sx, 20 + k, 10, face(false)); g.set(px, 20 + k, 11, lin(K.earInside)); } break;
      default: break;
    }
    return shifted(part(g, [(px + 0.5) * s, 19 * s, 11.5 * s]), dy);
  }) as [Part, Part];

  // Legs: a square section no thinner than a third of the body, pivot at the hip line; a hen stands on two with toes.
  const legGrids: Grid[] = [];
  const half = Math.floor(S.legs.w / 2);
  const legs = ([[-1, 1], [1, 1], [-1, -1], [1, -1]] as const).map(([sx, sz], i) => {
    const g = new Grid(s);
    const cx = sx * (animal === 'chicken' ? 2 : 4), cz = sz < 0 ? -5 : 4;
    if (i < S.legs.count) {
      for (let x = cx - half; x < cx - half + S.legs.w; x++) for (let z = cz - half; z < cz - half + S.legs.w; z++) {
        for (let y = 1; y < S.legs.h; y++) {
          const sock = animal === 'horse' && y <= 5;
          g.set(x, y, z, animal === 'chicken' ? lin(K.hoof) : sock ? lin(K.point!) : bodyTone(x, y, z)!);
        }
        g.set(x, 0, z, lin(K.hoof));
      }
      if (animal === 'chicken') for (const dx of [-1, 0, 1]) for (let z = cz; z <= cz + 2; z++) g.set(cx + dx, 0, z, lin(K.hoof));
      else for (let x = cx - half; x < cx - half + S.legs.w; x++) g.set(x, 0, cz - half + S.legs.w, lin(K.hoof)); // the hoof splays a voxel forward
    }
    legGrids.push(g);
    return part(g, [(cx + 0.5) * s, S.legs.h * s, (cz + 0.5) * s]);
  }) as [Part, Part, Part, Part];

  // Cells the body must leave alone: the head (in its shifted rows), the legs.
  const taken = (x: number, y: number, z: number) => head.has(x, y - dy, z) || legGrids.some((g) => g.has(x, y, z));
  const faceWindow = (xm: number, ym: number, zm: number) => zm > 0.5 && Math.abs(xm - CX) < 0.16 && ym > 0.44 + dy * s && ym < 0.82 + dy * s;

  // ---- The body per coat level: one smooth ellipsoid that fills out a little with the wool balls, with the marks.
  const marks = (x: number, y: number, z: number, ym: number): RGB | null => {
    switch (animal) {
      case 'cow': return hash3(x >> 3, (y - 2) >> 3, z >> 3, 71) < 0.34 && hash3(x >> 1, y >> 1, z >> 1, 73) < 0.92 && ym > 0.42 ? pick([K.point!, '#55535A', K.point!], hash3(x, y, z, 75), [0.7, 0.9]) : null;
      case 'horse': return ym < S.body.c[1] - 0.12 ? lin(K.faceLight) : null;
      default: return null;
    }
  };
  const bodyAt = (level: 0 | 1 | 2 | 3 | 4): Grid => {
    const k = level === 0 ? 0.84 : 1 + (LEVEL_K[level] - 1) * 0.6;
    const g = new Grid(s);
    const paint: Paint = (x, y, z) => {
      if (taken(x, y, z)) return null;
      const xm = (x + 0.5) * s, ym = (y + 0.5) * s, zm = (z + 0.5) * s;
      if (ym < 0.02 || faceWindow(xm, ym, zm)) return null;
      return (level > 0 && marks(x, y, z, ym)) || bodyTone(x, y, z);
    };
    const r: V3 = [S.body.r[0] * k, S.body.r[1] * k, S.body.r[2] * k];
    ellipsoid(g, S.body.c, r, paint, 0.03, 7);
    if (animal === 'cow' && level > 0) ellipsoid(g, [CX, S.body.c[1] - S.body.r[1] * k + 0.02, -0.2], [0.08, 0.06, 0.06], (x, y, z) => (taken(x, y, z) ? null : lin(K.nose)), 0, 9); // udder
    if (animal === 'chicken') {
      // A wing a voxel proud on each flank, in the darker buff.
      for (const v of [...g.map.values()]) {
        const ym = (v.y + 0.5) * s, zm = (v.z + 0.5) * s;
        if (ym < 0.3 || ym > 0.46 || zm < -0.14 || zm > 0.1) continue;
        for (const sx of [-1, 1]) if (!g.has(v.x + sx, v.y, v.z) && Math.sign(v.x - CX / s) === sx && Math.abs(v.x) > 3) g.set(v.x + sx, v.y, v.z, lin(K.body[1]));
      }
    }
    if (animal === 'horse') {
      // The neck: a block stepping a voxel forward every two rows from the body's front top to the head, mane along it.
      for (let y = 19; y <= 25; y++) {
        const z0 = 2 + Math.floor((y - 19) / 2);
        for (let x = -2; x <= 2; x++) for (let z = z0; z <= z0 + 5; z++) if (!taken(x, y, z)) g.set(x, y, z, bodyTone(x, y, z)!);
        for (const x of [-1, 0]) for (const z of [z0 - 1, z0]) if (!taken(x, y + 1, z)) g.set(x, y + 1, z, lin(K.point!));
      }
    }
    return g;
  };
  const wools = {} as SheepModel['wools'];
  const frosts = {} as SheepModel['frosts'];
  for (const level of [1, 2, 3, 4] as const) {
    const g = bodyAt(level);
    wools[level] = part(g, [0, 0, 0]);
    const frost = new Grid(s);
    const rf = rng(57 + level);
    for (let n = 0; n < 30; n++) {
      const a = rf() * Math.PI * 2, b = rf() * 0.9;
      const x = Math.round((CX + Math.cos(a) * b * S.body.r[0]) / s), z = Math.round((Math.sin(a) * b * S.body.r[2]) / s);
      let y = Math.round(1.2 / s);
      while (y > 0 && !g.has(x, y, z)) y--;
      if (y > 0) frost.set(x, y + 1, z, lin(T.ice[0]));
    }
    frosts[level] = part(frost, [0, 0, 0]);
  }
  const sheared = bodyAt(0);

  // The hood slot carries the pig's beanie (between the ears, bobble on top); nothing on the others.
  const hood = new Grid(s);
  if (animal === 'pig') {
    for (let y = 23; y <= 25; y++) for (let x = -2; x <= 2; x++) for (let z = 8; z <= 12; z++) {
      if (y === 25 && (Math.abs(x) === 2 || z === 8 || z === 12)) continue;
      hood.set(x, y, z, lin(y === 23 ? '#2F4A50' : KNIT.teal));
    }
    hood.set(0, 26, 10, lin(KNIT.mustard));
  }

  // Tails, each pointing its own way: pig corkscrew up, cow rod down with a tuft, goat stub up, horse hair down,
  // hen a fan up.
  const tail = new Grid(s);
  const tx = Math.round(CX / s), ty = Math.round(S.tailPivot[1] / s), tz = Math.round(S.tailPivot[2] / s);
  const tp = (dx: number, dyy: number, dz: number, c: RGB) => tail.set(tx + dx, ty + dyy, tz + dz, c);
  switch (animal) {
    case 'pig': for (const [dx, dyy, dz] of [[0, 0, 0], [0, 1, -1], [1, 2, -1], [1, 2, -2], [0, 1, -2]]) tp(dx, dyy, dz, lin(K.body[1])); break;
    case 'cow': for (let k = 0; k < 7; k++) tp(0, -k, -1, lin(K.body[1])); for (const [dx, dyy] of [[0, -7], [-1, -8], [0, -8], [1, -8], [0, -9]]) tp(dx, dyy, -1, lin(K.point!)); break;
    case 'goat': for (let k = 0; k < 3; k++) tp(0, k, k === 2 ? -2 : -1, lin(K.body[1])); break;
    case 'horse': for (let k = 0; k < 9; k++) for (const dx of [-1, 0]) tp(dx, 1 - k, -1 - Math.floor(k / 4), lin(k % 3 === 2 ? '#57494A' : K.point!)); break;
    case 'chicken': for (const [dx, dyy, dz] of [[0, 1, -1], [0, 2, -2], [-1, 2, -2], [1, 2, -2], [0, 3, -3], [-1, 3, -3], [1, 3, -3], [-2, 3, -2], [2, 3, -2], [0, 4, -4]]) tp(dx, dyy, dz, lin(dyy >= 3 ? K.point! : K.body[1])); break;
  }

  // The accessory, in the collar slot (it does not fill out with the coat): the cow's leather strap, the goat's and
  // the hen's scarves below beard and wattle, the horse's blanket behind the mane.
  const collar = new Grid(s);
  const ring = (cz: number, rx: number, rz: number, rows: number[], tone: (k: number) => RGB) => {
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2;
      const x = Math.floor((CX + rx * Math.cos(a)) / s), z = Math.floor((cz + rz * Math.sin(a)) / s);
      for (const y of rows) collar.set(x, y, z, tone(k));
    }
  };
  switch (animal) {
    case 'cow': ring(0.42, 0.2, 0.2, [14, 15], () => lin(KNIT.leather)); break;
    case 'goat': ring(0.4, 0.17, 0.17, [10, 11], (k) => lin(Math.floor(k / 5) % 3 === 2 ? KNIT.cream : KNIT.mustard)); for (let y = 3; y <= 9; y++) for (const x of [3, 4]) collar.set(x, y, 12, lin(y % 3 === 1 ? KNIT.cream : KNIT.mustard)); break;
    case 'chicken': ring(0.3, 0.2, 0.17, [5, 6], (k) => lin(Math.floor(k / 5) % 3 === 2 ? KNIT.cream : KNIT.teal)); break;
    case 'horse': {
      // A blanket over the back from behind the neck to the rump, hanging a little down the flanks, cream trim.
      const top = bodyAt(2);
      for (const v of [...top.map.values()]) {
        const zm = (v.z + 0.5) * s, ym = (v.y + 0.5) * s;
        if (zm < -0.3 || zm > 0.02 || ym < S.body.c[1] - 0.06) continue;
        const outside = [[0, 1, 0], [1, 0, 0], [-1, 0, 0]].some(([dx, dyy, dz]) => !top.has(v.x + dx, v.y + dyy, v.z + dz));
        if (!outside) continue;
        const trim = zm < -0.26 || zm > -0.02 || ym < S.body.c[1] - 0.02;
        for (const [dx, dyy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0]]) if (!top.has(v.x + dx, v.y + dyy, v.z + dz)) collar.set(v.x + dx, v.y + dyy, v.z + dz, lin(trim ? KNIT.cream : KNIT.berry));
      }
      break;
    }
    default: break;
  }
  const bell = new Grid(s);
  if (animal === 'cow') {
    for (const [y, hw] of [[13, 0], [12, 1], [11, 1]] as const) for (let x = -hw; x <= hw; x++) for (const z of [15, 16]) bell.set(x, y, z, lin(KNIT.brass[y === 13 ? 0 : 1]));
    bell.set(0, 11, 17, lin(T.hoof[1]));
    bell.set(0, 10, 16, lin(KNIT.brass[1]));
  }

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, 14 + y, 17 + S.stretch + z, lin(EYE_WHITE));

  const parts = {
    wools, frosts, head: shifted(part(head, HEAD_PIVOT), dy), hood: shifted(part(hood, HEAD_PIVOT), dy), tail: part(tail, S.tailPivot), eyes, lids, brows, mouths, ears, legs,
    collar: part(collar, [0, 0, 0]), bell: part(bell, [CX, 0.44, 0.56]), sheared: part(sheared, [0, 0, 0]), breath: shifted(part(breath, [CX, 0.56, 0.68 + S.stretch * s]), dy),
    lobes: { body: 1, hood: 0, tail: 1 }, woolTones: 3,
  };
  const voxels = wools[2].voxels + parts.head.voxels + parts.hood.voxels + parts.tail.voxels + eyes[0].voxels + eyes[1].voxels + ears[0].voxels + ears[1].voxels + legs.reduce((n, l) => n + l.voxels, 0) + parts.collar.voxels + parts.bell.voxels;
  return { ...parts, voxels };
}
