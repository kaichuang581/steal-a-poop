import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { ReviewItem } from '../chat';
import type { ModerationStore, Standing } from './store';

/** Stores moderation state in Postgres. Needs the tables from db/migrations/200_moderation.sql. */
export class PostgresStore implements ModerationStore {
  constructor(private pool: Pick<Pool, 'query'>) {}

  async loadStandings(): Promise<Map<string, Standing>> {
    const { rows } = await this.pool.query('select user_id, banned, suspended_until from moderation_standings');
    return new Map(
      rows.map((r) => [r.user_id as string, { banned: r.banned as boolean, suspendedUntil: r.suspended_until === null ? null : Number(r.suspended_until) }]),
    );
  }

  async saveStanding(userId: string, s: Standing): Promise<void> {
    await this.pool.query(
      `insert into moderation_standings (user_id, banned, suspended_until, updated_at)
       values ($1, $2, $3, $4)
       on conflict (user_id) do update
         set banned = excluded.banned, suspended_until = excluded.suspended_until, updated_at = excluded.updated_at`,
      [userId, s.banned, s.suspendedUntil, Date.now()],
    );
  }

  async loadItems(): Promise<ReviewItem[]> {
    const { rows } = await this.pool.query('select data from moderation_items order by id');
    return rows.map((r) => r.data as ReviewItem);
  }

  async saveItem(item: ReviewItem): Promise<void> {
    await this.pool.query(
      `insert into moderation_items (id, at, user_id, room_code, category, status, verdict, data, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update
         set status = excluded.status, verdict = excluded.verdict, data = excluded.data, updated_at = excluded.updated_at`,
      [item.id, item.at, item.userId, item.roomCode, item.category, item.status, item.verdict ?? null, JSON.stringify(item), Date.now()],
    );
  }

  async saveEvidence(item: ReviewItem): Promise<void> {
    const payload = JSON.stringify(item);
    await this.pool.query(
      `insert into moderation_evidence (item_id, user_id, captured_at, content_hash, payload)
       values ($1, $2, $3, $4, $5)`,
      [item.id, item.userId, Date.now(), createHash('sha256').update(payload).digest('hex'), payload],
    );
  }
}
