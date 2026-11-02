import { rankPlayers } from '../engine/standings';
import type { GameState } from '../engine/types';
import { load, save } from './storage';

/**
 * The two local modes that count. Daily and room games happen somewhere else (one attempt per day,
 * or on a server), so they are deliberately left out of local stats.
 */
export type SoloMode = 'quick' | 'practice';

const KEY = 'sap:stats';
const VERSION = 1;

/** Short history: enough to see a trend without letting storage grow without a bound. */
export const HISTORY_LIMIT = 20;

export interface GameRecord {
  /** Date.now() when the game ended, not when it started. */
  at: number;
  mode: SoloMode;
  players: number;
  /** 1 is first place. */
  rank: number;
  score: number;
  steals: number;
  wordsPlayed: number;
  longestWord: string;
  won: boolean;
}

export interface StatsData {
  version: number;
  games: number;
  wins: number;
  bestScore: number;
  /** The longest word the player has ever played, in lower case. Empty before the first game. */
  longestWord: string;
  totalSteals: number;
  /** Newest first, never more than HISTORY_LIMIT entries. */
  history: GameRecord[];
}

export function emptyStats(): StatsData {
  return { version: VERSION, games: 0, wins: 0, bestScore: 0, longestWord: '', totalSteals: 0, history: [] };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function word(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 64) : '';
}

function toRecord(value: unknown): GameRecord | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<GameRecord>;
  if (r.mode !== 'quick' && r.mode !== 'practice') return null;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  return {
    at: r.at,
    mode: r.mode,
    players: Math.max(1, Math.floor(count(r.players))),
    rank: Math.max(1, Math.floor(count(r.rank))),
    score: finite(r.score),
    steals: Math.floor(count(r.steals)),
    wordsPlayed: Math.floor(count(r.wordsPlayed)),
    longestWord: word(r.longestWord),
    won: r.won === true,
  };
}

/**
 * Reads the saved stats. Anything unreadable, of another version, or with the wrong shape falls back
 * to empty stats rather than throwing: stats are a nice extra, never a reason for the game to fail.
 */
export function loadStats(): StatsData {
  try {
    const raw = load<unknown>(KEY, null);
    if (!raw || typeof raw !== 'object') return emptyStats();
    const data = raw as Partial<StatsData>;
    if (data.version !== VERSION) return emptyStats();
    const history = Array.isArray(data.history)
      ? data.history.map(toRecord).filter((r): r is GameRecord => r !== null)
      : [];
    history.sort((a, b) => b.at - a.at);
    return {
      version: VERSION,
      games: count(data.games),
      wins: count(data.wins),
      bestScore: finite(data.bestScore),
      longestWord: word(data.longestWord),
      totalSteals: count(data.totalSteals),
      history: history.slice(0, HISTORY_LIMIT),
    };
  } catch {
    return emptyStats();
  }
}

/** Persists a full stats object, tolerating storage being unavailable. */
function store(data: StatsData): StatsData {
  save(KEY, data);
  return data;
}

/**
 * Adds one finished Quick or Practice game. Seat 0 is the human in solo games, so that is the seat
 * whose score, steals and words are counted. A game that has not finished is ignored, so a caller
 * firing twice cannot count it twice.
 */
export function recordGame(game: GameState, mode: SoloMode, at = Date.now()): StatsData {
  const current = loadStats();
  if (game.phase !== 'gameOver' || !game.players.length) return current;
  const me = game.players[0];
  const rank = rankPlayers(game.players).findIndex((p) => p.id === me.id) + 1;
  const record: GameRecord = {
    at,
    mode,
    players: game.players.length,
    rank,
    score: me.banked,
    steals: me.steals,
    wordsPlayed: me.wordsPlayed,
    longestWord: me.longestWord,
    won: game.winners?.includes(me.id) ?? false,
  };
  return store({
    version: VERSION,
    games: current.games + 1,
    wins: current.wins + (record.won ? 1 : 0),
    // The first game's score is the best so far even when it is negative: 0 is not a score they got.
    bestScore: current.games === 0 ? me.banked : Math.max(current.bestScore, me.banked),
    longestWord: me.longestWord.length > current.longestWord.length ? me.longestWord : current.longestWord,
    totalSteals: current.totalSteals + me.steals,
    history: [record, ...current.history].slice(0, HISTORY_LIMIT),
  });
}

/** Clears everything. The caller confirms first; this only does the writing. */
export function resetStats(): StatsData {
  return store(emptyStats());
}
