# 16 · QA and acceptance

This file builds the safety net (milestone 0) and says how every later milestone is judged, stopped, released and undone. Nothing in it changes the look. It replaces the old file 16, whose tour does not exist in the repo and whose fourteen checks could not run in `npm test`.

## 1. What exists today (v0.7.4)

- `npm test` (`vitest run`, `environment: 'node'` in `vite.config.ts`): 158 files, 1,610 tests pass, 86 database tests skip without Postgres; about 110 s on 2 cores. No WebGL, no layout.
- Playwright (`playwright.config.ts`) builds `VITE_SKIN=classic` only: nothing automatic ever opens the painted game players see.
- `npm run check:floating` (`tools/floatingVoxels.ts`), `npm run dream:gate` (`tools/dreamGate.ts`), `tools/postCheck.mjs` and the bake tools run in no workflow. The dream gate passes 10 to 12 of 32 at HEAD because the first-visit form (`src/skin/onboarding/gate.ts`, `sap:age-check`) covers it. `scripts/ui-contact-sheets.mjs` and `scripts/dream-tour.mjs` wait for a "Start now" button that exists only in `src/skin/kit/KitPreview.tsx`, and exit 0 having shot nothing.
- `npm run size` (`scripts/check-bundle-size.mjs`): 750.14 kB of a 751.26 kB limit. It runs in Quality (`.github/workflows/quality.yml`), not in Deploy (`.github/workflows/deploy.yml`).
- `CONTRIBUTING.md` asks for pull requests and branch protection; 29 of the last 35 first-parent commits on `main` were direct. Its protection step names Deploy's `build` check, which never runs on a pull request (Deploy triggers on push to `main` only).
- Faults with no handling: no error boundary in `src/skin`; no `webglcontextlost` listener; no handler for a failed lazy chunk. Measured: no WebGL gives an empty `#root`; a 404 on a lazy chunk blanks the Trading Post; a 404 on the main script leaves `#boot-doors` up for ever.

## 2. Decisions that bind this file

- "Never modify existing tests. Add new tests under src/skin/ only." (`CLAUDE.md`, line 13): replaced for this work only by the named list in file 19 §1 (ruling M3).
- After touching the doors or the word bar: "check typing at the table in a browser" (`CLAUDE.md`, line 496).
- "measure like this, do not reason about it" (`CLAUDE.md`, line 1122).
- The size limit is raised only by Brian or Kai (`CLAUDE.md`, line 1365).
- Every change by pull request, reviewed by the other owner, with a `CHANGELOG.md` line and a version bump (`CONTRIBUTING.md`).
- Rulings M1, M2, M3, M4, M13, M18 (file 19).

## 3. Problems (verified)

- A painted-only break (typing dead, doors stuck, blank page) can ship unseen: no CI job loads the painted build.
- Pictures change on their own: with motion on, 23 to 25% of Home's pixels differ between two loads; under reduced motion, 0.06%.
- Budgets have been raised to pass (bundle budget 149,906 to 682,969 bytes; countryside 600,000 to 950,000 triangles).
- 60 test files changed and 17 deleted since 2026-11-04, so "never modify" is not enforced by anything.
- The harness loads only the first 149,962 of `CLAUDE.md`'s 194,108 bytes; the newest rules are cut.

## 4. Changes

### 4.1 Milestone 0: the safety net (ruling M1)

Built and green on `main` twice running before milestone 1 starts. It ships nothing to players.

**(a) Painted smoke and fault suite in CI.**
- **Where:** new `e2e-painted/playwright.painted.config.ts`, `e2e-painted/smoke.spec.ts`, `e2e-painted/faults.spec.ts`, `e2e-painted/helpers.ts`; new workflow `.github/workflows/painted.yml` with job `smoke`; script `"test:painted": "playwright test -c e2e-painted/playwright.painted.config.ts"` in `package.json`.
- **How:** build the default (painted) look with `npm run build`; serve with `npx vite preview --port 4175 --strictPort`. An init script counts WebGL draw calls and skips them, so a run takes minutes, not hours. Every case fails on any `pageerror`, any failed request, and any response whose content type does not match its extension (`vite preview` answers a missing `.js` with `index.html` and status 200).
- **Smoke cases:** first visit shows the form, answering it reaches Home; Home's doors open and every `canvas[data-engine]` gets `data-drawn`; the menu shows the no-server build's six rows (Queue, Create lobby, Counting Sheep, Practice, Tutorial, Trading Post); **type a word at the table**: Create lobby (with no server it deals a table of farm sheep), Sit down, wait for `[data-tour="input"]` to accept keys, type "barn", and the letters appear in `.kit-float`; Practice starts a run on the ice; the Trading Post, the Barn Book and one item preview open.
- **Fault cases:** `getContext('webgl2')` returns null; `WEBGL_lose_context.loseContext()` on Home, `restoreContext()` after 4 s; `assets/PreviewStage-*.js` answers 404; font files blocked; `assets/index-*.js` answers 404; `localStorage` throws. Each must end on readable text, with `#root` not empty (or the pre-bundle card when the main script fails). In milestone 0 these are marked `test.fail()` (expected to fail today); milestone 1 removes every mark, and the gate fails if one remains after milestone 1.
- **Cost:** about 4 CI minutes; 0 bytes shipped. **Check:** the job is green on `main`; a scratch branch that removes `<MarkDrawn />` from `BarnTable.tsx`, or the input's `onChange` in `src/skin/components/InputStrip.tsx`, turns it red.

