# 18 · Asset integrity

This file makes floating, detached, buried, flickering, mis-anchored and stale assets fail a check before they ship. Today the only scene check, `npm run check:floating`, passes ("Nothing floats.") while a robin hangs in the air, the lobby pen has 74 loose pieces and animals stand inside a wheelbarrow. This file adds one arithmetic test file to `npm test`, one `check:scenes` CI job, a DOM anchor check in the browser gate, a bake manifest, one exemption file, and the scene fixes those checks demand. It ships no game code except a dev-only anchor registry.

## 1. What exists today (v0.7.4)
- `npm run check:floating` = `vite-node tools/floatingVoxels.ts -- --props --strict` (`package.json:24`). It catches every voxel set the mesher is given through `__voxelHook` (`src/skin/voxel/mesher.ts:50`), joins touching voxels by face and edge, and lists pieces not joined to the largest. It builds four scenes (table, farm, duel, bedroom) and eight props (four fences, a bale, the sign post, the bomb, the trophy) (`tools/floatingVoxels.ts:128-151`). It runs in no workflow: `.github/workflows/quality.yml` runs `npm test` and the build only.
- `src/skin/scene/__tests__/zfighting.test.ts:39` checks barn and yard meshes only.
- The animal suites (`src/skin/voxel/__tests__/animals.test.ts`, `animalsV51.test.ts`, `src/skin/table/__tests__/legJoins.test.ts`) check face-connectivity of pig, cow, horse, goat and chicken at five coat levels, roots and garments.
- Baked images: tests only check that thumbnails exist (`src/skin/shop/__tests__/refine.test.tsx:87`). 47 shipped images come from models.
- Name plates and bubbles are pinned by `ScreenAnchor` (`src/skin/table/Anchors.tsx:15`) to a typed point; nothing tests where they land.

What `check:floating` misses (SCENE R1 appendix C, QA R2):
1. A piece whose lowest voxel is at y ≤ 0 passes without any ground under it (`tools/floatingVoxels.ts:108-113`).
2. Anything placed by a mesh transform: robin, cat, livestock, hero, sheepdog, bomb, letter board, daze stars, door leaves, podium bales, the farmer.
3. Scenes it never builds: the lobby pen (75 pieces, 74 loose: 48 from `nature`, 24 from `trees`, the lantern glass, the mountains slab), the dream world, the podium, the leaderboard sky, the stall.
4. Touch-device geometry: `coarse()` (`src/skin/voxel/refine.ts:47`) is false under Node, so phones' build is never checked.
5. Animals inside props: "touching" counts as grounded, so a sheep buried in a wheelbarrow passes.
6. Plates over heads: the plate stands 0.20 to 0.37 m above the hat tip on four species (file 03).
7. Coplanar faces between meshes, animals, hats, attachments, poses, wool levels, thumbnails.
8. Exemptions by regex: everything from `buildDistance` and every bedroom part whose source line lacks `room:` (`tools/floatingVoxels.ts:14-22`).

## 2. Decisions that bind this file
- 2026-11-09 (Brian, CLAUDE.md, the barn lights): a box that rounded to nothing let the lights "lose their wire and float" (`src/skin/voxel/primitives.ts:63-65`). Floating is a defect, not a style.
- 2026-11-07 floating letters and the Word of the day float on purpose: DOM text, not voxels, and outside these checks.
- Ruling M18: `npm test` arithmetic and hashes only, under 2 s added; `check:scenes` as specified; DOM anchors within 2 px in the browser gate; exemptions in one file, each with Brian's dated words, count only falls.
- Ruling M1: one `RATCHETS.json`; the bake manifest; numbers only fall without Brian.
- Ruling M3: `primitives.floating`, `zfighting`, connectivity, face-rule, root and garment checks are never re-pinned.
- The wendigo's four files are never edited; its hash and rays are file 04's spec and run inside `check:scenes`.

