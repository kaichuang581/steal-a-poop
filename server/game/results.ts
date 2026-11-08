/**
 * Stored results of finished games, and the leaderboards and personal stats built from them.
 * A result is stored only for players whose account allows it (a child without a parent's consent is stored as an anonymous
 * row, so the game itself is still complete). Rows for a deleted account are anonymised, not removed.
 */
import type { Pool } from 'pg';
import type { GameResult } from '../contracts';

export interface StoredPlayer {
  seat: number;
  userId: string | null;
  displayName: string;
  banked: number;
  wordsPlayed: number;
  longestWord: string;
  won: boolean;
}
export interface StoredGame {
  gameId: string;
  mode: 'room' | 'daily';
  roomCode: string | null;
  dailyDate: string | null;
  finishedAt: number;
  players: StoredPlayer[];
}

export type Period = 'day' | 'week' | 'all';
export type Metric = 'wins' | 'points';
export const PERIODS: readonly Period[] = ['day', 'week', 'all'];
export const METRICS: readonly Metric[] = ['wins', 'points'];

export interface LeaderRow {
  userId: string;
  value: number;
  games: number;
}
export interface DailyRow {
  userId: string | null;
  displayName: string;
  banked: number;
  longestWord: string;
}
export interface UserStats {
  gamesPlayed: number;
  wins: number;
  points: number;
  bestScore: number;
  longestWord: string;
  dailyPlayed: number;
}

export interface ResultsStore {
  /** False if this game was already stored. */
  saveGame(game: StoredGame): Promise<boolean>;
  leaderboard(q: { period: Period; metric: Metric; now: number; limit: number }): Promise<LeaderRow[]>;
  dailyBoard(date: string, limit: number): Promise<DailyRow[]>;
  userStats(userId: string): Promise<UserStats>;
  /** Removes the person from every stored game, keeping the games. */
  anonymizeUser(userId: string): Promise<void>;
  /** True if this is the player's first attempt for the date. */
  claimDaily(userId: string, date: string, at: number): Promise<boolean>;
}

export const DAY_MS = 24 * 3600_000;
export const periodStart = (period: Period, now: number) =>
  period === 'all' ? 0 : period === 'week' ? now - 7 * DAY_MS : Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());

const longer = (a: string, b: string) => (b.length > a.length ? b : a);
const emptyStats = (): UserStats => ({ gamesPlayed: 0, wins: 0, points: 0, bestScore: 0, longestWord: '', dailyPlayed: 0 });

export class MemoryResultsStore implements ResultsStore {
  readonly games = new Map<string, StoredGame>();
  readonly attempts = new Set<string>();

  async saveGame(game: StoredGame) {
    if (this.games.has(game.gameId)) return false;
    this.games.set(game.gameId, structuredClone(game));
    return true;
  }

  async leaderboard({ period, metric, now, limit }: { period: Period; metric: Metric; now: number; limit: number }) {
    const since = periodStart(period, now);
    const by = new Map<string, LeaderRow>();
    for (const g of this.games.values()) {
      if (g.finishedAt < since) continue;
      for (const p of g.players) {
        if (!p.userId) continue;
        const row = by.get(p.userId) ?? { userId: p.userId, value: 0, games: 0 };
        row.games += 1;
        row.value += metric === 'wins' ? (p.won ? 1 : 0) : p.banked;
        by.set(p.userId, row);
      }
    }
    return [...by.values()].filter((r) => r.value > 0).sort((a, b) => b.value - a.value || a.games - b.games || a.userId.localeCompare(b.userId)).slice(0, limit);
  }

  async dailyBoard(date: string, limit: number) {
    const rows: DailyRow[] = [];
    for (const g of this.games.values()) {
      if (g.mode !== 'daily' || g.dailyDate !== date) continue;
      for (const p of g.players) if (p.userId) rows.push({ userId: p.userId, displayName: p.displayName, banked: p.banked, longestWord: p.longestWord });
    }
    return rows.sort((a, b) => b.banked - a.banked).slice(0, limit);
  }

  async userStats(userId: string) {
    const s = emptyStats();
    for (const g of this.games.values()) {
      for (const p of g.players) {
        if (p.userId !== userId) continue;
        s.gamesPlayed += 1;
        s.wins += p.won ? 1 : 0;
        s.points += p.banked;
        s.bestScore = Math.max(s.bestScore, p.banked);
        s.longestWord = longer(s.longestWord, p.longestWord);
        s.dailyPlayed += g.mode === 'daily' ? 1 : 0;
      }
    }
    return s;
  }

  async anonymizeUser(userId: string) {
    for (const g of this.games.values()) for (const p of g.players) if (p.userId === userId) ((p.userId = null), (p.displayName = 'Deleted player'));
    for (const a of [...this.attempts]) if (a.startsWith(`${userId}|`)) this.attempts.delete(a);
  }

  async claimDaily(userId: string, date: string) {
    const key = `${userId}|${date}`;
    if (this.attempts.has(key)) return false;
    this.attempts.add(key);
    return true;
  }
}