**(b) Branch protection.** Brian sets a ruleset on `main` (repo Settings, Branches): pull request required, one approval (Kai), no bypass, required checks: CI `test`, Quality `unit (types, tests, build)`, Quality `size (gzipped JavaScript budget)`, Painted `smoke`, Painted `gate`. One line in `deploy.yml`'s `build` job adds `npm run size` (ruling M4). HUMAN: a direct push to `main` is refused.

**(c) Fences in `npm test`** (arithmetic and hashes only, under 2 s added, ruling M18).
- `src/skin/__tests__/fences.test.ts` (new) with `src/skin/__tests__/fences.json` (new): SHA-256 of every file under `src/engine`, `src/dream`, `src/state`, `src/lib`, `src/net`, `src/auth`, `src/avatars`, `src/audio`, `src/ui`, `server`, `db`, `e2e`, plus `src/main.tsx`, `src/index.css`, `index.html`, `public/words.txt`, `public/word-frequency.txt`; `src/config.ts` is hashed with its `FESTIVE` line removed. Any change fails and names the file. Changing `fences.json` itself is printed by the gate as a Decision for Brian.
- The 42 `sap:` keys: the set found by `grep -rhoE "sap:[a-zA-Z:._-]+" src` equals the pinned list; `sap:gfx` joins it in milestone 4, named in the `CLAUDE.md` entry as a device cache.
- `src/skin/scene/__tests__/wendigoFence.test.ts` (new): SHA-256 of `public/models/wendigo.glb` is `1ff575d17e299f2053d217d7f0fb703d1e6ca75f76c7226c9be8d3845cbfa00c` and of `src/skin/table/Wendigo.tsx`, `wendigoPose.ts`, `WendigoPreview.tsx` as at `6edc7fe`; `WENDIGO_AT` is `[-9.6, -36.1]` and `groundAt(-9.6, -36.1)` is 9 (`src/skin/scene/countryside.ts`); `POV_SHOTS.desktop[2]` is position `[21.2, 2.3, 6.2]`, target `[12.5, 0.9, -2.5]`, fov 38, push `[-1.8, -0.2, 0.5]`, spill 0.4, and `POV_SHOTS.phone[2]` is position `[21.2, 3.4, 7.8]`, target `[15, -3, -1.5]`, fov 52, push `[-1, -0.1, 0.3]`, spill 0.4 (`src/skin/scene/homePov.ts`); `<Wendigo` is still mounted in `src/skin/table/FarmBackdrop.tsx`.

