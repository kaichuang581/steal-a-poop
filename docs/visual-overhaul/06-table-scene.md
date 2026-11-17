# 06 · The barn table: canvas, framing, floor and anchors

The barn table keeps its look: floating letters, name plates, the speech bubble and the bomb's digits all stay. This file first fixes a measuring fault that draws the table about a quarter too big (milestone 1, with today's picture kept exactly). Then, in milestone 7, it gives Brian three framings to choose from and fixes the letter board that every close shot cuts off. It also calms the floor, moves the bomb off the word bar, closes the scoreboard's "botWORD" join, removes the festive layer's flicker, and ties name plates to each animal's measured head.

## 1. What exists today (v0.7.4)

- The game's root has `.sk-swoop-in` (`src/skin/screens/PaintedGame.tsx:376`): a 900 ms scale from 1.35 to 1 with fill mode `both` (`src/skin/styles/skin.css`), which leaves a `filter` on the root all game. `BarnTable` (`src/skin/table/BarnTable.tsx`) mounts `AdaptiveCanvas` (`src/skin/table/Rendering.tsx:264`) without `resize={{ offsetSize: true }}`; `src/skin/table/DuelTable.tsx:49` and `src/skin/rooms/PenStage.tsx:40` have it. So the barn canvas is measured mid-swoop: 1.21 to 1.35 times the window each way (UI, PERF, QA), anchored top-left. Today's picture is the top-left part of the composed shot, magnified. Under reduced motion it is exactly window-sized.
- Cameras: `SPEAKER_CAMERA`, `speakerShot`, `homeShot` in `src/skin/scene/layout.ts`; `SpeakerCamera` in `src/skin/table/BarnTable.tsx`. The letter board hangs from `hook = [HEAP[0], BARN.beamY − 0.15, 1.0]` and turns to the camera (`LetterBoard`, `src/skin/table/BarnTable.tsx`).
- The bomb's resting side: `barnSpot` (`src/skin/table/Bomb.tsx`) picks the side nearer the middle of the shot, through its own 16:9 camera. That is where the floating letters sit.
- Name plates and bubble: `ScreenAnchor ... above` (`src/skin/table/Anchors.tsx`) at `[seat x, nameplateY(avatar), seat z]`, outside `SeatGroup`, so they stay at the rest point when the speaker steps 0.35 m in. `nameplateY` is hand-typed (`1.26 × SHEEP_SCALE × heightRatio × drawScale`); the horse's plate floats about 70 px over its hat (VOXEL R1).
- Scoreboard: `Ledger` (`src/skin/components/Ledger.tsx`); names 18 px, second line 13 px (`.sk-ledger-name`, `.sk-ledger-sub` in `src/skin/styles/skin.css`). The old plan's "9 px" and its 14 and 12 px would shrink it.
- Floor: `floor()` in `src/skin/scene/barn.ts`: hay at y 0, tufts at y 1, 300 loose straws on top. The floor's top under the seats varies −0.01 to 0.29 m.
- Already done, the old plan asked again: the platform under the pile (`platformGeometry`), the cross beam and lanterns (`src/skin/scene/barn.ts`).

## 2. Decisions that bind this file

- 2026-11-07, "Floating letters" chosen from five mock-ups: no box under the word (CLAUDE.md:249).
- 2026-11-07, "Keep the bomb icy, and keep it on the floor" (CLAUDE.md:301).
- 2026-11-08, name plates and the speech bubble; "the name stakes and the seconds slate ... are gone"; the bubble is "additional to the typing shown" (CLAUDE.md:333-338).
- 2026-11-13, bomb skins are their own models; the digits stay (CLAUDE.md:805; `src/skin/voxel/__tests__/bombSkins.test.ts`).
- 2026-11-14, no middle dot between phrases (CLAUDE.md:1315-1317).
- "The canvas must never sit inside a transformed element" (CLAUDE.md:132-133).
- Rulings M16 (view offset, three pairs), C3 (no `red` at the barn), C11 (overlap fixed by placement), M17 (`FESTIVE`).

## 3. Problems (verified)

1. Canvas 21 to 35% too large each way; up to 1.82 times the pixels (QA, 1728 × 972 in 1280 × 720).
2. The letter board's top, with its snow, is above the frame in **54 of 54** computer speaker shots (n = 2 to 10): worst −14.8% with a true-size canvas, −18.8% with today's crop. On a phone 19 of 54 are cut at a side. The canvas fix alone does not uncrop it (SCENE R2).
3. The bomb lands over the floating letters in the middle of the frame (`barnSpot`).
4. "botANTHOLOGISTS": the space at the end of `<span>bot </span>` collapses inside the flex row `.sk-ledger-sub` (`src/skin/components/Ledger.tsx:59`).
5. Coplanar faces at the table: 9 pairs, 5.2 m², all from the festive layer (bulbs and decor 2.92 m², a strand inside the cross beam 0.87 m², a strand through a lantern) (SCENE R1 appendix H).
6. Plates and daze stars use hand-typed heights; they do not follow the 0.35 m step.
7. The floor is the noisiest surface behind every turn; Brian called it "overtexturized" (2026-11-08).

