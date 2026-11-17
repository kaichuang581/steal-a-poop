import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { BARN, HEAP, homeShot, seatPosition, SHEEP_SCALE, speakerShot, SWOOP_CROP, swoopCrop } from '../layout';
import type { Shot } from '../layout';

/** A camera standing at a shot, for a canvas of that shape. */
function cameraAt(shot: Shot, width: number, height: number) {
  const cam = new PerspectiveCamera(shot.fov, width / height, 0.1, 900);
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  cam.updateMatrixWorld();
  return cam;
}
/** Where a point of the scene lands on a canvas of that size, in pixels from its top-left corner. */
function pixel(cam: PerspectiveCamera, p: readonly [number, number, number], width: number, height: number) {
  const v = new Vector3(p[0], p[1], p[2]).project(cam);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}

describe('the table keeps its picture now that its canvas fits its box', () => {
  for (const [label, phone, W, H] of [['computer', false, 1280, 720], ['phone', true, 390, 844]] as const) {
    it(`every shot through the view offset lands where the too-big canvas put it (${label})`, () => {
      let worst = 0;
      for (let n = 2; n <= 10; n++) {
        const shots = [homeShot(phone), ...Array.from({ length: n }, (_, i) => speakerShot(i, n, phone))];
        const points: [number, number, number][] = [[HEAP[0], 0.6, HEAP[2]], [HEAP[0], BARN.beamY - 0.15, 1.0]];
        for (let i = 0; i < n; i++) { const s = seatPosition(i, n); points.push([s.x, 0.1, s.z], [s.x, 1.26 * SHEEP_SCALE, s.z]); }
        for (const shot of shots) {
          // Before: the canvas was SWOOP_CROP times its box each way, pinned by its top-left corner, with the whole shot on it.
          const before = cameraAt(shot, SWOOP_CROP * W, SWOOP_CROP * H);
          // Now: a canvas the size of its box, and the camera shows that same corner of the shot.
          const now = cameraAt(shot, W, H);
          swoopCrop(now, W, H, true);
          for (const p of points) {
            const a = pixel(before, p, SWOOP_CROP * W, SWOOP_CROP * H), b = pixel(now, p, W, H);
            worst = Math.max(worst, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          }
        }
      }
      expect(worst).toBeLessThan(0.5);
    });
  }

  it('under reduced motion the whole shot is drawn, as before', () => {
    const cam = cameraAt(speakerShot(0, 4, false), 1280, 720);
    const whole = cam.projectionMatrix.clone();
    swoopCrop(cam, 1280, 720, true);
    expect(cam.projectionMatrix.equals(whole)).toBe(false);
    swoopCrop(cam, 1280, 720, false);
    expect(cam.view?.enabled ?? false).toBe(false);
    // The same lens again (to rounding: the offset writes the aspect back as a ratio of the two sizes).
    cam.projectionMatrix.elements.forEach((e, i) => expect(e).toBeCloseTo(whole.elements[i], 9));
  });
});
