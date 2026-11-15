import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRankedStore, PostgresRankedStore } from './store';
import type { RankedRow, RankedStore } from './store';

const row = (rating: number, over: Partial<RankedRow> = {}): RankedRow => ({ rating, games: 1, wins: 0, peak: rating, updatedAt: 1000, ...over });

/** The same behaviour for the memory store and the real database. */
function behaves(make: () => Promise<RankedStore>) {
  it('has nothing for a player who has never finished a ranked game', async () => {
    const s = await make();
    expect(await s.get('nobody')).toBeNull();
    expect((await s.getMany(['nobody'])).size).toBe(0);
    expect((await s.getMany([])).size).toBe(0);
    expect(await s.top(10)).toEqual([]);
    expect(await s.standing(0)).toEqual({ above: 0, total: 0 });
  });
  it('keeps a row, as numbers, and replaces it on the next write', async () => {
    const s = await make();
    await s.put('u1', row(16, { wins: 1 }));
    expect(await s.get('u1')).toEqual({ rating: 16, games: 1, wins: 1, peak: 16, updatedAt: 1000 });
    await s.put('u1', row(9, { games: 2, wins: 1, peak: 16, updatedAt: 2000 }));
    expect(await s.get('u1')).toEqual({ rating: 9, games: 2, wins: 1, peak: 16, updatedAt: 2000 });
  });
  it('reads several players at once and leaves out those with no row', async () => {
    const s = await make();
    await s.put('u1', row(100));
    await s.put('u2', row(250));
    const many = await s.getMany(['u1', 'u2', 'u3']);
    expect([...many.keys()].sort()).toEqual(['u1', 'u2']);
    expect(many.get('u2')?.rating).toBe(250);
  });
  it('lists the highest first, ties by id, and only players who have finished a game', async () => {
    const s = await make();
    await s.put('b', row(300));
    await s.put('a', row(300));
    await s.put('c', row(900));
    await s.put('d', row(50));
    await s.put('new', row(999, { games: 0 }));
    expect((await s.top(10)).map((r) => r.userId)).toEqual(['c', 'a', 'b', 'd']);
    expect((await s.top(2)).map((r) => r.userId)).toEqual(['c', 'a']);
    expect((await s.top(1))[0]).toEqual({ userId: 'c', rating: 900, games: 1, wins: 0 });
  });
  it('says how many are rated above a rating, and how many are rated at all', async () => {
    const s = await make();
    await s.put('a', row(300));
    await s.put('b', row(300));
    await s.put('c', row(900));
    await s.put('new', row(999, { games: 0 }));
    expect(await s.standing(300)).toEqual({ above: 1, total: 3 });
    expect(await s.standing(900)).toEqual({ above: 0, total: 3 });
    expect(await s.standing(0)).toEqual({ above: 3, total: 3 });
  });
  it('forgets a player', async () => {
    const s = await make();
    await s.put('u1', row(100));
    await s.erase('u1');
    await s.erase('never-there');
    expect(await s.get('u1')).toBeNull();
    expect(await s.top(10)).toEqual([]);
  });
}

describe('MemoryRankedStore', () => {
  behaves(async () => new MemoryRankedStore());
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresRankedStore against a real Postgres (set TEST_DATABASE_URL)', () => {
  const pool = new Pool({ connectionString: url, options: '-c search_path=test_ranked' });
  const admin = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/106_ranked.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });
  beforeEach(async () => {
    await admin.query('drop schema if exists test_ranked cascade');
    await admin.query('create schema test_ranked');
    await pool.query(migration);
  });
  it('the migration can be run twice and turns on row-level security', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname = 'ranked_ratings' and relnamespace = 'test_ranked'::regnamespace");
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
  it('refuses a rating below zero', async () => {
    await expect(new PostgresRankedStore(pool).put('u1', row(-1))).rejects.toThrow();
  });
  behaves(async () => new PostgresRankedStore(pool));
});
