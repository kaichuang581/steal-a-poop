# Lane: trust (moderation and rooms)

Status: in progress.

## Done
1. Results hook and server-run Daily Table: `onGameFinished` and `dailyGate` options, `startDaily`, `toGameResult`
   (`server/rooms.ts`, `server/index.ts`). Tests in `server/rooms.test.ts` and `server/server.test.ts`.
2. Persist moderation state: `ModerationStore` (`server/moderation/store.ts`), `MemoryStore`, `PostgresStore`, migration `200_moderation.sql`, write-through in `ChatService`, `DATABASE_URL` wiring in `server/main.ts`.

## Not done
- Task 2 follow-ups: add a Postgres service to CI so the 10 database tests run there; retention periods; `anonymizeUser` for account deletion is not built.

## Not verified
- Task 2: tested against a local PostgreSQL 16, not against Supabase. Supabase's `anon`/`authenticated` roles and its RLS defaults are covered by the migration but have not been exercised there.
- Task 1: the daily gate and result sink are tested with stubs only; the real ones belong to the accounts lane.

## Environment variables
- `DATABASE_URL` (secret): Postgres for moderation state.
- `TEST_DATABASE_URL`: only for running the database tests.

## Needs from other lanes
