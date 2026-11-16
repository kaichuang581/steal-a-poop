# 04 · The farm (Home backdrop): recompose and lighten

The farm is not rebuilt. This file does four things: it protects the wendigo's shot with checks a script can run; it removes triangles no camera can see; it recomposes the fourteen real tour shots (8 computer, 6 phone) so each has one clear subject; and it brings the decorations to a game-scale chart without changing how much of the season there is. The cuts land in milestone 2 (picture unchanged). The recompose is milestone 8 and stops for Brian.

## 1. What exists today (v0.7.4)

- The tour: `POV_SHOTS` in `src/skin/scene/homePov.ts` holds **8 computer shots and 6 phone shots**, each held `POV_HOLD` = 5 s with a `POV_DIP` = 0.4 s dip to dark. `?pov=N` pins one, `?hour=` pins the time of day (`src/skin/hooks/useAmbient.ts`). The old plan counted seven shots: it missed the pond shot (computer 7) and every phone shot. Computer 3 is over the avatar's shoulder by design; computer 6 looks from the path into the barn, not from inside it.
- The scene: `FarmBackdrop` (`src/skin/table/FarmBackdrop.tsx`) mounts the world, `Farmstead`, the wendigo, the hero at scale 1.5 and tilt-shift 0.15 (`src/skin/table/FarmBackdrop.tsx:89`).
- Livestock: `LIVESTOCK` in `src/skin/table/Farmstead.tsx:21-37`, 13 animals at y 0, scale 1.5. Paths, drifts, rail fences, grouped rocks and a bare orchard already exist; the old plan asked for them as new.
- `isClear` (`src/skin/scene/countryside.ts:44-48`) reads the **live** `POV_SHOTS` lists. Every builder that asks it draws from shared random streams, so moving the computer wide shot by a few metres re-plants scrub and woods 20 to 30 m from the wendigo (SCENE R2: voxels within 25 m change from 165,775 to 165,880).
- The sun's direction is the same at every hour (`Lights` in `src/skin/table/Rendering.tsx:54-56`); hours differ by key colour, fog colour and sky.
- Triangles, static, computer detail (SCENE R1, Node builders): Home 3.09 M in about 480 meshes; farmstead 819,248; countryside 870,348; yard 573,168; distance 459,150. Test budgets: yard 600 k (`src/skin/scene/__tests__/yard.test.ts`), farmstead 1.0 M (`src/skin/scene/__tests__/farmstead.test.ts`), countryside 950 k (`src/skin/scene/__tests__/countryside.test.ts`; CLAUDE.md says 1.1 M, the code says 950 k).

## 2. Decisions that bind this file

- 2026-11-07, "One level of detail" (CLAUDE.md:180-185): standing scenery refined to 0.1 m; flat ground, field and far land stay coarse; no scattered blocks for litter.
- 2026-11-07, "The season reaches every setting" (CLAUDE.md:186-189), with "Restraint with the season: one Christmas tree on the farm (by the barn doors), one in the barn, one on the ice" (CLAUDE.md:193).
- 2026-11-07, the land: woods "in uneven clumps, never rows"; everything through `isClear` (CLAUDE.md:190-192).
- 2026-11-08, the wendigo and "should not be so easily seen" (CLAUDE.md:368-390). This session: the wendigo is not touched (model, materials, animation, lighting, scene placement).
- 2026-11-08, snow with a little texture (CLAUDE.md:463): no flat snow.
- Rulings M13 (zone), M14 (recompose and lighten), C5 (sun angle fixed), M7 (cuts, voxel sets identical), M17 (`FESTIVE` constant).

## 3. Problems (verified)

1. Moving any tour camera can change land near the wendigo through `isClear` (above).
2. 519 k triangles of hills, terrain, mountains and forest face away from every camera (SCENE R2 §4).
3. Lens clearance under 1.0 m: computer 4 (0.50 m), 5 (0.45 m), 6 (0.30 m, starts on the face of a gate post behind it), 7 (0.90 m); phone 3 (0.85 m) (SCENE R1 appendix F).
4. The doorway sheep (`src/skin/table/FarmBackdrop.tsx`, `[2.6, 0, BARN.maxZ - 1.4]`, not `src/skin/table/Farmstead.tsx`) stands 0.10 to 0.70 m up inside the wheelbarrow (`src/skin/scene/barn.ts:230`); hens stand 0.10 m deep in straw. File 18 §4.7 fixes both in milestone 3.
5. Three presents 0.6 to 0.7 m tall stand in front of the tractor (`src/skin/scene/festive.ts:287-289`) and fill shot 5 (sheet 03).
6. Scale: the Christmas tree by the doors is 5 m (`src/skin/scene/festive.ts:206`); the snowman's head tops out at 2.96 m (`src/skin/scene/festive.ts:227` comment, `src/skin/scene/yard.ts` `snowman`) against a 1.5 m hero.
7. Coplanar faces on Home: farm festive bulbs against farm props 9.77 m², festive decor against props 5.64 m², including lights inside the paddock rails, shed and silo (SCENE R1 appendix H). File 18 §4.7 fixes these in milestone 3, except near shot 2.

