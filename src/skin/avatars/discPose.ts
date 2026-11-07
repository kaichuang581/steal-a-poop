import type { SheepState } from '../table/Sheep';

/** Where the coin is this frame: its centre's lift off the rest height, and its three tilts/turns. */
export interface DiscPose { lift: number; rotX: number; rotY: number; rotZ: number }

export const DISC = { radius: 0.5, thick: 0.06, rest: 0.52 } as const;

const TAU = Math.PI * 2;
const hop = (p: number, h: number) => (p >= 0 && p < 1 ? Math.sin(p * Math.PI) * h : 0);

/**
 * The coin's pose for a state `e` seconds in, at clock time `t`, on its own `phase`. The picture never changes: it
 * only tilts (rotZ), leans (rotX), turns right round (rotY) and hops (lift). `moving` false (reduced motion, or the
 * table held still for a steal) gives a resting pose with the state's own tilt and nothing more.
 */
export function discPose(state: SheepState, e: number, t: number, phase: number, moving: boolean, speaking = false): DiscPose {
  const tp = t + phase;
  const pose: DiscPose = { lift: 0, rotX: 0, rotY: 0, rotZ: 0 };
  switch (state) {
    case 'frozen': pose.rotZ = 0.26; return pose;
    case 'sleeping': pose.rotZ = 0.32; pose.lift = moving ? -0.04 + Math.sin(tp * 0.8) * 0.02 : -0.04; return pose;
    case 'cold': pose.rotZ = 0.12 + (moving ? Math.sin(tp * 45) * 0.03 : 0); return pose;
    case 'freezing': { const k = Math.min(1, e / 2); pose.rotZ = 0.12 + k * 0.14 + (moving ? Math.sin(tp * 45) * 0.03 * (1 - k) : 0); return pose; }
    case 'thawing': pose.rotZ = moving ? Math.sin(tp * 22) * 0.12 * Math.max(0, 1 - e) : 0; return pose;
    case 'thinking': pose.rotZ = 0.18 + (moving ? Math.sin(tp * 1.5) * 0.04 : 0); pose.rotX = 0.08; return pose;
    case 'grazing': pose.rotX = 0.35 + (moving ? Math.sin(tp * 2.2) * 0.06 : 0); return pose;
    default: break;
  }
  if (!moving) return pose;
  // The idle layer: a gentle wiggle, a tiny breath, a hop every 7 s and a full turn every 11 s, on this coin's own clock.
  pose.rotZ = Math.sin(tp * 2.0) * 0.1 + (speaking ? Math.sin(tp * 6) * 0.08 : 0);
  pose.lift = Math.sin(tp * 1.3) * 0.015 + hop((tp % 7) / 0.5, 0.22);
  const spin = (tp % 11) / 1.2;
  if (spin < 1) pose.rotY = (1 - Math.cos(spin * Math.PI)) / 2 * TAU;
  switch (state) {
    case 'happy':
      if (e < 1.2) { pose.lift += Math.abs(Math.sin(e * Math.PI * 2.5)) * 0.3; pose.rotZ = Math.sin(e * 20) * 0.12; }
      break;
    case 'proud':
      if (e < 1) pose.rotY = (1 - Math.cos(e * Math.PI)) / 2 * TAU;
      pose.lift += 0.05;
      break;
    case 'startled':
      if (e < 0.5) { pose.rotZ = Math.sin(e * 50) * 0.2 * (1 - e / 0.5); pose.rotX = -0.15 * (1 - e / 0.5); pose.lift += hop(e / 0.3, 0.15); }
      break;
    default: break;
  }
  return pose;
}
