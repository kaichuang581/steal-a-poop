import type { Pool } from 'pg';
import { SLOTS } from './catalog';
import type { Slot } from './catalog';

export type LedgerReason = 'game_reward' | 'daily_reward' | 'purchase' | 'adjustment';
export interface LedgerEntry {
  userId: string;
  delta: number;
  reason: LedgerReason;
  /** The game id, the item id, or a note. A reason and ref pair is paid at most once per user. */
  ref: string;
  at: number;
}
export type LedgerResult = { ok: true; balance: number } | { ok: false; reason: 'insufficient' | 'duplicate' };
export type PurchaseResult = { ok: true; balance: number } | { ok: false; reason: 'insufficient' | 'owned' };

export interface EconomyStore {
  balance(userId: string): Promise<number>;
  /** Adds an entry and changes the balance in one step. Refused if it would go below zero or this reason and ref were already used. */
  apply(entry: LedgerEntry): Promise<LedgerResult>;
  /** Takes the price and adds the item in one step, or does neither. */
  purchase(userId: string, itemId: string, price: number, at: number): Promise<PurchaseResult>;
  /** Coins earned from games since the given time (rewards only, not purchases). */
  earnedSince(userId: string, since: number): Promise<number>;
  recent(userId: string, limit: number): Promise<LedgerEntry[]>;
  owned(userId: string): Promise<string[]>;
  equipped(userId: string): Promise<Partial<Record<Slot, string>>>;
  /** itemId null takes the slot's item off. */
  equip(userId: string, slot: Slot, itemId: string | null): Promise<void>;
  /** Account deletion: clears the wallet, items and what was worn. The ledger is append-only and is kept (ids and amounts only). */
  erase(userId: string): Promise<void>;
}

export class MemoryEconomyStore implements EconomyStore {
  readonly wallets = new Map<string, number>();
  readonly ledger: LedgerEntry[] = [];
  readonly inventory = new Map<string, Set<string>>();
  readonly worn = new Map<string, Partial<Record<Slot, string>>>();

  async balance(userId: string) {
    return this.wallets.get(userId) ?? 0;
  }
  async apply(e: LedgerEntry): Promise<LedgerResult> {
    if (this.ledger.some((l) => l.userId === e.userId && l.reason === e.reason && l.ref === e.ref)) return { ok: false, reason: 'duplicate' };
    const next = (this.wallets.get(e.userId) ?? 0) + e.delta;
    if (next < 0) return { ok: false, reason: 'insufficient' };
    this.wallets.set(e.userId, next);
    this.ledger.push({ ...e });
    return { ok: true, balance: next };
  }
  async purchase(userId: string, itemId: string, price: number, at: number): Promise<PurchaseResult> {
    if (this.inventory.get(userId)?.has(itemId)) return { ok: false, reason: 'owned' };
    const r = await this.apply({ userId, delta: -price, reason: 'purchase', ref: itemId, at });
    if (!r.ok) return { ok: false, reason: 'insufficient' };
    this.inventory.set(userId, (this.inventory.get(userId) ?? new Set()).add(itemId));
    return r;
  }
  async earnedSince(userId: string, since: number) {
    return this.ledger.filter((l) => l.userId === userId && l.at >= since && (l.reason === 'game_reward' || l.reason === 'daily_reward')).reduce((n, l) => n + l.delta, 0);
  }
  async recent(userId: string, limit: number) {
    return this.ledger.filter((l) => l.userId === userId).slice(-limit).reverse().map((l) => ({ ...l }));
  }
  async owned(userId: string) {
    return [...(this.inventory.get(userId) ?? [])];
  }
  async equipped(userId: string) {
    return { ...(this.worn.get(userId) ?? {}) };
  }
  async equip(userId: string, slot: Slot, itemId: string | null) {
    const cur = { ...(this.worn.get(userId) ?? {}) };
    if (itemId) cur[slot] = itemId;
    else delete cur[slot];
    this.worn.set(userId, cur);
  }
  async erase(userId: string) {
    this.wallets.delete(userId);
    this.inventory.delete(userId);
    this.worn.delete(userId);
  }
}

/** Needs db/migrations/102_economy.sql. */
export class PostgresEconomyStore implements EconomyStore {
  constructor(private pool: Pick<Pool, 'query'> & { connect: Pool['connect'] }) {}

