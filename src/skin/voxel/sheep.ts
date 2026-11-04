import type { BufferGeometry } from 'three';
import { buildGeometry } from './mesher';
import { lin, pick, IRIS, PUPIL, T, WHITE } from './palette';
import { box, cone, ellipsoid, Grid, hash3, helix, line, norm, rng } from './primitives';
import type { Paint, V3 } from './primitives';

/** Characters are built on the 0.04 m grid (plan V3 Part 4.1). */
export const CHAR = 0.04;

export type Brows = 'neutral' | 'worried' | 'scared';
export type Mouth = 'flat' | 'smile' | 'grimace';

/** One geometry per moving part, with the point it pivots about (the geometry is built around that pivot). */
export interface Part { geo: BufferGeometry; pivot: V3; voxels: number }

export interface SheepModel {
  wool: Part;            // core, puffs, curls; scales with the wool level about its own centre
  tail: Part;
  head: Part;            // head block, nose, cheeks, forehead tuft
  eyes: [Part, Part];    // whites, iris, pupil and catchlight; each scales about its own centre
  lids: Part;            // closed eyelids, shown for blinks and sleep
  ears: [Part, Part];
  legs: [Part, Part, Part, Part]; // front left, front right, back left, back right
  collar: Part;
  bell: Part;
  sheared: Part;
  breath: Part;
  frost: Part;           // frost voxels over the wool's upper surface, shown while freezing
  brows: Record<Brows, Part>;
  mouths: Record<Mouth, Part>;
  /** Voxels before face culling across the default parts, for the plan's 9k to 14k budget. */
  voxels: number;
}

const wool3 = (seed: number): Paint => (x, y, z) => pick(T.wool, hash3(x, y, z, seed));
const tone = (t: readonly [string, string, string], seed: number, w?: [number, number]): Paint => (x, y, z) => pick(t, hash3(x, y, z, seed), w);

function part(g: Grid, pivot: V3): Part {
  const geo = buildGeometry(g.map, g.size);
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, voxels: g.count };
}

/** Points spread evenly over the upper and side surface of the wool core (a Fibonacci spiral, seeded jitter). */
function surfacePoints(n: number, c: V3, r: V3, seed: number, minY = -0.35): { p: V3; nrm: V3 }[] {
  const out: { p: V3; nrm: V3 }[] = [];
  const rand = rng(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const y = 1 - ((i + 0.5) / (n * 1.4)) * 2;
    if (y < minY) continue;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i + rand() * 0.4;
    const u: V3 = [Math.cos(th) * rad, y, Math.sin(th) * rad];
    out.push({ p: [c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], nrm: norm([u[0] / r[0], u[1] / r[1], u[2] / r[2]]) });
  }
  return out;
}

let cached: SheepModel | null = null;

