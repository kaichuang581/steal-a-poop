# Numbers: start and end (docs/miniature/08, section 3)

Start: v0.8.3 (commit 6608e99), `docs/miniature/start-numbers.json`. End: the tip of `miniature/m8-finish`. Both with
the gate's counter (`node tools/gate/counts.mjs --devices computer,phone --runs 1 --no-extras`), 102 states, on Brian's
Mac, the browser drawing in software. Memory is the scene's geometry buffers; the ground's shade map is one more texture
of 581 kB (145 kB on Low) that this figure does not hold.

## The plan's four rows

| Scene | Triangles, start | end | Draws, start | end | Buffers, start | end |
|---|---|---|---|---|---|---|
| Home, shot 1 (whole farm), High | 2,206,282 | 1,710,682 | 454 | 457 | 143.8 MB | 100.5 MB |
| Home, shot 0 (doorway), High | 1,432,386 | 1,148,451 | 239 | 245 | 105.8 MB | 70.6 MB |
| Home, shot 1, Low | 1,642,179 | 1,609,039 | 456 | 456 | 108.1 MB | 93.2 MB |
| Barn table, six seats, High (the counter's largest table) | 948,647 | 846,671 | 133 | 133 | 64.1 MB | 44.0 MB |

## Against the rules of section 3.2

1. Home's triangles are under their start on every shot, tier and device. Home's draw calls are up by 1 to 8 on High and
   Medium: the micro layer's own meshes, inside its allowance of 10 a shot (file 04, section 4). On Low, and on the
   paddock shot on every tier, the layer is not drawn and nothing rose.
2. The barn table is under its start in triangles and equal in draws. The small scenes: practice equal; the results
   board and Counting Sheep a little under in triangles (flat faces of one colour now join), draws equal.
3. Memory on Home fell on every shot (at least 4.1 MB), against an allowed rise of 4 MB.
4. Build time: the micro layer builds in 117 ms in node on this Mac; the farm's whole build in the page was not timed.
5. Frame time: not measured. This machine's headless browser draws in software, so no frame rate here means anything.

Of 924 numbers compared, 72 are over their start, every one of them a count of Home's draw calls.

## The micro layer

17,718 triangles in eight clusters and one mesh of lantern glass (limit 120,000; at most 80,000 on a shot).

## The gate (run once, `node tools/gate/gate.mjs --milestone none --base 6608e99`)

| Check | Result | What it is |
|---|---|---|
| Type check, npm test, both builds, fences, baked pictures, smoke | PASS | 1,851 tests passed, 86 skipped |
| Wendigo | PASS | Pins as they were; its mask overlaps the base's 0.996 by day and 0.998 at night |
| Size | FAIL | 771,293 gzipped bytes against the stored ratchet of 767,800. `npm run size` passes: its budget was raised by 6,000 bytes in M3, as Brian chose on 2026-11-17 for a milestone that needs it. The ratchet file is not mine to raise. Since the gate ran, the animals' value steps (2026-11-20) added about 0.26 kB (`npm run size`: 3.10 kB of headroom to 2.84) |
| Ledger | FAIL | Two existing test files are edited (`scale`, `animals`), and the animals' palette test is renamed in six species (62% to 88%). Each is a look expectation; the reasons are in M2's and M6's notes. `homePovFrame` was a third until 2026-11-20: it is restored and the model fixed instead (one fence post's snow cap) |
| Banned | FAIL, fixed | The review page set the exposure (to 1); the line is gone |
| Scenes | FAIL | Two stages had not run because a camera line the checker mirrors had changed in M1 (fixed: `tools/scenes/lens.ts`); the porch lantern hung in a bulb of the porch's string (moved). Left: same-plane faces on the farm are 1.03 m2 over their ratchet at the fine detail and 0.08 m2 at the coarse. The fine detail is now built as the coarse always was (no smoothing), whose own ratchet is 787 m2 against the fine's 722; the 0.08 is the underside of the windbreak's drift where it meets the stone wall, on the ground |
| Pictures | listed | Twelve of twelve shots changed, as they must |
| Counts | FAIL | 35 states timed out when the graphics process stalled part-way through the run. Counted again alone: 102 states, no problems (the table below) |
| Left behind | FAIL | `CLAUDE.md`, which I edited while the gate ran |

## Who still calls `pick()` or `tone()`, and why

