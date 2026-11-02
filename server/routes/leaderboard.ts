import type { Route } from '../contracts';
import { utcDateKey } from '../../src/engine';
import type { AccountService } from '../auth/service';
import type { GameDataService } from '../game/service';
import { RateLimiter } from '../ratelimit';

export const routes: Route[] = [];

const bad = (error: string, status = 400) => ({ status, json: { error } });

/** Leaderboards, the Daily Table board, and a player's own stats. The boards are public and show only nicknames. */
export function createLeaderboardRoutes(deps: { data: GameDataService; accounts: AccountService; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const byIp = new RateLimiter(60, 60_000);
  const settingsByUser = new RateLimiter(10, 60_000);
  return [
    {
      method: 'GET', path: '/api/leaderboard/:period', auth: 'none',
      handler: async (req) => {
        if (!byIp.allow(req.ip, now())) return bad('rate_limited', 429);
        const out = await deps.data.leaderboard(req.params.period, req.query.metric ?? 'wins');
        return out ? { status: 200, json: out } : bad('bad_request');
      },
    },
    {
      // "today" or a date such as 2026-11-02 (UTC).
      method: 'GET', path: '/api/daily/:date', auth: 'none',
      handler: async (req) => {
        if (!byIp.allow(req.ip, now())) return bad('rate_limited', 429);
        const date = req.params.date === 'today' ? utcDateKey(new Date(now())) : req.params.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return bad('bad_date');
        return { status: 200, json: await deps.data.dailyBoard(date) };
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
