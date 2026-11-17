# The gate

One command that runs every check a milestone of the visual overhaul is judged by, and writes one report. The plan is
`docs/visual-overhaul/`; this folder is its file 16, section 4.1 (e) and (f). Nothing here ships to players.

```
npm run gate -- --quick              # after every commit
npm run gate -- --milestone 3        # at the end of milestone 3: writes the report to commit
npm run gate -- --milestone none     # a pull request that is not an overhaul milestone
npm run gate -- --baseline           # on a fresh branch, before work starts
```

(`npm run gate` is `node tools/gate/gate.mjs`. `--help` prints every option.)

## The three runs

| Run | What it runs | What it writes into the repo |
|---|---|---|
| `--quick` | The type check, `npm test`, the build, then the modules `size`, `fences`, `ledger`, `banned`. For every commit. | Nothing. |
| `--milestone NN` | Everything: the type check, `npm test`, both builds, every module. The tree must be committed. | `docs/visual-overhaul/reports/mNN.json` and `mNN.md`. Commit them unedited. |
| `--milestone none` | Everything, for a pull request that is not a milestone. A picture that changed is listed for the reviewer, not failed (the `pictures` module sees `ctx.milestone === null`). | Nothing. |
| `--baseline` | Everything, on a fresh branch before work starts: head must be the base, the tree must be clean. | Nothing. |

`--quick` and `--baseline` learn their milestone from the branch name, `overhaul/mNN-<name>`.

The four modules named for `--quick` are the least it runs. A module's own `modes` says which runs it is part of, so
any other module that lists `'quick'` there runs under `--quick` as well.

Options:

- `--only a,b` and `--skip a,b` run a part. The names are module ids, or the runner's own steps: `types`, `tests`,
  `build`, `build-server`. A part run is never a gate result: it ends with exit code 2 at best, prints `PART RUN`, and
  writes no report into the repo.
- `--seed` stores ratchet numbers that have no stored value yet (below). It never writes over one that has.
- `--base <commit>` judges against that commit, not `git merge-base HEAD origin/main`.
- `--fresh` runs the tests even when this exact commit's report is in the cache.
- `--verbose` prints what the type check, the tests and the builds print, as they run.

Exit code: 0 every check passed; 1 a check failed, or the gate itself could not run; 2 a part run whose part passed;
64 the command line was wrong.

## What the runner does itself, in order

