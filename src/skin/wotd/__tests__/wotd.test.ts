import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { levelFor, wordOfDay } from '../pick';
import { WOTD } from '../words';

const DICT = new Set(readFileSync('public/words.txt', 'utf8').split('\n').map((w) => w.trim()).filter(Boolean));

/** Every date key of a year, in order. */
function yearOfDates(year: number): string[] {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

describe('the word list', () => {
  it('has 365 entries, no duplicate words, every field filled, meanings at most 90 characters', () => {
    expect(WOTD).toHaveLength(365);
    expect(new Set(WOTD.map((w) => w.word)).size).toBe(365);
    for (const w of WOTD) {
      expect(w.word.trim(), w.word).not.toBe('');
      expect(w.meaning.trim(), w.word).not.toBe('');
      expect(w.example.trim(), w.word).not.toBe('');
      expect(w.meaning.length, w.word).toBeLessThanOrEqual(90);
      expect([1, 2, 3]).toContain(w.level);
    }
  });

  it('has as many words of each level as 2026 has days for it (104 / 157 / 104)', () => {
    const count = (l: number) => WOTD.filter((w) => w.level === l).length;
    expect([count(1), count(2), count(3)]).toEqual([104, 157, 104]);
  });

  it('every word is in public/words.txt, so it can be played', () => {
    expect(WOTD.filter((w) => !DICT.has(w.word)).map((w) => w.word)).toEqual([]);
  });
});

describe('picking the day\'s word', () => {
  it('the same date always gives the same word, and the next day a different one', () => {
    expect(wordOfDay('2026-11-08')).toBe(wordOfDay('2026-11-08'));
    const year = yearOfDates(2026);
    for (let i = 1; i < year.length; i++) expect(wordOfDay(year[i]).word, year[i]).not.toBe(wordOfDay(year[i - 1]).word);
  });

  it('Monday and Tuesday are level 1, Wednesday to Friday level 2, the weekend level 3', () => {
    // 2026-11-09 is a Monday.
    const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
    expect(week.map(levelFor)).toEqual([1, 1, 2, 2, 2, 3, 3]);
    for (const d of week) expect(wordOfDay(d).level, d).toBe(levelFor(d));
  });

  it('across a whole year no word comes back within 30 days, and every word comes up', () => {
    const year = yearOfDates(2026);
    const lastSeen = new Map<string, number>();
    year.forEach((d, i) => {
      const w = wordOfDay(d).word;
      const before = lastSeen.get(w);
      if (before !== undefined) expect(i - before, `${w} on ${d}`).toBeGreaterThan(30);
      lastSeen.set(w, i);
    });
    expect(lastSeen.size).toBe(WOTD.length);
  });

  it('keeps going past the first year and before the start date', () => {
    for (const d of ['2025-06-01', '2027-02-28', '2030-12-31']) expect(WOTD).toContain(wordOfDay(d));
  });
});