## 3. Problems (verified)
1. The robin is 4.1 m over the floor and 1.05 m from its beam: `ROBIN_SPOT = [1.2, 4.1, 2.05]` (`src/skin/scene/barn.ts:19`).
2. Pen pines stand 0.5 m above the snow: trees use `y0 = hill(x, z)` (`src/skin/scene/pen.ts:126`), the ground's top is `Math.round(hill(x, z)) - 1` (`pen.ts:116`).
3. The pen's tall lantern glass is 1.60 m from its bracket (`pen.ts:272`).
4. The tutorial's sheepdog (`src/skin/table/places.tsx:65`, x 2.6, z `BARN.maxZ - 1.2`), Home's doorway sheep (`src/skin/table/FarmBackdrop.tsx`, 0.10 to 0.70 m inside the tray), a present and the small tree (`src/skin/scene/festive.ts:211-212`) all stand in the wheelbarrow (`barn.ts:230`).
5. Hens stand 0.10 m deep in the straw bed (`Farmstead.tsx:25-30`, placed at y 0).
6. Coplanar same-facing faces between meshes: table 5.2 m² (all festive: a strand through the cross beam and a lantern); Home 94 m² on visible sides, 15.4 m² of it where farm lights sit inside paddock rails, shed and silo; pen 54 m²; duel about 5 m² (SCENE R1 appendix H).
7. Shipped `public/shop/tick-owl.webp` has detached feet (`src/skin/shop/thumbModels.ts:232`); nothing could tell it was wrong.

## 4. Changes
All tools are Node scripts; none adds a dependency (`node:crypto`, three and Playwright are already in the repo).

**4.1 The integrity test file.**
- **What:** fast rules every `npm test` run enforces.
- **Where:** `src/skin/__tests__/integrity.test.ts` (new file).
- **How:** arithmetic and hashes only, no scene or animal build:
  - `EXEMPT.json` (4.6): every entry has `check`, `scene`, `match`, `reason` and `brian: { date, words }`; the count is at most `RATCHETS.json`'s.
  - `placed.ts` (4.3): every entry has a support; no two footprint boxes intersect; every point or spot light element in `src/skin/**/*.tsx` (counted by grep) has a `LIGHTS` entry.
  - Pure helpers on hand-made data: ray-down gap, coplanar area of two quads, `anchorsOf` on a 3 × 3 × 3 cell set, the tail rule (`level > 0 || species !== 'sheep'`), the "visible only if it has triangles" helper.
  - Bake staleness for images whose model builds in under 50 ms (the 26 thumbnails, the sheepdog): see 4.5.
- **Do not:** build a scene or a six-animal set here.
- **Cost:** under 2 s added, read from vitest's JSON report by the gate; if over, the slowest part moves to `check:scenes`.
- **Check:** `npm test`.

