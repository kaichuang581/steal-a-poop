# 08. Method, budgets and acceptance

How each milestone is run, what Brian is shown, what numbers must hold, and when to stop.

## 1. The milestones

■ means: stop after the pull request and wait for Brian's answer on the pairs before starting the next milestone.

| # | Name | Files of this plan | What is built | Stop |
|---|---|---|---|---|
| M0 | Inventory | All | No game change. Read `CLAUDE.md` to its last line. Find every anchor (file 05, section 2) and every file and constant this plan names in the working tree; write `docs/miniature/anchors.md` and `docs/miniature/inventory.md` (name in the plan, name in the tree, same or changed). Run the wendigo check on the untouched tree. Add `tools/miniature/shots.mjs` and `ladder.mjs`; save the "before" pictures. Record the starting numbers of section 3 | ■ only if section 7 says stop |
| M1 | Light | 02 | Changes A to E on Home by day and dawn; the `?light=` switch; the wendigo visibility check of file 05, section 1.5 | ■ |
| M2 | Solid colours | 03; 07 section 2 | `paint.ts`; the repaint of `farmstead.ts`, `yard.ts` and the barn itself (`barn.ts`: Home shows its walls, doors and inside); solid snow, clean drifts, whole caps; chunky structure; sharp edges | ■ |
| M3 | Micro system and the proof corner | 04; 05 sections 7 and 8.1 | `micro.ts`, `microKit.ts` (the whole kit), `farmMicro.ts`, the mesher's `near` option, the distance rule, the ground shade map, the preview page, the `workCorner` cluster | ■ |
| M4 | Micro round the barn | 05 sections 4 and 8.2 to 8.5 | Clusters `toolCorner`, `tractorSide`, `henCorner`, `gate` | |
| M5 | Yard and country | 05 sections 3, 8.6 to 8.8 and 9 | The two tracks; clusters `pondSide`, `porch`, `flockSpot`; the country in front of the line | |
| M6 | Animals and season | 06 | Animal colours with value steps; worn items; the season's decorations; the baked pictures baked again | ■ |
| M7 | Other scenes | 07 sections 3 to 9 | The podium, ice, pen, dream, bedroom, leaderboard stage | ■ |
| M8 | Finish | This file, section 6 | The full gate once; the numbers table; clean-up; `CLAUDE.md` | |

M3 is called the proof because it is the first time the finished look exists in one place: the doorway shot with the new light, solid colours, chunky walls, micro objects and ground shade together. If Brian does not like that picture, the plan stops there and nothing later has been spent.

## 2. What every milestone does

1. **One branch and one pull request per milestone**, named `miniature/m3-micro` and so on, reviewed by Kai, as `CLAUDE.md` requires.
2. **Read before writing.** Open each file this milestone edits and read it whole. This plan was written against v0.8.0; where the working tree differs, keep the plan's intent and write the difference into the pull request under "Deviations".
3. **While working:** `npx tsc -b` and the tests of the folders touched.
4. **Before the pull request:**
   - `npx tsc -b`
   - `npm test`
   - `npx vite-node tools/scenes/check.ts -- --only wendigo` (file 05, section 1.6). Never skipped for anything that touches Home, the land or the country.
   - `npm run check:floating`, if any cube was added, removed or moved.
   - `npx vite-node tools/bakeStamp.ts -- --check`, if a model that has a baked picture changed (animals, worn items, the door leaves). Bake stale pictures again with their own tool; never stamp by hand.
   - `npm run size`. The bundle limit may be raised by what this plan needs (Brian, 2026-11-17). Say by how many bytes and why.
   - The pictures of section 4.
5. **Not per milestone:** `npm run gate`. It runs once, in M8 (Brian, 2026-11-16).
6. **The pull request says:** what changed in one paragraph; the pairs; the numbers of section 3 for this milestone; each check and its result; deviations from the plan; anything left for Brian to decide.
7. **Commit messages** for models carry the ten checks of file 04, section 7, one line each.

## 3. Budgets

### 3.1 Starting point

Measured on the pushed v0.8.0, High tier, 1280 x 720. M0 measures the same on the working tree with the game's own counter (`DevStats`) and those numbers replace these.

| Scene | Triangles | Draw calls | Memory |
|---|---|---|---|
| Home, shot 1 (whole farm) | 2,390,000 | 513 | 174 MB |
| Home, shot 0 (doorway) | 1,650,000 | 272 | |
| Home, shot 1, Low tier | 1,670,000 | | |
| Barn table, seven players | 1,130,000 | 143 | |

