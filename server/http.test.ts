import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AuthUser, Route } from './contracts';
import { createHttpServer } from './http';

const users: Record<string, AuthUser> = {
  user: { userId: 'u1', name: 'User', chatAllowed: true, isModerator: false },
  mod: { userId: 'm1', name: 'Mod', chatAllowed: true, isModerator: true },
};
const routes: Route[] = [
  { method: 'GET', path: '/api/open', auth: 'none', handler: () => ({ status: 200, json: { hello: 'world' } }) },
  { method: 'GET', path: '/api/me', auth: 'user', handler: (r) => ({ status: 200, json: { id: r.user!.userId } }) },
  { method: 'GET', path: '/api/mod', auth: 'moderator', handler: () => ({ status: 200, json: { secret: true } }) },
  { method: 'GET', path: '/api/things/:id', auth: 'none', handler: (r) => ({ status: 200, json: { id: r.params.id, q: r.query.q ?? null } }) },
  { method: 'POST', path: '/api/echo', auth: 'none', handler: (r) => ({ status: 200, json: { got: r.body } }) },
  { method: 'GET', path: '/api/boom', auth: 'none', handler: () => { throw new Error('secret internal detail'); } },
];

const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
});
async function boot(allowedOrigins: string[] = []) {
  const server = createHttpServer({
    routes, allowedOrigins, maxBodyBytes: 100,
    verifyToken: async (t) => users[t] ?? null,
  });
  await new Promise<void>((r) => server.listen(0, r));
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return (path: string, init?: RequestInit & { token?: string }) =>
    fetch(base + path, { ...init, headers: { ...(init?.headers ?? {}), ...(init?.token ? { authorization: `Bearer ${init.token}` } : {}) } });
}

describe('http server', () => {
  it('answers the health check', async () => {
    const f = await boot();
    const r = await f('/healthz');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
  it('routes by method and path, with params and query', async () => {
    const f = await boot();
    expect(await (await f('/api/things/abc%20d?q=1')).json()).toEqual({ id: 'abc d', q: '1' });
    expect((await f('/api/nope')).status).toBe(404);
    expect((await f('/api/open', { method: 'DELETE' })).status).toBe(405);
  });
  it('requires sign-in for user routes and a moderator for moderator routes', async () => {
    const f = await boot();
    expect((await f('/api/me')).status).toBe(401);
    expect((await f('/api/me', { token: 'forged' })).status).toBe(401);
    expect(await (await f('/api/me', { token: 'user' })).json()).toEqual({ id: 'u1' });
    expect((await f('/api/mod', { token: 'user' })).status).toBe(403);
    expect((await f('/api/mod', { token: 'mod' })).status).toBe(200);
  });
  it('reads JSON bodies, and refuses bad or oversized ones', async () => {
    const f = await boot();
    const post = (body: string) => f('/api/echo', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    expect(await (await post('{"a":1}')).json()).toEqual({ got: { a: 1 } });
    expect((await post('{nope')).status).toBe(400);
    expect((await post(JSON.stringify({ big: 'x'.repeat(500) }))).status).toBe(413);
  });
  it('never leaks the text of an internal error', async () => {
    const f = await boot();
    const r = await f('/api/boom');
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('secret internal detail');
  });
  it('only lets listed origins call it from a browser', async () => {
    const f = await boot(['https://good.example']);
    const ok = await f('/api/open', { headers: { origin: 'https://good.example' } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://good.example');
    expect((await f('/api/open', { headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await f('/api/open')).status).toBe(200); // no Origin header: not a browser, so not a cross-site call
    expect((await f('/api/open', { method: 'OPTIONS', headers: { origin: 'https://good.example' } })).status).toBe(204);
  });
});