## 4. Changes

### 4.1 Canvas fix with today's picture (milestone 1)
- **What:** no visible change; about 38% fewer pixels drawn.
- **Where:** `AdaptiveCanvas` in `src/skin/table/Rendering.tsx`; `.sk-swoop-in` in `src/skin/styles/skin.css`; `src/skin/table/BarnTable.tsx` (a small `SwoopCrop` component inside the canvas); `SWOOP_CROP` (new constant) in `src/skin/scene/layout.ts`.
- **How:** `AdaptiveCanvas` passes `resize={{ offsetSize: true }}` unless the caller sets `resize`. `.sk-swoop-in` gets `animation-fill-mode: backwards`, so no transform or filter stays on the root. `SWOOP_CROP = 1.275` (the middle of the measured 1.21 to 1.35). When the swoop ran (no reduced motion), `SwoopCrop` calls `camera.setViewOffset(1.275 × W, 1.275 × H, 0, 0, W, H)` and re-applies it on every resize with the new W and H; under reduced motion it calls `clearViewOffset()`, as today. `ScreenAnchor` projects through the same camera, so plates land where they do today. `barnSpot` uses its own camera and is unaffected.
- **Do not:** change `SPEAKER_CAMERA`, `speakerShot` or any lens; apply the offset to the duel or the pen (their canvases are already right).
- **Cost:** −38% pixels at the table on motion-on devices; about 20 lines.
- **Check:** `npm test`: a projection test that `speakerShot` through the offset equals today's inflated projection within 0.5 px for n 2 to 10. `npm run gate`: on every 3D screen 3 s after `data-drawn`, the canvas box equals its parent's within 1 px and the root's `filter` is `none`; head-against-base pictures of the table unchanged.

### 4.2 Framing pairs and the letter board (milestone 7, ■ stop)
- **What:** Brian picks one of three framings; in each, the whole letter board is in frame.
- **Where:** `SPEAKER_CAMERA`, `speakerShot`, `SWOOP_CROP` in `src/skin/scene/layout.ts`; the `hook` passed to `LetterBoard` in `src/skin/table/BarnTable.tsx`; test `src/skin/scene/__tests__/tableFrame.test.ts` (new file).
- **How:** the three framings: **crop** (today, offset 1.275); **composed** (offset removed: the composed shot, subjects about a quarter smaller); **re-solved** (no offset; `speakerShot` re-solved so the speaker's median height is today's 298 px at 1280 × 800). For each, solve the board by search inside these bounds only: the hook slides along the cross beam away from the speaker, |x| ≤ 1.5 m, still on the beam; the board drops at most 0.45 m; fov within ±4° of today; `lift`, `toward`, and on phones `phoneToward` and `phoneRadius`. Single tweaks fail: dropping the board 0.45 m brings its top to 8.0% but puts the bubble over it by up to 20.9% of the frame. The projection test runs for every speaker, n = 2 to 10 (54 shots), at 1280 × 800 and 390 × 844:
  - board top with its snow at least 8% from the top; its sides inside 2 to 98%;
  - the header band (top 6%) clear of board, plate and bubble;
  - plate and bubble (a 240 × 120 px box standing on the plate anchor), board and speaker do not overlap;
  - the speaker's feet and head in frame (the existing `src/skin/scene/__tests__/speakerShot.test.ts` must still pass).
- **Do not:** remove or box the floating letters; move the plates off the heads; add a slate or stakes; change the board's look.
- **Cost:** none at run time.
- **Check:** `npm test` (`src/skin/scene/__tests__/tableFrame.test.ts`, `src/skin/scene/__tests__/speakerShot.test.ts`); HUMAN: Brian sees the three framings with the board fix as pairs. Default until he answers: crop.

### 4.3 Bomb placement (milestone 7)
- **What:** the bomb rests beside the speaker on the side away from the floating letters, still on the floor.
- **Where:** `barnSpot` in `src/skin/table/Bomb.tsx`; it gains a `phone` argument.
- **How:** project the bomb's box for each side at radius 0.42 m plus the bomb's size (1 to 3.2, `src/skin/model/bombCharge.ts`) through the turn's real shot. Pick the side whose box clears the floating letters' box (`.sk-input-bar`, measured by the browser gate at each gate size and written into the test) and the plate-and-bubble box, preferring a centre at least 25% of the half-width from the frame's centre.
- **Do not:** lift the bomb onto the table; pass `red` at the barn (C3: the cue stays the frost); change skins, digits or acts.
- **Cost:** none.
- **Check:** `npm test`: for n 2 to 10, both screens, every size 1 to 3.2, the chosen box overlaps neither the letters nor the plate and bubble.

