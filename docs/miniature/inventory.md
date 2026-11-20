# Inventory: the plan's names on the working tree (v0.8.3, commit 6608e99)

Written in M0, 2026-11-20, by reading every name between backticks in files 00 to 08 and looking for it in `src/`, `tools/`, `scripts/`, `server/` and the e2e folders. Positions are in `anchors.md`.

Of the names that are files or identifiers: 107 files and 304 identifiers are in the tree as the plan names them; 32 files and 71 identifiers are not. The rest of the backticked text (308 items) is values, addresses and code fragments.

## 1. Not in the tree because this plan makes them

Files: `docs/miniature/anchors.md`, `docs/miniature/inventory.md`, `docs/miniature/numbers.md`, `docs/miniature/other-scenes.md`, `docs/miniature/review/tour/`, `farmMicro.ts`, `groundShade.test.ts`, `micro.test.ts`, `micro.ts`, `microKit.ts`, `paint.test.ts`, `paint.ts`, `sheet-home.png`, `sheet-kit.png`, `src/skin/scene/farmMicro.ts`, `src/skin/voxel/__tests__/paint.test.ts`, `src/skin/voxel/groundShade.ts`, `src/skin/voxel/micro.ts`, `src/skin/voxel/microKit.ts`.

Names: the ladder materials of file 01 (`barnRed`, `trimWhite`, `darkWood`, `roofBrown`, `houseCream`, `tractorRed`, `coopYellow`, `reed`, `scarfRed`, `faceDark`, `giftGreen`), the kit of file 04 (`crateOpen`, `milkCan`, `cartWheel`, `wallLantern`, `ropeCoil`, `hoistRope`, `squareBale`, `hayHeap`, `choppingBlock`, `splitLogs`, `handPump`, `eggBasket`, `skates`, `shutter`, `shovel`, `strapHinge`, `cleat`, `apples`, `carrots`, `MicroObject`, `MICRO_PLACEMENTS`), the clusters of file 05 (`workCorner`, `toolCorner`, `tractorSide`, `henCorner`, `pondSide`, `flockSpot`), the helpers of files 02 and 03 (`shotLight`, `DAYLIGHT`, `farEdge`, `CHUNKY`, `SOLID_SNOW`, `structureSteps`, `oldSnow`, `meanTone`, `seededPart`), and three.js names the tree does not use yet (`DataTexture`, `RedFormat`, `UnsignedByteType`, `LinearFilter`, `GTAOPass`).

## 2. Named by the plan, changed or gone in the tree

| Name in the plan | In the tree |
|---|---|
| `pathX` | gone: the lane is straight (`YARD.path`, `onPath`); see anchors.md |
| `dent()` | gone: the lane has wheel ruts drawn in `ground()`, no hoof dents; the plan's `snow` -2 dents have no cubes to take |
| `woodpile` | gone as a model: the woodshed is part of `farmhouse()`; the preview page's `woodpile` piece is the farmhouse |
| `woodpile()` | gone: the woodshed is part of `farmhouse()` in `yard.ts` |
| `byBarnBack` | not in the tree: the eave berms and lee drifts are `drifts()` in `farmstead.ts` and the low banks in `ground()` in `yard.ts` |
| `byBarnSide` | as `byBarnBack` |
| `underWalls` | as `byBarnBack` |
| `cattails` | not in the tree: v0.8.2 took the reeds off the pond ("the pond has no reeds") |
| `SKATE` | not in the tree by that name: the pond's skate marks are drawn in `ground()` in `yard.ts` |
| `WINDOW_FRAME` | not in the tree: the farmhouse was rebuilt in v0.8.2 and v0.8.3 (`HOUSE` holds its paint; `lit()` draws a window) |
| `orchardTree` | the tree has `bareTree()` and `orchard()` in `farmstead.ts` |
| `docs/toybox/` | Not on this branch. The play-set plan was built on branches `toybox/t0-inventory` to `toybox/t9-release` (cut from this same commit, never merged or pushed) and is not continued. Nothing of it is in this tree |
| `CLAUDE.md`, `00-README.md` … `08-method-and-acceptance.md`, `light-test-day.jpg` | In the tree (`CLAUDE.md` at the root, the rest in `docs/miniature/`); the search looked for them by bare name |

## 3. Facts the plan states about v0.8.0 that are different on the tree

