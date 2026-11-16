# 07 · The bomb, blasts and bomb skins

The bomb and the bursts were art-directed by Brian between 2026-11-07 and 2026-11-13 and are pinned by tests. This file keeps them. It allows only fixes that change no logged decision, and lists every other idea as a question. The old file's rebuild (one round base for all skins, the bomb on the platform, no digits, one explosion timing for every burst) is withdrawn.

## 1. What exists today (v0.7.4)
- Eight bomb skins, each its own model: `bombLook(id)` in `src/skin/voxel/bombSkins.ts`; the ice bomb in `src/skin/voxel/bomb.ts`. Cells per skin 498 (diamond) to 678 (gold), limit 900. What each does at rest: `src/skin/shop/bombAura.ts`, drawn by `src/skin/table/BombAura.tsx`.
- The bomb is drawn by `Bomb` in `src/skin/table/Bomb.tsx`, on the floor beside the speaker at `barnSpot` (`Bomb.tsx:22-36`). The fuse already shrinks with the clock (`Bomb.tsx:233-236`). The digits are the table's only numeric clock.
- The barn passes `red={false}` (`src/skin/table/BarnTable.tsx:224`); its last-seconds cue is the frost at the screen's edge (`src/skin/screens/PaintedGame.tsx:378-380`). The duel passes `red={pressure > 0.7}` and caps the swell at `DUEL.maxBomb` 1.7 (`src/skin/table/DuelTable.tsx:82`, `src/skin/scene/duel.ts:20`).
- The bomb's size is a mechanic: 1 to 3.2 (`bombSize`, `src/skin/model/bombCharge.ts:20`).
- Bursts are acts (`ACTS` in `src/skin/table/burstActs.ts`), drawn by `src/skin/table/Blast.tsx`; props in `src/skin/voxel/burstProps.ts`. About seven draws a burst whatever it is; lives 2.4 to 4.4 s.
- Tests: `src/skin/voxel/__tests__/bombSkins.test.ts` (ice bomb voxel for voxel :16-20; no two skins one shape :22-25; on row −5, neck at 0,6,0, width ≤ 6.6 voxels, under 900 cells :27-36; digits clear :68-76); `src/skin/table/__tests__/burstActs.test.ts` (only frost explodes :14-21; clouds ≤ 420 and 260, life 2.4 to 4.5 s :23-33).
- The old file was wrong on: "the fuse should shorten" (it does); "a rattle should be added" (it exists behind `red`); "bubblegum spheres" (no such act); `tools/renderThumbs.ts` (it is `.mjs`). It judged a rare skin (Gold) as "the bomb".

## 2. Decisions that bind this file
- 2026-11-07: "Keep the bomb icy, and keep it on the floor." (CLAUDE.md:301)
- 2026-11-13: "Bomb skins are their own models with their own effects"; Ice untouched; "Rarer skins do more"; digits stand clear (CLAUDE.md:805-823).
- 2026-11-13: floor marks are each skin's own.
- 2026-11-12: "Bursts are acts, not explosions" (CLAUDE.md:787).
- 2026-11-09: "Keep the cloud counts and the parked draws" (CLAUDE.md:775).
- 2026-11-13: the beat after a bomb, 2.4 s.
- Ruling C3: no `red={…}` on the barn bomb; the barn's cue stays the frost.
- Ruling M3: `bombSkins` and `burstActs` tests are never re-pinned.
- Ruling M6: on every live tier the bomb's spark and digits stay.

## 3. Problems (verified)
1. Turn text can sit over the bomb's digits: `barnSpot` picks the side nearer the middle of the shot (`Bomb.tsx:33-35`), where the word bar is. Owned by file 06 (SCENE-A5, KEEPER-A9); listed here because the bomb moves.
2. No test checks that a baked bomb or burst thumbnail matches its model (file 18).

## 4. Changes

**4.1 Bomb and burst models join the integrity checks.**
- **What:** no visible change.
- **Where:** `check:scenes` models stage (file 18).
- **How:** each skin's body, glow and floor mark one piece by face and edge; each burst prop one piece; the floor mark's top at y 0 under the bomb.
- **Cost:** none shipped.
- **Check:** green on all eight skins and every prop in `burstProps.ts`.

**4.2 Bomb side chosen to clear the word bar** (file 06 owns the numbers).
- **What:** the bomb rests on the side whose projected box clears the word bar.
- **Where:** `barnSpot`, `Bomb.tsx:22-36`.
- **How:** project both candidate boxes through `speakerShot`; take the clear one, else today's choice.
- **Do not:** lift the bomb off the floor, change `0.42 + r` or the swell.
- **Cost:** none at run time.
- **Check:** projection test in `npm test` for 4 to 10 seats at 16:9 and 390 × 844.

**4.3 Re-bake when a model changes.** `node tools/renderThumbs.mjs --only <id>`; stall crates with `tools/renderStall.mjs`. Check: bake manifest fresh.

Nothing else changes: not the ice bomb, the eight models, the floor, the digits, the fuse, the acts, the cloud counts, the parked draws, the beat, the board order.

## 5. Integrity (nothing floats, nothing breaks)
- Every skin stands on row −5 with its floor mark under it (existing test).
- Digits clear of the shell and no further than 0.26 m (existing test).
- Every skin, floor mark and burst prop one piece (4.1).
- Thumbnails `public/shop/bomb-*.webp`, `blast-*.webp`, and the crates `public/shop/stall/crate-bomb.webp`, `crate-blast.webp` are in the bake manifest (file 18).

## 6. Budget
A burst stays about seven draws and within 420 flame and 260 spark points and 16 props (existing test). The bomb adds no draw; the parked landing puff (`Bomb.tsx:303`) stays as it is. Table budgets as file 17: High 1.8 M triangles peak.

## 7. Acceptance
- [ ] `bombSkins.test.ts` and `burstActs.test.ts` pass unedited.
- [ ] `check:scenes`: all skins, floor marks and props one piece.
- [ ] Projection test: bomb box clear of the word bar, every seat count.
- [ ] Bake manifest fresh.
- [ ] Gate pictures of the barn bomb unchanged except where 4.2 moves it.

## 8. Decisions for Brian
1. A new bomb design (one base for all skins, on the table, no digits): recommended no; keep yours.
2. A red rattle at the barn in the last three seconds: recommended no; the frost stays the cue.
3. Reshape the Gold skin: recommended no change.
4. Cap the bomb's swell at the barn as the ice does (1.7): recommended no change; size shows how many words were played.
5. One timing and a flash for every burst: recommended no; bursts stay acts.
