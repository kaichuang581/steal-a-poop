import { describe, expect, it } from 'vitest';
import { FIELD } from '../../../dream/dream';
import { CHUNK, chunkPlacements, DESKTOP_SHOT, ISLANDS, islandX, PHONE_SHOT, PX, RECYCLE, scrollOf, worldX } from '../stage';

describe('the dream stage (V4 Part 4)', () => {
  it('maps logical pixels to metres: the sheep at 0, the spawn and type windows ahead', () => {
    expect(worldX(FIELD.sheepX)).toBeCloseTo(0, 6);
    expect(PX).toBe(0.036);
    expect(worldX(320 + 24)).toBeCloseTo((320 + 24 - 78) * 0.036, 6);
    expect(worldX(320 + 70)).toBeCloseTo((320 + 70 - 78) * 0.036, 6);
    expect(FIELD.sheepW * PX).toBeCloseTo(0.72, 6);
    expect(scrollOf(100)).toBeCloseTo(3.6, 6);
  });
  it('keeps the chunk ring whole: after one ring of scroll every chunk has gone round exactly once and none overlap', () => {
    const span = CHUNK.size * CHUNK.count;
    for (const scroll of [0, 3, 11, span, span + 1.5]) {
      const xs = chunkPlacements(scroll).map((p) => p.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(CHUNK.size, 6);
      expect(xs[0]).toBeGreaterThanOrEqual(CHUNK.from);
      expect(xs[xs.length - 1]).toBeLessThan(CHUNK.from + span);
    }
    for (const p of chunkPlacements(span)) expect(p.gen).toBe(1);
  });
  it('recycles an island past x -12 back in at 14 or beyond, on the same layer', () => {
    for (const it of ISLANDS) {
      let wasOut = false;
      for (let s = 0; s < 400; s += 0.25) {
        const x = islandX(it, s);
        expect(x).toBeGreaterThanOrEqual(RECYCLE.leave);
        const prev = islandX(it, Math.max(0, s - 0.25));
        if (prev < x) { wasOut = true; expect(x).toBeGreaterThanOrEqual(RECYCLE.enter); }
      }
      expect(wasOut).toBe(true);
    }
  });
  it('frames the sheep a quarter in from the left with room ahead on desktop', () => {
    expect(DESKTOP_SHOT.position[2]).toBeGreaterThan(0);
    expect(DESKTOP_SHOT.target[0]).toBe(1.5);
    expect(DESKTOP_SHOT.fov).toBe(30);
    expect(PHONE_SHOT.fov).toBe(46);
  });
});