### 4.4 Scoreboard join (milestone 3; the same commit as file 18 §4.7 item 7 and file 13)
- **What:** "bot ANTHOLOGISTS", with a visible gap; no middle dot.
- **Where:** `src/skin/components/Ledger.tsx` (drop the trailing space), `.sk-ledger-sub` in `src/skin/styles/skin.css` (`gap: 5px`).
- **Do not:** change 18 px and 13 px; add "·".
- **Cost:** none.
- **Check:** `npm test`: `src/skin/components/Ledger.tsx` has no `·`; `npm run gate`: the word's left edge is at least 4 px right of "bot".

### 4.5 Floor calming (milestone 7)
- **What:** a level, quieter hay floor; the hay tones stay.
- **Where:** `floor()` in `src/skin/scene/barn.ts`.
- **How:** no loose straw and no tuft within 0.6 m of a seat's footprint or of its 0.35 m step path; loose straws 300 → at most 120, kept to the walls and corners; hay at y 0 under every seat so the floor top under a seat is 0.00 to 0.10 m.
- **Do not:** make the floor flat-coloured; touch the platform, footprints or the back-door drift.
- **Cost:** triangles fall.
- **Check:** `npm run check:scenes`: placement gap under each seat within ±0.02 m; barn triangles below today's 231,808. HUMAN: pair in the milestone 7 stop.

### 4.6 Festive coplanar fixes (milestone 3, file 18 §4.7 item 4)
- **What:** no flicker where lights meet beams and lanterns.
- **Where:** `buildFestive` in `src/skin/scene/festive.ts`.
- **How:** strands one cell off the cross beam, lantern and fence planes. Every festive mount reads `FESTIVE` in `src/config.ts` (M17). In milestone 7, as part of the table pairs: the barn tree's baubles 0.1 m (today 0.2 m, `tree(..., bauble = 0.2)`).
- **Do not:** change the count of trees, strands or presents.
- **Cost:** none.
- **Check:** `npm run check:scenes`: coplanar area at the table falls from 5.2 m² to 0 for festive pairs, and only falls after.

### 4.7 Name plates from measured anchors (milestone 3)
- **What:** each plate stands 0.02 to 0.12 m over its animal's highest drawn voxel, hat included, and follows the speaker's step.
- **Where:** the height is file 03 §4.7 (`anchorsOf(model).plate` from `src/skin/voxel/animals/anchors.ts`, new file, replacing the typed `nameplateY`). This file owns x and z: each seat's `ScreenAnchor` (and `DazeStars`) moves inside `SeatGroup` in `src/skin/table/BarnTable.tsx`, at the model-local `plate` point over `headCentre`, so it follows the 0.35 m step and the group's scale. `src/skin/table/DuelTable.tsx` and `src/skin/rooms/PenStage.tsx` take the same point.
- **Do not:** change the plate's or bubble's look, or the Kaiyan disc's cap.
- **Cost:** none.
- **Check:** `npm run check:scenes` models stage: plate height per species (fails today for all six); `npm run gate` (`tools/gate/anchorCheck.mjs`, new file, file 18): every anchored element within 2 px of its projected point when unclamped.

## 5. Integrity (nothing floats, nothing breaks)

- Animals on the floor: gap ±0.02 m under each seat and step (`npm run check:scenes`).
- Plates, bubble and daze stars from measured anchors; DOM anchors within 2 px (`npm run gate`).
- No coplanar faces at the table; the area only falls.
- Lens clearance 1.0 m on every `speakerShot` and `homeShot`.
- Baked pictures that show the table (`public/play/casual.webp`) are re-baked if a framing change reaches them; the bake manifest fails otherwise (file 18).

## 6. Budget

- Table High: 1.8 M triangles per frame, peak, all passes (file 17). Static table mount 1.02 M after file 04's cuts.
- Draw calls at the table at rest no higher than today's 324 (UI R1).
- Pixels: at most the window's size times the device ratio cap; never more.

## 7. Acceptance

- [ ] `npm test`: offset projection equals today's; `src/skin/scene/__tests__/tableFrame.test.ts` for 54 shots on both screens; bomb side; no `·`; `src/skin/scene/__tests__/speakerShot.test.ts` unchanged and green.
- [ ] `npm run check:scenes`: floor gaps; coplanar area; lens clearance; plate heights.
- [ ] `npm run gate`: canvas box equals parent within 1 px; root `filter` is `none`; milestone 1 changes no picture; anchors within 2 px; the scoreboard gap.
- [ ] HUMAN: Brian picks a framing from the three pairs at the milestone 7 stop.

## 8. Decisions for Brian

1. Table framing: today's crop, the composed shot, or the re-solved shot? Recommended: the re-solved shot, which keeps the speaker's size and shows the whole board.
2. Word bar: keep the floating letters, as chosen on 2026-11-07, or try a boxed bar? Recommended: keep.