1. Records the base (`git merge-base HEAD origin/main`, or `--base`), the head, the branch and `git status --porcelain`.
2. Type check: `npx tsc --noEmit`.
3. The head's test report: `npx vitest run --reporter=json --outputFile=<cache>/<tree>/vitest.json`. `<tree>` is the
   head commit for a clean tree, and the commit plus a hash of every changed, new or env file otherwise (the same
   recipe as `treeKey` in `lib/painted.mjs`, so a tree's build and its test report share a folder). A report in the
   cache is used again only for a clean tree at exactly that commit, and only if it was green: a failed run is always
   run again. A failing test is never retried. The report is kept with its files named from the repo's root
   (`lib/vitest.mjs`; see "What a module's author has to know"). For each failed test the report prints its name and
   the first line of what it said.
4. Both builds: `npm run build`, then `npm run build:server` (the server build is left out of `--quick`).
5. The modules, in this order: `size`, `fences`, `ledger`, `banned`, `baked`, `scenes`, `smoke`, `pictures`, `counts`.
6. Its own checks of the run: nothing left behind (every run: `git status` is read again, and any path it lists now
   and did not list at the start fails the run, the run's own report and, under `--seed`, `RATCHETS.json` aside); the
   tree is clean (`--milestone NN`, `--baseline`); head is the base (`--baseline`); every human check has a result
   (`--milestone 12` only).
7. The report.

One run always shows everything. A step or module that fails does not stop the ones after it. When the verdict is
printed the gate ends, whatever a module left open.

| What you see | What it means | Does it fail the run? |
|---|---|---|
| `PASS` | The check ran and passed, and every ratchet it measured held. | No |
| `FAIL` | It ran and did not pass; or a ratchet did not hold; or the module threw, could not be loaded, or returned something that is not a result. | Yes |
| `NOT BUILT` | `tools/gate/<id>.mjs` does not exist and this run needs it. Nothing was checked. | Yes |
| `NOT RUN` | The module could not do its work and said so (a summary that starts `NOT RUN`). | Yes |
| `left out` | Left out by `--only` or `--skip`. | The run is a part run |
| `not in this mode` | Not part of this kind of run (`baked` in `--quick`, say). | No |

A module that `--quick` or `--milestone` needs and that leaves that mode out of its own `modes` is a `FAIL`: a slow
check cannot take itself out quietly.

## The contract every module follows

A module is one file, `tools/gate/<id>.mjs`:

```js
export const id = 'fences';                             // the file's name
export const modes = ['quick', 'milestone', 'baseline']; // which runs it is part of
export async function run(ctx) { ... return result; }
```

`ctx`:

| Field | What it is |
|---|---|
| `root` | The repo, an absolute path. |
| `mode` | `'quick'`, `'milestone'` or `'baseline'`. |
| `milestone` | The milestone's number, or `null` (`--milestone none`, or a branch that is not a milestone's). |
| `base`, `head` | Full commit ids. |
| `dirty` | True when something is not committed (a milestone run's own two report files do not count). |
| `cache` | The cache directory (below). Everything a module writes goes here, never into the repo. |
| `plan` | This milestone's entry of `milestones.json`, or `null`. |
| `stored` | This module's section of `docs/visual-overhaul/RATCHETS.json`, or `undefined`. |
| `seed` | True under `--seed`. |
| `log(line)` | Prints a line under the module's name. |
| `sh(cmd, opts)` | Runs a shell command in the repo and resolves `{ code, stdout, stderr }`. It never throws. Options: `cwd`, `env`, `timeoutMs`, `input`, `onData`. |
| `vitest` | `{ head, base }`: the path of the head's vitest JSON (null if this run has none: a part run that left the tests out), and of the base's, `<cache>/<base>/vitest.json`, if it exists, else null. Making the base's is the `ledger` module's work. Both name their files from the repo's root (below). |

Beyond the contract, for a module that needs them: `ctx.branch`, `ctx.partial` (a part run), and `ctx.steps`, how the
runner's own steps went: `{ types, tests, build, 'build-server' }`, each `{ ran, ok }`.

The result:

| Field | What it is |
|---|---|
| `ok` | True or false. Required. |
| `summary` | One line. A module that could not do its work returns `ok: false` and a summary that starts `NOT RUN:`. |
| `lines` | Detail for the `.md`, an array of strings. |
| `data` | Anything, for the `.json`. No times, no absolute paths. |
| `measured` | An object of numbers, any depth: the ratchets (below). |
| `seedWith` | What to store under `--seed` where it is not simply `measured`: the same shape, each leaf a number or `{ "min": n }`. |
| `decisions` | Strings for "Decisions for Brian". |
| `human` | Open human checks, as strings. |

The `pictures` module may put lists of shot ids in its `data` for the report's own section: `changed`, `unexpected`
(changed and not declared) and `unchanged` (declared and not changed). The rule it applies is the plan's (file 16,
section 4.1 d): under `--milestone NN` a change outside `ctx.plan.shots` fails and a declared shot must change; under
`--milestone none` (`ctx.milestone === null`) a change is listed, not failed; under `--baseline` head is the base, so
nothing can have changed yet and a declared shot is not asked to.

Shared helpers live in `tools/gate/lib/`. `lib/painted.mjs` (with `png.mjs` and `determinism.js`) is the one way any
tool builds, serves, opens and photographs the painted game, and holds the base checkout (the only git command in the
gate that changes anything). The runner does not import it. `lib/sh.mjs`, `lib/git.mjs`, `lib/ratchets.mjs` and
`lib/report.mjs` are the runner's; `lib/vitest.mjs` is shared by the runner and the `ledger` module (below).

## What a module's author has to know

Found by writing a throwaway module and a browser script against the runner and the helper on 2026-11-16.

- **The id has to be in `MODULES` before anything runs it.** `--only <id>` knows only the names in that list, so a
  module being written is tried the way it is added: the file, the line in `gate.mjs`, then
  `npm run gate -- --milestone none --only <id>`. A part run leaves the tests and builds out: half a second for `size`.
- **Never write into the repo.** Every run ends by reading `git status` again; a path that was not there at the start
  fails the run as "nothing left behind", whichever module left it. Shots, reports, builds and base checkouts go under
  `ctx.cache`. A tree's own folder there is `<cache>/<tree>` (`treeDir(root)` in `lib/painted.mjs`).
- **Never write into the base checkout either** (`<cache>/wt/<commit>`). `ensureBaseCheckout` hands it back only while
  it is at its commit with nothing changed or new in it; anything else and it is deleted and checked out again.
- **vitest's JSON names each file by its full path on the disk it ran on**, and the head, the base checkout and a
  report cached on the build server are three different places. So every report the gate keeps names its files from
  the repo's root (`src/skin/__tests__/a.test.ts`). The runner does that to the head's; whoever makes the base's does
  it too, straight after vitest has written it: `relativeNames(file, baseCheckoutDir)` from `lib/vitest.mjs`. The
  base's report is made in the base checkout (`ensureBaseCheckout(ctx.root, ctx.base)`) with the same command the
  runner uses, and kept at `join(ctx.cache, ctx.base, 'vitest.json')`. A test's key is the file's name plus
  `fullName`; the 86 database tests are `skipped` at base and head alike where there is no Postgres.
- **On `main`, and under `--baseline`, the head is the base.** With a clean tree both have the same key and so the
  same folder in the cache: `<cache>/<commit>`. Keep what is the base's and what is the head's under different names
  there (`shots/base`, `shots/head`), and make the head's afresh every run, or the gate compares a file with itself.
- **Where pictures go.** As `.png` files under `<cache>/<tree>/`, outside `dist-gate`. The build server keeps
  `<cache>/<base commit>/` and `<cache>/fonts/` between runs and uploads every `.png` under the cache but those under
  `wt/` and `dist-gate/`.
- **A check that could not run says so.** Return `ok: false` with a summary that starts `NOT RUN:`. `ctx.steps` says
  how the runner's own steps went: a module that reads `dist/` looks at `ctx.steps.build` first, as `size` does (a
  build that failed leaves the last good `dist/` lying there).
