import { describe, expect, it } from 'vitest';
import { FAIL_PENALTY, LIVES_PER_GAME } from '../constants';
import { createGame } from '../game';
import { advance, apply } from '../reducer';
import { computeWinners, rankPlayers } from '../standings';
import type { GameState } from '../types';
import { ctx, dict, freezeBots, humanTurn, T0 } from './helpers';

/** Lets seat 0's (human) turn run out. */
function timeOut(s: GameState): GameState {
  return advance(s, ctx, s.turn!.endsAt);
}

/** Puts the human back on turn with inert bots, keeping lives and score. */
function backToHuman(s: GameState): GameState {
  const c = structuredClone(s);
  c.turn = { ...c.turn!, seat: 0, botActAt: null, stealPlans: [], endsAt: c.turn!.startedAt + 10_000 };
  return c;
}

describe('lives', () => {
  it('a time-out costs one life and the existing penalty', () => {
    const s = humanTurn('c');
    const after = timeOut(s);
    expect(after.players[0].lives).toBe(LIVES_PER_GAME - 1);
    expect(after.players[0].banked).toBe(-FAIL_PENALTY);
    expect(after.events.some((e) => e.kind === 'lifeLost' && e.seat === 0 && e.amount === LIVES_PER_GAME - 1)).toBe(true);
  });

  it('three time-outs freeze the player and the next turn goes to the following unfrozen player', () => {
    let s = humanTurn('c');
    s.players[1].frozen = true; // seat 1 is already out, so the turn after seat 0 is seat 2
    for (let i = 0; i < LIVES_PER_GAME; i++) {
      s = timeOut(backToHuman(s));
    }
    expect(s.players[0].lives).toBe(0);
    expect(s.players[0].frozen).toBe(true);
    expect(s.events.some((e) => e.kind === 'frozen' && e.seat === 0)).toBe(true);
    expect(s.turn!.seat).toBe(2);
  });

  it('a frozen player is skipped for the rest of the round', () => {
    let s = humanTurn('c');
    s.players[0].frozen = true;
    s.players[0].lives = 0;
    s = advance(s, ctx, s.turn!.endsAt); // seat 0's current turn ends (no further life lost at 0)
    const seats = new Set<number>();
    for (let t = s.turn!.startedAt; s.phase === 'playing' && seats.size < 20; t += 500) {
      s = advance(s, ctx, t);
      if (s.turn) seats.add(s.turn.seat);
    }
    expect(seats.has(0)).toBe(false);
  });

  it('a steal victim keeps their lives, and so does a failed stealer', () => {
    const s = freezeBots(humanTurn('c'));
    s.turn = { ...s.turn!, seat: 1 };
    const inWindow = s.turn.endsAt - 1000;
    const stolen = apply(s, ctx, { type: 'steal', seat: 0, word: 'cat' }, inWindow);
    expect(stolen.accepted).toBe(true);
    expect(stolen.state.players[1].lives).toBe(LIVES_PER_GAME);
    const failed = apply(s, ctx, { type: 'steal', seat: 0, word: 'qqqqqq' }, inWindow);
    expect(failed.state.players[0].lives).toBe(LIVES_PER_GAME);
  });

  it('a frozen player cannot steal, and nothing changes', () => {
    const s = freezeBots(humanTurn('c'));
    s.turn = { ...s.turn!, seat: 1 };
    s.players[0].frozen = true;
    s.players[0].banked = 40;
    const res = apply(s, ctx, { type: 'steal', seat: 0, word: 'cat' }, s.turn.endsAt - 1000);
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('frozen');
    expect(res.state.players[0].banked).toBe(40);
    expect(res.state.pile).toBe(s.pile);
  });

  it('practice time-outs do not cost lives', () => {
    let s = createGame({ seed: 'p', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy', mode: 'practice' }, dict);
    s = freezeBots(advance(s, ctx, T0 + 2500));
    s = timeOut(s);
    expect(s.players[0].lives).toBe(LIVES_PER_GAME);
    expect(s.players[0].frozen).toBe(false);
  });

  it('ranks frozen players below every unfrozen one, and frozen ones by points', () => {
    const s = humanTurn('c');
    const [a, b, c, d] = s.players;
    Object.assign(a, { frozen: true, banked: 90 });
    Object.assign(b, { frozen: false, banked: 10 });
    Object.assign(c, { frozen: true, banked: 30 });
    Object.assign(d, { frozen: false, banked: 5 });
    expect(rankPlayers(s.players).map((p) => p.id)).toEqual([b.id, d.id, a.id, c.id]);
    expect(computeWinners(s.players)).toEqual([b.id]);
  });

  it('a new game starts everyone with full lives and unfrozen', () => {
    const s = createGame({ seed: 'new', now: T0, humanName: 'Me', playerCount: 6, difficulty: 'hard' }, dict);
    expect(s.players.every((p) => p.lives === LIVES_PER_GAME && !p.frozen)).toBe(true);
  });
});
