import { describe, expect, it } from 'vitest';
import { buildCountryside, isClear } from '../countryside';
import { FARM } from '../farmstead';
import { POV_SHOTS } from '../homePov';

describe('the land around the farm', () => {
  it('builds inside its budget', () => {
    const c = buildCountryside();
    expect(c.woods.length).toBeGreaterThan(0);
    expect(c.triangles).toBeLessThan(950_000); // was 600k before the forest behind the field (2026-11-08)
  }, 20_000); // about 2 s alone; slower when the whole suite runs at once
  it('keeps off the farm', () => {
    expect(isClear(0, 2)).toBe(false);
    expect(isClear(FARM.coop.x, FARM.coop.z)).toBe(false);
    expect(isClear(FARM.silo.x + 20, FARM.silo.z - 20)).toBe(false); // the field
    expect(isClear(-50, 30)).toBe(true);
  });
  it('never stands in front of a camera on the tour', () => {
    for (const s of POV_SHOTS.desktop) {
      const dx = s.target[0] - s.position[0], dz = s.target[2] - s.position[2], d = Math.hypot(dx, dz);
      for (const t of [0, 2, 5]) expect(isClear(s.position[0] + (dx / d) * t, s.position[2] + (dz / d) * t)).toBe(false);
    }
  });
});
