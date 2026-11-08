import { describe, expect, it } from 'vitest';
import { apply } from '../reducer';
import { suggestCorrection } from '../typos';
import { ctx, dict, humanTurn, T0 } from './helpers';

const base = { dict, chainLetter: 'c', used: [] as string[], modifier: 'tab' as never };
const vctx = (letter: string, used: string[] = []) => ({ dict, chainLetter: letter, used, modifier: 'vowel_double' as const });

describe('suggestCorrection', () => {
  it('fixes a clear typo: one extra letter', () => {
    expect(suggestCorrection('cats', vctx('c'))).toBe('cat');
  });
  it('fixes a swapped pair', () => {
    expect(suggestCorrection('cta', vctx('c'))).toBe('cat');
  });
  it('fixes a wrong letter', () => {
    expect(suggestCorrection('cot', vctx('c'))).toBe('cat');
  });
  it('fixes a missing letter', () => {
    expect(suggestCorrection('tige', vctx('t'))).toBe('tiger');
  });
  it('gives no suggestion when two words fit', () => {
    expect(suggestCorrection('tox', vctx('t'))).toBeNull(); // tow, toy, tax
  });
  it('gives no suggestion when nothing is close', () => {
    expect(suggestCorrection('qwerty', vctx('q'))).toBeNull();
  });
  it('never suggests a word that is already used', () => {
    expect(suggestCorrection('cats', vctx('c', ['cat']))).toBeNull();
  });
  it('ignores numbers and symbols', () => {
    expect(suggestCorrection('c4t', vctx('c'))).toBeNull();
    void base;
  });
});

describe('typo flow in apply', () => {
  const start = T0 + 2500;
  it('a play typo returns a suggestion and changes nothing', () => {
    const s = humanTurn('c');
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'cats' }, start + 500);
    expect(r.accepted).toBe(false);
    expect(r.suggestion).toBe('cat');
    expect(r.state.players[0].banked).toBe(0);
    expect(r.state.pile).toBe(0);
    expect(r.state.turn!.seat).toBe(0);
    const confirmed = apply(r.state, ctx, { type: 'play', seat: 0, word: r.suggestion! }, start + 900);
    expect(confirmed.accepted).toBe(true);
    expect(confirmed.state.players[0].lastWord).toBe('cat');
  });
});

