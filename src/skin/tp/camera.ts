import type { PerspectiveCamera } from 'three';

/**
 * The level shift-lens camera of the Trading Post and Practice (docs/trading-post-practice T1 section 2, P1 section 2):
 * it looks straight down -z and never tilts; its lens is shifted so the line where y 0, z 0 lands sits at a share of
 * the height. `project` is the same mapping without three, for the interface laid over the scene.
 */
export interface ShiftView {
  /** px per metre at z 0. */
  A: number;
  W: number;
  H: number;
  /** Eye height and the camera's distance in front of z 0, metres. */
  eye: number;
  cam: number;
  /** Where y 0, z 0 lands, as a share of H. */
  line: number;
  /** The x the camera stands at. */
  cx: number;
}

export const horizonOf = (v: ShiftView): number => v.line * v.H - v.A * v.eye;

/** A point in metres to CSS px from the window's top left. */
export function project(v: ShiftView, x: number, y: number, z: number): [number, number] {
  const k = v.cam / (v.cam - z);
  return [v.W / 2 + v.A * (x - v.cx) * k, horizonOf(v) - v.A * (y - v.eye) * k];
}

/**
 * Sets the camera for a view: `(cam, view)`, or Practice's `(cam, A, W, H, eyeM, camM, lineShare, centreX)`. Never
 * call updateProjectionMatrix afterwards: it would undo the shift.
 */
export function placeShiftCamera(c: PerspectiveCamera, v: ShiftView | number, ...rest: number[]): void {
  const view: ShiftView = typeof v === 'number' ? { A: v, W: rest[0], H: rest[1], eye: rest[2], cam: rest[3], line: rest[4], cx: rest[5] } : v;
  const near = 0.5, far = typeof v === 'number' ? 400 : 300;
  const k = near / (view.A * view.cam), hz = horizonOf(view);
  c.position.set(view.cx, view.eye, view.cam);
  c.rotation.set(0, 0, 0);
  c.near = near; c.far = far;
  c.projectionMatrix.makePerspective((-view.W / 2) * k, (view.W / 2) * k, hz * k, -(view.H - hz) * k, near, far);
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  c.updateMatrixWorld();
}
