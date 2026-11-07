import { describe, expect, it } from 'vitest';
import { advance, apply } from '../reducer';
import { createGame } from '../game';
import { carriedTurnMs, roundTurnMs, wordQuality, wordShiftMs } from '../timer';
import type { GameSettings } from '../settings';
import type { GameState } from '../types';
import { ctx, dict, freezeBots, T0 } from './helpers';

const open = (timeCarry?: GameSettings['timeCarry'], mode: 'quick' | 'practice' = 'quick') => {
  let s = createGame({ seed: 'carry', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium', settings: timeCarry ? { timeCarry } : undefined, mode: mode === 'practice' ? 'practice' : undefined }, dict);
  s = advance(s, ctx, T0 + 2500);
  return s;
};
const turnMs = (s: GameState) => s.turn!.endsAt - s.turn!.startedAt;

describe('word quality and shift', () => {
  it('counts letters past four and two per hard letter, capped at 4 s', () => {
    expect(wordQuality('cat')).toBe(0);
    expect(wordQuality('tiger')).toBe(1);
    expect(wordQuality('jazz')).toBe(6); // three hard letters, four letters long
    expect(wordShiftMs('cat')).toBe(0);
    expect(wordShiftMs('tiger')).toBe(500);
    expect(wordShiftMs('xylophonesandzebras')).toBe(4000);
  });
  it('keeps a carried turn between 5 s and 20 s', () => {
    expect(carriedTurnMs(16_000, 4_000)).toBe(20_000);
    expect(carriedTurnMs(16_000, 8_000)).toBe(20_000);
    expect(carriedTurnMs(6_000, -4_000)).toBe(5_000);
  });
});

describe('time carry in a game', () => {
  it('off (the default) plays exactly as before: the opening turn is the round length', () => {
    expect(turnMs(open())).toBe(roundTurnMs(1));
    expect(turnMs(open('off'))).toBe(roundTurnMs(1));
  });
  it('on: the opening turn is 10 s', () => {
    expect(turnMs(open('more'))).toBe(10_000);
    expect(turnMs(open('less'))).toBe(10_000);
  });
  it('more: a good word stretches the next turn; less: it squeezes it', () => {
    for (const [mode, sign] of [['more', 1], ['less', -1]] as const) {
      const s = open(mode);
      const humanSeat = s.turn!.seat;
      s.chainLetter = 't';
      const next = apply(freezeBots(s), ctx, { type: 'play', seat: humanSeat, word: 'tomorrow' }, s.turn!.startedAt + 500);
      expect(next.accepted).toBe(true);
      const expected = roundTurnMs(1) + sign * wordShiftMs('tomorrow');
      expect(turnMs(next.state)).toBe(expected);
    }
  });
  it('a timeout carries nothing', () => {
    const s = open('more');
    const after = advance(freezeBots(s), ctx, s.turn!.endsAt + 10);
    expect(after.carryMs ?? 0).toBe(0);
    if (after.turn) expect(turnMs(after)).toBe(roundTurnMs(after.round));
  });
  it('practice games ignore it', () => {
    const s = open('more', 'practice');
    expect(turnMs(s)).not.toBe(10_000);
  });
});
