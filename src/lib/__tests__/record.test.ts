import { beforeEach, describe, expect, it, vi } from 'vitest';
import { farmSheepLine, FIRST_GAMES, getBests, isFirstGames, needsSoftGame, recordBests, recordQuickResult } from '../record';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
});

describe('first games', () => {
  it('lasts for three finished Quick Games', () => {
    for (let i = 0; i < FIRST_GAMES; i++) {
      expect(isFirstGames()).toBe(true);
      recordQuickResult(true, false);
    }
    expect(isFirstGames()).toBe(false);
  });
});

describe('the soft game', () => {
  it('comes after two losses in the last three games, not one', () => {
    recordQuickResult(false, false);
    expect(needsSoftGame()).toBe(false);
    recordQuickResult(true, false);
    expect(needsSoftGame()).toBe(false);
    recordQuickResult(false, false);
    expect(needsSoftGame()).toBe(true);
  });
  it('forgets losses older than the last three', () => {
    recordQuickResult(false, false);
    recordQuickResult(true, false);
    recordQuickResult(true, false);
    recordQuickResult(false, false);
    expect(needsSoftGame()).toBe(false);
  });
  it('is one game only, won or lost', () => {
    for (const won of [true, false]) {
      recordQuickResult(false, false);
      recordQuickResult(false, false);
      expect(needsSoftGame()).toBe(true);
      recordQuickResult(won, true);
      expect(needsSoftGame()).toBe(false);
    }
  });
});

describe('personal bests', () => {
  it('keeps the best of each, and says which this game beat', () => {
    expect(recordBests({ wool: 2, longest: 'cat' }).beat).toEqual({ wool: true, longest: true });
    const next = recordBests({ wool: 3, longest: 'dog' });
    expect(next.beat).toEqual({ wool: true, longest: false });
    expect(next.bests).toEqual({ wool: 3, longest: 'cat' });
    expect(getBests()).toEqual({ wool: 3, longest: 'cat' });
  });
  it('survives alongside the game count', () => {
    recordBests({ wool: 2, longest: 'zebra' });
    recordQuickResult(true, false);
    expect(getBests().longest).toBe('zebra');
  });
});

describe('the table line', () => {
  it('says how many farm sheep sit with you', () => {
    expect(farmSheepLine(5)).toBe('You and five farm sheep');
    expect(farmSheepLine(1)).toBe('You and one farm sheep');
  });
});
