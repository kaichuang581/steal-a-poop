import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../../engine';
import type { GameState } from '../../engine';
import { T0, dict } from '../../engine/__tests__/helpers';
import { humanTurn } from '../../engine/__tests__/helpers';
import { createLocalClient } from '../../state/gameClient';
import { useStore } from '../../state/store';
import { HISTORY_LIMIT, emptyStats, loadStats, recordGame, resetStats } from '../stats';

const KEY = 'sap:stats';

class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

type Globals = { localStorage?: Storage };
const original = (globalThis as Globals).localStorage;
let store: Storage;

beforeEach(() => {
  store = new MemoryStorage() as unknown as Storage;
  (globalThis as Globals).localStorage = store;
});

afterEach(() => {
  if (original === undefined) delete (globalThis as Globals).localStorage;
  else (globalThis as Globals).localStorage = original;
});

/**
 * A game on the last turn of the last round: seat 0 banks, every player reaches 5 turns, and the
 * game is over. The human has 10 wool and a long word.
 */
function finalGame(): GameState {
  const s = structuredClone(humanTurn('c'));
  s.round = 3;
  s.pile = 25;
  s.players.forEach((p) => { p.turnsTaken = 5; });
  s.players[0].turnsTaken = 4;
  s.players[0].lives = 10;
  s.players[0].longestWord = 'cattle';
  s.players[0].wordsPlayed = 7;
  return s;
}

/** The same game, finished: seat 0 banked the pile, so the human wins on 35. */
function wonGame(): GameState {
  const s = finalGame();
  s.players[0].lives = 35;
  return { ...s, phase: 'gameOver', winners: [0] };
}

describe('recording a finished game', () => {
  it('counts the human’s game: win, wool kept and longest word', () => {
    const stats = recordGame(wonGame(), 'quick', 1_700_000_000_000);
    expect(stats.games).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.bestScore).toBe(35);
    expect(stats.longestWord).toBe('cattle');
    expect(stats.totalSteals).toBe(0);
    expect(stats.history).toEqual([
      {
        at: 1_700_000_000_000, mode: 'quick', players: 4, rank: 1,
        score: 35, steals: 0, wordsPlayed: 7, longestWord: 'cattle', won: true,
      },
    ]);
  });

  it('persists, so the next load sees the same numbers', () => {
    recordGame(wonGame(), 'practice', 5);
    expect(loadStats()).toMatchObject({
      games: 1, wins: 1, bestScore: 35, longestWord: 'cattle', totalSteals: 0,
    });
    expect(loadStats().history[0]).toMatchObject({ mode: 'practice', at: 5 });
  });

  it('ignores a game that has not finished, so a stray call cannot count it', () => {
    const stats = recordGame(finalGame(), 'quick');
    expect(stats.games).toBe(0);
    expect(loadStats().games).toBe(0);
    expect(store.getItem(KEY)).toBeNull();
  });

  it('keeps the best score and longest word when a later game is worse', () => {
    recordGame(wonGame(), 'quick', 1);
    const worse = finalGame();
    worse.phase = 'gameOver';
    worse.winners = [1];
    worse.players[0] = { ...worse.players[0], lives: 3, longestWord: 'cat', wordsPlayed: 1 };
    worse.players.slice(1).forEach((p) => { p.lives = 100; });

    const stats = recordGame(worse, 'quick', 2);
    expect(stats.games).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.bestScore).toBe(35);
    expect(stats.longestWord).toBe('cattle');
    expect(stats.totalSteals).toBe(0);
    expect(stats.history[0]).toMatchObject({ rank: 4, score: 3, won: false });
  });

  it('keeps a negative score as the best when it is the only game played', () => {
    const rough = finalGame();
    rough.phase = 'gameOver';
    rough.winners = [1];
    rough.players[0] = { ...rough.players[0], lives: -45 };
    expect(recordGame(rough, 'quick').bestScore).toBe(-45);
  });

  it('starts over happily when there is nothing saved yet', () => {
    expect(loadStats()).toEqual(emptyStats());
  });
});

