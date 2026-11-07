import { describe, expect, it } from 'vitest';
import { pickBotWord } from '../bots';
import { CORNER_LETTERS, PRACTICE_BOT_MS } from '../constants';
import { createGame } from '../game';
import { advance, apply, previewBotTurn } from '../reducer';
import { practiceTurnMs } from '../timer';
import type { Difficulty, GameState } from '../types';
import { hasPlayableWord } from '../validation';
import { ctx, dict, T0 } from './helpers';

const START = T0 + 2500;

function run(practiceClock?: 5 | 10 | 15, difficulty: Difficulty = 'medium'): GameState {
  const s = createGame({ seed: 'run', now: T0, humanName: 'Me', playerCount: 2, difficulty, mode: 'practice', settings: { practiceClock } }, dict);
  return structuredClone(advance(s, ctx, START));
}

/** The human plays `word` on letter word[0], leaving the bot on turn. */
function play(s: GameState, word: string): GameState {
  const c = structuredClone(s);
  c.chainLetter = word[0];
  const r = apply(c, ctx, { type: 'play', seat: 0, word }, c.turn!.startedAt + 100);
  expect(r.accepted).toBe(true);
  return r.state;
}

describe('practice run setup', () => {
  it('is you and one bot, on one life, with no twists and no steal window, whatever is asked for', () => {
    const s = createGame({ seed: 'x', now: T0, humanName: 'Me', playerCount: 8, difficulty: 'hard', mode: 'practice', settings: { lives: 5, twists: true, stealWindowSeconds: 5 } }, dict);
    expect(s.players).toHaveLength(2);
    expect(s.players[1].difficulty).toBe('hard');
    expect(s.players.map((p) => p.lives)).toEqual([1, 1]);
    expect(s.settings.twists).toBe(false);
    expect(s.settings.stealWindowSeconds).toBe(0);
    expect(s.modifierDeck).toEqual(['none']);
  });
  it('the human goes first', () => {
    expect(run().turn!.seat).toBe(0);
  });
});

describe('practice clock', () => {
  it('starts at the chosen clock, 15 s if none is chosen', () => {
    expect(run().turn!.durationMs).toBe(15_000);
    expect(run(10).turn!.durationMs).toBe(10_000);
    expect(run(5).turn!.durationMs).toBe(5_000);
  });
  it('drops a second every 5 words, never under 5 s', () => {
    expect(practiceTurnMs(15, 4)).toBe(15_000);
    expect(practiceTurnMs(15, 5)).toBe(14_000);
    expect(practiceTurnMs(15, 12)).toBe(13_000);
    expect(practiceTurnMs(10, 25)).toBe(5_000);
    expect(practiceTurnMs(10, 500)).toBe(5_000);
    expect(practiceTurnMs(5, 0)).toBe(5_000);
  });
  it('follows the words you have played during the run', () => {
    const s = run(15);
    s.players[0].wordsPlayed = 4;
    const next = play(s, 'cat'); // the fifth word
    expect(next.turn!.durationMs).toBe(14_000);
  });
});

