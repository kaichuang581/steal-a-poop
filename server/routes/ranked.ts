import type { Route } from '../contracts';
import type { RankedService } from '../ranked/service';
import { RateLimiter } from '../ratelimit';
import { limitKey } from '../address';

/**
 * Ranked play, for signed-in players (a guest has no rating: the server refuses guests on these routes by default),
 * and the ladder's top for anyone. Reading only: a rating changes in one place, when the server finishes a ranked
 * game it ran itself.
 */
export function createRankedRoutes(deps: { ranked: RankedService; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const read = new RateLimiter(60, 60_000);
  const byIp = new RateLimiter(60, 60_000);
  const limited = { status: 429, json: { error: 'rate_limited' } };
  return [
    {
      // Your own rating, games and wins.
      method: 'GET', path: '/api/ranked', auth: 'user',
      handler: async (req) => (read.allow(req.user!.userId, now()) ? { status: 200, json: await deps.ranked.me(req.user!.userId) } : limited),
    },
    {
      // The top 100 by rating, and your place. No account ids in it.
      method: 'GET', path: '/api/ranked/top', auth: 'user',
      handler: async (req) => (read.allow(req.user!.userId, now()) ? { status: 200, json: await deps.ranked.boardFor(req.user!.userId) } : limited),
    },
    {
      // The same list for the leaderboards page, signed in or not: names and ratings, nobody's own place. Public like
      // the game leaderboards, and it names only the players those would (the service's own rule). The list is the
      // service's one-a-minute copy, so asking often costs no query.
      method: 'GET', path: '/api/ranked/board', auth: 'none',
      handler: async (req) => (byIp.allow(limitKey(req.ip), now()) ? { status: 200, json: await deps.ranked.boardFor('') } : limited),
    },
  ];
}
