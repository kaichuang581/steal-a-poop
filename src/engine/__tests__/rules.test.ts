import { describe, expect, it } from 'vitest';
import { basePoints, letterBonus, scoreWord } from '../scoring';
import { rarityOf } from '../rarity';
import { turnDurationMs } from '../timer';
import { validateWord } from '../validation';
import { compareStandings, computeWinners } from '../standings';
import type { Player } from '../types';
import { dict } from './helpers';

const base = { dict, chainLetter: 'c', used: [] as string[], modifier: 'no_e' as const };

describe('word validation', () => {
  it('accepts a dictionary word with the right start letter', () => {
    expect(validateWord('Cat ', base)).toEqual({ ok: true, word: 'cat' });
  });
  it.each([
    ['c4t', 'format'],
    ['ca', 'too_short'],
    ['tab', 'wrong_start'],
    ['cxx', 'not_in_dictionary'],
  ])('rejects %s as %s', (w, reason) => {
    expect(validateWord(w, base)).toEqual({ ok: false, reason });
  });
  it('rejects already-used words', () => {
    expect(validateWord('cat', { ...base, used: ['cat'] })).toEqual({ ok: false, reason: 'already_used' });
  });
  it('enforces modifiers', () => {
    expect(validateWord('cattle', { ...base, modifier: 'six_plus' })).toMatchObject({ ok: true });
    expect(validateWord('cat', { ...base, modifier: 'six_plus' })).toEqual({ ok: false, reason: 'modifier_six_plus' });
    expect(validateWord('cat', { ...base, modifier: 'double_letter' })).toEqual({ ok: false, reason: 'modifier_double_letter' });
    expect(validateWord('cattle', { ...base, modifier: 'double_letter' })).toMatchObject({ ok: true });
    expect(validateWord('cattle', { ...base, modifier: 'no_e' })).toEqual({ ok: false, reason: 'modifier_no_e' });
  });
});

describe('scoring', () => {
  it('letter bonuses: XZQJ +3, YKVW +1, per occurrence', () => {
    expect(letterBonus('jazz')).toBe(9);
    expect(letterBonus('quiz')).toBe(6);
    expect(letterBonus('wow')).toBe(2);
    expect(letterBonus('cat')).toBe(0);
  });
  it('points = round(length x rarity) + bonuses', () => {
    expect(rarityOf('cat')).toBe('common');
    expect(basePoints('cat')).toBe(3);
    expect(rarityOf('jazz')).toBe('rare');
    expect(basePoints('jazz')).toBe(8 + 9);
  });
  it('modifiers double points', () => {
    expect(scoreWord('apple', 'vowel_double')).toBe(scoreWord('apple', 'no_e') * 2);
    expect(scoreWord('cat', 'vowel_double')).toBe(scoreWord('cat', 'no_e'));
    expect(scoreWord('cat', 'double_points_fast')).toBe(6);
  });
});

describe('timer shrink', () => {
  it('10s base, -1s per 10 pile, floor 5s', () => {
    expect(turnDurationMs(0, 'no_e')).toBe(10000);
    expect(turnDurationMs(9, 'no_e')).toBe(10000);
    expect(turnDurationMs(25, 'no_e')).toBe(8000);
    expect(turnDurationMs(50, 'no_e')).toBe(5000);
    expect(turnDurationMs(500, 'no_e')).toBe(5000);
  });
  it('double_points_fast is 2s shorter, still floored', () => {
    expect(turnDurationMs(0, 'double_points_fast')).toBe(8000);
    expect(turnDurationMs(500, 'double_points_fast')).toBe(5000);
  });
});

describe('tie-breaks', () => {
  const p = (id: number, lives: number, steals: number, longestWord: string, frozenAt: number | null = null) =>
    ({ id, banked: 0, lives, frozen: frozenAt !== null, frozenAt, steals, longestWord }) as Player;
  it('unfrozen before frozen, whatever the steals', () => {
    expect(compareStandings(p(0, 1, 0, ''), p(1, 0, 9, 'zzzzzz', 500))).toBeLessThan(0);
  });
  it('among the unfrozen: more wool, then steals, then longest word', () => {
    expect(compareStandings(p(0, 3, 0, ''), p(1, 2, 9, 'zzzzzz'))).toBeLessThan(0);
    expect(compareStandings(p(0, 3, 2, ''), p(1, 3, 1, 'zzzzzz'))).toBeLessThan(0);
    expect(compareStandings(p(0, 3, 1, 'abcd'), p(1, 3, 1, 'abc'))).toBeLessThan(0);
  });
  it('among the frozen: the later freeze ranks higher, then steals, then longest word', () => {
    expect(compareStandings(p(0, 0, 0, '', 900), p(1, 0, 9, 'zzzzzz', 500))).toBeLessThan(0);
    expect(compareStandings(p(0, 0, 2, '', 500), p(1, 0, 1, 'zzzzzz', 500))).toBeLessThan(0);
    expect(compareStandings(p(0, 0, 1, 'abcd', 500), p(1, 0, 1, 'abc', 500))).toBeLessThan(0);
  });
  it('winners', () => {
    expect(computeWinners([p(0, 3, 1, 'ab'), p(1, 3, 2, 'a'), p(2, 1, 9, 'abcdef')])).toEqual([1]);
    expect(computeWinners([p(0, 3, 1, 'ab'), p(1, 3, 1, 'cd')])).toEqual([0, 1]);
    expect(computeWinners([p(0, 1, 0, ''), p(1, 0, 9, 'abcdef', 800), p(2, 0, 9, 'abcdef', 900)])).toEqual([0]);
    expect(computeWinners([p(0, 0, 0, '', 800), p(1, 0, 0, '', 900)])).toEqual([1]);
  });
});
