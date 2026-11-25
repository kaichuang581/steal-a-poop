import type { PerspectiveCamera } from 'three';
import { FIELD } from '../../dream/dream';
import { ART, GROUND, PX } from './stage';
import type { DreamView } from './stage';

/**
 * The dream's camera (docs/dream/v3/02-the-voxel-scene.md, section 3): it looks level, straight across the track, and
 * never turns; its lens is shifted so the track sits low in the window. On the lane's plane (z = 0) it puts every
 * point exactly where the side-on mapping always has (stage.ts), so no rule and no place on the lane moves. Everything
 * here is in the plan's metres (`PLAN_M` game metres each); the sheep, in game metres, is scaled into them.
 */
export const DREAM_CAM = { CAM: 16, EYE: 2.4, lane: GROUND.computer, lanePhone: GROUND.phone, near: 1, far: 600 } as const;

/**
 * Game metres in one of the plan's metres, read from the mapping: an obstacle's body is 1.05 of the plan's metres tall
 * (v3/03, section 8) and fills the drawn rules box, ART times the rules' fence height.
 */
export const PLAN_M = (PX * ART * FIELD.fenceH) / 1.05;

/** The plan's `A`: CSS px for one of its metres on the lane, for a view (about 90 at 1440 x 900). */
export const artScale = (v: DreamView): number => v.zoom * PLAN_M;
/** Where the camera stands along the lane, plan metres: the side view's own middle. */
export const camXOf = (v: DreamView): number => v.camX / PLAN_M;
/** The horizon, CSS px from the window's top. */
export const horizonOf = (v: DreamView): number => v.ground - artScale(v) * DREAM_CAM.EYE;

/**
 * Sets the camera for a view. It never calls `updateProjectionMatrix` (that would undo the shift): call this when the
 * window's size changes and whenever the view does.
 */
export function placeDreamCamera(cam: PerspectiveCamera, v: DreamView): void {
  const { CAM, EYE, near, far } = DREAM_CAM;
  const A = artScale(v), W = v.w, H = v.h, horizonY = horizonOf(v), k = near / (A * CAM);
  cam.position.set(camXOf(v), EYE, CAM);
  cam.rotation.set(0, 0, 0);
  cam.near = near; cam.far = far;
  cam.projectionMatrix.makePerspective((-W / 2) * k, (W / 2) * k, horizonY * k, -(H - horizonY) * k, near, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}

/** Where a point of the dream (plan metres) lands in the window, CSS px from its top left. */
export function projectDream(v: DreamView, x: number, y: number, z: number): [number, number] {
  const { CAM, EYE } = DREAM_CAM, A = artScale(v), s = CAM / (CAM - z);
  return [v.w / 2 + A * (x - camXOf(v)) * s, horizonOf(v) - A * (y - EYE) * s];
}

/**
 * Each world's moon (v3/04, 05 and 06, section 5): px across at A = 90, its middle's share of the way across the
 * window and of the way from the window's top down to the horizon. It belongs to the sky: it never moves with the lane.
 */
export const MOON = {
  1: { across: 96, x: 0.42, y: 0.36 },
  2: { across: 128, x: 0.7, y: 0.36 },
  3: { across: 190, x: 0.62, y: 0.44 },
} as const;
/** A world's moon in a view: its middle and its width, CSS px. */
export function moonIn(v: DreamView, world: 1 | 2 | 3): { x: number; y: number; d: number } {
  const m = MOON[world];
  return { x: m.x * v.w, y: m.y * horizonOf(v), d: (m.across * artScale(v)) / 90 };
}
