import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { freshWallet } from '../../src/skin/shop/economy';
import type { GameReward } from '../../src/skin/shop/economy';
import { BarnService, IMPORT_COIN_CAP, readGameId, readReward } from './service';
import { MemoryBarnStore, PostgresBarnStore } from './store';
import type { BarnStore } from './store';

const DAY = Date.UTC(2026, 10, 11, 12);
const win: GameReward = { mode: 'quick', won: true, words: ['cat', 'tomorrow'] };

function behaves(make: () => Promise<BarnStore>) {
  let svc: BarnService;
  beforeEach(async () => { svc = new BarnService(await make(), () => DAY); });

  it('a new player starts with the free items and no coins', async () => {
    const r = await svc.wallet('u1');
    expect(r.wallet.coins).toBe(0);
    expect(r.wallet.equipped.bomb).toBe('bomb-ice');
    expect(r.imported).toBe(false);
  });
  it('pays a reported game once, and keeps the daily cap on the server', async () => {
    const a = await svc.claim('u1', 'quick:s1', win);
    expect(a.ok && a.coins).toBe(52);
    const again = await svc.claim('u1', 'quick:s1', win);
    expect(again.ok && again.lines).toEqual([]);
    for (let i = 2; i < 12; i++) await svc.claim('u1', `quick:s${i}`, win);
    expect((await svc.wallet('u1')).wallet.earnedToday).toBe(300);
  });
  it('buys at the catalogue price, refuses what it cannot afford, and equips only what is owned', async () => {
    expect(await svc.buy('u1', 'bomb-ember')).toEqual({ ok: false, reason: 'short' });
    for (let i = 0; i < 8; i++) await svc.claim('u1', `quick:b${i}`, win);
    const r = await svc.buy('u1', 'bomb-ember');
    expect(r.ok).toBe(true);
    expect(await svc.equip('u1', 'bomb-gold')).toEqual({ ok: false, reason: 'not_owned' });
    const e = await svc.equip('u1', 'bomb-ember');
    expect(e.ok && e.wallet.equipped.bomb).toBe('bomb-ember');
    expect(await svc.buy('u1', 'bomb-aurora')).toEqual({ ok: false, reason: 'not_for_sale' });
  });
  it('two purchases at once never spend the same coins twice', async () => {
    for (let i = 0; i < 9; i++) await svc.claim('u1', `quick:c${i}`, win);
    const coins = (await svc.wallet('u1')).wallet.coins;
    const results = await Promise.all(['bomb-ember', 'bomb-mint', 'bomb-plum'].map((id) => svc.buy('u1', id)));
    const spent = results.filter((r) => r.ok).length;
    const after = (await svc.wallet('u1')).wallet;
    expect(after.coins).toBeGreaterThanOrEqual(0);
    expect(after.owned.filter((i) => ['bomb-ember', 'bomb-mint', 'bomb-plum'].includes(i))).toHaveLength(spent);
    expect(coins - after.coins).toBe(results.reduce((n, r, i) => n + (r.ok ? [400, 400, 500][i] : 0), 0));
  });
  it('imports a browser wallet once, with coins and XP capped', async () => {
    const local = { ...freshWallet(), coins: 99_999, xp: 999_999, owned: [...freshWallet().owned, 'bomb-gold'], words: ['cat', 'dog'] };
    const r = await svc.importLocal('u1', local);
    expect(r.done).toBe(true);
    expect(r.wallet.coins).toBe(IMPORT_COIN_CAP);
    expect(r.wallet.owned).toContain('bomb-gold');
    expect(r.wallet.words).toEqual(['cat', 'dog']);
    const second = await svc.importLocal('u1', { ...local, coins: 500 });
    expect(second.done).toBe(false);
    expect(second.wallet.coins).toBe(IMPORT_COIN_CAP);
  });
  it('gives streak items for a reported streak, and erases on request', async () => {
    const s = await svc.streak('u1', 30);
    expect(s.granted).toEqual(['bomb-aurora', 'blast-starlight']);
    await svc.erase('u1');
    expect((await svc.wallet('u1')).wallet.owned).not.toContain('bomb-aurora');
  });
}

describe('BarnService (memory)', () => behaves(async () => new MemoryBarnStore()));

describe('reading reports from the browser', () => {
  it('accepts real-looking games and refuses the rest', () => {
    expect(readReward(win)).toEqual(win);
    expect(readReward({ mode: 'practice', score: 12, words: ['Cat'] })).toEqual({ mode: 'practice', score: 12, words: ['cat'] });
    expect(readReward({ mode: 'dream', sheep: 14, slept: false })).toEqual({ mode: 'dream', sheep: 14, slept: false });
    expect(readReward({ mode: 'room', won: true, words: [] })).toBeNull();
    expect(readReward({ mode: 'quick', won: 'yes', words: [] })).toBeNull();
    expect(readReward({ mode: 'quick', won: true, words: ['<script>'] })).toBeNull();
    expect(readReward({ mode: 'quick', won: true, words: Array(201).fill('cat') })).toBeNull();
    expect(readReward({ mode: 'practice', score: 9999, words: [] })).toBeNull();
    expect(readReward(null)).toBeNull();
  });
  it('takes only solo game ids, never the admin previews', () => {
    expect(readGameId('quick:abc:123')).toBe('quick:abc:123');
    expect(readGameId('dream:2026-11-11')).toBe('dream:2026-11-11');
    expect(readGameId('quick:preview:abc')).toBeNull();
    expect(readGameId('room:abc')).toBeNull();
    expect(readGameId('quick:' + 'a'.repeat(200))).toBeNull();
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresBarnStore against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/105_barn_wallets.sql', 'utf8');
  afterAll(async () => { await pool.end(); });
  beforeEach(async () => {
    await pool.query('drop table if exists barn_wallets cascade');
    await pool.query(migration);
  });
  it('the migration can be run twice and turns on row-level security', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname = 'barn_wallets' and relnamespace = current_schema()::regnamespace");
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
  behaves(async () => new PostgresBarnStore(pool as never));
});