### 3.2 Rules

1. **No Home shot ends above its starting triangles or draw calls** on any tier. Chunky structure lowers them; the micro layer may use at most what file 04, section 4 allows.
2. **The barn table may not end above its starting triangles or draw calls** (its barn changes no cube; its yard becomes chunky, which lowers them; the micro layer is not mounted there). **Every small scene ends with exactly the numbers it started with** (M7 changes no cube).
3. Memory on Home may rise by at most 4 MB (the ground shade map and the micro layer).
4. The farm's build time may rise by at most 200 ms on the computer the pull request is made on. Name the computer.
5. Frame time on Home, on the same computer, may not rise on any shot. Measure shots 0 and 1 before and after each of M1, M2 and M3.
6. If a rule is missed, fix it in the same milestone. If it cannot be fixed without breaking file 01's rules, stop and ask.

## 4. The pictures Brian looks at

Every picture is saved by `tools/miniature/shots.mjs` (file 04, section 7). A pair is the "before" picture and the "after" picture of the same shot, same hour, same size, side by side in one image. Pairs go into the pull request and into `docs/miniature/review/`.

| Milestone | Pairs | What Brian decides |
|---|---|---|
| M1 | Day: shots 0, 1, 5, 7. Dawn: shots 0, 1. Phone, day: shots 0, 1. The three `?wendigoDebug` pairs with their magenta counts | Decision 1 (the new day light). Decision 5, only if a count rose |
| M2 | Day: all eight shots. Shot 0 and shot 4 with `CHUNKY` on and off. Shot 0 and shot 5 with `?voxels=sharp` and `?voxels=round`. Shot 1 and shot 6 with `SOLID_SNOW` on and off. Dusk and night: shots 0 and 1. The barn table with seven players, by day and at night, computer and phone | Decisions 2, 3, 4, 7 and 8 |
| M3 | Shot 0 before and after. `sheet-kit.png`. `cluster workCorner`. Shot 0 with `?shade=off` and on | Whether the look is right: go on, or stop |
| M4, M5 | The shots each cluster is seen in; `sheet-home.png` | Nothing, unless something looks wrong |
| M6 | The animal sheet before and after; the shop's grid before and after | Decision 6 |
| M7 | One pair per small scene | Whether each scene still looks right |
| M8 | The full tour, before M0 and after M7, day, dawn, dusk and night | Final approval |

## 5. Tests: what may change

