import type { Page, Route } from '@playwright/test';

// Shared fakes for the tests that run the app built with real sign-in on (served on port 4174). Everything the app would send to
// Supabase, Cloudflare or the game server is answered here, so those tests check the SCREENS and what they send. They do not talk to
// the real services, and passing them says nothing about a real sign-in working.
export const SB = 'http://127.0.0.1:8790';
export const API = 'http://127.0.0.1:8788';
export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
export const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

export const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
export const fakeJwt = () => `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600, session_id: 's1' })}.sig`;

export interface Seen { url: string; method: string; auth?: string; body?: any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function fakeBackends(page: Page, opts: { profile?: object | null; parentMailed?: boolean; consent?: object } = {}) {
  const seen: Seen[] = [];
  let profile: object | null = opts.profile ?? null;
  await page.route('https://challenges.cloudflare.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('cf-test-token')},10);return 'w1'},remove:function(){}};" }));
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    seen.push({ url: url.pathname + url.search, method: req.method(), body });
    if (url.pathname.endsWith('/signup')) return json(route, { id: 'u1', email: body.email, aud: 'authenticated' }); // no session: email not confirmed yet
    if (url.pathname.endsWith('/token')) {
      return json(route, { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: { id: 'u1', email: body.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith('/recover')) return json(route, {});
    return json(route, {});
  });
  await page.route(`${API}/api/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    seen.push({ url: path, method: req.method(), auth: req.headers().authorization, body });
    if (path === '/api/account/me') return json(route, { profile });
    if (path === '/api/account/profile') {
      profile = { nickname: body.nickname, country: body.country, consentStatus: body.parentEmail ? 'pending' : 'not_required', createdAt: 1 };
      return json(route, { profile, parentMailed: opts.parentMailed ?? true }, 201);
    }
    if (path === '/api/account/username') {
      profile = { nickname: body.nickname, country: null, consentStatus: 'unconfirmed', createdAt: 1 };
      return json(route, { profile }, 201);
    }
    if (path.startsWith('/api/consent/manage/')) return json(route, { state: 'withdrawn' });
    if (path.startsWith('/api/consent/')) {
      if (req.method() === 'GET') return opts.consent ? json(route, opts.consent) : json(route, { error: 'not_found' }, 404);
      return json(route, { state: body.decision === 'grant' ? 'granted' : 'refused' });
    }
    return json(route, { ok: true });
  });
  return seen;
}


export interface CommunityState {
  balance: number;
  friends: { userId: string; name: string; online: boolean; cosmetics?: object }[];
  incoming: { userId: string; name: string; online: boolean }[];
  owned: Set<string>;
  worn: Record<string, string>;
  visible: boolean;
}

const ITEMS = [
  { id: 'color-mint', slot: 'color', name: 'Mint name', price: 100, value: '#6ee7b7' },
  { id: 'color-gold', slot: 'color', name: 'Gold name', price: 150, value: '#fbbf24' },
  { id: 'badge-fire', slot: 'badge', name: 'Fire', price: 50, value: '🔥' },
  { id: 'title-thief', slot: 'title', name: 'The Thief', price: 200, value: 'the Thief' },
  { id: 'theme-night', slot: 'theme', name: 'Night table', price: 250, value: '#12163a' },
];

/** The friends, boards, shop and wallet endpoints, with a little memory so buying and accepting change what the next call returns. */
export async function fakeCommunity(page: Page, st: CommunityState) {
  const seen: Seen[] = [];
  await page.route(`${API}/api/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const path = url.pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    seen.push({ url: path + url.search, method: req.method(), auth: req.headers().authorization, body });
    const shopView = () => ({ balance: st.balance, items: ITEMS.map((i) => ({ ...i, owned: st.owned.has(i.id), equipped: st.worn[i.slot] === i.id })) });
    if (path === '/api/account/me') return json(route, { profile: { nickname: 'Ana', country: 'CA', consentStatus: 'not_required', leaderboardVisible: st.visible, createdAt: 1 } });
    if (path === '/api/wallet') return json(route, { balance: st.balance, history: [] });
    if (path === '/api/friends') return json(route, { friends: st.friends, incoming: st.incoming, outgoing: [] });
    if (path === '/api/friends/code') return json(route, { code: 'ABCD2345' });
    if (path === '/api/friends/code/reset') return json(route, { code: 'ZZZZ9999' });
    if (path === '/api/friends/request') return body.code === 'NOSUCH22' ? json(route, { error: 'unknown_code' }, 404) : json(route, { state: 'sent' });
    const acc = /^\/api\/friends\/(.+)\/accept$/.exec(path);
    if (acc) {
      const f = st.incoming.find((x) => x.userId === decodeURIComponent(acc[1]));
      if (f) {
        st.incoming = st.incoming.filter((x) => x !== f);
        st.friends.push(f);
      }
      return json(route, { ok: true });
    }
    const rem = /^\/api\/friends\/(.+)\/remove$/.exec(path);
    if (rem) {
      const id = decodeURIComponent(rem[1]);
      st.friends = st.friends.filter((x) => x.userId !== id);
      st.incoming = st.incoming.filter((x) => x.userId !== id);
      return json(route, { ok: true });
    }
    if (path === '/api/daily/today') return json(route, { date: '2026-11-04', rows: [{ rank: 1, name: 'Ben', banked: 95, steals: 2, longestWord: 'zebra' }, { rank: 2, name: 'Ana', banked: 80, steals: 1, longestWord: 'quiz' }] });
    if (path.startsWith('/api/leaderboard/')) return json(route, { period: path.split('/').pop(), metric: url.searchParams.get('metric'), rows: [{ rank: 1, userId: 'u9', name: 'Cy', value: 12, games: 20, cosmetics: { badge: '👑' } }] });
    if (path === '/api/me/stats') return json(route, { gamesPlayed: 7, wins: 3, points: 410, bestScore: 88, steals: 9, longestWord: 'zebra', dailyPlayed: 2 });
    if (path === '/api/me/settings') {
      st.visible = body.leaderboardVisible;
      return json(route, { leaderboardVisible: st.visible });
    }
    if (path === '/api/shop') return json(route, shopView());
    if (path === '/api/shop/buy') {
      const item = ITEMS.find((i) => i.id === body.itemId)!;
      if (st.balance < item.price) return json(route, { error: 'insufficient' }, 409);
      st.balance -= item.price;
      st.owned.add(item.id);
      return json(route, { balance: st.balance });
    }
    if (path === '/api/shop/equip') {
      if (body.itemId) st.worn[body.slot] = body.itemId;
      else delete st.worn[body.slot];
      return json(route, { ok: true });
    }
    return json(route, { ok: true });
  });
  return seen;
}

/**
 * Stands in for the game server's WebSocket. Replies to the sign-in like the real one, and lets the test push messages
 * (an invitation, a reward, a room) and see what the app sent.
 */
export async function fakeGameServer(page: Page) {
  const received: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let push: (m: object) => void = () => undefined;
  await page.routeWebSocket('ws://127.0.0.1:8788/', (ws) => {
    push = (m) => ws.send(JSON.stringify(m));
    ws.onMessage((raw) => {
      const m = JSON.parse(String(raw));
      received.push(m);
      if (m.t === 'hello') {
        push({ t: 'welcome', userId: 'u1', name: 'Ana', serverNow: Date.now(), chat: { banned: false, suspendedUntil: null }, moderation: { banned: false, suspendedUntil: null, openItems: 0, waitingSince: null, heldMessage: null, appeal: { state: 'none' }, lastDecision: null } });
      }
      if (m.t === 'rooms') push({ t: 'rooms', list: [], serverNow: Date.now() });
    });
  });
  return { received, push: (m: object) => push(m) };
}
