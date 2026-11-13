import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecord, recordQuickResult } from '../../../lib/record';
import { getPracticeBestOverall, recordPracticeRun } from '../../../lib/practice';
import { standingLine, topPercent } from '../Profile';

describe('the profile numbers', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
  });

  it('counts Quick Game wins alongside games played', () => {
    expect(getRecord()).toMatchObject({ played: 0, wins: 0 });
    recordQuickResult(true, false);
    recordQuickResult(false, false);
    recordQuickResult(true, true);
    expect(getRecord()).toMatchObject({ played: 3, wins: 2 });
  });
  it('reads an older record with no wins as 0 wins', () => {
    localStorage.setItem('sap:record', JSON.stringify({ played: 5, results: [true, false], bests: { wool: 2, longest: 'tomorrow' } }));
    expect(getRecord()).toEqual({ played: 5, wins: 0, bests: { wool: 2, longest: 'tomorrow' } });
  });
  it('takes the best practice run at any clock and bot level', () => {
    expect(getPracticeBestOverall()).toBe(0);
    recordPracticeRun(15, 'easy', 7);
    recordPracticeRun(5, 'hard', 12);
    expect(getPracticeBestOverall()).toBe(12);
  });
  it('on the top 100 you see your place; below it, the share of players you are in, however small', () => {
    expect(standingLine({ place: 1 }, 5000)).toBe('#1');
    expect(standingLine({ place: 100 }, 5000)).toBe('#100');
    expect(standingLine({ place: 101 }, 5000)).toBe('Top 2.1%');
    expect(standingLine({ place: 2500 }, 5000)).toBe('Top 50%');
    expect(standingLine({ place: 101 }, 20_000_000)).toBe('Top 0.00051%');
  });
  it('the share is rounded up, so it never reads 0 and never flatters', () => {
    expect(topPercent(5000, 5000)).toBe('100');
    expect(topPercent(1234, 10_000)).toBe('13');
    expect(topPercent(150, 2000)).toBe('7.5');
    expect(topPercent(151, 2000)).toBe('7.6'); // 7.55 goes up
    expect(topPercent(101, 100_000)).toBe('0.11');
    expect(topPercent(1, 1_000_000_000)).toBe('0.0000001');
    expect(Number(topPercent(101, 3_000_000))).toBeGreaterThan(0);
  });
});
