import { describe, expect, it } from 'vitest';
import type { Route, RouteRequest } from '../contracts';
import { MemoryAccountStore } from '../auth/store';
import type { Profile } from '../auth/store';
import { MemoryVisitStore, SiteStats } from '../ops/siteStats';
import { createSiteRoutes } from './siteStats';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const KEY = 'a-long-secret-key-for-the-test';
const profile = (id: string, createdAt: number, deletedAt: number | null = null): Profile => ({
  userId: id, nickname: id, emailHash: 'h', dateOfBirth: null, country: 'US', consentStatus: 'not_required', leaderboardVisible: true,
  isModerator: false, sessionsValidAfter: 0, createdAt, updatedAt: createdAt, deletedAt,
});

async function setup(key: string | null = KEY) {
  const store = new MemoryAccountStore();
  await store.createProfile(profile('old', NOW - 30 * 86_400_000));
  await store.createProfile(profile('week', NOW - 3 * 86_400_000));
  await store.createProfile(profile('today', NOW - 3_600_000));
  await store.createProfile(profile('gone', NOW - 3_600_000, NOW));
  const stats = new SiteStats({ store: new MemoryVisitStore(), now: () => NOW });
  const routes = createSiteRoutes({
    stats, accounts: store, key: key ?? undefined, now: () => NOW,
    online: () => ({ connections: 9, guests: 4, rooms: 2, playersInGames: 6 }),
  });
  const call = (path: string, body: unknown, ip = '1.2.3.4') => {
    const r = routes.find((x: Route) => x.path === path)!;
    return r.handler({ params: {}, query: {}, body, user: null, session: null, ip } satisfies RouteRequest);
  };
  return { call, stats };
}

describe('the site ping', () => {
  it('is public and counts a visit once', async () => {
    const { call, stats } = await setup();
    expect((await call('/api/site/ping', { tab: 'abcdefghijkl', open: true, first: true })).status).toBe(200);
    expect((await call('/api/site/ping', { tab: 'abcdefghijkl' })).status).toBe(200);
    const s = await stats.summary();
    expect(s.visits.total).toBe(1);
    expect(s.newBrowsers.total).toBe(1);
    expect(s.onSiteNow).toBe(1);
  });

  it('refuses a code that is not a tab code, and anything that is not an object', async () => {
    const { call } = await setup();
    for (const body of [{ tab: 'short' }, { tab: 'has spaces and !! marks' }, { tab: 42 }, {}, null, 'text']) {
      expect((await call('/api/site/ping', body)).status).toBe(400);
    }
  });

  it('is limited per address', async () => {
    const { call } = await setup();
    let last = 0;
    for (let i = 0; i < 601; i++) last = (await call('/api/site/ping', { tab: 'abcdefghijkl' })).status;
    expect(last).toBe(429);
  });
});

describe('the admin numbers', () => {
  it('need the right key, and the answer is only numbers', async () => {
    const { call } = await setup();
    await call('/api/site/ping', { tab: 'abcdefghijkl', open: true, first: true });
    const ok = await call('/api/admin/stats', { key: KEY });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({
      at: NOW,
      site: { onSiteNow: 1, visits: { today: 1, yesterday: 0, last7: 1, last30: 1, total: 1 }, newBrowsers: { today: 1, last7: 1, total: 1 }, since: '2026-11-15' },
      accounts: { total: 3, today: 1, last7: 2 },
      online: { connections: 9, guests: 4, accounts: 5, rooms: 2, playersInGames: 6 },
    });
  });

  it('refuse a wrong key, a missing key and a key of the wrong kind', async () => {
    const { call } = await setup();
    for (const key of ['wrong', '', undefined, 42, null, KEY + 'x']) expect((await call('/api/admin/stats', { key })).status).toBe(403);
    expect((await call('/api/admin/stats', null)).status).toBe(403);
  });

  it('are limited, so a key cannot be guessed', async () => {
    const { call } = await setup();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call('/api/admin/stats', { key: `guess-${i}` })).status;
    expect(last).toBe(429);
    // even the right key waits out the limit from that address
    expect((await call('/api/admin/stats', { key: KEY })).status).toBe(429);
  });

  it('do not exist while the server has no key, or one that is too short', async () => {
    for (const key of [null, '', 'short-key']) {
      const { call } = await setup(key);
      expect((await call('/api/admin/stats', { key: key ?? 'x' })).status).toBe(404);
    }
  });
});
