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
  return s;
}
const start = T0 + 2500;

describe('practice mode', () => {
  it('gives the human a roomy 25s turn; normal follows the round (16s in round 1)', () => {
    expect(humanTurn('practice').turn!.durationMs).toBe(25_000);
    expect(humanTurn('normal').turn!.durationMs).toBe(16_000);
  });
  it('timeout costs nothing and the turn still passes', () => {
    const s = humanTurn('practice');
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.players[0].banked).toBe(0);
    expect(out.events.at(-1)!.text).toContain('no penalty');
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
  it('a bad steal word is rejected so the player can retry', () => {
    const s = humanTurn('practice');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    const c = structuredClone(p);
    c.turn!.botActAt = null;
    c.turn!.stealPlans = [];
    const end = c.turn!.endsAt;
    const bad = apply(c, ctx, { type: 'steal', seat: 0, word: 'nope' }, end - 1500);
    expect(bad.accepted).toBe(false);
    const good = apply(bad.state, ctx, { type: 'steal', seat: 0, word: 'tiger' }, end - 1000);
    expect(good.state.players[0].steals).toBe(1);
  });
});

describe('tour mode', () => {
  it('bots never bank, even above their threshold', () => {
    const s = humanTurn('tour');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    const c = structuredClone(p);
    c.pile = 500;
    c.players.forEach((q) => (q.bankThreshold = 1));
    const out = advance(c, ctx, c.turn!.startedAt + 3000);
    expect(out.history.some((h) => h.kind === 'bank')).toBe(false);
    expect(out.pile).toBeGreaterThan(400);
  });
  it('bots answer fast and nobody plans a steal', () => {
    const s = humanTurn('tour');
    const p = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    expect(p.turn!.botActAt! - p.turn!.startedAt).toBeLessThanOrEqual(2200);
    expect(p.turn!.stealPlans).toEqual([]);
  });
  it('after the human banks, the last bot runs into its steal window', () => {
    let s = humanTurn('tour');
    s = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, start + 100).state;
    for (let t = start + 100; s.turn!.seat !== 0 && t < start + 20_000; t += 100) s = advance(s, ctx, t);
    expect(s.turn!.seat).toBe(0); // bots 1-3 answered quickly; human still has their 25s
    s = apply(s, ctx, { type: 'bank', seat: 0 }, s.turn!.startedAt + 100).state;
    const t0 = s.turn!.startedAt;
    s = advance(s, ctx, t0 + 5000); // bots 1 and 2 are quick
    expect(s.turn!.seat).toBe(3);
    const t = s.turn!;
    expect(t.botActAt! - t.startedAt).toBeGreaterThanOrEqual(3500);
    expect(t.botActAt!).toBeGreaterThan(t.endsAt - 3000); // lands inside the window
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
  it('a 10-seat game runs to the end', () => {
    let s = createGame({ seed: 'ten-sim', now: 0, humanName: 'h', playerCount: 10, difficulty: 'hard' }, dict);
    s.players[0].isHuman = false; s.players[0].difficulty = 'hard'; s.players[0].personality = 'random'; s.players[0].bankThreshold = 30;
    s = advance(s, ctx, 3_000_000);
    expect(s.phase).toBe('gameOver');
    // Frozen players (out of lives) are skipped, so only unfrozen ones must have used every turn.
    expect(s.players.every((p) => p.frozen || p.turnsTaken >= 5)).toBe(true);
  });
});
