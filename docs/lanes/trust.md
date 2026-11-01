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
7. Appeals and player-facing status: `ChatService.status(userId)` (held message, waiting-since, appeal text/state, last decision; no filter term, no reviewer opinion; a reason only when a person wrote it), `onChange` pushes `{t:'moderation'}` over the WebSocket and the welcome message carries `moderation`, `GET /api/me/moderation`, `oldestUnreviewed()` (also returned by the moderator queue), `src/ui/mod/ModerationNotice.tsx` mounted in `ChatPanel`. Winning an appeal restores the player outright and closes moot appeals. e2e covers hold, appeal, a person clearing it, and the player's chat unlocking without a reload.
8. Audit log and reporting: migration `201_moderation_audit.sql` (append-only, RLS), `server/moderation/audit.ts` (`MemoryAudit`, `PostgresAudit`), hooks in `ChatService` and `ChildSafetyService`, `server/moderation/stats.ts` + `npm run mod:stats`, `server/moderation/export.ts` + `npm run mod:export`, and the rewritten "Before launch" in `docs/MODERATION.md`.
9. Block, mute, kick: `server/blocks.ts` + migration `203_user_blocks.sql`; `RoomManager.kick/setMute/isMuted` (kicked players cannot rejoin; a bot takes a kicked player's seat and keeps the score); WebSocket `block`, `unblock`, `mute`, `kick` and `blocks`/`kicked` messages; host actions in the audit log; UI in `ChatPanel` (Block, Mute, Kick, pause chat, blocked list) and `RoomScreen` (host controls per player). Tests: `server/blocks.test.ts`, `server/rooms.test.ts`, `server/server.test.ts`, four-browser `e2e/safety.spec.ts`. Request to the accounts lane about invites is in `REQUESTS.md`.
10. Connection resilience and abuse limits: `ConnectionLimits` in `server/index.ts` (origin check, per-address and global caps, heartbeat, per-type rate limits with disconnect for floods, graceful shutdown with a `shutdown` message, finished-room clean-up, limiter pruning), env settings in `server/main.ts`, client handling of `shutdown` and stale rooms, `npm run loadtest` (`server/loadtest/run.ts`) and `docs/LOADTEST.md`.

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

- Task 7: appeal text is capped at 500 characters and one appeal can be open at a time. There is no limit on how often someone can appeal after each decision, and no SLA or alert on the oldest item (task 8 reports the number, nothing pages anyone). The player-facing wording has not been read by a lawyer or by a child.

- Task 8: both CLIs were run against a real local PostgreSQL 16 (empty and test-leftover data), not against production data or Supabase. The false-positive rate counts only decided items. The lawyer export format is my invention; ask your lawyer what they actually need. Statistics read the whole items table into memory, which is fine for thousands of items and not for millions.

- Task 9: a room-wide mute exempts the host, so a host who is the problem cannot be muted (a player can only block them or leave). A kicked player is blocked from that room only, not from the host's future rooms, and a kick is lost if the server restarts (rooms are in memory). Block lists are not shown to the blocked player, but a player can guess from silence. The host can also kick or mute during a game from the chat panel; kick is two clicks, mute is one, and there is no undo for a kick. The UI was tested at desktop width only.

- Task 10: the load test ran in this container with idle players, over loopback, with no database; see `docs/LOADTEST.md` for what it can and cannot show. The origin check stops other websites from using a visitor's browser to open sockets; it does not stop a script that sends a fake `Origin` header, so the per-address cap and rate limits are the defence there, and a determined attacker with many addresses is not stopped by anything here (that is a job for your host or a CDN). `TRUST_PROXY` has not been tested behind a real proxy. Origins are compared exactly (scheme, host, port).

## Environment variables
- `DATABASE_URL` (secret): Postgres for moderation state.
- `TEST_DATABASE_URL`: only for running the database tests.

## Needs from other lanes