describe('practice bot', () => {
  it('answers quickly, whatever the clock', () => {
    const t = play(run(15), 'cat').turn!;
    expect(t.botActAt! - t.startedAt).toBeGreaterThanOrEqual(PRACTICE_BOT_MS[0]);
    expect(t.botActAt! - t.startedAt).toBeLessThanOrEqual(PRACTICE_BOT_MS[1]);
  });
  it('a fumble ends nothing: no wool lost, no time-out, and you get a fresh letter at once', () => {
    const s = structuredClone(play(run(), 'cat'));
    s.chainLetter = 'n'; // nothing in the test dictionary starts with n, so the bot has to fumble
    const at = s.turn!.botActAt!;
    const out = advance(s, ctx, at);
    expect(out.phase).toBe('playing');
    expect(out.turn!.seat).toBe(0);
    expect(out.turn!.startedAt).toBe(at);
    expect(out.chainLetter).not.toBe('n');
    expect(hasPlayableWord(dict, out.chainLetter, out.used, out.modifier)).toBe(true);
    expect(out.players[1].lives).toBe(1);
    expect(out.events.some((e) => e.kind === 'timeout' || e.kind === 'lifeLost')).toBe(false);
  });
  it('never leaves you a letter with no legal word', () => {
    const s = structuredClone(play(run(), 'cat'));
    s.chainLetter = 't';
    // Every word that can leave a playable ending is gone, so whatever the bot plays must be re-lettered if it dead-ends.
    s.used = dict.startingWith('x').concat(dict.startingWith('q'));
    const out = advance(s, ctx, s.turn!.botActAt!);
    expect(hasPlayableWord(dict, out.chainLetter, out.used, out.modifier)).toBe(true);
  });
  it('the preview shows the word it really plays, corner draw included', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const s0 = createGame({ seed, now: T0, humanName: 'Me', playerCount: 2, difficulty: 'hard', mode: 'practice' }, dict);
      const s = play(structuredClone(advance(s0, ctx, START)), 'cat');
      const plan = previewBotTurn(s, ctx)!;
      const out = advance(s, ctx, s.turn!.botActAt!);
      if (plan.kind === 'play') expect(out.players[1].lastWord).toBe(plan.word);
      else expect(out.players[1].lastWord).toBeNull();
    }
  });
  it('corners you only when asked, and spends no random draw otherwise', () => {
    let draws = 0;
    const base = { dict, chainLetter: 't', used: [], modifier: 'none' as const, prefer: 'any' as const };
    pickBotWord({ ...base, random: () => { draws += 1; return 0; } });
    expect(draws).toBe(1);
    const endings = new Set<string>();
    for (const roll of [0, 0.4, 0.9]) {
      const word = pickBotWord({ ...base, corner: 1, random: () => roll })!;
      expect(CORNER_LETTERS.has(word[word.length - 1])).toBe(true);
      endings.add(word[word.length - 1]);
    }
    expect(endings.size).toBeGreaterThan(1); // the corners vary, not one letter every time
  });
});

describe('practice run', () => {
  it('ends the moment your clock runs out, and your words are the score', () => {
    let s = play(run(), 'cat');
    s = advance(s, ctx, s.turn!.botActAt!);
    expect(s.turn!.seat).toBe(0);
    const out = advance(s, ctx, s.turn!.endsAt);
    expect(out.phase).toBe('gameOver');
    expect(out.players[0].frozen).toBe(true);
    expect(out.players[0].wordsPlayed).toBe(1);
  });
  it('a bad word costs only clock time', () => {
    const s = run();
    const r = apply(s, ctx, { type: 'play', seat: 0, word: 'zzz' }, s.turn!.startedAt + 100);
    expect(r.accepted).toBe(false);
    expect(r.state.phase).toBe('playing');
    expect(r.state.turn!.seat).toBe(0);
    expect(r.state.players[0].lives).toBe(1);
  });
  it('has no rounds: turns alternate and used words stay used for the whole run', () => {
    let s = run();
    for (let i = 0; i < 12; i++) {
      const word = dict.startingWith(s.chainLetter).find((w) => !s.used.includes(w))!;
      s = apply(s, ctx, { type: 'play', seat: 0, word }, s.turn!.startedAt + 50).state;
      expect(s.turn!.seat).toBe(1);
      s = advance(s, ctx, s.turn!.botActAt!);
      expect(s.phase).toBe('playing');
      expect(s.turn!.seat).toBe(0);
    }
    expect(s.round).toBe(1);
    expect(s.players[0].wordsPlayed).toBe(12);
    expect(s.used.length).toBeGreaterThanOrEqual(12);
  });
  it('sets no traps, and passing and stealing are refused', () => {
    const s = run();
    expect(apply(s, ctx, { type: 'pass', seat: 0 }, s.turn!.startedAt + 100).reason).toBe('no_pass');
    const c = structuredClone(s);
    c.chainLetter = 't';
    const trapped = apply(c, ctx, { type: 'play', seat: 0, word: 'tax' }, c.turn!.startedAt + 100).state;
    expect(trapped.trap).toBeNull();
    expect(apply(trapped, ctx, { type: 'steal', seat: 0, word: 'xylem' }, trapped.turn!.endsAt - 500).accepted).toBe(false);
  });
});
