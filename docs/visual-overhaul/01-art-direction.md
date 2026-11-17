# 01 · Art direction

This file sets the rules every other file applies: which document wins when two disagree, what must not change, the voxel sizes, where colours come from, how shapes are judged, how the season is switched, and where text may float. Read it first in every session. It replaces the old file 01, which was written from screenshots without the code and the decision log, and so asked for things Brian had already removed.

**The look in one sentence:** a cosy winter farm at night and by day, built from hand-placed voxels on a few fixed grids, where each shot has one clear subject, the animals read as themselves at a glance, and nothing hovers, flickers or gets cut off.

## 1. What exists today (v0.7.4)

- Shadows, tone mapping and bloom are already on and were approved in V3.1 Part 1.3 (`docs/REDESIGN_PLAN_V3_1.md`). `src/skin/table/BarnTable.tsx` sets `shadows={{ type: PCFShadowMap }}` and `toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1`; the lights live in `Lights` in `src/skin/table/Rendering.tsx`. The words "no bloom" in `CLAUDE.md` (lines 36 to 37) are stale. The old file 01 treated all three as new: wrong.
- The sun has one direction at every hour: `Lights` places it 20° up and 35° off the camera's heading for all four hours (`Rendering.tsx`, the `az` and `el` lines). Hours differ only in sun colour and strength, fog colour and sky.
- Rounded voxel corners are a trial switch: `ROUNDED_VOXELS` in `src/skin/voxel/rounded.ts`, overridable with `?voxels=sharp|round`.
- The season has no flag. It is mounted in eight places: `<Festive>` in `BarnTable.tsx`, `Farmstead.tsx` and `DuelTable.tsx`; `<SantaHat>` in `src/skin/table/Sheep.tsx` and `src/skin/table/places.tsx`; striped rails in `src/skin/dream/world.ts`; `Garland` (`src/skin/components/Garland.tsx`) in `src/skin/rooms/PaintedRoom.tsx` and `src/skin/boards/Leaderboards.tsx`. `useSeason` in `src/skin/hooks/useAmbient.ts` reads `?season=` but nothing calls it.
- Colours: `src/skin/voxel/palette.ts` holds 81 tones; `src/skin` holds 1,134 distinct hex colours outside tests. Palette tones pass through `lin()` and then ACES, so a hex in a plan is not the colour on screen.
- Voxel grids in use: 18 sizes from 0.012 m to 4 m (§4.3). The old file listed 5 and put buildings back on 0.20 m.
- Text: of the literal pixel sizes in `src/skin`, 4 are under 11 px. The old "8 to 9 px" was read off shrunken contact sheets.

**What the old diagnosis got wrong (tour artefacts, not faults):** the "pink-to-green gradient" is the page's sky gradient (`src/skin/styles/skin.css`) behind dev-only bake pages that players never load (`src/skin/PaintedApp.tsx`, `DEV` guard); "Real people need the game server..." is `NO_SERVER` in `src/skin/screens/PaintedHome.tsx`, shown only in a build with no server; the bomb judged in the tour was the Gold skin, not the Ice default; the "lumpy" wool levels 3 and 4 cannot occur in a game since traps were removed.

