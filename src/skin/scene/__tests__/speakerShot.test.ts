import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { BARN, HEAP, seatPosition, SHEEP_SCALE, speakerShot } from '../layout';

/** Where a world point lands on screen (NDC, -1..1 is in frame) for a shot at an aspect ratio. */
function project(shot: ReturnType<typeof speakerShot>, aspect: number, p: [number, number, number]) {
  const cam = new PerspectiveCamera(shot.fov, aspect, 0.1, 900);
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateMatrixWorld();
  return new Vector3(...p).project(cam);
}
const inFrame = (v: Vector3, margin = 0.95) => Math.abs(v.x) <= margin && Math.abs(v.y) <= margin && v.z < 1;

describe('the speaker camera', () => {
  for (const [label, phone, aspect] of [['desktop', false, 16 / 9], ['phone', true, 390 / 844]] as const) {
    it(`keeps the speaker, the pile and the letter board in frame at every seat (${label})`, () => {
      for (let n = 4; n <= 10; n++) {
        for (let i = 1; i < n; i++) {
          const shot = speakerShot(i, n, phone);
          // The camera keeps 1.5 m clear of the side and back walls (the cut-away front is open).
          expect(Math.abs(shot.position[0])).toBeLessThanOrEqual(BARN.maxX - 1.5 + 1e-9);
          expect(shot.position[2]).toBeLessThanOrEqual(BARN.maxZ - 1.5 + 1e-9);
          const s = seatPosition(i, n);
          for (const p of [[s.x, 0.1, s.z], [s.x, 1.1 * SHEEP_SCALE, s.z], [HEAP[0], 0.4, HEAP[2]], [HEAP[0], 2.6, 1.0], [HEAP[0], 3.2, 1.0]] as [number, number, number][]) {
            expect(inFrame(project(shot, aspect, p)), `n=${n} seat=${i} point=${p}`).toBe(true);
          }
        }
      }
    });
  }
});
