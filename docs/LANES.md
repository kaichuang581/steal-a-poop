# Working in parallel: three lanes

Three AI coding sessions work at the same time. They can because each one owns different files.
Read this before starting. If a rule here blocks you, write the problem in `docs/lanes/REQUESTS.md`
and carry on with something else. Never overwrite another lane's file to get unblocked.

| Lane | Who runs it | Why it is split this way |
|---|---|---|
| **accounts** | Brian's Claude session | Sign-in, accounts and infrastructure: needs the most care with secrets and personal data |
| **trust** | Kai's Claude session | Chat moderation, child safety, and the room server: the code where a mistake hurts children or opens the server to abuse |
| **freebuff** | Kai's Freebuff session | Game rules, content and quality gates: self-contained work covered by strong tests, with no secrets, no accounts, and no child-safety code |

| Lane | Owns |
|---|---|
| **accounts** | `server/auth.ts`, `server/routes/accounts.ts`, `server/routes/friends.ts`, `server/routes/ops.ts`, `src/auth/**`, `src/ui/auth/**`, `src/ui/friends/**`, `src/ui/StartScreen.tsx`, `src/ui/Settings.tsx`, `src/ui/App.tsx`, `src/lib/ageRules.ts`, `src/lib/nickname.ts`, `server/log.ts`, `Dockerfile`, `fly.toml`, `.github/workflows/deploy.yml`, `.github/workflows/deploy-server.yml`, `db/migrations/1xx_*` (including friends) and `4xx_*`, `docs/AUTH.md`, `docs/OPERATIONS.md`, the sign-in wiring in `server/main.ts`. At the very end only: `README.md`, `CHANGELOG.md`, the version in `package.json` |
| **trust** | `server/chat.ts`, `server/filter.ts`, `server/review.ts`, `server/moderation/**`, `server/routes/moderation.ts`, `server/routes/rooms.ts`, `server/data/**`, `server/rooms.ts`, `server/index.ts`, `server/types.ts`, `server/codes.ts`, `server/loadtest/**`, `src/ui/mod/**`, `src/ui/ChatRules.tsx`, `src/ui/ChatPanel.tsx`, `src/ui/Lobby.tsx`, `src/ui/RoomScreen.tsx`, `src/net/**`, `src/state/roomStore.ts`, `e2e/rooms*`, `db/migrations/2xx_*` and `3xx_*`, `docs/MODERATION.md`, `docs/SERVER.md` |
| **freebuff** | `src/engine/**`, `src/state/store.ts`, `scripts/**`, `public/**`, `src/ui/solo/**`, the solo game screens in `src/ui/**` not listed in another row, `e2e/game*`, `.github/workflows/quality.yml`, `.github/dependabot.yml`, `docs/BALANCE*.md`, `docs/PERFORMANCE.md`. One exception: the final accessibility pass may add accessibility attributes to other lanes' screens, but only after those lanes' status files say they are done |

Not run in this round (do later): spectating and replays.

**Nobody owns:** `server/contracts.ts` (it also defines `GameResult`, `GameResultSink` and `DailyGate`: the rooms lane reports finished games and runs the server-side Daily Table, the accounts lane implements both), `server/http.ts`, `server/routes/index.ts`. They are finished.
Add a route by editing only your lane's file in `server/routes/`.

## Rules

1. **One branch and one folder per lane.** Branch `lane/<name>`, in its own `git worktree` or its own
   clone, so two sessions never share a working copy. Open pull requests into `main`, small and
   often (at least one per finished task).
2. **Stay inside your files.** If you need a change somewhere else:
   - A tiny seam (one import, one button): make the smallest possible edit in its own pull request,
     say so in the description, and merge it before the rest of your work.
   - Anything bigger: append a request to `docs/lanes/REQUESTS.md` (who it is for, what, why) and
     work on something else. The owning lane answers in the same file.
3. **Shared files are append-only.** `package.json`, `package-lock.json`, `README.md`,
   `CHANGELOG.md`: do not rewrite them. After a rebase, regenerate the lockfile with `npm install`
   (never hand-merge it). Put your lane's notes in `docs/lanes/<name>.md`, not the README. The
   README and changelog are updated once, at the end, by one person.
4. **Contracts.** `server/contracts.ts` is how lanes talk. You may add an optional field in a
   dedicated pull request. You may not rename or remove anything.
5. **Migrations.** Use only your lane's number range (see `db/migrations/README.md`). Never edit a
   merged migration. Refer to users by the text `user_id`, with no foreign key to another lane's table.
6. **Run the checks before every pull request:** `npx tsc --noEmit`, `npm test`, `npm run build`,
   and `npm run e2e` when you touched anything a player can see. Rebase onto `origin/main` first
   and rerun. Do not merge red.
7. **Secrets.** Never in the repo or a log. Read them from environment variables, and say which
   ones in your lane doc.
8. **Be honest in your lane doc.** Under "Not verified", list everything you did not run or could not
   run. A lane doc that says "done" with nothing under "Not verified" is not believed.
9. **The engine is shared.** The freebuff lane edits `src/engine/**`, but the room server (trust lane) runs it.
   Engine changes must keep the default behaviour and every existing function signature. Add options
   and exports; never change or remove one. The engine tests and the four-browser room test must pass.
10. **Do not weaken a test to make it pass.** If a test is wrong, say why in the pull request.

## Decisions are not blockers: use these defaults

The people have not finished deciding these. Build them as **configuration**, with the default
below, so the decision later is a one-line change.

| Open question | Default to build with | Lives in |
|---|---|---|
| Suspension length and tiers | 24 hours for any violation, every match suspends | `server/moderation/config.ts` |
| Turns per player per round at big tables | 5 at every table size | `src/engine/constants.ts` (`TURNS_BY_SEATS`) |
| Do bots lose half on a failed steal | Yes (current behaviour) | `src/engine/constants.ts` |
| Age rules per country | 13 minimum, parental consent below 13, marked `verified: false` | `src/lib/ageRules.ts` |
| Hosting | Fly.io | `fly.toml`, `docs/OPERATIONS.md` |
| Who staffs human review | Moderators are an allow-list of user ids in an environment variable | `server/moderation/` |

## Things that must not ship until a person has done them

- Child-safety reporting must stay in **dry-run** mode until NCMEC registration and legal review exist.
- Under-13 accounts must not be able to chat until parental consent is recorded.
- Chat must not be reachable from the public site until the moderation lane's "before launch" list in
  `docs/MODERATION.md` is done and a person is assigned to the human review queue.

## Handing over

Each lane keeps `docs/lanes/<name>.md`: what is done (with pull request links), what is not, what was
not verified, environment variables, and anything another lane must do. `docs/lanes/REQUESTS.md` is
the only place lanes ask each other for things.

## Extra rules for the freebuff lane

Freebuff is a different tool from the Claude sessions: a free, ad-supported agent whose AI work runs on
the vendor's servers, so anything it can read leaves the machine. Therefore:

1. **Its folder must hold no secrets.** A fresh clone, no `.env` file, no keys or tokens in the shell,
   no legal or moderation documents. It does not need any: tests and the build run without secrets.
2. **One task at a time**, with a short prompt and a clear finish line. Do not hand it a long list.
3. **A person reads every pull request it opens before it merges.** It does not merge itself.
4. **It stays out of** `server/**`, `src/auth/**`, `src/ui/auth/**`, anything about accounts, children,
   chat moderation, or deployment. If a task seems to need that, it stops and writes a request.
5. **Tests are its safety net.** It must run `npm test`, `npm run build` and `npm run e2e`, paste the
   result, and say what it did not run. A pull request without that is sent back.
