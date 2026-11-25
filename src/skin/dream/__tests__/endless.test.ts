import { beforeEach, describe, expect, it } from 'vitest';
import { getDreamBest, recordDream } from '../../../dream/daily';
import { dreamShareText } from '../../../dream/dream';
import { getPracticeBest, recordPracticeBest } from '../practiceBest';
import { bestTab, quiltSquares, trayMessage } from '../Interface';
import { SKY_STARS, starsIn } from '../SkyStars';

/** Counting Sheep v3: endless, with a best score (docs/dream/v3/01) and its interface (08). */
const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
  };
});

describe('the best score', () => {
  it('hides the tab at 0, reads "Best N" otherwise, and "New best" from the first count above it', () => {
    expect(bestTab(0, 0)).toBeNull();
    expect(bestTab(40, 0)).toBeNull();
    expect(bestTab(8, 32)).toEqual({ text: 'Best 32', beaten: false });
    expect(bestTab(32, 32)).toEqual({ text: 'Best 32', beaten: false });
    expect(bestTab(33, 32)).toEqual({ text: 'New best', beaten: true });
    expect(bestTab(90, 32)).toEqual({ text: 'New best', beaten: true });
  });
  it('is saved once, with the night, and a practice run never changes the night\'s', () => {
    recordDream({ date: '2026-11-20', status: 'done', count: 32, longest: 6 });
    expect(getDreamBest()).toBe(32);
    recordPracticeBest(50);
    expect(getDreamBest()).toBe(32);
    expect(getPracticeBest()).toBe(50);
    recordPracticeBest(12);
    expect(getPracticeBest()).toBe(50);
    recordDream({ date: '2026-11-21', status: 'done', count: 20, longest: 6 });
    expect(getDreamBest()).toBe(32);
    expect(getPracticeBest()).toBe(50);
  });
  it('never says "of 30" or "Fence N" in the shared text', () => {
    expect(dreamShareText({ date: '2026-11-25', count: 12, longest: 7, streak: 2 })).not.toMatch(/of 30|\/30|Fence \d/);
    expect(dreamShareText({ date: '2026-11-25', count: 47, longest: 7, streak: 2, bumped: false, fences: 47, bumps: [47] })).not.toMatch(/of 30|\/30|Fence \d/);
  });
});

describe('the tray says one thing at a time', () => {
  it('ranks a refusal over a hint over nothing, and types ahead only when nothing else shows', () => {
    for (const refusal of ['', 'Not in the dictionary']) for (const hint of [false, true]) for (const coming of [false, true]) {
      const m = trayMessage(refusal, hint, coming);
      expect(m.strip).toBe(refusal ? 'no' : hint ? 'hint' : null);
      // Never two messages at once.
      expect(m.typeAhead && m.strip !== null).toBe(false);
      expect(m.typeAhead).toBe(!refusal && !hint && !coming);
    }
  });
});

describe('the quilt band', () => {
  it('is whole squares about 26 wide', () => {
    expect(quiltSquares(420)).toBe(16);
    expect(quiltSquares(500)).toBe(19);
    expect(quiltSquares(10)).toBe(1);
    for (const w of [200, 378, 440, 520]) expect(Math.abs(w / quiltSquares(w) - 26)).toBeLessThanOrEqual(13 / quiltSquares(w) + 0.5);
  });
});

describe('one star for each sheep', () => {
  const keepOut = [{ x: 0, y: 0, w: 300, h: 60 }, { x: 1100, y: 0, w: 300, h: 100 }], moons = [{ x: 600, y: 120 }, { x: 900, y: 140 }];
  it('puts each above the horizon, clear of the top bar and 80 from every moon, the same every time', () => {
    const stars = starsIn('dream:2026-11-25', 120, 1400, 300, keepOut, moons);
    expect(stars).toHaveLength(120);
    expect(starsIn('dream:2026-11-25', 120, 1400, 300, keepOut, moons)).toEqual(stars);
    for (const [x, y] of stars) {
      expect(y).toBeLessThan(300);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1400);
      for (const k of keepOut) expect(x + 5 > k.x && x - 5 < k.x + k.w && y + 5 > k.y && y - 5 < k.y + k.h).toBe(false);
      for (const m of moons) expect(Math.hypot(x - m.x, y - m.y)).toBeGreaterThanOrEqual(SKY_STARS.moonGap);
    }
    // Another night, other places.
    expect(starsIn('dream:2026-11-26', 120, 1400, 300, keepOut, moons)).not.toEqual(stars);
  });
  it('keeps the newest 240', () => {
    const stars = starsIn('dream:2026-11-25', 300, 1400, 300, keepOut, moons);
    expect(stars).toHaveLength(SKY_STARS.most);
    expect(stars[0]).toEqual(starsIn('dream:2026-11-25', 61, 1400, 300, keepOut, moons)[60]);
  });
});
