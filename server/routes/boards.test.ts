import { describe, expect, it } from 'vitest';
import type { GameReward } from '../../src/skin/shop/economy';
import { BarnService } from '../barn/service';
import { MemoryBarnStore } from '../barn/store';
import type { RouteRequest } from '../contracts';
import { RankedService } from '../ranked/service';
import { MemoryRankedStore } from '../ranked/store';
import { createBarnRoutes } from './barn';
import { createRankedRoutes } from './ranked';

// The leaderboards page reads the ranked ladder and the level board without a login (Brian, 2026-11-14: "refine the
// leaderboards"). Like the game leaderboards they are public: a name and a score for each player the services would
// name anywhere, no account ids, and nobody's own place.
const NOW = Date.UTC(2026, 10, 14, 12);
const anyone = (ip = '203.0.113.9'): RouteRequest => ({ params: {}, query: {}, body: null, user: null, session: null, ip });
const named = async (id: string) => (id.startsWith('hidden') ? null : `Name of ${id}`);
const win: GameReward = { mode: 'quick', won: true, words: ['cat', 'tomorrow'] };

describe('the ranked ladder, for anyone', () => {
  const boot = () => {
    const store = new MemoryRankedStore();
    store.rows.set('ann', { rating: 1310, games: 12, wins: 7, peak: 1310, updatedAt: 1 });
    store.rows.set('bo', { rating: 640, games: 4, wins: 1, peak: 700, updatedAt: 1 });
    store.rows.set('hidden-cy', { rating: 2000, games: 30, wins: 20, peak: 2000, updatedAt: 1 });
    const route = createRankedRoutes({ ranked: new RankedService(store, () => NOW, named), now: () => NOW }).find((r) => r.path === '/api/ranked/board')!;
    return route;
  };
  it('needs no login, lists by rating, names only who may be named, and marks nobody as the asker', async () => {
    const route = boot();
    expect(route.auth).toBe('none');
    const out = await route.handler(anyone());
    expect(out.status).toBe(200);
    const board = out.json as { top: Array<{ place: number; name: string; rating: number; you: boolean }>; you: unknown };
    expect(board.top.map((r) => [r.place, r.name, r.rating])).toEqual([[1, 'Name of ann', 1310], [2, 'Name of bo', 640]]);
    expect(board.top.some((r) => r.you)).toBe(false);
    expect(board.you).toBeNull();
    expect(JSON.stringify(out.json)).not.toMatch(/userId|"ann"|"bo"|hidden/);
  });
  it('is limited by address', async () => {
    const route = boot();
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await route.handler(anyone())).status;
    expect(last).toBe(429);
    expect((await route.handler(anyone('198.51.100.7'))).status).toBe(200);
  });
});

describe('the level board, for anyone', () => {
  const boot = async () => {
    const barn = new BarnService(new MemoryBarnStore(), () => NOW, named);
    await barn.claim('lo', 'quick:lo', { ...win, won: false });
    await barn.claim('hi', 'quick:hi', win);
    await barn.claim('hi', 'quick:hi2', win);
    await barn.claim('hidden-x', 'quick:x', win);
    return createBarnRoutes({ barn, now: () => NOW }).find((r) => r.path === '/api/barn/board')!;
  };
  it('needs no login, lists by XP, names only who may be named, and marks nobody as the asker', async () => {
    const route = await boot();
    expect(route.auth).toBe('none');
    const out = await route.handler(anyone());
    expect(out.status).toBe(200);
    const board = out.json as { top: Array<{ place: number; name: string; level: number; xp: number; you: boolean }>; you: unknown };
    expect(board.top.map((r) => r.name)).toEqual(['Name of hi', 'Name of lo']);
    expect(board.top.every((r) => r.xp > 0 && r.level >= 1 && !r.you)).toBe(true);
    expect(board.you).toBeNull();
    expect(JSON.stringify(out.json)).not.toMatch(/userId|"hi"|"lo"|hidden/);
  });
  it('is limited by address', async () => {
    const route = await boot();
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await route.handler(anyone())).status;
    expect(last).toBe(429);
  });
});
