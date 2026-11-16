# 10 · Trading Post, the fair machine and item art

The Trading Post, its market stall and the fair machine are as Brian asked for them. This file changes no art and no timing. It fixes text that is cut off for good, keeps the item thumbnails honest when models change, and asks Brian one question about the machine's speed. Ships in milestone 10.

## 1. What exists today (v0.7.4)
- The Trading Post is `src/skin/shop/Bazaar.tsx` (tabs Feed Sacks, Bell Shelf, Missions, Barn Book) in the plank-wall room.
- Item art is a transparent 256 × 256 WebP (`public/shop/*.webp`) on a stage mat, `.kit-pic-mat` (`src/skin/styles/kit.css:518`): a tan wall, a darker floor band, a soft ground shadow. There is no pink-to-green gradient anywhere: the old plan saw the page's sky behind dev-only thumbnail pages that players never load.
- The 8-bit fuse sound is "Tin toy" (`src/skin/shop/catalog.ts:52`); every sound card already has Listen (`src/skin/shop/ItemCard.tsx:80`).
- The Bell Shelf shows its items and "More soon" slips (`Bazaar.tsx:192`), as the refine plan Brian ordered built them.
- The fair machine (`src/skin/shop/FeedSacks.tsx`): `REEL = { tile: 104, strip: 38, stop: 31, lead: 7, rest: 3 }` (`:183`), `SPIN_MS = 3800` (`:184`), `NEAR_MISS = 0.15` (`:191`), ease `1 - (1 - t) ** 5` (`:226`), a 260 ms start delay (`:295`). A click or Esc skips to the result (`:310-324`). Measured: the prize tile is under the pointer from 2,837 ms; the prize card shows at 4,176 ms.
- Barn Book card text is one line with an ellipsis (`.sk-card-label p`, `src/skin/styles/skin.css:1227`); mission goals too (`.sk-miles-goal`, `skin.css:1344`).

## 2. Decisions that bind this file
- 2026-11-12, Brian: "make the lootbox opening more similar to like a casino style" (CLAUDE.md:709-710).
- 2026-11-12: "He liked the sack opening (the fair machine): leave it as it is" (CLAUDE.md:771).
- 2026-11-12, Brian on the near miss: "less frequent ... remove the text ... make it also go close to other stuff too"; `NEAR_MISS` is 0.15 (CLAUDE.md:763-765).
- 2026-11-12: item art "always sits on a dark tile ... because pale bursts and ice vanish on cream paper" (CLAUDE.md:740).
- 2026-11-12: "8-bit is Tin toy, Bubblegum is Heather, Confetti is Harvest Fair" (CLAUDE.md:702).
- 2026-11-12, Brian: "the tabs look horrendous ... dont use the basic pin thing"; the tabs are four wooden boards (CLAUDE.md:769-781).
- Thumbnails stay transparent bakes on their mats; every baked picture carries a manifest hash (ruling C7, file 16).

## 3. Problems (verified)
1. Barn Book descriptions are cut with an ellipsis at 1280 × 800 (5 cards on screen) and at 320 × 568; mission goals at 320 × 568. On a touch screen there is no way to read the rest.
2. Item thumbnails will go stale when the animal, bomb and burst milestones (5 to 7) change models: today's tests only check the files exist.
3. 66 endless CSS animations run while the machine is ready, 35 to 39 on the other tabs. File 15 sets the rule they must meet.

## 4. Changes

### 1. Card text readable
- **What:** Barn Book descriptions and mission goals wrap to a second line instead of ending in "…".
- **Where:** `src/skin/styles/skin.css` `.sk-card-label p` (line 1227) and `.sk-miles-goal` (line 1344).
- **How:** replace `white-space: nowrap; text-overflow: ellipsis` with a two-line clamp (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`).
- **Do not:** shrink the 16 px text, change the mats, the tabs or the stall.
- **Cost:** CSS only.
- **Check:** `node tools/postCheck.mjs` (nothing clipped at 1920 × 1080 and 390 × 844, Left and Right change tab) still passes; a painted-suite test: at 1280 × 800 no description or goal has `scrollHeight > clientHeight`; at 320 × 568 the count of such elements only falls (recorded in `RATCHETS.json`, file 16).

### 2. Thumbnails re-baked with their models
- **What:** a thumbnail always shows the model as it is now.
- **Where:** `tools/renderThumbs.mjs`, `tools/renderStall.mjs`; the bake manifest of file 16 (ruling C7).
- **How:** a milestone that changes an item's model, a bomb skin or a burst re-runs the bake tool in the same commit; the manifest test fails with the command to run if a hash differs.
- **Do not:** bake a backdrop into the picture, change the camera, or replace the mats.
- **Cost:** none in the bundle; WebP bytes may differ by a few kB.
- **Check:** `npm test` (the manifest test).

### The fair machine
No change. `SPIN_MS`, the easing, `NEAR_MISS`, the odds, the roll and the housing stay exactly as they are. One speed offer goes to Brian (section 8).

## 5. Integrity (nothing floats, nothing breaks)
- Re-baked thumbnails keep transparent corners (alpha 0) and the subject centred on the mat's floor band; the manifest records the camera and light constants.
- No baked picture may be older than its model's voxel hash (file 16).

## 6. Budget
The Trading Post pauses the farm behind it (`paused={bazaar || boards}`, `src/skin/screens/PaintedHome.tsx:410`): 0 draw calls while open. The closer look (`src/skin/shop/Preview.tsx`) is one extra canvas, as today. Endless CSS animations: the counts above may only fall (file 15). Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] `node tools/postCheck.mjs` passes.
- [ ] Card-text test passes at 1280 × 800; the 320 × 568 count has not risen.
- [ ] Bake manifest test green in `npm test`.
- [ ] `FeedSacks.tsx` constants unchanged unless Brian answers yes below (a fence in `npm test` pins `SPIN_MS`, `NEAR_MISS` and `REEL`).
- [ ] HUMAN: Brian opens one sack and sees no change.

## 8. Decisions for Brian
- The fair machine: should the reel run a little faster, `SPIN_MS` 2600 ms with a cubic ease in place of 3800 ms with a fifth-power ease, so the prize shows about 3.0 s after the lever instead of 4.2 s, with the near miss and everything else unchanged? Recommended: keep it as it is unless you find the wait long; the log of 2026-11-12 records that you liked it: "leave it as it is".
