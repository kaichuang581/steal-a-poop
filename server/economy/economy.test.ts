import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { StoredGame } from '../game/results';
import { CATALOG, itemById, publicCosmetics } from './catalog';
import { DEFAULT_RULES, capReward, rewardFor } from './rules';
import { EconomyService } from './service';
import { MemoryEconomyStore, PostgresEconomyStore } from './store';
import type { EconomyStore } from './store';

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);

describe('catalog', () => {
  it('every item has a unique id, a price and a slot-appropriate value', () => {
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
    for (const i of CATALOG) {
      expect(i.price).toBeGreaterThan(0);
      if (i.slot === 'color' || i.slot === 'theme') expect(i.value).toMatch(/^#[0-9a-f]{6}$/i);
      if (i.slot === 'title') expect(i.value.length).toBeLessThanOrEqual(24);
    }
    expect(itemById('nope')).toBeUndefined();
  });
  it('only color, title and badge are shown to others', () => {
    expect(publicCosmetics({ color: 'color-gold', title: 'title-thief', badge: 'badge-crown', theme: 'theme-night' })).toEqual({ color: '#fbbf24', title: 'the Thief', badge: '👑' });
    expect(publicCosmetics({})).toEqual({});
    expect(publicCosmetics({ color: 'made-up' })).toEqual({});
  });
});

describe('rewards', () => {
  it('pays for finishing and winning', () => {
    expect(rewardFor('room', { won: false }).coins).toBe(DEFAULT_RULES.roomFinish);
    expect(rewardFor('room', { won: true }).coins).toBe(10 + 25);
    expect(rewardFor('daily', { won: true }).coins).toBe(15 + 10);
    expect(rewardFor('room', { won: true }).parts.map((p) => p.label)).toEqual(['Finished the game', 'Won']);
  });
  it('stops at the daily limit', () => {
    const r = rewardFor('room', { won: true });
    expect(capReward(r, 0).coins).toBe(r.coins);
    expect(capReward(r, 190).coins).toBe(10);
    expect(capReward(r, 200).coins).toBe(0);
    expect(capReward(r, 500).coins).toBe(0);
    expect(capReward(r, 190).parts.at(-1)!.label).toBe('Daily limit reached');
  });
});

function behaves(make: () => Promise<EconomyStore>) {
  it('applies entries, refuses overdrafts, and never pays the same reason and ref twice', async () => {
    const s = await make();
    expect(await s.apply({ userId: 'a', delta: 100, reason: 'game_reward', ref: 'g1', at: 1 })).toEqual({ ok: true, balance: 100 });
    expect(await s.apply({ userId: 'a', delta: 100, reason: 'game_reward', ref: 'g1', at: 2 })).toEqual({ ok: false, reason: 'duplicate' });
    expect(await s.apply({ userId: 'a', delta: -150, reason: 'adjustment', ref: 'x', at: 3 })).toEqual({ ok: false, reason: 'insufficient' });
    expect(await s.balance('a')).toBe(100);
    expect(await s.apply({ userId: 'a', delta: -100, reason: 'adjustment', ref: 'y', at: 4 })).toEqual({ ok: true, balance: 0 });
    expect(await s.balance('nobody')).toBe(0);
  });
  it('a refused overdraft leaves no ledger line behind', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 10, reason: 'game_reward', ref: 'g1', at: 1 });
    await s.apply({ userId: 'a', delta: -50, reason: 'adjustment', ref: 'x', at: 2 });
    expect((await s.recent('a', 10)).map((e) => e.ref)).toEqual(['g1']);
  });
  it('a purchase takes the price and adds the item together, once', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 300, reason: 'game_reward', ref: 'g1', at: 1 });
    expect(await s.purchase('a', 'color-gold', 150, 2)).toEqual({ ok: true, balance: 150 });
    expect(await s.purchase('a', 'color-gold', 150, 3)).toEqual({ ok: false, reason: 'owned' });
    expect(await s.balance('a')).toBe(150);
    expect(await s.owned('a')).toEqual(['color-gold']);
  });
  it('a purchase you cannot afford changes nothing', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 50, reason: 'game_reward', ref: 'g1', at: 1 });
    expect(await s.purchase('a', 'badge-crown', 400, 2)).toEqual({ ok: false, reason: 'insufficient' });
    expect(await s.balance('a')).toBe(50);
    expect(await s.owned('a')).toEqual([]);
  });
  it('two purchases at the same moment cannot spend the same coins', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 200, reason: 'game_reward', ref: 'g1', at: 1 });
    const results = await Promise.all([s.purchase('a', 'title-thief', 200, 2), s.purchase('a', 'title-wizard', 200, 2)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await s.balance('a')).toBe(0);
    expect(await s.owned('a')).toHaveLength(1);
  });
  it('counts only game rewards as earned, and only since the given time', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 40, reason: 'game_reward', ref: 'g1', at: 100 });
    await s.apply({ userId: 'a', delta: 15, reason: 'daily_reward', ref: 'g2', at: 200 });
    await s.apply({ userId: 'a', delta: -10, reason: 'purchase', ref: 'i', at: 300 });
    expect(await s.earnedSince('a', 150)).toBe(15);
    expect(await s.earnedSince('a', 0)).toBe(55);
  });
  it('remembers what is worn, one item per slot, and can take it off', async () => {
    const s = await make();
    await s.equip('a', 'color', 'color-gold');
    await s.equip('a', 'color', 'color-mint');
    await s.equip('a', 'badge', 'badge-fire');
    expect(await s.equipped('a')).toEqual({ color: 'color-mint', badge: 'badge-fire' });
    await s.equip('a', 'badge', null);
    expect(await s.equipped('a')).toEqual({ color: 'color-mint' });
  });
  it('erasing clears the wallet, items and what was worn', async () => {
    const s = await make();
    await s.apply({ userId: 'a', delta: 300, reason: 'game_reward', ref: 'g1', at: 1 });
    await s.purchase('a', 'color-gold', 150, 2);
    await s.equip('a', 'color', 'color-gold');
    await s.erase('a');
    expect([await s.balance('a'), await s.owned('a'), await s.equipped('a')]).toEqual([0, [], {}]);
  });
}

