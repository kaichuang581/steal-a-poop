# 03 · Animal models

This file fixes what is broken on the six animal avatars, then improves how they look in three gated steps. Milestone 3 repairs defects every player can see today (missing tails, heads outside the ice, floating plates, hovering cracks). Milestone 5 smooths the terraced bodies and blankets with a shape switch on the existing primitives and shows Brian one face sheet. Milestone 6 makes only the per-species changes Brian ticks, merges the Santa hat into the head and cuts draw calls. Nothing is rebuilt from new boxes: the rig, pivots and ratio sheet stay until Brian ticks a change.

## 1. What exists today (v0.7.4)
- Builders: `src/skin/voxel/sheep.ts` (sheep, ice block), `src/skin/voxel/animals/{pig,cow,horse,goat,chicken}.ts`, shared parts in `src/skin/voxel/animals/rig.ts` (`barrel`, `wedge`, `smallEyes`, `mouths`) and `garments.ts` (`shell`, `blanket`). Primitives: `ellipsoid`, `box(..., chamfer)`, `taperedBox`, `line(..., joined)` in `src/skin/voxel/primitives.ts`. Grid 0.04 m.
- The ratio sheet `SHEET` (`src/skin/voxel/animals/measure.ts:27-41`) is enforced by `animalsV51.test.ts`; budgets of 3,200 voxels (sheep 14,000) and 10,000 triangles by `animals.test.ts:115-118` and `voxel.test.ts:56`.
- Eyes are `smallEyes` (`rig.ts:262`), 2 × 2, pinned by `voxel.test.ts:50`.
- `Sheep.tsx` mounts 17 to 21 meshes per animal plus about 23 hidden freeze-effect meshes; 20 states (`Sheep.tsx:21`). The hat is `SantaHat` (`Sheep.tsx:645-655`), a separate mesh sized from the head's bounding box; the hat geometry is `santaHat()` (`src/skin/scene/festive.ts:323`).
- Today per animal at coat level 2 (VOXEL R1, appendix B, `renderer.info` in the dev viewer): 29 to 37 draws with one shadow light; triangles drawn 4,284 (chicken) to 8,814 (horse), hat 904 included.
- Coat levels 3 and 4 never occur in a game: `coatLevel(p.lives, maxLives)` (`src/skin/screens/PaintedGame.tsx:397`) tops out at 2. Level 3 shows once on Home (`src/skin/table/FarmBackdrop.tsx`).
- The old file was wrong on: a new `blocks.ts` (duplicates `box`, `taperedBox`, `wedge`); its sheets (fail 4 to 5 of 7 `SHEET` ratios and the 3,200 budget); "15 states" (there are 20); "horse head cropped" (the dev viewer's fixed camera, `src/skin/table/SheepPreview.tsx:86-87`); pink-green backgrounds (the dev page; shipped thumbnails are transparent); replacing the avatar heads with renders.

## 2. Decisions that bind this file
- 2026-11-07: "beady eyes, 2 x 2 and dark with no whites"; "The pig keeps its plates"; "A pale face gets no glint" (CLAUDE.md:272-283). Default stays 2 × 2.
- 2026-11-07: the bigger cow, `drawScale` 1.2, "second only to the horse"; its eyes 2 × 2 with a white glint in the outer top corner; "Never put its eyes in a dark patch" (CLAUDE.md:276, :284-287).
- 2026-11-07: the chicken's head nearer the breast, a short neck reaching forward, a two-step wedge beak, a 2 × 2 wattle (CLAUDE.md:278-283). The head stays its own part.
- 2026-11-09: avatar heads are Brian's own pixel-art sheet (`src/skin/assets/heads/*.png`, `src/skin/avatars/AvatarIcon.tsx`). Kept.
- 2026-11-09: `ROUNDED_VOXELS` is on trial (`src/skin/voxel/rounded.ts`). Every picture is judged with it as set.
- 2026-11-07: "Every animal wears a hat" (CLAUDE.md:178), now gated by `FESTIVE` (ruling M17).
- 2026-11-16: "especially the animal models good lord" supersedes "Change an animal only when Brian names it"; the face sheet is how he names a change.
- Ruling M12: no new `blocks.ts`; no pivot, joint anchor or `SHEET` change before Brian's tick. Ruling M3: `animalPose`, `loungePose`, `legJoins`, connectivity, face-rule, root and garment tests are never re-pinned; a ticked species' `SHEET` ranges may be replaced in milestone 6 only.

## 3. Problems (verified)
1. Every non-sheep avatar loses its tail at coat level 0: `tail.visible = level > 0` (`Sheep.tsx:548`).
2. The ice block is the sheep's size, `BLOCK = [1.1, 1.2, 1.3]` (`Sheep.tsx:77`): cells outside it at rest are horse 26%, cow 17%, goat 10%, pig 8%, chicken 4% (the head each time).
3. Glints and cracks hover one voxel off the slab: `front = (hi[2] + 1) * s + s / 2` (`sheep.ts:379`) lands them at z 17 against a slab ending at z 15; 94 snow-cap cells overhang nothing.
4. The cow's mouth end cells sit inside the muzzle (`cow.ts:77`, `front: Math.abs(x) === 3 ? zf : zf + 1`): two materials on the same faces.
5. The shipped `public/shop/tick-owl.webp` has detached feet (`src/skin/shop/thumbModels.ts:232`, row −8); the sheepdog's nose is a loose piece (`src/skin/voxel/characters.ts:129`).
6. Empty meshes are drawn: three.js returns only on a negative draw count (`node_modules/three/src/renderers/WebGLRenderer.js:1254`); 15 of the chicken's 37 draws are empty.
7. Name plates use typed heights: `nameplateY` (`src/skin/table/BarnTable.tsx:487-494`) = 1.26 × `SHEEP_SCALE` × `heightRatio` × `drawScale`, from `height` typed in `animals/index.ts:27`, `pig.ts:121`, `cow.ts:148`, `horse.ts:116`, `goat.ts:131`, `chicken.ts:135`. The plate stands 0.37 m (horse), 0.34 (cow), 0.23 (goat), 0.20 (chicken) above the hat tip in model units.
8. The winner's scarf is one sheep-sized hoop at `[0.02, 0.46, 0.5]` (`Sheep.tsx:659-662`): on the goat and chicken none of its 78 cells touches the animal.
9. Terraces: failing lines on dressed torsos today sheep 34, pig 37, cow 77, horse 71, goat 55, chicken 6 (VOXEL R1 appendix E). Garments grow by face neighbours (`garments.ts` `shell` :30-42, `blanket` :66-83), so an n-step chamfer becomes n+1.
10. Faces: the goat's mouth is 5 wide, near-black, one voxel proud, wider than the muzzle (`goat.ts:58`); the horse's dark nostrils (`horse.ts:46`) read as eyes and its eyes stand proud on the head's sides (`horse.ts:49`, `proud: true`); the chicken's tail is five diagonal `line`s (`chicken.ts:55-63`). Pictures: `work/KEEPER/r2/goat-A-vs-C.png`, `horse-A-vs-C.png`.
11. Coincident faces between rigid parts at rest: sheep 2, pig 8, cow 58, horse 31, goat 14, chicken 14.

## 4. Changes

### Milestone 3: integrity (no look change except where a defect is)
One commit each. Each comes with a check that fails today (file 18).

**4.1 Tails at level 0.**
- **What:** pig, cow, horse, goat and chicken keep their tails when shorn.
- **Where:** `Sheep.tsx:548`, `:554`.
- **How:** `tail.visible = level > 0 || species !== 'sheep'`; the `LEVEL_K` shift at :554 applies to the sheep only.
- **Do not:** change the sheep, which has no tail when shorn by design.
- **Cost:** one draw more per shorn non-sheep animal.
- **Check:** `check:scenes` models stage: a non-sheep animal at level 0 has a non-empty visible tail mesh.

**4.2 A fitted ice block.**
- **What:** each animal is wholly inside its own block.
- **Where:** `Sheep.tsx:77` and the frozen effect at :704-720; `iceBlock(size)` in `sheep.ts:345`.
- **How:** size = `anchorsOf(model).bounds` in the frozen pose plus 0.12 m on each side, rounded to the 0.04 m grid. `iceBlock` already caches per size.
- **Do not:** change the sheep's block (it fits; `iceBlock.test.ts` stays as it is).
- **Cost:** none at rest; one extra cached geometry per species.
- **Check:** at least 99% of each species' cells inside the block in the frozen pose.

**4.3 Glints, cracks and cap on the slab.**
- **Where:** `sheep.ts:379` and the cap loop above it.
- **How:** `front = (hi[2] + 1) * s`; cap cells only over slab cells.
- **Check:** every glint, crack and cap cell face-touches a slab cell.

**4.4 Cow mouth.** `cow.ts:77`: every mouth cell one voxel in front of the muzzle's front at its column (as `frontAt` in `goat.ts:57`). Check: zero coincident faces between mouth and head.

**4.5 Owl feet and sheepdog nose.** `thumbModels.ts:232`: feet on the body's lowest row. `characters.ts:129`: the nose box starts at z 0.30 so it shares faces with the muzzle. Re-bake `public/shop/tick-owl.webp` (`node tools/renderThumbs.mjs --only tick-owl`) and `public/tour/sheepdog.webp` (`tools/renderGuide.mjs`). Check: each model one piece by face and edge; bake manifest fresh.

**4.6 Empty meshes are never drawn.**
- **Where:** `Sheep.tsx`, the frame loop (:540-600) and the mount (:605-640).
- **How:** keep mounting every part (the loop writes to every ref); AND each `visible` with `geometry.index.count > 0` through one helper.
- **Cost:** −2 to −9 draws per animal in each pass.
- **Check:** no visible mesh with zero triangles, every species, levels 0 to 2, every state.

**4.7 Measured anchors.**
- **What:** plates, daze stars, hat and scarf sit on the animal, not on typed numbers.
- **Where:** `src/skin/voxel/animals/anchors.ts` (new file): `anchorsOf(model)` returns `crown`, `hatTip`, `plate`, `headCentre`, `chin`, `muzzle`, `back`, `hold`, `feet`, `neckRing`, `bounds`, all from `model.cells` in model units, cached per model.
- **How:** in this milestone switch only these consumers: `nameplateY` (`BarnTable.tsx:487`, used by `DuelTable.tsx:101`, `src/skin/rooms/PenStage.tsx:200`), `DazeStars` (`BarnTable.tsx:244`, :313), `SantaHat`'s fit (`Sheep.tsx:645`), `Scarf` (rebuilt from `neckRing` with `hugCollar` in `rig.ts`, the hanging end below it). The plate's x and z over the head is file 06's.
- **Do not:** change `heightRatio` (`animals/index.ts:49`), the speaker camera (`src/skin/scene/layout.ts:88`), the look-at height (`BarnTable.tsx:212`), `barnSpot` (`Bomb.tsx:22-36`) or the trophy (`Podium.tsx:303`) here. They move with the table milestone or a ticked species (table below).
- **Cost:** none at run time.
- **Check:** plate 0.02 to 0.12 m above the highest drawn voxel, hat included, every species; hat band within one voxel of `crown`; `feet` at y 0; every scarf cell joined to the animal.

### Milestone 5: shape switch and face sheet ■

**4.8 The shape switch.**
- **What:** smoother torsos and plain-slab blankets; same sizes, same pivots.
- **Where:** `primitives.ts:46` `ellipsoid(g, c, r, paint, noise = 0, seed = 1, power = 2)` tested as `|dx/rx|^p + |dy/ry|^p + |dz/rz|^p`. Constants `BODY_POWER = 4`, `PIG_POWER = 3` in `rig.ts`. Passed at `pig.ts:31-33` (3), `cow.ts:33`, `chicken.ts:29-31` (torso only), `rig.ts:91-92` (barrel ends, used by cow, horse and goat). `rig.ts:90` uses `Math.min(chamfer, 2)`. `garments.ts` `shell` and `blanket` take the 26 neighbours (faces, edges, corners), kept inside z0 − 1 to z1 + 1 and at or above the belly line.
- **How:** default power stays 2 (`voxel.test.ts:61-69` pins the round primitive). The switch is one constant, like `ROUNDED_VOXELS`.
- **Do not:** apply it to the sheep's fleece (`sheep.ts:102`) or shorn body (`sheep.ts:296`) here; the chicken's head (`chicken.ts:69`); `bomb.ts`, `bombSkins.ts`; the wendigo. Change no pivot, `HEAD`, `NECK_BASE`, leg spot or `SHEET` range. Pig at 4 breaks `loungePose` flop and perch: it stays 3.
- **Cost:** +1.6% triangles (38,114 to 38,742 for the six at level 2); voxels at most 2,821 a species.
- **Check:** the animal suites pass unedited (`animals`, `animalsV51`, `voxel`, `animalPose`, `loungePose`, `legJoins`; 308 of 308 measured by VOXEL, QA, KEEPER); terrace failing lines on dressed torsos fall from 280 to at most 53 (seeded into `RATCHETS.json`).

**4.9 The sheep's fleece pair.**
- **What:** two pictures of the sheep at levels 0, 1, 2: today, and power 4 on `sheep.ts:102` and :296 with `noise` kept as it is.
- **Do not:** set the noise to 0 (that made flat panels, `work/KEEPER/r2/sheep-A-vs-C.png`).
- **Check:** HUMAN, Brian picks A or B. `voxel.test.ts` passes either way.

**4.10 The face sheet.**
- **What:** one picture, `docs/visual-overhaul/m5/faces.png`. Six rows, one species each; columns: today and one proposal (4.12), each at speaker-shot size (one voxel 9 to 12 px) and Home size (one voxel 3 to 4 px), front and three-quarter. Plus a sheep column: eyes 2 × 2 (default) beside 3 × 3 (`smallEyes` options `cols: 3, rows: 3`), at both sizes.
- **Where:** a `faces` mode in `src/skin/table/SheepPreview.tsx` (dev only, compiled out by `src/skin/PaintedApp.tsx:25-29`), captured with SwiftShader.
- **How:** `still` and reduced motion on every animal; blink and breathing held open; the hat on (`FESTIVE` as shipped); the fleece as today; camera framed from `anchorsOf(model).bounds` plus 10%.
- **Do not:** catch a blink (KEEPER R2: the old sheets showed eyes in one column and none in the other).
- **Cost:** none shipped.
- **Check:** HUMAN, Brian ticks rows. Stop.

### Milestone 6: ticked deltas, clothing, re-bakes ■

**4.11 Per-species deltas, each a tick-box.** A species changes only if ticked. Unticked rows keep today's face.
- [ ] Sheep: fleece A or B (4.9); eyes 2 × 2 or 3 × 3.
- [ ] Pig: switch only; plates kept.
- [ ] Cow: glint kept (default, Brian 2026-11-07) or dropped.
- [ ] Goat: mouth 3 wide in the muzzle's mid tone, flush (`goat.ts:58`); horns one row behind the ears so they no longer interleave; belly fringe kept (default: removing it needs `animals.test.ts:133` on the replacement list, a question).
- [ ] Horse: nostrils in the nose's mid tone, one voxel each (`horse.ts:46`); eyes flush (`proud: false`, `horse.ts:49`); neck in two-voxel treads.
- [ ] Chicken: tail as three flat feathers drawn with `line(..., true)`, more than 20 cells (`animals.test.ts:137`); head unchanged.
- **Do not:** move a pivot unless the row says so; any `SHEET` range change is named in the row and its test line listed in file 19.
- **Check:** suites green; terrace ratchet only falls; anchors test; face sheet re-shot after.

**4.12 Hat merged into the head (ruling M17).**
- **Where:** `Sheep.tsx` head group (:621-624); `src/skin/table/places.tsx:67` (sheepdog).
- **How:** while `FESTIVE` is on, `mergeGeometries` (already used by `src/skin/dream/world.ts`) joins head, hood and the hat placed by `anchorsOf(model).crown` into one geometry at build. Off: no hat built.
- **Cost:** −1 draw per animal per pass.
- **Check:** hat band within one voxel of `crown`; zero hat cells in the air.

**4.13 Draws per animal: at most 14 colour + 2 shadow at idle.**
- **How:** merge at build every rigid part sharing a pivot and material (body with collar and still body signatures; head with hood, hat, worn item and still head signatures). Detailed meshes stop casting; two shadow proxies (body with legs, head) on layer 1, with layer 1 enabled on `shadow.camera.layers` of the casting lights (`src/skin/table/Rendering.tsx` `Lights`, `BarnTable.tsx:379`, `DuelTable.tsx:120`, :145). Three.js reads that mask (`WebGLShadowMap.js:293`).
- **Do not:** merge anything a channel in `CH` (`Sheep.tsx:85`) moves.
- **Cost:** about −15 draws per animal.
- **Check:** `check:scenes` counts visible non-empty meshes at idle; shadows inside the gate's tolerance, else a pair.

**4.14 Re-bakes.** Every image whose model hash changed (file 18): 26 thumbnails if a prop changed, 15 stall images, 3 door images, the sheepdog, both play cards.

## 5. Integrity (nothing floats, nothing breaks)
Everything in file 18 applies: connectivity at levels 0 to 4 as drawn, every state in `ALL_STATES`, joint roots inside the parent, zero new coincident faces, anchors, the ice block, the bake manifest.

What a model change moves:

| Thing | Where | Moves with |
|---|---|---|
| Name plate, bubble | `BarnTable.tsx:241`, :487; `DuelTable.tsx:101`; `PenStage.tsx:200` | `anchorsOf().plate` from 4.7 |
| Daze stars | `BarnTable.tsx:244`, :313 | `plate` |
| Speaker camera aim | `BarnTable.tsx:201-205`; `layout.ts:88`, :102 | typed `height` via `heightRatio`; milestone 7 |
| Where others look | `BarnTable.tsx:212`; `Sheep.tsx:488` | sheep head height; milestone 7 |
| Hat | `Sheep.tsx:645`; `places.tsx:67` | `crown` |
| Scarf | `Sheep.tsx:659` | `neckRing` |
| Collar, bell, blanket, sweater | species files; `garments.ts` | the torso's own cells |
| Ice block and parts | `Sheep.tsx:77`, :704-720; `sheep.ts:345-430` | `bounds` |
| Tail | `Sheep.tsx:548`, :554 | level, species |
| Breath | `breathAt` in each species file | typed nose position |
| Bomb spot, burst room | `Bomb.tsx:22-36`; `burstActs.ts` `room` | sheep half-width (file 07) |
| Trophy | `Podium.tsx:303` | sheep head height |
| Podium, boards, pen, Home flock, dream | `Podium.tsx:309`; `src/skin/boards/BoardStage.tsx:237`; `PenStage.tsx:195`; `Farmstead.tsx:85`; `DreamStage.tsx:338` | `SHEEP_SCALE × drawScale` |
| Counting Sheep scale | `src/skin/dream/stage.ts:11` | the sheep's length (file 09) |
| Pose limits | `Sheep.tsx` `RANGES`; `animalPose`, `loungePose` tests | torso, muzzle, ear, tail cells |
| Baked images | `public/shop`, `public/shop/stall`, `public/loading`, `public/tour`, `public/play` | bake manifest |
| Avatar heads | `src/skin/assets/heads/*.png` | nothing (Brian's art) |

## 6. Budget
Per animal at coat level 2: voxels 3,200 (sheep 14,000), triangles 10,000 with the hat; at idle at most 14 colour and 2 shadow draws (ruling M7). The six together no more than 38,742 triangles after 4.8. Table High 1.8 M triangles peak (file 17). Bundle: net zero.

## 7. Acceptance
- [ ] Animal suites pass unedited, except test lines on the milestone 6 replacement list.
- [ ] `check:scenes` models stage green: tails, ice fit 99%, slab parts, anchors, empty meshes, draws ≤ 14 + 2.
- [ ] Terrace ratchet ≤ 53 failing lines after milestone 5.
- [ ] Bake manifest fresh.
- [ ] Gate pictures inside tolerance, or each change shown as a pair.
- [ ] HUMAN: Brian picks the fleece pair.
- [ ] HUMAN: Brian ticks the face sheet rows.

## 8. Decisions for Brian
1. Eyes: keep 2 × 2 on every animal, or 3 × 3 on the sheep only? Recommended: 2 × 2.
2. Sheep fleece: today or power 4 with its noise kept? Recommended: decide from the pair.
3. Cow glint: keep or drop? Recommended: keep (your 2026-11-07 choice).
4. Goat belly fringe: keep or remove (replaces one test line)? Recommended: keep.
5. Avatar heads: keep your pixel art, not renders. Recommended: keep.