/** The default sheep (plan V3 Part 5): one model for every player, built once and shared. */
export function sheepModel(): SheepModel {
  if (cached) return cached;
  const s = CHAR;
  const core: V3 = [0, 0.64, 0];
  const coreR: V3 = [0.42, 0.37, 0.55];

  // Wool: core, 22 puffs, 60 curls.
  const wool = new Grid(s);
  ellipsoid(wool, core, coreR, wool3(11), 0.12, 3);
  for (const { p } of surfacePoints(22, core, [coreR[0] * 0.92, coreR[1] * 0.92, coreR[2] * 0.92], 7)) {
    ellipsoid(wool, p, [0.17, 0.15, 0.17], wool3(13), 0.1, 5);
  }
  const curlPaint: Paint = (x, y, z) => pick(T.wool, hash3(x, y, z, 17) * 0.9);
  for (const { p, nrm } of surfacePoints(60, core, [coreR[0] + 0.1, coreR[1] + 0.09, coreR[2] + 0.1], 21, -0.2)) {
    helix(wool, p, nrm, curlPaint);
  }

  const tail = new Grid(s);
  ellipsoid(tail, [0, 0.7, -0.6], [0.15, 0.14, 0.14], wool3(23), 0.1, 9);
  for (const { p, nrm } of surfacePoints(3, [0, 0.7, -0.6], [0.16, 0.15, 0.15], 25)) helix(tail, p, nrm, curlPaint);

  // Head, with its features on the front face (z = 0.80).
  const head = new Grid(s);
  box(head, [-0.14, 0.62, 0.5], [0.14, 0.9, 0.8], tone(T.face, 31), 2);
  box(head, [-0.12, 0.84, 0.8], [0.12, 0.88, 0.84], tone(T.face, 33, [0.85, 1])); // brow ridge, lit from above
  const eyeFront = Math.round(0.8 / s); // first layer in front of the face
  const eyes = ([-1, 1] as const).map((sx) => {
    // A 3 x 3 eye one layer proud of the face: white rim, a 2 x 2 iris with two pupil voxels, a catchlight upper left.
    const eye = new Grid(s);
    const ex = Math.round((sx * 0.085) / s), ey = Math.round(0.76 / s);
    for (let x = ex - 1; x <= ex + 1; x++) for (let y = ey - 1; y <= ey + 1; y++) eye.set(x, y, eyeFront, lin(WHITE));
    const ix = sx > 0 ? ex - 1 : ex; // the iris sits toward the nose, so the sheep looks forward
    for (let x = ix; x <= ix + 1; x++) {
      eye.set(x, ey, eyeFront, lin(IRIS));
      eye.set(x, ey - 1, eyeFront, lin(PUPIL));
    }
    eye.set(ix, ey, eyeFront, lin(WHITE)); // catchlight
    return part(eye, [sx * 0.085, 0.76, 0.8]);
  }) as [Part, Part];
  ellipsoid(head, [0, 0.68, 0.81], [0.05, 0.035, 0.03], tone(T.pink, 35));
  const noseFront = Math.round(0.83 / s);
  head.set(-1, Math.round(0.68 / s), noseFront, lin(T.pink[2]));
  head.set(0, Math.round(0.68 / s), noseFront, lin(T.pink[2]));
  for (const sx of [-1, 1]) {
    const cx = Math.round((sx * 0.11) / s), cy = Math.round(0.7 / s);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) head.set(x, y, eyeFront - 1, lin(T.pink[1]));
  }
  // Forehead tuft with six curls.
  ellipsoid(head, [0, 0.98, 0.54], [0.22, 0.13, 0.2], wool3(37), 0.1, 11);
  for (const { p, nrm } of surfacePoints(6, [0, 0.98, 0.54], [0.23, 0.14, 0.21], 39, 0)) helix(head, p, nrm, curlPaint);
  const headPivot: V3 = [0, 0.66, 0.5];

  // Face expressions: brows at y 0.86 and the mouth at y 0.64, one layer in front of the face.
  const browRow = Math.round(0.86 / s);
  const brows = {} as Record<Brows, Part>;
  for (const kind of ['neutral', 'worried', 'scared'] as Brows[]) {
    const g = new Grid(s);
    for (const sx of [-1, 1]) {
      const cx = Math.round((sx * 0.085) / s);
      for (let i = -2; i <= 2; i++) {
        // neutral: flat; worried: the inner half lifts one voxel; scared: high and arched
        const inner = sx * i < 0;
        const lift = kind === 'neutral' ? 0 : kind === 'worried' ? (inner ? 1 : 0) : Math.abs(i) === 2 ? 1 : 2;
        g.set(cx + i, browRow + lift, eyeFront, lin(T.face[2]));
      }
    }
    brows[kind] = part(g, headPivot);
  }
  const mouthRow = Math.round(0.64 / s);
  const mouths = {} as Record<Mouth, Part>;
  for (const kind of ['flat', 'smile', 'grimace'] as Mouth[]) {
    const g = new Grid(s);
    if (kind === 'grimace') {
      for (let i = -3; i <= 3; i++) g.set(i, mouthRow + (i % 2 === 0 ? 0 : 1), eyeFront, lin(T.face[2]));
      g.set(-1, mouthRow, eyeFront, lin(WHITE));
      g.set(1, mouthRow, eyeFront, lin(WHITE));
    } else {
      for (let i = -2; i <= 2; i++) g.set(i, mouthRow + (kind === 'smile' && Math.abs(i) === 2 ? 1 : 0), eyeFront, lin(T.face[2]));
    }
    mouths[kind] = part(g, headPivot);
  }
  const lids = new Grid(s);
  for (const sx of [-1, 1]) {
    const ex = Math.round((sx * 0.085) / s), ey = Math.round(0.76 / s);
    for (let x = ex - 2; x <= ex + 1; x++) for (let y = ey - 1; y <= ey + 1; y++) lids.set(x, y, eyeFront + 1, lin(T.face[0]));
    for (let x = ex - 2; x <= ex + 1; x++) lids.set(x, ey - 1, eyeFront + 1, lin(T.face[2])); // lash line
  }

  // Ears: tapered boxes built pointing out along +x from the pivot, inner face pink; rotated by the component.
  const ears = ([-1, 1] as const).map((sx) => {
    const g = new Grid(s);
    const pivot: V3 = [sx * 0.15, 0.8, 0.56];
    for (let i = 0; i < Math.round(0.14 / s); i++) {
      const k = 1 - 0.45 * (i / (0.14 / s));
      const hw = Math.max(1, Math.round((0.08 / s) * k / 2));
      const x = Math.round(pivot[0] / s) + sx * i;
      for (let z = -hw; z < hw; z++) {
        g.set(x, Math.round(0.8 / s), Math.round(0.56 / s) + z, pick(T.face, hash3(x, 0, z, 41)));
        g.set(x, Math.round(0.8 / s) - 1, Math.round(0.56 / s) + z, z === -hw || z === hw - 1 ? pick(T.face, 0.5) : lin(T.pink[1]));
      }
    }
    return part(g, pivot);
  }) as [Part, Part];

  // Legs with a knee notch, and split hooves.
  const legs = ([[-0.19, 0.34], [0.19, 0.34], [-0.19, -0.3], [0.19, -0.3]] as const).map(([lx, lz]) => {
    const g = new Grid(s);
    box(g, [lx - 0.04, 0.04, lz - 0.04], [lx + 0.04, 0.34, lz + 0.04], tone(T.face, 43));
    const kx = Math.round((lx + 0.04) / s) - 1;
    g.del(kx, Math.round(0.18 / s), Math.round((lz + 0.04) / s) - 1); // knee notch
    box(g, [lx - 0.05, 0, lz - 0.05], [lx + 0.05, 0.06, lz + 0.05], tone(T.hoof, 45));
    const gx = Math.round(lx / s);
    for (let y = 0; y < Math.round(0.06 / s); y++) g.del(gx, y, Math.round((lz + 0.05) / s) - 1); // groove
    return part(g, [lx, 0.34, lz]);
  }) as [Part, Part, Part, Part];

  // Collar: a ring around the neck in the x/y plane at z 0.42, with a buckle; the bell hangs below.
  const collar = new Grid(s);
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const x = Math.round((0.3 * Math.cos(a)) / s), y = Math.round((0.56 + 0.19 * Math.sin(a)) / s);
    for (const dz of [0, 1]) collar.set(x, y, Math.round(0.42 / s) + dz, pick(T.collar, hash3(x, y, dz, 47)));
  }
  box(collar, [-0.06, 0.34, 0.42], [0.06, 0.4, 0.5], tone(T.brass, 49));
  const bell = new Grid(s);
  ellipsoid(bell, [0, 0.42, 0.62], [0.05, 0.05, 0.05], tone(T.brass, 51));
  bell.set(0, Math.round(0.36 / s), Math.round(0.62 / s), lin(T.brass[2])); // clapper
  bell.set(-1, Math.round(0.42 / s), Math.round(0.67 / s), lin(T.face[2])); // slit
  bell.set(0, Math.round(0.42 / s), Math.round(0.67 / s), lin(T.face[2]));

  const sheared = new Grid(s);
  ellipsoid(sheared, [0, 0.6, 0], [0.26, 0.25, 0.42], (x, y, z) => pick(T.skin, hash3(x, y, z, 53)));
  for (const v of [...sheared.map.values()]) {
    if (hash3(v.x, v.y, v.z, 55) < 0.08 && !sheared.has(v.x, v.y + 1, v.z)) sheared.set(v.x, v.y + 1, v.z, lin(T.wool[0])); // stubble
  }

  const breath = new Grid(s);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 1], [0, 0, 1], [1, 1, 1]]) breath.set(x, Math.round(0.72 / s) + y, Math.round(0.86 / s) + z, lin(WHITE));

  const frost = new Grid(s);
  const rf = rng(57);
  for (let i = 0; i < 30; i++) {
    const a = rf() * Math.PI * 2, b = rf() * 0.9;
    const x = Math.round((Math.cos(a) * b * coreR[0]) / s), z = Math.round((Math.sin(a) * b * coreR[2]) / s);
    let y = Math.round((core[1] + coreR[1] * 1.25) / s);
    while (y > 0 && !wool.has(x, y, z)) y--;
    frost.set(x, y + 1, z, lin(T.ice[0]));
  }

  const parts = {
    wool: part(wool, core), tail: part(tail, [0, 0.7, -0.5]), head: part(head, headPivot), eyes, lids: part(lids, headPivot),
    ears, legs, collar: part(collar, headPivot), bell: part(bell, [0, 0.47, 0.62]), sheared: part(sheared, core),
    breath: part(breath, [0, 0.72, 0.86]), frost: part(frost, core), brows, mouths,
  };
  const voxels = parts.wool.voxels + parts.tail.voxels + parts.head.voxels + eyes[0].voxels + eyes[1].voxels + ears[0].voxels + ears[1].voxels
    + legs.reduce((n, l) => n + l.voxels, 0) + parts.collar.voxels + parts.bell.voxels;
  cached = { ...parts, voxels };
  return cached;
}