## 4. Changes

### 4.1 The wendigo's protected zone (milestone 2, first commit; guard built in milestone 0)
- **What:** nothing visible.
- **Where:** `src/skin/scene/countryside.ts` (`isClear`); a `wendigo` stage in `tools/scenes/` (new folder, file 18, `npm run check:scenes`); `src/skin/scene/__tests__/wendigoFence.test.ts` (new file, `npm test`); the browser gate (`npm run gate`, file 16).
- **How, in this order:**
  1. **Freeze first.** Add `CLEAR_SIGHT_LINES` (new constant in `src/skin/scene/countryside.ts`): a literal copy of today's fourteen `position` and `target` pairs (8 computer, 6 phone). `isClear` reads it instead of `POV_SHOTS`. Pass condition: the countryside still builds **487,002 voxels** with today's voxel hash. No picture changes, so no decision is needed. Only after this commit may `src/skin/scene/homePov.ts` change.
  2. **Files byte-identical:** SHA-256 of `src/skin/table/Wendigo.tsx`, `src/skin/table/wendigoPose.ts`, `src/skin/table/WendigoPreview.tsx`, `public/models/wendigo.glb`, pinned in `src/skin/scene/__tests__/wendigoFence.test.ts`.
  3. **Constants pinned** in the same test: `WENDIGO_AT` (−9.6, −36.1); `POV_SHOTS.desktop[2]` and `POV_SHOTS.phone[2]` (still index 2); `POV_HOLD`, `POV_DIP`; the drift (0.25 m by 0.12 m over 40 s, `src/skin/table/FarmBackdrop.tsx`); the ten hand-placed pines and the corridor (14 m ahead, 1.2 m aside) in `forest()` (`src/skin/scene/countryside.ts:131-160`); `CLEAR_SIGHT_LINES`.
  4. **Stand:** every voxel within 12 m of `WENDIGO_AT` (80,760 today) hashes the same. Hashes come from `__voxelHook` (`src/skin/voxel/mesher.ts:50`) on voxel position and colour, never on bytes, so a repack, a sliced build or dropped faces do not count as touching.
  5. **View cone:** every voxel (barn, yard, festive, farmstead, countryside, farm festive) that projects within 8% of the frame of the wendigo's screen box from the paddock camera at travel 0, 0.5 and 1 (1280 × 800), union of the three. About 75,400 voxels (QA read 75,438 at travel 0). Its count and hash are recorded at the freeze commit and pinned.
  6. **Rays:** from the paddock camera at travel 0, 0.5, 1 to 153 points: a 9 × 17 grid on the vertical plane through `WENDIGO_AT` facing the camera, ±0.8 m across, from `groundAt − 0.05` up 3.4 m. March each ray from 0.3 m in 0.05 m steps; a voxel hit blocks it. Pass: **134, 136, 137** clear of 153.
  7. **Mask:** `?pov=2&wendigoDebug&hour=day` and `&hour=night` at 1280 × 800, reduced motion; magenta pixels against the base branch, **IoU ≥ 0.98**. Computer only: on phones the figure is above the frame (y −34 to −24%).
  8. **Tiers:** on shot 2 the lights, fog, tilt-shift (0.15) and the tour itself are identical on every live tier; Low keeps the tour.
  9. **No per-shot time of day.**
- **Do not:** edit the four files; move or re-yaw the wendigo; change index 2 of either list; change light or fog while shot 2 shows.
- **Cost:** none at run time; about 200 lines of test and tool.
- **Check:** `npm test` (files, constants); `npm run check:scenes` (countryside total, stand, cone, rays); `npm run gate` (mask). All green at every milestone.

