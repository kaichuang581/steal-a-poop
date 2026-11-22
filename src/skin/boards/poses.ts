import { Euler, Matrix4, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { santaHat } from '../scene/festive';
import { SHEEP_SCALE } from '../scene/layout';
import { __rig, HATS, tailLiftOf } from '../table/Sheep';
import type { RigPose } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { anchorsOf } from '../voxel/animals/anchors';
import type { AnimalModel, Species } from '../voxel/animals/rig';
import { CRATE } from './island';

/**
 * The leaderboards' three poses (docs/leaderboards/LEADERBOARDS-PLAN-V3.md, section 3, Brian, 2026-11-22), for this stage
 * only: `lbChampion` (first, the trophy held up, a hop), `lbGoodSport` (second, sitting on the edge, clapping, its hind
 * legs swinging) and `lbNap` (third, asleep as a loaf, chin on its hooves). Each is data: a rest pose and keyframes in
 * the plan's own words (degrees, from the avatar's rest pose; section 1 of the plan says which way each turns), and
 * waves laid over them. `sample` reads them at a time; `rigOf` turns the result into the rotations and offsets the
 * Sheep component applies to its parts (`RigPose`); `placement` finds where each species stands on its crate so the
 * parts that bear its weight touch the top. Pure: no React, no scene.
 */

export type Place = 1 | 2 | 3;
export type Stance = 'rear' | 'sit' | 'loaf';
export type Ease = 'linear' | 'in' | 'out' | 'inOut';

/** A pose in the plan's words. Angles in degrees; lengths in H (the avatar's height standing on four legs). */
export interface PlanPose {
  /** The body's tip from upright (rear, sit) or from level (loaf): + the top moves away from the camera. */
  tip: number;
  /** Each hind leg's swing (0 hangs straight down, + the hoof toward the camera) and the pair's spread (+ apart). */
  hindL: number; hindR: number; hindSpread: number;
  /** Each front leg's swing (0 down, 90 toward the camera, 180 straight up), how far the pair turns in, and a roll of both toward screen right. */
  frontL: number; frontR: number; frontIn: number; frontRoll: number;
  /** The head: + tips forward (nods), + turns toward screen right, + leans toward screen right; and rises (H). */
  headTip: number; headTurn: number; headLean: number; headRise: number;
  /** + perks the ears up, - droops them. */
  ears: number;
  /** + lifts the tail. */
  tail: number;
  /** Squash and stretch about the contact point (Y; X and Z by its inverse root), and a pulse of the whole avatar. */
  squash: number; pulse: number;
  /** The hop (H up), and the trophy's own lift (H) and roll (degrees, + toward screen right). */
  lift: number; trophyLift: number; trophyRoll: number;
}
export interface PoseDef {
  name: 'lbChampion' | 'lbGoodSport' | 'lbNap';
  stance: Stance;
  /** The whole avatar's turn: + its front toward screen right. */
  turn: number;
  lids: 'open' | 'closed';
  loop: number;
  rest: PlanPose;
  /** Keyframes: the value at `t`, reached from the key before with `ease`. Fields a key leaves out hold their last value. */
  keys: { t: number; ease?: Ease; set: Partial<PlanPose> }[];
  /** Waves laid over the keys: between `from` and `to` seconds, `amp` times the shape (`sine`: `cycles` full waves;
   * `bump`: up and back down `cycles` times; `clap`: open and closed twice, starting and ending closed). `every`: only
   * on every n-th loop. */
  waves: { field: keyof PlanPose; from: number; to: number; amp: number; shape: 'sine' | 'bump' | 'clap'; cycles: number; every?: number }[];
}

const REST: PlanPose = {
  tip: 0, hindL: 0, hindR: 0, hindSpread: 0, frontL: 0, frontR: 0, frontIn: 0, frontRoll: 0,
  headTip: 0, headTurn: 0, headLean: 0, headRise: 0, ears: 0, tail: 0, squash: 1, pulse: 1, lift: 0, trophyLift: 0, trophyRoll: 0,
};

/**
 * 3.3: the trophy held up over the head; crouch, hop, land, settle, wiggle the trophy, breathe. 2.4 s. The front legs
 * swing up 160 degrees as written, but turn OUT 20 degrees, not in 12: every model's legs are short (a sheep's reach its
 * chin when raised), so turned in they met in front of the mouth and hid the face, which 3.3 says stays fully visible.
 * Turned out they frame the face, and the trophy hangs over the hat as the plan places it (0.06 H above it).
 */
export const CHAMPION: PoseDef = {
  name: 'lbChampion', stance: 'rear', turn: 0, lids: 'open', loop: 2.4,
  rest: { ...REST, tip: 4, hindSpread: 6, frontL: 178, frontR: 178, frontIn: -42, headTip: -6, ears: 20, tail: 25 },
  keys: [
    { t: 0.16, ease: 'inOut', set: { squash: 0.94 } },
    { t: 0.4, ease: 'out', set: { lift: 0.2, squash: 1.04, trophyLift: 0.04 } },
    { t: 0.62, ease: 'in', set: { lift: 0, squash: 1, trophyLift: 0 } },
    { t: 0.7, ease: 'linear', set: { squash: 0.93 } },
    { t: 0.86, ease: 'out', set: { squash: 1 } },
  ],
  waves: [
    { field: 'trophyRoll', from: 0.86, to: 1.36, amp: 8, shape: 'sine', cycles: 2 },
    { field: 'frontRoll', from: 0.86, to: 1.36, amp: 8, shape: 'sine', cycles: 2 },
    { field: 'squash', from: 1.36, to: 2.4, amp: 0.015, shape: 'bump', cycles: 1 },
  ],
};

/** 3.4: sat on the edge, turned to the winner, two claps, the hind legs swinging, the head looking up and back. 3.0 s. */
export const GOOD_SPORT: PoseDef = {
  name: 'lbGoodSport', stance: 'sit', turn: 10, lids: 'open', loop: 3,
  rest: { ...REST, tip: 6, hindL: 40, hindR: 40, frontL: 70, frontR: 70, frontIn: 20, headTip: 4, headTurn: 12 },
  keys: [],
  waves: [
    // Two claps: the front legs spread 22 degrees each and close, touching at 0.15 and 0.45 s.
    { field: 'frontIn', from: 0, to: 0.6, amp: -22, shape: 'clap', cycles: 2 },
    // At each touch the body pulses to 1.02 for 0.06 s and the head nods 4 degrees.
    { field: 'pulse', from: 0.12, to: 0.18, amp: 0.02, shape: 'bump', cycles: 1 },
    { field: 'pulse', from: 0.42, to: 0.48, amp: 0.02, shape: 'bump', cycles: 1 },
    { field: 'headTip', from: 0.12, to: 0.18, amp: 4, shape: 'bump', cycles: 1 },
    { field: 'headTip', from: 0.42, to: 0.48, amp: 4, shape: 'bump', cycles: 1 },
    // The hind legs swing 12 degrees either way, opposite to each other, a full swing every 1.5 s.
    { field: 'hindL', from: 0, to: 3, amp: 12, shape: 'sine', cycles: 2 },
    { field: 'hindR', from: 0, to: 3, amp: -12, shape: 'sine', cycles: 2 },
    // The head turns from 12 to 4 degrees toward the winner and back.
    { field: 'headTurn', from: 0.6, to: 3, amp: -8, shape: 'bump', cycles: 1 },
  ],
};

/** 3.5: a loaf, chin on its front hooves, eyes shut, ears down, breathing; an ear twitches every third loop. 3.2 s. */
export const NAP: PoseDef = {
  name: 'lbNap', stance: 'loaf', turn: -25, lids: 'closed', loop: 3.2,
  rest: { ...REST, hindL: 90, hindR: 90, frontL: 90, frontR: 90, frontIn: 15, headTip: 18, headLean: 10, ears: -30 },
  keys: [],
  waves: [
    { field: 'squash', from: 0, to: 3.2, amp: 0.035, shape: 'bump', cycles: 1 },
    { field: 'headRise', from: 0, to: 3.2, amp: 0.012, shape: 'bump', cycles: 1 },
    { field: 'ears', from: 1.6, to: 1.8, amp: 15, shape: 'bump', cycles: 1, every: 3 },
  ],
};

export const POSES: Record<Place, PoseDef> = { 1: CHAMPION, 2: GOOD_SPORT, 3: NAP };
/** When each place's loop starts on the screen's clock, so the three big moments never land together (3.1). */
export const STAGGER: Record<Place, number> = { 1: 0, 2: 0.8, 3: 1.6 };

const ease = (e: Ease, u: number) => e === 'in' ? u * u : e === 'out' ? 1 - (1 - u) ** 2 : e === 'inOut' ? (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2) : u;
const FIELDS = Object.keys(REST) as (keyof PlanPose)[];

/** The pose at `t` seconds into its loop (`loopIndex` counts the loops, for the waves that come only every n-th one). */
export function sample(def: PoseDef, t: number, loopIndex = 0, out: PlanPose = { ...REST }): PlanPose {
  const u = ((t % def.loop) + def.loop) % def.loop;
  for (const f of FIELDS) {
    let v = def.rest[f], at = 0;
    for (const k of def.keys) {
      const target = k.set[f] ?? v;
      if (u >= k.t) { v = target; at = k.t; continue; }
      if (target !== v) v += (target - v) * ease(k.ease ?? 'linear', (u - at) / (k.t - at));
      break;
    }
    // Past the last key the pose eases back to rest by the loop's end (each loop starts and ends at rest).
    const last = def.keys[def.keys.length - 1];
    if (last && u > last.t && v !== def.rest[f]) v += (def.rest[f] - v) * ease('out', (u - last.t) / (def.loop - last.t));
    out[f] = v;
  }
  for (const w of def.waves) {
    if (u < w.from || u > w.to || (w.every && loopIndex % w.every !== 0)) continue;
    const s = (u - w.from) / (w.to - w.from);
    const shape = w.shape === 'sine' ? Math.sin(2 * Math.PI * w.cycles * s)
      : w.shape === 'bump' ? (1 - Math.cos(2 * Math.PI * w.cycles * s)) / 2
      : (0.5 + 0.5 * Math.cos(2 * Math.PI * w.cycles * s)) * Math.sin(Math.PI * s);
    out[w.field] += w.amp * shape;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// From the plan's words to the rig
// ---------------------------------------------------------------------------------------------------------------------

const RAD = Math.PI / 180;
const { RANGES } = __rig;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The body's turn about x for a stance and tip (radians): upright stances stand the front up, a loaf stays level. The hen
 * already stands on its two legs: "upright" for her is her own stance with the chest lifted (20 degrees rearing, 30 sitting),
 * or she would stand on her tail with her body under her feet.
 */
export const bodyPitch = (stance: Stance, tip: number, species: Species = 'sheep') =>
  (stance === 'loaf' ? tip : species === 'chicken' ? -((stance === 'rear' ? 16 : 24) + tip) : -(90 + tip)) * RAD;

/**
 * Per-species touches the generic rig cannot know: how far a tucked leg slides up into the body, how far forward the
 * loaf's front hooves reach, and (the chicken) that its own two legs are the model's first pair and its wings play the
 * front legs (3.2).
 */
interface Fit {
  headOffset: [number, number, number]; frontReach: number; tuck: number; tail: number;
  /** Where a pair of legs is rooted, moved from the model's own pivots inside the body (body-local model units; x is
   * outward from the middle line). The models' legs are short (a sheep's is 0.16 of its height): reared up, the
   * champion's shoulders sit at its chest's top corners so its raised legs frame its head; sitting, the second's hips
   * sit at the front of its rump so its legs reach over the crate's edge. */
  frontAt: [number, number, number]; hindAt: [number, number, number];
  /** The second's hind legs: their rest swing (degrees) and how much of the plan's 12 degree swing they take, where the
   * plan's 40 would put a hoof through the crate's top before it passes the front edge (3.2: adjust only the part that
   * collides). */
  hindRest?: number; hindAmp?: number;
}

/**
 * The rotations and offsets of every part for a pose (radians, model units), in the frame the Sheep component applies
 * them: the body group about the model's origin, each leg about its own pivot, the head about its pivot inside the
 * body. `fit` carries the per-species solve (the loaf's chin on its hooves) from `placement`.
 */
export function rigOf(model: AnimalModel, def: PoseDef, p: PlanPose, fit?: Fit, out?: RigPose): RigPose {
  const species = model.species;
  const a = bodyPitch(def.stance, p.tip, species);
  const r = out ?? emptyRig();
  r.body[0] = a; r.body[1] = 0; r.body[2] = 0;
  r.bodyAt[0] = 0; r.bodyAt[1] = 0; r.bodyAt[2] = 0;
  // A leg's swing in the world, from straight down toward the camera, is its own turn plus the body's.
  const swing = (deg: number) => -deg * RAD - a;
  // Turning in moves the hoof toward the middle line: + about z for a leg on the -x side, - on the +x side.
  const side = (i: number) => (model.legs[i].pivot[0] < (model.legs[0].pivot[0] + model.legs[1].pivot[0]) / 2 ? 1 : -1);
  const chicken = species === 'chicken';
  const hind = chicken ? [0, 1] : [2, 3], front = chicken ? [] : [0, 1];
  const tuck = def.stance === 'loaf' ? fit?.tuck ?? 0 : 0;
  for (let i = 0; i < 4; i++) { r.legs[i][0] = 0; r.legs[i][1] = 0; r.legsAt[i][0] = 0; r.legsAt[i][1] = 0; r.legsAt[i][2] = 0; }
  const hAt = fit?.hindAt ?? [0, 0, 0], fAt = fit?.frontAt ?? [0, 0, 0];
  const hindAngle = (v: number) => def.stance === 'sit' && fit?.hindRest !== undefined ? fit.hindRest + (v - def.rest.hindL) * (fit.hindAmp ?? 1) : v;
  hind.forEach((i, k) => {
    r.legs[i][0] = swing(hindAngle(k === 0 ? p.hindL : p.hindR));
    r.legs[i][1] = -side(i) * p.hindSpread * RAD;
    r.legsAt[i][0] = -side(i) * hAt[0]; r.legsAt[i][1] = hAt[1] + tuck; r.legsAt[i][2] = hAt[2];
  });
  front.forEach((i, k) => {
    r.legs[i][0] = swing(k === 0 ? p.frontL : p.frontR);
    r.legs[i][1] = (side(i) * p.frontIn + p.frontRoll) * RAD;
    r.legsAt[i][0] = -side(i) * fAt[0]; r.legsAt[i][1] = fAt[1];
    r.legsAt[i][2] = fAt[2] + (def.stance === 'loaf' ? fit?.frontReach ?? 0 : 0);
  });
  // The chicken's wings play the front legs: raised for the trophy, clapping, folded for the nap.
  const wingUp = chicken ? (def.stance === 'rear' ? 2.3 : def.stance === 'sit' ? 0.25 + Math.max(0, (20 - p.frontIn) / 22) * 0.9 : 0) : 0;
  r.wings[0] = wingUp; r.wings[1] = wingUp;
  // The head: its pitch in the world is the body's plus its own, so its own is the wanted one less the body's. The
  // chicken's head drops 10 degrees further for the nap.
  const tip = p.headTip + (chicken && def.stance === 'loaf' ? 10 : 0);
  r.head[0] = tip * RAD - a;
  r.head[1] = p.headTurn * RAD;
  r.head[2] = -p.headLean * RAD;
  const H = restHeight(model);
  r.headAt[0] = fit?.headOffset[0] ?? 0;
  r.headAt[1] = (fit?.headOffset[1] ?? 0) + p.headRise * H;
  r.headAt[2] = fit?.headOffset[2] ?? 0;
  r.neck = 0;
  // Ears: the channel's own scale (+ droops), kept inside the species' range.
  const er = (RANGES[species] ?? RANGES.sheep).ears;
  r.ears[0] = r.ears[1] = clamp(-p.ears * RAD, er[0], er[1]);
  // The tail lifts the way its own build lifts it (tailLiftOf), by the pose's angle, or by what `placement` found keeps
  // it off the crate when the body stands up.
  const lift = tailLiftOf(model);
  r.tail[0] = fit?.tail ?? Math.sign(lift || -1) * Math.abs(p.tail) * RAD;
  r.tail[1] = 0;
  r.lids = def.lids;
  return r;
}

export const emptyRig = (): RigPose => ({
  body: [0, 0, 0], bodyAt: [0, 0, 0], head: [0, 0, 0], headAt: [0, 0, 0], neck: 0, ears: [0, 0],
  legs: [[0, 0], [0, 0], [0, 0], [0, 0]], legsAt: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], tail: [0, 0], wings: [0, 0], lids: 'open',
});

// ---------------------------------------------------------------------------------------------------------------------
// The posed model, as points
// ---------------------------------------------------------------------------------------------------------------------

type Role = 'body' | 'head' | 'hat' | 'leg0' | 'leg1' | 'leg2' | 'leg3' | 'tail' | 'wing0' | 'wing1' | 'ears';
interface Cloud { role: Role; pts: Vector3[] }

const clouds = new WeakMap<object, Cloud[]>();
/** A geometry's corners every few vertices: enough to find its lowest, highest and outermost points. */
function pointsOf(geo: BufferGeometry, step = 1): Vector3[] {
  const pos = geo.getAttribute('position');
  const out: Vector3[] = [];
  if (!pos) return out;
  for (let i = 0; i < pos.count; i += step) out.push(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  return out;
}
/** Each part's points in its own frame (its pivot at the origin, as the Sheep component places it). */
function partClouds(m: AnimalModel): Cloud[] {
  const hit = clouds.get(m);
  if (hit) return hit;
  const out: Cloud[] = [];
  const body = [...pointsOf(m.wools[2].geo, 2), ...(m.bodyAlways ? pointsOf(m.sheared.geo, 2) : [])];
  out.push({ role: 'body', pts: body });
  out.push({ role: 'head', pts: [...pointsOf(m.head.geo, 2), ...pointsOf(m.hood.geo, 2)] });
  if (HATS) {
    const hat = anchorsOf(m).hat;
    out.push({ role: 'hat', pts: pointsOf(santaHat(), 2).map((v) => v.multiplyScalar(hat.scale).add(new Vector3(...hat.at))) });
  }
  m.legs.forEach((l, i) => out.push({ role: `leg${i}` as Role, pts: pointsOf(l.geo) }));
  out.push({ role: 'tail', pts: pointsOf(m.tail.geo) });
  const wings = m.signature.filter((s) => s.anim === 'wingL' || s.anim === 'wingR');
  wings.forEach((w, i) => out.push({ role: `wing${i}` as Role, pts: pointsOf(w.geo) }));
  const ears = m.ears.flatMap((e) => pointsOf(e.geo).map((v) => v.add(new Vector3(e.pivot[0] - m.head.pivot[0], e.pivot[1] - m.head.pivot[1], e.pivot[2] - m.head.pivot[2]))));
  out.push({ role: 'ears', pts: ears });
  clouds.set(m, out);
  return out;
}

const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
const R = (x: number, y: number, z: number) => new Matrix4().makeRotationFromEuler(new Euler(x, y, z));

/** Every part's points, posed, in the avatar's own frame (model units; the Sheep component's tree, root at scale 1). */
export function posed(m: AnimalModel, r: RigPose): Map<Role, Vector3[]> {
  const body = T(r.bodyAt[0], r.bodyAt[1], r.bodyAt[2]).multiply(R(r.body[0], r.body[1], r.body[2]));
  const nb = m.neckBase ?? [0, 0, 0];
  const neck = body.clone().multiply(T(nb[0], nb[1], nb[2])).multiply(R(r.neck, 0, 0));
  const head = neck.clone().multiply(T(m.head.pivot[0] - nb[0] + r.headAt[0], m.head.pivot[1] - nb[1] + r.headAt[1], m.head.pivot[2] - nb[2] + r.headAt[2]))
    .multiply(R(r.head[0] + (m.headPitch ?? 0), r.head[1], r.head[2]));
  const wings = m.signature.filter((s) => s.anim === 'wingL' || s.anim === 'wingR');
  const out = new Map<Role, Vector3[]>();
  for (const c of partClouds(m)) {
    let M: Matrix4;
    if (c.role === 'body') M = body;
    else if (c.role === 'head' || c.role === 'hat' || c.role === 'ears') M = head;
    else if (c.role === 'tail') M = body.clone().multiply(T(...m.tail.pivot)).multiply(R(r.tail[0], r.tail[1], 0));
    else if (c.role.startsWith('wing')) {
      const i = Number(c.role.slice(4)), w = wings[i];
      M = body.clone().multiply(T(...w.pivot)).multiply(R(0, 0, (w.anim === 'wingL' ? 1 : -1) * r.wings[i]));
    } else {
      const i = Number(c.role.slice(3)), l = m.legs[i];
      M = body.clone().multiply(T(l.pivot[0] + r.legsAt[i][0], l.pivot[1] + r.legsAt[i][1], l.pivot[2] + r.legsAt[i][2])).multiply(R(r.legs[i][0], 0, r.legs[i][1]));
    }
    out.set(c.role, c.pts.map((v) => v.clone().applyMatrix4(M)));
  }
  return out;
}

const heights = new WeakMap<object, number>();
/** H: the avatar's height standing on four legs, feet to the top of the head, hat not counted (model units). */
export function restHeight(m: AnimalModel): number {
  let h = heights.get(m);
  if (h !== undefined) return h;
  const pts = posed(m, emptyRig());
  h = 0;
  for (const [role, list] of pts) if (role !== 'hat') for (const v of list) h = Math.max(h, v.y);
  heights.set(m, h);
  return h;
}

// ---------------------------------------------------------------------------------------------------------------------
// Where each one stands on its crate
// ---------------------------------------------------------------------------------------------------------------------

/** How big each place is drawn against the sheep's own size on the table (SHEEP_SCALE): see `PLACE_SIZE` below. */
export interface Placement {
  /** The model's draw scale on this stage (metres per model unit). */
  k: number;
  /** Where the avatar's root sits on the crate, before the turn (metres, crate-local: x across, y up from the top, z to the camera). */
  at: [number, number, number];
  /** The point squash and pulse are taken about: where the weight bears, on the top (crate-local). */
  pivot: [number, number, number];
  /** The trophy's base above the avatar's root at rest (metres, avatar frame after the turn), for the champion. */
  trophy: [number, number, number];
  /** H in metres, at this draw scale. */
  H: number;
  fit: Fit;
}

/**
 * Each place's draw size against the sheep on the table, before the three are made one size (Brian, 2026-11-22: "the
 * sizes of the models are too mismatched, the 3rd place looks so short while 1st looks massive"): every place of a
 * species is drawn at the smallest size any of its three places fits at, which is the nap's (a loaf turned 25 degrees
 * is the widest thing on a crate's top).
 */
export const PLACE_SIZE: Record<Place, number> = { 1: 1, 2: 1, 3: 1 };

const places = new Map<string, Placement>();
/** The avatar's points in crate-local metres, given a placement's scale, turn and root position. */
export function inCrate(m: AnimalModel, def: PoseDef, r: RigPose, k: number, at: [number, number, number]): Map<Role, Vector3[]> {
  const turn = new Matrix4().makeRotationY(def.turn * RAD);
  const out = new Map<Role, Vector3[]>();
  for (const [role, pts] of posed(m, r)) out.set(role, pts.map((v) => v.clone().multiplyScalar(k).applyMatrix4(turn).add(new Vector3(...at))));
  return out;
}
const bounds = (pts: Vector3[]) => pts.reduce((b, v) => ({ min: b.min.min(v), max: b.max.max(v) }), { min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) });

/** The parts a place may hold past its crate's edges (3.1): the champion's raised front legs and the second's legs. */
export function mayOverhang(place: Place, role: string, species: Species): boolean {
  const hind = species === 'chicken' ? ['leg0', 'leg1'] : ['leg2', 'leg3'];
  const front = species === 'chicken' ? ['wing0', 'wing1'] : ['leg0', 'leg1'];
  if (place === 1) return front.includes(role);
  // The second's hind legs hang over the front edge by design; its front legs are held up in front of its chest to clap
  // (they cannot meet there and stay behind the edge with the hips at it).
  if (place === 2) return hind.includes(role) || front.includes(role);
  return false;
}
/** Room left on every side of the top, in metres: the nap keeps 0.03 W (3.5); the others keep what their squash and pulse
 * grow by (the champion's landing at 0.93 widens it 4%, the second's pulse 2%), so nothing passes an edge mid-loop. */
const MARGIN: Record<Place, number> = { 1: 0.025, 2: 0.025, 3: 0.03 * CRATE.w };

/**
 * Where an animal stands in a place, at rest. The champion's whole footprint is centred on the top with its hind feet on
 * it; the second's rump meets the top with its hips 0.04 W behind the front edge (or as far back as keeps its body behind
 * that edge), centred across; the third's belly meets the top with the loaf centred. Each is drawn at its place's size
 * (PLACE_SIZE), or smaller where that would pass the top's edges. The loaf's chin is lowered onto its hooves first, and
 * an upright body's tail is lifted until it clears the top.
 */
export function placement(species: Species, place: Place): Placement {
  const key = `${species}|${place}`;
  const hit = places.get(key);
  if (hit) return hit;
  const k = Math.min(...([1, 2, 3] as const).map((p) => solve(species, p).k));
  const out = solve(species, place, k);
  places.set(key, out);
  return out;
}

/** One place's placement, at its own largest size that fits, or at `fixed` (metres per model unit). */
function solve(species: Species, place: Place, fixed?: number): Placement {
  const m = animalModel(species);
  const def = POSES[place];
  const lift = tailLiftOf(m);
  let fit: Fit = { headOffset: [0, 0, 0], frontReach: 0, tuck: 0, tail: Math.sign(lift || -1) * Math.abs(def.rest.tail) * RAD, frontAt: [0, 0, 0], hindAt: [0, 0, 0] };
  const want = SHEEP_SCALE * m.drawScale * PLACE_SIZE[place];
  if (def.stance === 'loaf') {
    // The front hooves 0.06 H in front of the chest; the hind legs slid up out of sight; then the head lowered until its
    // chin rests on the hooves (the hen: on her own folded body).
    const probe = posed(m, rigOf(m, def, def.rest, fit));
    const chest = bounds(probe.get('body')!).max.z;
    const hoofZ = species === 'chicken' ? chest : Math.max(...[0, 1].flatMap((i) => probe.get(`leg${i}` as Role)!.map((v) => v.z)));
    fit = { ...fit, frontReach: species === 'chicken' ? 0 : chest + 0.06 * restHeight(m) - hoofZ, tuck: species === 'chicken' ? 0.06 : 0.02 };
    // The belly is what rests on the top: the front legs lie level with its foot, and the hind legs slide up until none
    // of them reaches below it (on the longer-legged species they held the body up).
    const p1 = posed(m, rigOf(m, def, def.rest, fit));
    const belly = Math.min(...p1.get('body')!.map((v) => v.y));
    const low = (roles: string[]) => Math.min(...roles.flatMap((r) => p1.get(r as Role)!.map((v) => v.y)));
    const hindRoles = species === 'chicken' ? ['leg0', 'leg1'] : ['leg2', 'leg3'];
    fit = { ...fit, tuck: Math.max(fit.tuck, fit.tuck + belly - low(hindRoles) + 0.005), frontAt: species === 'chicken' ? [0, 0, 0] : [0, belly - low(['leg0', 'leg1']), 0] };
    const p2 = posed(m, rigOf(m, def, def.rest, fit));
    const rest = species === 'chicken' ? bounds(p2.get('body')!) : bounds([...p2.get('leg0')!, ...p2.get('leg1')!]);
    const chin = Math.min(...p2.get('head')!.map((v) => v.y));
    const drop = (species === 'chicken' ? rest.min.y + 0.6 * (rest.max.y - rest.min.y) : rest.max.y) - chin;
    fit = { ...fit, headOffset: [0, drop, 0] };
  } else {
    // Standing or sitting up, the rump is at the bottom: lift the tail (its own way first) until it clears the feet.
    const low = () => {
      const pp = posed(m, rigOf(m, def, def.rest, fit));
      const feet = Math.min(...(species === 'chicken' ? ['leg0', 'leg1'] : ['leg2', 'leg3']).flatMap((r) => pp.get(r as Role)!.map((v) => v.y)));
      const body = Math.min(...pp.get('body')!.map((v) => v.y));
      return { tail: Math.min(...pp.get('tail')!.map((v) => v.y)), floor: def.stance === 'rear' ? feet : body };
    };
    // The angle nearest the pose's own that keeps the tail at or above the floor; with none, the highest it can go.
    const own = fit.tail;
    let best = own, bestY = -Infinity, found = false;
    for (let d = 0; d <= 3.2 && !found; d += 0.1) for (const sgn of [1, -1]) {
      const tail = own + sgn * d;
      fit = { ...fit, tail };
      const l = low();
      if (l.tail >= l.floor + 0.005) { best = tail; found = true; break; }
      if (l.tail > bestY) { bestY = l.tail; best = tail; }
    }
    fit = { ...fit, tail: best };
  }
  const r = rigOf(m, def, def.rest, fit);
  // At the wanted size, how wide and deep is the footprint (the parts that may not pass the edges)?
  const at0 = inCrate(m, def, r, want, [0, 0, 0]);
  const held = [...at0].filter(([role]) => !mayOverhang(place, role, species)).flatMap(([, p]) => p);
  const hb = bounds(held);
  const room = (span: number, half: number) => (2 * (half - MARGIN[place])) / span;
  // Every place keeps its footprint inside the top, across and front to back (the goat sat upright is 1.16 m deep).
  const fitScale = Math.min(1, room(hb.max.x - hb.min.x, CRATE.w / 2), room(hb.max.z - hb.min.z, CRATE.d / 2));
  const k = fixed ?? want * fitScale;
  const H = restHeight(m) * k;
  const pts = inCrate(m, def, r, k, [0, 0, 0]);
  const all = [...pts.values()].flat();
  const keep = [...pts].filter(([role]) => !mayOverhang(place, role, species)).flatMap(([, p]) => p);
  const kb = bounds(keep), ab = bounds(all);
  let at: [number, number, number];
  let pivot: [number, number, number];
  // Down until the part that bears the weight touches the top: the champion's feet (its lowest part), the second's rump,
  // the nap's belly. A tail that hangs lower than the rump or the belly (the pig's, the goat's, the horse's) rests its
  // tip inside the crate's top, behind the body (reported).
  const y = place === 1 ? -ab.min.y : -bounds(pts.get('body')!).min.y;
  if (place === 2) {
    const body = bounds(pts.get('body')!);
    const top = (i: number) => new Vector3(...m.legs[i].pivot).applyMatrix4(R(bodyPitch(def.stance, def.rest.tip, species), 0, 0)).multiplyScalar(k).applyMatrix4(new Matrix4().makeRotationY(def.turn * RAD));
    const hind = species === 'chicken' ? [0, 1] : [2, 3];
    const hips = hind.reduce((n, i) => n + top(i).z, 0) / 2;
    // Hips 0.04 W behind the front edge, unless that would put the body past it: then the body's front on the edge.
    const plan = CRATE.d / 2 - 0.04 * CRATE.w - hips;
    const z = Math.min(plan, CRATE.d / 2 - MARGIN[2] - kb.max.z);
    // The hind legs swing from there, and wherever they dip below the top they must be 0.01 m clear of the front face
    // (3.4). Where the plan's 40 degrees, give or take 12, would put a hoof through the top, the legs rest further
    // forward (the least that clears), and only if that is not enough do they swing less.
    const clearAt = (rest: number, amp: number) => [-1, 0, 1].every((sg) => {
      const pose = { ...def.rest, hindL: def.rest.hindL + sg * 12, hindR: def.rest.hindR - sg * 12 };
      const ps = inCrate(m, def, rigOf(m, def, pose, { ...fit, hindRest: rest, hindAmp: amp }), k, [0, y, 0]);
      return hind.every((i) => ps.get(`leg${i}` as Role)!.every((v) => v.y >= -0.003 || v.z + z >= CRATE.d / 2 + 0.012));
    });
    let rest = def.rest.hindL, amp = 1;
    while (rest < 80 && !clearAt(rest, 1)) rest += 2;
    while (amp > 0 && !clearAt(rest, amp)) amp = Math.max(0, amp - 0.125);
    fit = { ...fit, hindRest: rest, hindAmp: amp };
    at = [-(kb.min.x + kb.max.x) / 2, y, z];
    pivot = [0, 0, z + (body.min.z + body.max.z) / 2];
  } else {
    at = [-(kb.min.x + kb.max.x) / 2, y, -(kb.min.z + kb.max.z) / 2];
    pivot = [0, 0, 0];
  }
  // The trophy: centred over the head, its base 0.06 H above the top of the hat (or of the head, with no hat).
  let trophy: [number, number, number] = [0, 0, 0];
  if (place === 1) {
    const hd = bounds(pts.get('head')!), top = bounds([...pts.get('head')!, ...(pts.get('hat') ?? [])]);
    trophy = [(hd.min.x + hd.max.x) / 2 + at[0], top.max.y + 0.06 * H + at[1], (hd.min.z + hd.max.z) / 2 + at[2]];
  }
  return { k, at, pivot, trophy, H, fit };
}
