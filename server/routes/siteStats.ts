import { createHash, timingSafeEqual } from 'node:crypto';
import type { Route } from '../contracts';
import type { AccountStore } from '../auth/store';
import { RateLimiter } from '../ratelimit';
import type { SiteStats } from '../ops/siteStats';
import { limitKey } from '../address';

const bad = (error: string, status = 400) => ({ status, json: { error } });
const DAY = 86_400_000;
/** A tab's code: made in the browser, random, short. Anything else is refused. */
const TAB = /^[A-Za-z0-9_-]{12,40}$/;
/** The shortest key the server will use. A shorter one switches the numbers off rather than guard them badly. */
export const MIN_STATS_KEY = 16;

export interface OnlineNow { connections: number; guests: number; rooms: number; playersInGames: number }

/**
 * Two routes for the admin panel's numbers (requested by Kai, 2026-11-15).
 *
 *  POST /api/site/ping   Public. A tab says it is open (once, `open`, with `unique`) or still there. Only numbers are kept: see ops/siteStats.ts.
 *  GET  /api/play/counts Public. How many people are in casual and in ranked games right now, for the Queue chooser.
 *                        Two numbers and nothing else, recounted at most every 5 s.
 *  POST /api/admin/stats The numbers: who is on the site and in games right now, visits, new browsers and how many accounts
 *                        there are. Needs `key` in the body, the server's ADMIN_STATS_KEY. The admin lock on the page is only
 *                        a convenience (anyone can read the page's code), so this is what actually keeps the numbers private.
 *                        With no key set on the server, or one that is too short, the route does not exist (404).
 */
export function createSiteRoutes(deps: {
  stats: SiteStats;
  accounts: Pick<AccountStore, 'profileCounts'>;
  online: () => OnlineNow;
  /** People in each mode right now (RoomManager.modeCounts). */
  modes?: () => { casual: number; ranked: number };
  key: string | undefined;
  now?: () => number;
}): Route[] {
  const now = deps.now ?? Date.now;
  const pings = new RateLimiter(600, 10 * 60_000); // a school's whole class can share one address
  const tries = new RateLimiter(20, 3600_000);
  const digest = (s: string) => createHash('sha256').update(s).digest();
  const wanted = deps.key && deps.key.length >= MIN_STATS_KEY ? digest(deps.key) : null;
  const looks = new RateLimiter(120, 10 * 60_000);
  let counted: { at: number; casual: number; ranked: number } | null = null;

  return [
    {
      method: 'POST', path: '/api/site/ping', auth: 'none',
      handler: async (req) => {
        if (!pings.allow(limitKey(req.ip), now())) return bad('rate_limited', 429);
        const b = (req.body && typeof req.body === 'object' ? req.body : {}) as { tab?: unknown; open?: unknown; first?: unknown; unique?: unknown };
        if (typeof b.tab !== 'string' || !TAB.test(b.tab)) return bad('bad_request');
        // `unique`: is this the browser's first visit of the day, week, month (a game from before it existed sends none).
        const u = (b.unique && typeof b.unique === 'object' ? b.unique : {}) as Record<string, unknown>;
        await deps.stats.ping(b.tab, b.open === true, b.open === true && b.first === true, { day: u.day === true, week: u.week === true, month: u.month === true });
        return { status: 200, json: { ok: true } };
      },
    },
    {
      method: 'GET', path: '/api/play/counts', auth: 'none',
      handler: async (req) => {
        if (!looks.allow(limitKey(req.ip), now())) return bad('rate_limited', 429);
        const t = now();
        if (!counted || t - counted.at >= 5000) counted = { at: t, ...(deps.modes?.() ?? { casual: 0, ranked: 0 }) };
        return { status: 200, json: { casual: counted.casual, ranked: counted.ranked } };
      },
    },
    {
      method: 'POST', path: '/api/admin/stats', auth: 'none',
      handler: async (req) => {
        if (!wanted) return bad('not_found', 404);
        if (!tries.allow(limitKey(req.ip), now())) return bad('rate_limited', 429);
        const given = (req.body as { key?: unknown } | null)?.key;
        if (typeof given !== 'string' || !timingSafeEqual(digest(given), wanted)) return bad('bad_key', 403);
        const t = now();
        const startOfToday = Date.parse(new Date(t).toISOString().slice(0, 10));
        const [site, accounts] = await Promise.all([deps.stats.summary(), deps.accounts.profileCounts([startOfToday, t - 7 * DAY])]);
        const o = deps.online();
        return {
          status: 200,
          json: {
            at: t,
            site,
            accounts: { total: accounts.total, today: accounts.since[0], last7: accounts.since[1] },
            online: { connections: o.connections, guests: o.guests, accounts: Math.max(0, o.connections - o.guests), rooms: o.rooms, playersInGames: o.playersInGames },
          },
        };
      },
    },
  ];
}
