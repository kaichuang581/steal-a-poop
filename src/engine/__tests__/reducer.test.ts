import { describe, expect, it } from 'vitest';
import { apply, advance, inStealWindow } from '../reducer';
import { createGame } from '../game';
import { turnDurationMs } from '../timer';
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
  it('a valid play moves the chain letter and passes the turn; the pile never grows', () => {
    const r = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'cat' }, start + 1000);
    expect(r.accepted).toBe(true);
    expect(r.state.pile).toBe(0);
    expect(r.state.players[0].banked).toBe(0);
    expect(r.state.chainLetter).toBe('t');
    expect(r.state.turn!.seat).toBe(1);
    expect(r.state.players[0].lastWord).toBe('cat');
    expect(r.state.history.at(-1)).toMatchObject({ kind: 'play', word: 'cat', points: 0 });
    expect(r.state.events.find((e) => e.kind === 'play')).toMatchObject({ seat: 0, amount: 0, word: 'cat' });
  });
  it('there is no bank: it is rejected and nothing changes', () => {
    const s = humanTurn('c');
    const r = apply(s, ctx, { type: 'bank', seat: 0 }, start + 1000);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('no_bank');
    expect(r.state.turn!.seat).toBe(0);
    expect(r.state.players[0].banked).toBe(0);
    expect(r.state.chainLetter).toBe('c');
  });
  it('an invalid word is free: nothing changes and the turn keeps running', () => {
    const r = apply(humanTurn('c'), ctx, { type: 'play', seat: 0, word: 'zzz' }, start + 500);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('wrong_start');
    expect(r.state.players[0].lives).toBe(3);
    expect(r.state.turn!.seat).toBe(0);
    const ok = apply(r.state, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 900);
    expect(ok.accepted).toBe(true);
  });
  it('timeout costs one wool ball and passes the turn', () => {
    const s = humanTurn();
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].lives).toBe(2);
    expect(out.players[0].banked).toBe(0);
    expect(out.events.some((e) => e.kind === 'timeout')).toBe(true);
    expect(out.events.some((e) => e.kind === 'lifeLost' && e.seat === 0)).toBe(true);
    expect(out.turn!.seat).toBe(1);
  });
  it('rejects actions out of turn', () => {
    const s = humanTurn();
    s.players[1].isHuman = true;
    const r = apply(s, ctx, { type: 'play', seat: 1, word: 'cat' }, start + 100);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('not_your_turn');
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
  it('valid steal: the stealer takes one wool ball from the sheep on turn and play moves on', () => {
    const s = botTurnWithPile();
    const end = s.turn!.endsAt;
    const r = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 1000);
    expect(r.accepted).toBe(true);
    expect(r.state.players[0].lives).toBe(4);
    expect(r.state.players[1].lives).toBe(2);
    expect(r.state.players[0].steals).toBe(1);
    expect(r.state.players[0].banked).toBe(0);
    expect(r.state.pile).toBe(0);
    expect(r.state.chainLetter).toBe('r');
    expect(r.state.turn!.seat).toBe(2); // play continues after the victim
    expect(r.state.events.find((e) => e.kind === 'steal')).toMatchObject({ seat: 0, amount: 1, word: 'tiger' });
  });
  it('a steal can freeze the sheep on turn, and ends the game if that leaves one sheep', () => {
    const s = botTurnWithPile();
    s.players[1].lives = 1;
    const frozeOnly = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, s.turn!.endsAt - 1000).state;
    expect(frozeOnly.players[1]).toMatchObject({ lives: 0, frozen: true, frozenAt: s.turn!.endsAt - 1000 });
    expect(frozeOnly.phase).toBe('playing');
    expect(frozeOnly.turn!.seat).toBe(2);

    const last = botTurnWithPile();
    last.players[1].lives = 1;
    last.players[2].frozen = true;
    last.players[3].frozen = true;
    const over = apply(last, ctx, { type: 'steal', seat: 0, word: 'tiger' }, last.turn!.endsAt - 1000).state;
    expect(over.players[1].frozen).toBe(true);
    expect(over.phase).toBe('gameOver');
    expect(over.turn).toBeNull();
    expect(over.winners).toEqual([0]);
    expect(over.events.some((e) => e.kind === 'gameOver')).toBe(true);
  });
  it('a bad steal word costs nothing, starts a 1 s cooldown, and the turn continues', () => {
    const s = botTurnWithPile();
    const at = s.turn!.endsAt - 2500;
    const r = apply(s, ctx, { type: 'steal', seat: 0, word: 'nope' }, at);
    expect(r.accepted).toBe(true);
    expect(r.reason).toBeDefined();
    expect(r.state.players[0].lives).toBe(3);
    expect(r.state.players[1].lives).toBe(3);
    expect(r.state.players[0].stealCooldownUntil).toBe(at + 1000);
    expect(r.state.turn!.seat).toBe(1);
    expect(r.state.events.at(-1)!.kind).toBe('stealFail');
    const early = apply(r.state, ctx, { type: 'steal', seat: 0, word: 'tiger' }, at + 999);
    expect(early.accepted).toBe(false);
    expect(early.reason).toBe('steal_cooldown');
    const later = apply(r.state, ctx, { type: 'steal', seat: 0, word: 'tiger' }, at + 1000);
    expect(later.accepted).toBe(true);
    expect(later.state.players[0].steals).toBe(1);
  });
  it('steals are unlimited: the same player can steal again in a later turn', () => {
    const s = botTurnWithPile();
    const first = apply(s, ctx, { type: 'steal', seat: 0, word: 'tiger' }, s.turn!.endsAt - 1000).state;
    const again = structuredClone(first);
    again.turn!.seat = 1; again.turn!.botActAt = null; again.turn!.stealPlans = []; again.turn!.stealable = true;
    const second = apply(again, ctx, { type: 'steal', seat: 0, word: 'rat' }, again.turn!.endsAt - 1000);
    expect(second.accepted).toBe(true);
    expect(second.state.players[0].steals).toBe(2);
    expect(second.state.players[0].lives).toBe(5);
  });
  it('players never have a token count', () => {
    expect(botTurnWithPile().players[0]).not.toHaveProperty('tokens');
  });
});