**4.2 `npm run check:scenes` and its CI job.**
- **What:** every scene and model built, fine and coarse, and judged.
- **Where:** `tools/scenes/` (new folder): `check.ts` entry, one module per stage. `package.json` script `check:scenes`; `check:floating` becomes `check:scenes --only connect`. `.github/workflows/scenes.yml` (new) on pull requests touching `src/skin/scene/**`, `src/skin/voxel/**`, `src/skin/table/**`, `src/skin/dream/**`, `tools/scenes/**`, `EXEMPT.json` or `RATCHETS.json`, and on every push to `main`. `npm run gate` calls it as a module.
- **How:** scenes: table, farm, duel, pen, bedroom, dream world, podium (export its builders from `src/skin/table/Podium.tsx`, a named change). Coarse build: the tool sets `globalThis.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' })` before importing builders. Stages:
  - (a) **Connect.** Today's union-find from `floatingVoxels.ts`, by face and edge, with no y ≤ 0 pass: a piece is grounded only if it joins the ground piece. Mesh-placed things are judged by (b).
  - (b) **Place.** For each `PLACED` entry, cast a ray down from each footprint corner and the centre through the scene's voxels. Gap = entry's y minus the top of the first voxel below; pass within ±0.02 m (a declared bedding range is an exemption). The footprint box, raised 0.02 m, contains no voxel of another prop.
  - (c) **Coplanar.** Same-plane, same-facing faces between separate meshes, 0.05 m cells, per scene; area at most `RATCHETS.json`'s, seeded from the first run; target 0. For each animal, coincident faces between rigid parts at rest (today sheep 2, pig 8, cow 58, horse 31, goat 14, chicken 14), same ratchet.
  - (d) **Lens.** On every camera path (`POV_SHOTS` in `src/skin/scene/homePov.ts:46` with push and ±0.25 m drift; `speakerShot` in `src/skin/scene/layout.ts:102` for n 2 to 10, computer and phone; `duelShot` in `src/skin/scene/duel.ts:47`; `penShot` in `pen.ts:51`; podium; dream), no voxel inside the view within 1.0 m of the lens, and the lens never inside a voxel. Today's failures are seeded into the ratchet by shot; `POV_SHOTS.*[2]` is never moved to pass (file 04).
  - (e) **Lights.** Every `LIGHTS` entry within 0.35 m of its lamp's voxels, or marked `fill`.
  - (f) **Models.** Six species × coat levels 0 to 4, as drawn per level: one piece by face and edge; every state in `ALL_STATES` (a new export beside `SheepState`, `src/skin/table/Sheep.tsx:21`, all 20) with joint roots inside the parent's solid grown by one voxel; no visible mesh with zero triangles; at idle at most 14 colour and 2 shadow draws; tail shown at level 0 for non-sheep; at least 99% of cells inside the fitted ice block in the frozen pose; every glint, crack and cap cell touching the slab; plate 0.02 to 0.12 m above the highest voxel, hat included; hat band within one voxel of the crown; scarf joined; terrace failing lines at most the ratchet. Props one piece: eight bomb skins with floor marks, burst props, tick models, sack, sheepdog, trophy, hat, ice parts.
  - Wendigo: the voxel hash and ray counts specified in file 04, run here.
- **Do not:** make this a required check while it is path-filtered (a skipped required check blocks merging); the gate report shows its result.
- **Cost:** about 5 min of CI per run; no shipped bytes.
- **Check:** green on `main` twice running before milestone 3 ends; red today on items 1 to 6 of section 3.

**4.3 The placement manifest.**
- **Where:** `src/skin/scene/placed.ts` (new file): `PLACED` and `LIGHTS`.
- **How:** entries import the existing constants rather than copy numbers: `ROBIN_SPOT`, `CAT_SPOT` (`barn.ts:18-19`), `LIVESTOCK` (`Farmstead.tsx:22`, exported, a named change), the hero and doorway sheep, the sheepdog, the letter board hooks, seat positions for n 2 to 10, `barnSpot` and `duelSpot` samples, podium bales, lamps. Each: id, scene, position, footprint (w × d), support (`floor`, `beam`, `bedding`, `post`).
- **Cost:** none at run time.
- **Check:** 4.1 and stage (b).

**4.4 DOM anchors within 2 px.**
- **Where:** `ScreenAnchor` (`src/skin/table/Anchors.tsx:15`) registers `{ id, world point, element, clamped }` in `window.__anchors` when `?dev=1`; `tools/gate/anchorCheck.mjs` (new file), a module of `npm run gate`.
- **How:** Playwright on the production build: table for n 2 to 10 at 1280 × 800 and 390 × 844, the duel, the pen. For each anchor not clamped to the frame's side, the element's anchor pixel is within 2 px of the world point projected through the canvas's camera; every plate lies inside the frame; no two plates overlap by more than 10% of the smaller.
- **Cost:** under 0.3 kB shipped, inside the size payment.
- **Check:** the gate report; fails today on the horse's and cow's plate height once 4.2(f) is green (file 03, change 4.7, fixes it).