| The plan says | The tree |
|---|---|
| Light: sun 20° up, haze 0.012 everywhere, exposure 1, ACES; snow in sun reads 174, the barn grey | v0.8.2 changed Home's light already (`DIORAMA` in `Rendering.tsx`): by day the sun is 42° up, strength 1.45, sky fill 1.1, its own fog colour, and `LOOK` (src/skin/look.ts) holds the haze and the tone mapping. The paddock shot keeps the old light through `exemptShot()`. M1 measures the tree before changing anything and keeps the plan's targets (file 02, section 4), not its starting values |
| Speckle: `tone()` and `pick()` choose per cube; `refine` adds 4% grain; snow caps have random holes | v0.8.1 and v0.8.2 took most of it out: `pick` gives one colour a part outside the wendigo's zone (`asBefore` in `palette.ts` keeps the old paint in the zone), `refine`'s grain is 0 by default, caps are whole outside the zone. What is left is three tones chosen per board, bale or tree, texture on straw and planks, and the snow's painted texture |
| `DESATURATE = 0.7` in `palette.ts` | The same |
| `ROUNDED_VOXELS = true`; every model smoothed on a computer (`detailedSteps`) | The same |
| The wendigo's pins: 487,002 country cubes | 408,004. v0.8.3 re-recorded the country's total by Brian's leave (2026-11-19) when the farm was laid out again. The stand (80,760 and 87,124), the cone (89,907; 78,779 coarse) and the rays (134, 136, 137 of 153) are the plan's. The pins as they stand in this commit are the frozen ones: no re-pin |
| `CLEAR_SIGHT_LINES` in `countryside.ts` | There, and `LATER_SIGHT_LINES` beside it for the tour shot v0.8.3 added |
| Ten yard pines; an orchard; a free-standing woodpile; cattails; a tractor by the doors; three sheep west of the house | Eight yard pines, 23 windbreak pines, eight orchard trees; the rest as anchors.md says |
| Tour shots 1, 4, 5, 7 as file 05, section 10 lists them | Re-aimed in v0.8.2 and v0.8.3 (anchors.md). Shot 5 is the farmhouse, not the tractor. The haze and shadow values of file 02 are per shot and are worked out again from today's cameras by its own formulas |
| Starting numbers: shot 1 2.39 million triangles, 513 draws; shot 0 1.65 million, 272 | Measured on the tree: section 5 |

## 4. The wendigo check on the untouched tree

`npx vite-node tools/scenes/check.ts -- --only wendigo`: PASS, as pinned over fine and coarse (countryside 408,004 / 408,004, the stand 80,760 / 80,760, the cone 89,907 / 78,779, rays 134, 136, 137 of 153).

## 5. Starting numbers (file 08, section 3), measured on 6608e99

With the gate's counter (`node tools/gate/counts.mjs`, one run, 1280 x 720, reduced motion), which reads the same draw calls and triangles `DevStats` shows. Every state at every tier, on a computer and a phone, is in `start-numbers.json`; these are the plan's four:

| Scene | Triangles | Draw calls | Buffers |
|---|---|---|---|
| Home, shot 1 (whole farm), High | 2,206,282 | 454 | 143.8 MB |
| Home, shot 0 (doorway), High | 1,432,386 | 239 | 105.8 MB |
| Home, shot 1, Low | 1,642,179 | | |
| Barn table, six seats, High | 948,647 | 133 | 64.1 MB |

The counter has no state for a table of seven; six seats is its largest. **The stored limits in `docs/visual-overhaul/RATCHETS.json` are older than v0.8.3**: on this commit 53 of them are already exceeded on the states measured (for example Home shot 6, 244 draws against a stored 198; shot 7, 439 against 333), because the gate was never run on v0.8.3. So this plan's budgets (file 08, section 3.2) are judged against `start-numbers.json`, and the gate's `counts` check will name those stored limits at M8 whatever this plan does.

## 6. Deviations from M0's own instructions

- Pictures are JPEG at quality 90, not PNG: the tour at four hours, before and after, computer and phone, is over a hundred pictures of about 1.3 MB each as PNG.
- `tools/miniature/shots.mjs` has two commands the plan does not name: `scene` (the table, the ice, the podium, the dream, the pen) and `pair` (a before and an after side by side). `piece`, `sheet` and `cluster` open `?preview=mini`, which M3 builds.
- One milestone a branch, as the plan says, but local commits and no pull request until Brian says to push: nothing of v0.8.3 is pushed (CLAUDE.md).

## 7. For Brian

1. The plan's stop rule (file 08, 7.2) names a missing anchor. One is missing as the plan knew it (the woodpile), and the farmhouse, the hens' run, the path and the tour have changed in kind. None of that touches M1 or M2. `anchors.md`, section 2 proposes a place for each cluster; M3's proof corner is the first that needs an answer, and it will be shown as a picture.
2. The stored count limits are stale (section 5).
3. `CLAUDE.md` on the tree freezes the wendigo's files, place, shot, light and pins. It does not say that no pixel of the paddock shot may change, so the plan's stop for that (file 08, 7.2) does not apply: the shot's foreground will show the new colours, as the plan says.
4. The plan's decisions 1 to 8 run on their defaults; each pair is sent when its milestone lands.
