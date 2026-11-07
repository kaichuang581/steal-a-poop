import { describe, expect, it } from 'vitest';
import type { ChainEntry } from '../../../engine';
import { bombSize, wordCharge, wordsSinceBoom } from '../bombCharge';

const e = (kind: ChainEntry['kind'], word: string | null = null): ChainEntry => ({ round: 1, seat: 0, kind, word, points: 0 });

describe('bomb charge', () => {
  it('collects words since the last time-out, steals included', () => {
    const h = [e('play', 'cat'), e('timeout'), e('play', 'tiger'), e('steal', 'rat'), e('invalid')];
    expect(wordsSinceBoom(h)).toEqual(['tiger', 'rat']);
  });
  it('can leave out a time-out that just happened', () => {
    const h = [e('play', 'cat'), e('play', 'tiger'), e('timeout')];
    expect(wordsSinceBoom(h, true)).toEqual(['cat', 'tiger']);
    expect(wordsSinceBoom(h)).toEqual([]);
  });
  it('a longer word swells the bomb more', () => {
    expect(wordCharge('tomorrow')).toBeGreaterThan(wordCharge('cat'));
  });
  it('starts at 1 and stops growing at 3.2', () => {
    expect(bombSize([])).toBe(1);
    expect(bombSize(['tomorrow', 'cat'])).toBeGreaterThan(1);
    expect(bombSize(Array(100).fill('xylophones'))).toBeCloseTo(3.2);
  });
});