**The fair half of "vibecoded"** (each from the log or the code, and each what Brian asked to fix):
1. Terraced animal torsos and blankets: VOXEL counted 34, 37, 77, 71, 55 and 6 failing terraced lines on the dressed torsos of the sheep, pig, cow, horse, goat and chicken. The log itself notes coats hiding the legs.
2. Faces that misread at the speaker shot: the goat's mouth is a black bar wider than its muzzle (`src/skin/voxel/animals/goat.ts`); the horse's nostrils read as eyes.
3. The barn floor: Brian, 2026-11-08, "not overtexturized like the barn floor".
4. Crowded Home shots: the 0.7 m present fills a quarter of the tractor shot's height from 4 m away (`src/skin/scene/festive.ts`, `src/skin/scene/homePov.ts`); the log already warns "a bulb near a shot's camera hangs huge" (`CLAUDE.md`, line 189).
5. Turn text over the bomb's digits at the table: mainly the canvas mounted 1.21 to 1.35 times too large during the `.sk-swoop-in` scale, plus `barnSpot` in `src/skin/table/Bomb.tsx` choosing the side nearer the middle.
6. Small real breaks: the update sign over the D of FLEECED (`src/skin/components/TitleBoard.tsx`, `.sk-update` in `skin.css`); "botWORD" joined in the scoreboard (`src/skin/components/Ledger.tsx`); non-sheep tails vanishing at coat level 0 and name plates floating over horses and cows (`Sheep.tsx`, `BarnTable.tsx`); a robin 1.05 m from its beam (`src/skin/scene/barn.ts`); 75 loose pieces in the lobby pen (`src/skin/scene/pen.ts`).

## 2. Decisions that bind this file

- Hard rules, `CLAUDE.md` lines 5 to 25: skin only, no new tests outside `src/skin`, no new dependencies, ask first on settings, shortcuts and conflicts. "No studio, film or director names anywhere" (line 40).
- One level of detail, 2026-11-07 (lines 180 to 185): supersedes the 0.20 m and 1 m rows.
- "The season reaches every setting", 2026-11-07 (line 186); "Every animal wears a hat" (line 178).
- Beady eyes, 2 x 2 and dark with no whites; the pig keeps its plates, 2026-11-07 (line 272).
- Floating letters, chosen from five mock-ups, 2026-11-07 (line 249). Word of the day: "just make the text floating", 2026-11-08 (line 430).
- Light: "Keep the hemisphere fill low ... and exposure at 1", 2026-11-08 (line 454); night fill 0.62, moon 1.15, lanterns 1.5 times, 2026-11-13 (line 858).
- Snow: "super flat and untexturized ... just slight more detail", 2026-11-08 (line 463).
- Rounded corners "ON TRIAL", 2026-11-09 (line 578).
- Plain cards, no fake fasteners, `Lever` is `Switch`, 2026-11-13 (lines 1049 to 1065).
- No middle dot between phrases in anything new, 2026-11-14 (line 1317).
- Session of 2026-11-16: the wendigo is not touched; Counting Sheep goes side-on "like the dinosaur game"; the sack reel stays; shadows and tone mapping change only with a shown improvement; "especially the animal models good lord".
- The debate's rulings C1 (precedence), C3 (the barn bomb stays icy), C5 (fixed sun direction), M12 (animals), M13 (wendigo zone), M17 (season constant); file 19 §1 carries their effect.

## 3. Problems (verified)

- No precedence rule between this plan and `CLAUDE.md`, so the coder either stops constantly or overrides Brian (KEEPER found 118 items; file 19 §3).
- The old palette, grid, terrace and text rules could not be built (counts above).
- The old season rule needed a saved per-player switch, which is new saved data.
- The old light table cut night fill to 8% of today's and raised day fill 1.59 times (arithmetic on `Rendering.tsx` constants).

## 4. Changes

### 4.1 Precedence (ruling C1)
- **What:** one rule decides every disagreement.
- **Where:** this file; the prompt in `00-README-SUMMARY.md`; the entry at the top of `CLAUDE.md` (file 19 §1).
- **How:** `CLAUDE.md` is the rule book. Where this plan and `CLAUDE.md` disagree, `CLAUDE.md` wins unless the overhaul's entry names the point as superseded. A disagreement the entry does not name: stop and ask Brian. Do not choose. Read `CLAUDE.md` to its last line with the Read tool, in chunks: the harness loads only about 150 kB of its 194 kB.
- **Do not:** treat a plan file, an older plan document or a screenshot as outranking a dated decision.
- **Cost:** none.
- **Check:** HUMAN at review; the banned-returns list (file 19 §4) catches the commonest reversals.

