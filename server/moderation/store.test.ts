import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatService } from '../chat';
import type { ReviewItem, Verdict } from '../chat';
import { ChatFilter } from '../filter';
import { PostgresStore } from './postgres';
import { MemoryStore } from './store';
import type { ModerationStore } from './store';

const filter = new ChatFilter({ blocklist: ['blorf'], isWord: () => false });
const MIGRATION = readFileSync('db/migrations/200_moderation.sql', 'utf8');

function service(store: ModerationStore | undefined, extra: { reviewer?: { review: () => Promise<{ verdict: Verdict; reason: string }> }; onPersistError?: (e: unknown) => void } = {}) {
  let t = 5_000_000;
  const svc = new ChatService({ now: () => t, filter, store, ...extra });
  return { svc, advance: (ms: number) => (t += ms) };
}
const say = (svc: ChatService, userId: string, text: string, roomCode = 'ROOM1') => svc.submit({ userId, name: userId, roomCode, text });

/** The same behaviour must hold for every store, so these run against each. */
function behaves(name: string, make: () => Promise<ModerationStore>) {
  describe(`ChatService with ${name}`, () => {
    let store: ModerationStore;
    beforeEach(async () => {
      store = await make();
    });

    it('restores a suspension and the review queue after a restart', async () => {
      const a = service(store);
      say(a.svc, 'x', 'hello there');
      say(a.svc, 'a', 'you blorf');
      await a.svc.flush();

      const b = service(store); // a fresh process
      await b.svc.load();
      expect(b.svc.state('a').suspendedUntil).not.toBeNull();
      expect(say(b.svc, 'a', 'sorry')).toMatchObject({ delivered: false, reason: 'suspended' });
      expect(b.svc.queue()).toHaveLength(1);
      expect(b.svc.queue()[0]).toMatchObject({ userId: 'a', category: 'blocked_word', term: 'blorf', status: 'pending' });
    });

    it('restores a ban, and a reviewer decision', async () => {
      const a = service(store, { reviewer: { review: async () => ({ verdict: 'ban', reason: 'serious' }) } });
      say(a.svc, 'a', 'blorf');
      await a.svc.processReviews();
      await a.svc.flush();

      const b = service(store);
      await b.svc.load();
      expect(b.svc.state('a').banned).toBe(true);
      expect(b.svc.queue()[0]).toMatchObject({ status: 'reviewed', verdict: 'ban', reason: 'serious' });
    });

    it('forgets a suspension that has run out, but keeps the item', async () => {
      const a = service(store);
      say(a.svc, 'a', 'blorf');
      await a.svc.flush();
      const b = service(store);
      b.advance(48 * 60 * 60 * 1000);
      await b.svc.load();
      expect(b.svc.state('a').suspendedUntil).toBeNull();
      expect(b.svc.queue()).toHaveLength(1);
    });

    it('keeps numbering items after a restart, without reusing an id', async () => {
      const a = service(store);
      say(a.svc, 'a', 'blorf');
      say(a.svc, 'b', 'blorf');
      await a.svc.flush();
      const b = service(store);
      await b.svc.load();
      say(b.svc, 'c', 'blorf');
      await b.svc.flush();
      const c = service(store);
      await c.svc.load();
      expect(c.svc.queue().map((i) => i.id)).toEqual([1, 2, 3]);
    });

    it('saves the 20 messages before a held message as context', async () => {
      const a = service(store);
      for (let i = 0; i < 25; i++) {
        a.advance(3000); // stays under the chat rate limit
        say(a.svc, `u${i % 3}`, `message ${i}`);
      }
      a.advance(3000);
      say(a.svc, 'bad', 'you blorf');
      await a.svc.flush();
      const b = service(store);
      await b.svc.load();
      const ctx = b.svc.queue()[0].context!;
      expect(ctx).toHaveLength(20);
      expect(ctx[0].text).toBe('message 5');
      expect(ctx[19].text).toBe('message 24');
    });

    it('a player report and an appeal are stored too', async () => {
      const a = service(store);
      const m = say(a.svc, 'a', 'hello');
      if (!m.delivered) throw new Error('setup');
      a.svc.report({ reporterId: 'b', messageId: m.message.id, roomCode: 'ROOM1' });
      say(a.svc, 'bad', 'blorf');
      a.svc.appeal('bad', 'it was a mistake');
      await a.svc.flush();
      const b = service(store);
      await b.svc.load();
      expect(b.svc.queue().map((i) => i.category)).toEqual(['player_report', 'blocked_word', 'appeal']);
    });
  });
}

behaves('MemoryStore', async () => new MemoryStore());

describe('MemoryStore evidence', () => {
  it('keeps one snapshot per held message or report, taken when it happened', async () => {
    const store = new MemoryStore();
    const { svc } = service(store);
    say(svc, 'a', 'blorf');
    await svc.flush();
    expect(store.evidence).toHaveLength(1);
    expect(store.evidence[0].item).toMatchObject({ userId: 'a', status: 'pending' });
  });
});

