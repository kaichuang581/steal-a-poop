import { describe, expect, it } from 'vitest';
import { triangles } from '../../voxel/mesher';
import { buildFarmstead } from '../farmstead';
import { BULB_COLORS, buildBedroomFestive, buildDuelFestive, buildFarmFestive, buildFestive, santaHat } from '../festive';
import { seatPosition } from '../layout';

describe('the Fleece Navidad decorations', () => {
  it('builds each place\'s once, with every colour of bulb, inside a sensible budget', () => {
    buildFarmstead(); // the orchard's baubles hang from its branches
    for (const build of [buildFestive, buildFarmFestive, buildDuelFestive, buildBedroomFestive]) {
      const f = build();
      expect(build()).toBe(f);
      expect(f.bulbs).toHaveLength(BULB_COLORS.length);
      for (const b of f.bulbs) expect(triangles(b)).toBeGreaterThan(0);
      expect(triangles(f.decor) + f.bulbs.reduce((n, b) => n + triangles(b), 0)).toBeLessThan(250_000);
    }
  });

  it('keeps the small tree in the barn clear of the table at every size of game', () => {
    for (let n = 4; n <= 10; n++) {
      for (let i = 0; i < n; i++) {
        const p = seatPosition(i, n);
        expect(Math.hypot(p.x - 4.5, p.z - 5.4)).toBeGreaterThan(1.8);
      }
    }
  });

  it('the hat sits on its brim', () => {
    const hat = santaHat();
    hat.computeBoundingBox();
    expect(hat.boundingBox!.min.y).toBeCloseTo(0);
    expect(hat.boundingBox!.max.y).toBeGreaterThan(0.3);
  });
});
