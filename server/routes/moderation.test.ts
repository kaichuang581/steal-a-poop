import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatService } from '../chat';
import { ChatFilter } from '../filter';
import { createHttpServer } from '../http';
import { createModerationRoutes } from './moderation';

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function boot(reviewVerdict?: 'escalate') {
  let t = 1_000_000;
  const chat = new ChatService({
    now: () => t,
    filter: new ChatFilter({ blocklist: ['blorf'], isWord: () => false }),
    reviewer: reviewVerdict ? { review: async () => ({ verdict: 'escalate', reason: 'unclear, looks like banter' }) } : undefined,
  });
  const lines: string[] = [];
  server = createHttpServer({
    routes: createModerationRoutes({ chat, log: (l) => lines.push(l) }),
    verifyToken: async (tok) => (tok === 'mod' ? { userId: 'm1', name: 'Mo', chatAllowed: true, isModerator: true } : tok === 'user' ? { userId: 'u1', name: 'U', chatAllowed: true, isModerator: false } : null),
  });
  await new Promise<void>((r) => server!.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  chat.submit({ userId: 'bad', name: 'Bad', roomCode: 'R1', text: 'hello' });
  chat.submit({ userId: 'bad', name: 'Bad', roomCode: 'R1', text: 'you blorf' });
  await chat.processReviews();
  return { chat, call, lines, tick: (ms: number) => (t += ms) };
}

describe('moderation routes', () => {
  it('require a moderator', async () => {
    const { call } = await boot();
    expect((await call('GET', '/api/mod/queue')).status).toBe(401);
    expect((await call('GET', '/api/mod/queue', 'user')).status).toBe(403);
    expect((await call('GET', '/api/mod/queue', 'mod')).status).toBe(200);
  });

  it('lists the queue, oldest first, and one item with context, opinion and standing', async () => {
    const { call } = await boot('escalate');
    const q = await call('GET', '/api/mod/queue', 'mod');
    expect(q.json.items).toHaveLength(1);
    const id = q.json.items[0].id;
    const one = await call('GET', `/api/mod/items/${id}`, 'mod');
    expect(one.json.item.text).toBe('you blorf');
    expect(one.json.item.context.map((m: any) => m.text)).toEqual(['hello']);
    expect(one.json.item.opinion).toEqual({ verdict: 'escalate', reason: 'unclear, looks like banter' });
    expect(one.json.standing.suspendedUntil).not.toBeNull();
    expect((await call('GET', '/api/mod/items/999', 'mod')).status).toBe(404);
  });

  it('resolving clears or bans, records who and when, and cannot be done twice', async () => {
    const { call, chat, lines } = await boot('escalate');
    const id = (await call('GET', '/api/mod/queue', 'mod')).json.items[0].id;
    expect((await call('POST', `/api/mod/items/${id}/resolve`, 'mod', { verdict: 'clear' })).json.error).toBe('reason_required');
    expect((await call('POST', `/api/mod/items/${id}/resolve`, 'mod', { verdict: 'escalate', reason: 'x' })).json.error).toBe('bad_verdict');
    const ok = await call('POST', `/api/mod/items/${id}/resolve`, 'mod', { verdict: 'ban', reason: 'slur, not banter' });
    expect(ok.status).toBe(200);
    const item = chat.getItem(id)!;
    expect(item).toMatchObject({ status: 'reviewed', verdict: 'ban', decidedBy: 'm1', reason: 'slur, not banter' });
    expect(item.decidedAt).toBeGreaterThan(0);
    expect(chat.state('bad').banned).toBe(true);
    expect((await call('POST', `/api/mod/items/${id}/resolve`, 'mod', { verdict: 'clear', reason: 'again' })).status).toBe(409);
    expect(lines).toEqual([`[moderation] item ${id} -> ban by m1`]);
    expect(lines.join()).not.toContain('blorf');
  });

  it('clearing lifts the suspension', async () => {
    const { call, chat } = await boot('escalate');
    const id = (await call('GET', '/api/mod/queue', 'mod')).json.items[0].id;
    await call('POST', `/api/mod/items/${id}/resolve`, 'mod', { verdict: 'clear', reason: 'banter' });
    expect(chat.state('bad').suspendedUntil).toBeNull();
    expect((await call('GET', '/api/mod/users/bad', 'mod')).json.banned).toBe(false);
  });
});
