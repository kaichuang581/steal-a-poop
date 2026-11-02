import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockList } from '../blocks';
import type { AuthUser } from '../contracts';
import { AccountService } from '../auth/service';
import { MemoryAccountStore } from '../auth/store';
import type { Profile } from '../auth/store';
import { MemoryMailer } from '../auth/mailer';
import { DEFAULT_AGE_POLICY } from '../auth/policy';
import { RevocationBus } from '../auth/revocations';
import { EconomyService } from '../economy/service';
import { MemoryEconomyStore } from '../economy/store';
import { MemoryResultsStore } from '../game/results';
import { GameDataService } from '../game/service';
import { createHttpServer } from '../http';
import { FriendsService, MemoryFriendStore } from '../social/friends';
import { createFriendRoutes } from './friends';
import { createLeaderboardRoutes } from './leaderboard';
import { createShopRoutes } from './shop';

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));
const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);
const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  userId: id, nickname: id.toUpperCase(), emailHash: 'h', dateOfBirth: '1990-01-01', country: 'CA', consentStatus: 'not_required', leaderboardVisible: true,
  isModerator: false, sessionsValidAfter: 0, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
});

async function boot(ids = ['a', 'b', 'kid']) {
  const accounts = new MemoryAccountStore();
  for (const id of ids) await accounts.createProfile(profile(id, id === 'kid' ? { consentStatus: 'pending', leaderboardVisible: false } : {}));
  const blocks = new BlockList();
  const economyStore = new MemoryEconomyStore();
  const economy = new EconomyService(economyStore, () => NOW);
  const friends = new FriendsService({ store: new MemoryFriendStore(), accounts, blocks, now: () => NOW, online: (id) => id === 'b' });
  const results = new MemoryResultsStore();
  const data = new GameDataService({ results, accounts, economy, isBanned: () => false, now: () => NOW });
  const acct = new AccountService({
    store: accounts, now: () => NOW, mailer: new MemoryMailer(), agePolicy: DEFAULT_AGE_POLICY, nicknameAllowed: () => true, blocks, bus: new RevocationBus(), appUrl: 'https://x/',
  });
  server = createHttpServer({
    routes: [...createFriendRoutes({ friends, now: () => NOW }), ...createLeaderboardRoutes({ data, accounts: acct, now: () => NOW }), ...createShopRoutes({ economy, store: economyStore, now: () => NOW })],
    verifyToken: async (t): Promise<AuthUser | null> => {
      const id = t.replace('tok-', '');
      return ids.includes(id) ? { userId: id, name: id.toUpperCase(), chatAllowed: id !== 'kid', isModerator: false } : null;
    },
  });
  await new Promise<void>((r) => server!.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, as?: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { ...(as ? { authorization: `Bearer tok-${as}` } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json().catch(() => null)) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { call, economyStore, data, results };
}

describe('friends routes', () => {
  it('need a login', async () => {
    const { call } = await boot();
    for (const [m, p] of [['GET', '/api/friends'], ['GET', '/api/friends/code'], ['POST', '/api/friends/request']] as const) expect((await call(m, p)).status).toBe(401);
  });
  it('code, request, accept, list, remove', async () => {
    const { call } = await boot();
    const codeB = (await call('GET', '/api/friends/code', 'b')).json.code as string;
    expect(codeB).toMatch(/^[A-Z2-9]{8}$/);
    expect((await call('POST', '/api/friends/request', 'a', { code: codeB })).json).toEqual({ state: 'sent' });
    expect((await call('GET', '/api/friends', 'b')).json.incoming.map((f: any) => f.userId)).toEqual(['a']); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((await call('POST', '/api/friends/a/accept', 'b')).status).toBe(200);
    const list = (await call('GET', '/api/friends', 'a')).json;
    expect(list.friends).toEqual([{ userId: 'b', name: 'B', online: true }]);
    expect((await call('POST', '/api/friends/b/remove', 'a')).status).toBe(200);
    expect((await call('GET', '/api/friends', 'a')).json.friends).toEqual([]);
  });
  it('a child waiting for consent cannot use friends at all', async () => {
    const { call } = await boot();
    expect((await call('GET', '/api/friends', 'kid')).status).toBe(403);
    expect((await call('GET', '/api/friends/code', 'kid')).status).toBe(403);
    expect((await call('POST', '/api/friends/request', 'kid', { code: 'ABCDEFGH' })).status).toBe(403);
  });
  it('bad requests and unknown codes get clear errors, and wrong codes are rate limited', async () => {
    const { call } = await boot();
    expect((await call('POST', '/api/friends/request', 'a', {})).json.error).toBe('bad_request');
    expect((await call('POST', '/api/friends/request', 'a', { code: 'NOSUCH12' })).status).toBe(404);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await call('POST', '/api/friends/request', 'a', { code: `WRONG${i}XX` })).status;
    expect(last).toBe(429);
  });
  it('accepting something that was never sent is a 404', async () => {
    const { call } = await boot();
    expect((await call('POST', '/api/friends/b/accept', 'a')).status).toBe(404);
  });
});

describe('leaderboard routes', () => {
  const finished = (data: GameDataService) =>
    data.record({
      gameId: 'g1', mode: 'room', roomCode: 'R', dailyDate: null, finishedAt: NOW - 1000, winners: ['a'],
      players: [
        { userId: 'a', name: 'A', seat: 0, banked: 50, steals: 3, wordsPlayed: 4, longestWord: 'zebra' },
        { userId: 'b', name: 'B', seat: 1, banked: 20, steals: 0, wordsPlayed: 4, longestWord: 'cat' },
      ],
    });
  it('are public, validate their inputs, and show only nicknames', async () => {
    const { call, data } = await boot();
    await finished(data);
    const r = await call('GET', '/api/leaderboard/all?metric=wins');
    expect(r.status).toBe(200);
    expect(r.json.rows).toEqual([{ rank: 1, userId: 'a', name: 'A', value: 1, games: 1, cosmetics: {} }]);
    expect((await call('GET', '/api/leaderboard/forever')).status).toBe(400);
    expect((await call('GET', '/api/leaderboard/all?metric=hax')).status).toBe(400);
    expect((await call('GET', '/api/daily/not-a-date')).status).toBe(400);
    expect((await call('GET', '/api/daily/today')).json.date).toBe('2026-11-04');
  });
  it('a player sees their own stats and can hide themselves; a child cannot opt in', async () => {
    const { call, data } = await boot();
    await finished(data);
    expect((await call('GET', '/api/me/stats')).status).toBe(401);
    expect((await call('GET', '/api/me/stats', 'a')).json).toMatchObject({ gamesPlayed: 1, wins: 1, points: 50, steals: 3, longestWord: 'zebra' });
    expect((await call('POST', '/api/me/settings', 'a', { leaderboardVisible: false })).json).toEqual({ leaderboardVisible: false });
    expect((await call('GET', '/api/leaderboard/all?metric=wins')).json.rows).toEqual([]);
    expect((await call('POST', '/api/me/settings', 'a', { leaderboardVisible: 'yes' })).status).toBe(400);
    expect((await call('POST', '/api/me/settings', 'kid', { leaderboardVisible: true })).status).toBe(403);
  });
});

describe('shop routes', () => {
  it('show the balance and the catalog, and only sell what you can afford', async () => {
    const { call, economyStore } = await boot();
    expect((await call('GET', '/api/shop')).status).toBe(401);
    const empty = (await call('GET', '/api/shop', 'a')).json;
    expect(empty.balance).toBe(0);
    expect(empty.items.length).toBeGreaterThan(10);
    expect((await call('POST', '/api/shop/buy', 'a', { itemId: 'color-gold' })).json.error).toBe('insufficient');
    await economyStore.apply({ userId: 'a', delta: 400, reason: 'game_reward', ref: 'g', at: 1 });
    expect((await call('POST', '/api/shop/buy', 'a', { itemId: 'color-gold' })).json).toEqual({ balance: 250 });
    expect((await call('POST', '/api/shop/buy', 'a', { itemId: 'color-gold' })).json.error).toBe('owned');
    expect((await call('POST', '/api/shop/buy', 'a', { itemId: 'made-up' })).status).toBe(404);
    expect((await call('POST', '/api/shop/buy', 'a', {})).status).toBe(400);
  });
  it('equip needs ownership and the right slot; the wallet lists recent activity', async () => {
    const { call, economyStore } = await boot();
    await economyStore.apply({ userId: 'a', delta: 400, reason: 'game_reward', ref: 'g', at: 1 });
    await call('POST', '/api/shop/buy', 'a', { itemId: 'badge-fire' });
    expect((await call('POST', '/api/shop/equip', 'a', { slot: 'badge', itemId: 'badge-crown' })).status).toBe(403);
    expect((await call('POST', '/api/shop/equip', 'a', { slot: 'color', itemId: 'badge-fire' })).status).toBe(404);
    expect((await call('POST', '/api/shop/equip', 'a', { slot: 'badge', itemId: 'badge-fire' })).status).toBe(200);
    expect((await call('POST', '/api/shop/equip', 'a', { slot: 'badge', itemId: null })).status).toBe(200);
    const w = (await call('GET', '/api/wallet', 'a')).json;
    expect(w.balance).toBe(200);
    expect(w.history.map((h: any) => h.reason)).toEqual(['purchase', 'game_reward']); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
  it('one player cannot see or spend another player\'s coins', async () => {
    const { call, economyStore } = await boot();
    await economyStore.apply({ userId: 'a', delta: 400, reason: 'game_reward', ref: 'g', at: 1 });
    expect((await call('GET', '/api/wallet', 'b')).json.balance).toBe(0);
    expect((await call('POST', '/api/shop/buy', 'b', { itemId: 'color-gold', userId: 'a' })).json.error).toBe('insufficient');
    expect(await economyStore.balance('a')).toBe(400);
  });
});
