import { describe, expect, it } from 'vitest';
import { PRACTICE_TURN_MS } from '../constants';
import { createGame, dailySetup } from '../game';
import { advance, apply, inStealWindow } from '../reducer';
import { DEFAULT_SETTINGS, estimateMinutes, PRESETS, presetOf, resolveSettings } from '../settings';
import type { GameSettings } from '../settings';
import { turnDurationMs } from '../timer';
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
    expect(DEFAULT_SETTINGS).toMatchObject({ rounds: 3, turnsPerRound: 5, turnSeconds: 10, lives: 3, twists: true, stealWindowSeconds: 3 });
    expect(presetOf(DEFAULT_SETTINGS)).toBe('standard');
    const s = createGame({ seed: 'd', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium' }, dict);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    expect(s.modifierDeck).toHaveLength(3);
  });

  it('rounds: 1 ends the game after one round; turnsPerRound: 3 gives three turns each', () => {
    let s = createGame({ seed: 'short', now: 0, humanName: 'h', playerCount: 4, difficulty: 'easy', settings: { rounds: 1, turnsPerRound: 3, lives: 'unlimited', twists: false } }, dict);
    s.players[0].isHuman = false; s.players[0].difficulty = 'easy'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
    s = advance(s, ctx, 600_000);
    expect(s.phase).toBe('gameOver');
    expect(s.round).toBe(1);
    expect(s.players.every((p) => p.turnsTaken === 3)).toBe(true);
  });

  it('turnSeconds: 15 gives a 15 s turn at pile 0, 9 s at pile 60, never under 5', () => {
    expect(turnDurationMs(0, 'none', 15_000)).toBe(15_000);
    expect(turnDurationMs(60, 'none', 15_000)).toBe(9_000);
    expect(turnDurationMs(200, 'none', 15_000)).toBe(5_000);
    const s = game({ turnSeconds: 15, twists: false });
    expect(s.turn!.durationMs).toBe(15_000);
  });

  it('lives: unlimited never freezes; lives: 1 freezes on the first time-out', () => {
    let s = game({ lives: 'unlimited', twists: false });
    for (let i = 0; i < 10; i++) s = humanAgain(advance(humanAgain(s), ctx, humanAgain(s).turn!.endsAt));
    expect(s.players[0].frozen).toBe(false);
    expect(s.events.some((e) => e.kind === 'frozen' || e.kind === 'lifeLost')).toBe(false);
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
    const practice = game({ turnSeconds: 5, lives: 1 }, 'practice');
    expect(practice.turn!.durationMs).toBe(PRACTICE_TURN_MS);
    const timedOut = advance(practice, ctx, practice.turn!.endsAt);
    expect(timedOut.players[0].frozen).toBe(false);
    expect(timedOut.players[0].banked).toBe(0);
  });

  it('estimates 3 to 4 minutes for Quick and 10 to 12 for Standard with four bots', () => {
    const quick = estimateMinutes({ ...DEFAULT_SETTINGS, ...PRESETS.quick, botCount: 4 });
    const standard = estimateMinutes({ ...DEFAULT_SETTINGS, ...PRESETS.standard, botCount: 4 });
    expect(quick).toBeGreaterThanOrEqual(3);
    expect(quick).toBeLessThanOrEqual(4);
    expect(standard).toBeGreaterThanOrEqual(10);
    expect(standard).toBeLessThanOrEqual(12);
    expect(presetOf({ ...DEFAULT_SETTINGS, ...PRESETS.long })).toBe('long');
    expect(presetOf({ ...DEFAULT_SETTINGS, rounds: 2 })).toBe('custom');
  });
});
