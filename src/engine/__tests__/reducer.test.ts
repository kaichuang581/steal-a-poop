import { describe, expect, it } from 'vitest';
import { apply, advance, inStealWindow } from '../reducer';
import { createGame } from '../game';
import { scoreWord } from '../scoring';
import type { GameState } from '../types';
import { ctx, dict, freezeBots, humanTurn, T0 } from './helpers';

const start = T0 + 2500;

describe('determinism', () => {
  it('same seed gives same letter, modifiers and lineup', () => {
    const mk = () => createGame({ seed: 'daily:2026-10-31', now: 0, humanName: 'a', playerCount: 6, difficulty: 'hard' }, dict);
    const a = mk(), b = mk();
    expect(a).toEqual(b);
    const c = createGame({ seed: 'other', now: 0, humanName: 'a', playerCount: 6, difficulty: 'hard' }, dict);
    expect(c.players.map((p) => p.name)).not.toEqual(a.players.map((p) => p.name));
  });
  it('advance replays identically', () => {
    const s = humanTurn();
    expect(advance(s, ctx, start + 60_000)).toEqual(advance(s, ctx, start + 60_000));
  });
});

describe('play and bank', () => {
  it('a valid play adds to the pile and moves the chain letter', () => {
    const r = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'cat' }, start + 1000);
    expect(r.accepted).toBe(true);
    expect(r.state.pile).toBe(scoreWord('cat', r.state.modifier));
    expect(r.state.chainLetter).toBe('t');
    expect(r.state.turn!.seat).toBe(1);
    expect(r.state.players[0].lastWord).toBe('cat');
  });
  it('bank takes the whole pile, resets it, keeps the chain letter', () => {
    const s = humanTurn('c');
    const r1 = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 1000);
    const pile = r1.state.pile;
    // jump to the human's next turn by forcing it
    const s2 = structuredClone(r1.state);
    s2.turn!.seat = 0; s2.turn!.botActAt = null;
    const r2 = apply(s2, ctx, { type: 'bank', seat: 0 }, start + 2000);
    expect(r2.state.players[0].banked).toBe(pile);
    expect(r2.state.pile).toBe(0);
    expect(r2.state.chainLetter).toBe('t');
  });
  it('invalid word costs 5, pile stays, turn passes', () => {
    const r = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'zzz' }, start + 500);
    expect(r.reason).toBe('wrong_start');
    expect(r.state.players[0].banked).toBe(-5);
    expect(r.state.turn!.seat).toBe(1);
  });
  it('timeout costs 5 and passes the turn', () => {
    const s = humanTurn();
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].banked).toBe(-5);
    expect(out.events.some((e) => e.kind === 'timeout')).toBe(true);
  });
  it('rejects actions out of turn', () => {
    expect(apply(humanTurn(), ctx, { type: 'bank', seat: 1 }, start + 100).accepted).toBe(false);
  });
});

/** Human (seat 0) plays 'cat', then bot seat 1 is active and frozen. */
function botTurnWithPile(): GameState {
  const r = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100);
  return freezeBots(r.state);
}

describe('steal resolution', () => {
  it('only opens in the last 3 seconds of another player\'s turn', () => {
    const s = botTurnWithPile();
    const end = s.turn!.endsAt;
    expect(inStealWindow(s, end - 3001)).toBe(false);
    expect(inStealWindow(s, end - 3000)).toBe(true);
    expect(apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 4000).accepted).toBe(false);
  });
  it('valid steal: stealer plays, banks the whole pile incl. their word, +5', () => {
    const s = botTurnWithPile();
    const pileBefore = s.pile;
    const end = s.turn!.endsAt;
    const r = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 1000);
    const pts = scoreWord('tiger', s.modifier);
    expect(r.state.players[0].banked).toBe(pileBefore + pts + 5);
    expect(r.state.players[0].steals).toBe(1);
    expect(r.state.pile).toBe(0);
    expect(r.state.chainLetter).toBe('r');
    expect(r.state.turn!.seat).toBe(2); // play continues after the victim
  });
  it('an invalid steal word changes nothing and the turn continues', () => {
    const s = botTurnWithPile();
    const end = s.turn!.endsAt;
    const r = apply(s, ctx, { type: 'steal', seat: 0, word: 'nope' }, end - 1000);
    expect(r.state.turn!.seat).toBe(1);
    expect(r.state.pile).toBe(s.pile);
    expect(r.state.players[0].steals).toBe(0);
  });
  it('steals are unlimited: the same player can steal again in a later turn', () => {
    const s = botTurnWithPile();
    const first = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, s.turn!.endsAt - 1000).state;
    const again = structuredClone(first);
    again.turn!.seat = 1; again.turn!.botActAt = null; again.turn!.stealPlans = [];
    const second = apply(again, ctx, { type: 'steal', seat: 0, word: 'rat' }, again.turn!.endsAt - 1000);
    expect(second.accepted).toBe(true);
    expect(second.state.players[0].steals).toBe(2);
  });
  it('players never have a token count', () => {
    expect(botTurnWithPile().players[0]).not.toHaveProperty('tokens');
  });
});

