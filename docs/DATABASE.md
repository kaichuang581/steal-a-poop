# Database runbook

The game keeps its data in Postgres (Supabase). Only the **game server** reads and writes it, using a server-side connection; the browser
never touches these tables. Every table has row-level security turned on with no policies, and the browser roles have no access, so a leaked
publishable key reaches nothing here.

## The projects

| | Ref | Region | Role |
|---|---|---|---|
| steal-a-poop | `hmcwncqgafwijjlwezgf` | us-east-1 | the only project so far: **staging** (migrations 100 to 104 applied and recorded) |
| (to create) | | | **production**, before real players |

- A region cannot be changed later. If player data should be held in Canada (`ca-central-1`), create production there and do not put real
  players on the `us-east-1` project.
- Never put this game's data in any other project in the account.

## Changing the schema

1. Write a **new** file `db/migrations/NNN_what_it_does.sql` in your lane's number range (`db/migrations/README.md`). Never edit a file that has
   been merged: the runner refuses a changed checksum.
2. Every table: `enable row level security` in the same file, no policies, and the `revoke ... from anon, authenticated` block (copy any existing file).
   Every function: `set search_path = ''`. The test `server/db/migrate.test.ts` fails the build if you forget.
3. Add a store test that runs against a real Postgres (`TEST_DATABASE_URL`), like the existing ones.
4. Open a branch. CI (`.github/workflows/ci.yml`) runs everything against a throw-away Postgres 16.
5. Apply to the database (below), then deploy the code that needs it. **Migrations go first and must be backwards compatible**: the old code
   keeps running for a few minutes while the new migration exists, so add columns and tables, do not rename or drop what running code uses.
   Remove old columns in a later migration, after the new code is live.

## Applying migrations

Needs `DATABASE_URL` (the project's Postgres connection string; a **secret**, set in your shell or the host's secret store, never in the repository).

```bash
DATABASE_URL=... npm run migrate -- --dry-run
```

```bash
DATABASE_URL=... npm run migrate
```

- It applies pending files in number order, each in its own transaction, and stops at the first failure (that file is rolled back; earlier ones stay).
- If it says a file "was changed after it was applied", someone edited an old migration. Put the file back as it was and add a new one.
- A database that was set up some other way (for example the Supabase project, whose files were applied through the Supabase tooling)
  is marked once with `npm run migrate -- --baseline`, which records the files without running them. **The staging project is already baselined.**
- Supabase also keeps its own list of migrations applied through its dashboard or tooling. The two lists can differ; `schema_migrations` is the one this runner trusts.

## Rolling back

Migrations are forward-only. There is no automatic undo, on purpose: a rollback script that drops a table would delete players' data.
To undo a change, write a new migration that reverses it. If a bad migration has already damaged data, restore from backup (below), which is
why the backup must be tested before launch.

## Backups

- Supabase **daily backups** are included on paid plans; **point-in-time recovery** is a paid add-on. **The free plan has no backups.**
  Before real players: move production to a paid plan with point-in-time recovery, and check the plan in the dashboard (Database, Backups).
- A backup you have never restored is a hope, not a backup. **Restore drill** (do it once on staging before launch, and after any major change):
  1. In the dashboard, restore to a point in time (or from a daily backup) into a **new** project, never over the live one.
  2. Run `DATABASE_URL=<new project> npm run migrate -- --dry-run`: it should say there is nothing to apply.
  3. Point a local copy of the server at it and sign in; check that profiles, a stored game, a wallet balance and a friend link are present.
  4. Write down how long it took and what was missing.
- Moderation evidence and child-safety reports are **kept for legal reasons**. They must be in every backup, and backups must not be deleted
  early because someone asked for deletion: tell your lawyer how long backups are kept (`docs/legal/data-retention.md`).

## Checks to run regularly

- Supabase **advisors** (security and performance): in the dashboard, or ask Claude. Expected: only "RLS enabled, no policy" notices, one per table.
  Anything about a table with RLS **off**, a function with a mutable search path, or exposed schemas is a real problem.
- The same facts by SQL (all should be 0):

```sql
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;                      -- tables without row-level security
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated');                         -- grants to the browser roles
```

## Connecting the server

- `DATABASE_URL` is the Postgres connection string. The server holds a small pool (5 connections) and runs as **one process** (state such as rooms is in
  memory), so connection count is not a concern at this size.
- Use Supabase's **session pooler** address if the host cannot reach the direct address (the direct address may be IPv6-only).
- The server's connection must be a role that can read and write these tables and **bypasses row-level security** (the default `postgres` role or the
  service role connection does). The browser's keys never can.
- Keep the service role key and the database password out of the browser build, the repository, logs and chat.

## What is not in place yet

- Retention jobs. Nothing is deleted on a timer; the periods in `docs/legal/data-retention.md` still need your lawyer's answers.
- Alerting when the database is down or full.
- A production project, and the restore drill.
- Staging and production use the same migrations; there is no separate seed data and no test accounts in production.
