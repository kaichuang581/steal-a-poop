import type { PerspectiveCamera } from 'three';

/**
 * The level shift-lens camera of the Trading Post and Practice (docs/trading-post-practice P1 section 2, T1 section 2),
 * built as the dream's `placeDreamCamera` is: it looks straight down -z and never tilts; its lens is shifted so the
 * line where y 0, z 0 lands sits at `lineShare` of the height. `A` is CSS px per metre at z 0, the eye stands `eyeM`
 * up and `camM` in front of z 0 at x `centreX`. It never calls `updateProjectionMatrix` (that would undo the shift).
 */
export function placeShiftCamera(cam: PerspectiveCamera, A: number, W: number, H: number, eyeM: number, camM: number, lineShare: number, centreX: number): void {
  const near = 0.5, far = 400;
  const horizonY = lineShare * H - A * eyeM, k = near / (A * camM);
  cam.position.set(centreX, eyeM, camM);
  cam.rotation.set(0, 0, 0);
  cam.near = near; cam.far = far;
  cam.projectionMatrix.makePerspective((-W / 2) * k, (W / 2) * k, horizonY * k, -(H - horizonY) * k, near, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld();
}