  async balance(userId: string) {
    const { rows } = await this.pool.query('select balance from wallets where user_id = $1', [userId]);
    return rows[0] ? Number(rows[0].balance) : 0;
  }

  /** Runs the steps in one transaction, with the wallet row locked so two purchases cannot both spend the same coins. */
  private async tx<T>(userId: string, fn: (q: (sql: string, args?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('insert into wallets (user_id, balance) values ($1, 0) on conflict do nothing', [userId]);
      await client.query('select balance from wallets where user_id = $1 for update', [userId]);
      const out = await fn((sql, args) => client.query(sql, args));
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  private async applyIn(q: Parameters<Parameters<PostgresEconomyStore['tx']>[1]>[0], e: LedgerEntry): Promise<LedgerResult> {
    const dup = await q('insert into wallet_ledger (user_id, delta, reason, ref, at) values ($1,$2,$3,$4,$5) on conflict (user_id, reason, ref) do nothing', [e.userId, e.delta, e.reason, e.ref, e.at]);
    if (dup.rowCount === 0) return { ok: false, reason: 'duplicate' };
    const upd = await q('update wallets set balance = balance + $2 where user_id = $1 and balance + $2 >= 0 returning balance', [e.userId, e.delta]);
    if (upd.rows.length === 0) throw new InsufficientCoins(); // rolls the ledger row back with the rest
    return { ok: true, balance: Number(upd.rows[0].balance) };
  }

  async apply(e: LedgerEntry): Promise<LedgerResult> {
    try {
      return await this.tx(e.userId, (q) => this.applyIn(q, e));
    } catch (err) {
      if (err instanceof InsufficientCoins) return { ok: false, reason: 'insufficient' };
      throw err;
    }
  }

  async purchase(userId: string, itemId: string, price: number, at: number): Promise<PurchaseResult> {
    try {
      return await this.tx(userId, async (q) => {
        const own = await q('insert into inventory (user_id, item_id, price_paid, at) values ($1,$2,$3,$4) on conflict do nothing', [userId, itemId, price, at]);
        if (own.rowCount === 0) return { ok: false as const, reason: 'owned' as const };
        const r = await this.applyIn(q, { userId, delta: -price, reason: 'purchase', ref: itemId, at });
        if (!r.ok) throw new InsufficientCoins();
        return r;
      });
    } catch (err) {
      if (err instanceof InsufficientCoins) return { ok: false, reason: 'insufficient' };
      throw err;
    }
  }

  async earnedSince(userId: string, since: number) {
    const { rows } = await this.pool.query("select coalesce(sum(delta),0)::bigint as n from wallet_ledger where user_id = $1 and at >= $2 and reason in ('game_reward','daily_reward')", [userId, since]);
    return Number(rows[0].n);
  }
  async recent(userId: string, limit: number) {
    const { rows } = await this.pool.query('select user_id, delta, reason, ref, at from wallet_ledger where user_id = $1 order by id desc limit $2', [userId, limit]);
    return rows.map((r) => ({ userId: r.user_id as string, delta: Number(r.delta), reason: r.reason as LedgerReason, ref: r.ref as string, at: Number(r.at) }));
  }
  async owned(userId: string) {
    const { rows } = await this.pool.query('select item_id from inventory where user_id = $1 order by at', [userId]);
    return rows.map((r) => r.item_id as string);
  }
  async equipped(userId: string) {
    const { rows } = await this.pool.query('select slot, item_id from equipped where user_id = $1', [userId]);
    const out: Partial<Record<Slot, string>> = {};
    for (const r of rows) if (SLOTS.includes(r.slot as Slot)) out[r.slot as Slot] = r.item_id as string;
    return out;
  }
  async equip(userId: string, slot: Slot, itemId: string | null) {
    if (itemId) await this.pool.query('insert into equipped (user_id, slot, item_id) values ($1,$2,$3) on conflict (user_id, slot) do update set item_id = excluded.item_id', [userId, slot, itemId]);
    else await this.pool.query('delete from equipped where user_id = $1 and slot = $2', [userId, slot]);
  }
  async erase(userId: string) {
    await this.pool.query('delete from inventory where user_id = $1', [userId]);
    await this.pool.query('delete from equipped where user_id = $1', [userId]);
    await this.pool.query('delete from wallets where user_id = $1', [userId]);
  }
}

class InsufficientCoins extends Error {}
