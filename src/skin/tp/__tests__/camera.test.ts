import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { placeShiftCamera } from '../camera';

describe('the shift camera (P1 section 2)', () => {
  it("at 1440 x 900 the bomb face's middle (-0.62, 0.25, 0.625) lands at (580, 616) within 3 px", () => {
    const cam = new PerspectiveCamera();
    placeShiftCamera(cam, 210, 1440, 900, 2.7, 9, 0.7, 0);
    const v = new Vector3(-0.62, 0.25, 0.625).project(cam);
    expect(Math.abs((v.x + 1) / 2 * 1440 - 580)).toBeLessThanOrEqual(3);
    expect(Math.abs((1 - v.y) / 2 * 900 - 616)).toBeLessThanOrEqual(3);
  });
});