| May be updated, in the commit that causes the change, with old and new numbers in the commit message | Never edited |
|---|---|
| `src/skin/scene/__tests__/yard.test.ts`, `farmstead.test.ts`, `scale.test.ts`, `slices.test.ts`: counts and colours that describe the old look | `src/skin/scene/__tests__/wendigoFence.test.ts` |
| `src/skin/scene/__tests__/zfighting.test.ts`: only by removing a real collision in the model, never by loosening the test | `tools/scenes/wendigo.pins.json`, `tools/scenes/check.ts` |
| `src/skin/table/__tests__/lightBounds.test.ts`: only the values Brian approved in decision 1, each with the date | The paddock entries of `homePov.test.ts` and `homePovFrame.test.ts` |
| `barn.test.ts`, `duel.test.ts`, `festive.test.ts`, `countryside.test.ts`: colour expectations only | Any test outside `src/skin/`; anything under `src/engine/`, `src/net/`, `src/state/`, `server/` |
| New tests: `paint.test.ts`, `micro.test.ts` (every kit object builds, is connected, and uses only ladder colours), `groundShade.test.ts` (white inside the barn, darker at a wall's foot, white behind the line) | The ratchets in `docs/visual-overhaul/RATCHETS.json` may only fall |

## 6. M8: finish

1. Run `npm run gate` once. Fix what it finds; if a fix would break a rule of file 01, stop and ask.
2. Run `npm run check:scenes` and `npm run dream:gate`.
3. Fill in `docs/miniature/numbers.md`: section 3's table, start and end, for every tier.
4. Remove switches that were only for pairs and are no longer needed. **Keep:** `?light=`, `?voxels=`, `?shade=`, `?preview=mini`, `CHUNKY`, `SOLID_SNOW`, `ROUNDED_VOXELS`.
5. List every remaining caller of `pick()` and `tone()` with the reason it remains (behind the line, or a "Keep" verdict of file 07, section 8).
6. Update `CLAUDE.md` with the standing entry of `00-README.md`, section 6, and record each of Brian's decisions with its date.
7. Save the final tour pictures.

**Done means:** every rule R1 to R10 of file 01 holds in front of the line; the wendigo check passes with the pins file untouched; no budget of section 3 is exceeded; Brian has answered every ■; the gate is green.

## 7. Stop and ask

Stop, write what was found, and wait, in each of these cases:

1. The wendigo check fails on the untouched working tree in M0.
2. An anchor of file 05, section 2 does not exist in the working tree, or `CLAUDE.md` there contains a rule this plan breaks (for example, a rule that the paddock shot's picture may not change at all: a comment in `festive.ts` suggests an earlier plan promised that for one fix).
3. The wendigo check fails after a change and the fall-back named for that change (file 03, section 4) also fails.
4. A magenta count rises (file 05, sections 1.5 and 9).
5. A budget cannot be met without breaking a rule of file 01.
6. A piece of interface text on Home fails the contrast check of file 02, section 4 at exposure 1.9.
7. A scene looks wrong under its unchanged light with the new colours (dusk, night, the table).
8. The ground shade map cannot be done in the material within 0.3 ms (file 04, section 5).
9. Anything in this plan would need a change to a rule, a timer, a bot, a score, a word list, a network call, a save, or a piece of interface.
10. The working tree already contains part of this plan's look from an earlier, unfinished plan (flat colours, block animals). Then list what exists, keep it, and apply this plan's rules on top; ask only if two versions of the same model exist.

Never "fix" a stop by loosening a test, re-pinning the wendigo, deleting a model, or adding texture.

## 8. Risks

| Risk | How likely | What limits it |
|---|---|---|
| Solid snow makes wide views look empty | Medium | The two tracks, clean drifts, a shadow for every object (file 02, Change D), ground shade. The `SOLID_SNOW` pair lets Brian keep the texture on the ground alone |
| Chunky models look cruder than the smoothed ones Brian likes | Medium | Shown as a pair in M2; one constant restores smoothing with no grain |
| Brighter exposure weakens interface text over the picture | Medium | The contrast check; exposure may fall to 1.9 |
| Thinner haze shows the wendigo on a wide shot | Low | The magenta count; that shot keeps today's haze until Brian answers |
| The ground shade's shader edit slows weak devices or changes a table picture | Low | Low tier uses a quarter-size map; white inside the barn; the stop rule |
| The micro layer shimmers at a distance | Low | The 40 m rule; multisampling is already on |
| New colours look wrong at dusk or night | Medium | Pairs in M2; the light there is not touched without Brian |
| The working tree differs from v0.8.0 more than expected | High | M0's inventory; anchors; "keep the intent, list the deviation" |
| A whole snow cap collides with a season's bulb | Low | `zfighting.test.ts`; remove the single cap cube |
| Baked pictures go stale | Certain in M6 and M7 | `bakeStamp --check` and the four bake tools |

## 9. Optional experiments (not part of the run)

These are listed so nobody builds them by accident. Each needs Brian's explicit yes and its own pull request after M8.

**E1. Screen-space corner shade on the High tier.** three.js ships `GTAOPass` (`three/examples/jsm/postprocessing/GTAOPass.js`, constructor `(scene, camera, width, height, parameters, aoParameters, pdParameters)`, tuned with `updateGtaoMaterial({ radius, distanceExponent, thickness, scale, samples })` and `blendIntensity`). Inserted after the `RenderPass` in `Effects`, on Home, High tier only, never on the paddock shot, it would darken wide corners (under eaves, between buildings) softly. Starting values: radius 0.6, samples 8, `blendIntensity` 0.6. It draws the scene a second time for depth and normals, so it must be proven to cost under 2 ms a frame on the pull request's computer, and it must not flicker as the camera drifts. Untested in this repository.

**E2. A flatter lens on the wide shots.** The reference has no perspective. Narrowing shot 1's lens from 38° to 24° and moving its camera back along its own line by 1.62 times would flatten the farm toward that look. It moves a camera near the far hills and changes what lies in frame near the wendigo, so it needs the magenta count and a look at the hills behind the camera. Never for the paddock shot.

**E3. Studio pictures in the interface.** The review page (file 04, section 7) draws each model on a floating slab against off-white, which is the reference's own framing. Those pictures could become shop or collection art. That is an interface change and is out of this plan.
