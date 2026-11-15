import type { Route } from '../contracts';
import type { FriendsService } from '../social/friends';
import { RateLimiter } from '../ratelimit';

export const routes: Route[] = [];

const bad = (error: string, status = 400) => ({ status, json: { error } });

/** Friends: your code, requests, the list. Only players who may chat can use them. */
export function createFriendRoutes(deps: { friends: FriendsService; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const requestLimit = new RateLimiter(20, 24 * 3600_000); // asking is limited more tightly than looking
  const wrongCodes = new RateLimiter(10, 3600_000); // a stream of wrong codes looks like guessing
  const readLimit = new RateLimiter(60, 60_000);
  const writeLimit = new RateLimiter(60, 60_000);
  return [
    {
      method: 'GET', path: '/api/friends', auth: 'user',
      handler: async (req) => {
        if (!readLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const out = await deps.friends.list(req.user!.userId);
        return out ? { status: 200, json: out } : bad('not_allowed', 403);
      },
    },
    {
      method: 'GET', path: '/api/friends/code', auth: 'user',
      handler: async (req) => {
        const code = await deps.friends.myCode(req.user!.userId);
        return code ? { status: 200, json: { code } } : bad('not_allowed', 403);
      },
    },
    {
      method: 'POST', path: '/api/friends/code/reset', auth: 'user',
      handler: async (req) => {
        if (!writeLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const code = await deps.friends.resetCode(req.user!.userId);
        return code ? { status: 200, json: { code } } : bad('not_allowed', 403);
      },
    },
    {
      method: 'POST', path: '/api/friends/request', auth: 'user',
      handler: async (req) => {
        const me = req.user!.userId;
        if (!requestLimit.allow(me, now())) return bad('rate_limited', 429);
        const code = (req.body as { code?: unknown } | null)?.code;
        if (typeof code !== 'string' || code.length > 40) return bad('bad_request');
        const r = await deps.friends.request(me, code);
        if (r.ok) return { status: 200, json: { state: r.state } };
        if (r.reason === 'unknown_code' && !wrongCodes.allow(me, now())) return bad('rate_limited', 429);
        return bad(r.reason, r.reason === 'not_allowed' ? 403 : r.reason === 'unknown_code' ? 404 : 409);
      },
    },
    {
      method: 'POST', path: '/api/friends/:id/accept', auth: 'user',
      handler: async (req) => {
        if (!writeLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        return (await deps.friends.accept(req.user!.userId, req.params.id)) ? { status: 200, json: { ok: true } } : bad('not_found', 404);
      },
    },
    {
      // Decline a request, cancel your own, or end a friendship.
      method: 'POST', path: '/api/friends/:id/remove', auth: 'user',
      handler: async (req) => {
        if (!writeLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        await deps.friends.remove(req.user!.userId, req.params.id);
        return { status: 200, json: { ok: true } };
      },
    },
  ];
}
