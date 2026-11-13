import type { Route } from '../contracts';
import { isGuestId } from '../guest';
import { RateLimiter } from '../ratelimit';
import type { GuestFriends, GuestRef } from '../social/guestFriends';

const bad = (error: string, status = 400) => ({ status, json: { error } });

/** Friends for guests: swap codes, ask, answer, and see who is online. The list itself is kept in each guest's browser. */
export function createGuestFriendRoutes(deps: { friends: GuestFriends; online: () => readonly GuestRef[]; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const asking = new RateLimiter(20, 24 * 3600_000); // per guest
  const askingFromHere = new RateLimiter(60, 24 * 3600_000); // per address: a fresh guest id costs nothing
  const reading = new RateLimiter(60, 60_000);
  const writing = new RateLimiter(60, 60_000);
  const me = (req: { user: { userId: string; name: string } | null }): GuestRef | null => (req.user && isGuestId(req.user.userId) ? { userId: req.user.userId, name: req.user.name } : null);
  const route = (method: 'GET' | 'POST', path: string, handler: Route['handler']): Route => ({ method, path, auth: 'user', guests: true, handler });
  const codeOf = (body: unknown) => (body as { code?: unknown } | null)?.code;

  return [
    route('GET', '/api/guest/friends', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!reading.allow(g.userId, now())) return bad('rate_limited', 429);
      return { status: 200, json: deps.friends.inbox(g.userId) };
    }),
    route('POST', '/api/guest/friends/request', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!asking.allow(g.userId, now()) || !askingFromHere.allow(`ip:${req.ip}`, now())) return bad('rate_limited', 429);
      const r = deps.friends.request(g, codeOf(req.body));
      if (r.ok) return { status: 200, json: r.state === 'accepted' ? { state: 'accepted', friend: r.friend } : { state: 'sent' } };
      return bad(r.reason, r.reason === 'limit' ? 429 : 400);
    }),
    route('POST', '/api/guest/friends/accept', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!writing.allow(g.userId, now())) return bad('rate_limited', 429);
      const friend = deps.friends.accept(g, codeOf(req.body));
      return friend ? { status: 200, json: { friend } } : bad('not_found', 404);
    }),
    route('POST', '/api/guest/friends/decline', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!writing.allow(g.userId, now())) return bad('rate_limited', 429);
      deps.friends.decline(g.userId, codeOf(req.body));
      return { status: 200, json: { ok: true } };
    }),
    route('POST', '/api/guest/friends/remove', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!writing.allow(g.userId, now())) return bad('rate_limited', 429);
      deps.friends.remove(g, codeOf(req.body));
      return { status: 200, json: { ok: true } };
    }),
    route('POST', '/api/guest/friends/status', (req) => {
      const g = me(req);
      if (!g) return bad('guest_only', 403);
      if (!reading.allow(g.userId, now())) return bad('rate_limited', 429);
      return { status: 200, json: { friends: deps.friends.status((req.body as { codes?: unknown } | null)?.codes, deps.online()) } };
    }),
  ];
}
