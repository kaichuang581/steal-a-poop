# Lane: trust (moderation and rooms)

Status: in progress.

## Done
1. Results hook and server-run Daily Table: `onGameFinished` and `dailyGate` options, `startDaily`, `toGameResult`
   (`server/rooms.ts`, `server/index.ts`). Tests in `server/rooms.test.ts` and `server/server.test.ts`.
2. Persist moderation state: `ModerationStore` (`server/moderation/store.ts`), `MemoryStore`, `PostgresStore`, migration `200_moderation.sql`, write-through in `ChatService`, `DATABASE_URL` wiring in `server/main.ts`.
3. Filter quality: `server/moderation/config.ts` (24 h default, optional mild/severe tiers, repeat multipliers, allowlist default empty, `LANGUAGE_PACKS` hook), homoglyph and full-width handling in `server/filter.ts`, corpus test `server/moderation/corpus.test.ts` (122 innocent messages, 300 generated disguised ones; run it to see the false-positive rate, currently 1/122 = "Penistone", a real Scunthorpe-style case).
4. Human review tool: `server/routes/moderation.ts` (`GET /api/mod/queue`, `/items/:id`, `/users/:id`, `POST /items/:id/resolve`; moderator only; mounted from `server/main.ts` via `createModerationRoutes(chat)`), `ChatService.resolveByHuman(id, verdict, reason, decidedBy)` with `decidedBy`/`decidedAt`/`opinion` on items, screen `src/ui/mod/ModScreen.tsx` at `#/mod` (seam in `src/main.tsx`, App.tsx untouched), e2e `e2e/moderation.spec.ts` (dev moderator `Mona` via `DEV_MODERATORS`).

## Not done
- Task 2 follow-ups: add a Postgres service to CI so the 10 database tests run there; retention periods; `anonymizeUser` for account deletion is not built.

## Not verified
- Task 2: tested against a local PostgreSQL 16, not against Supabase. Supabase's `anon`/`authenticated` roles and its RLS defaults are covered by the migration but have not been exercised there.
- Task 1: the daily gate and result sink are tested with stubs only; the real ones belong to the accounts lane.

- Task 3: the abusive corpus is the blocklist itself with transforms, so it measures evasion handling, not real-world recall. Nothing tests words missing from the blocklist, other languages, or images. The innocent corpus was written by me, so its 0.8% false-positive rate is optimistic. Tiers and graduated lengths are built but not wired to `main.ts` (defaults apply); turning them on is a policy decision for you.

- Task 4: the moderator screen signs in with a pasted token; with real accounts it needs the accounts lane's session (ask for a one-line hook in App.tsx or a shared token getter). Child-safety items can still be resolved here; reporting is task 5. The screen was exercised in one browser at desktop width only, and the e2e needs `PW_CHROMIUM=/opt/pw-browsers/chromium` in this container.

## Environment variables
- `DATABASE_URL` (secret): Postgres for moderation state.
- `TEST_DATABASE_URL`: only for running the database tests.

## Needs from other lanes
