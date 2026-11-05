import { describe, expect, it } from 'vitest';
import { PRACTICE_TURN_MS } from '../constants';
import { createGame, dailySetup } from '../game';
import { advance, apply, inStealWindow } from '../reducer';
import { DEFAULT_SETTINGS, estimateMinutes, PRESETS, presetOf, resolveSettings } from '../settings';
import type { GameSettings } from '../settings';
import { roundTurnMs, turnDurationMs } from '../timer';
import type { GameState } from '../types';
import { ctx, dict, T0 } from './helpers';

/** A game with the given rules, advanced to the first turn (seat 0, the human), bots inert. */
function game(settings: Partial<GameSettings>, mode?: 'practice'): GameState {
  let s = createGame({ seed: 'settings', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium', settings, mode }, dict);
  s = advance(s, ctx, T0 + 2500);
  s = structuredClone(s);
  if (s.turn) { s.turn.botActAt = null; s.turn.stealPlans = []; }
  return s;
}

/** Puts the human back on turn with inert bots, keeping scores and lives. */
function humanAgain(s: GameState): GameState {
  const c = structuredClone(s);
  if (!c.turn) return c;
  c.turn = { ...c.turn, seat: 0, botActAt: null, stealPlans: [], endsAt: c.turn.startedAt + 10_000 };
  return c;
}

describe('game settings', () => {
  it('defaults are today\'s rules', () => {
    expect(resolveSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ turnsPerRound: 2, lives: 3, twists: true, stealWindowSeconds: 3, botCount: 5, botDifficulty: 'medium' });
    expect(presetOf(DEFAULT_SETTINGS)).toBe('standard');
    const s = createGame({ seed: 'd', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium' }, dict);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    // Round 1 plays plain, then every twist except the retired vowel_double, once each, cycling.
    expect(s.modifierDeck[0]).toBe('none');
    expect([...s.modifierDeck.slice(1)].sort()).toEqual(['double_letter', 'double_points_fast', 'no_e', 'six_plus']);
    expect(s.players.every((p) => p.lives === 3)).toBe(true);
  });

  it('rounds is ignored: the game runs on past it; turnsPerRound: 3 gives three turns each', () => {
    let s = createGame({ seed: 'short', now: 0, humanName: 'h', playerCount: 4, difficulty: 'easy', settings: { rounds: 1, turnsPerRound: 3, lives: 5, twists: false } }, dict);
    s.players[0].isHuman = false; s.players[0].difficulty = 'easy'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
    // Five wool and at most one lost per turn: nobody can freeze in three turns, so every seat takes all three.
    const turns = new Set<string>();
    for (let t = 0; t < 600_000 && s.round === 1; t += 50) {
      s = advance(s, ctx, t);
      if (s.turn && s.round === 1) turns.add(`${s.turn.seat}:${s.turn.startedAt}`);
    }
    expect(s.round).toBe(2);
    expect(s.phase).not.toBe('gameOver');
    const perSeat = [0, 1, 2, 3].map((seat) => [...turns].filter((k) => k.startsWith(`${seat}:`)).length);
    expect(perSeat).toEqual([3, 3, 3, 3]);
  });

  it('turns speed up each round: 16 s first, 2 s less each round, never under 5 s', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map((r) => roundTurnMs(r))).toEqual([16_000, 14_000, 12_000, 10_000, 8_000, 6_000, 5_000, 5_000, 5_000]);
    expect(roundTurnMs(0)).toBe(16_000);
    const s = game({ twists: false });
    expect(s.turn!.durationMs).toBe(16_000);
  });

  it('the pile and the short-turn twist still cut the round\'s turn, never under 5 s', () => {
    expect(turnDurationMs(0, 'none', 16_000)).toBe(16_000);
    expect(turnDurationMs(60, 'none', 16_000)).toBe(10_000);
    expect(turnDurationMs(0, 'double_points_fast', 11_000)).toBe(9_000);
    expect(turnDurationMs(30, 'double_points_fast', 5_000)).toBe(5_000);
  });

  it('a later round starts its turns at that round\'s length', () => {
    let s = createGame({ seed: 'ramp', now: 0, humanName: 'h', playerCount: 4, difficulty: 'medium', settings: { twists: false, lives: 5 } }, dict);
    s.players[0].isHuman = false; s.players[0].difficulty = 'medium'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
    const seen = new Map<number, number>();
    for (let t = 0; t < 3_000_000 && s.phase !== 'gameOver'; t += 250) {
      s = advance(s, ctx, t);
      if (s.turn && !seen.has(s.round)) seen.set(s.round, s.turn.durationMs);
    }
    // Two turns a round and five wool each: nobody can freeze before round 3, so the first three rounds all play.
    expect([1, 2, 3].map((r) => seen.get(r))).toEqual([16_000, 14_000, 12_000]);
    for (const [round, ms] of seen) expect(ms).toBe(roundTurnMs(round));
  });

  it('old saves with a turnSeconds rule are ignored', () => {
    expect(resolveSettings({ turnSeconds: 8 } as Partial<GameSettings>)).toEqual(DEFAULT_SETTINGS);
  });

  it('lives: unlimited is read as 5 wool balls; lives: 1 freezes on the first time-out', () => {
    expect(resolveSettings({ lives: 'unlimited' }).lives).toBe(5);
    let s = game({ lives: 'unlimited', twists: false });
    expect(s.players.every((p) => p.lives === 5)).toBe(true);
    for (let i = 0; i < 4; i++) s = humanAgain(advance(humanAgain(s), ctx, humanAgain(s).turn!.endsAt));
    expect(s.players[0].lives).toBe(1);
    expect(s.players[0].frozen).toBe(false);
    s = advance(humanAgain(s), ctx, humanAgain(s).turn!.endsAt);
    expect(s.players[0].frozen).toBe(true);
    let one = game({ lives: 1, twists: false });
    one = advance(one, ctx, one.turn!.endsAt);
    expect(one.players[0].frozen).toBe(true);
  });

  it('twists: false draws no twist; stealWindowSeconds 0 rejects steals and 5 opens at 5 s', () => {
    const plain = game({ twists: false });
    expect(plain.modifierDeck.every((m) => m === 'none')).toBe(true);
    expect(plain.modifier).toBe('none');
    const noSteal = game({ stealWindowSeconds: 0 });
    noSteal.turn = { ...noSteal.turn!, seat: 1 };
    expect(inStealWindow(noSteal, noSteal.turn.endsAt - 500)).toBe(false);
    const res = apply(noSteal, ctx, { type: 'steal', seat: 0, word: 'cat' }, noSteal.turn.endsAt - 500);
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('outside_steal_window');
    const wide = game({ stealWindowSeconds: 5 });
    expect(inStealWindow(wide, wide.turn!.endsAt - 4500)).toBe(true);
    expect(inStealWindow(wide, wide.turn!.endsAt - 5500)).toBe(false);
  });

  it('the Daily Table and Practice ignore the form', () => {
    const daily = createGame(dailySetup(new Date('2026-11-03T12:00:00Z'), 'Me', T0), dict);
    expect(daily.settings).toEqual(DEFAULT_SETTINGS);
    const practice = game({ rounds: 5, lives: 1 }, 'practice');
    expect(practice.turn!.durationMs).toBe(PRACTICE_TURN_MS);
    const timedOut = advance(practice, ctx, practice.turn!.endsAt);
    expect(timedOut.players[0].frozen).toBe(false);
    expect(timedOut.players[0].banked).toBe(0);
  });

  it('estimates longer games for more wool and more turns: about 7 min for Quick and 9 for Standard with four bots', () => {
    const quick = estimateMinutes({ ...DEFAULT_SETTINGS, ...PRESETS.quick, botCount: 4 });
    const standard = estimateMinutes({ ...DEFAULT_SETTINGS, ...PRESETS.standard, botCount: 4 });
    const long = estimateMinutes({ ...DEFAULT_SETTINGS, ...PRESETS.long, botCount: 4 });
    expect(quick).toBeGreaterThanOrEqual(6);
    expect(quick).toBeLessThanOrEqual(8);
    expect(standard).toBeGreaterThanOrEqual(8);
    expect(standard).toBeLessThanOrEqual(10);
    expect(quick).toBeLessThan(standard);
    expect(standard).toBeLessThan(long);
    expect(estimateMinutes({ ...DEFAULT_SETTINGS, rounds: 1 })).toBe(estimateMinutes(DEFAULT_SETTINGS)); // rounds no longer counts
    expect(presetOf({ ...DEFAULT_SETTINGS, ...PRESETS.long })).toBe('long');
    expect(presetOf({ ...DEFAULT_SETTINGS, rounds: 2 })).toBe('standard'); // rounds is not a rule any more
    expect(presetOf({ ...DEFAULT_SETTINGS, turnsPerRound: 5 })).toBe('custom');
  });
});
