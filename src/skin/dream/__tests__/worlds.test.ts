import { describe, expect, it } from 'vitest';
import { lapAt, worldAt } from '../worlds';

/** Fences numbered from 1, as in the plan's table; letters from the given boundaries. */
const letters = (f: number, two: number, three: number): 1 | 2 | 3 => (f >= three ? 3 : f >= two ? 2 : 1);

describe('which world, when (v3/01, section 5)', () => {
  it('follows the plan table with two letters from fence 6 and three from fence 17', () => {
    const rows: [number, number, 1 | 2 | 3, number][] = [[1, 5, 1, 1], [6, 16, 2, 1], [17, 31, 3, 1], [32, 46, 1, 2], [47, 61, 2, 2], [62, 76, 3, 2], [77, 91, 1, 3]];
    for (const [from, to, world, lap] of rows)
      for (let f = from; f <= to; f++) {
        expect(worldAt(f, letters(f, 6, 17), 17)).toBe(world);
        expect(lapAt(f, 17)).toBe(lap);
      }
  });
  it('reads other letter boundaries from the game', () => {
    expect(worldAt(3, letters(3, 4, 9), 9)).toBe(1);
    expect(worldAt(4, letters(4, 4, 9), 9)).toBe(2);
    expect(worldAt(9, letters(9, 4, 9), 9)).toBe(3);
    expect(worldAt(24, letters(24, 4, 9), 9)).toBe(1);
    expect(worldAt(39, letters(39, 4, 9), 9)).toBe(2);
    expect(worldAt(54, letters(54, 4, 9), 9)).toBe(3);
    expect(lapAt(23, 9)).toBe(1);
    expect(lapAt(24, 9)).toBe(2);
    expect(lapAt(69, 9)).toBe(3);
  });
});
