import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../../engine';
import { createDictionary } from '../../engine/dictionary';
import { createGame } from '../../engine/game';
import { advance } from '../../engine/reducer';
import { createLocalClient } from '../../state/gameClient';
import { useStore } from '../../state/store';
import { loadSoloGame, saveSoloGame, SOLO_SAVE_MAX_AGE_MS } from '../soloSave';

const KEY = 'sap:soloSave';
const WORDS = [
  'cat', 'tab', 'bat', 'tax', 'xylem', 'mud', 'dog', 'gate', 'eel', 'lamp',
  'pale', 'tiger', 'rat', 'toy', 'jazz', 'zoo', 'oak', 'kit', 'tree', 'tall',
  'apple', 'egg', 'ant', 'tea', 'tow', 'quiz', 'wow', 'wax', 'tick', 'tuck',
  'cattle', 'tomorrow',
];
const dict = createDictionary(WORDS);
const ctx = { dict };
const T0 = 1_000_000;

/** A game past its intro, on seat 0's (the human's) first turn. */
function playingGame(): GameState {
  const game = createGame({ seed: 'resume-test', now: T0, humanName: 'Me', playerCount: 5, difficulty: 'medium' }, dict);
  return advance(game, ctx, T0 + 2_500);
}

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

/** Pretends the save was written `ms` ago, without waiting. */
function ageSaveBy(ms: number): void {
  const data = JSON.parse(store.getItem(KEY)!) as { savedAt: number };
  data.savedAt -= ms;
  store.setItem(KEY, JSON.stringify(data));
}

describe('solo save', () => {
  it('saves a game and loads it back unchanged', () => {
    const game = playingGame();
    saveSoloGame('quick', game, T0 + 4_000);
    const loaded = loadSoloGame();
    expect(loaded?.mode).toBe('quick');
    expect(loaded?.savedNow).toBe(T0 + 4_000);
    expect(loaded?.game).toEqual(game);
  });

  it('has nothing to offer when nothing was saved', () => {
    expect(loadSoloGame()).toBeNull();
  });

  it('still offers a game saved just under two hours ago', () => {
    saveSoloGame('practice', playingGame(), T0);
    expect(loadSoloGame(Date.now() + SOLO_SAVE_MAX_AGE_MS - 1_000)).not.toBeNull();
  });

  it('expires a game after two hours and forgets it', () => {
    saveSoloGame('quick', playingGame(), T0);
    expect(loadSoloGame(Date.now() + SOLO_SAVE_MAX_AGE_MS + 1)).toBeNull();
    expect(store.getItem(KEY)).toBeNull();
  });

  it('ignores and clears a corrupt save', () => {
    store.setItem(KEY, 'not json {');
    expect(loadSoloGame()).toBeNull();
    expect(store.getItem(KEY)).toBeNull();
  });

  it('ignores a save it does not understand', () => {
    saveSoloGame('quick', playingGame(), T0);
    const data = JSON.parse(store.getItem(KEY)!) as Record<string, unknown>;
    store.setItem(KEY, JSON.stringify({ ...data, version: 99 }));
    expect(loadSoloGame()).toBeNull();
    saveSoloGame('quick', playingGame(), T0);
    store.setItem(KEY, JSON.stringify({ ...data, game: { seed: 'x' } }));
    expect(loadSoloGame()).toBeNull();
  });

  it('does not save a finished game', () => {
    const done = { ...playingGame(), phase: 'gameOver' as const, winners: [0] };
    saveSoloGame('quick', done, T0);
    expect(loadSoloGame()).toBeNull();
  });

  it('does nothing, and does not throw, when storage is unavailable', () => {
    (globalThis as Globals).localStorage = undefined;
    expect(() => saveSoloGame('quick', playingGame(), T0)).not.toThrow();
    expect(loadSoloGame()).toBeNull();
  });
});

describe('resuming', () => {
  /** Puts the store in the state a fresh page load leaves it in, holding the saved game. */
  function reload(): void {
    useStore.setState({
      client: createLocalClient(dict), game: null, mode: 'quick', mySeat: 0,
      timeOffset: 0, now: performance.now(), resumable: loadSoloGame(),
    });
  }

  it('restarts the clock where it stopped instead of losing or inventing turn time', () => {
    const game = playingGame();
    const savedNow = T0 + 4_000;
    const remaining = game.turn!.endsAt - savedNow;
    saveSoloGame('quick', game, savedNow);
    reload();

    // performance.now() on a fresh page is nowhere near the saved engine clock.
    expect(useStore.getState().resumable?.savedNow).toBe(savedNow);
    expect(useStore.getState().resumeSaved()).toBe(true);

    const resumed = useStore.getState();
    expect(resumed.game?.turn?.seat).toBe(0);
    expect(resumed.mode).toBe('quick');
    const left = resumed.game!.turn!.endsAt - (performance.now() - resumed.timeOffset);
    expect(left).toBeLessThanOrEqual(remaining);
    expect(left).toBeGreaterThan(remaining - 1_000);
  });

  it('ends the turn when the restored time runs out, not minutes later', () => {
    const game = playingGame();
    const savedNow = T0 + 4_000;
    const remaining = game.turn!.endsAt - savedNow;
    saveSoloGame('quick', game, savedNow);
    reload();
    useStore.getState().resumeSaved();
    const before = useStore.getState().game!.history.length;

    useStore.getState().frame(performance.now() + remaining + 500);
    expect(useStore.getState().game!.history.length).toBeGreaterThan(before);
  });

  it('forgets a save that expired while the menu was open', () => {
    saveSoloGame('quick', playingGame(), T0);
    reload();
    expect(useStore.getState().resumable).not.toBeNull();
    ageSaveBy(SOLO_SAVE_MAX_AGE_MS + 1_000);
    useStore.getState().refreshResume();
    expect(useStore.getState().resumable).toBeNull();
    expect(useStore.getState().resumeSaved()).toBe(false);
  });

  it('refuses to resume when the word list is not ready', () => {
    saveSoloGame('quick', playingGame(), T0);
    useStore.setState({ client: null, game: null, resumable: loadSoloGame() });
    expect(useStore.getState().resumeSaved()).toBe(false);
    expect(useStore.getState().game).toBeNull();
  });

  it('throws the save away when the player leaves on purpose', () => {
    saveSoloGame('quick', playingGame(), T0);
    useStore.setState({ game: playingGame(), mode: 'quick', resumable: loadSoloGame() });
    useStore.getState().quit();
    expect(useStore.getState().game).toBeNull();
    expect(useStore.getState().resumable).toBeNull();
    expect(loadSoloGame()).toBeNull();
  });

  it('throws the save away when the game ends', () => {
    const lastRound = structuredClone(playingGame());
    lastRound.round = 3;
    lastRound.players.forEach((p) => (p.turnsTaken = 5));
    lastRound.players[0].turnsTaken = 4;
    lastRound.players[0].banked = 10;
    saveSoloGame('quick', lastRound, T0 + 4_000);
    // Engine time must sit inside seat 0's turn, or the bank would arrive after a timeout.
    useStore.setState({
      client: createLocalClient(dict), game: lastRound, mode: 'quick', mySeat: 0,
      timeOffset: performance.now() - (T0 + 4_000), now: T0 + 4_000,
    });

    useStore.getState().act({ type: 'bank', seat: 0 });
    expect(useStore.getState().game?.phase).toBe('gameOver');
    expect(store.getItem(KEY)).toBeNull();
  });
});
