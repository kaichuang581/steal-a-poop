import { afterEach, describe, expect, it } from 'vitest';
import {
  BOTS_HALVE_ON_FAILED_STEAL, MAX_PLAYERS, MIN_PLAYERS, TURNS_BY_SEATS, TURNS_BY_SEATS_OVERRIDES,
  TURNS_PER_PLAYER_PER_ROUND, advance, apply, createGame, setBotsHalveOnFailedSteal,
} from '../index';
import type { GameState } from '../index';
import { ctx, dict, humanTurn } from './helpers';

const clearOverrides = () => {
  for (const key of Object.keys(TURNS_BY_SEATS_OVERRIDES)) delete TURNS_BY_SEATS_OVERRIDES[Number(key)];
};

afterEach(() => {
  clearOverrides();
  setBotsHalveOnFailedSteal(true);
});

/** A state where bot `seat` is about to attempt a steal it cannot complete (no word starts with V). */
function botStealAboutToFail(seat = 2): GameState {
  const opening = humanTurn('c');
  const banked = apply(opening, ctx, { type: 'bank', seat: 0 }, opening.turn!.startedAt + 100).state;
  const s: GameState = structuredClone(banked);
  s.chainLetter = 'v';
  s.turn!.botActAt = null; // seat 1 stays put, so the steal is the only thing due
  s.turn!.stealPlans = [{ seat, at: s.turn!.startedAt + 500 }];
  s.players[seat].banked = 40;
  return s;
}

describe('TURNS_BY_SEATS', () => {
  it('is 5 at every table size by default, so nothing changes', () => {
    for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats++) {
      expect(TURNS_BY_SEATS(seats)).toBe(TURNS_PER_PLAYER_PER_ROUND);
      expect(TURNS_BY_SEATS(seats)).toBe(5);
    }
  });

  it('uses an override for that table size only', () => {
    TURNS_BY_SEATS_OVERRIDES[8] = 3;
    expect(TURNS_BY_SEATS(8)).toBe(3);
    expect(TURNS_BY_SEATS(7)).toBe(5);
    expect(TURNS_BY_SEATS(10)).toBe(5);
  });

  it('a round still lasts 5 turns a player with no override', () => {
    const s = humanTurn('c');
    s.players.forEach((p) => (p.turnsTaken = 4));
    const out = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, s.turn!.startedAt + 100).state;
    // Seat 0 has now taken 5, the rest have 4: the round continues.
    expect(out.round).toBe(1);
  });

  it('ends the round at the configured count, not at 5', () => {
    TURNS_BY_SEATS_OVERRIDES[4] = 4;
    const s = humanTurn('c');
    s.players.forEach((p) => (p.turnsTaken = 4));
    const out = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, s.turn!.startedAt + 100).state;
    expect(out.round).toBe(2);
    expect(out.players.every((p) => p.turnsTaken === 0)).toBe(true);
  });

  it('an 8-seat game at 3 turns ends with exactly 3 turns per player', () => {
    TURNS_BY_SEATS_OVERRIDES[8] = 3;
    let s = createGame({ seed: 'cfg8', now: 0, humanName: 'h', playerCount: 8, difficulty: 'easy' }, dict);
    for (let t = 0; t < 1_500_000 && s.phase !== 'gameOver'; t += 250) s = advance(s, ctx, t);
    expect(s.phase).toBe('gameOver');
    expect(s.players.every((p) => p.turnsTaken === TURNS_BY_SEATS(8))).toBe(true);
  });
});

describe('BOTS_HALVE_ON_FAILED_STEAL', () => {
  it('defaults to true', () => {
    expect(BOTS_HALVE_ON_FAILED_STEAL).toBe(true);
  });

  it('default: a failed bot steal halves the bot bank', () => {
    const s = botStealAboutToFail();
    const out = advance(s, ctx, s.turn!.startedAt + 500);
    expect(out.players[2].banked).toBe(20);
    expect(out.events.some((e) => e.kind === 'stealFail' && e.seat === 2)).toBe(true);
  });

  it('non-default: a failed bot steal leaves the bot bank alone', () => {
    setBotsHalveOnFailedSteal(false);
    const s = botStealAboutToFail();
    const out = advance(s, ctx, s.turn!.startedAt + 500);
    expect(out.players[2].banked).toBe(40);
    expect(out.events.some((e) => e.kind === 'stealFail' && e.seat === 2)).toBe(true);
  });

  it('non-default: a human failed steal still halves', () => {
    setBotsHalveOnFailedSteal(false);
    const opening = humanTurn('c');
    const banked = apply(opening, ctx, { type: 'bank', seat: 0 }, opening.turn!.startedAt + 100).state;
    const s: GameState = structuredClone(banked);
    s.players[0].banked = 33;
    s.turn!.botActAt = null;
    s.turn!.stealPlans = [];
    const out = apply(s, ctx, { type: 'steal', seat: 0, word: 'nope' }, s.turn!.endsAt - 1000);
    expect(out.accepted).toBe(true);
    expect(out.state.players[0].banked).toBe(16);
  });
});
