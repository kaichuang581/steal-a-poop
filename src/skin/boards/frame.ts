import { PerspectiveCamera, Vector3 } from 'three';
import type { Color } from 'three';
import { skyAt } from './sky';
import type { Species } from '../voxel/animals/rig';
import { CRATE, CRATE_HEIGHTS } from './island';
import type { StageLayout } from './island';
import { placement } from './poses';
import { PRIZE_BOB, prizeHeight } from './cup';

/**
 * Where the leaderboards' camera stands (docs/leaderboards/LEADERBOARDS-PLAN.md 8.3, with version 3's 4.3.4 and 4.4):
 * straight on, 10 degrees down, 28 degrees of view; the crates and the three on them fill 66% of the window the board
 * leaves on a computer and 92% on a phone; the champion's trophy at the top of its hop stays 24 px under the lowest bulb;
 * on a computer the rim, the soil and the first two underside bands stay on screen. Where the window is too short for
 * all of that the camera backs off (the fill drops), and never turns or zooms. Pure: a three.js camera and numbers.
 */
export const PITCH = (10 * Math.PI) / 180, FOV = 28, AIM = 1.7;
export const FILL = { desk: 0.66, phone: 0.92 } as const;
/** The trophy floating overhead (cup.ts), as drawn, and the top of its bob. */
const CUP_H = prizeHeight() + PRIZE_BOB;
/** The hop's top (3.3): the avatar 0.2 H up, the trophy 0.04 H more, the body stretched to 1.04 about the top. */
const HOP = 0.2, PUSH = 0.04, STRETCH = 1.04;

export interface Rect { left: number; top: number; width: number; height: number }

/** The top of the champion's trophy, crate-local (y over the island's top, z), at a fraction `jump` of the full hop. */
export function trophyTop(species: Species, jump = 1): [number, number] {
  const pl = placement(species, 1);
  return [CRATE_HEIGHTS[0] + HOP * pl.H * jump + STRETCH * (pl.trophy[1] + PUSH * pl.H * jump + CUP_H), pl.trophy[2]];
}

export interface Solved {
  /** The camera's distance from the aim point, and the share of the window's width the crates fill. */
  d: number; fill: number;
  /** The highest the trophy may reach on the canvas (px from its top): 24 px under the window's top. */
  limit: number;
}

/**
 * Stands `cam` for a canvas `cw` x `ch` and the window `win` (px, relative to the canvas). `under` is the island's lowest
 * point that must show on a computer (island.ts `foot`). The sheep's champion is the yardstick: other species keep
 * under the same line by hopping lower (`jumpFor`), never by moving the camera.
 */
export function solveCamera(cam: PerspectiveCamera, cw: number, ch: number, win: Rect, u: number, phone: boolean, layout: StageLayout, under: [number, number]): Solved {
  const v = new Vector3();
  const f = ch / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
  const halfSpan = Math.abs(layout.x[2]) + CRATE.w / 2 + 0.12; // the crates, and the animals a little over their sides
  const margin = 24 * u, foot = (phone ? 14 : 8) * u;
  let d = (f * 2 * halfSpan) / ((phone ? FILL.phone : FILL.desk) * win.width);
  const place = () => {
    cam.fov = FOV;
    cam.aspect = cw / ch;
    cam.clearViewOffset();
    cam.position.set(0, AIM + d * Math.sin(PITCH), d * Math.cos(PITCH));
    cam.lookAt(0, AIM, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };
  /** A point's height from the picture's middle, in px (down), before the slide. */
  const py = (x: number, y: number, z: number) => { v.set(x, y, z).project(cam); return (-v.y * ch) / 2; };
  const [ty, tz] = trophyTop('sheep');
  const bottom: [number, number, number] = phone ? [0, 0, CRATE.d / 2] : [0, under[0], under[1]];
  for (let k = 0; k < 4; k++) {
    place();
    const span = py(...bottom) - py(0, ty, tz), room = win.height - margin - foot;
    if (span <= room + 0.5) break;
    d *= span / room;
  }
  place();
  // Slide the picture: the crates centred across the window, the trophy's top 24 px under the window's top.
  const cx = win.left + win.width / 2, cy = win.top + margin - py(0, ty, tz);
  cam.setViewOffset(cw, ch, cw / 2 - cx, ch / 2 - cy, cw, ch);
  cam.updateProjectionMatrix();
  return { d, fill: (2 * halfSpan * f) / d / win.width, limit: win.top + margin };
}

/** A crate-local point on the canvas (px from its top-left), through a camera `solveCamera` has stood. */
export function onCanvas(cam: PerspectiveCamera, cw: number, ch: number, x: number, y: number, z: number): [number, number] {
  const v = new Vector3(x, y, z).project(cam);
  return [((v.x + 1) / 2) * cw, ((1 - v.y) / 2) * ch];
}

/** How much of its hop a species' champion may make (0 to 1) so its trophy stays under the line (3.2, tall species). */
export function jumpFor(species: Species, cam: PerspectiveCamera, cw: number, ch: number, limit: number): number {
  const y = (j: number) => { const [ty, tz] = trophyTop(species, j); return onCanvas(cam, cw, ch, 0, ty, tz)[1]; };
  if (y(1) >= limit - 0.5) return 1;
  if (y(0) < limit) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (y(m) >= limit) lo = m; else hi = m; }
  return lo;
}

/**
 * The far islands' places (4.5), as fractions of the screen at 1440 x 900, where the window the board leaves is
 * 905 px wide from the left and starts 103.5 px down: A 12% across and 27% down, B 57% and 45%, C 50% and 20%. Kept as
 * fractions of that window, so at any computer size each stands where it stood among the crates, the sky and the board.
 */
const REF = { w: 1440, h: 900, win: { left: 0, top: 103.5, width: 905.4, height: 796.5 } };
export const FAR_SPOTS = {
  A: { sx: 0.12, sy: 0.27, k: 3 },
  B: { sx: 0.57, sy: 0.45, k: 3 },
  C: { sx: 0.5, sy: 0.2, k: 5 },
} as const;
export type FarName = keyof typeof FAR_SPOTS;
/** A spot as a fraction of the window (x across, y down). */
export const inWindow = (name: FarName): [number, number] => {
  const s = FAR_SPOTS[name];
  return [(s.sx * REF.w - REF.win.left) / REF.win.width, (s.sy * REF.h - REF.win.top) / REF.win.height];
};
/** The world point at a canvas point, `k` times as far from the camera as the crates' middle. */
export function worldAt(cam: PerspectiveCamera, cw: number, ch: number, px: number, py: number, k: number): Vector3 {
  const dir = new Vector3((px / cw) * 2 - 1, 1 - (py / ch) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
  return cam.position.clone().add(dir.multiplyScalar(k * cam.position.length()));
}

/**
 * The sky's colour behind a far island (linear RGB): the party sky's band at its height on the screen (PartySky.tsx draws
 * the bands behind the picture, down the whole canvas), as it stands at 1440 x 900.
 */
export function skyBehind(name: FarName): Color {
  return skyAt(FAR_SPOTS[name].sy);
}