**(d) The picture gate: head against base, about 12 shots, no stored baselines.**
- **Where:** new `tools/gate/pictures.mjs` and `tools/gate/shots.mjs`. It compares PNGs with the PNG reader inside `playwright-core` (no new package).
- **How:** build the base (`git merge-base HEAD origin/main`, in a `git worktree`) and the head, each with `VITE_TOUR=1 vite build --outDir dist-gate` (a build that is never deployed; it adds only `?season=`, ruling M17). Shoot both in the same job, same browser, same fonts. Cache base shots by commit hash (`actions/cache`; locally `~/.cache/fleeced-gate/<sha>/`).
- **Shots** (1280 x 800 unless stated): `home-pov0-day`, `home-pov1-day`, `home-pov3-night`, `home-pov0-day@390x844`, `table-turn` (Create lobby, your turn), `table-turn@390x844`, `table-results`, `duel-start`, `dream-ready`, `dream-ready@390x844`, `bazaar-sacks`, `profile`. Plus the wendigo mask pair (§5). Names are fixed once used.
- **Determinism, every shot:** `page.clock.install({ time: '2026-11-16T12:00:00' })`; `Math.random` and `crypto.getRandomValues` replaced by mulberry32 seeded `20261116`; `reducedMotion: 'reduce'`; `&dpr=1` and `?pov=`, `&hour=` where they apply; the dream opened from the menu's Counting Sheep row (tonight's seed follows the pinned date); Chromium flags `--use-angle=swiftshader --use-gl=angle --enable-unsafe-swiftshader`; `localStorage` preset with `sap:age-check` (answered), `sap:tourDone`, `sap:settings` (name "Brian"). Wait, never sleep alone: no `.sk-doors` and no `#boot-doors`; every `canvas[data-engine]` has `data-drawn` and `isContextLost()` false; on Home `.sk-farm-fade[data-ready]`; `document.fonts.ready`; one `requestAnimationFrame`; then `page.screenshot({ animations: 'disabled' })`. Clicks use `locator.dispatchEvent('click')`.
- **Tolerance:** at most 0.5% of pixels differ by more than 24 of 255 and no 16 x 9 tile's mean differs by more than 3. Milestone 0 shoots each shot ten times and records its own noise; a shot's tolerance is four times that noise, never looser than the figures above.
- **Rule:** each milestone file lists the shot ids it may change. A change in any other shot fails. A declared shot must change, and its pair is attached for a person to judge.
- **Cost:** 10 to 15 CI minutes. **Check:** green twice on unchanged `main`; a 40 px change in one scene fails exactly that scene's shots.

**(e) One `npm run gate`.**
- **Where:** new `tools/gate/gate.mjs`; `"gate": "node tools/gate/gate.mjs"` in `package.json`. It imports each check as a module (`fences`, `ledger`, `ratchets`, `banned`, `pictures`, `scenes`, `size`, `counts`) and writes one report, `docs/visual-overhaul/reports/mNN.json` and `mNN.md`.
- **Modes:** `--baseline` (run on the base, must be green before work starts); `--quick` (types, `npm test`, size, ledger, banned: for every commit); `--milestone NN` (everything). CI's job `gate` runs `--milestone`.

**(f) `docs/visual-overhaul/RATCHETS.json`** (new). Numbers only fall without Brian's dated words: total gzipped JS (limit 751.26 kB, net zero per ruling M4, plus the 10 kB reserve only Brian or Kai may open); the kit audit's counts (`src/skin/audit/budget.json`) and `allow.json` entries; the integrity exemption count (file 18); per screen and tier, triangles, draw calls, programs, contexts and buffer megabytes from file 17's probe; per rebuilt file, hex literals (file 01 §4.4); the kit audit's `small-text` count; coplanar area and loose pieces per scene (file 18); the middle-dot count (52); test count. The gate prints the diff of `RATCHETS.json`, `fences.json`, `scripts/check-bundle-size.mjs`, `src/skin/audit/*.json`, `.github/**` and `tools/gate/**` as Decisions for Brian.

**(g) Test-name ledger (ruling M3).**
- **Where:** new `tools/gate/ledger.mjs`; new `tools/gate/replaceable.json`.
- **How:** run `npx vitest run --reporter=json --outputFile=.gate/vitest-<sha>.json` at base and head. Every test (file plus full title) at base must exist at head, pass, and not be `skip` or `todo`, unless its file is listed for this milestone in `replaceable.json`. A fence test checks that `replaceable.json` equals the list in file 19 §1. Never replaceable: see file 19 §1.

**(h) Bake manifest.** File 18 owns `tools/bake/baked.json` (new file) and its test. Here: `npm test` fails when a baked picture's model hash is stale, and names the command.

**(i) `check:scenes` CI job.** `"check:scenes"` in `package.json` runs `tools/scenes/check.ts` (new file, specified in file 18) (connectivity fine and coarse with no y ≤ 0 pass, placement gaps ±0.02 m, coplanar ratchet, lens clearance 1.0 m, the wendigo hash and rays). Job `check-scenes` in `painted.yml` runs on pull requests touching `src/skin/scene/**`, `src/skin/voxel/**`, `src/skin/table/**` or `src/skin/dream/**`; about 5 minutes.

- **Do not (milestone 0):** build `/next/` deploys, file or line caps, per-milestone path lists, or a gallery tour build. Do not repair the old dream gate: milestone 9 replaces it; until then the two dream shots guard the dream.

### 4.2 The fourteen checks, rewritten

