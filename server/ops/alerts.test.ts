import { describe, expect, it, vi } from 'vitest';
import { AlertMonitor, DEFAULT_ALERTS, WebhookSender, evaluate } from './alerts';
import type { Sender, Snapshot } from './alerts';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  at: 0, connections: 10, maxConnections: 2000, rooms: 2, players: 8, memoryMb: 200, databaseOk: true, oldestModerationItemMs: null,
  oldestChildSafetyItemMs: null, moderationWriteFailures: 0, reviewer: null, ...over,
});
const reviewer = (over: Partial<NonNullable<Snapshot['reviewer']>> = {}) => ({ calls: 0, escalated: 0, capped: 0, failures: 0, tokensIn: 0, tokensOut: 0, estimatedCostUsd: 0, ...over });
const HOUR = 3600_000;

describe('evaluate', () => {
  it('says nothing when all is well', () => {
    expect(evaluate(snap(), null)).toEqual([]);
  });
  it('flags a moderation item that waited too long, and a child-safety item much sooner', () => {
    expect(evaluate(snap({ oldestModerationItemMs: HOUR }), null)).toEqual([]);
    expect(evaluate(snap({ oldestModerationItemMs: 3 * HOUR }), null).map((a) => a.key)).toEqual(['queue_stuck']);
    expect(evaluate(snap({ oldestChildSafetyItemMs: 20 * 60_000 }), null)).toEqual([]);
    const urgent = evaluate(snap({ oldestChildSafetyItemMs: 45 * 60_000 }), null);
    expect(urgent.map((a) => a.key)).toEqual(['child_safety_waiting']);
    expect(urgent[0].text).toMatch(/^URGENT/);
  });
  it('flags the database being down, but not one that is simply not configured', () => {
    expect(evaluate(snap({ databaseOk: false }), null).map((a) => a.key)).toEqual(['database_down']);
    expect(evaluate(snap({ databaseOk: null }), null)).toEqual([]);
  });
  it('flags new write failures and reviewer trouble only when the counters grew', () => {
    const before = snap({ moderationWriteFailures: 2, reviewer: reviewer({ capped: 1, failures: 3 }) });
    expect(evaluate(before, before)).toEqual([]);
    const after = snap({ moderationWriteFailures: 5, reviewer: reviewer({ capped: 2, failures: 9 }) });
    expect(evaluate(after, before).map((a) => a.key).sort()).toEqual(['reviewer_capped', 'reviewer_failing', 'write_failures']);
    expect(evaluate(snap({ moderationWriteFailures: 5 }), null)).toEqual([]); // the first snapshot has nothing to compare with
  });
  it('flags crowded connections and high memory', () => {
    expect(evaluate(snap({ connections: 1700 }), null).map((a) => a.key)).toEqual(['connections_high']);
    expect(evaluate(snap({ memoryMb: 450 }), null).map((a) => a.key)).toEqual(['memory_high']);
  });
  it('never puts a player\'s name, id or message in a text', () => {
    const all = evaluate(snap({ oldestChildSafetyItemMs: HOUR, oldestModerationItemMs: 9 * HOUR, databaseOk: false, connections: 2000, memoryMb: 999 }), snap());
    expect(all.length).toBeGreaterThan(4);
    expect(JSON.stringify(all)).not.toMatch(/@|user|dev:|https?:/i);
  });
});

describe('AlertMonitor', () => {
  const make = (snaps: Snapshot[], cooldownMs = 30 * 60_000) => {
    const sent: string[] = [];
    let now = 0;
    let i = 0;
    const sender: Sender = { send: async (t) => void sent.push(t) };
    const m = new AlertMonitor({ snapshot: async () => snaps[Math.min(i++, snaps.length - 1)], sender, cfg: DEFAULT_ALERTS, cooldownMs, now: () => now });
    return { m, sent, advance: (ms: number) => (now += ms) };
  };

  it('sends a new alert once, repeats it only after the cooldown, and says when it clears', async () => {
    const bad = snap({ databaseOk: false });
    const { m, sent, advance } = make([bad, bad, bad, snap()]);
    await m.tick();
    advance(60_000);
    await m.tick();
    expect(sent).toHaveLength(1);
    advance(31 * 60_000);
    await m.tick();
    expect(sent).toHaveLength(2); // still down after the cooldown: a reminder
    advance(60_000);
    await m.tick();
    expect(sent.at(-1)).toMatch(/Cleared: database down/);
  });

  it('sends several different alerts separately', async () => {
    const { m, sent } = make([snap({ databaseOk: false, memoryMb: 999 })]);
    await m.tick();
    expect(sent).toHaveLength(2);
  });

  it('a webhook that fails is counted and never breaks the check', async () => {
    const m = new AlertMonitor({ snapshot: async () => snap({ databaseOk: false }), sender: { send: async () => { throw new Error('down'); } } });
    await expect(m.tick()).resolves.toHaveLength(1);
    expect(m.failures).toBe(1);
  });
});

describe('WebhookSender', () => {
  it('posts the text in the fields Slack and Discord read', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    await new WebhookSender({ url: 'https://hooks.example/abc', fetchImpl: f as unknown as typeof fetch }).send('hello');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.example/abc');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hello', content: 'hello' });
  });
  it('reports a rejected post', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    await expect(new WebhookSender({ url: 'https://x', fetchImpl: f as unknown as typeof fetch }).send('hi')).rejects.toThrow('500');
  });
  it('gives up on a webhook that never answers', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))));
    await expect(new WebhookSender({ url: 'https://x', fetchImpl: f as unknown as typeof fetch, timeoutMs: 20 }).send('hi')).rejects.toThrow();
  });
});
