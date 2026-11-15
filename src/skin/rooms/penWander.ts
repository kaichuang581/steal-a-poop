import { PEN, PEN_WALK, penSpot } from '../scene/pen';

/**
 * How an animal spends its time in the lobby's pen: it stands a moment, walks somewhere, stands again, and every so
 * often walks up to a tuft of grass and grazes. No renderer here, only where each one is and what it is doing, so it
 * can be tested; PenStage moves the models by it.
 *
 * Brian, 2026-11-14: "make all the sheep be walking around instead of just starting at the ground, make them eat grass
 * from the ground occasionally". They had stood on fixed spots, the farm sheep with their heads down for good.
 */
export type RoamMode = 'idle' | 'walk' | 'graze';
export interface Roamer {
  x: number; z: number;
  /** The way it faces: 0 is +z (away from the camera), pi is toward the gate. */
  yaw: number;
  mode: RoamMode;
  /** When the stand or the graze ends (seconds on the scene's clock); for a walk, when it gives up and picks again. */
  until: number;
  /** Where it is walking to, and the tuft it means to graze when it gets there (an index into PEN.grass), if any. */
  tx: number; tz: number; tuft: number | null;
}

/** Metres a second: an amble. The walk's leg swing (Sheep.tsx WALK_HALF_STEP) is timed to this. */
export const WALK_SPEED = 0.62;
const TURN = 2.6;
/** How near two animals may stand, and how near it must come to where it is going. */
const APART = 1.3;
const ARRIVE = 0.14;
/** It stops this far short of a tuft, so its muzzle, not its feet, is on the grass. */
const REACH = 0.62;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const turnBy = (from: number, to: number, most: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + clamp(d, -most, most);
};

/** The i-th animal as it arrives: on its starting spot, facing the gate, standing for a moment first. */
export function arrive(i: number, now: number, rand: () => number): Roamer {
  const p = penSpot(i);
  return { x: p.x, z: p.z, yaw: p.yaw, mode: 'idle', until: now + 1.8 + rand() * 2.5, tx: p.x, tz: p.z, tuft: null };
}

/** What it does next after standing: more often than not a walk to somewhere in the pen, otherwise to a tuft nobody is at. */
function choose(r: Roamer, now: number, others: Iterable<Roamer>, rand: () => number) {
  const taken = new Set<number>();
  for (const o of others) if (o !== r && o.tuft !== null) taken.add(o.tuft);
  const free = PEN.grass.map((_, i) => i).filter((i) => !taken.has(i));
  if (free.length && rand() < 0.45) {
    const tuft = free[Math.floor(rand() * free.length)];
    const [gx, gz] = PEN.grass[tuft];
    // Come at it from where it stands, stopping short.
    const dx = r.x - gx, dz = r.z - gz, d = Math.hypot(dx, dz) || 1;
    r.tx = clamp(gx + (dx / d) * REACH, -PEN_WALK.x, PEN_WALK.x);
    r.tz = clamp(gz + (dz / d) * REACH, PEN_WALK.z0, PEN_WALK.z1);
    r.tuft = tuft;
  } else {
    // Somewhere in the pen, and of a few such places the one furthest from everyone else: a flock left to itself
    // spreads out over its ground, it does not all drift to the middle.
    let best = -1;
    for (let k = 0; k < 4; k++) {
      const x = (rand() * 2 - 1) * PEN_WALK.x, z = PEN_WALK.z0 + rand() * (PEN_WALK.z1 - PEN_WALK.z0);
      let room = Infinity;
      for (const o of others) if (o !== r) room = Math.min(room, Math.hypot(o.x - x, o.z - z), Math.hypot(o.tx - x, o.tz - z));
      if (room > best) { best = room; r.tx = x; r.tz = z; }
    }
    r.tuft = null;
  }
  r.mode = 'walk';
  r.until = now + 14;
}

/**
 * Moves one animal on by `dt` seconds. `others` is every animal in the pen (itself included or not): it keeps clear of
 * them. Changes `r` in place and returns its mode, so the caller can tell when the pose has to change.
 */
export function roam(r: Roamer, dt: number, now: number, others: Iterable<Roamer>, rand: () => number): RoamMode {
  if (r.mode === 'idle') {
    if (now >= r.until) choose(r, now, others, rand);
    return r.mode;
  }
  if (r.mode === 'graze') {
    if (now >= r.until) { r.mode = 'idle'; r.tuft = null; r.until = now + 0.8 + rand() * 1.6; }
    return r.mode;
  }
  // Walking: toward the place, bending away from anyone in the way.
  let dx = r.tx - r.x, dz = r.tz - r.z;
  const left = Math.hypot(dx, dz);
  if (left < ARRIVE || now >= r.until) {
    if (r.tuft !== null && left < ARRIVE * 3) {
      const [gx, gz] = PEN.grass[r.tuft];
      r.yaw = Math.atan2(gx - r.x, gz - r.z);
      r.mode = 'graze';
      r.until = now + 4 + rand() * 5;
    } else {
      r.mode = 'idle';
      r.tuft = null;
      r.until = now + 1.2 + rand() * 3.2;
    }
    return r.mode;
  }
  dx /= left; dz /= left;
  for (const o of others) {
    if (o === r) continue;
    const ox = r.x - o.x, oz = r.z - o.z, d = Math.hypot(ox, oz);
    if (d < APART && d > 0.001) { const push = ((APART - d) / APART) * 2.2; dx += (ox / d) * push; dz += (oz / d) * push; }
  }
  const want = Math.atan2(dx, dz);
  const before = r.yaw;
  r.yaw = turnBy(r.yaw, want, TURN * dt);
  // It turns on the spot when it faces the wrong way, and strides out once it is roughly headed there.
  let off = Math.abs(((want - before + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  if (off > Math.PI) off = Math.PI * 2 - off;
  const pace = WALK_SPEED * clamp(1.25 - off / 1.1, 0.12, 1);
  r.x = clamp(r.x + Math.sin(r.yaw) * pace * dt, -PEN_WALK.x, PEN_WALK.x);
  r.z = clamp(r.z + Math.cos(r.yaw) * pace * dt, PEN_WALK.z0, PEN_WALK.z1);
  return r.mode;
}