/** Ice block parts for the freeze sequence: nine icicles hanging from the top edge and an uneven snow cap. */
export function iceDressing(size: V3): { icicles: BufferGeometry; cap: BufferGeometry } {
  const s = CHAR;
  const [w, h, d] = size;
  const ic = new Grid(s);
  const r = rng(61);
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.08 + (i / 8) * (w - 0.16);
    const len = 0.08 + r() * 0.14;
    cone(ic, [x, h / 2, d / 2], 0.035, len, -1, (xx, yy, zz) => pick(T.ice, hash3(xx, yy, zz, 63), [0.5, 0.85]));
  }
  const cap = new Grid(s);
  for (let x = Math.round(-w / 2 / s); x < Math.round(w / 2 / s); x++)
    for (let z = Math.round(-d / 2 / s); z < Math.round(d / 2 / s); z++) {
      const edge = Math.min(x - Math.round(-w / 2 / s), Math.round(w / 2 / s) - 1 - x, z - Math.round(-d / 2 / s), Math.round(d / 2 / s) - 1 - z);
      if (edge < 1 && hash3(x, 0, z, 65) < 0.35) continue; // uneven edge
      cap.set(x, Math.round(h / 2 / s), z, pick(T.snow, hash3(x, 1, z, 67)));
      if (hash3(x, 2, z, 69) < 0.25) cap.set(x, Math.round(h / 2 / s) + 1, z, lin(T.snow[0]));
    }
  return { icicles: buildGeometry(ic.map, s), cap: buildGeometry(cap.map, s) };
}

/** A wind curl: a flat voxel spiral of radius 0.25 m, 1 voxel thick. */
export function windCurl(): BufferGeometry {
  const g = new Grid(CHAR);
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 3.2;
    const rr = 0.25 * (1 - i / 140);
    line(g, [Math.cos(a) * rr, 0, Math.sin(a) * rr], [Math.cos(a) * rr, 0, Math.sin(a) * rr], () => lin(T.ice[0]));
  }
  return buildGeometry(g.map, CHAR);
}

/** Small voxel bits used by effects: a wool tuft (about 40 voxels) and a smoke puff. */
export function tuftGeometry(seed = 71): BufferGeometry {
  const g = new Grid(CHAR);
  ellipsoid(g, [0, 0, 0], [0.09, 0.07, 0.09], wool3(seed), 0.2, seed);
  return buildGeometry(g.map, CHAR);
}

