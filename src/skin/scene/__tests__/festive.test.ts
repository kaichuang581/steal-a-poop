import { describe, expect, it } from 'vitest';
import { triangles } from '../../voxel/mesher';
import { buildFarmstead } from '../farmstead';
import { BULB_COLORS, BULB_GROUPS, buildBedroomFestive, buildDuelFestive, buildFarmFestive, buildFestive, santaHat } from '../festive';
import { seatPosition } from '../layout';

describe('the Fleece Navidad decorations', () => {
  it('builds each place\'s once, with every colour of bulb, inside a sensible budget', () => {
    buildFarmstead(); // the orchard's baubles hang from its branches
    for (const build of [buildFestive, buildFarmFestive, buildDuelFestive, buildBedroomFestive]) {
      const f = build();
      expect(build()).toBe(f);
      expect(f.bulbs).toHaveLength(BULB_COLORS.length * BULB_GROUPS);
      // Every colour lights somewhere, though a small place may leave some of its twinkle groups empty.
      BULB_COLORS.forEach((_, c) => expect(f.bulbs.slice(c * BULB_GROUPS, (c + 1) * BULB_GROUPS).reduce((n, b) => n + triangles(b), 0)).toBeGreaterThan(0));
      expect(triangles(f.decor) + triangles(f.star) + f.bulbs.reduce((n, b) => n + triangles(b), 0)).toBeLessThan(250_000);
    }
  }, 30_000); // it builds the whole farm first, which is slow when every test file runs at once

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
