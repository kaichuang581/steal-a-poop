import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { ChatService } from '../chat';
import { ChatFilter } from '../filter';
import { createHttpServer } from '../http';
import { ChildSafetyService, MemoryReportStore } from '../moderation/reporting';
import { MemoryAudit } from '../moderation/audit';
import { MemoryEconomyStore } from '../economy/store';
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
  const reporting = new ChildSafetyService({ store: new MemoryReportStore(), now: () => t });
  const economy = new MemoryEconomyStore();
  const audit = new MemoryAudit();
  (chat as any).deps.sink = reporting;
  server = createHttpServer({
    routes: createModerationRoutes({ chat, reporting, economy, audit, log: (l) => lines.push(l) }),
    verifyToken: async (tok) => (tok === 'mod' ? { userId: 'm1', name: 'Mo', chatAllowed: true, isModerator: true } : tok === 'user' ? { userId: 'u1', name: 'U', chatAllowed: true, isModerator: false } : tok === 'bad' ? { userId: 'bad', name: 'Bad', chatAllowed: true, isModerator: false } : null),
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
  return { chat, reporting, economy, audit, call, lines, tick: (ms: number) => (t += ms) };
}

describe('moderation routes', () => {
  it('GET /api/me/moderation shows a player only their own case', async () => {
    const { call } = await boot('escalate');
    expect((await call('GET', '/api/me/moderation')).status).toBe(401);
    const mine = await call('GET', '/api/me/moderation', 'bad');
    expect(mine.json).toMatchObject({ banned: false, openItems: 1, heldMessage: { text: 'you blorf' }, appeal: { state: 'none' } });
    expect(JSON.stringify(mine.json)).not.toMatch(/blorf".*term|opinion|unclear, looks like banter/);
    expect((await call('GET', '/api/me/moderation', 'user')).json).toMatchObject({ openItems: 0, heldMessage: null });
  });

  it('the queue reports how long the oldest open item has waited', async () => {
    const { call, tick } = await boot('escalate');
    tick(90_000);
    const q = await call('GET', '/api/mod/queue', 'mod');
    expect(q.json.oldestUnreviewed).toMatchObject({ ageMs: 90_000, status: 'human' });
  });

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

  it('a person confirms a child-safety report; ordinary items cannot be reported', async () => {
    const { chat, call, lines } = await boot();
    chat.submit({ userId: 'g', name: 'G', roomCode: 'R2', text: 'are you home alone' });
    const items = (await call('GET', '/api/mod/queue?status=all', 'mod')).json.items;
    const cs = items.find((i: any) => i.mustReport);
    const plain = items.find((i: any) => !i.mustReport);
    expect((await call('POST', `/api/mod/items/${plain.id}/report`, 'mod')).status).toBe(409);
    expect((await call('POST', `/api/mod/items/${cs.id}/report`, 'user')).status).toBe(403);
    const out = await call('POST', `/api/mod/items/${cs.id}/report`, 'mod');
    expect(out.json).toMatchObject({ status: 'dry_run', reporter: 'dry_run' });
    expect(lines.at(-1)).toContain('dry_run');
    expect(lines.at(-1)).not.toContain('home alone');
  });

  it('coin support: moderators can look up and adjust a balance once, with a reason, and it is logged', async () => {
    const { call, economy, audit } = await boot();
    await economy.apply({ userId: 'p1', delta: 100, reason: 'game_reward', ref: 'g', at: 1 });
    expect((await call('GET', '/api/mod/coins/p1', 'user')).status).toBe(403);
    expect((await call('GET', '/api/mod/coins/p1', 'mod')).json.balance).toBe(100);
    const post = (body: object, tok = 'mod') => call('POST', '/api/mod/coins/p1', tok, body);
    expect((await post({ delta: 50, note: 'refund for bug', requestId: 'req-0001' }, 'user')).status).toBe(403);
    expect((await post({ delta: 0, note: 'x', requestId: 'req-0002' })).json.error).toBe('bad_amount');
    expect((await post({ delta: 1.5, note: 'x', requestId: 'req-0003' })).json.error).toBe('bad_amount');
    expect((await post({ delta: 99999, note: 'x', requestId: 'req-0004' })).json.error).toBe('bad_amount');
    expect((await post({ delta: 10, requestId: 'req-0005' })).json.error).toBe('note_required');
    expect((await post({ delta: 10, note: 'x' })).json.error).toBe('request_id_required');
    expect((await post({ delta: 50, note: 'refund for bug', requestId: 'req-0006' })).json).toEqual({ balance: 150 });
    expect((await post({ delta: 50, note: 'refund for bug', requestId: 'req-0006' })).status).toBe(409); // a retry does not pay twice
    expect((await post({ delta: -500, note: 'remove', requestId: 'req-0007' })).json.error).toBe('insufficient'); // never below zero
    expect(await economy.balance('p1')).toBe(150);
    expect(audit.entries.filter((e) => e.action === 'coins_adjusted')).toEqual([expect.objectContaining({ actor: 'm1', userId: 'p1', details: { delta: 50, note: 'refund for bug' } })]);
  });
});
