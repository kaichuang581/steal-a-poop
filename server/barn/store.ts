import type { Pool } from 'pg';
import type { Wallet } from '../../src/skin/shop/economy';

export interface BarnRow { wallet: Wallet | null; imported: boolean }

/**
 * Where signed-in players' Barn Bazaar wallets live. `change` reads a wallet and writes what `fn` returns in one step
 * (a locked transaction in Postgres), so two requests at once can never both spend the same coins.
 */
export interface BarnStore {
  get(userId: string): Promise<BarnRow>;
  change<T>(userId: string, fn: (row: BarnRow) => { row: { wallet: Wallet; imported: boolean } | null; out: T }, at: number): Promise<T>;
  erase(userId: string): Promise<void>;
  /** For the profile's rank: how many players with any XP have more than `xp`, and how many have any XP at all. */
  rank(xp: number): Promise<{ above: number; total: number }>;
  /** The players with the most XP, most first (ties by id, so the order is steady), at most `limit` of them. */
  top(limit: number): Promise<{ userId: string; xp: number }[]>;
}

export class MemoryBarnStore implements BarnStore {
  readonly rows = new Map<string, { wallet: Wallet; imported: boolean }>();
  private queue = Promise.resolve();
  async get(userId: string): Promise<BarnRow> {
    const r = this.rows.get(userId);
    return r ? { wallet: structuredClone(r.wallet), imported: r.imported } : { wallet: null, imported: false };
  }
  change<T>(userId: string, fn: (row: BarnRow) => { row: { wallet: Wallet; imported: boolean } | null; out: T }): Promise<T> {
    const run = this.queue.then(async () => {
      const { row, out } = fn(await this.get(userId));
      if (row) this.rows.set(userId, structuredClone(row));
      return out;
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
  async erase(userId: string) {
    this.rows.delete(userId);
  }
  async rank(xp: number) {
    let above = 0, total = 0;
    for (const { wallet } of this.rows.values()) {
      if (!(wallet?.xp > 0)) continue;
      total++;
      if (wallet.xp > xp) above++;
    }
    return { above, total };
  }
  async top(limit: number) {
    return [...this.rows.entries()].filter(([, r]) => r.wallet?.xp > 0).map(([userId, r]) => ({ userId, xp: r.wallet.xp }))
      .sort((a, b) => b.xp - a.xp || (a.userId < b.userId ? -1 : 1)).slice(0, limit);
  }
}

export class PostgresBarnStore implements BarnStore {
  constructor(private pool: Pick<Pool, 'query'> & { connect: Pool['connect'] }) {}
  async get(userId: string): Promise<BarnRow> {
    const { rows } = await this.pool.query('select wallet, imported from barn_wallets where user_id = $1', [userId]);
    return rows[0] ? { wallet: rows[0].wallet as Wallet, imported: !!rows[0].imported } : { wallet: null, imported: false };
  }
  async change<T>(userId: string, fn: (row: BarnRow) => { row: { wallet: Wallet; imported: boolean } | null; out: T }, at: number): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Make sure a row exists to lock, then lock it: two requests for one player wait their turn here.
      await client.query("insert into barn_wallets (user_id, wallet, imported, updated_at) values ($1, 'null'::jsonb, false, $2) on conflict (user_id) do nothing", [userId, at]);
      const { rows } = await client.query('select wallet, imported from barn_wallets where user_id = $1 for update', [userId]);
      const current: BarnRow = { wallet: rows[0]?.wallet && typeof rows[0].wallet === 'object' ? (rows[0].wallet as Wallet) : null, imported: !!rows[0]?.imported };
      const { row, out } = fn(current);
      if (row) await client.query('update barn_wallets set wallet = $2, imported = $3, updated_at = $4 where user_id = $1', [userId, JSON.stringify(row.wallet), row.imported, at]);
      await client.query('commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
  async erase(userId: string) {
    await this.pool.query('delete from barn_wallets where user_id = $1', [userId]);
  }
  async rank(xp: number) {
    // jsonb_typeof guards the rows a first `change` leaves as JSON null for a moment.
    const { rows } = await this.pool.query(
      `select count(*) filter (where (wallet->>'xp')::numeric > $1) as above, count(*) as total
         from barn_wallets where jsonb_typeof(wallet) = 'object' and jsonb_typeof(wallet->'xp') = 'number' and (wallet->>'xp')::numeric > 0`,
      [xp],
    );
    return { above: Number(rows[0]?.above ?? 0), total: Number(rows[0]?.total ?? 0) };
  }
  async top(limit: number) {
    const { rows } = await this.pool.query(
      `select user_id, (wallet->>'xp')::numeric as xp
         from barn_wallets where jsonb_typeof(wallet) = 'object' and jsonb_typeof(wallet->'xp') = 'number' and (wallet->>'xp')::numeric > 0
        order by (wallet->>'xp')::numeric desc, user_id limit $1`,
      [limit],
    );
    return rows.map((r) => ({ userId: String(r.user_id), xp: Number(r.xp) }));
  }
}