- **Close what you open, and know that the gate does not wait for it.** When the verdict is printed the gate ends.
  A preview server started with `serve` and a browser started with `launch` end with it (measured: a module that left
  both open; nothing was left running).
- **The plan's list of ratchets has to be somebody's `measured`.** Plan file 16, section 4.1 f, wants in
  `RATCHETS.json`: the gzipped JavaScript (`size`); the kit audit's counts and its `allow.json` entries; the exemption
  count; triangles, draw calls, programs, contexts and buffer megabytes per screen and tier; hex literals per rebuilt
  file; the kit audit's `small-text` count; coplanar area and loose pieces per scene; the middle-dot count; the test
  count. The runner stores a number only when a module hands it in.

## Ratchets

`docs/visual-overhaul/RATCHETS.json` holds one section per module: the numbers that module measured when they were
first stored. A stored leaf is a number (the measured value may not rise above it) or `{ "min": n }` (it may not fall
below it). After a module runs, the runner compares every leaf of its `measured` with the stored leaf at the same
place, and prints old value, new value and verdict for each:

| Verdict | When | Fails? |
|---|---|---|
| `same` | Equal. | No |
| `can be lowered` | Under a stored number. | No |
| `ROSE` | Over a stored number. | Yes |
| `can be raised` | Over a stored `{ min }`. | No |
| `FELL` | Under a stored `{ min }`. | Yes |
| `NO STORED VALUE` | Measured, nothing stored, and no `--seed`. | Yes |
| `seeded` | Measured, nothing stored, `--seed`: now stored. | No |
| `NOT MEASURED` | Stored, and the module did not measure it. | Yes |
| `NOT A NUMBER`, `SHAPE CHANGED`, `BAD SEED`, `BAD STORED VALUE` | The numbers do not line up. | Yes |

Rules that keep it a ratchet:

- The file is written only by the runner, and only under `--seed`. `--seed` only adds: a leaf that exists is never
  written over, whichever way the number moved. Nothing is stored from a module that failed.
- Under `--seed` the value stored is the module's `seedWith` leaf when it gave one, else the measured number. The
  measured number is then judged against what was stored, in the same run.
- Lowering a number is an edit to the file by hand, in the pull request that earned it. Raising one needs Brian's dated
  words. Either way the gate prints the change: the file's diff is a watched file, and every leaf that was let out since
  the base (raised, a floor lowered, taken out) is named under "Decisions for Brian".
- `measured` may not hold an object whose only key is `min`: that shape is how a stored floor is written.

`size` stores the limit, not today's size: `seedWith` is 751,265 gzipped bytes (ruling M4, net zero). The plan's 10 kB
reserve on top is opened only by Brian or Kai, by hand.

To seed one module without touching the others: `npm run gate -- --quick --only size --seed`.

## The report

Every run writes `<cache>/reports/<label>.json` and `<label>.md` (`quick`, `baseline`, `none`, `m03`), which is what
CI uploads. A whole `--milestone NN` run also writes `docs/visual-overhaul/reports/mNN.json` and `mNN.md`. Commit
those two unedited; CI runs the gate again on the pull request, and that run is the judge.

The `.md` is what a reviewer reads, and records what plan file 16, section 7, asks for: base and head commits; whether
`git status --porcelain` was empty; the type check; `npm test`'s counts; both builds; size; `check:scenes`; the bake
manifest; fences; the ledger; the banned list; every ratchet, stored and now; the shots that changed against the
declared list; the smoke and fault suites; open human checks; and "Decisions for Brian". The `.json` holds the same,
with each module's `data`.

Two runs of the same tree give the same report but for one field: `ranAt` is the only time in it. There are no
durations, the cache is written `<cache>`, the repo's own files are relative, and keys are in a fixed order.