describe('letter trap', () => {
  it('gives the trapper a wool ball when the next player times out', () => {
    const r = apply(humanTurn('t'), ctx, { type: 'play', seat: 0, word: 'tax' }, start + 100);
    expect(r.state.trap).toMatchObject({ trapperSeat: 0, victimSeat: 1, letter: 'x' });
    const s = freezeBots(r.state);
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].lives).toBe(4);
    expect(out.players[1].lives).toBe(2);
    expect(out.players[0].banked).toBe(0);
    expect(out.trap).toBeNull();
    expect(out.events.find((e) => e.kind === 'trapSprung')).toMatchObject({ seat: 1, amount: 1 });
  });
  it('no payout when the next player answers', () => {
    const r = apply(humanTurn('t'), ctx, { type: 'play', seat: 0, word: 'tax' }, start + 100);
    const s = freezeBots(r.state);
    s.players[1].isHuman = true; // let the test drive seat 1
    const ok = apply(s, ctx, { type: 'play', seat: 1, word: 'xylem' }, s.turn!.startedAt + 500);
    expect(ok.accepted).toBe(true);
    expect(ok.state.players[0].lives).toBe(3);
    expect(ok.state.trap).toBeNull();
    expect(ok.state.events.some((e) => e.kind === 'trapSprung')).toBe(false);
  });
});

describe('rounds', () => {
  it('a round ends once every unfrozen sheep has taken its turns; the next starts faster with the next twist', () => {
    const s = humanTurn('c');
    s.players.forEach((p) => (p.turnsTaken = 1));
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100);
    // seat 0 finishing makes turnsTaken 2, but others still have 1: round continues
    expect(r.state.round).toBe(1);
    const t = structuredClone(r.state);
    t.players.forEach((p) => (p.turnsTaken = 2));
    t.players[1].turnsTaken = 1;
    t.turn!.seat = 1; t.turn!.botActAt = null; t.turn!.stealPlans = [];
    const out = advance(t, ctx, t.turn!.endsAt);
    expect(out.round).toBe(2);
    expect(out.phase).toBe('intro');
    expect(out.modifier).toBe(out.modifierDeck[1]);
    expect(out.players[1].lives).toBe(2); // the time-out cost seat 1 a wool ball; lives carry over
    expect(out.players.every((p) => p.turnsTaken === 0)).toBe(true);
    expect(out.used).toEqual([]);
    const next = advance(out, ctx, out.introEndsAt!);
    expect(next.phase).toBe('playing');
    expect(next.turn!.durationMs).toBe(turnDurationMs(0, next.modifier, 12_000));
  });
  it('rounds never end the game: round 3 is followed by round 4', () => {
    const s = humanTurn('c');
    s.round = 3;
    s.players.forEach((p) => { p.turnsTaken = 2; });
    s.players[0].turnsTaken = 1;
    const out = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    expect(out.phase).toBe('intro');
    expect(out.round).toBe(4);
    expect(out.winners).toBeNull();
  });
  it('the game ends the moment only one sheep is unfrozen, and that sheep wins', () => {
    const s = freezeBots(humanTurn('c'));
    s.players[0].lives = 1;
    s.players[1].frozen = true; s.players[1].lives = 0; s.players[1].frozenAt = T0;
    s.players[2].frozen = true; s.players[2].lives = 0; s.players[2].frozenAt = T0 + 1;
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].frozen).toBe(true);
    expect(out.phase).toBe('gameOver');
    expect(out.turn).toBeNull();
    expect(out.winners).toEqual([3]);
    expect(out.events.at(-1)!.kind).toBe('gameOver');
    expect(advance(out, ctx, s.turn!.endsAt + 60_000)).toBe(out); // nothing more happens
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
