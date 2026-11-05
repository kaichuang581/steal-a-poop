import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { BARN, homeShot, seatPosition, SHEEP_SCALE, speakerShot } from '../layout';

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
    it(`zooms in on the speaker at every seat, yours included, keeping the whole sheep in frame (${label})`, () => {
      for (let n = 4; n <= 10; n++) {
        for (let i = 0; i < n; i++) {
          const shot = speakerShot(i, n, phone);
          // The camera keeps 1.5 m clear of the side and back walls (the cut-away front is open).
          expect(Math.abs(shot.position[0])).toBeLessThanOrEqual(BARN.maxX - 1.5 + 1e-9);
          expect(shot.position[2]).toBeLessThanOrEqual(BARN.maxZ - 1.5 + 1e-9);
          const s = seatPosition(i, n);
          const feet = project(shot, aspect, [s.x, 0.1, s.z]);
          const head = project(shot, aspect, [s.x, 1.1 * SHEEP_SCALE, s.z]);
          expect(inFrame(feet), `n=${n} seat=${i} feet`).toBe(true);
          expect(inFrame(head), `n=${n} seat=${i} head`).toBe(true);
          // A real close-up: the sheep fills a good part of the frame's height (the wide shot gives it about a tenth).
          expect(Math.abs(head.y - feet.y) / 2, `n=${n} seat=${i} size`).toBeGreaterThan(phone ? 0.12 : 0.22);
        }
      }
    });
  }

  it('the wide home shot is the old fixed view of the whole ring', () => {
    expect(homeShot(false).fov).toBe(32);
    expect(homeShot(true).fov).toBe(46);
  });
});
