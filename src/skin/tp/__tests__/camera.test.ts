import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { placeShiftCamera, project } from '../camera';
import type { ShiftView } from '../camera';

describe('the shift camera (T1 section 2)', () => {
  const v: ShiftView = { A: 185, W: 1440, H: 900, eye: 1.9, cam: 9, line: 0.78, cx: 0.35 };
  it("puts the Oat Sack's tag point at (404, 243) on stop 1 at 1440 x 900", () => {
    const [x, y] = project(v, -1.3, 2.46, 0.3);
    expect(Math.abs(x - 404)).toBeLessThanOrEqual(3);
    expect(Math.abs(y - 243)).toBeLessThanOrEqual(3);
  });
  it('the three.js camera agrees with the mapping', () => {
    const c = new PerspectiveCamera();
    placeShiftCamera(c, v);
    c.updateMatrixWorld();
    const p = new Vector3(-1.3, 2.46, 0.3).project(c);
    expect(Math.abs(((p.x + 1) / 2) * 1440 - 404)).toBeLessThanOrEqual(3);
    expect(Math.abs(((1 - p.y) / 2) * 900 - 243)).toBeLessThanOrEqual(3);
  });
});
describe('the shift camera (P1 section 2)', () => {
  it("at 1440 x 900 the bomb face's middle (-0.62, 0.25, 0.60) lands at (580, 616) within 3 px", () => {
    const cam = new PerspectiveCamera();
    placeShiftCamera(cam, 210, 1440, 900, 2.7, 9, 0.7, 0);
    const v = new Vector3(-0.62, 0.25, 0.60).project(cam);
    expect(Math.abs((v.x + 1) / 2 * 1440 - 580)).toBeLessThanOrEqual(3);
    expect(Math.abs((1 - v.y) / 2 * 900 - 616)).toBeLessThanOrEqual(3);
  });
});
