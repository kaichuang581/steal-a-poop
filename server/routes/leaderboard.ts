import type { Route } from '../contracts';
import { utcDateKey } from '../../src/engine';
import type { AccountService } from '../auth/service';
import type { GameDataService } from '../game/service';
import { RateLimiter } from '../ratelimit';
import { limitKey } from '../address';

export const routes: Route[] = [];

const BOARD_CACHE_MS = 30_000;

const bad = (error: string, status = 400) => ({ status, json: { error } });

/** Leaderboards, the Daily Table board, and a player's own stats. The boards are public and show only nicknames. */
export function createLeaderboardRoutes(deps: { data: GameDataService; accounts: AccountService; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const byIp = new RateLimiter(60, 60_000);
  const settingsByUser = new RateLimiter(10, 60_000);
  // The boards are public and each one costs a query plus a profile lookup per row, so they are cached for a short
  // while, and requests that arrive together share one load. A few dozen addresses cannot tie up the database.
  const cache = new Map<string, { at: number; out: Promise<unknown> }>();
  const cached = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < BOARD_CACHE_MS) return hit.out as Promise<T>;
    if (cache.size >= 64) for (const [k, v] of cache) if (now() - v.at >= BOARD_CACHE_MS) cache.delete(k);
    const out = load();
    if (cache.size >= 64) return out; // made-up keys (any metric string, any date) must not grow the cache
    cache.set(key, { at: now(), out });
    out.catch(() => cache.delete(key)); // a failed load is not remembered
    return out;
  };
  return [
    {
      method: 'GET', path: '/api/leaderboard/:period', auth: 'none',
      handler: async (req) => {
        if (!byIp.allow(limitKey(req.ip), now())) return bad('rate_limited', 429);
        const metric = req.query.metric ?? 'wins';
        const out = await cached(`board:${req.params.period}:${metric}`, () => deps.data.leaderboard(req.params.period, metric));
        return out ? { status: 200, json: out } : bad('bad_request');
      },
    },
    {
      // "today" or a date such as 2026-11-02 (UTC).
      method: 'GET', path: '/api/daily/:date', auth: 'none',
      handler: async (req) => {
        if (!byIp.allow(limitKey(req.ip), now())) return bad('rate_limited', 429);
        const date = req.params.date === 'today' ? utcDateKey(new Date(now())) : req.params.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return bad('bad_date');
        return { status: 200, json: await cached(`daily:${date}`, () => deps.data.dailyBoard(date)) };
      },
    },
    {
      method: 'GET', path: '/api/me/stats', auth: 'user',
      handler: async (req) => ({ status: 200, json: await deps.data.myStats(req.user!.userId) }),
    },
    {
      method: 'POST', path: '/api/me/settings', auth: 'user',
      handler: async (req) => {
        if (!settingsByUser.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const b = (req.body ?? {}) as { leaderboardVisible?: unknown };
        if (typeof b.leaderboardVisible !== 'boolean') return bad('bad_request');
        const r = await deps.accounts.setLeaderboardVisible(req.user!.userId, b.leaderboardVisible);
        return r === 'ok' ? { status: 200, json: { leaderboardVisible: b.leaderboardVisible } } : bad(r, r === 'not_allowed' ? 403 : 404);
      },
    },
  ];
}