The run's last lines on the screen are the same summary: every check with its verdict, every ratchet, then each
decision for Brian and each open human check written out, then the verdict.

"Decisions for Brian" always holds:

- the change, base to head, of the watched files: `docs/visual-overhaul/RATCHETS.json`,
  `src/skin/__tests__/fences.json`, `scripts/check-bundle-size.mjs`, `src/skin/audit/*.json`, `.github/**`,
  `tools/gate/**`, `docs/visual-overhaul/EXEMPT.json` (so a change to this folder, to `milestones.json` or to
  `banned.mjs` is always seen). The decision is one line a group; the report's "Watched files" section lists every
  file as new, changed, deleted or renamed, and prints the diff of each one that was there before, up to 80 lines a
  file and 400 in all, saying how many lines were left out and the command that shows them. A new file's diff is the
  file itself and is not repeated;
- every ratchet let out since the base, and every ratchet stored in this run;
- what each module handed in as `decisions`;
- for `--milestone NN`: where the plan names no shot for the milestone's work (`undeclared` in `milestones.json`), the
  questions of plan file 19 asked at this milestone, a branch that is not the plan's, and a milestone with no version
  bump or no new `CHANGELOG.md` line yet (the report records both; neither fails the gate, Kai's review holds them).

Human checks: a result is a line in `docs/visual-overhaul/human/mNN.md` that starts with the check's id (the ids are in
`milestones.json`). The report lists every open check of this milestone and the ones before it, and quotes those files
whole, which is also where Brian's answer at a stop is quoted from. A missing result fails only `--milestone 12`: the
plan prints it in every later report and lets it block the release.

## The milestone table

`milestones.json` has one entry for each milestone, 0 to 12: its branch name, the plan files of the README's run order,
the shot ids it may change, what it may replace (plan file 19, section 1), whether it stops for Brian, its human
checks, and the questions asked there. A shot is listed only where a plan file says that picture changes; where the
plan names no shot the list is empty and `undeclared` says what is missing. The file's own `about` says the rest.

## The cache

`$GATE_CACHE`, or `~/.cache/fleeced-gate`. Nothing the gate makes is left in the repo but the milestone report and,
under `--seed`, `RATCHETS.json`.

| Path | What |
|---|---|
| `<cache>/<tree>/vitest.json` | A tree's test report (the runner; the `ledger` module for the base). |
| `<cache>/<tree>/dist-gate` | A tree's gate build (`lib/painted.mjs`). |
| `<cache>/wt/<commit>` | The base checkout (`lib/painted.mjs`). |
| `<cache>/reports/` | The last report of each kind. |
| `<cache>/logs/<label>/` | What the type check, the tests and the builds printed in the last run of that kind. |
| `<cache>/locks/` | Locks, so two tools never build the same thing at once. |

It can be deleted at any time; the next run makes it again.

## Adding a module

1. Write `tools/gate/<id>.mjs` to the contract above. Use `ctx.sh` for commands and `lib/painted.mjs` for anything in
   a browser. Write only into `ctx.cache`.
2. Add its id to `MODULES` in `gate.mjs`, where it should run in the order, and to `QUICK` if `--quick` must run it.
3. Give the report a section for it in `lib/report.mjs` if it wants its own heading (without one it gets a section
   under its id).
4. Run it alone, `npm run gate -- --milestone none --only <id>`, then store its numbers once,
   `npm run gate -- --milestone none --only <id> --seed`, and commit `RATCHETS.json`.

Each of those is a change under `tools/gate/**` or to `RATCHETS.json`, so the gate puts it in front of Brian.

## In CI

`.github/workflows/painted.yml` has three jobs, whose names are the checks: `smoke` (`npm run test:painted`), `gate`
(`node tools/gate/gate.mjs --milestone NN` for a branch named `overhaul/mNN-...`, else `--milestone none`; it keeps
the base commit's part of the cache between runs and uploads the report and the shots) and `check-scenes`
(`npm run check:scenes`, which ends green at once when no scene file changed, so it is never "skipped").

Read as the build server reads it (none of this has run there yet):

- On a pull request the checkout is the merge of the branch into `main`, so the gate's head is that merge commit and
  its base (`git merge-base HEAD origin/main`) is `main` as it stood. On a push to `main` head and base are the same
  commit: every check runs, and the pictures compare `main` with itself.
- The base's folder is kept between runs together with `<cache>/fonts/`: until milestone 1 ships the fonts with the
  game they come from outside, and a base shot from an earlier run can only be compared with a head shot set in the
  same font files. The pair is saved only by a job that ended green.
- Kept base shots were made on an earlier machine. Whether software rendering gives the same pixels on every one of
  the build server's machines is not known; if a kept base shot ever differs from a fresh one of the same commit,
  keep the build and the test report and shoot the base again each run.
