# Working in parallel: four lanes

Four Claude sessions can work at the same time because each one owns different files. Read this
before starting. If a rule here blocks you, write the problem in `docs/lanes/REQUESTS.md` and carry
on with something else. Never overwrite another lane's file to get unblocked.

| Lane | Person | Owns |
|---|---|---|
| **accounts** | Brian | `server/auth.ts`, `server/routes/accounts.ts`, `src/auth/**`, `src/ui/auth/**`, `src/ui/StartScreen.tsx`, `src/ui/Settings.tsx`, `src/ui/App.tsx`, `src/lib/ageRules.ts`, `db/migrations/1xx_*`, `docs/AUTH.md`, the sign-in wiring in `server/main.ts` |
| **moderation** | Kai | `server/chat.ts`, `server/filter.ts`, `server/review.ts`, `server/moderation/**`, `server/routes/moderation.ts`, `server/data/**`, `src/ui/mod/**`, `src/ui/ChatRules.tsx`, `db/migrations/2xx_*`, `docs/MODERATION.md` |
| **rooms** | Brian | `server/rooms.ts`, `server/index.ts`, `server/types.ts`, `server/codes.ts`, `server/routes/rooms.ts`, `src/net/**`, `src/state/roomStore.ts`, `src/ui/Lobby.tsx`, `src/ui/RoomScreen.tsx`, `src/ui/ChatPanel.tsx`, `e2e/rooms*`, `db/migrations/3xx_*`, `docs/SERVER.md` |
| **ops** | Kai | `src/engine/**`, the solo game screens in `src/ui/**` not listed above, `src/state/store.ts`, `scripts/**`, `.github/**`, `Dockerfile`, `fly.toml`, `public/**`, `server/routes/ops.ts`, `e2e/game*`, `db/migrations/4xx_*`, `docs/BALANCE*.md`, `docs/PERFORMANCE.md`, `docs/OPERATIONS.md` |

**Nobody owns:** `server/contracts.ts`, `server/http.ts`, `server/routes/index.ts`. They are finished.
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
9. **Do not weaken a test to make it pass.** If a test is wrong, say why in the pull request.

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