### 4.2 Unseen-triangle cuts (milestone 2)
- **What:** nothing visible.
- **Where:** `buildGeometry` (`src/skin/voxel/mesher.ts`) gains the drop and merge for grids flagged receive-only, behind a constant; callers in `src/skin/scene/distance.ts`, `src/skin/scene/farmstead.ts`, `src/skin/scene/countryside.ts`. `dropFaces` (`src/skin/scene/yard.ts:477`) already drops undersides. Method and constants: file 17, M7 steps 1 and 2.
- **How:** a face is dropped only if no point of the camera box (every Home shot over its travel with the drift, computer and phone, plus the table's wide shot and all 54 + 54 speaker positions, 1 m margin) lies on its outward side. A mesh mounted twice (the mountains) loses a face only if hidden in both placements. Merge: one plane, one cell size, one tone at all four corners, no rounded edge. Casters keep every face.

| Mesh | Today | After drop and merge |
|---|---|---|
| Back hills | 270,598 | 76,216 |
| Farm terrain | 286,476 | 147,296 |
| Hills | 137,640 | 69,452 |
| Mountains (drawn twice) | 98,616 | 50,504 |
| Forest | 270,392 | 205,154 |
| Drifts, tracks | 74,044 | 70,022 |
| **Sum** | **1,137,766** | **618,644** |

- **Do not:** coarsen any grid (that reverses "One level of detail"); remove an object; drop a face from a caster. The camera box is the live shot list, not `CLEAR_SIGHT_LINES`: re-run the drop in the same commit as any camera move.
- **Cost:** −519 k triangles static on Home; shorter build (fewer vertices pushed).
- **Check:** voxel hashes identical per mesh (`npm run check:scenes`); every shot's travel lies inside the box the drop used (`npm test`); the head-against-base picture gate unchanged (`npm run gate`).

### 4.3 The fourteen shots (milestone 8, ■ stop)
- **What:** each shot has one subject, inside the frame's clear part, with nothing pressed against the lens.
- **Where:** `POV_SHOTS` in `src/skin/scene/homePov.ts` (not index 2); `LIVESTOCK` in `src/skin/table/Farmstead.tsx`; the hero and doorway sheep in `src/skin/table/FarmBackdrop.tsx`; projection tests in `src/skin/scene/__tests__/homePov.test.ts`.
- **How:** triangles are today's main pass (SCENE R2, model within 1.4% of PERF's browser counts); computer shots at computer detail, phone shots at touch detail.