describe('letter trap', () => {
  it('pays the trapper +5 when the next player fails', () => {
    const r = apply(humanTurn('t'), ctx, { type: 'play', seat: 0, word: 'tax' }, start + 100);
    expect(r.state.trap).toMatchObject({ trapperSeat: 0, victimSeat: 1, letter: 'x' });
    const s = freezeBots(r.state);
    const pts = 0;
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].banked).toBe(pts + 5);
    expect(out.players[1].banked).toBe(-5);
    expect(out.trap).toBeNull();
    expect(out.events.some((e) => e.kind === 'trapSprung')).toBe(true);
  });
  it('no payout when the next player succeeds or banks', () => {
    const r = apply(humanTurn('t'), ctx, { type: 'play', seat: 0, word: 'tax' }, start + 100);
    const s = freezeBots(r.state);
    s.players[1].isHuman = true; // let the test drive seat 1
    const ok = apply(s, ctx, { type: 'bank', seat: 1 }, s.turn!.startedAt + 500);
    expect(ok.state.players[0].banked).toBe(0);
    expect(ok.state.trap).toBeNull();
  });
});

describe('pile burn and rounds', () => {
  it('unbanked pile burns at round end; banked scores carry over; next round starts', () => {
    const s = humanTurn('c');
    s.players.forEach((p) => (p.turnsTaken = 4));
    s.players[2].banked = 12;
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100);
    // seat 0 finishing makes turnsTaken 5, but others still have 4: round continues
    expect(r.state.round).toBe(1);
    const t = structuredClone(r.state);
    t.players.forEach((p) => (p.turnsTaken = 5));
    t.players[1].turnsTaken = 4;
    t.turn!.seat = 1; t.turn!.botActAt = null; t.turn!.stealPlans = [];
    const out = advance(t, ctx, t.turn!.endsAt);
    expect(out.round).toBe(2);
    expect(out.phase).toBe('intro');
    expect(out.pile).toBe(0);
    expect(out.events.some((e) => e.kind === 'burn')).toBe(true);
    expect(out.players[2].banked).toBe(12);
    expect(out.players.every((p) => p.turnsTaken === 0)).toBe(true);
    expect(out.used).toEqual([]);
  });
  it('game ends after round 3 with winners', () => {
    const s = humanTurn('c');
    s.round = 3;
    s.players.forEach((p, i) => { p.turnsTaken = 5; p.banked = i === 2 ? 40 : 1; });
    s.players[0].turnsTaken = 4;
    const out = apply(s, ctx, { type: 'bank', seat: 0 }, start + 100).state;
    expect(out.phase).toBe('gameOver');
    expect(out.winners).toEqual([2]);
  });
});

describe('bots', () => {
  it('a full game with only timeouts/bots terminates and stays consistent', () => {
    let s = createGame({ seed: 'sim', now: 0, humanName: 'h', playerCount: 5, difficulty: 'hard' }, dict);
    for (let t = 0; t < 600_000 && s.phase !== 'gameOver'; t += 250) s = advance(s, ctx, t);
    expect(s.phase).toBe('gameOver');
    expect(s.winners!.length).toBeGreaterThan(0);
  });
});
