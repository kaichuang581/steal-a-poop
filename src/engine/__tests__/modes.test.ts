import { describe, expect, it } from 'vitest';
import { advance, apply } from '../reducer';
import { createGame } from '../game';
import { suggestWords } from '../hints';
import type { GameMode, GameState } from '../types';
import { validateWord } from '../validation';
import { ctx, dict, T0 } from './helpers';

function humanTurn(mode: GameMode, letter = 'c'): GameState {
  let s = createGame({ seed: 'm', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy', mode }, dict);
  s = structuredClone(advance(s, ctx, T0 + 2500));
  s.chainLetter = letter;
  s.turn!.stealPlans = [];
  s.turn!.stealable = true;
  return s;
}
const start = T0 + 2500;

describe('practice mode', () => {
  it('gives the human a roomy 25s turn; normal follows the round (16s in round 1)', () => {
    expect(humanTurn('practice').turn!.durationMs).toBe(25_000);
    expect(humanTurn('normal').turn!.durationMs).toBe(16_000);
  });
  it('timeout costs the human nothing and the turn still passes', () => {
    const s = humanTurn('practice');
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].lives).toBe(3);
    expect(out.players[0].frozen).toBe(false);
    expect(out.events.some((e) => e.kind === 'timeout' && e.seat === 0)).toBe(true);
    expect(out.events.some((e) => e.kind === 'lifeLost')).toBe(false);
    expect(out.turn!.seat).toBe(1);
  });
  it('an invalid word is rejected so the player can retry; nothing changes', () => {
    const s = humanTurn('practice');
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'zzz' }, start + 500);
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('wrong_start');
    expect(r.state.players[0].banked).toBe(0);
    expect(r.state.turn!.seat).toBe(0);
    const ok = apply(r.state, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 900);
    expect(ok.accepted).toBe(true);
    expect(ok.state.turn!.seat).toBe(1);
  });
  it('a bad steal word costs nothing; the player can retry after the 1 s cooldown', () => {
    const s = humanTurn('practice');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    const c = structuredClone(p);
    c.turn!.botActAt = null;
    c.turn!.stealPlans = [];
    c.turn!.stealable = true;
    const end = c.turn!.endsAt;
    const bad = apply(c, ctx, { type: 'steal', seat: 0, word: 'nope' }, end - 2500);
    expect(bad.accepted).toBe(true);
    expect(bad.reason).toBeDefined();
    expect(bad.state.players[0].lives).toBe(3);
    expect(bad.state.turn!.seat).toBe(1);
    const tooSoon = apply(bad.state, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 2000);
    expect(tooSoon.accepted).toBe(false);
    expect(tooSoon.reason).toBe('steal_cooldown');
    const good = apply(bad.state, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 1000);
    expect(good.state.players[0].steals).toBe(1);
  });
});

describe('tour mode', () => {
  it('bots never bank and the pile never grows', () => {
    const s = humanTurn('tour');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    const c = structuredClone(p);
    c.players.forEach((q) => (q.bankThreshold = 1));
    const out = advance(c, ctx, c.turn!.startedAt + 3000);
    expect(out.history.some((h) => h.kind === 'play' && h.seat === 1)).toBe(true);
    expect(out.history.some((h) => h.kind === 'bank')).toBe(false);
    expect(out.pile).toBe(0);
  });
  it('bots answer fast and nobody plans a steal', () => {
    const s = humanTurn('tour');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    expect(p.turn!.botActAt! - p.turn!.startedAt).toBeLessThanOrEqual(2200);
    expect(p.turn!.stealPlans).toEqual([]);
  });
  it('once the human has played a word, the last bot runs into its steal window', () => {
    let s = humanTurn('tour');
    s = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    // Bots 1 and 2 are quick (or, on a dead-end letter in this tiny word list, run their clock out): either way the
    // turn reaches seat 3.
    for (let guard = 0; guard < 4 && s.turn!.seat !== 3; guard++) s = advance(s, ctx, s.turn!.botActAt ?? s.turn!.endsAt);
    expect(s.turn!.seat).toBe(3);
    const t = s.turn!;
    expect(t.botActAt! - t.startedAt).toBeGreaterThanOrEqual(3500);
    expect(t.botActAt!).toBeGreaterThan(t.endsAt - 3000); // lands inside the window
  });
  it('before the human has played a word, the last bot answers quickly', () => {
    const s = humanTurn('tour');
    s.turn = { ...s.turn!, seat: 2 };
    const out = advance(s, ctx, s.turn.endsAt); // seat 2 times out (no wool in a tour); seat 3 starts
    expect(out.turn!.seat).toBe(3);
    expect(out.turn!.botActAt! - out.turn!.startedAt).toBeLessThanOrEqual(2200);
  });
});

