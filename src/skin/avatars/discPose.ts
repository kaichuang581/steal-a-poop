import type { SheepState } from '../table/Sheep';

/** Where the coin is this frame: its centre's lift off the rest height, and its three tilts/turns. */
export interface DiscPose { lift: number; rotX: number; rotY: number; rotZ: number }

/** `tall` is the picture's own height over its width: the photo with the forehead band spliced and stretched 38.6 times (Brian,
 * 2026-11-08: "make kaiyans forehead humongous and make the rest of him regular sized"; kaiyan-forehead.png is 512 x 1339; later "as tall as the barndoor": 3.4 m at the table, BARN.backDoor.height).
 * `rest` keeps its foot on the snow. */
export const DISC = { radius: 0.5, tall: 1339 / 512, thick: 0.06, rest: 0.5 * (1339 / 512) + 0.02 } as const;

const TAU = Math.PI * 2;
const hop = (p: number, h: number) => (p >= 0 && p < 1 ? Math.sin(p * Math.PI) * h : 0);

/**
 * The coin's pose for a state `e` seconds in, at clock time `t`, on its own `phase`. The picture never changes: it
 * only tilts (rotZ), leans (rotX), turns right round (rotY) and hops (lift). `moving` false (reduced motion, or a
 * table held still) gives a resting pose with the state's own tilt and nothing more.
 */
export function discPose(state: SheepState, e: number, t: number, phase: number, moving: boolean, speaking = false, pace = 0): DiscPose {
  const tp = t + phase;
  const pose: DiscPose = { lift: 0, rotX: 0, rotY: 0, rotZ: 0 };
  // Counting Sheep's states (Brian, 2026-11-09: "make the kaiyan avatar usable there as well"). The picture faces the
  // camera and the run goes to screen right (+x), so a negative rotZ leans it into the run. No turns or idle hops here:
  // the dream moves the whole picture for the leap (DreamStage), and a spin mid-run would read as a stumble.
  switch (state) {
    case 'run': {
      // A bouncing trot, quicker with the dream's pace (0 to 1).
      const f = 9 + 6 * Math.min(1, Math.max(0, pace));
      pose.rotZ = -0.1 + (moving ? Math.sin(tp * f) * 0.07 : 0);
      pose.lift = moving ? Math.abs(Math.sin(tp * f)) * 0.08 : 0;
      return pose;
    }
    case 'jump': pose.rotZ = -0.06; return pose;
    case 'land': pose.rotZ = -0.04; return pose;
    case 'bonk': pose.rotZ = 0.28 + (moving ? Math.sin(e * 30) * 0.16 * Math.max(0, 1 - e / 0.6) : 0); pose.rotX = -0.1; return pose;
    default: break;
  }
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