### 4.2 Do not change
- **What:** things Brian art-directed stay as they are.
- **Where and what:** the floating letters (`.kit-float`, `.kit-float-need` in `src/skin/components/InputStrip.tsx`); the name plates (`.sk-plate`) and the speech bubble; Word of the day (`src/skin/wotd/WordOfDay.tsx`: floating text, no clicks); `Paper`, `Switch` and `Slider` in `src/skin/kit/index.tsx` (no pins, tilt, torn edges, strings, nails, stamps or levers); the loading doors (`src/skin/components/BarnDoors.tsx`, `src/skin/loading/*`, `public/loading/*`); the fair machine (`Machine` and `reelFor` in `src/skin/shop/FeedSacks.tsx`, `SPIN_MS = 3800`, `NEAR_MISS = 0.15`, the bulbs, the lever); the eight bomb skins (`src/skin/voxel/bombSkins.ts`, `src/skin/shop/bombAura.ts`), the bomb on the floor, icy, with its digits, and `red={false}` at the barn (ruling C3); burst acts (`src/skin/table/burstActs.ts`), the cloud counts and parked draws; the lobby (`src/skin/rooms/*`) and its pen (`src/skin/scene/pen.ts`, defects aside); the leaderboards in the sky (`src/skin/boards/*`); the podium (`src/skin/table/Podium.tsx`); the Trading Post's stall, tabs and mats; the profile's six slips (`src/skin/profile/Profile.tsx`); the play chooser (`src/skin/ranked/PlayChooser.tsx`); the rank names (`src/lib/ranked.ts`); the menu rows of `items` in `PaintedHome.tsx` (no new row: "Don't add a ninth without asking", `CLAUDE.md` line 1237); the avatar heads (`src/skin/assets/heads/*.png`) and the admin photo; the wendigo zone (§5).
- **Hooks tests and tools select, never renamed:** `data-tour="input"`, `data-tour="me"`, `.kit-float-need`, `.sk-input-bar`, `.sk-plate`, `.sk-plate-you`, `.sk-hud-tab`, `data-room-code`, `data-profile`, `.sk-bazaar-btn`.
- **Cost:** none. **Check:** `npm run gate`, banned-returns module (file 19 §4).

### 4.3 Grid register
- **What:** a new object uses the voxel size of its row. No new size without a new row here and a line to Brian saying why.
- **Where:** sizes passed to `new Grid(...)` across `src/skin`.