describe('hints', () => {
  it('suggests distinct valid words', () => {
    const words = suggestWords({ dict, chainLetter: 't', used: ['tab'], modifier: 'no_e', count: 3, random: () => 0.3 });
    expect(words.length).toBe(3);
    expect(new Set(words).size).toBe(3);
    for (const w of words) {
      expect(validateWord(w, { dict, chainLetter: 't', used: ['tab'], modifier: 'no_e' }).ok).toBe(true);
    }
  });
  it('returns fewer when few words exist', () => {
    const words = suggestWords({ dict, chainLetter: 'q', used: [], modifier: 'no_e', count: 5, random: Math.random });
    expect(words).toEqual(['quiz']);
  });
});

describe('dead rounds', () => {
  it('a round cannot open on a letter with no legal word', () => {
    // 'e' under No E has no legal word in this dictionary (or any ENABLE-style one)
    let s = createGame({ seed: 'dead', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy' }, dict);
    s = structuredClone(s);
    s.chainLetter = 'e';
    s.modifier = 'no_e';
    s = advance(s, ctx, T0 + 2500);
    expect(s.chainLetter).not.toBe('e');
    expect(s.events.some((e) => e.kind === 'chainReset')).toBe(true);
    expect(validateWord('tab', { dict, chainLetter: 't', used: [], modifier: 'no_e' }).ok).toBe(true);
  });
  it('a legal start letter is left alone', () => {
    let s = createGame({ seed: 'ok', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy' }, dict);
    s = structuredClone(s);
    s.chainLetter = 'c';
    s.modifier = 'six_plus'; // cattle
    s = advance(s, ctx, T0 + 2500);
    expect(s.chainLetter).toBe('c');
  });
  it('createGame never picks a dead start letter across many seeds', () => {
    for (let i = 0; i < 200; i++) {
      const g = createGame({ seed: `s${i}`, now: 0, humanName: 'a', playerCount: 4, difficulty: 'easy' }, dict);
      const ok = dict.startingWith(g.chainLetter).some((w) => validateWord(w, { dict, chainLetter: g.chainLetter, used: [], modifier: g.modifier }).ok);
      expect(ok).toBe(true);
    }
  });
});

describe('10-player tables', () => {
  it('creates 10 distinct players and rejects nothing at the cap', () => {
    const g = createGame({ seed: 'ten', now: 0, humanName: 'Me', playerCount: 10, difficulty: 'medium' }, dict);
    expect(g.players).toHaveLength(10);
    expect(new Set(g.players.map((p) => p.name)).size).toBe(10);
    expect(new Set(g.players.map((p) => p.emoji)).size).toBe(10);
    expect(createGame({ seed: 'x', now: 0, humanName: 'Me', playerCount: 14, difficulty: 'easy' }, dict).players).toHaveLength(10);
  });
  it('a 10-seat game runs until one sheep is left', () => {
    let s = createGame({ seed: 'ten-sim', now: 0, humanName: 'h', playerCount: 10, difficulty: 'hard' }, dict);
    s.players[0].isHuman = false; s.players[0].difficulty = 'hard'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
    s = advance(s, ctx, 3_000_000);
    expect(s.phase).toBe('gameOver');
    const alive = s.players.filter((p) => !p.frozen);
    expect(alive.length).toBeLessThanOrEqual(1);
    expect(s.round).toBeGreaterThan(1);
    if (alive.length === 1) expect(s.winners).toEqual([alive[0].id]);
    expect(s.players.every((p) => p.frozen === (p.frozenAt !== null))).toBe(true);
  });
});