describe('a store that fails', () => {
  const broken: ModerationStore = {
    loadStandings: async () => new Map(),
    loadItems: async () => [],
    saveStanding: async () => { throw new Error('db down'); },
    saveItem: async () => { throw new Error('db down'); },
    saveEvidence: async () => { throw new Error('db down'); },
  };
  it('never breaks chat, and the failures are counted and reported', async () => {
    const errors: unknown[] = [];
    const { svc } = service(broken, { onPersistError: (e) => errors.push(e) });
    expect(say(svc, 'x', 'hello').delivered).toBe(true);
    expect(say(svc, 'a', 'blorf')).toMatchObject({ delivered: false, reason: 'blocked' });
    expect(say(svc, 'a', 'again')).toMatchObject({ delivered: false, reason: 'suspended' }); // still enforced from memory
    await svc.flush();
    expect(svc.persistFailures).toBeGreaterThan(0);
    expect(errors.length).toBe(svc.persistFailures);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresStore against a real Postgres (set TEST_DATABASE_URL)', () => {
  const pool = new Pool({ connectionString: url });
  afterAll(async () => {
    await pool.end();
  });

  const reset = async () => {
    await pool.query('drop table if exists moderation_evidence, moderation_items, moderation_standings cascade');
    await pool.query(MIGRATION);
  };
  beforeEach(reset);

  it('the migration can be run twice', async () => {
    await expect(pool.query(MIGRATION)).resolves.toBeDefined();
  });

  it('round-trips standings and items, including the context', async () => {
    const store = new PostgresStore(pool);
    await store.saveStanding('a', { banned: true, suspendedUntil: 1_700_000_000_123 });
    await store.saveStanding('b', { banned: false, suspendedUntil: null });
    await store.saveStanding('a', { banned: false, suspendedUntil: 1_700_000_999_999 }); // update
    const standings = await store.loadStandings();
    expect(standings.get('a')).toEqual({ banned: false, suspendedUntil: 1_700_000_999_999 });
    expect(standings.get('b')).toEqual({ banned: false, suspendedUntil: null });

    const item: ReviewItem = {
      id: 7, at: 123, userId: 'a', roomCode: 'ROOM1', text: "it's \"quoted\" ünïcode 💩", category: 'blocked_word',
      term: 'blorf', mustReport: false, status: 'pending',
      context: [{ id: 1, roomCode: 'ROOM1', userId: 'b', name: 'B', text: 'hi', at: 100 }],
    };
    await store.saveItem(item);
    await store.saveItem({ ...item, status: 'reviewed', verdict: 'clear', reason: 'false alarm' });
    const items = await store.loadItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 7, status: 'reviewed', verdict: 'clear', text: item.text });
    expect(items[0].context).toEqual(item.context);
  });

  it('evidence can be added but never changed, deleted, or truncated', async () => {
    const store = new PostgresStore(pool);
    await store.saveEvidence({ id: 1, at: 1, userId: 'a', roomCode: 'R', text: 'held message', category: 'blocked_word', mustReport: false, status: 'pending' });
    const { rows } = await pool.query('select item_id, user_id, content_hash, payload from moderation_evidence');
    expect(rows).toHaveLength(1);
    expect(rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].payload.text).toBe('held message');
    await expect(pool.query("update moderation_evidence set user_id = 'x'")).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from moderation_evidence')).rejects.toThrow(/append-only/);
    await expect(pool.query('truncate moderation_evidence')).rejects.toThrow(/append-only/);
    expect((await pool.query('select count(*)::int as n from moderation_evidence')).rows[0].n).toBe(1);
  });

  it('row-level security hides every row from an ordinary role, even one that was granted SELECT', async () => {
    const store = new PostgresStore(pool);
    await store.saveStanding('a', { banned: true, suspendedUntil: null });
    await store.saveEvidence({ id: 1, at: 1, userId: 'a', roomCode: 'R', text: 'secret', category: 'blocked_word', mustReport: false, status: 'pending' });
    const flags = await pool.query("select relname, relrowsecurity from pg_class where relname like 'moderation_%' and relkind = 'r'");
    expect(flags.rows.length).toBe(3);
    expect(flags.rows.every((r) => r.relrowsecurity)).toBe(true);

    const client = await pool.connect();
    try {
      await client.query("do $$ begin if not exists (select 1 from pg_roles where rolname = 'rls_probe') then create role rls_probe nologin; end if; end $$");
      // with no grant at all: refused outright
      await client.query('begin');
      await client.query('set local role rls_probe');
      await expect(client.query('select * from moderation_evidence')).rejects.toThrow(/permission denied/);
      await client.query('rollback');
      // with SELECT granted: allowed to ask, but RLS (no policies) returns nothing
      await client.query('grant select on moderation_evidence, moderation_standings to rls_probe');
      await client.query('begin');
      await client.query('set local role rls_probe');
      expect((await client.query('select * from moderation_evidence')).rows).toHaveLength(0);
      expect((await client.query('select * from moderation_standings')).rows).toHaveLength(0);
      await client.query('rollback');
    } finally {
      await client.query('drop owned by rls_probe');
      await client.query('drop role if exists rls_probe');
      client.release();
    }
  });

  behaves('PostgresStore', async () => {
    await reset();
    return new PostgresStore(pool);
  });
});
