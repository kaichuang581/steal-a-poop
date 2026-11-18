import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NEAR_MISS, REEL } from '../FeedSacks';

/**
 * The fair machine stays as Brian liked it (2026-11-12: "leave it as it is"; plan file 10, acceptance). Its speed is a
 * question for him (file 10, section 8: SPIN_MS 2600 with a cubic ease, or as today), and until he answers yes these
 * numbers do not move. SPIN_MS and the ease are not exported, so they are read from the source.
 */
describe('the fair machine keeps its timing', () => {
  const source = readFileSync('src/skin/shop/FeedSacks.tsx', 'utf8');

  it('spins for 3800 ms with the fifth-power ease', () => {
    expect(source).toMatch(/\bconst SPIN_MS = 3800;/);
    expect(source).toMatch(/const ease = \(t: number\) => 1 - \(1 - t\) \*\* 5;/);
  });

  it('keeps its reel and its near miss', () => {
    expect(REEL).toEqual({ tile: 104, strip: 38, stop: 31, lead: 7, rest: 3 });
    expect(NEAR_MISS).toBe(0.15);
  });
});
