import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameResult } from '../contracts';
import { DAY_MS, MemoryResultsStore, PostgresResultsStore, periodStart, toStoredGame } from './results';
import type { ResultsStore, StoredGame } from './results';

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0); // a Wednesday
const player = (seat: number, userId: string | null, over: Partial<StoredGame['players'][number]> = {}) => ({
  seat, userId, displayName: userId ?? 'Bot', banked: 10 * (seat + 1), steals: seat, wordsPlayed: 5, longestWord: 'cat'.repeat(seat + 1), won: false, ...over,
});
const game = (id: string, over: Partial<StoredGame> = {}, players = [player(0, 'a', { won: true, banked: 50 }), player(1, 'b'), player(2, null)]): StoredGame => ({
  gameId: id, mode: 'room', roomCode: 'ABCDE', dailyDate: null, finishedAt: NOW - 1000, players, ...over,
});

function behaves(make: () => Promise<ResultsStore>) {
  it('stores a game once; the same game again is refused', async () => {
    const s = await make();
    expect(await s.saveGame(game('g1'))).toBe(true);
    expect(await s.saveGame(game('g1'))).toBe(false);
    expect((await s.userStats('a')).gamesPlayed).toBe(1);
  });

  it('ranks by wins, points and steals, ignores bots, and only counts the chosen period', async () => {
    const s = await make();
    await s.saveGame(game('today', {}, [player(0, 'a', { won: true, banked: 50, steals: 1 }), player(1, 'b', { banked: 30, steals: 5 }), player(2, null)]));
    await s.saveGame(game('lastweek', { finishedAt: NOW - 5 * DAY_MS }, [player(0, 'b', { won: true, banked: 99, steals: 0 }), player(1, 'a', { banked: 1, steals: 0 })]));
    await s.saveGame(game('old', { finishedAt: NOW - 30 * DAY_MS }, [player(0, 'b', { won: true, banked: 200, steals: 0 }), player(1, 'a', { banked: 1, steals: 0 })]));
    const q = (period: 'day' | 'week' | 'all', metric: 'wins' | 'points' | 'steals') => s.leaderboard({ period, metric, now: NOW, limit: 10 });
    expect((await q('day', 'wins')).map((r) => [r.userId, r.value])).toEqual([['a', 1]]);
    expect((await q('week', 'wins')).map((r) => [r.userId, r.value])).toEqual([['a', 1], ['b', 1]].sort((x, y) => (x[0] as string).localeCompare(y[0] as string)).map((x) => x)); // tie on wins: fewer games first, then id
    expect((await q('all', 'points')).map((r) => [r.userId, r.value])).toEqual([['b', 329], ['a', 52]]);
    expect((await q('day', 'steals')).map((r) => [r.userId, r.value])).toEqual([['b', 5], ['a', 1]]);
    expect(await s.leaderboard({ period: 'all', metric: 'wins', now: NOW, limit: 1 })).toHaveLength(1);
  });

  it('the Daily Table board is that day\'s best banked scores', async () => {
    const s = await make();
    await s.saveGame(game('d1', { mode: 'daily', dailyDate: '2026-11-04', roomCode: null }, [player(0, 'a', { banked: 80 }), player(1, null)]));
    await s.saveGame(game('d2', { mode: 'daily', dailyDate: '2026-11-04', roomCode: null }, [player(0, 'b', { banked: 95 }), player(1, null)]));
    await s.saveGame(game('d3', { mode: 'daily', dailyDate: '2026-11-03', roomCode: null }, [player(0, 'c', { banked: 500 })]));
    expect((await s.dailyBoard('2026-11-04', 10)).map((r) => [r.userId, r.banked])).toEqual([['b', 95], ['a', 80]]);
  });

  it('adds up personal stats', async () => {
    const s = await make();
    await s.saveGame(game('g1', {}, [player(0, 'a', { won: true, banked: 50, steals: 2, longestWord: 'zebra' })]));
    await s.saveGame(game('g2', { mode: 'daily', dailyDate: '2026-11-04', roomCode: null }, [player(0, 'a', { banked: 70, steals: 1, longestWord: 'quiz' })]));
    expect(await s.userStats('a')).toEqual({ gamesPlayed: 2, wins: 1, points: 120, bestScore: 70, steals: 3, longestWord: 'zebra', dailyPlayed: 1 });
    expect(await s.userStats('nobody')).toEqual({ gamesPlayed: 0, wins: 0, points: 0, bestScore: 0, steals: 0, longestWord: '', dailyPlayed: 0 });
  });

  it('removing a person keeps the games but takes their name and their daily attempts', async () => {
    const s = await make();
    await s.saveGame(game('g1'));
    await s.claimDaily('a', '2026-11-04', 1);
    await s.anonymizeUser('a');
    expect((await s.userStats('a')).gamesPlayed).toBe(0);
    expect((await s.leaderboard({ period: 'all', metric: 'points', now: NOW, limit: 10 })).map((r) => r.userId)).toEqual(['b']);
    expect(await s.claimDaily('a', '2026-11-04', 2)).toBe(true); // the old attempt is gone with the account
  });

  it('allows one Daily Table attempt per player per date', async () => {
    const s = await make();
    expect(await s.claimDaily('a', '2026-11-04', 1)).toBe(true);
    expect(await s.claimDaily('a', '2026-11-04', 2)).toBe(false);
    expect(await s.claimDaily('a', '2026-11-05', 3)).toBe(true);
    expect(await s.claimDaily('b', '2026-11-04', 4)).toBe(true);
  });
}

