# Working in parallel: three lanes

Three Claude sessions work at the same time: Brian runs one, Kai runs two. They can because each one
owns different files. Read this before starting. If a rule here blocks you, write the problem in
`docs/lanes/REQUESTS.md` and carry on with something else. Never overwrite another lane's file to
get unblocked.

| Lane | Run by | Owns |
|---|---|---|
| **accounts** (also infrastructure) | Brian | Accounts: `server/auth.ts`, `server/routes/accounts.ts`, `src/auth/**`, `src/ui/auth/**`, `src/ui/StartScreen.tsx`, `src/ui/Settings.tsx`, `src/ui/App.tsx`, `src/lib/ageRules.ts`, `src/lib/nickname.ts`, `db/migrations/1xx_*`, `docs/AUTH.md`, the sign-in wiring in `server/main.ts`. Infrastructure: `Dockerfile`, `fly.toml`, `.github/**`, `server/log.ts`, `server/routes/ops.ts`, `db/migrations/4xx_*`, `docs/OPERATIONS.md` |
| **moderation** (also game rules and content) | Kai | Moderation: `server/chat.ts`, `server/filter.ts`, `server/review.ts`, `server/moderation/**`, `server/routes/moderation.ts`, `server/data/**`, `src/ui/mod/**`, `src/ui/ChatRules.tsx`, `db/migrations/2xx_*`, `docs/MODERATION.md`. Game: `src/engine/**`, `src/state/store.ts`, `scripts/**`, `public/**`, the solo game screens in `src/ui/**` not listed in another row, `src/ui/solo/**`, `e2e/game*`, `docs/BALANCE*.md`, `docs/PERFORMANCE.md` |
| **rooms** (also integration) | Kai | `server/rooms.ts`, `server/index.ts`, `server/types.ts`, `server/codes.ts`, `server/routes/rooms.ts`, `server/loadtest/**`, `src/net/**`, `src/state/roomStore.ts`, `src/ui/Lobby.tsx`, `src/ui/RoomScreen.tsx`, `src/ui/ChatPanel.tsx`, `src/ui/friends/**`, `src/ui/replay/**`, `e2e/rooms*`, `db/migrations/3xx_*`, `docs/SERVER.md`. At the very end only: `README.md`, `CHANGELOG.md`, the version in `package.json` |

**Nobody owns:** `server/contracts.ts` (it also defines `GameResult`, `GameResultSink` and `DailyGate`: the rooms lane reports finished games and runs the server-side Daily Table, the accounts lane implements both), `server/http.ts`, `server/routes/index.ts`. They are finished.
Add a route by editing only your lane's file in `server/routes/` (the moderation lane has no infrastructure route; ops routes belong to the accounts lane).

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
9. **The engine is shared.** The moderation lane edits `src/engine/**`, but the rooms server runs it.
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
