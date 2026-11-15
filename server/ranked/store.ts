import type { Pool } from 'pg';

/** One player's standing in ranked play. The rating is the points on the ladder (src/lib/ranked.ts). */
export interface RankedRow { rating: number; games: number; wins: number; peak: number; updatedAt: number }

/**
 * Where ranked ratings live. A player sits at one table at a time, so their row is never written by two games at
 * once: plain reads and upserts are enough.
 */
export interface RankedStore {
  get(userId: string): Promise<RankedRow | null>;
  getMany(userIds: readonly string[]): Promise<Map<string, RankedRow>>;
  put(userId: string, row: RankedRow): Promise<void>;
  erase(userId: string): Promise<void>;
  /** The highest ratings among players who have finished a ranked game, highest first (ties by id, so the order is steady). */
  top(limit: number): Promise<{ userId: string; rating: number; games: number; wins: number }[]>;
  /** For "where you stand": how many players who have finished a ranked game are rated above `rating`, and how many there are. */
  standing(rating: number): Promise<{ above: number; total: number }>;
}

export class MemoryRankedStore implements RankedStore {
  readonly rows = new Map<string, RankedRow>();
  async get(userId: string) {
    const r = this.rows.get(userId);
    return r ? { ...r } : null;
  }
  async getMany(userIds: readonly string[]) {
    const out = new Map<string, RankedRow>();
    for (const id of userIds) { const r = this.rows.get(id); if (r) out.set(id, { ...r }); }
    return out;
  }
  async put(userId: string, row: RankedRow) {
    this.rows.set(userId, { ...row });
  }
  async erase(userId: string) {
    this.rows.delete(userId);
  }
  async top(limit: number) {
    return [...this.rows.entries()].filter(([, r]) => r.games > 0).map(([userId, r]) => ({ userId, rating: r.rating, games: r.games, wins: r.wins }))
      .sort((a, b) => b.rating - a.rating || (a.userId < b.userId ? -1 : 1)).slice(0, limit);
  }
  async standing(rating: number) {
    let above = 0, total = 0;
    for (const r of this.rows.values()) {
      if (r.games <= 0) continue;
      total++;
      if (r.rating > rating) above++;
    }
    return { above, total };
  }
}

const read = (r: Record<string, unknown>): RankedRow => ({ rating: Number(r.rating), games: Number(r.games), wins: Number(r.wins), peak: Number(r.peak), updatedAt: Number(r.updated_at) });

export class PostgresRankedStore implements RankedStore {
  constructor(private pool: Pick<Pool, 'query'>) {}
  async get(userId: string) {
    const { rows } = await this.pool.query('select rating, games, wins, peak, updated_at from ranked_ratings where user_id = $1', [userId]);
    return rows[0] ? read(rows[0]) : null;
  }
  async getMany(userIds: readonly string[]) {
    const out = new Map<string, RankedRow>();
    if (userIds.length === 0) return out;
    const { rows } = await this.pool.query('select user_id, rating, games, wins, peak, updated_at from ranked_ratings where user_id = any($1::text[])', [[...userIds]]);
    for (const r of rows) out.set(String(r.user_id), read(r));
    return out;
  }
  async put(userId: string, row: RankedRow) {
    await this.pool.query(
      `insert into ranked_ratings (user_id, rating, games, wins, peak, updated_at) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update set rating = excluded.rating, games = excluded.games, wins = excluded.wins, peak = excluded.peak, updated_at = excluded.updated_at`,
      [userId, row.rating, row.games, row.wins, row.peak, row.updatedAt],
    );
  }
  async erase(userId: string) {
    await this.pool.query('delete from ranked_ratings where user_id = $1', [userId]);
  }
  async top(limit: number) {
    const { rows } = await this.pool.query('select user_id, rating, games, wins from ranked_ratings where games > 0 order by rating desc, user_id limit $1', [limit]);
    return rows.map((r) => ({ userId: String(r.user_id), rating: Number(r.rating), games: Number(r.games), wins: Number(r.wins) }));
  }
  async standing(rating: number) {
    const { rows } = await this.pool.query('select count(*) filter (where rating > $1) as above, count(*) as total from ranked_ratings where games > 0', [rating]);
    return { above: Number(rows[0]?.above ?? 0), total: Number(rows[0]?.total ?? 0) };
  }
}
