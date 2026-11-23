import type { Shot } from './layout';
import { buildGeometry, packGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { meanOf } from '../voxel/paint';
import { solid } from '../voxel/paint';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { detailed } from '../voxel/refine';
import { tieredPine } from './style/pine';

/**
 * The lobby is a sheep pen in a mountain meadow on a winter night: a three-rail fence with a shut gate, a hay rack and
 * a water trough along the back rail, a floor of flat snow. Round it, nothing built: pines,
 * boulders, bushes, the meadow rising to a wooded ridge, and mountains behind under the
 * moon. Everyone who has joined is inside until the host opens the gate. +y is up and the camera looks toward +z from
 * the gate side.
 *
 * Brian, 2026-11-14, twice: "make the scenery for the pen thing bigger and better ... also make it look more like an
 * actual pen", and then, of a pen with a barn and a silo behind it: "i said to make the pen better, higher quality
 * firstly no house, just make it more natural scenery everything needs to be better". So no buildings, and the camera
 * stands at a person's height, nearly level, so that the country behind the pen is in the picture and not just the
 * ground.
 *
 * Brian, 2026-11-22 (docs/pen/PEN-PLAN.md, section 8: the screen "looks too chunky and really unclear"): every player
 * stands on a straw mat (numbered until V3 9.2), the front side is posts and one low rail with a two-leaf gate in it, and the camera
 * looks down 20 degrees, so every face shows. The pen is drawn round its ten mats.
 */
export const PEN = {
  halfX: 3.8, halfZ: 4.6,
  /** The gate in the middle of the front side: two leaves, shut until the game starts. */
  gate: 1.6,
  /** The front side's one rail, at this height (the other three sides keep three). */
  frontRail: 0.35,
  /**
   * The tall lantern post at the back-left corner, and the small lantern on the front-right corner post (as the camera
   * sees it: the screen's right is -x). It was on the gate's right post and lit a bright patch on the snow in front of
   * the gate (docs/pen/PEN-PLAN-V3.md, 9.4).
   */
  lamp: [-3.8, 2.6, 4.6] as const,
  cornerLamp: [-3.8, 1.35, -4.6] as const,
  rack: [1.6, 0, 4.25] as const,
  trough: [-2.0, 0, 4.3] as const,
};

/**
 * The mats (section 8.1): two rows, the front one first, the back row set half a place over. A mat is 0.8 m across and
 * 1.1 m deep, not the plan's 0.4 m square: a sheep as the pen draws it stands 0.61 x 0.92 m (scene/placed.ts), turned
 * up to 10 degrees, and on a smaller mat it stood half on the snow. The places stay 1.2 m apart, the plan's 0.4 + 0.8. The
 * rows are 5 m apart: from 20 degrees up, a face on the back row then shows over the heads and plates in front
 * (measured at 1280 x 720 with ten players; at 4.4 m the front plates still reached the back row's chins).
 */
export const MATS = { w: 0.8, d: 1.1, gap: 0.4, front: -2.0, back: 3.0, perRow: 5, top: 0.05 } as const;

/**
 * Mat `i` of `max` (0 is mat 1): the front row holds 1 to 5 from left to right, the back row 6 to 10. The rows are set
 * half a place apart so a face on the back row shows between two heads in front. A sheep on it faces the camera,
 * turned up to 10 degrees toward the pen's middle (the model's front is +z; the camera is at -z).
 */
export function matSpot(i: number, max: number): { x: number; z: number; yaw: number } {
  const back = i >= MATS.perRow, rows = max > MATS.perRow;
  const n = back ? max - MATS.perRow : Math.min(max, MATS.perRow), col = back ? i - MATS.perRow : i;
  const step = MATS.w + MATS.gap;
  // The camera looks along +z, so the screen's left is +x: mat 1 is at the largest x.
  const x = -((col - (n - 1) / 2) * step + (rows ? (back ? 0.3 : -0.3) : 0));
  return { x, z: back ? MATS.back : MATS.front, yaw: Math.PI + Math.max(-1, Math.min(1, x / 2.7)) * (10 * Math.PI) / 180 };
}

/** Where a player's animal is on its way to: its mat, its heading, and when it arrived (for the drop). */
export interface PenPace { x: number; z: number; yaw: number; born: number }

/**
 * One frame of a player's animal (8.4), pure so a test can hold it to its mat: it drops onto its mat from 0.6 m with
 * a small squash as it lands (350 ms), walks to a new mat when the seats before it empty (with a little hop on the
 * way), hops off and shrinks away when its player leaves (300 ms), and turns to the gate when it opens. Under reduced
 * motion it simply appears and goes. `pace` is null on the first frame. At rest the group stands exactly on its mat's
 * centre, its feet on the mat's top.
 */
export function penStep(pace: PenPace | null, seat: number, max: number, now: number, dt: number, o: { reduced: boolean; opening: boolean; leaving?: boolean }) {
  const spot = matSpot(seat, max);
  const s = pace ?? { x: spot.x, z: spot.z, yaw: spot.yaw, born: now };
  const k = o.reduced ? 1 : Math.min(1, dt * 7);
  const far = Math.hypot(spot.x - s.x, spot.z - s.z);
  s.x += (spot.x - s.x) * k; s.z += (spot.z - s.z) * k;
  if (Math.hypot(spot.x - s.x, spot.z - s.z) < 1e-3) { s.x = spot.x; s.z = spot.z; }
  const aim = o.opening ? Math.atan2(0 - s.x, -PEN.halfZ - s.z) : spot.yaw;
  let turn = aim - s.yaw; turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  s.yaw += turn * (o.reduced ? 1 : Math.min(1, dt * 8));
  const t = (now - s.born) / (o.leaving ? 0.3 : 0.35);
  let y = o.reduced ? 0 : Math.min(0.3, far * 0.5), sy = 1, sxz = 1;
  if (!o.reduced && t < 1) {
    if (o.leaving) { y = 0.3 * Math.sin((t * Math.PI) / 2); sxz = sy = 1 - t; }
    else if (t < 0.7) y = 0.6 * (1 - (t / 0.7) ** 2);
    else { const q = Math.sin((Math.PI * (t - 0.7)) / 0.3); sy = 1 - 0.18 * q; sxz = 1 + 0.1 * q; }
  } else if (o.leaving) sxz = sy = 0.0001;
  return { pace: s, x: s.x, y: MATS.top + y, z: s.z, yaw: s.yaw, sy, sxz };
}

/** The camera looks down this much (section 8.2). */
export const PEN_PITCH = (20 * Math.PI) / 180;
/** Where the camera aims: the pen's middle, at a sheep's middle height. */
export const PEN_AIM = [0, 0.45, 0] as const;

/**
 * The shot from `dist` metres off the aim, looking down PEN_PITCH. The pen screen fits `dist` (and slides the picture)
 * so the pen and its plates fill the space between its panels (PenStage's `Frame`); `dist` here is its first guess.
 */
export function penShot(phone: boolean, dist = phone ? 17 : 14): Shot {
  const [x, y, z] = PEN_AIM;
  return { position: [x, y + Math.sin(PEN_PITCH) * dist, z - Math.cos(PEN_PITCH) * dist], target: [x, y, z], fov: phone ? 36 : 40 };
}

let built: ReturnType<typeof make> | null = null;
/** The static place, built once. */
export function buildPen() {
  return (built ??= make());
}

function make() {
  const made = { ground: ground(), land: land(), ...trees(), nature: nature(), mountains: mountains(), ...fence(), ...gate() };
  for (const g of Object.values(made)) packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
  return made;
}

/** The meadow is level round the pen; from ten metres behind it the ground climbs, in long swells, to the ridge. */
const hill = (x: number, z: number) => (z < 10 ? 0 : (z - 10) * 0.046 + (Math.sin(x * 0.07 + 1) + Math.sin(x * 0.031 + z * 0.05)) * 0.55 * Math.min(1, (z - 10) / 14));
const STRAW = ['#D8BE7A', '#C9AD68', '#B89A58'] as const;

/** The pen's floor: one flat snow colour, the mean of the snow round it (docs/pen/PEN-PLAN-V3.md, 9.5). */
const FLOOR = meanOf(['#F7F9FC', '#DCE6F2']);
/** The drift along the inside of the back and side fences: the same snow a step lighter. */
const DRIFT = meanOf(['#FFFFFF', '#EEF3F9']);

/**
 * The ground. Inside the rails the pen's floor is one flat snow colour, so the straw mats on it read as places (8.1;
 * the patches a shade apart read as a checkerboard, V3 P6). Outside, clean snow with soft drifts. Top surface at y = 0.
 */
function ground() {
  const g = new Grid(0.2);
  for (let gx = -60; gx <= 60; gx++) {
    for (let gz = -40; gz <= 45; gz++) {
      const x = gx * g.size, z = gz * g.size;
      const inside = Math.abs(x) < PEN.halfX && Math.abs(z) < PEN.halfZ;
      const r = hash3(gx, 0, gz, 3);
      let c: RGB = pick(T.snow, r, [0.5, 0.85]);
      if (inside) c = FLOOR;
      g.set(gx, -1, gz, c);
    }
  }
  const r = rng(7);
  for (let i = 0; i < 20; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 7;
    const w = 0.9 + r() * 1.8;
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7 + 1;
    if (Math.abs(x) < PEN.halfX + 2 && z < 6) continue; // not against the pen
    ellipsoid(g, [x, -0.1, z], [w, 0.34, w * 0.7], (px, py, pz) => pick(T.snow, hash3(px, py, pz, 9), [0.55, 0.9]), 0.15, i + 1);
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** The country beyond the near ground: snow on the swells of `hill`, out to the ridge and well to either side. */
/** The land beyond the pen and the mountain wall: one colour a layer, the average of the two each cube was one of (docs/miniature/07, treatment B). */
const LAND = meanOf(['#E6EDF6', '#D5DFEC']), PEAK_SNOW = meanOf(['#E3EAF5', '#C9D5E6']), PEAK_ROCK = meanOf(['#6B7790', '#5A657C']);

function land() {
  const g = new Grid(1);
  for (let x = -90; x <= 90; x++) {
    for (let z = -22; z <= 96; z++) {
      if (Math.abs(x) < 12 && z > -8 && z < 9) continue; // the near ground is finer, and its own
      const top = Math.round(hill(x, z)) - 1;
      for (let y = top - 2; y <= top; y++) g.set(x, y, z, LAND);
    }
  }
  return buildGeometry(g.map, g.size);
}

type Tree = readonly [x: number, z: number, height: number];
/** The pines round the pen, near enough to be drawn fine. */
const NEAR_PINES: readonly Tree[] = [[-11.5, 7, 9], [12.5, 8, 9.5], [-9.2, 4.6, 3.4], [9.8, 5.4, 3.8],
  [-5.2, 7.2, 2.6], [3.2, 11.2, 3], [-2.6, 16, 3.4], [-12, 17, 4.6], [11.5, 19, 4.4]];
/** A pine: the diorama's tiered pine (style/pine.ts), on the highest land under its trunk. */
function pine(g: Grid, [x, z, h]: Tree, _i: number) {
  // On the land's top (land(): whole metres, each 1 m cell at its own corner's height), on the highest cell under the
  // trunk: at hill(x, z) itself a pine stood up to a metre over the snow or sank into it.
  const s = g.size, lo = (v: number) => Math.floor(Math.round((v - s) / s) * s), hi = (v: number) => Math.ceil(Math.round((v + s) / s) * s) - 1;
  let y0 = -Infinity;
  for (let cx = lo(x); cx <= hi(x); cx++) for (let cz = lo(z); cz <= hi(z); cz++) y0 = Math.max(y0, Math.round(hill(cx, cz)));
  tieredPine((a, b, c, col) => g.set(a, b, c, col), (a, b, c) => g.has(a, b, c), Math.round(x / s), Math.round(z / s), Math.round(y0 / s), h, s);
}

/**
 * The trees. Close by, drawn fine: tall pines either side of the pen that frame the picture and young ones in the
 * meadow behind. Far off, drawn coarse: the wood along the ridge.
 */
function trees() {
  const near = new Grid(0.25), far = new Grid(0.5);
  const r = rng(17);
  NEAR_PINES.forEach((t, i) => pine(near, t, i));
  for (let i = 0; i < 64; i++) {
    const x = (r() * 2 - 1) * 78, z = 34 + r() * 56;
    pine(far, [x, z, 3.8 + r() * 2.6], 40 + i);
  }
  return { trees: buildGeometry(near.map, near.size), wood: buildGeometry(far.map, far.size) };
}

/** The clumps of dead grass: x, z and blades. Outside the pen's back corners, and beside the pines either side of it. */
export const STALKS: readonly (readonly [x: number, z: number, blades: number])[] = [[4.5, 5.3, 7], [-4.6, 5.2, 6], [-7.6, 3.4, 8], [8.1, 4.1, 5]];

/**
 * What lies about on the ground: boulders with snow on them, low evergreen bushes, and dead grass standing
 * through the snow of the meadow.
 */
function nature() {
  const g = new Grid(0.125);
  const snowTop = (a: number, b: number, c: number) => pick(T.snow, hash3(a, b, c, 61), [0.55, 0.9]);
  ([[-6.7, -0.9, 0.7], [-7.5, 0.2, 0.45], [6.9, 1.4, 0.8], [-9.6, 6.4, 1]] as const).forEach(([x, z, w], i) => {
    ellipsoid(g, [x, w * 0.45, z], [w, w * 0.7, w * 0.8], (a, b, c) => pick(T.stone, hash3(a >> 1, b >> 1, c >> 1, 62 + i), [0.45, 0.8]), 0.2, 3 + i);
    ellipsoid(g, [x, w * 1.02, z], [w * 0.8, w * 0.22, w * 0.62], snowTop, 0.15, 13 + i);
  });
  ([[6.7, -1.7, 0.55], [-6.5, 3.2, 0.65]] as const).forEach(([x, z, w], i) => {
    ellipsoid(g, [x, w * 0.6, z], [w, w * 0.7, w], (a, b, c) => pick(T.pine, hash3(a >> 1, b, c >> 1, 64 + i)), 0.3, 23 + i);
    ellipsoid(g, [x, w * 1.15, z], [w * 0.85, w * 0.28, w * 0.85], snowTop, 0.25, 33 + i);
  });
  // Dead grass standing through the snow, gathered into a few deliberate clumps (docs/pen/PEN-PLAN-V3.md, 9.6: stalks
  // sprinkled over the meadow read as litter): STALKS, each its count of blades, the tallest in the middle.
  STALKS.forEach(([cx, cz, n], k) => {
    for (let b = 0; b < n; b++) {
      const a = (b / n) * Math.PI * 2 + hash3(k, b, 0, 70), r = b === 0 ? 0 : 0.12 + hash3(k, b, 1, 71) * 0.2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const h = 0.2 + (1 - r / 0.32) * 0.2 + hash3(k, b, 2, 72) * 0.1;
      box(g, [x, hill(x, z), z], [x + 0.125, hill(x, z) + h, z + 0.125], (p, q, w) => pick(STRAW, hash3(p, q, w, 75)));
    }
  });
  return buildGeometry(g.map, g.size);
}

/** The range behind everything: far, tall and blue with distance, snow from the shoulders up, a saddle for the moon. */
function mountains() {
  const g = new Grid(4);
  for (let x = -75; x <= 75; x++) {
    const wx = x * 4;
    const saddle = Math.exp(-(((wx + 70) / 46) ** 2)) * 15;
    const top = 16 + Math.abs(Math.sin(wx * 0.0125 + 0.9)) * 16 + Math.sin(wx * 0.041) * 5 + hash3(x, 0, 0, 81) * 4 - saddle;
    for (let y = 0; y * 4 < top; y++) {
      const high = y * 4 > top - 9 - hash3(x, y, 0, 82) * 5;
      g.set(x, y, 78, high ? PEAK_SNOW : PEAK_ROCK);
    }
  }
  return buildGeometry(g.map, g.size);
}

/**
 * The pen itself: posts every metre and a quarter, three rails at the back and the sides, and at the front (the side
 * nearest the camera) short posts and one rail at PEN.frontRail, so every face shows over it; two posts for the gate
 * (its leaves are `gate()`, apart, so they can swing); the hay rack and the water trough along the back; a low drift
 * along the inside of the back and the sides; and two lanterns, one on the tall post at the back corner and a small one
 * on the front-right corner post.
 */
function fence() {
  const g = new Grid(0.1);
  const glow = new Grid(0.1), dim = new Grid(0.1);
  const wood = (a: number, b: number, c: number) => pick(T.beam, hash3(a >> 1, b, c >> 1, 31), [0.45, 0.85]);
  const dark = (a: number, b: number, c: number) => pick(T.trunk, hash3(a >> 1, b, c >> 1, 32), [0.45, 0.85]);
  const snow = (a: number, b: number, c: number) => (hash3(a, b, c, 33) > 0.22 ? pick(T.snow, hash3(a, 0, c, 35)) : null);
  const iron = () => lin('#3B3734');
  const X = PEN.halfX, Z = PEN.halfZ, G = PEN.gate / 2;
  const RAILS = [0.2, 0.45, 0.7];
  const post = (x: number, z: number, h = 0.9) => {
    if (h <= 0) return;
    box(g, [x - 0.1, 0, z - 0.1], [x + 0.1, h, z + 0.1], dark);
    box(g, [x - 0.1, h, z - 0.1], [x + 0.1, h + 0.1, z + 0.1], (a, b, c) => pick(T.snow, hash3(a, b, c, 37)));
  };
  // Snow lies along the top rail at the back and the sides; the front is one bare rail, low, so it hides nobody.
  const railX = (x0: number, x1: number, z: number, front = false) => {
    for (const y of front ? [PEN.frontRail - 0.05] : RAILS) box(g, [x0, y, z - 0.05], [x1, y + 0.1, z + 0.05], wood);
    if (!front) box(g, [x0, 0.8, z - 0.05], [x1, 0.9, z + 0.05], snow);
  };
  const railZ = (z0: number, z1: number, x: number) => {
    for (const y of RAILS) box(g, [x - 0.05, y, z0], [x + 0.05, y + 0.1, z1], wood);
    box(g, [x - 0.05, 0.8, z0], [x + 0.05, 0.9, z1], snow);
  };
  railX(-X, X, Z);
  railZ(-Z, Z, -X);
  railZ(-Z, Z, X);
  railX(-X, -G, -Z, true);
  railX(G, X, -Z, true);
  // Posts: at the back every 1.25 m; along the front, short ones, the two from the corners in to the gate's posts.
  for (let x = -X; x <= X + 0.01; x += 1.25) post(x, Z);
  for (const x of [-X + 1.5, -G - 0.75, G + 0.75, X - 1.5]) post(x, -Z, 0.5);
  for (let z = -Z + 1.2; z < Z - 0.3; z += 1.2) { post(-X, z); post(X, z); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * X, sz * Z, 1.1);
  // The gate's posts, a little taller than its leaves.
  for (const s of [-1, 1]) post(s * G, -Z, 0.8);
  // Hay rack on the back rail: a slatted crib full of hay, snow on top, hay dropped under it.
  const [rx, , rz] = PEN.rack;
  for (const sx of [-1.0, 1.0]) for (const sz of [-0.25, 0.25]) box(g, [rx + sx - 0.05, 0, rz + sz - 0.05], [rx + sx + 0.05, 1.0, rz + sz + 0.05], dark);
  box(g, [rx - 1.05, 0.45, rz - 0.3], [rx + 1.05, 0.55, rz + 0.3], wood);
  for (let sx = -0.9; sx <= 0.91; sx += 0.3) box(g, [rx + sx - 0.03, 0.55, rz - 0.3], [rx + sx + 0.03, 0.95, rz - 0.24], wood);
  box(g, [rx - 1.05, 0.9, rz - 0.3], [rx + 1.05, 1.0, rz - 0.22], wood);
  box(g, [rx - 0.95, 0.55, rz - 0.24], [rx + 0.95, 0.98, rz + 0.25], (a, b, c) => pick(T.hay, hash3(a, b, c, 41), [0.4, 0.85]));
  box(g, [rx - 0.95, 0.98, rz - 0.22], [rx + 0.95, 1.08, rz + 0.25], snow);
  box(g, [rx - 0.8, 0, rz - 0.75], [rx + 0.7, 0.1, rz - 0.35], (a, b, c) => (hash3(a, b, c, 43) > 0.35 ? pick(T.hay, hash3(a, b, c, 45)) : null));
  // Water trough: a long wooden box, the water iced over.
  const [tx, , tz] = PEN.trough;
  box(g, [tx - 0.9, 0, tz - 0.3], [tx + 0.9, 0.5, tz + 0.3], wood);
  box(g, [tx - 0.8, 0.4, tz - 0.2], [tx + 0.8, 0.5, tz + 0.2], (a, b, c) => pick(T.ice, hash3(a, b, c, 49)));
  // The tall lantern post at the back corner: a post, an arm, the lantern hanging from it.
  const [lx, ly, lz] = PEN.lamp;
  box(g, [lx - 0.1, 1.1, lz - 0.1], [lx + 0.1, ly + 0.5, lz + 0.1], dark);
  box(g, [lx - 0.1, ly + 0.4, lz - 0.8], [lx + 0.1, ly + 0.5, lz - 0.1], dark);
  box(g, [lx - 0.1, ly + 0.5, lz - 0.8], [lx + 0.1, ly + 0.6, lz + 0.1], snow);
  // An iron lid on the glass, one cell thick and as wide as the glass, and the hanger on it. A hanger one cell thick
  // reached down to the glass, but the finer detail takes the corners off its end, so the glass hung 0.05 m under it.
  box(g, [lx - 0.15, ly + 0.2, lz - 0.8], [lx + 0.15, ly + 0.3, lz - 0.5], iron);
  box(g, [lx - 0.05, ly + 0.3, lz - 0.7], [lx + 0.05, ly + 0.4, lz - 0.6], iron);
  box(glow, [lx - 0.15, ly - 0.15, lz - 0.8], [lx + 0.15, ly + 0.2, lz - 0.5], (a, b, c) => pick(T.lantern, hash3(a, b, c, 47)));
  // The small lantern sitting on the front-right corner post's snow cap, in its own mesh: it glows too dimly to bloom.
  const [qx, qy, qz] = PEN.cornerLamp;
  box(dim, [qx - 0.1, qy - 0.15, qz - 0.1], [qx + 0.1, qy + 0.1, qz + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 48)));
  // A drift one M cell (0.1 m) high along the inside of the back and side rails, wider where the wind leaves more. In
  // its own grid and never refined: the refine step takes a low slab's edges off and it reads as two stacked planks.
  const drift = new Grid(0.1);
  const reach = (t: number) => 0.3 + 0.1 * (Math.sin(t * 1.7) + 1); // 0.3 to 0.5 m out from the rail
  for (let gx = Math.round(-X / 0.1); gx < Math.round(X / 0.1); gx++) {
    for (let gz = Math.round(-Z / 0.1); gz < Math.round(Z / 0.1); gz++) {
      const x = (gx + 0.5) * 0.1, z = (gz + 0.5) * 0.1;
      const back = Z - z < reach(x), side = X - Math.abs(x) < reach(z + (x > 0 ? 2 : 0)) && z > -Z + 1.2;
      if (back || side) drift.set(gx, 0, gz, DRIFT);
    }
  }
  const fine = detailed(g.map, g.size);
  return { fence: buildGeometry(fine.map, fine.size), glow: buildGeometry(glow.map, glow.size), dimGlow: buildGeometry(dim.map, dim.size), drift: buildGeometry(drift.map, drift.size) };
}

/**
 * The gate's two leaves (section 8.2), 1.6 m across in all, as tall as the front rail with a board over it: a stile at
 * each end, a bottom board, a board at the rail's height and a top board, a brace from the hinge's foot to the far top.
 * Each is built about its hinge (local x = 0 at the post), the left leaf out along +x, the right along -x, so PenStage
 * can swing them outward when the game starts.
 */
function gate() {
  const leaf = (dir: 1 | -1) => {
    const g = new Grid(0.1);
    const wood = (a: number, b: number, c: number) => pick(T.beam, hash3(a >> 1, b, c >> 1, 31), [0.45, 0.85]);
    const dark = (a: number, b: number, c: number) => pick(T.trunk, hash3(a >> 1, b, c >> 1, 32), [0.45, 0.85]);
    const span = (x0: number, x1: number): [number, number] => (dir > 0 ? [x0, x1] : [-x1, -x0]);
    const piece = (x0: number, y0: number, x1: number, y1: number, col = wood) => { const [a, b] = span(x0, x1); box(g, [a, y0, -0.05], [b, y1, 0.05], col); };
    const W = PEN.gate / 2;
    piece(0.1, 0, 0.2, 0.6); piece(W - 0.1, 0, W, 0.6); // the stiles reach the ground: the leaf stands, it does not hang in the air
    piece(0.2, 0.1, W - 0.1, 0.2); piece(0.2, PEN.frontRail - 0.05, W - 0.1, PEN.frontRail + 0.05); piece(0.1, 0.5, W, 0.6);
    for (let k = 0; k <= 4; k++) piece(0.2 + k * 0.1, 0.2 + k * 0.06, 0.3 + k * 0.1, 0.3 + k * 0.06, dark);
    const fine = detailed(g.map, g.size);
    return buildGeometry(fine.map, fine.size);
  };
  return { gateL: leaf(1), gateR: leaf(-1) };
}

const matsBuilt = new Map<number, ReturnType<typeof makeMats>>();
/** The `max` straw mats on the pen's floor, built once for each size of table (10, or 4 at a ranked one). */
export function buildMats(max: number) {
  let m = matsBuilt.get(max);
  if (!m) matsBuilt.set(max, (m = makeMats(max)));
  return m;
}

/**
 * Each mat MATS.w x MATS.d and one small cell (0.05 m) thick, straw with a rim of straw a step darker. No numbers
 * (docs/pen/PEN-PLAN-V3.md, 9.2): the list and the pen are tied together by the name plates.
 */
function makeMats(max: number) {
  const g = new Grid(0.05);
  const straw = solid('straw'), rim = solid('straw', -1);
  const hw = MATS.w / 2, hd = MATS.d / 2;
  for (let i = 0; i < max; i++) {
    const { x, z } = matSpot(i, max);
    box(g, [x - hw, 0, z - hd], [x + hw, MATS.top, z + hd], (a, _b, c) => {
      const edge = Math.abs(a * 0.05 + 0.025 - x) > hw - 0.05 || Math.abs(c * 0.05 + 0.025 - z) > hd - 0.05;
      return edge ? rim : straw;
    });
  }
  const out = { mats: buildGeometry(g.map, g.size) };
  packGeometry(out.mats);
  return out;
}