| Thing | Voxel size | Where today |
|---|---|---|
| Glints on bomb skins | 0.012 m | `voxel/bombSkins.ts` |
| Carved letters (letter board, signs); the farmer's head in the bedroom | 0.02 m | `voxel/table.ts`, `dream/bedroom.ts` (`HS`) |
| Bedroom fine fittings (lamp, hooks) | 0.025 m | `dream/bedroom.ts` (`S`) |
| Podium numerals; the bomb's digits | 0.03 m | `table/Podium.tsx` (`P`), `table/Bomb.tsx` |
| Trophy | 0.035 m | `voxel/trophy.ts` |
| Animals, farmer, bombs, sacks, stall goods, thumbnails, the Santa hat, the barn cat, the dream's shadow disc | 0.04 m | `voxel/animals/rig.ts`, `voxel/sheep.ts`, `voxel/bomb.ts`, `shop/thumbModels.ts`, `scene/festive.ts` (`santaHat`), `scene/barn.ts` (`C`), `dream/world.ts` (`shadowDisc`) |
| Dream obstacles, the doors, the tractor, the table's platform | 0.05 m | `dream/world.ts` (`D`), `loading/doorBoxes.ts`, `voxel/table.ts` (`platformGeometry`) |
| Burst props | 0.06 m | `voxel/burstProps.ts` |
| The barn; yard and farmstead objects after `detailed` (authored at 0.2 m); festive decor; podium base; duel posts; bedroom shell | 0.1 m | `scene/barn.ts`, `voxel/refine.ts`, `scene/festive.ts`, `table/Podium.tsx`, `scene/duel.ts`, `dream/bedroom.ts` |
| Podium barn doors; pen ground cover | 0.125 m | `table/Podium.tsx`, `scene/pen.ts` (`nature`) |
| Yard flat ground, the field, near forest, the dream's raft, chimney smoke, duel floes | 0.2 m | `scene/yard.ts`, `scene/countryside.ts`, `dream/world.ts` (`raftChunk`), `scene/Sky.tsx` (`ChimneySmoke`), `scene/duel.ts` |
| Podium back wall; near pen trees; the dream's moon | 0.25 m | `table/Podium.tsx`, `scene/pen.ts`, `dream/DreamSky.tsx` |
| Far forest pines | 0.4 m | `scene/countryside.ts` (`FAR`) |
| Back hills and side land after `detailed`; the windmill's blades; far pen trees; duel bank pines | 0.5 m | `scene/distance.ts`, `scene/pen.ts`, `scene/duel.ts` (`pines`) |
| Far land and hills; farmstead terrain; Home's moon; duel shore; pen land | 1 m | `scene/distance.ts`, `scene/farmstead.ts` (`terrain`), `scene/Sky.tsx`, `scene/duel.ts`, `scene/pen.ts` |
| Duel lake; Home's mountains; the pen's range | 2 m, 3 m, 4 m | `scene/duel.ts` (`water`), `scene/distance.ts`, `scene/pen.ts` (`mountains`) |

- **Do not:** move buildings or trees back to 0.20 m (supersedes nothing: "One level of detail" stands). Terrain and back hills stay at today's sizes on High.
- **Cost:** one small test. **Check:** `src/skin/__tests__/gridRegister.test.ts` (new file) reads every `new Grid(` argument and named size constant under `src/skin` and fails on a size not in this table; `npm test`.

### 4.4 Palette ratchet
- **What:** rebuilt animals and remade scenery take every colour from `T` in `src/skin/voxel/palette.ts`. A missing tone is added there as a named three-tone entry.
- **Where:** any file a milestone rebuilds.
- **How:** no new hex literal in a rebuilt file. Items, bomb skins, bursts, rank badges, the bedroom, the stall and the avatar catalogue keep the colours Brian approved. Judge colour on screen, never by hex.
- **Do not:** sweep the whole skin; remove colours from screens no milestone touches.
- **Cost:** a JSON of counts. **Check:** per file, hex literals farther than ΔE76 3 from a palette tone may only fall; counts in `docs/visual-overhaul/RATCHETS.json` (new file, file 16); `npm test`.

### 4.5 Shape rule
- **What:** animal torsos and garments read as boxes with softened edges, not stacked terraces. Round things Brian approved (bombs, sun, moon, balloons) stay round.
- **Where:** scope is animal torsos and garments only (`src/skin/voxel/animals/*`, `src/skin/voxel/sheep.ts`, `src/skin/voxel/animals/garments.ts`). File 03 owns the method (the shape switch, ruling M12).
- **How:** every model is built and judged under both `?voxels=round` and `?voxels=sharp`; `ROUNDED_VOXELS` stays a switch. On a torso, head or garment surface, a run of three or more one-voxel steps fails; necks, tails, manes, horns, ears and the hat are exempt by name. The sheep's fleece is judged as its own before-and-after pair: its noise is wool, not a fault.
- **Do not:** change a pivot, anchor or `SHEET` range before Brian ticks a species (M12); rebuild the bomb.
- **Cost:** none at run time; triangles per species no higher than today. **Check:** the terrace budget test of file 03, `npm test`; HUMAN, the face sheet at speaker-shot and Home size.

