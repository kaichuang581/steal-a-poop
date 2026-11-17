# 09 · Counting Sheep: side-on, like the dinosaur game

Counting Sheep becomes an exact side view on every device: an orthographic camera looking straight across the lane, the sheep near the left, fences sliding in from the right. The mapping below is fixed by arithmetic from the rules' own constants, so the sheep is as big as today on a computer and every device sees a fence coming at least as early as today. The rules do not change. This is milestone 9, with a stop for Brian before and after.

## 1. What exists today (v0.7.4)

- Rules (not touched): `FIELD = { width 320, ground 104, sheepX 78, sheepW 20, fenceW 12, fenceH 16 }`, `JUMP_MS` 720, `JUMP_HEIGHT` 28, `SPEED` 120 + 5 a fence to 320, `takeoffDistance` = 0.36 v − 16, `jumpHeight` = 4 × 28 × t(1 − t) (`src/dream/dream.ts:204-228`). `SPAWN_X` 344, `TYPE_X` 840 (`src/skin/dream/run.ts`), `FIRST_FENCE_AHEAD` 560 (`src/skin/dream/stage.ts:159`). The bump test: `src/skin/dream/run.ts`, overlap `fe.x < SX + SW − 3 && fe.x + FW > SX + 3` with the sheep below `FH − 6`.
- Typing opens 5.96 s before take-off at speed 120, 2.50 s at 265 (the night's last fence) and 2.01 s at 320: `TYPE_X` is far off screen on every device.
- Cameras: `DESKTOP_SHOT` is already side-on (camera x = target x, 5° down); `PHONE_SHOT` is oblique (`src/skin/dream/stage.ts:40-41`). The old plan's premise ("the camera looks down the lane at an angle", "sheep 6%") was wrong on computers.
- The drawn sheep spans logical 70.0 to 87.2; the rules' box is 78 to 98 (`src/skin/dream/DreamStage.tsx:338`, `SHEEP_SCALE` 0.5538). A bump registers with the fence 7.8 logical px ahead of the drawn nose.
- On a phone the root follows the visual viewport (`src/skin/dream/DreamScreen.tsx:55-60`) and the fov is fixed, so with the keyboard up (about 390 × 450) the sheep is 21 px tall.
- The farmer's bubble is its own canvas (`src/skin/dream/BedroomBubble.tsx`, `AdaptiveCanvas` with no `resize`), inside `.dr-bubble`, which breathes with `transform: scale(1.012)` forever (`src/skin/dream/dream.css:36-37`): today the canvas does sit inside a transformed element.
- `npm run dream:gate` (`tools/dreamGate.ts`) fails 12 of 32 at HEAD because the first-visit form dims the screenshot; with `sap:age-check` (`AGE_CHECK_KEY`, `src/skin/onboarding/gate.ts:21`) preset: 32 of 32 at 1920 × 1080, 29 of 32 at 390 × 844.
- Triangles: about 545 k (sea 248 k, hills 70 k, mountains 54 k); 61 to 62 draws at ready.

## 2. Decisions that bind this file

- This session: Counting Sheep becomes side-on "like the dinosaur game" (brief, settled 2).
- 2026-11-07: Counting Sheep's rules, `DREAM_LENGTH`, pace (CLAUDE.md:196-200); rules unchanged.
- 2026-11-07, floating letters in the dream's word bar (CLAUDE.md:249).
- 2026-11-08: "you get barely any time" (`FIRST_FENCE_AHEAD`, `src/skin/dream/stage.ts:159`).
- 2026-11-09: the wake clouds (`src/skin/dream/DreamScreen.tsx`, `src/skin/dream/WakeClouds.tsx`).
- "The canvas must never sit inside a transformed element" (CLAUDE.md:132-133).
- Ruling M15 (binding numbers below); M3 (`src/skin/dream/__tests__/stage.test.ts` framing and the 32 gates replaceable in this milestone only).

## 3. Problems (verified)

1. Side-on today exists only on computers; phones are oblique (`src/skin/dream/stage.ts:41`).
2. The drawn sheep is 10 logical px behind the rules' box: a flat side view would show it bonk on air.
3. Fences show only 0.33 s before take-off at speed 265 on a computer (0.35 s on a phone).
4. Obstacles cross the lane 2.2 m in z; seen exactly side-on, a picket fence is a 0.10 m sliver.
5. The bubble canvas is inside a transformed element.
6. The gate is red at HEAD for a reason unrelated to the dream.

## 4. Changes

### 4.1 Repair the gate and record "before" (first commit)
- **Where:** `tools/dreamGate.ts`: an init script sets `localStorage['sap:age-check']` before load.
- **How:** run at 1920 × 1080 and 390 × 844; save the 32 readings and the screenshots as the milestone's "before". Measure today's fence warning, sheep height and letter height at 1280 × 800, 1920 × 1080, 1024 × 768, 844 × 390 and 390 × 844 by projection through `dreamShot` and write them into `src/skin/dream/__tests__/sideOn.test.ts` as the floor.
- **Check:** 32 of 32 at 1920 × 1080.

### 4.2 The mapping
- **What:** one orthographic side view on every device.
- **Where:** `src/skin/dream/stage.ts` (new pure helpers `dreamSpan`, `screenX`, `screenY`); `DreamCamera` in `src/skin/dream/DreamStage.tsx` becomes an `OrthographicCamera` (three, no new dependency).
- **How:** camera yaw 0, pitch 0, looking along −z.
  - `SPAN = min(320, W ÷ 3.35)` logical px across the frame (W in CSS px); on a phone held upright, **SPAN = 240** (Brian may pick otherwise, 8.2).
  - s = W ÷ SPAN px per logical px. Screen x = (L − L0) × s with **L0 = 88 − 0.22 × SPAN** (phone 0.20): the rules' box centre (88) sits at 22% of the width (phone 20%).
  - Play strip: 96 logical px, 16 under the ground line and 80 over it. Ground line at 68% of the stage height on computers, 55% of the visible height on phones.
  - **Art scale 1.35:** sheep, obstacles and signs drawn 1.35 times their rules size, about their centre in x and z and about the ground line in y (feet and posts stay on the lane). The jump arc is drawn 1.35 times taller: drawn lift = 1.35 × `jumpHeight`. Positions, timing and hit boxes stay the rules'.
  - Fence warning (s before take-off that a fence is on screen): (8.1 + (1 − a) × SPAN − 0.36 v) ÷ v, with a = 0.22 (phone 0.20).

| Screen | SPAN | px per logical px | Strip | Sheep (with hat) | Of frame | Warning at 120 / 265 / 320 | Letters | Today: sheep; warning; letters |
|---|---|---|---|---|---|---|---|---|
| 1280 × 800 | 320 | 4.00 | 384 px | **83 px** (115) | 10.4% | 1.79 / 0.61 / 0.45 s | 42 px | 83 px; 1.17 / 0.33 / 0.21 s; 37 px |
| 1920 × 1080 | 320 | 6.00 | 576 px | 125 px (173) | 11.5% | 1.79 / 0.61 / 0.45 s | 63 px | 116 px; 1.24 / 0.36 / 0.24 s; 52 px |
| 1024 × 768 | 306 | 3.35 | 322 px | 70 px (97) | 9.1% | 1.69 / 0.57 / 0.41 s | 35 px | 67 px; 1.17 / 0.33 / 0.21 s; 30 px |
| 844 × 390 | 252 | 3.35 | 322 px | 70 px (97) | 17.8% | 1.35 / 0.41 / 0.28 s | 35 px | measured in 4.1 |
| 390 × 844 | 240 | 1.625 | 156 px | 34 px (47) | 4.0% | 1.31 / 0.40 / 0.27 s | 25 px | 40 px; 1.21 / 0.35 / 0.23 s; 25 px |
| 390 × 450, keyboard up | 240 | 1.625 | 156 px | 34 px (47) | 7.6% | 1.31 / 0.40 / 0.27 s | 25 px | 21 px; 2.96 / 1.14 / 0.88 s; 13 px |

  Phone alternatives (art 1.35): SPAN 200: sheep 41 px, 1.04 / 0.27 / 0.17 s; SPAN 220: 37 px, 1.17 / 0.33 / 0.22 s. Both give less warning than today on a phone. Phone signs are drawn at scale 2.0 (today 1.6, `signScale`) so letters stay at today's 25 px.
- **Do not:** change any constant in `src/dream/dream.ts` or `src/skin/dream/run.ts`, or `FIRST_FENCE_AHEAD`; scale the hit boxes.
- **Cost:** none at run time; about 80 lines of pure helpers.
- **Check:** `npm test` (`src/skin/dream/__tests__/sideOn.test.ts`, new file).

### 4.3 Jump clearance and the bump
- **What:** the drawn sheep visibly clears every fence it jumps, and meets the rail when it bumps.
- **How:** smallest gap between the drawn sheep's underside and the drawn fence's top while they overlap sideways, logical px, at 120 / 265 / 320 (SCENE R2, reproduced):

| Drawing | Gap |
|---|---|
| Today, with the leap's pitch | 6.7 / 11.2 / 11.4 |
| Art 1, centred on the rules' box | 8.8 / 11.3 / 11.6 |
| Art 1.35, arc as the rules | 0.6 / 5.2 / 5.6 (fails) |
| **Art 1.35, arc drawn 1.35 times taller** | **8.4 / 14.6 / 15.1** |

  Bump: the rules register it with the fence at x 95. The drawn nose is then 6.7 logical px past the fence's drawn face: the head meets the rail as the fence is knocked flat, and the existing 0.25 m recoil (6.9 logical px, `src/skin/dream/DreamStage.tsx:188`) takes it clear within 200 ms.
- **Check:** `npm test`: gap ≥ 3 logical px at 120, 265 and 320, with and without pitch (reduced motion); at the bump the overlap is at most 7 logical px and zero 200 ms later.

### 4.4 Obstacles and scenery
- **Where:** `obstacle(look)` and the layer builders in `src/skin/dream/world.ts`; `src/skin/dream/DreamStage.tsx`.
- **How:** the five looks (`rail`, `picket`, `wall`, `log`, `bale`) keep crossing the lane in z (the existing `src/skin/dream/__tests__/stage.test.ts` obstacle case stays), and their x-y silhouette fills the rules' box, 0.432 × 0.576 m, within one voxel, in one piece. Far scenery (sea, hills, mountains, islands) is rebuilt as flat parallax layers using today's scroll factors (`SEA`, `HILLS`, `MOUNTAINS`, island `factor`). Keep `cloudSea` and `island` exported for `src/skin/boards/BoardStage.tsx:10`, and `bonkStar` for `src/skin/table/BarnTable.tsx:16`.
- **Cost:** about 545 k to under 200 k triangles.
- **Check:** `npm run check:scenes` (connectivity, one piece per obstacle); triangle count in the counts gate.

### 4.5 The farmer's bubble
- **What:** the bubble stays a live scene in its own canvas.
- **Where:** `src/skin/dream/dream.css`: `dr-breathe` moves from `.dr-bubble` to `.dr-bubble-rim`; `src/skin/dream/BedroomBubble.tsx` gets `offsetSize` from `AdaptiveCanvas`'s new default (file 06 §4.1); 15 fps by the frame governor (file 17).
- **Do not:** bake it into frames; put it inside `.dr-stage` or any transformed element.
- **Check:** `npm run gate`: the bubble canvas's box equals its parent's within 1 px and no ancestor has a transform.

### 4.6 Re-solve or retire (everything tied to today's camera)
- `DESKTOP_SHOT`, `PHONE_SHOT`, `LANDSCAPE_PHONE_FOV`, `dreamShot` (`src/skin/dream/stage.ts`); the widening rule in `DreamCamera`.
- `frameOf`, `atFrame`, `islandPlace` (`box`, `phoneBox`), `islandX` (wraps by the desktop shot even on phones), `WISPS`, `dreamFrame`.
- Sky: `SKY_STOPS` by elevation ("the camera only sees 11 degrees"), stars, the shooting star, `moonFrame`, the aurora: restated by frame height.
- `DREAM_FOG` (0.012, phone 0.0085), the light's side per device, the shadow camera's box.
- `cloudSea(phone)`'s coarser copy; `signScale`; `SIGN_AT`.
- The Kaiyan disc: `discYaw` becomes 0 (it faces the camera); `DISC_MAX_H` 1.9 re-checked so the disc's top at the jump's apex stays in frame; `DISC_PITCH` kept.
- DOM tied to the frame: `PUFFS` (`src/skin/dream/stage.ts:155`), `.dr-stage` transform-origin 27% 74%, `.dr-burst` at 27% 74%, `.dr-bubble` placement (phone `min(42%, 240px)`, bottom 150 px), `.dream-z`: each moved to the sheep's new screen point or kept clear of the strip.
- Tests: the framing cases in `src/skin/dream/__tests__/stage.test.ts` and the 32 gates in `tools/dreamGate.ts`, replaced by 4.7.

### 4.7 Gates that replace the 32
- **Unit tests** (`src/skin/dream/__tests__/sideOn.test.ts`, `npm test`): SPAN, L0 and s at every gate size; the runner's centre at 22% (phone 20%) ± 0.5 logical px; the table in 4.2 within 1 px; warning at each size ≥ today's (from 4.1); letters ≥ today's; clearance and bump (4.3).
- **About 12 pixel gates** (`npm run gate`, reduced motion, seeded with `?dreamSeed=`): 1280 × 800, 1920 × 1080, 1024 × 768, 844 × 390, 390 × 844 and 390 × 450, each at ready and with a fence on screen. Each checks: the sheep's projected box holds sheep pixels and is at least the table's height − 2 px; the fence and sign are on screen when the arithmetic says so; no HUD element (floating letters, count, bubble) overlaps the sheep, fence or sign boxes; silhouette contrast against the lane at least the approved "after" reading minus 0.03.

## 5. Integrity (nothing floats, nothing breaks)

- Feet and posts on the ground line in every frame of the run cycle: drawn sheep's lowest voxel within 1 logical px of the lane when not jumping (`npm test`).
- Obstacles and the sign one piece each (`npm run check:scenes`).
- The bubble canvas never inside a transformed element; at most two live contexts while running (file 17).
- Baked share or result pictures that show the dream enter the bake manifest (file 18).

## 6. Budget

- Dream world: under 200 k triangles in view (today about 380 k); draws at ready no higher than today's 62.
- Bubble: 15 fps; stage: the global cap (file 17). Only falls.

## 7. Acceptance

- [ ] `npm test`: `src/skin/dream/__tests__/sideOn.test.ts` green; every test under `src/dream` and `src/skin/dream/__tests__/run.test.ts` unchanged and green.
- [ ] Sheep at least 80 px tall at 1280 × 800.
- [ ] No gate size gets less fence warning than today (4.1's floor; 390 × 450 see 8.2).
- [ ] `npm run gate`: the 12 pixel gates; bubble canvas box and no transformed ancestor.
- [ ] `npm run check:scenes`: obstacles one piece.
- [ ] HUMAN: Brian sees before and after at the milestone 9 stops, and the phone SPAN pair.

## 8. Decisions for Brian

1. An approach bar under the letters, filling as the typeable fence nears take-off (no rule change)? Recommended: try it as a pair; default none.
2. Phone SPAN: 240 (sheep 34 px, a fence 0.40 s ahead at speed 265), 220 (37 px, 0.33 s) or 200 (41 px, 0.27 s)? Recommended: 240, the only one that keeps today's warning. With the keyboard up, today's tiny picture (21 px sheep) sees a fence 1.14 s ahead; no readable side view matches that.