| Computer | Subject | Main pass today | Lens today | Work |
|---|---|---|---|---|
| 0 | avatar in the doorway | 1.97 M | > 2.5 m | Tree and presents to scale (4.4); doorway sheep stays where file 18 put it |
| 1 | whole farm from over the orchard | 2.68 M | > 2.5 m | Subject is the barn's red; no change to camera unless lens or frame test fails |
| 2 | paddock (the wendigo's shot) | 2.00 M | 1.00 m | Camera frozen. Paddock animals may move inside `LIVESTOCK` only: each box inside x 42 to 97%, y 30 to 92%, none within 5% of the wendigo's box; mask must pass |
| 3 | over the avatar's shoulder, out at the yard | 1.76 M | 1.05 m | Keep |
| 4 | hens' run | 1.38 M | 0.50 m | Lens to ≥ 1.0 m |
| 5 | tractor | 1.90 M | 0.45 m | Lens to ≥ 1.0 m; presents out of the tractor's box |
| 6 | down the path to the avatar | 1.79 M | 0.30 m | Lens to ≥ 1.0 m; start clear of the gate post |
| 7 | across the pond to barn and silo | 2.41 M | 0.90 m | Lens to ≥ 1.0 m |

| Phone | Subject | Main pass today | Lens today | Work |
|---|---|---|---|---|
| 0 | avatar in the doorway | 0.96 M | > 2.5 m | As computer 0 |
| 1 | whole farm | 1.18 M | > 2.5 m | Keep |
| 2 | paddock | 0.60 M | > 2.5 m | Camera frozen |
| 3 | from the barn's front, through it | 0.92 M | 0.85 m | Lens to ≥ 1.0 m |
| 4 | hens' run | 0.56 M | 1.15 m | Keep |
| 5 | down the path | 1.09 M | 1.15 m | Keep |

  Frame rules, tested by projection with no WebGL: computer subjects' boxes inside x 40 to 97% and y 15 to 92% (the menu covers the left); phone subjects inside the clear strip under the title, whose top and bottom the browser gate measures at 390 × 844 at the start of milestone 8 and writes into the test as constants. No decoration's box covers more than 10% of a subject's box. No voxel within 1.0 m of the lens over a shot's travel with ±0.25 m drift; shot 2 is held at its measured 1.00 m and may not fall.
- **Do not:** add a shot or remove one; change index 2; add objects.
- **Cost:** none; moving a camera re-runs 4.2's drop.
- **Check:** `npm test` (frame boxes); `npm run check:scenes` (lens clearance, wendigo); HUMAN: Brian sees 12 before-and-after pairs (both paddock shots are unchanged).

### 4.4 Scale chart at game scale, and the decorations tidied (milestone 8)
- **What:** things sized against the 1.5 m hero; the season's decorations moved, not removed.
- **Where:** `src/skin/scene/festive.ts` (`buildFestive`, `buildFarmFestive`), `src/skin/scene/yard.ts` (`snowman`), `src/skin/scene/layout.ts` (`YARD.snowman`); test `src/skin/scene/__tests__/scale.test.ts` (new file) measuring voxel bounding boxes.
- **How:**

| Object | Today | Target |
|---|---|---|
| Hero and livestock | scale 1.5 (sheep about 1.5 m) | unchanged, the reference |
| Back door | 3.4 m (`BARN.backDoor`) | unchanged |
| Fences | measured by the test | 1.2 to 1.4 m |
| Snowman | 2.96 m | at most 2.2 m; its hat follows (`src/skin/scene/festive.ts:227`) |
| Christmas tree by the doors | 5 m | at most 4.2 m, still by the doors |
| Presents | up to 0.7 m | at most 0.6 m |
| Yard pines | 5 to 9 m | unchanged |
| `forest()` trees | | exempt (wendigo) |

  Tidy inside today's amount: same count of trees, presents, canes, wreaths and strands. Presents leave the tractor's box (shot 5). No bulb within 1.0 m of a lens. (The wheelbarrow corner and the strands in rails, shed and silo are file 18 §4.7, milestone 3.)
- **Do not:** remove a decoration (that is question 1 below); touch `forest()`; add a fourth Christmas tree.
- **Cost:** triangles fall slightly.
- **Check:** `npm test` (scale chart); `npm run check:scenes` (coplanar area on Home only falls, today 94 m² visible; placement gaps ±0.02 m).

## 5. Integrity (nothing floats, nothing breaks)

- Every moved animal: ray down from each footprint corner, gap within ±0.02 m (bedding 0 to −0.10 m, declared) (`npm run check:scenes`).
- Connectivity at fine and coarse detail, with no "foot at y ≤ 0" pass.
- No two placed footprints intersect (doorway sheep against wheelbarrow, presents against bales).
- Coplanar area per scene only falls.
- Baked pictures that show the farm (`public/loading/doors-*.webp`, `public/play/casual.webp`, `public/play/ranked.webp`) are re-baked in the commit that changes what they show; the bake manifest fails otherwise (file 18).

## 6. Budget

Only falling. Per frame, main pass plus the sun pass counted at its redraw rate (file 17):
- Home High: 2.5 M one-second mean, 3.6 M peak. Medium: 1.7 M and 2.4 M. Low: 1.4 M and 2.1 M.
- Static: farmstead 680 k, Home 2.54 M, table mount 1.02 M (shared world).
- Test ratchets set to today's counts: yard 574 k, countryside 871 k, festive 48 k (table) and 39 k (farm).
- Build time per builder no higher than at the base commit on the same machine.

## 7. Acceptance

- [ ] `npm test`: wendigo files and constants pinned; shot frame boxes; scale chart; drop box covers every shot.
- [ ] `npm run check:scenes`: countryside 487,002 voxels at the freeze; stand and cone hashes; rays 134, 136, 137 of 153; lens ≥ 1.0 m (shot 2 ≥ 1.00 m); placement gaps; coplanar area not above today.
- [ ] `npm run gate`: magenta mask IoU ≥ 0.98 at day and night; milestone 2 changes no picture.
- [ ] Budgets in section 6 met (counts gate, `RATCHETS.json`, new file, file 16).
- [ ] HUMAN: Brian approves the 12 pairs at the milestone 8 stop.

## 8. Decisions for Brian

1. Season amount outside the barn: keep today's count and only tidy it, or thin it? Recommended: keep the count, tidied as in 4.4.
2. Home's time of day: follow the clock, or show each shot at a chosen hour? Recommended: the clock, as today.
