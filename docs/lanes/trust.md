# Lane: trust (moderation and rooms)

Status: in progress.

## Done
1. Results hook and server-run Daily Table: `onGameFinished` and `dailyGate` options, `startDaily`, `toGameResult`
   (`server/rooms.ts`, `server/index.ts`). Tests in `server/rooms.test.ts` and `server/server.test.ts`.
2. Persist moderation state: `ModerationStore` (`server/moderation/store.ts`), `MemoryStore`, `PostgresStore`, migration `200_moderation.sql`, write-through in `ChatService`, `DATABASE_URL` wiring in `server/main.ts`.
3. Filter quality: `server/moderation/config.ts` (24 h default, optional mild/severe tiers, repeat multipliers, allowlist default empty, `LANGUAGE_PACKS` hook), homoglyph and full-width handling in `server/filter.ts`, corpus test `server/moderation/corpus.test.ts` (122 innocent messages, 300 generated disguised ones; run it to see the false-positive rate, currently 1/122 = "Penistone", a real Scunthorpe-style case).
4. Human review tool: `server/routes/moderation.ts` (`GET /api/mod/queue`, `/items/:id`, `/users/:id`, `POST /items/:id/resolve`; moderator only; mounted from `server/main.ts` via `createModerationRoutes(chat)`), `ChatService.resolveByHuman(id, verdict, reason, decidedBy)` with `decidedBy`/`decidedAt`/`opinion` on items, screen `src/ui/mod/ModScreen.tsx` at `#/mod` (seam in `src/main.tsx`, App.tsx untouched), e2e `e2e/moderation.spec.ts` (dev moderator `Mona` via `DEV_MODERATORS`).
5. Child-safety reporting adapter: `server/moderation/reporting.ts` (`ChildSafetyReporter`, `DryRunReporter` default, `NcmecReporter` that refuses to run, `selectReporter` per country, `ChildSafetyService` as the `ChildSafetySink`), migration `202_child_safety_reports.sql` (never deletable, row security on), `POST /api/mod/items/:id/report` for a person to confirm. Evidence fields: held-at and created-at times, item/user/room/message ids, sha256 content hash, context, `legalHold`.
6. Reviewer hardening: `server/review.ts` has per-call timeout (15 s), retries with doubling backoff on timeouts/network/429/5xx, a concurrency limit (3), a daily token cap (200k, resets at UTC midnight) and an optional spend cap that needs prices you supply, strict output validation (`parseVerdict`: only a bare or fenced JSON object, known verdict, string reason; a "clear" on a child-safety item becomes escalate), counters (`reviewer.counters`) and PII-free log lines. Every failure goes to a person; none can ban. Tests: `server/review.test.ts` (26 hostile messages, mocked API only).

## Not done
- Task 2 follow-ups: add a Postgres service to CI so the 10 database tests run there; retention periods; `anonymizeUser` for account deletion is not built.

## Not verified
- Task 2: tested against a local PostgreSQL 16, not against Supabase. Supabase's `anon`/`authenticated` roles and its RLS defaults are covered by the migration but have not been exercised there.
- Task 1: the daily gate and result sink are tested with stubs only; the real ones belong to the accounts lane.

- Task 3: the abusive corpus is the blocklist itself with transforms, so it measures evasion handling, not real-world recall. Nothing tests words missing from the blocklist, other languages, or images. The innocent corpus was written by me, so its 0.8% false-positive rate is optimistic. Tiers and graduated lengths are built but not wired to `main.ts` (defaults apply); turning them on is a policy decision for you.

- Task 4: the moderator screen signs in with a pasted token; with real accounts it needs the accounts lane's session (ask for a one-line hook in App.tsx or a shared token getter). Child-safety items can still be resolved here; reporting is task 5. The screen was exercised in one browser at desktop width only, and the e2e needs `PW_CHROMIUM=/opt/pw-browsers/chromium` in this container.

- Task 5: nothing is sent anywhere. The NCMEC reporter is a shape that throws until a real transport exists, and no transport was written because I do not have NCMEC's documentation or credentials. Country reaches the reporter only if `countryOf` is supplied; `main.ts` does not supply it yet (the accounts lane knows the sign-up country), so every report currently falls back to the dry run.

### What I need from you before any report can really be sent
1. Registration with NCMEC's CyberTipline as an electronic service provider (or the equivalent body for each other country you launch in). Only you or your organisation can do this.
2. Their technical documentation and credentials, delivered through your host's secret store, never chat or the repo. With those, a transport can be written as `NcmecTransport` and passed to `NcmecReporter({ registered: true, transport })`.
3. A lawyer's answer on: what must be reported and how fast, how long evidence must be kept (the 90-day style preservation rules differ by country), what you may tell the player, and what the privacy policy must say.
4. A named person who confirms reports (the only step that triggers submission), and a rule for what happens when nobody is available.
5. The list of countries you will launch in, so each gets a reporter or a deliberate dry-run fallback.

- Task 6: never run against the real API. Whether the real model resists prompt injection is unknown: the tests prove the server's behaviour (data is quoted, odd output is refused, failures escalate), not the model's. The default token cap (200,000/day) is my guess, not measured. Strict parsing means a model that adds prose will escalate everything, which is safe but costs reviewer time; try it on the real model before launch. Counters exist in memory but are not yet exposed anywhere (task 8).

## Environment variables
- `DATABASE_URL` (secret): Postgres for moderation state.
- `TEST_DATABASE_URL`: only for running the database tests.

## Needs from other lanes
