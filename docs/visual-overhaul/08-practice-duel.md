# 08 · Practice (the duel on the ice): refinements

The duel on the ice is one of the game's better scenes. It gets refinements only, in milestone 7: a test that keeps the letter sign clear of the fight card and the bomb, ice toned in patches instead of per voxel, a far shore and pines built at their own coarse grid, and one middle dot removed. The tree on the ice stays unless Brian says otherwise.

## 1. What exists today (v0.7.4)

- Scene: `buildDuel` in `src/skin/scene/duel.ts` (ice spit, water, floes, shore, pines, lamps); `DuelTable` in `src/skin/table/DuelTable.tsx`, whose canvas already passes `resize={{ offsetSize: true }}` (`src/skin/table/DuelTable.tsx:49`). Cameras: `duelShot` (`src/skin/scene/duel.ts:47`), closing in with pressure 0 to 1.
- The letter board hangs from `DUEL.hook = [0, 2.9, 0]` on a post frozen into the crack between the sheep (`LetterBoard` from `src/skin/table/BarnTable.tsx`). At full pressure the board's top reaches 4.4% of the frame from the top (SCENE R1).
- On a phone the sheep fill 5 to 33% and 67 to 95% of the width: there is no room "beside the line" for the sign, as the old plan wanted.
- Fight card: `.sk-vs-slip` and `VS` at a fixed screen place (`src/skin/screens/PaintedGame.tsx:466-470`). The bot's slip reads "farm sheep · easy": a middle dot.
- Ice: `spit()` in `src/skin/scene/duel.ts` picks each top voxel's tone by `hash3(x, 0, z, 11)`, so the ice is a per-voxel checker of two blues.
- Shore and pines: `shore()` (1 m grid) and `pines()` (0.5 m) both pass through `detailed` (`src/skin/voxel/refine.ts`), which halves the cell on any non-touch device. Triangles: shore 133,056, pines 81,532, of the duel's 299,540; both sit far back in fog.
- Season: `buildDuelFestive` (`src/skin/scene/festive.ts:311-319`): one strand between the lanterns, one tree and one present at the far end.
- The red vignette sits under the HUD already (z 4 against z 20): the old plan's worry is outdated.

## 2. Decisions that bind this file

- 2026-11-07, "Restraint with the season: one Christmas tree on the farm (by the barn doors), one in the barn, one on the ice" (CLAUDE.md:193).
- 2026-11-07, floating letters; 2026-11-08, name plates, no stakes, no seconds slate (CLAUDE.md:249, 333-338).
- 2026-11-07, "Keep the bomb icy, and keep it on the floor" (CLAUDE.md:301).
- 2026-11-07, "One level of detail": far land stays coarse (CLAUDE.md:180-185).
- 2026-11-14, no middle dot between phrases (CLAUDE.md:1315-1317).

## 3. Problems (verified)

1. Nothing tests that the board stays clear of the fight card and the bomb as the camera closes in.
2. The ice reads as square tiles: tone changes every voxel (`src/skin/scene/duel.ts`, `spit`).
3. 215 k triangles are refined detail on a shore and pines nobody sees closely.
4. "farm sheep · easy" breaks the 2026-11-14 rule (`src/skin/screens/PaintedGame.tsx:470`).
5. Coplanar faces: pines against shore 4.38 m², festive bulbs against decor 0.59 m², decor against posts 0.07 m² (SCENE R1 appendix H).

## 4. Changes

### 4.1 Sign test
- **What:** the sign stays between and above the sheep, never under the fight card or the bomb.
- **Where:** `src/skin/scene/__tests__/duel.test.ts` (new cases, existing ones unchanged).
- **How:** project the board's box (with its snow) through `duelShot` for speaker null, 0 and 1, at pressure 0, 0.5 and 1, at 1280 × 800 and 390 × 844. Pass: board top at least 2% from the frame's top; board box clear of the fight card's box (measured by the browser gate at both sizes and written into the test) and of the bomb's box at every size up to `DUEL.maxBomb` (1.7). If it fails, lower `DUEL.hook` y, never move the post beside the line.
- **Do not:** move the sign off the crack; change `duelShot`'s pressure push.
- **Cost:** none.
- **Check:** `npm test`.

### 4.2 Ice toned by patch
- **What:** smooth ice with broad tone patches; the crack and snow patches stay.
- **Where:** `spit()` in `src/skin/scene/duel.ts`.
- **How:** the top voxel's tone uses `hash3(x >> 2, 0, z >> 2, 11)`, as the snow patches already do; lower layers unchanged.
- **Do not:** make it one flat colour; change the spit's outline or the crack.
- **Cost:** none.
- **Check:** voxel count unchanged (`npm run check:scenes`); HUMAN: pair at the milestone 7 stop.

### 4.3 Shore and pines unrefined
- **What:** the far bank and its pines at their authored grids; at that distance and in fog they read the same.
- **Where:** `shore()` and `pines()` in `src/skin/scene/duel.ts`: build `g.map` at `g.size` without `detailed`.
- **How:** about 215 k to about 55 k triangles. Fix the pines-against-shore coplanar faces in the same commit by planting each trunk one cell into the bank.
- **Do not:** touch the spit, floes, lamps or water.
- **Cost:** −160 k triangles on computers.
- **Check:** `npm run check:scenes` (duel coplanar area falls; connectivity fine and coarse); the picture inside the gate's tolerance, else a pair for Brian.

### 4.4 Fight card without a middle dot
- **What:** "farm sheep" and "easy" as two tags side by side.
- **Where:** `src/skin/screens/PaintedGame.tsx:470` (`.sk-vs-farm`); a gap rule in `src/skin/styles/skin.css`.
- **Do not:** change the slips, the VS or the font sizes.
- **Cost:** none.
- **Check:** `npm test`: file 13's middle-dot ratchet (39 lines today) falls by one; the fight card has no `·`.

### 4.5 Festive coplanar
- **What:** no flicker on the strand and posts.
- **Where:** `buildDuelFestive` in `src/skin/scene/festive.ts`.
- **How:** strand one cell off the lantern and post planes. The tree and the present stay where they are.
- **Cost:** none.
- **Check:** `npm run check:scenes`: festive pairs on the duel at 0 m².

## 5. Integrity (nothing floats, nothing breaks)

- Both sheep whole and on the ice at every pressure (existing `src/skin/scene/__tests__/duel.test.ts`).
- Name plates from measured anchors, as at the table (file 06 §4.7); DOM anchors within 2 px (`npm run gate`).
- The bomb's `duelSpot` rest point on the ice: placement gap ±0.02 m (`npm run check:scenes`).
- Connectivity, coplanar area and lens clearance per file 18.

## 6. Budget

- Duel static: about 140 k triangles after 4.3 (today 299,540); only falls.
- Draw calls and lights no higher than today (file 17); no new light.

## 7. Acceptance

- [ ] `npm test`: sign cases pass at both sizes; no `·` in the fight card.
- [ ] `npm run check:scenes`: duel coplanar area 0 for festive and pines pairs; connectivity fine and coarse; duel triangles under 150 k.
- [ ] `npm run gate`: anchors within 2 px.
- [ ] HUMAN: Brian sees the ice and shore pair at the milestone 7 stop.

## 8. Decisions for Brian

1. The tree on the ice (approved 2026-11-07): keep it, or move it off? Recommended: keep.
2. The strand of lights across the ice falls under the season question in file 04 (season amount outside the barn). Recommended: keep it, tidied.
