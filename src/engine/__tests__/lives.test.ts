import { describe, expect, it } from 'vitest';
import { EXTRA_WOOL_CAP, LIVES_PER_GAME } from '../constants';
import { createGame } from '../game';
import { advance, apply } from '../reducer';
import { computeWinners, rankPlayers } from '../standings';
import type { GameState } from '../types';
import { ctx, dict, freezeBots, humanTurn, T0 } from './helpers';

/** Lets seat 0's (human) turn run out. */
function timeOut(s: GameState): GameState {
  return advance(s, ctx, s.turn!.endsAt);
}

/** Puts the human back on turn with inert bots, keeping lives. */
function backToHuman(s: GameState): GameState {
  const c = structuredClone(s);
  c.turn = { ...c.turn!, seat: 0, botActAt: null, endsAt: c.turn!.startedAt + 10_000 };
  return c;
}

describe('lives', () => {
  it('a time-out costs one wool ball and no points', () => {
    const s = humanTurn('c');
    const after = timeOut(s);
    expect(after.players[0].lives).toBe(LIVES_PER_GAME - 1);
    expect(after.players[0].banked).toBe(0);
    expect(after.players[0].frozen).toBe(false);
    expect(after.events.some((e) => e.kind === 'timeout' && e.seat === 0)).toBe(true);
    expect(after.events.some((e) => e.kind === 'lifeLost' && e.seat === 0 && e.amount === LIVES_PER_GAME - 1)).toBe(true);
    expect(after.turn!.seat).toBe(1);
  });

  it('three time-outs freeze the player and the next turn goes to the following unfrozen player', () => {
    let s = humanTurn('c');
    s.players[1].frozen = true; // seat 1 is already out, so the turn after seat 0 is seat 2
    let lastEnd = 0;
    for (let i = 0; i < LIVES_PER_GAME; i++) {
      const c = backToHuman(s);
      lastEnd = c.turn!.endsAt;
      s = timeOut(c);
    }
    expect(s.players[0].lives).toBe(0);
    expect(s.players[0].frozen).toBe(true);
    expect(s.players[0].frozenAt).toBe(lastEnd);
    expect(s.events.filter((e) => e.kind === 'frozen' && e.seat === 0)).toHaveLength(1);
    expect(s.phase).toBe('playing'); // seats 2 and 3 are still in
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

  it('wool is capped at the starting count plus the extra allowance', () => {
    const s = freezeBots(humanTurn('c'));
    s.turn = { ...s.turn!, seat: 1 };
    s.players[0].lives = LIVES_PER_GAME + EXTRA_WOOL_CAP;
    s.trap = { trapperSeat: 0, victimSeat: 1, letter: 'x' };
    const r = advance(s, ctx, s.turn.endsAt);
    expect(r.players[0].lives).toBe(LIVES_PER_GAME + EXTRA_WOOL_CAP); // the trap pays, but not past the cap
    expect(r.players[1].lives).toBe(LIVES_PER_GAME - 1); // the trapped sheep still loses one
  });

  it('tour time-outs cost nobody wool', () => {
    let s = createGame({ seed: 't', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy', mode: 'tour' }, dict);
    s = freezeBots(advance(s, ctx, T0 + 2500));
    s = timeOut(s);
    s = advance(freezeBots(s), ctx, s.turn!.endsAt); // seat 1 (a bot) runs out too
    expect(s.players.every((p) => p.lives === LIVES_PER_GAME)).toBe(true);
  });

  it('ranks unfrozen players above frozen ones: more wool first, then the later freeze', () => {
    const s = humanTurn('c');
    const [a, b, c, d] = s.players;
    Object.assign(a, { frozen: true, lives: 0, frozenAt: 500 });
    Object.assign(b, { frozen: false, lives: 1 });
    Object.assign(c, { frozen: true, lives: 0, frozenAt: 900 });
    Object.assign(d, { frozen: false, lives: 4 });
    expect(rankPlayers(s.players).map((p) => p.id)).toEqual([d.id, b.id, c.id, a.id]);
    expect(computeWinners(s.players)).toEqual([d.id]);
  });

  it('a new game starts everyone with full lives and unfrozen', () => {
    const s = createGame({ seed: 'new', now: T0, humanName: 'Me', playerCount: 6, difficulty: 'hard' }, dict);
    expect(s.players.every((p) => p.lives === LIVES_PER_GAME && !p.frozen && p.frozenAt === null)).toBe(true);
  });
});

describe('traps with frozen players', () => {
  it('the last unfrozen player cannot trap themselves', () => {
    const s = humanTurn('t');
    for (const p of s.players.slice(1)) p.frozen = true;
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'tax' }, s.turn!.startedAt + 100);
    expect(r.accepted).toBe(true);
    expect(r.state.trap).toBeNull();
  });
});