### 4.6 Season constant (ruling M17)
- **What:** one switch turns the whole season on or off.
- **Where:** `FESTIVE` beside `UPDATE_NAME` in `src/config.ts` (a named approved change). It gates every festive mount listed in §1 and every seasonal line (`CHEERS` and "Baa humbug!" in `src/skin/screens/PaintedGame.tsx`, the three seasonal tips in `PaintedHome.tsx`).
- **How:** on while Fleece Navidad is the update. `?season=` works in dev and gate builds only. While on, the Santa hat is merged into the head mesh at build (one draw fewer; it cannot detach). While off, no hat is built.
- **Do not:** add a per-player switch (new saved data); edit `festive.test.ts`; change how much decoration there is without question 7.
- **Cost:** about 30 lines; one draw fewer per animal. **Check:** a unit test that with `FESTIVE` false no festive builder runs and no hat geometry exists; `npm test`.

### 4.7 Light bounds
- **What and where:** file 02 owns the light. Its limits, binding here: fill `#AEBEDA` over `#655F5C`, at most 0.58 at dawn, day and dusk and 0.62 at night; exposure 1; moon at least 1.15; `PCFShadowMap`. The sun's direction is the same at every hour (ruling C5). The ice, the dream and the doors keep their own light. On Home shot 2 the light, fog and tilt-shift are today's on every tier.
- **Check:** file 02.

### 4.8 Text rule
- **What:** text floats over the scene in three forms only, each as Brian chose it: the word bar's floating letters, Word of the day, and the title. Each keeps its outline and glow. All other text sits on a kit surface.
- **How:** minimums (11 px uppercase tags, 12 px labels, 14 px body) apply to new and changed rules. Fix the 4 literals under 11 px one at a time; review the rest only where a screen is touched.
- **Do not:** mass-tokenise sizes; change sizes in `src/skin/rooms/rooms.css` or `src/skin/boards/boards.css` without a measured fault; put any middle dot between phrases in new copy.
- **Check:** the kit audit's `small-text` count only falls (`npm test`); the gate's computed-size sweep on its shots (file 16).

### 4.9 Keep list
Brian liked or art-directed these; overhaul work refines them only where a file names a defect: the dream's results bedroom; the night farm with the aurora (Home shot 3); the Trading Post's stall, wooden tabs and stage mats; the fair machine; the lobby's pen with walking animals; the leaderboards on sky pedestals; the podium with etched numbers; the kit's boards, planks and slates; the floating letters, name plates and bubble; the eight bomb models and the acts; the doors; the wake clouds; the snow's texture (`snowPaint`); his six pixel-art heads.

## 5. Integrity (nothing floats, nothing breaks)

- File 18 owns the checks (`npm run check:scenes`, anchors, bake manifest). This file adds only: a rule a model cannot pass in both `?voxels=` modes is not done.
- The wendigo zone (ruling M13; full text in file 19 §1): `src/skin/table/Wendigo.tsx`, `wendigoPose.ts`, `WendigoPreview.tsx` and `public/models/wendigo.glb` byte-identical; `WENDIGO_AT`, `POV_SHOTS.desktop[2]` and `POV_SHOTS.phone[2]` pinned; the 12 m stand voxel-identical; its view cone hashed; light, fog and tilt-shift on shot 2 unchanged.

## 6. Budget

No rule here may raise a number in file 17. A model rebuilt under §4.5 keeps its triangles and draws at or under today's (`tools/animalReport.ts`).

## 7. Acceptance

- [ ] `npm test`: grid register, palette ratchet, season constant, terrace budget pass.
- [ ] `npm run gate`: banned-returns module green; no do-not-change file in the diff without a named question answered.
- [ ] HUMAN: Brian has seen each changed model under both `?voxels=` modes.

## 8. Decisions for Brian

Questions 1 (eyes), 2 (hats), 3 (avatar heads), 7 (season amount) and 13 (rounded corners) in file 19 §2 bind this file. Recommended answers: keep the 2 x 2 eyes, keep hats while the season is on, keep his heads, keep today's season tidied, keep the switch.
