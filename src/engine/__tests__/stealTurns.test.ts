import { describe, expect, it } from 'vitest';
import { STEAL_LATE_SHARE, STEAL_TURN_CHANCE } from '../constants';
import { createGame } from '../game';
import { advance, inStealWindow } from '../reducer';
import type { GameSettings } from '../settings';
import type { GameState } from '../types';
import { ctx, dict, humanTurn, T0 } from './helpers';

/** A game of bots only, so turns roll on their own. */
function botGame(seed: string, settings: Partial<GameSettings> = {}): GameState {
  const s = createGame({ seed, now: T0, humanName: 'h', playerCount: 5, difficulty: 'medium', settings: { lives: 5, twists: false, ...settings } }, dict);
  s.players[0].isHuman = false; s.players[0].difficulty = 'medium'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
  return s;
}

/** Every distinct turn of a game, with the state as it stood when the turn started. */
function turnsOf(s0: GameState, limit = 400): GameState[] {
  const out: GameState[] = [];
  let s = s0;
  let lastKey = '';
  for (let t = T0; t < T0 + 4_000_000 && s.phase !== 'gameOver' && out.length < limit; t += 100) {
    s = advance(s, ctx, t);
    const turn = s.turn;
    if (!turn || s.phase !== 'playing') continue;
    const key = `${turn.seat}:${turn.startedAt}`;
    if (key === lastKey) continue;
    lastKey = key;
    out.push(s);
  }
  return out;
}

describe('steal turns', () => {
  it('the red window only opens on a steal turn', () => {
    const s = humanTurn();
    const end = s.turn!.endsAt;
    expect(inStealWindow(s, end - 1000)).toBe(true);
    const quiet = structuredClone(s);
    quiet.turn!.stealable = false;
    expect(inStealWindow(quiet, end - 1000)).toBe(false);
    expect(inStealWindow(quiet, end - 1)).toBe(false);
  });

  it('about a third of turns are steal turns, each announced with a stealTurn event as it starts', () => {
    let turns = 0, stealTurns = 0;
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      for (const s of turnsOf(botGame(seed))) {
        const turn = s.turn!;
        turns++;
        const announced = s.events.some((e) => e.kind === 'stealTurn' && e.seat === turn.seat && e.at === turn.startedAt);
        if (turn.stealable) stealTurns++;
        expect(announced).toBe(turn.stealable);
      }
    }
    expect(turns).toBeGreaterThan(150);
    const share = stealTurns / turns;
    expect(share).toBeGreaterThan(STEAL_TURN_CHANCE - 0.1);
    expect(share).toBeLessThan(STEAL_TURN_CHANCE + 0.1);
  });

  it('bots plan steals only on a steal turn; there the bot on turn always runs into the red, and bots act last', () => {
    let lateOnStealTurns = 0, stealTurnsInRoundOne = 0;
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      for (const s of turnsOf(botGame(seed))) {
        const turn = s.turn!;
        if (!turn.stealable) {
          expect(turn.stealPlans).toEqual([]);
          // In the 15 s first round a bot answers 4.5 to 10.5 s in: never in the last 3 s unless pushed there.
          if (s.round === 1) expect(turn.botActAt!).toBeLessThan(turn.endsAt - 3000);
        } else {
          // The bot on turn answers, and the other bots steal, only in the window's last share: a person who reads
          // the letter and types has the first go at every announced window.
          const lastShare = turn.endsAt - 3000 * STEAL_LATE_SHARE - 1;
          expect(turn.botActAt!).toBeGreaterThanOrEqual(lastShare);
          for (const p of turn.stealPlans) expect(p.at).toBeGreaterThanOrEqual(lastShare);
          if (s.round === 1) { stealTurnsInRoundOne++; if (turn.botActAt! >= turn.endsAt - 3000) lateOnStealTurns++; }
        }
      }
    }
    expect(stealTurnsInRoundOne).toBeGreaterThan(10);
    expect(lateOnStealTurns).toBe(stealTurnsInRoundOne);
  });

  it('with stealing switched off there are no steal turns at all', () => {
    for (const s of turnsOf(botGame('off', { stealWindowSeconds: 0 }), 120)) {
      expect(s.turn!.stealable).toBe(false);
      expect(s.turn!.stealPlans).toEqual([]);
      expect(s.events.some((e) => e.kind === 'stealTurn')).toBe(false);
    }
  });

  it('in the tour every turn is a steal turn, without the alarm, so the tutorial can show a steal', () => {
    const s = advance(createGame({ seed: 'tour', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy', mode: 'tour' }, dict), ctx, T0 + 2500);
    expect(s.turn!.stealable).toBe(true);
    expect(s.events.some((e) => e.kind === 'stealTurn')).toBe(false);
  });

  it('the faster-round twist is no longer dealt: speed is the game\'s own pace', () => {
    for (const seed of ['x', 'y', 'z']) {
      const s = createGame({ seed, now: T0, humanName: 'h', playerCount: 4, difficulty: 'medium' }, dict);
      expect(s.modifierDeck).not.toContain('double_points_fast');
    }
  });
});
