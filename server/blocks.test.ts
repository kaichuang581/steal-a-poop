import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BlockList, MAX_BLOCKS, MemoryBlockStore, PostgresBlockStore } from './blocks';

describe('BlockList', () => {
  it('blocks one way only, can unblock, and ignores repeats', async () => {
    const store = new MemoryBlockStore();
    const b = new BlockList(store);
    expect(b.block('a', 'b')).toBe('ok');
    expect(b.block('a', 'b')).toBe('ok');
    expect([b.isBlocked('a', 'b'), b.isBlocked('b', 'a')]).toEqual([true, false]);
    expect(b.list('a')).toEqual(['b']);
    b.unblock('a', 'b');
    b.unblock('a', 'never');
    expect(b.isBlocked('a', 'b')).toBe(false);
    await b.flush();
    expect(await store.load()).toEqual([]);
  });
  it('refuses self, empty, huge ids and more than the limit', () => {
    const b = new BlockList();
    expect(b.block('a', 'a')).toBe('self');
    expect(b.block('a', '')).toBe('bad');
    expect(b.block('a', 'x'.repeat(101))).toBe('bad');
    for (let i = 0; i < MAX_BLOCKS; i++) expect(b.block('a', `u${i}`)).toBe('ok');
    expect(b.block('a', 'one-too-many')).toBe('limit');
    expect(b.block('a', 'u0')).toBe('ok'); // already blocked is not "more"
  });
  it('survives a restart through the store, and a failing store never throws', async () => {
    const store = new MemoryBlockStore();
    const one = new BlockList(store);
    one.block('a', 'b');
    one.block('a', 'c');
    await one.flush();
    const two = new BlockList(store);
    await two.load();
    expect(two.list('a').sort()).toEqual(['b', 'c']);
    const errors: unknown[] = [];
    const bad = new BlockList({ load: async () => [], add: async () => { throw new Error('down'); }, remove: async () => {} }, Date.now, (e) => errors.push(e));
    expect(bad.block('a', 'b')).toBe('ok');
    await bad.flush();
    expect([bad.failures, errors.length, bad.isBlocked('a', 'b')]).toEqual([1, 1, true]);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('PostgresBlockStore against a real Postgres', () => {
  const pool = new Pool({ connectionString: url });
  const migration = readFileSync('db/migrations/203_user_blocks.sql', 'utf8');
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('drop table if exists user_blocks cascade');
    await pool.query(migration);
  });
  it('the migration runs twice; blocks round-trip, repeat safely and can be removed', async () => {
    await expect(pool.query(migration)).resolves.toBeDefined();
    const s = new PostgresBlockStore(pool);
    const b = new BlockList(s);
    b.block('a', 'b');
    b.block('a', 'c');
    b.block('x', 'b');
    await b.flush();
    await s.add('a', 'b', 1); // repeat: no error
    const again = new BlockList(s);
    await again.load();
    expect(again.list('a').sort()).toEqual(['b', 'c']);
    expect(again.isBlocked('x', 'b')).toBe(true);
    again.unblock('a', 'b');
    await again.flush();
    expect((await s.load()).sort()).toEqual([['a', 'c'], ['x', 'b']]);
    const { rows } = await pool.query("select relrowsecurity from pg_class where relname = 'user_blocks'");
    expect(rows[0].relrowsecurity).toBe(true);
  });
});
