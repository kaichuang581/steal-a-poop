import { describe, expect, it } from 'vitest';
import type { AuthUser, Route, RouteRequest } from '../contracts';
import { GuestFriends } from '../social/guestFriends';
import { createGuestFriendRoutes } from './guestFriends';

const guest = (n: number): AuthUser => ({ userId: `guest:0000000${n}-0000-4000-8000-00000000000${n}`, name: `G${n}`, chatAllowed: true, isModerator: false });
const account: AuthUser = { userId: 'u1', name: 'Acc', chatAllowed: true, isModerator: false };

function setup(online: AuthUser[] = []) {
  const friends = new GuestFriends({ secret: 's' });
  const routes = createGuestFriendRoutes({ friends, online: () => online });
  const call = async (user: AuthUser | null, method: string, path: string, body?: unknown, ip = '1.1.1.1') => {
    const r = routes.find((x: Route) => x.method === method && x.path === path)!;
    return r.handler({ params: {}, query: {}, body: body ?? null, user, session: null, ip } satisfies RouteRequest);
  };
  return { friends, call };
}

describe('guest friend routes', () => {
  it('are open to guests on the signed-in lane, and are marked for guests', () => {
    const { friends } = setup();
    const routes = createGuestFriendRoutes({ friends, online: () => [] });
    expect(routes.every((r) => r.auth === 'user' && r.guests === true)).toBe(true);
  });

  it('turn away a real account', async () => {
    const { call } = setup();
    expect((await call(account, 'GET', '/api/guest/friends')).status).toBe(403);
  });

  it('carry a request from one guest to another and back', async () => {
    const { friends, call } = setup();
    const [g1, g2] = [guest(1), guest(2)];
    const code2 = friends.codeFor(g2.userId);
    expect((await call(g1, 'POST', '/api/guest/friends/request', { code: code2 })).json).toEqual({ state: 'sent' });
    const inbox = (await call(g2, 'GET', '/api/guest/friends')).json as { requests: Array<{ code: string; name: string }> };
    expect(inbox.requests).toEqual([{ code: friends.codeFor(g1.userId), name: 'G1' }]);
    const accepted = await call(g2, 'POST', '/api/guest/friends/accept', { code: inbox.requests[0].code });
    expect(accepted.json).toEqual({ friend: { code: friends.codeFor(g1.userId), name: 'G1' } });
    const news = (await call(g1, 'GET', '/api/guest/friends')).json as { events: Array<{ kind: string }> };
    expect(news.events.map((e) => e.kind)).toEqual(['accepted']);
  });

  it('reject a bad code and an unknown request', async () => {
    const { call } = setup();
    expect((await call(guest(1), 'POST', '/api/guest/friends/request', { code: 'nope' })).status).toBe(400);
    expect((await call(guest(1), 'POST', '/api/guest/friends/accept', { code: 'ABCDEFGHJK' })).status).toBe(404);
  });

  it('limit how many requests one guest, and one address, can send', async () => {
    const { friends, call } = setup();
    const target = friends.codeFor(guest(9).userId);
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call(guest(1), 'POST', '/api/guest/friends/request', { code: target })).status;
    expect(last).toBe(429);
  });

  it('report who is online', async () => {
    const g2 = guest(2);
    const { friends, call } = setup([g2]);
    const code2 = friends.codeFor(g2.userId);
    const r = await call(guest(1), 'POST', '/api/guest/friends/status', { codes: [code2] });
    expect(r.json).toEqual({ friends: [{ code: code2, online: true, name: 'G2' }] });
  });
});