| # | Old check | Now | Runs in |
|---|---|---|---|
| 1 | Terrace test | Per-model budget of failing lines that only falls; necks, tails, manes, horns, ears, hat, bomb skins exempt by name (file 03) | `npm test` |
| 2 | Scale | One exported scale chart the scenes import; projection tests per shot (files 04, 18) | `npm test` |
| 3 | Text size | Kit audit kind `small-text` (resolves tokens and `font:` shorthands), count only falls; the gate measures computed size times ancestor scale on its shots, floor 11 px, offenders by selector | `npm test`; gate |
| 4 | Time of day | Unit test on the grade tables: fog and sun colours differ pairwise by ΔE76 15 or more (today dawn and dusk share a sun colour); the sun's direction is identical at every hour; fill and exposure inside file 02's bounds | `npm test` |
| 5 | Palette | Hex literals per rebuilt file only fall (file 01 §4.4) | `npm test` |
| 6 | Calm area | Report only: 8 px blocks with luminance sd under 6 of 255, printed per shot; the three-second test decides | gate (report); HUMAN |
| 7 | Overlap | By state, not frame: in `table-turn` and `table-results`, the DOM boxes of round tab, pegs, scoreboard, plates, bubble, word bar and announcement overlap by at most 4 px (a bubble and its own plate excepted); `barnSpot`'s projected bomb box against the word bar for 4 to 10 seats at 16:9 and 390 x 844 | gate; `npm test` |
| 8 | Framing | New `src/skin/scene/__tests__/framing.test.ts`: letter board corners, plate and speaker inside the frame for every speaker shot; Home subjects against `POV_SHOTS` | `npm test` |
| 9 | Copy | New `src/skin/__tests__/copy.test.ts`: file 19 §4's banned words in `src/skin` source; the gate checks `document.body.innerText` of each shot too. `docs/legal` and `GAME_TITLE` are out of scope | `npm test`; gate |
| 10 | Thumbnails | Bake manifest; width and height from the WebP header; transparent bakes on their dark mats, no studio backdrop | `npm test` |
| 11 | Emissive | Census through `window.__scene` (`src/skin/table/DevStats.tsx`) of emissive, additive or over-threshold materials against an allow-list (wendigo's eyes, lanterns, acts, bomb skins) | gate |
| 12 | Dream gates | Milestone 9: unit tests of the side-on mapping plus about 12 pixel gates including 390 x 450 (file 09) | `npm test`; gate |
| 13 | Lighting proof | Not a check: milestone 4's before-and-after pairs with file 17's counts beside each | HUMAN |
| 14 | Wendigo untouched | The layers in §5 | `npm test`; `check:scenes`; gate |

## 5. Integrity (nothing floats, nothing breaks)

The wendigo (ruling M13), in this order:
1. First commit of the first milestone that touches scenery: `isClear` in `countryside.ts` reads a frozen copy of today's fourteen sight lines. The whole countryside must still hash to 487,002 voxels. No visible change.
2. Then, every pull request: the four files byte-identical and the constants pinned (§4.1 c); the 12 m stand voxel-identical (80,760 countryside voxels); the view cone hashed (voxels projecting within 8% of its box from the paddock camera over the shot's travel, about 75,400); clear sight rays 134, 136 and 137 of 153 at travel 0, 0.5 and 1. Hashes are on voxels from `__voxelHook` (`src/skin/voxel/mesher.ts`), not bytes, so a vertex repack or a sliced build is not touching. Runs in `check:scenes`.
3. The gate shoots `?pov=2&wendigoDebug&hour=day` and `&hour=night` at 1280 x 800: magenta mask intersection over union with the base at least 0.98. Computer only: on a phone it stands above the frame.
4. On shot 2, light, fog, tilt-shift and the tour are identical on every live tier.

Everything else structural is file 18's.

## 6. Budget

The numbers are file 17's. This file enforces them: `RATCHETS.json` holds them, the gate fails any that rises, and only Brian's dated words loosen one.

## 7. Acceptance

**Definition of done for a milestone:**
- [ ] `npm run gate -- --milestone NN` wrote `docs/visual-overhaul/reports/mNN.json` and `mNN.md`, committed unedited. It records base and head commits; `git status --porcelain` empty; type check, `npm test` counts, both builds, size, `check:scenes`, bake manifest, fences, ledger, banned list, every ratchet old and new, shots changed against the declared list, smoke and fault suites, open human checks, Decisions for Brian.
- [ ] CI's `gate` and `smoke` checks are green on the pull request. CI's run is the judge; a hand-edited report changes nothing.
- [ ] One branch `overhaul/mNN-<name>` and one pull request, reviewed by Kai, with a `CHANGELOG.md` line and a version bump in `package.json`.
- [ ] Baked pictures the manifest names are re-baked in the same pull request.
- [ ] Where the milestone stops for Brian (■ in ruling M2), his answer is quoted in the report.

**Stop and report, without a way round, when:** a gate check still fails after two honest fixes (the third attempt may not edit the check); a ratchet would rise; a fenced file must change; a test not listed for this milestone would vanish, skip or be renamed; the plan and `CLAUDE.md` disagree on a point the entry does not name; the wendigo check fails; the browser, the bake or the gate cannot run where you are; a human check this milestone depends on has no result.

**Rollback:**
```
git tag overhaul-mNN-base origin/main     # before the merge
# merge the pull request with a merge commit (never squash), then:
git tag overhaul-mNN <merge commit>
git revert -m 1 <merge commit>            # to undo, through its own pull request
```
No saved-data format or server changes, so a revert strands no save. Revert later milestones first.

**Devices** (A: must play well; B: must fail with a clear message, never a blank page):

| | Device | Browser |
|---|---|---|
| A1 | School Chromebook, Celeron N4020 or N4500, 4 GB, 1366 x 768 | Chrome |
| A2 | Windows laptop, Intel UHD or Iris Xe | Chrome, Edge |
| A3 | iPhone, three to five years old (low-power mode caps 30 fps) | Safari |
| A4 | iPad 9th or 10th generation | Safari |
| A5 | Mid-range Android (Mali or Adreno 6xx) | Chrome |
| A6 | MacBook, M-series | Chrome, Safari |
| B1 | iPhone or iPad on iOS 15 | Safari |
| B2 | Chromebook past its update date (Chrome under 111) | Chrome |
| B3 | WebGL off or blocked | any |
| B4 | Two-GPU laptop on battery | Chrome |
| B5 | 120 or 144 Hz screen | Chrome |
| B6 | Desktop Firefox | Firefox |

CI stands in only for B3 (fault suite) and for load times under CPU throttling. Frame rates and batteries come from people.

**The five-minute friends' test** (milestone 1 stops on at least one A1 or A2 result):
1. Close other tabs; note the battery. Open `https://fleeced.io/?report=1` and count seconds until the doors open.
2. Press **Copy device report** and paste it to Brian.
3. Screenshot the start screen after ten seconds.
4. Practice, Start run, type three words; screenshot on your turn.
5. Let the bomb go off: did anything vanish, flicker, turn grey or show a torn-picture icon? One sentence.
6. Trading Post, Barn Book, press any picture; screenshot.
7. After five minutes, note the battery again, and whether the device got hot or loud.

Results go to `docs/visual-overhaul/human/mNN.md` (who, device, date, answers). A missing result is printed in every later report and blocks milestone 12.

**Risk register (top 15)**

| # | Risk | L | I | Guard |
|---|---|---|---|---|
| 1 | The coder works from the cut-off part of `CLAUDE.md` and undoes a decision | H | H | Entry at the top (file 19); banned list in the gate |
| 2 | A painted-only break ships (typing dead, doors stuck, blank page) | H | H | Smoke and fault suite required |
| 3 | A half-done look goes live; open tabs blank at a deploy | H | H | Protection; fail-soft in milestone 1 |
| 4 | Performance gets worse unseen | H | H | `RATCHETS.json` counts; friends' test |
| 5 | Model tests rewritten wholesale; a floating part returns | H | H | Ledger; never-replaceable list |
| 6 | A budget raised to pass | H | M | Ratchets; watched files |
| 7 | Baked pictures stale | H | M | Bake manifest in `npm test` |
| 8 | Tools rot outside CI | H | M | Only what CI runs is built |
| 9 | Human checks never happen | H | M | Forms in `human/`; block milestone 12 |
| 10 | The wendigo changes by a side door (camera, pines, light) | M | H | §5 layers |
| 11 | Engine, timers or saved data touched | M | H | Hash fences; 42 keys |
| 12 | Kai's parallel work collides (`PaintedHome.tsx`, `skin.css`, `CLAUDE.md`) | H | M | Rebase at each start; re-shoot base |
| 13 | The size limit blocks fail-soft | M | H | Question 9 (word-of-the-day notes to JSON); 10 kB reserve |
| 14 | Picture gate flakes and is switched off | M | M | Reduced motion, pinned clock, measured noise |
| 15 | A whole milestone lands as one commit: no bisect | H | M | Commits of at most 300 lines, each passing `--quick`; merge commit per milestone |

## 8. Decisions for Brian

- Question 11 (Kai's agreement and reviews) blocks milestone 0. Recommended: yes, before any branch is cut.
- Question 10 (the test replacement list) blocks the milestones that replace a listed test. Recommended: approve the list in file 19 §1 and no other.
- Turn on the branch ruleset in §4.1 (b). Recommended: yes; it is the repo setting `CONTRIBUTING.md` already describes, with checks that run on pull requests.
