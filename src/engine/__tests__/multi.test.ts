import { describe, expect, it } from 'vitest';
import { advance, apply, replaceWithBot } from '../reducer';
import { createGame } from '../game';
import { ctx, dict, T0 } from './helpers';

const NAMES = ['Ana', 'Ben', 'Cy', 'Di', 'Eli'];
const make = (humans = NAMES) =>
  createGame({ seed: 'room', now: T0, humans, playerCount: humans.length, difficulty: 'medium' }, dict);

describe('room games (several humans)', () => {
  it('seats every human, with distinct names and looks, and no bots', () => {
    const g = make();
    expect(g.players.map((p) => p.name)).toEqual(NAMES);
    expect(g.players.every((p) => p.isHuman)).toBe(true);
    expect(new Set(g.players.map((p) => p.emoji)).size).toBe(5);
  });
  it('seats ten humans with ten distinct looks', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `P${i}`);
    const g = make(ten);
    expect(g.players).toHaveLength(10);
    expect(new Set(g.players.map((p) => p.emoji)).size).toBe(10);
    expect(new Set(g.players.map((p) => p.color)).size).toBe(10);
  });
  it('fills the rest with bots when the table is bigger than the humans', () => {
    const g = createGame({ seed: 'r2', now: 0, humans: ['A', 'B'], playerCount: 5, difficulty: 'easy' }, dict);
    expect(g.players.map((p) => p.isHuman)).toEqual([true, true, false, false, false]);
    expect(new Set(g.players.map((p) => p.name)).size).toBe(5);
  });
  it('a single-human setup behaves exactly as before', () => {
    const a = createGame({ seed: 'solo', now: 0, humanName: 'Kai', playerCount: 6, difficulty: 'hard' }, dict);
    const b = createGame({ seed: 'solo', now: 0, humans: ['Kai'], playerCount: 6, difficulty: 'hard' }, dict);
    expect(b).toEqual(a);
    expect(a.players[0].emoji).toBe('😎');
  });
  it('each human can act on their own turn and not on someone else\'s', () => {
    let s = advance(make(), ctx, T0 + 2500);
    s = structuredClone(s);
    s.chainLetter = 'c';
    s.modifier = 'vowel_double'; // a modifier that does not restrict which words are legal
    expect(s.turn!.seat).toBe(0);
    expect(apply(s, ctx, { type: 'play', seat: 1, word: 'cat' }, T0 + 2600).reason).toBe('not_your_turn');
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'cat' }, T0 + 2700);
    expect(r.accepted).toBe(true);
    expect(r.state.turn!.seat).toBe(1); // seat 1 is a human now, so the game waits for them
    expect(r.state.turn!.botActAt).toBeNull();
    expect(apply(r.state, ctx, { type: 'play', seat: 1, word: 'tab' }, T0 + 2900).accepted).toBe(true);
  });
});

describe('replaceWithBot', () => {
  it('turns a leaver into a bot that keeps their score and name', () => {
    let s = advance(make(), ctx, T0 + 2500);
    s.players[2].banked = 42;
    s = replaceWithBot(s, 2, 'medium', T0 + 3000);
    expect(s.players[2].isHuman).toBe(false);
    expect(s.players[2].banked).toBe(42);
    expect(s.players[2].name).toBe('Cy');
    expect(s.events.at(-1)!.kind).toBe('seatBot');
    expect(apply(s, ctx, { type: 'bank', seat: 2 }, T0 + 3100).accepted).toBe(false); // no longer human-controlled
  });
  it('if it was their turn, the bot takes it', () => {
    let s = advance(make(), ctx, T0 + 2500);
    expect(s.turn!.seat).toBe(0);
    s = replaceWithBot(s, 0, 'hard', T0 + 2600);
    expect(s.turn!.botActAt).not.toBeNull();
    const out = advance(s, ctx, T0 + 2600 + 8000);
    expect(out.history.length + out.events.length).toBeGreaterThan(s.history.length + s.events.length - 1);
    expect(out.turn?.seat === 0 && out.players[0].turnsTaken === 0).toBe(false);
  });
  it('does nothing for a bot seat or after the game ended', () => {
    const s = createGame({ seed: 'r3', now: 0, humans: ['A', 'B'], playerCount: 4, difficulty: 'easy' }, dict);
    expect(replaceWithBot(s, 3, 'easy', 0)).toBe(s);
    const over = { ...s, phase: 'gameOver' as const };
    expect(replaceWithBot(over, 0, 'easy', 0)).toBe(over);
  });
  it('a game where every human leaves still finishes', () => {
    let s = advance(make(), ctx, T0 + 2500);
    for (let seat = 0; seat < 5; seat++) s = replaceWithBot(s, seat, 'hard', T0 + 2600);
    s = advance(s, ctx, T0 + 3_000_000);
    expect(s.phase).toBe('gameOver');
  });
});