| File | Calls | Why it remains |
|---|---|---|
| `scene/distance.ts` | 11 | The back hills, village, windmill and mountains: behind the line, untouched |
| `scene/countryside.ts` | 9 | The land's trees, scrub and wall: their colours are in the wendigo's pinned hash |
| `scene/farmstead.ts` | 4 | The field's stubble and bales (behind the line) and the fence's old paint inside the wendigo's zone |
| `scene/pen.ts`, `scene/duel.ts`, `dream/world.ts`, `dream/bedroom.ts` | 16, 10, 1, 8 | One tone a part already (`pick` no longer reads its random number); verdicts in `other-scenes.md` |
| `voxel/characters.ts` | 17 | Its own `pick` and `tone`: one solid colour a part since M6 |
| `voxel/props.ts` | 5 | Name stakes the game has not drawn since 2026-11-08; `signs.test.ts` holds their colours |
| `voxel/burstProps.ts` | 2 | A local function of that name that shades a burst prop by height, not a random pick |
| `table/places.tsx`, `table/SheepPreview.tsx` | 1, 1 | A lantern's glass (glow) and a development page's floor |
| `perf/report.ts`, `scene/placed.ts` | 6, 2 | Not colours: a browser-name parser, and two copied source lines the scene checker compares |

## Every state