/** Needs db/migrations/101_game_results.sql. */
export class PostgresResultsStore implements ResultsStore {
  constructor(private pool: Pick<Pool, 'query'> & { connect?: Pool['connect'] }) {}

  async saveGame(g: StoredGame) {
    const client = this.pool.connect ? await this.pool.connect() : null;
    const q = (client ?? this.pool).query.bind(client ?? this.pool);
    try {
      await q('begin');
      const ins = await q(
        'insert into games (game_id, mode, room_code, daily_date, finished_at, player_count, human_count) values ($1,$2,$3,$4,$5,$6,$7) on conflict (game_id) do nothing',
        [g.gameId, g.mode, g.roomCode, g.dailyDate, g.finishedAt, g.players.length, g.players.filter((p) => p.userId).length],
      );
      if (ins.rowCount === 0) {
        await q('rollback');
        return false;
      }
      for (const p of g.players) {
        // Steals are no longer played: the column stays for older games, and new rows write 0.
        await q(
          'insert into game_players (game_id, seat, user_id, display_name, banked, steals, words_played, longest_word, won) values ($1,$2,$3,$4,$5,0,$6,$7,$8)',
          [g.gameId, p.seat, p.userId, p.displayName, p.banked, p.wordsPlayed, p.longestWord, p.won],
        );
      }
      await q('commit');
      return true;
    } catch (e) {
      await q('rollback').catch(() => undefined);
      throw e;
    } finally {
      client?.release();
    }
  }

  async leaderboard({ period, metric, now, limit }: { period: Period; metric: Metric; now: number; limit: number }) {
    const col = metric === 'wins' ? 'case when p.won then 1 else 0 end' : 'p.banked'; // fixed strings, never user input
    const { rows } = await this.pool.query(
      `select p.user_id, sum(${col})::bigint as value, count(*)::int as games
       from game_players p join games g on g.game_id = p.game_id
       where p.user_id is not null and g.finished_at >= $1
       group by p.user_id having sum(${col}) > 0
       order by value desc, games asc, p.user_id asc limit $2`,
      [periodStart(period, now), limit],
    );
    return rows.map((r) => ({ userId: r.user_id as string, value: Number(r.value), games: Number(r.games) }));
  }

  async dailyBoard(date: string, limit: number) {
    const { rows } = await this.pool.query(
      `select p.user_id, p.display_name, p.banked, p.longest_word
       from game_players p join games g on g.game_id = p.game_id
       where g.mode = 'daily' and g.daily_date = $1 and p.user_id is not null
       order by p.banked desc limit $2`,
      [date, limit],
    );
    return rows.map((r) => ({ userId: r.user_id as string, displayName: r.display_name as string, banked: r.banked as number, longestWord: r.longest_word as string }));
  }

  async userStats(userId: string) {
    const { rows } = await this.pool.query(
      `select count(*)::int as played, coalesce(sum(case when p.won then 1 else 0 end),0)::int as wins, coalesce(sum(p.banked),0)::bigint as points,
              coalesce(max(p.banked),0)::int as best,
              coalesce((select longest_word from game_players where user_id = $1 order by length(longest_word) desc, longest_word asc limit 1), '') as longest,
              coalesce(sum(case when g.mode = 'daily' then 1 else 0 end),0)::int as daily
       from game_players p join games g on g.game_id = p.game_id where p.user_id = $1`,
      [userId],
    );
    const r = rows[0];
    return { gamesPlayed: Number(r.played), wins: Number(r.wins), points: Number(r.points), bestScore: Number(r.best), longestWord: r.longest as string, dailyPlayed: Number(r.daily) };
  }

  async anonymizeUser(userId: string) {
    await this.pool.query("update game_players set user_id = null, display_name = 'Deleted player' where user_id = $1", [userId]);
    await this.pool.query('delete from daily_attempts where user_id = $1', [userId]);
  }

  async claimDaily(userId: string, date: string, at: number) {
    const { rowCount } = await this.pool.query('insert into daily_attempts (user_id, daily_date, at) values ($1,$2,$3) on conflict do nothing', [userId, date, at]);
    return rowCount === 1;
  }
}

/** The stored form of a finished game, leaving out anyone whose results may not be kept. */
export function toStoredGame(result: GameResult, mayStore: (userId: string) => boolean): StoredGame {
  const winners = new Set(result.winners);
  return {
    gameId: result.gameId, mode: result.mode, roomCode: result.roomCode, dailyDate: result.dailyDate, finishedAt: result.finishedAt,
    players: result.players.map((p) => {
      const keep = p.userId !== null && mayStore(p.userId);
      return {
        seat: p.seat, userId: keep ? p.userId : null, displayName: keep ? p.name : p.userId === null ? p.name : 'Player',
        banked: p.banked, wordsPlayed: p.wordsPlayed, longestWord: p.longestWord, won: p.userId !== null && winners.has(p.userId),
      };
    }),
  };
}
