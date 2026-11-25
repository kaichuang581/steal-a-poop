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

/** Sets the camera for a view. Never call updateProjectionMatrix afterwards: it would undo the shift. */
export function placeShiftCamera(c: PerspectiveCamera, v: ShiftView, near = 0.5, far = 300): void {
  const k = near / (v.A * v.cam), hz = horizonOf(v);
  c.position.set(v.cx, v.eye, v.cam);
  c.rotation.set(0, 0, 0);
  c.near = near; c.far = far;
  c.projectionMatrix.makePerspective((-v.W / 2) * k, (v.W / 2) * k, hz * k, -(v.H - hz) * k, near, far);
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
}
