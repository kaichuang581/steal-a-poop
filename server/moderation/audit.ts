import type { Pool } from 'pg';

/**
 * The audit log: one line per thing that happened to a case. It records who, what and when, using
 * ids. It never holds message text, so it can be shared more widely than the evidence tables.
 */
export type AuditAction =
  | 'message_held'
  | 'message_reported'
  | 'appeal_filed'
  | 'reviewer_verdict'
  | 'human_decision'
  | 'standing_restored'
  | 'child_safety_report_confirmed'
  | 'case_exported'
  | 'host_kick'
  | 'host_mute'
  | 'host_unmute';

export interface AuditEntry {
  at: number;
  /** A moderator's user id, 'system', or 'reviewer'. */
  actor: string;
  action: AuditAction;
  itemId?: number;
  userId?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
  list(filter?: { userId?: string; itemId?: number }): Promise<AuditEntry[]>;
}

export class MemoryAudit implements AuditLog {
  readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry) {
    this.entries.push(structuredClone(entry));
  }
  async list(filter: { userId?: string; itemId?: number } = {}) {
    return this.entries
      .filter((e) => (filter.userId === undefined || e.userId === filter.userId) && (filter.itemId === undefined || e.itemId === filter.itemId))
      .map((e) => structuredClone(e));
  }
}

/** Needs db/migrations/201_moderation_audit.sql. */
export class PostgresAudit implements AuditLog {
  constructor(private pool: Pick<Pool, 'query'>) {}
  async record(e: AuditEntry) {
    await this.pool.query('insert into moderation_audit (at, actor, action, item_id, user_id, details) values ($1,$2,$3,$4,$5,$6)', [
      e.at, e.actor, e.action, e.itemId ?? null, e.userId ?? null, JSON.stringify(e.details ?? {}),
    ]);
  }
  async list(filter: { userId?: string; itemId?: number } = {}) {
    const { rows } = await this.pool.query(
      `select at, actor, action, item_id, user_id, details from moderation_audit
       where ($1::text is null or user_id = $1) and ($2::bigint is null or item_id = $2) order by id`,
      [filter.userId ?? null, filter.itemId ?? null],
    );
    return rows.map((r) => ({
      at: Number(r.at), actor: r.actor as string, action: r.action as AuditAction,
      itemId: r.item_id === null ? undefined : Number(r.item_id), userId: (r.user_id as string | null) ?? undefined, details: r.details,
    }));
  }
}
