import type { GameState } from '../engine';

/**
 * A Quick or Practice game interrupted by a reload. Rooms and the Daily Table are not saved: rooms
 * live on the server, and the Daily Table is one attempt per day.
 */
export interface SavedSoloGame {
  version: 1;
  /** Wall clock of the save. Used only to expire it; the engine has its own clock. */
  savedAt: number;
  /**
   * The engine clock when the save was made. Engine time is `performance.now() - timeOffset`, so
   * restoring this is what stops a reload from losing (or inventing) turn time.
   */
  savedNow: number;
  mode: 'quick' | 'practice';
  game: GameState;
}

const KEY = 'sap:soloSave';
const VERSION = 1;

/** A game older than this is not offered: the player has long since moved on. */
export const SOLO_SAVE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** localStorage can be missing (tests, no DOM) or throw on access (private mode, blocked cookies). */
function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

function read(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

function write(raw: string): void {
  try {
    storage()?.setItem(KEY, raw);
  } catch {
    /* Full or unavailable storage: the game carries on, it just cannot be resumed. */
  }
}

function drop(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Enough of a shape check that a half-written or hand-edited value cannot crash the game. */
function isGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const g = value as Partial<GameState>;
  return (
    typeof g.seed === 'string' &&
    typeof g.rng === 'number' &&
    (g.phase === 'intro' || g.phase === 'playing') &&
    (g.round === 1 || g.round === 2 || g.round === 3) &&
    typeof g.chainLetter === 'string' && g.chainLetter.length === 1 &&
    typeof g.pile === 'number' &&
    Array.isArray(g.used) &&
    Array.isArray(g.history) &&
    Array.isArray(g.events) &&
    Array.isArray(g.players) && g.players.length > 0 &&
    g.players.every((p) => typeof p.id === 'number' && typeof p.banked === 'number' && typeof p.turnsTaken === 'number') &&
    (g.turn === null ||
      (typeof g.turn === 'object' && g.turn !== null &&
        typeof g.turn.seat === 'number' && typeof g.turn.endsAt === 'number'))
  );
}

function parse(raw: string): SavedSoloGame | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const saved = data as Partial<SavedSoloGame>;
  if (saved.version !== VERSION) return null;
  if (saved.mode !== 'quick' && saved.mode !== 'practice') return null;
  if (typeof saved.savedAt !== 'number' || typeof saved.savedNow !== 'number') return null;
  if (!isGame(saved.game)) return null;
  return { version: VERSION, savedAt: saved.savedAt, savedNow: saved.savedNow, mode: saved.mode, game: saved.game };
}

/** The saved game, or null when there is none, it is unreadable, or it is older than two hours. */
export function loadSoloGame(wallNow: number = Date.now()): SavedSoloGame | null {
  const raw = read();
  if (raw === null) return null;
  const saved = parse(raw);
  if (!saved || wallNow - saved.savedAt > SOLO_SAVE_MAX_AGE_MS) {
    drop();
    return null;
  }
  return saved;
}

/** Called on every change of a live solo game. A finished game is not saved; the caller clears it. */
export function saveSoloGame(mode: 'quick' | 'practice', game: GameState, engineNow: number): void {
  if (game.phase === 'gameOver') return;
  const saved: SavedSoloGame = { version: VERSION, savedAt: Date.now(), savedNow: engineNow, mode, game };
  write(JSON.stringify(saved));
}

export function clearSoloGame(): void {
  drop();
}