**4.5 The bake manifest.**
- **Where:** `tools/bake/baked.json` (new file), written by `tools/bakeStamp.ts` (new file), which `tools/renderThumbs.mjs`, `renderStall.mjs`, `renderDoors.mjs` and `renderGuide.mjs` run at their end; `src/skin/__tests__/baked.test.ts` (new file).
- **How:** one entry per shipped image (`public/shop/*.webp` 26, `public/shop/stall/*.webp` 15, `public/loading/doors-*.webp` 3, `public/tour/sheepdog.webp`, `public/play/casual.webp`, `ranked.webp`): the tool and its arguments; `modelHash`, SHA-256 of the sorted cells (x, y, z, colour at 16 bits) caught by `__voxelHook` while building that image's model; `renderHash`, SHA-256 of the bake page's source (`src/skin/shop/ThumbRender.tsx`, `StallRender.tsx`, `src/skin/loading/DoorsRender.tsx`, `src/skin/tour/GuideRender.tsx`), the tool's source and the `ROUNDED_VOXELS` value; `fileHash` of the image.
- **Staleness:** recompute `modelHash` and `renderHash`; a mismatch fails with the command, for example "public/shop/tick-owl.webp is stale: run `node tools/renderThumbs.mjs --only tick-owl` with the dev server up". A `fileHash` mismatch fails as "image changed without a stamp". Thumbnails and the sheepdog in `npm test`; doors, stall and play cards in `check:scenes`. The play cards have no tool: their failure says so and names the capture to redo by hand.
- **Do not:** add a studio backdrop to any image.
- **Cost:** none shipped.
- **Check:** green after every milestone with a model change.

**4.6 The exemption file.**
- **Where:** `docs/visual-overhaul/EXEMPT.json` (new file); its count in `RATCHETS.json`.
- **Rules:** the only place any check above may be excused. Each entry names one check, one scene, one match (a source label or a `PLACED` id), a reason, and Brian's dated words. The count only falls; a new entry needs Brian's words in the pull request. Today's two regex exemptions (`buildDistance`, bedroom parts placed by meshes) move here as `pending` in milestone 0 and become questions in file 19; no `pending` entry may be added later.
- **Check:** 4.1.

**4.7 Scene fixes (milestone 3, one commit each, before any restyle).**
1. Robin onto its beam: `ROBIN_SPOT` y 4.6, z 1.05.
2. Pen pines at `Math.round(hill(x, z))`; lantern glass touching its bracket.
3. Wheelbarrow corner: sheepdog, doorway sheep, present and small tree moved apart until stage (b) passes.
4. Festive strands one cell off the beam, lantern and fence planes.
5. Hens at y 0.10 on the straw.
6. Farm lights out of the paddock rails, shed and silo planes, except on shot 2 (file 04).
7. The ledger's missing gap (`src/skin/components/Ledger.tsx:59`).
- **Check:** `check:scenes` green for that item; gate pictures change only there.

## 5. Integrity (nothing floats, nothing breaks)
This file is the rule set. Every other file's section 5 points here.

## 6. Budget
`npm test` +2 s at most. `check:scenes` about 5 min, CI only. Shipped bytes: the anchor registry only. Ratchets in `RATCHETS.json`: loose pieces 0 per scene (after exemptions), coplanar area per scene, lens failures per shot, coincident faces and terrace lines per species, exemption count. All only fall.

## 7. Acceptance
- [ ] `npm test` includes `integrity.test.ts` and `baked.test.ts`; added time under 2 s.
- [ ] `check:scenes` green fine and coarse on all seven scenes.
- [ ] Section 3's seven problems fixed or listed in `EXEMPT.json` with Brian's words.
- [ ] Anchor check green at both sizes.
- [ ] Every shipped baked image in the manifest and fresh.
- [ ] `check:floating` still runs (alias).
- [ ] HUMAN: Brian answers the `pending` exemptions in file 19.

## 8. Decisions for Brian
1. May the far hills and mountains, and the bedroom's clock, ring and window view, stand apart from the ground as they do today? Recommended: yes, with your words in `EXEMPT.json`.
2. Shots that today have scenery closer than 1.0 m in view: move those cameras in the farm milestone, not shot 2? Recommended: yes.
3. The two play cards have no bake tool: re-capture them by hand when a model in them changes? Recommended: yes.