describe('MemoryEconomyStore', () => {
  behaves(async () => new MemoryEconomyStore());
});

const game = (id: string, mode: 'room' | 'daily' = 'room'): StoredGame => ({
  gameId: id, mode, roomCode: null, dailyDate: null, finishedAt: NOW,
  players: [
    { seat: 0, userId: 'a', displayName: 'Ana', banked: 50, wordsPlayed: 4, longestWord: 'zebra', won: true },
    { seat: 1, userId: 'b', displayName: 'Ben', banked: 20, wordsPlayed: 3, longestWord: 'cat', won: false },
    { seat: 2, userId: null, displayName: 'Bot', banked: 10, wordsPlayed: 3, longestWord: 'dog', won: false },
  ],
});

describe('EconomyService', () => {
  const make = () => {
    const store = new MemoryEconomyStore();
    return { store, svc: new EconomyService(store, () => NOW) };
  };
  it('pays each human player of a finished game, once, and not the bots', async () => {
    const { svc, store } = make();
    const awards = await svc.awardGame(game('g1'));
    expect([...awards].map(([id, r]) => [id, r.coins, r.balance])).toEqual([['a', 10 + 25, 35], ['b', 10, 10]]);
    expect(await svc.awardGame(game('g1'))).toEqual(new Map()); // the same game cannot pay again
    expect(await store.balance('a')).toBe(35);
    expect(store.wallets.size).toBe(2);
  });
  it('a player stops earning at the daily limit', async () => {
    const { svc, store } = make();
    await store.apply({ userId: 'b', delta: 195, reason: 'game_reward', ref: 'earlier', at: NOW - 1000 });
    const awards = await svc.awardGame(game('g2'));
    expect(awards.get('b')!.coins).toBe(5);
    expect(await store.balance('b')).toBe(200);
    const again = await svc.awardGame(game('g3'));
    expect(again.get('b')!.coins).toBe(0);
  });
  it('buying checks the item, the price and ownership; equipping needs an owned item in the right slot', async () => {
    const { svc, store } = make();
    await store.apply({ userId: 'a', delta: 500, reason: 'game_reward', ref: 'g', at: 1 });
    expect(await svc.buy('a', 'nope')).toEqual({ ok: false, reason: 'unknown_item' });
    expect(await svc.buy('a', 'color-gold')).toEqual({ ok: true, balance: 350 });
    expect(await svc.buy('a', 'color-gold')).toEqual({ ok: false, reason: 'owned' });
    expect(await svc.buy('a', 'badge-crown')).toEqual({ ok: false, reason: 'insufficient' }); // 400 coins, only 350 left
    expect(await svc.buy('a', 'badge-fire')).toEqual({ ok: true, balance: 150 });
    expect(await svc.equip('a', 'color', 'badge-fire')).toEqual({ ok: false, reason: 'unknown_item' }); // wrong slot
    expect(await svc.equip('a', 'color', 'color-mint')).toEqual({ ok: false, reason: 'not_owned' });
    expect(await svc.equip('a', 'hat', 'x')).toEqual({ ok: false, reason: 'bad_slot' });
    expect(await svc.equip('a', 'color', 'color-gold')).toEqual({ ok: true });
    const view = await svc.shop('a');
    expect(view.items.find((i) => i.id === 'color-gold')).toMatchObject({ owned: true, equipped: true });
    expect(view.items.find((i) => i.id === 'color-mint')).toMatchObject({ owned: false, equipped: false });
  });
  it('tells listeners when someone changes what they wear, and caches what others see', async () => {
    const { svc, store } = make();
    await store.apply({ userId: 'a', delta: 500, reason: 'game_reward', ref: 'g', at: 1 });
    await svc.buy('a', 'badge-fire');
    const seen: unknown[] = [];
    svc.onCosmetics((id, c) => seen.push([id, c]));
    expect(await svc.cosmetics('a')).toEqual({});
    expect(svc.cachedCosmetics('a')).toEqual({});
    await svc.equip('a', 'badge', 'badge-fire');
    expect(seen).toEqual([['a', { badge: '🔥' }]]);
    expect(svc.cachedCosmetics('a')).toEqual({ badge: '🔥' });
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresEconomyStore against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/102_economy.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists wallets, wallet_ledger, inventory, equipped cascade');
    await pool.query(migration);
  });
  it('the migration can be run twice', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
  });
  behaves(async () => new PostgresEconomyStore(pool as never));
  it('the ledger cannot be changed, and the wallet cannot go below zero even by hand', async () => {
    const s = new PostgresEconomyStore(pool as never);
    await s.apply({ userId: 'a', delta: 10, reason: 'game_reward', ref: 'g', at: 1 });
    await expect(pool.query("update wallet_ledger set delta = 999")).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from wallet_ledger')).rejects.toThrow(/append-only/);
    await expect(pool.query('truncate wallet_ledger')).rejects.toThrow(/append-only/);
    await expect(pool.query("update wallets set balance = -1 where user_id = 'a'")).rejects.toThrow();
    const { rows } = await pool.query("select relname, relrowsecurity from pg_class where relname in ('wallets','wallet_ledger','inventory','equipped') and relkind = 'r' and relnamespace = current_schema()::regnamespace");
    expect(rows.every((r) => r.relrowsecurity) && rows.length === 4).toBe(true);
  });
});
