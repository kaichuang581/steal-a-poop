import { describe, expect, it } from 'vitest';
import { createFeedbackRoutes } from './feedback';
import type { RouteRequest } from '../contracts';

const req = (body: unknown, ip = '1.1.1.1'): RouteRequest => ({ params: {}, query: {}, body, user: null, ip } as RouteRequest);
const make = (opts: { token?: string; status?: number } = {}) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return { ok: (opts.status ?? 201) < 300 } as Response; }) as unknown as typeof fetch;
  const [route] = createFeedbackRoutes({ token: 'token' in opts ? opts.token : 'secret', repo: 'o/r', fetchFn });
  return { route, calls };
};
const good = { kind: 'bug', title: 'The bomb is stuck', message: 'The bomb stayed on one sheep for ages.' };

describe('feedback route', () => {
  it('creates a labelled issue and never returns the token', async () => {
    const { route, calls } = make();
    const r = await route.handler(req(good));
    expect(r).toEqual({ status: 200, json: { ok: true } });
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/issues');
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.title).toBe('[bug] The bomb is stuck');
    expect(sent.labels).toEqual(['bug', 'from-game']);
    expect(JSON.stringify(r)).not.toContain('secret');
  });
  it('is unavailable without a token', async () => {
    const { route, calls } = make({ token: undefined });
    expect((await route.handler(req(good))).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
  it('rejects short or long text', async () => {
    const { route } = make();
    expect((await route.handler(req({ ...good, title: 'x' }))).status).toBe(400);
    expect((await route.handler(req({ ...good, message: 'short' }))).status).toBe(400);
    expect((await route.handler(req({ ...good, message: 'a'.repeat(1501) }))).status).toBe(400);
  });
  it('stops mentions and links from pinging or linking', async () => {
    const { route, calls } = make();
    await route.handler(req({ ...good, message: 'hello @someone see https://example.com now' }));
    const body = JSON.parse(String(calls[0].init.body)).body as string;
    expect(body).not.toContain('@someone');
    expect(body).not.toContain('https://');
  });
  it('limits one address to a few a hour', async () => {
    const { route } = make();
    for (let i = 0; i < 4; i++) expect((await route.handler(req(good))).status).toBe(200);
    expect((await route.handler(req(good))).status).toBe(429);
  });
  it('reports a GitHub failure as a gateway error', async () => {
    const { route } = make({ status: 500 });
    expect((await route.handler(req(good))).status).toBe(502);
  });
});
