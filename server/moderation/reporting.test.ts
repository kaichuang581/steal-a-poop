import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ReviewItem } from '../chat';
import { ChildSafetyService, DryRunReporter, MemoryReportStore, NcmecReporter, ReporterNotConfiguredError, selectReporter } from './reporting';
import type { ChildSafetyReport, ChildSafetyReporter } from './reporting';

const item: ReviewItem = {
  id: 7, at: 5000, userId: 'u1', roomCode: 'ABCDE', text: 'are you home alone', category: 'child_safety', mustReport: true, status: 'human',
  context: [{ id: 1, roomCode: 'ABCDE', userId: 'u2', name: 'x', text: 'hi', at: 4000 }],
};

function svc(over: Partial<ConstructorParameters<typeof ChildSafetyService>[0]> = {}) {
  const store = new MemoryReportStore();
  const errors: unknown[] = [];
  const s = new ChildSafetyService({ store, now: () => 9000, onError: (e) => errors.push(e), ...over });
  return { s, store, errors };
}

describe('child-safety reporting', () => {
  it('records the full evidence package, awaiting a person', async () => {
    const { s, store } = svc({ countryOf: () => 'US' });
    s.record(item);
    await s.flush();
    const r = store.reports.get('csr-7-5000')!;
    expect(r).toMatchObject({ itemId: 7, status: 'awaiting_confirmation', country: 'US', legalHold: true, createdAt: 9000, confirmedBy: null });
    expect(r.evidence).toMatchObject({ userId: 'u1', roomCode: 'ABCDE', heldAt: 5000, text: 'are you home alone' });
    expect(r.evidence.contentHash).toBe(createHash('sha256').update('are you home alone').digest('hex'));
    expect(r.evidence.context).toEqual([{ id: 1, userId: 'u2', at: 4000, text: 'hi' }]);
  });

  it('records an item only once', () => {
    const { s } = svc();
    s.record(item);
    s.record(item);
    expect(s.all()).toHaveLength(1);
  });

  it('the default dry run keeps the report and sends it nowhere', async () => {
    const { s, store } = svc();
    s.record(item);
    const out = await s.confirm(7, 'mod1');
    expect(out).toMatchObject({ status: 'dry_run', reporter: 'dry_run', confirmedBy: 'mod1', confirmedAt: 9000, receipt: null });
    await s.flush();
    expect(store.reports.get('csr-7-5000')!.status).toBe('dry_run');
  });

  it('picks the reporter by country and falls back to a dry run', async () => {
    const sent: string[] = [];
    const fake: ChildSafetyReporter = { name: 'fake_us', submit: async (r: ChildSafetyReport) => (sent.push(r.id), { status: 'submitted', receipt: 'R-1' }) };
    expect(selectReporter('us', { US: fake }).name).toBe('fake_us');
    expect(selectReporter('FR', { US: fake }).name).toBe('dry_run');
    expect(selectReporter(null, { US: fake }).name).toBe('dry_run');
    const { s } = svc({ byCountry: { US: fake }, countryOf: () => 'US' });
    s.record(item);
    expect(await s.confirm(7, 'mod1')).toMatchObject({ status: 'submitted', receipt: 'R-1', reporter: 'fake_us' });
    expect(sent).toEqual(['csr-7-5000']);
  });

  it('NcmecReporter refuses to run until it is registered and has a transport', async () => {
    const r = new NcmecReporter();
    expect(r.isConfigured()).toBe(false);
    await expect(r.submit({} as ChildSafetyReport)).rejects.toBeInstanceOf(ReporterNotConfiguredError);
    await expect(new NcmecReporter({ registered: true }).submit({} as ChildSafetyReport)).rejects.toBeInstanceOf(ReporterNotConfiguredError);
    const { s } = svc({ byCountry: { US: r }, countryOf: () => 'US' });
    s.record(item);
    const out = await s.confirm(7, 'mod1');
    expect(out).toMatchObject({ status: 'not_configured', reporter: 'ncmec' }); // kept, not lost, retryable
    expect(out!.evidence.text).toBe('are you home alone');
  });

  it('a failing reporter is recorded as failed and can be retried', async () => {
    let fail = true;
    const flaky: ChildSafetyReporter = { name: 'flaky', submit: async () => { if (fail) throw new Error('down'); return { status: 'submitted', receipt: 'OK' }; } };
    const { s, errors } = svc({ fallback: flaky });
    s.record(item);
    expect((await s.confirm(7, 'm'))!.status).toBe('failed');
    expect(errors).toHaveLength(1);
    fail = false;
    expect((await s.confirm(7, 'm'))!.status).toBe('submitted');
  });

  it('reloads from the store', async () => {
    const { s, store } = svc();
    s.record(item);
    await s.flush();
    const again = new ChildSafetyService({ store, now: () => 1 });
    await again.load();
    expect(again.get(7)?.status).toBe('awaiting_confirmation');
  });

  it('DryRunReporter is the documented default', async () => {
    expect((await new DryRunReporter().submit()).status).toBe('dry_run');
  });
});

// Real Postgres (set TEST_DATABASE_URL), same pattern as store.test.ts.
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach } from 'vitest';
import { PostgresReportStore } from './postgres';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresReportStore against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/202_child_safety_reports.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists child_safety_reports cascade');
    await pool.query(migration);
  });

  it('the migration can be run twice and rows round-trip, including updates', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
    const store = new PostgresReportStore(pool);
    const s = new ChildSafetyService({ store, now: () => 9000 });
    s.record(item);
    await s.flush();
    await s.confirm(7, 'mod1');
    await s.flush();
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ itemId: 7, status: 'dry_run', confirmedBy: 'mod1', legalHold: true });
    expect(loaded[0].evidence.text).toBe('are you home alone');
  });

  it('reports cannot be deleted or truncated, and row security is on', async () => {
    const store = new PostgresReportStore(pool);
    const s = new ChildSafetyService({ store, now: () => 9000 });
    s.record(item);
    await s.flush();
    await expect(pool.query('delete from child_safety_reports')).rejects.toThrow(/cannot be deleted/);
    await expect(pool.query('truncate child_safety_reports')).rejects.toThrow(/cannot be deleted/);
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname = 'child_safety_reports' and relnamespace = current_schema()::regnamespace");
    expect(rows[0].relrowsecurity).toBe(true);
  });
});
