import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecord, recordQuickResult } from '../../../lib/record';
import { getPracticeSheet, PRACTICE_WEIGHT, practiceRating, recordPracticeRun } from '../../../lib/practice';
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
  it('keeps a practice best for every bot and starting clock, not one for all of them', () => {
    const empty = getPracticeSheet();
    expect(empty.top).toBeNull();
    expect(empty.rows.map((r) => r.difficulty)).toEqual(['easy', 'medium', 'hard']);
    for (const r of empty.rows) expect(r.cells.map((c) => [c.clock, c.words, c.rating])).toEqual([[15, 0, 0], [10, 0, 0], [5, 0, 0]]);
    recordPracticeRun(15, 'easy', 31);
    recordPracticeRun(10, 'hard', 12);
    recordPracticeRun(5, 'hard', 6);
    const sheet = getPracticeSheet();
    const words = (d: number, c: number) => sheet.rows[d].cells[c].words;
    expect([words(0, 0), words(2, 1), words(2, 2), words(1, 0)]).toEqual([31, 12, 6, 0]);
  });
  it('rates a run higher against a harder bot and from a shorter clock', () => {
    // One step harder on either is worth half as much again, two steps twice as much.
    expect(PRACTICE_WEIGHT).toEqual({ bot: { easy: 1, medium: 1.5, hard: 2 }, clock: { 15: 1, 10: 1.5, 5: 2 } });
    expect(practiceRating(15, 'easy', 10)).toBe(10);
    expect(practiceRating(15, 'hard', 10)).toBe(20);
    expect(practiceRating(5, 'easy', 10)).toBe(20);
    expect(practiceRating(10, 'medium', 17)).toBe(38); // 38.25
    expect(practiceRating(5, 'hard', 10)).toBe(40);
    // The same words are never rated lower for being harder.
    for (const [easier, harder] of [[[15, 'easy'], [10, 'easy']], [[10, 'easy'], [5, 'easy']], [[15, 'easy'], [15, 'medium']], [[15, 'medium'], [15, 'hard']]] as const) {
      expect(practiceRating(harder[0], harder[1], 9)).toBeGreaterThan(practiceRating(easier[0], easier[1], 9));
    }
  });
  it('makes the practice rating the best-rated run: twelve hard words beat thirty-one easy ones', () => {
    recordPracticeRun(15, 'easy', 31);
    expect(getPracticeSheet().top).toMatchObject({ difficulty: 'easy', clock: 15, words: 31, rating: 31 });
    recordPracticeRun(10, 'hard', 12);
    expect(getPracticeSheet().top).toMatchObject({ difficulty: 'hard', clock: 10, words: 12, rating: 36 });
    // A long easy run can still be the best: the rating weighs, it does not rank the bots.
    recordPracticeRun(15, 'easy', 40);
    expect(getPracticeSheet().top).toMatchObject({ difficulty: 'easy', rating: 40 });
  });
  it('gives a tie to the harder bot, then to the shorter clock', () => {
    recordPracticeRun(5, 'easy', 12); // 24
    recordPracticeRun(15, 'hard', 12); // 24
    expect(getPracticeSheet().top).toMatchObject({ difficulty: 'hard', clock: 15 });
    recordPracticeRun(10, 'hard', 8); // 24
    expect(getPracticeSheet().top).toMatchObject({ difficulty: 'hard', clock: 10 });
  });
  it('reads a damaged or older store without falling over', () => {
    localStorage.setItem('sap:practice-best', JSON.stringify({ '15:easy': 'lots', '10:medium': -3, '5:hard': 4.9, '20:easy': 50 }));
    const sheet = getPracticeSheet();
    expect(sheet.top).toMatchObject({ difficulty: 'hard', clock: 5, words: 4, rating: 16 });
    expect(sheet.rows[0].cells.every((c) => c.words === 0)).toBe(true);
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
