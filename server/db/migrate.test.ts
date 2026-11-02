import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MigrationError, listMigrations, migrate } from './migrate';
import type { MigrationFile } from './migrate';

describe('the migration files', () => {
  const files = listMigrations();
  it('are named NNN_words.sql with a unique number, and run in numeric order', () => {
    expect(files.length).toBeGreaterThan(5);
    const numbers = files.map((f) => f.name.slice(0, 3));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toEqual([...numbers].sort());
    expect(readdirSync('db/migrations').filter((f) => f.endsWith('.sql') && !/^\d{3}_[a-z0-9_]+\.sql$/.test(f))).toEqual([]);
  });
  it('stay inside their lane\'s number range', () => {
    for (const f of files) expect(Number(f.name.slice(0, 3))).toBeGreaterThanOrEqual(100);
  });
  it('every table creation turns row-level security on in the same file', () => {
    for (const f of files) {
      const tables = [...f.sql.matchAll(/create table if not exists (\w+)/gi)].map((m) => m[1]);
      for (const t of tables) expect(f.sql, `${f.name}: ${t}`).toMatch(new RegExp(`alter table\\s+(?:[\\w, ]*\\b)?${t}\\b[^;]*enable row level security`, 'i'));
    }
  });
  it('checksums change when a file changes', () => {
    expect(files[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(files.map((f) => f.checksum)).size).toBe(files.length);
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('migrate against a real Postgres (set TEST_DATABASE_URL)', () => {
  const SCHEMA = 'test_migrate';
  const pool = new Pool({ connectionString: url, options: `-c search_path=${SCHEMA}` });
  const admin = new Pool({ connectionString: url });
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });
  beforeEach(async () => {
    await admin.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin.query(`create schema ${SCHEMA}`);
    // Supabase hands every new table to these two roles by default; the migrations must take it back.
    await admin.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    end $$`);
    await admin.query(`grant usage on schema ${SCHEMA} to anon, authenticated`);
    await admin.query(`alter default privileges in schema ${SCHEMA} grant all on tables to anon, authenticated`);
  });
  const tables = async () => (await pool.query(`select table_name from information_schema.tables where table_schema = '${SCHEMA}' order by 1`)).rows.map((r) => r.table_name as string);

  it('applies every migration to an empty database, once, and a second run does nothing', async () => {
    const files = listMigrations();
    const first = await migrate(pool, files);
    expect(first.applied).toEqual(files.map((f) => f.name));
    expect(await tables()).toEqual(expect.arrayContaining(['profiles', 'games', 'wallet_ledger', 'friendships', 'moderation_items', 'user_blocks', 'schema_migrations']));
    const second = await migrate(pool, files);
    expect(second.applied).toEqual([]);
    const { rows } = await pool.query('select filename, checksum from schema_migrations order by filename');
    expect(rows.map((r) => r.filename)).toEqual(files.map((f) => f.name));
    expect(rows.map((r) => r.checksum)).toEqual(files.map((f) => f.checksum));
  });

  it('GUARD: after all migrations every table has row-level security and the browser roles can touch nothing', async () => {
    await migrate(pool, listMigrations());
    const rls = await pool.query(`select c.relname, c.relrowsecurity from pg_class c where c.relnamespace = '${SCHEMA}'::regnamespace and c.relkind = 'r'`);
    expect(rls.rows.length).toBeGreaterThan(10);
    expect(rls.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname), 'tables without row-level security').toEqual([]);
    for (const role of ['anon', 'authenticated']) {
      for (const t of await tables()) {
        const { rows } = await pool.query("select has_table_privilege($1, $2, 'select,insert,update,delete') as any_access", [role, `${SCHEMA}.${t}`]);
        expect(rows[0].any_access, `${role} must not reach ${t}`).toBe(false);
      }
    }
  });

  it('GUARD: every function pins its search path (Supabase\'s advisor flags a mutable one)', async () => {
    await migrate(pool, listMigrations());
    const { rows } = await pool.query(`select p.proname, p.proconfig from pg_proc p where p.pronamespace = '${SCHEMA}'::regnamespace and p.prokind = 'f'`);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.filter((r) => !(r.proconfig ?? []).some((c: string) => c.startsWith('search_path='))).map((r) => r.proname)).toEqual([]);
  });

  it('refuses a migration that was edited after it was applied, and changes nothing', async () => {
    const files = listMigrations();
    await migrate(pool, files);
    const edited: MigrationFile[] = files.map((f, i) => (i === 2 ? { ...f, sql: f.sql + '\n-- sneaky edit', checksum: 'different' } : f));
    await expect(migrate(pool, edited)).rejects.toThrow(/was changed after it was applied/);
    await expect(migrate(pool, edited)).rejects.toBeInstanceOf(MigrationError);
  });

  it('a failing migration is rolled back whole; earlier ones stay; fixing it lets the rest run', async () => {
    const good = (n: string): MigrationFile => ({ name: `${n}_ok.sql`, sql: `create table t${n} (id int);`, checksum: n });
    const bad: MigrationFile = { name: '501_bad.sql', sql: 'create table half_made (id int); select 1/0;', checksum: 'bad' };
    await expect(migrate(pool, [good('500'), bad, good('502')])).rejects.toThrow(/501_bad.sql failed and was rolled back/);
    expect(await tables()).toContain('t500');
    expect(await tables()).not.toContain('half_made'); // nothing from the failed file survived
    expect(await tables()).not.toContain('t502'); // and the ones after it were not run
    const fixed: MigrationFile = { name: '501_bad.sql', sql: 'create table fixed_now (id int);', checksum: 'fixed' };
    const out = await migrate(pool, [good('500'), fixed, good('502')]);
    expect(out.applied).toEqual(['501_bad.sql', '502_ok.sql']);
  });

  it('dry run lists what is pending and changes nothing; baseline records files without running them', async () => {
    const files = listMigrations();
    const dry = await migrate(pool, files, { dryRun: true });
    expect(dry.pending).toEqual(files.map((f) => f.name));
    expect(await tables()).not.toContain('profiles');
    const base = await migrate(pool, files, { baseline: true });
    expect(base.baselined).toEqual(files.map((f) => f.name));
    expect(await tables()).not.toContain('profiles'); // nothing ran
    expect((await migrate(pool, files)).applied).toEqual([]); // and they now count as applied
  });

  it('two runners at the same moment apply each file exactly once', async () => {
    const files = listMigrations();
    const [a, b] = await Promise.all([migrate(pool, files), migrate(pool, files)]);
    expect([...a.applied, ...b.applied].sort()).toEqual(files.map((f) => f.name).sort());
  });

  it('warns about a migration the database has but the code does not', async () => {
    const files = listMigrations();
    await migrate(pool, files);
    const lines: string[] = [];
    await migrate(pool, files.slice(0, -1), { log: (l) => lines.push(l) });
    expect(lines.join('\n')).toMatch(/applied in the database but not in this code/);
  });

  it('refuses two files with the same number', async () => {
    const a: MigrationFile = { name: '700_a.sql', sql: 'select 1', checksum: 'a' };
    const b: MigrationFile = { name: '700_b.sql', sql: 'select 2', checksum: 'b' };
    await expect(migrate(pool, [a, b])).rejects.toThrow(/share the number 700/);
  });

  it('reads files from a directory, ignoring anything that is not a migration', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    writeFileSync(join(dir, '100_a.sql'), 'select 1');
    writeFileSync(join(dir, 'notes.md'), 'x');
    writeFileSync(join(dir, '9_bad.sql'), 'x');
    expect(listMigrations(dir).map((f) => f.name)).toEqual(['100_a.sql']);
    expect(readFileSync(join(dir, '100_a.sql'), 'utf8')).toBe('select 1');
  });
});