describe('MemoryResultsStore', () => {
  behaves(async () => new MemoryResultsStore());
});

describe('periodStart', () => {
  it('day starts at 00:00 UTC, week is the last 7 days, all is the beginning', () => {
    expect(periodStart('day', NOW)).toBe(Date.UTC(2026, 10, 4));
    expect(periodStart('week', NOW)).toBe(NOW - 7 * DAY_MS);
    expect(periodStart('all', NOW)).toBe(0);
  });
});

describe('toStoredGame', () => {
  const result: GameResult = {
    gameId: 'g', mode: 'room', roomCode: 'R', dailyDate: null, finishedAt: 5, winners: ['a'],
    players: [
      { userId: 'a', name: 'Ana', seat: 0, banked: 50, steals: 1, wordsPlayed: 4, longestWord: 'zebra' },
      { userId: 'kid', name: 'Kiddo', seat: 1, banked: 30, steals: 0, wordsPlayed: 3, longestWord: 'cat' },
      { userId: null, name: 'Bot Bo', seat: 2, banked: 10, steals: 0, wordsPlayed: 2, longestWord: 'dog' },
    ],
  };
  it('keeps names for allowed players, hides a child whose parent has not consented, and marks winners', () => {
    const stored = toStoredGame(result, (id) => id === 'a');
    expect(stored.players.map((p) => [p.userId, p.displayName, p.won])).toEqual([['a', 'Ana', true], [null, 'Player', false], [null, 'Bot Bo', false]]);
    expect(JSON.stringify(stored)).not.toContain('Kiddo');
    expect(stored.players[1]).toMatchObject({ banked: 30 }); // the game itself stays complete
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresResultsStore against a real Postgres', () => {
  const pool = new Pool({ connectionString: url, options: '-c search_path=test_results' });
  const admin = new Pool({ connectionString: url });
  const m100 = readFileSync('db/migrations/100_accounts.sql', 'utf8');
  const m101 = readFileSync('db/migrations/101_game_results.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });
  beforeEach(async () => {
    await admin.query('drop schema if exists test_results cascade');
    await admin.query('create schema test_results');
    await pool.query(m100);
    await pool.query(m101);
  });
  it('the migration can be run twice', async () => {
    await expect(pool.query(m101)).resolves.toBeDefined();
  });
  behaves(async () => new PostgresResultsStore(pool as never));
  it('row security is on for the new tables', async () => {
    const { rows } = await pool.query("select relname, relrowsecurity from pg_class where relname in ('games','game_players','daily_attempts') and relkind = 'r' and relnamespace = 'test_results'::regnamespace");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