| Tier | Device | State | Triangles, start | end | Draws (worst), start | end | Buffers MB, start | end |
|---|---|---|---|---|---|---|---|---|
| high | computer | home-pov0 | 1,432,386 | 1,148,451 | 239 | 245 | 105.8 | 70.6 |
| high | computer | home-pov1 | 2,206,282 | 1,710,682 | 454 | 457 | 143.8 | 100.5 |
| high | computer | home-pov2 | 1,678,290 | 1,405,702 | 280 | 280 | 128.5 | 85.9 |
| high | computer | home-pov3 | 1,305,604 | 1,039,693 | 175 | 181 | 89.6 | 58.9 |
| high | computer | home-pov4 | 995,188 | 780,052 | 146 | 149 | 61.0 | 41.8 |
| high | computer | home-pov5 | 1,071,278 | 850,480 | 161 | 164 | 67.5 | 46.9 |
| high | computer | home-pov6 | 1,604,554 | 1,336,021 | 244 | 245 | 110.1 | 76.7 |
| high | computer | home-pov7 | 2,144,078 | 1,683,281 | 439 | 447 | 140.4 | 97.8 |
| high | computer | home-idle | 716,193 | 574,226 | 239 | 245 | 105.8 | 70.6 |
| high | computer | home-profile | 716,193 | 574,226 | 239 | 245 | 105.8 | 70.6 |
| high | computer | trading-post | 0 | 0 | 0 | 0 | 105.8 | 70.6 |
| high | computer | closer-look | 2,914 | 2,914 | 7 | 7 | 116.8 | 80.0 |
| high | computer | table-4-seats | 939,759 | 837,783 | 126 | 126 | 64.0 | 43.9 |
| high | computer | table-6-seats | 948,647 | 846,671 | 133 | 133 | 64.1 | 44.0 |
| high | computer | results | 221,812 | 221,274 | 273 | 273 | 110.9 | 81.4 |
| high | computer | practice | 243,006 | 243,006 | 78 | 78 | 12.6 | 10.8 |
| high | computer | counting-sheep | 134,444 | 123,414 | 50 | 50 | 28.5 | 21.6 |
| high | computer | counting-sheep-running | 157,013 | 145,983 | 57 | 57 | 32.6 | 24.8 |
| high | phone | home-pov0 | 807,630 | 791,142 | 148 | 151 | 54.8 | 47.7 |
| high | phone | home-pov1 | 963,490 | 946,775 | 230 | 232 | 68.2 | 60.9 |
| high | phone | home-pov2 | 460,639 | 437,012 | 90 | 90 | 65.0 | 55.7 |
| high | phone | home-pov3 | 729,046 | 712,508 | 114 | 117 | 47.2 | 40.9 |
| high | phone | home-pov4 | 460,842 | 444,917 | 98 | 101 | 35.9 | 31.8 |
| high | phone | home-pov5 | 924,988 | 907,612 | 148 | 150 | 60.5 | 52.5 |
| high | phone | home-idle | 403,815 | 395,571 | 148 | 151 | 54.8 | 47.7 |
| high | phone | home-profile | 403,815 | 395,571 | 148 | 151 | 54.8 | 47.7 |
| high | phone | trading-post | 0 | 0 | 0 | 0 | 54.8 | 47.7 |
| high | phone | closer-look | 2,914 | 2,914 | 7 | 7 | 64.4 | 56.8 |
| high | phone | table-4-seats | 696,547 | 685,978 | 103 | 103 | 39.3 | 33.6 |
| high | phone | table-6-seats | 705,799 | 695,230 | 110 | 110 | 39.3 | 33.6 |
| high | phone | results | 206,215 | 205,874 | 227 | 227 | 69.4 | 57.9 |
| high | phone | practice | 213,818 | 213,818 | 72 | 72 | 10.7 | 9.1 |
| high | phone | counting-sheep | 121,918 | 118,022 | 50 | 50 | 27.5 | 21.4 |
| high | phone | counting-sheep-running | 132,213 | 128,317 | 53 | 53 | 31.6 | 24.6 |
| medium | computer | home-pov0 | 1,059,684 | 1,046,557 | 239 | 245 | 75.7 | 65.3 |
| medium | computer | home-pov1 | 1,637,670 | 1,608,788 | 454 | 457 | 108.8 | 95.2 |
| medium | computer | home-pov2 | 1,333,810 | 1,303,808 | 280 | 280 | 94.2 | 80.6 |
| medium | computer | home-pov3 | 956,756 | 937,799 | 175 | 181 | 62.1 | 53.7 |
| medium | computer | home-pov4 | 699,892 | 678,158 | 146 | 149 | 42.5 | 36.5 |
| medium | computer | home-pov5 | 770,772 | 748,586 | 161 | 164 | 48.0 | 41.7 |
| medium | computer | home-pov6 | 1,256,212 | 1,234,127 | 244 | 245 | 81.9 | 71.4 |
| medium | computer | home-pov7 | 1,595,012 | 1,581,387 | 439 | 447 | 106.5 | 92.5 |
| medium | computer | home-idle | 529,842 | 523,279 | 239 | 245 | 75.7 | 65.3 |
| medium | computer | home-profile | 529,842 | 523,279 | 239 | 245 | 75.7 | 65.3 |
| medium | computer | trading-post | 0 | 0 | 0 | 0 | 75.7 | 65.3 |
| medium | computer | closer-look | 2,914 | 2,914 | 7 | 7 | 85.7 | 74.7 |
| medium | computer | table-4-seats | 854,535 | 837,783 | 126 | 126 | 51.6 | 43.9 |
| medium | computer | table-6-seats | 863,423 | 846,671 | 133 | 133 | 51.7 | 44.0 |
| medium | computer | results | 221,812 | 221,274 | 273 | 273 | 98.3 | 81.4 |
| medium | computer | practice | 214,518 | 214,518 | 78 | 78 | 10.7 | 9.1 |
| medium | computer | counting-sheep | 134,444 | 123,414 | 50 | 50 | 28.5 | 21.6 |
| medium | computer | counting-sheep-running | 157,013 | 145,983 | 57 | 57 | 32.6 | 24.8 |
| medium | phone | home-pov0 | 807,630 | 791,142 | 148 | 151 | 54.8 | 47.7 |
| medium | phone | home-pov1 | 963,490 | 946,775 | 230 | 232 | 68.2 | 60.9 |
| medium | phone | home-pov2 | 460,639 | 437,012 | 90 | 90 | 65.0 | 55.7 |
| medium | phone | home-pov3 | 729,046 | 712,508 | 114 | 117 | 47.2 | 40.9 |
| medium | phone | home-pov4 | 460,842 | 444,917 | 98 | 101 | 35.9 | 31.8 |
| medium | phone | home-pov5 | 924,988 | 907,612 | 148 | 150 | 60.5 | 52.5 |
| medium | phone | home-idle | 403,815 | 395,571 | 148 | 151 | 54.8 | 47.7 |
| medium | phone | home-profile | 403,815 | 395,571 | 148 | 151 | 54.8 | 47.7 |
| medium | phone | trading-post | 0 | 0 | 0 | 0 | 54.8 | 47.7 |
| medium | phone | closer-look | 2,914 | 2,914 | 7 | 7 | 64.4 | 56.8 |
| medium | phone | table-4-seats | 696,547 | 685,978 | 103 | 103 | 39.3 | 33.6 |
| medium | phone | table-6-seats | 705,799 | 695,230 | 110 | 110 | 39.3 | 33.6 |
| medium | phone | results | 206,215 | 205,874 | 227 | 227 | 69.4 | 57.9 |
| medium | phone | practice | 213,818 | 213,818 | 72 | 72 | 10.7 | 9.1 |
| medium | phone | counting-sheep | 121,918 | 118,022 | 50 | 50 | 27.5 | 21.4 |
| medium | phone | counting-sheep-running | 132,213 | 128,317 | 53 | 53 | 31.6 | 24.6 |
| low | computer | home-pov0 | 1,051,843 | 1,020,899 | 228 | 228 | 74.2 | 62.9 |
| low | computer | home-pov1 | 1,642,179 | 1,609,039 | 456 | 456 | 108.1 | 93.2 |
| low | computer | home-pov2 | 1,336,074 | 1,305,278 | 286 | 286 | 93.3 | 79.7 |
| low | computer | home-pov3 | 950,423 | 920,327 | 164 | 164 | 60.6 | 51.6 |
| low | computer | home-pov4 | 700,413 | 669,207 | 136 | 136 | 41.5 | 35.3 |
| low | computer | home-pov5 | 770,937 | 739,431 | 149 | 149 | 46.9 | 40.5 |
| low | computer | home-pov6 | 1,257,235 | 1,227,091 | 234 | 232 | 81.0 | 69.5 |
| low | computer | home-pov7 | 1,599,521 | 1,566,079 | 441 | 441 | 105.8 | 90.8 |
| low | computer | home-idle | 525,922 | 510,450 | 228 | 228 | 74.2 | 62.9 |
| low | computer | home-profile | 525,922 | 510,450 | 228 | 228 | 74.2 | 62.9 |
| low | computer | trading-post | 0 | 0 | 0 | 0 | 74.2 | 62.9 |
| low | computer | closer-look | 2,914 | 2,914 | 7 | 7 | 84.0 | 72.1 |
| low | computer | table-4-seats | 845,714 | 828,718 | 111 | 111 | 51.5 | 43.8 |
| low | computer | table-6-seats | 849,922 | 832,926 | 116 | 116 | 51.6 | 43.9 |
| low | computer | results | 198,510 | 197,232 | 222 | 222 | 98.0 | 81.1 |
| low | computer | practice | 201,017 | 200,773 | 61 | 61 | 10.6 | 9.0 |
| low | computer | counting-sheep | 129,764 | 118,734 | 44 | 44 | 28.5 | 21.6 |
| low | computer | counting-sheep-running | 152,333 | 141,303 | 51 | 51 | 32.6 | 24.8 |
| low | phone | home-pov0 | 808,653 | 784,612 | 138 | 138 | 54.2 | 46.1 |
| low | phone | home-pov1 | 954,483 | 930,064 | 216 | 216 | 67.1 | 58.3 |
| low | phone | home-pov2 | 461,559 | 437,636 | 92 | 92 | 64.4 | 55.1 |
| low | phone | home-pov3 | 729,585 | 705,690 | 103 | 103 | 46.5 | 39.7 |
| low | phone | home-pov4 | 461,007 | 435,762 | 86 | 86 | 35.3 | 30.6 |
| low | phone | home-pov5 | 925,527 | 900,794 | 137 | 136 | 59.8 | 50.9 |
| low | phone | home-idle | 404,327 | 392,306 | 138 | 138 | 54.2 | 46.1 |
| low | phone | home-profile | 404,327 | 392,306 | 138 | 138 | 54.2 | 46.1 |
| low | phone | trading-post | 0 | 0 | 0 | 0 | 54.2 | 46.1 |
| low | phone | closer-look | 2,914 | 2,914 | 7 | 7 | 63.8 | 55.3 |
| low | phone | table-4-seats | 687,450 | 676,759 | 87 | 87 | 39.2 | 33.5 |
| low | phone | table-6-seats | 692,298 | 681,485 | 93 | 93 | 39.2 | 33.5 |
| low | phone | results | 182,673 | 181,718 | 173 | 173 | 69.1 | 57.5 |
| low | phone | practice | 200,317 | 200,073 | 55 | 55 | 10.6 | 9.0 |
| low | phone | counting-sheep | 117,238 | 113,342 | 44 | 44 | 27.5 | 21.4 |
| low | phone | counting-sheep-running | 127,533 | 123,637 | 47 | 47 | 31.6 | 24.6 |
