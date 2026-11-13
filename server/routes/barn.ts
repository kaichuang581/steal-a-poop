import type { Route } from '../contracts';
import type { BarnService } from '../barn/service';
import { readGameId, readReward } from '../barn/service';
import { RateLimiter } from '../ratelimit';
import { isSackId } from '../../src/skin/shop/sacks';

const bad = (error: string, status = 400) => ({ status, json: { error } });

/**
 * The Trading Post's wallet for signed-in players (Wool Coins, XP, cosmetics). Nothing here takes money. Every route needs
 * a signed-in player with a profile. Wool Coins open Feed Sacks (rolled here); Golden Bells buy the Bell Shelf.
 */
export function createBarnRoutes(deps: { barn: BarnService; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const read = new RateLimiter(60, 60_000);
  const write = new RateLimiter(30, 60_000);
  const claims = new RateLimiter(20, 60_000);
  const body = (b: unknown) => (b && typeof b === 'object' ? (b as Record<string, unknown>) : {});
  const ok = (json: object) => ({ status: 200, json });
  return [
    {
      method: 'GET', path: '/api/barn', auth: 'user',
      handler: async (req) => (read.allow(req.user!.userId, now()) ? ok(await deps.barn.wallet(req.user!.userId)) : bad('rate_limited', 429)),
    },
    {
      // The profile's board: the top 100 players by XP, and where the asker stands. No account ids in it.
      method: 'GET', path: '/api/barn/top', auth: 'user',
      handler: async (req) => (read.allow(req.user!.userId, now()) ? ok(await deps.barn.board(req.user!.userId)) : bad('rate_limited', 429)),
    },
    {
      method: 'POST', path: '/api/barn/claim', auth: 'user',
      handler: async (req) => {
        if (!claims.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const b = body(req.body);
        const id = readGameId(b.gameId), reward = readReward(b.reward);
        if (!id || !reward) return bad('bad_request');
        return ok(await deps.barn.claim(req.user!.userId, id, reward));
      },
    },
    {
      // The Bell Shelf: Golden Bells only, at the catalogue's price.
      method: 'POST', path: '/api/barn/buy', auth: 'user',
      handler: async (req) => {
        if (!write.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const itemId = body(req.body).itemId;
        if (typeof itemId !== 'string' || itemId.length > 60) return bad('bad_request');
        const r = await deps.barn.buy(req.user!.userId, itemId);
        return r.ok ? ok({ wallet: r.wallet }) : bad(r.reason, r.reason === 'unknown' ? 404 : 409);
      },
    },
    {
      // One sack, Wool Coins only, rolled here. The body names which sack (bomb, blast or tick) and nothing else counts:
      // nothing the browser sends picks the result.
      method: 'POST', path: '/api/barn/sack', auth: 'user',
      handler: async (req) => {
        if (!write.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const sack = body(req.body).sack;
        if (!isSackId(sack)) return bad('bad_request');
        const r = await deps.barn.openSack(req.user!.userId, sack);
        return r.ok ? ok({ wallet: r.wallet, entry: r.entry }) : bad(r.reason, 409);
      },
    },
    {
      method: 'POST', path: '/api/barn/equip', auth: 'user',
      handler: async (req) => {
        if (!write.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const itemId = body(req.body).itemId;
        if (typeof itemId !== 'string' || itemId.length > 60) return bad('bad_request');
        const r = await deps.barn.equip(req.user!.userId, itemId);
        return r.ok ? ok({ wallet: r.wallet }) : bad(r.reason, 403);
      },
    },
    {
      method: 'POST', path: '/api/barn/streak', auth: 'user',
      handler: async (req) => {
        if (!write.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const best = body(req.body).best;
        if (typeof best !== 'number' || !Number.isFinite(best)) return bad('bad_request');
        return ok(await deps.barn.streak(req.user!.userId, best));
      },
    },
    {
      method: 'POST', path: '/api/barn/import', auth: 'user',
      handler: async (req) => {
        if (!write.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const raw = JSON.stringify(body(req.body).wallet ?? null);
        if (raw.length > 400_000) return bad('too_large', 413);
        return ok(await deps.barn.importLocal(req.user!.userId, body(req.body).wallet));
      },
    },
  ];
}
