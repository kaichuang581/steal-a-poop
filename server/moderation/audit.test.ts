import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ChatService } from '../chat';
import type { ReviewItem } from '../chat';
import { ChatFilter } from '../filter';
import { MemoryAudit, PostgresAudit } from './audit';
import { buildCaseExport, verifyExport } from './export';
import { computeStats, formatStats } from './stats';

const filter = new ChatFilter({ blocklist: ['blorf'], isWord: () => false });
function setup(reviewer?: ConstructorParameters<typeof ChatService>[0]['reviewer']) {
  let t = 1_000_000;
  const audit = new MemoryAudit();
  const svc = new ChatService({ now: () => t, filter, audit, reviewer });
  return { svc, audit, advance: (ms: number) => (t += ms) };
}

describe('audit log', () => {
  it('records the whole life of a case, with ids and no message text', async () => {
    const { svc, audit, advance } = setup({ review: async () => ({ verdict: 'escalate', reason: 'unsure' }) });
    svc.submit({ userId: 'a', name: 'A', roomCode: 'R', text: 'secret words blorf' });
    await svc.processReviews();
    svc.appeal('a', 'a private appeal note');
    advance(60_000);
    const held = svc.queue().find((i) => i.category === 'blocked_word')!;
    svc.resolveByHuman(held.id, 'clear', 'agreed', 'mod1');
    await svc.flush();
    expect(audit.entries.map((e) => `${e.actor}:${e.action}`)).toEqual([
      'system:message_held', 'reviewer:reviewer_verdict', 'a:appeal_filed', 'mod1:human_decision', 'mod1:standing_restored',
    ]);
    const human = audit.entries.find((e) => e.action === 'human_decision')!;
    expect(human).toMatchObject({ itemId: held.id, userId: 'a', details: { verdict: 'clear', reason: 'agreed' } });
    expect(JSON.stringify(audit.entries)).not.toMatch(/secret words|private appeal note/);
  });

  it('a failing audit log never breaks chat, and is counted', async () => {
    const svc = new ChatService({
      now: () => 1, filter,
      audit: { record: async () => { throw new Error('db down'); }, list: async () => [] },
    });
    expect(svc.submit({ userId: 'a', name: 'A', roomCode: 'R', text: 'blorf' })).toMatchObject({ delivered: false, reason: 'blocked' });
    await svc.flush();
    expect(svc.persistFailures).toBe(1);
  });
});

describe('stats', () => {
  const mk = (id: number, over: Partial<ReviewItem>): ReviewItem => ({
    id, at: 1_700_000_000_000 + id * 1000, userId: 'u' + id, roomCode: 'R', text: 't', category: 'blocked_word', mustReport: false, status: 'reviewed', ...over,
  });
  const items = [
    mk(1, { verdict: 'clear', decidedBy: 'm1', opinion: { verdict: 'suspend', reason: '' } }), // false positive, person disagreed with reviewer
    mk(2, { verdict: 'suspend', decidedBy: 'm1', opinion: { verdict: 'suspend', reason: '' } }),
    mk(3, { verdict: 'ban', decidedBy: 'm2', opinion: { verdict: 'ban', reason: '' } }),
    mk(4, { verdict: 'clear' }), // cleared by the reviewer
    mk(5, { status: 'human' }),
    mk(6, { category: 'player_report', status: 'pending' }),
  ];
  const audit = [
    { at: items[0].at + 60_000, actor: 'm1', action: 'human_decision' as const, itemId: 1 },
    { at: items[1].at + 120_000, actor: 'm1', action: 'human_decision' as const, itemId: 2 },
    { at: items[2].at + 600_000, actor: 'm2', action: 'human_decision' as const, itemId: 3 },
  ];
  const now = items[5].at + 3_600_000;
  const s = computeStats(items, audit, now);

  it('counts volume, false positives and who cleared them', () => {
    expect(s.volume.total).toBe(6);
    expect(s.volume.byCategory).toEqual({ blocked_word: 5, player_report: 1 });
    expect(s.filter).toMatchObject({ decided: 4, cleared: 2, clearedByPerson: 1, clearedByReviewer: 1 });
    expect(s.filter.falsePositiveRate).toBeCloseTo(0.5);
  });
  it('measures time to a person\'s decision and what is still open', () => {
    expect(s.timeToHumanDecisionMs).toMatchObject({ count: 3, median: 120_000, max: 600_000 });
    expect(s.open).toMatchObject({ total: 2, waitingForPerson: 1 });
    expect(s.open.oldestAgeMs).toBe(now - items[4].at);
  });
  it('compares the reviewer with the person', () => {
    expect(s.reviewerAgreement).toMatchObject({ compared: 3, agreed: 2 });
  });
  it('has no rate when there is nothing to divide by, and prints readably', () => {
    const empty = computeStats([], [], 0);
    expect(empty.filter.falsePositiveRate).toBeNull();
    expect(formatStats(empty)).toContain('n/a');
    expect(formatStats(s)).toContain('2/4 held messages ended cleared = 50.0%');
  });
});

describe('case export for a lawyer', () => {
  const item: ReviewItem = { id: 1, at: 10, userId: 'a', roomCode: 'R', text: 'x', category: 'blocked_word', mustReport: false, status: 'reviewed', verdict: 'ban' };
  const other: ReviewItem = { ...item, id: 2, userId: 'b' };
  const doc = buildCaseExport({
    userId: 'a', by: 'mod1', now: 99, items: [other, item],
    evidence: [{ itemId: 1, capturedAt: 10, contentHash: 'h', payload: {} }],
    reports: [], audit: [{ at: 11, actor: 'mod1', action: 'human_decision', itemId: 1, userId: 'a' }, { at: 12, actor: 'mod1', action: 'human_decision', itemId: 2, userId: 'b' }],
  });
  it('contains only that player\'s records and a checksum that verifies', () => {
    expect(doc.items.map((i) => i.id)).toEqual([1]);
    expect(doc.audit).toHaveLength(1);
    expect(verifyExport(doc)).toBe(true);
    expect(verifyExport(JSON.parse(JSON.stringify(doc)))).toBe(true);
  });
  it('detects any change', () => {
    const tampered = JSON.parse(JSON.stringify(doc));
    tampered.items[0].verdict = 'clear';
    expect(verifyExport(tampered)).toBe(false);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresAudit against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/201_moderation_audit.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists moderation_audit cascade');
    await pool.query(migration);
  });
  it('the migration runs twice; entries round-trip and filter', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
    const a = new PostgresAudit(pool);
    await a.record({ at: 5, actor: 'm', action: 'human_decision', itemId: 1, userId: 'u1', details: { verdict: 'ban' } });
    await a.record({ at: 6, actor: 'm', action: 'human_decision', itemId: 2, userId: 'u2' });
    expect(await a.list({ userId: 'u1' })).toEqual([{ at: 5, actor: 'm', action: 'human_decision', itemId: 1, userId: 'u1', details: { verdict: 'ban' } }]);
    expect(await a.list()).toHaveLength(2);
  });
  it('is append-only and has row security on', async () => {
    const a = new PostgresAudit(pool);
    await a.record({ at: 5, actor: 'm', action: 'message_held', userId: 'u1' });
    await expect(pool.query("update moderation_audit set actor = 'x'")).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from moderation_audit')).rejects.toThrow(/append-only/);
    await expect(pool.query('truncate moderation_audit')).rejects.toThrow(/append-only/);
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname = 'moderation_audit' and relnamespace = current_schema()::regnamespace");
    expect(rows[0].relrowsecurity).toBe(true);
  });
});