describe('the history', () => {
  it('keeps the last 20 games, newest first', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) recordGame(wonGame(), 'quick', i);
    const { history } = loadStats();
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].at).toBe(HISTORY_LIMIT + 4);
    expect(history.at(-1)!.at).toBe(5);
  });

  it('drops entries it cannot read instead of failing the whole screen', () => {
    store.setItem(KEY, JSON.stringify({
      version: 1, games: 2, wins: 1, bestScore: 20, longestWord: 'cat', totalSteals: 1,
      history: [
        { at: 10, mode: 'quick', players: 4, rank: 1, score: 20, steals: 0, wordsPlayed: 3, longestWord: 'cat', won: true },
        { at: 9, mode: 'room', players: 4, rank: 1, score: 20, steals: 0, wordsPlayed: 3, longestWord: 'cat', won: true },
        { at: 'yesterday', mode: 'quick' },
        null,
      ],
    }));
    const stats = loadStats();
    expect(stats.games).toBe(2);
    expect(stats.history).toHaveLength(1);
    expect(stats.history[0].at).toBe(10);
  });
});

describe('bad or missing storage', () => {
  it('falls back to empty stats on corrupt JSON', () => {
    store.setItem(KEY, 'not json {');
    expect(loadStats()).toEqual(emptyStats());
  });

  it('ignores a record from another version', () => {
    store.setItem(KEY, JSON.stringify({ ...emptyStats(), version: 99, games: 12 }));
    expect(loadStats().games).toBe(0);
  });

  it('repairs nonsense counts rather than showing them', () => {
    store.setItem(KEY, JSON.stringify({
      version: 1, games: 'lots', wins: -3, bestScore: 'high', longestWord: 7, totalSteals: null, history: 'nope',
    }));
    expect(loadStats()).toEqual(emptyStats());
  });

  it('does not throw and still returns the new totals when storage is unavailable', () => {
    (globalThis as Globals).localStorage = undefined;
    expect(() => recordGame(wonGame(), 'quick')).not.toThrow();
    expect(recordGame(wonGame(), 'quick').games).toBe(1);
    expect(loadStats().games).toBe(0);
  });
});

describe('resetting', () => {
  it('clears every total and the history', () => {
    recordGame(wonGame(), 'quick', 1);
    recordGame(wonGame(), 'practice', 2);
    const cleared = resetStats();
    expect(cleared).toEqual(emptyStats());
    expect(loadStats()).toEqual(emptyStats());
  });
});

describe('the store records each solo game exactly once', () => {
  /** Starts a game in the store and lets it play out: nobody types for seat 0, so timeouts end it through `frame`. */
  function finish(mode: 'quick' | 'practice' | 'daily', dailyDate: string | null = null): void {
    const game = createGame({ seed: `stats-${mode}`, now: T0, humanName: 'Me', playerCount: 4, difficulty: 'easy' }, dict);
    useStore.setState({
      client: createLocalClient(dict), game, mode, mySeat: 0, dailyDate, paused: false,
      now: T0, timeOffset: 0, stats: emptyStats(),
    });
    for (let t = T0; t < T0 + 3_000_000 && useStore.getState().game?.phase !== 'gameOver'; t += 250) useStore.getState().frame(t);
  }

  it('records a finished quick game once, even if the loop keeps running', () => {
    finish('quick');
    expect(useStore.getState().game?.phase).toBe('gameOver');
    expect(useStore.getState().stats).toMatchObject({ games: 1, wins: 0 });

    useStore.getState().frame(T0 + 3_100_000);
    expect(loadStats().games).toBe(1);
    expect(useStore.getState().stats.games).toBe(1);
  });

  it('records a finished practice game too', () => {
    finish('practice');
    expect(loadStats().history[0]).toMatchObject({ mode: 'practice', won: false });
  });

  it('does not count the daily table, which has its own record', () => {
    finish('daily', '2026-11-01');
    expect(useStore.getState().game?.phase).toBe('gameOver');
    expect(loadStats()).toEqual(emptyStats());
    expect(useStore.getState().stats.games).toBe(0);
  });

  it('clears stats through the store action', () => {
    finish('quick');
    useStore.getState().resetStats();
    expect(useStore.getState().stats).toEqual(emptyStats());
    expect(loadStats()).toEqual(emptyStats());
  });
});
