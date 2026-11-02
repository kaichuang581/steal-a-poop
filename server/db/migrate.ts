/**
 * Applies the SQL files in db/migrations, in order, once each, and remembers which it has applied (with a checksum of each file).
 *
 * Rules it enforces:
 *  - A migration that was already applied and has since been EDITED is refused. Fix mistakes with a new file, never by editing an old one.
 *  - Only one runner works at a time (a database lock), so two deploys cannot apply the same file together.
 *  - Each file runs in its own transaction: it applies completely or not at all.
 *  - It never drops, rewrites or "repairs" anything by itself. Migrations are forward-only.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

export interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

const NAME = /^(\d{3})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 727_274_001; // any fixed number; the same for every runner

export class MigrationError extends Error {}

export function listMigrations(dir = 'db/migrations'): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => NAME.test(f))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

export interface MigrateOptions {
  /** Only report what would run. */
  dryRun?: boolean;
  /** Record every file as applied without running it. For a database that was already migrated by other means. */
  baseline?: boolean;
  log?: (line: string) => void;
}
export interface MigrateResult {
  applied: string[];
  pending: string[];
  baselined: string[];
}

export async function migrate(pool: Pick<Pool, 'connect'>, files: MigrationFile[], opts: MigrateOptions = {}): Promise<MigrateResult> {
  const log = opts.log ?? (() => {});
  const names = new Set<string>();
  for (const f of files) {
    if (names.has(f.name)) throw new MigrationError(`two migrations are named ${f.name}`);
    names.add(f.name);
  }
  const prefixes = new Map<string, string>();
  for (const f of files) {
    const p = f.name.slice(0, 3);
    if (prefixes.has(p)) throw new MigrationError(`${f.name} and ${prefixes.get(p)} share the number ${p}: numbers must be unique`);
    prefixes.set(p, f.name);
  }

  const client = await pool.connect();
  const result: MigrateResult = { applied: [], pending: [], baselined: [] };
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`create table if not exists schema_migrations (
      filename text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    await client.query('alter table schema_migrations enable row level security'); // nothing here is for the browser
    await client.query(`do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on schema_migrations from anon; end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on schema_migrations from authenticated; end if;
    end $$`);
    const { rows } = await client.query('select filename, checksum from schema_migrations');
    const done = new Map<string, string>(rows.map((r) => [r.filename as string, r.checksum as string]));

    for (const f of files) {
      const was = done.get(f.name);
      if (was !== undefined && was !== f.checksum) {
        throw new MigrationError(`${f.name} was changed after it was applied. Do not edit an applied migration; add a new one instead.`);
      }
    }
    for (const name of done.keys()) if (!names.has(name)) log(`warning: ${name} is applied in the database but not in this code (is the code older than the database?)`);

    for (const f of files) {
      if (done.has(f.name)) continue;
      if (opts.dryRun) {
        result.pending.push(f.name);
        continue;
      }
      if (opts.baseline) {
        await client.query('insert into schema_migrations (filename, checksum) values ($1,$2)', [f.name, f.checksum]);
        result.baselined.push(f.name);
        log(`baselined ${f.name}`);
        continue;
      }
      try {
        await client.query('begin');
        await client.query(f.sql);
        await client.query('insert into schema_migrations (filename, checksum) values ($1,$2)', [f.name, f.checksum]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback').catch(() => undefined);
        throw new MigrationError(`${f.name} failed and was rolled back: ${(e as Error).message}`);
      }
      result.applied.push(f.name);
      log(`applied ${f.name}`);
    }
    return result;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
