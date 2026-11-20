# Plan: the diorama look for Fleeced's scenery

Written 18 November 2026 against the game as it is now: v0.8.0, commit `4f033f4` (the visual overhaul, milestones 0 to 12, is merged). Save as `docs/diorama/PLAN.md` in the repo, with the reference pictures in `docs/diorama/reference/`.

**Scope.** Everything the game draws as a world: the farm on Home, the countryside and distance, the barn interior at the table, the podium's barn stage, the ice for practice, the lobby pen, Counting Sheep's dream world and the farmer's bedroom, and the season's decorations on all of them.

**Out of scope, unchanged:** all interface (menus, HUD, panels, boards, name plates, the speech bubble, floating letters, the loading doors, the Trading Post and its stall and item pictures); all game behaviour (rules, timers, cameras' gameplay framing, hit boxes, the Counting Sheep mapping); every animal model (all species, the sheepdog, robin and cat); the bomb, its skins and the bursts; the wendigo and its protected zone.

---

## 1. Is Gemini's description right?

Mostly. Here is what to keep, what to adjust, and what cannot work in a browser game.

| Gemini says | Verdict | What the plan does |
|---|---|---|
| Flat, matte, solid colours; no texture, noise or banding | **Right**, and the biggest difference from the game today | One flat colour per part (section 3.2) |
| No black outlines; parts separated by small value shifts and contact shadows | **Right** | Value steps and contact darkening (3.2, 4.3) |
| Mixed resolution: big chunky blocks for buildings and terrain, tiny blocks for faces, crops, tools | **Right** | A four-step size ladder (3.1) |
| Warm, slightly desaturated, toy-like colours | **Right** | New palette (3.3) |
| Sharp-edged cubes | **Half right.** Edges in the reference read very slightly softened | Keep the existing soft-edge lighting trick, which costs no triangles (3.4) |
| Soft "global illumination" with smooth ambient occlusion | **Not possible in real time in a browser.** It can be imitated | Baked corner shading, baked contact shading, softer shadows, optional screen-space shading on the best tier (4.3) |
| Orthographic isometric projection | **Wrong for the game.** The reference is a narrow-lens three-quarter view, and the game's cameras are gameplay framing | Game cameras unchanged. Orthographic views are used only for reference sheets and the prop board (5) |
| Isolated floating diorama bases on an off-white studio background | **A product-sheet presentation, not a game world.** Home needs its sky, time of day and the wendigo's forest | Diorama bases only where a scene is already a small island: the lobby pen, the ice, the dream's islands. The off-white studio is used for the prop board (5.4) |

---

## 2. What separates today's game from the reference (verified in code and pictures)

1. **Every voxel picks its own colour at random.** Scenery colours come from `pick(tone, r)` in `src/skin/voxel/palette.ts:65`: each voxel takes the light, mid or dark tone at 60/30/10%. Scene builders call `rng`/`hash3` about 200 times (`src/skin/scene/*.ts`, `src/skin/dream/world.ts`, `bedroom.ts`). The result is speckle on every surface. The reference has none.
2. **Bevelled stair-steps.** `detailed()`/`detailedSteps()` in `src/skin/voxel/refine.ts` halve the cell size and bevel every outline (`yard.ts:103`, `farmstead.ts:507, 564, 573`, `distance.ts:204`, `duel.ts:111`, `pen.ts:108, 285`). Edges become terraces instead of clean box edges. It also roughly quadruples the faces.
3. **Snow with per-voxel texture** (`snowPaint`/`snowAt`, `src/skin/voxel/snow.ts`, used by `yard.ts`, `farmstead.ts`, `countryside.ts`, `dream/world.ts`). The reference's surfaces are clean.
4. **Haze.** Exponential fog at density 0.012 in the hour's colour (`src/skin/table/Rendering.tsx:60`) and a tilt-shift blur on Home (`FarmBackdrop.tsx:100`, strength 0.15) turn the wide shots grey (overhaul picture `docs/visual-overhaul/m08/c1-after.jpg`). The reference is crisp.
5. **Clutter.** Large baubles, candy canes, scattered straw at the table, many small pieces at similar sizes, so nothing reads as the subject.
6. **Loose and overlapping pieces are still tolerated.** The stored ratchets (`docs/visual-overhaul/RATCHETS.json`, `scenes.connect.loose`) allow 1,321 loose pieces on the farm, 66 in the pen, 3 on the podium and 1 in the bedroom. Coplanar (flickering) overlap area is 834 m² on the farm, 55 m² in the pen, 15 m² in the dream and 6.4 m² on the ice.
7. **Still heavy to draw.** On the best tier, Home's busiest shot draws 2.39 M triangles in 513 draws (`home-pov1`); the table 1.12 M. Even the lowest tier draws 1.67 M on that shot.

Points 1 to 3 cause both the "vibecoded" look and much of the cost. Flat colour lets the mesher merge whole walls into a few large rectangles (it already merges same-colour faces: `MERGE_FLAT`, `src/skin/voxel/mesher.ts:53`). Dropping the bevel refine removes most of the remaining faces. **The new look should therefore also be much cheaper to draw.**

---

## 3. The style rules (binding for every scenery change)

### 3.1 The size ladder
Every mesh declares one cell size from this ladder. Nothing is built at another size.

| Step | Cell | Used for | Today's nearest |
|---|---|---|---|
| L, land | 0.5 m (1 m beyond 60 m) | terrain tiles, diorama bases, hills, mountains | 0.5 m and 1 m far land |
| M, structure | 0.1 m | walls, roofs, floors, fences, pens, rocks, trees, the silo, the ice | barn at 0.1 m |
| S, props | 0.05 m | bales, crates, buckets, troughs, lanterns, the tractor, tools, presents | tractor at 0.05 m |
| XS, detail | 0.025 m | crops, flowers, door handles, window bars, tool heads, small signs | (new) |

Animals stay at 0.04 m and are not touched. **`detailed()` is no longer used for scenery:** each object is authored at its own step, with clean box edges.

### 3.2 Colour
- **One flat colour per part.** A wall is one colour. A plank is one colour. A roof slab is one colour. No per-voxel random choice.
- **Separation by value steps, not lines.** Neighbouring parts of the same material differ by one step: 6% lighter or darker (for example, alternate wall boards, fence posts against rails, the top tile against its side).
- **Shading comes from light, not paint.** No painted dark edges, gradients or noise.
- Allowed exceptions, each listed in the palette file with a reason: snow drift shading (if Brian chooses it, see question 2), the night sky, the aurora, water.
- **Example:** today a barn wall is a scatter of three reds; under the new rule it is boards of `barn` and `barn−1` alternating every 0.2 m, each board one solid colour.

### 3.3 Palette (starting values, sampled from Brian's reference)
The coder samples exact values from `docs/diorama/reference/` with a script and records them in `src/skin/scene/style/palette.ts` (new file). Starting values:

| Token | Summer (reference) | Winter (default) | Used for |
|---|---|---|---|
| `ground.top` | `#8DBB4E` | `#F1F2EE` (snow) | tile tops |
| `ground.side` | `#6E9A3C` | `#E2E4E1` | the first layer under the top |
| `soil` / `soil−1` | `#6B4A2E` / `#53392A` | same | diorama base sides, exposed earth |
| `path` | `#B08A5A` | `#D8CCB8` (trodden snow) | paths, pens' floors |
| `barn` / `barn−1` | `#C0392B` / `#A93226` | same | barn boards |
| `trim` | `#F1ECE2` | same | barn trim, window frames, house walls |
| `roof` | `#5A4033` | same, with a snow cap of `ground.top` | roofs |
| `wood` / `wood−1` | `#8A5F3B` / `#6B4527` | same | fences, sheds, crates (rails / posts) |
| `hay` | `#E2C26A` | same | bales, straw |
| `leaf` / `leaf−1` | `#7BAE45` / `#5E8E36` | `#4F7A4A` / `#3F6640` (pine) | tree canopies |
| `trunk` | `#7A5434` | same | trunks |
| `stone` / `stone−1` | `#A8A29A` / `#8A847C` | same | rocks, walls, the pond rim |
| `water` | `#6FAFCB` | `#BFDDEB` (ice) | the pond |
| `crop.*` | carrot `#E8833A`, corn `#E9C440`, wheat `#D9B860` | under snow, not shown | the field |
| `studio` | `#ECEBE6` | same | the prop board's background only |

The existing `DESATURATE` factor of 0.7 in `lin()` (`palette.ts:50`) applies to all tokens. The coder judges the result against the reference under the game's real light, not by the hex values alone.

### 3.4 Shape
1. **Silhouette from a few big boxes.** A building is its walls, roof slabs, door, windows and trim: about 10 to 30 boxes, not thousands of placed voxels.
2. **Detail only where the eye lands:** doors, windows, the pen gate, the coop's ramp, the scarecrow's face, the tools in the shed. Each prop recipe states a detail budget (number of XS parts).
3. **No stair-stepped bevels** on buildings and props. Soft edges come from the existing lighting trick `ROUNDED_VOXELS` (`src/skin/voxel/rounded.ts:15`, currently on), which bends normals at outer edges and adds no triangles. Every prop must look right with `?voxels=sharp` and `?voxels=round` (an existing rule).
4. **Round things are stepped boxes:** trees are stacked box tiers (pines) or a box canopy (orchard), and bales are boxes with straps. No smooth meshes (the voxel rule stands).
5. **Minimum feature:** one cell of the object's own step. No single-voxel litter anywhere ("no scattered blocks standing in for litter", 2026-11-07).

### 3.5 Layout
1. **A tile grid.** On the farm, pens, paths, fields, the pond and building footprints sit on whole metres. Heights are multiples of 0.1 m.
2. **Paths sit one step (0.1 m) below the snow**, with a clean edge, as the reference's dirt paths sit below the grass.
3. **One subject per shot.** Each Home tour shot keeps its subject clear, with at least 40% calm space (the existing calm-area rule).
4. **Grouped props.** Props come in small, deliberate groups (a bale stack, a bucket and a trough), never sprinkled.

### 3.6 Diorama bases (only where a scene is already an island)
The lobby pen, the ice spit for practice and every island in Counting Sheep get a base: a snow top, then two to three soil layers (`soil`, `soil−1`) with a few stones, a clean vertical edge and squared corners, like the reference. Home's farm is a world, not a base, because it needs its sky, its hours and the wendigo's forest.

---

## 4. Light and rendering

All light changes stay inside Brian's limits unless he lifts them (question 3): hemisphere fill at most 0.58 by day and 0.62 at night, exposure 1, `PCFShadowMap`, the sun's direction fixed (`LIGHT_BOUNDS`, `src/skin/table/Rendering.tsx:48`). Every change is shown to Brian as before-and-after pairs. Shadows and tone mapping change only if he sees a real improvement (his standing rule).

1. **Tone mapping.** Pairs of six shots under ACES (today), Neutral and AgX (both built into three r187). Neutral usually keeps flat toy colours closest to the paint. Brian picks one; it then applies to every scene canvas (`DreamStage.tsx`, `PenStage.tsx`, `DuelTable.tsx`, `BedroomBubble.tsx`, the table and Home).
2. **Fog.** Lower density near the camera, with only the distance fading into the sky colour (for example, `FogExp2` 0.012 to about 0.006, or plain `Fog` starting at 40 m). Pair.
3. **Corner and contact shading (the "soft GI" look).**
   - Keep the mesher's per-corner shading (`AO_STEP` 0.2, `mesher.ts:17`). Test 0.25 for the L and M steps, where corners are rarer and should read clearly.
   - **Contact shading, baked:** under and around every placed prop, the ground keeps its own cells (no merging within one cell of a footprint), and those cells are darkened by distance to the footprint, up to 18%. Footprints come from the placement list `PLACED` (`src/skin/scene/placed.ts:377`). This is free at run time.
   - **Screen-space shading, best tier only:** test `GTAOPass` (in three's examples, no new dependency) at half resolution on the High tier. It stays only if the pair shows a clear gain and the frame budget holds.
4. **Softer shadow edges.** With `PCFShadowMap`, `light.shadow.radius` softens edges; test 2 to 4 against today. Pair.
5. **Tilt-shift on Home.** The reference has no blur. Proposed: off on every shot except the paddock shot, where it stays exactly as today (wendigo rule). Pair.
6. **Day sky.** A clean gradient from pale blue overhead to warm off-white at the horizon, instead of today's flat grey haze. Night, dawn and dusk keep their own colours. `src/skin/scene/Sky.tsx`. Pair.
7. **Bloom** stays as tiered today (lanterns and windows only).
8. **Animals** are not remodelled, but they are lit by the new light. Brian sees the face sheet under the new light before it ships.

---

## 5. How models get made when Claude Code is bad at modelling

The same method as the animal plan: never ask for taste; ask for numbers and a test.

### 5.1 Reference sheets (Brian, about 1 to 2 hours in total)
For every prop in section 6's lists, generate with the image tool:
- one **three-quarter view** in the style, and
- **front, side and top views**, orthographic, same object, same colours.

Save them as `docs/diorama/reference/<id>-34.png`, `-front.png`, `-side.png`, `-top.png`. Use this prompt (Gemini's text, corrected for the game), changing only the bracket:

> A clean, minimalist micro-voxel 3D model of [a snow-covered red barn with white trim and a dark brown roof], for a cosy winter farm game. Built from sharp-edged cubes: large chunky blocks for the main structure, much smaller blocks for small details. Flat, matte, solid colours: warm, slightly desaturated, toy-like. No textures, noise, gradients or outlines; parts are separated by small differences in shade. Soft, diffuse studio light, gentle ambient occlusion and a soft contact shadow underneath. Standing alone on a plain off-white background. [Three-quarter view from slightly above / exact front view, orthographic, no perspective.]

If a view disagrees with the three-quarter view, the three-quarter view wins.

### 5.2 Every prop is a recipe written as data
- `src/skin/scene/style/kit.ts` (new): a small set of builders that use the ladder and the palette only: `slab`, `boardWall` (boards of alternating value), `post`, `rail`, `gableRoof`, `boxCanopy`, `tierPine`, `bale`, `crate`, `rock`, `tileBase` (a diorama base), `snowCap` (a flat snow layer on any top).
- `src/skin/scene/style/recipes/<id>.ts` (new): one file per prop, holding only data: its step, its boxes (size, position, colour token) and its footprint and support for the placement list.
- Builders in `src/skin/scene/*.ts` place recipes; they no longer draw props voxel by voxel.

### 5.3 The match test
- `?preview=prop&id=<id>&view=34|front|side|top` (dev only, like the other preview pages) renders one recipe on the `studio` background with an orthographic camera for front, side and top.
- `tools/propMatch.mjs` (new) renders each view, cuts out the outline, and compares it with the reference: **outline overlap at least 90% on front, side and top**, and **each part's colour within ΔE 6 of the sampled reference**. Claude Code loops (render, compare, adjust the numbers) until every prop passes. It may not edit the reference pictures or the pass marks.
- An overlay switch lays the reference over the render at 50% so Brian can check it himself.

### 5.4 The prop board
`?preview=props` (dev only) lays every finished recipe out on the off-white studio background, grouped like Brian's reference sheet. This is where the "floating dioramas on off-white" presentation belongs. Brian reviews the board once, before any scene is rebuilt.

### 5.5 The style lint (in `npm test`, arithmetic only)
`src/skin/scene/__tests__/style.test.ts` (new) fails when:
- a scenery mesh uses a cell size not on the ladder;
- a scenery colour is not a palette token or a token's value step;
- a file under `src/skin/scene/style/` or a rebuilt builder calls `rng`, `hash3`, `pick` or `snowPaint` for a colour (a static check of the source);
- a recipe has more than 6 colour tokens or exceeds its stated detail budget;
- a recipe has no footprint or support.

---

## 6. Scene by scene

Each scene keeps its cameras, its gameplay positions and everything listed under "Keep". Each one ends with a before-and-after pair for Brian.

### 6.1 Home: the farm core (milestone D3)
**Files:** `src/skin/scene/farmstead.ts`, `yard.ts`, the outside of the barn in `barn.ts`, `src/skin/table/Farmstead.tsx`, `FarmBackdrop.tsx`, `festive.ts` (outside the barn).
**Recipes (from Brian's farm picture):** red barn with white X doors and a dark roof; silo; farmhouse (white walls, dark roof, chimney); chicken coop with ramp and wire run; paddock stable with a lean-to roof and trough; pig shelter; goat rock with a ramp; tool shed with tools and the tractor; scarecrow; cube-canopy orchard trees; snowy box pines; plank fences (posts and two rails); bale stack; pond as a frozen sheet with a stone rim; the field as snowy rows (crops hidden under snow in winter).
**Changes:** rebuild every building from its recipe; lay the yard, paths, pens and field on the 1 m grid with paths one step lower; replace sprinkled pieces with grouped props; snow caps as flat layers on every top.
**Keep:** every tour shot's camera (`POV_SHOTS`, `src/skin/scene/homePov.ts`) and its subject; the animals and their placement; the wendigo rules (6.2); the existing calm-area and framing tests.

### 6.2 Home: countryside and distance (milestone D4)
**Files:** `src/skin/scene/countryside.ts`, `distance.ts`.
**Changes:** forest as `tierPine` recipes in three sizes on the grid (clumps, not rows: the 2026-11-07 rule stands); the dry stone wall as `stone` blocks; drifts as stepped L-step mounds instead of noise; hills and mountains as clean stepped L-step shapes with flat snow tops and one value step on shaded faces.
**The wendigo, binding:** no change to the wendigo's files, position or pose. Inside its 12 m stand and its hashed view cone from the paddock camera, **nothing changes at all, not even colour**. `isClear` still reads the frozen sight lines; sight rays stay 134/136/137 of 153; the magenta-mask match stays at least 0.98; on the paddock shot, light, fog, tilt-shift and the tour are today's on every tier. `npm run check:scenes` checks all of this already (`tools/scenes/wendigo.ts`, `wendigo.pins.json`). Consequence: on the paddock shot, the trees around it keep today's look. Question 8 asks whether that is acceptable.

### 6.3 The barn interior at the table (milestone D5)
**Files:** `src/skin/scene/barn.ts`, `src/skin/voxel/table.ts` (materials only), `src/skin/table/places.tsx`.
**Changes:** walls as board walls (one colour per board, alternating value); the floor as flat plank boards with hay in a few tidy heaps against the walls (the calm floor round the seats stays); lanterns, the tree and presents as recipes; contact shading under every prop.
**Keep:** the barn as a cut-away set for the table camera; every seat position; the letter board's shape, letters and hang points (it is read every turn: only its wood may take the `wood` token); name-plate anchors; the framing tests (`tableFrame`, `src/skin/scene/layout.ts:144`). No prop may enter the projected boxes of the board, the speaker or the plate.

### 6.4 The podium (milestone D5)
**Files:** `src/skin/table/Podium.tsx`.
**Changes:** the barn stage rebuilt from the same wall, floor and bale recipes; the timber blocks as clean boxes with their carved, gilded places kept.
**Keep:** heights (1.5, 1.1, 0.8 and 0.55 m), places, dances, the trophy.

### 6.5 Practice on the ice (milestone D6)
**Files:** `src/skin/scene/duel.ts`, `src/skin/table/DuelTable.tsx`.
**Changes:** the spit of ice becomes a diorama base: an ice top on a snow and soil base with a clean edge into the black lake; shore pines as `tierPine`; the sign as a recipe.
**Keep:** the standing line, the camera, the spotlight and the red pressure effects, the VS bar.

### 6.6 The lobby pen (milestone D6)
**Files:** `src/skin/scene/pen.ts`, `src/skin/rooms/PenStage.tsx`.
**Changes:** the pen as a diorama base with plank rails, a gate and a lantern post; pines around it standing on the base; the 66 loose pieces gone.
**Keep:** the screen's layout and panels (interface), where players and farm sheep stand, the name planks, `shift`.

### 6.7 Counting Sheep's dream and the bedroom (milestone D7)
**Files:** `src/skin/dream/world.ts`, `bedroom.ts`, `DreamSky.tsx`.
**Changes:** the floating islands become literal dioramas (a snow top, soil layers, two or three tier pines, a tiny farmhouse recipe); the cloud sea as large rounded L-step masses in two flat tones; mountains as clean stepped shapes; obstacles' looks (`lookOf`, `world.ts:384`) rebuilt from the fence and bale recipes; the bedroom's furniture as recipes.
**Keep, binding:** the side-on mapping and every number in plan file 09 (SPAN, art scale, positions, the play strip); every obstacle's rules box and on-screen size; fence signs at least 26 px tall; the lane as the brightest band; the bedroom as its own canvas; the wake clouds; the moon, stars and aurora.

### 6.8 The season (every milestone, checked in D8)
While `FESTIVE` is true (`src/config.ts:8`), decorations follow the new rules: one Christmas tree by the barn doors and one in the barn, wreaths on doors, one string of lights per building, presents in one group, one snowman. All are recipes with the palette's reds, greens and golds as flat colours, and baubles are XS cubes inside the canopy (not big blocks on its surface). With `FESTIVE` false, every decoration is gone and nothing is left floating.

---

## 7. Performance

The new style should be cheaper: flat colour lets faces merge, and authoring at the right step replaces the bevel refine. These targets are estimates and must be measured with `npm run gate` (counts). They are ceilings, never raised:

| Screen (computer 1280 × 720) | Today, High | Target, High | Target, Low |
|---|---|---|---|
| Home, busiest shot (`home-pov1`) | 2.39 M triangles, 513 draws | ≤ 1.0 M, ≤ 260 draws | ≤ 0.6 M |
| Home, first shot (`home-pov0`) | 1.65 M, 272 draws | ≤ 0.8 M, ≤ 200 draws | ≤ 0.5 M |
| Table, 6 seats | 1.13 M, 143 draws | ≤ 0.6 M, ≤ 130 draws | ≤ 0.45 M |
| Home graphics memory (`bufferBytes`) | 174 MB | ≤ 80 MB | ≤ 50 MB |

**Rules:**
1. Static scenery is merged into a few meshes per material and per area (not instanced: instancing stays for particles only, the V3 rule).
2. Merging never crosses a contact-shading area, a value-step boundary or a rounded edge.
3. No new canvas, light, post-processing pass or shadow caster without a line in the budget.
4. If a target is missed: stop and report. Never remove visible content on the High tier to meet a number.
5. The bundle has 91 bytes of room (763,309 of 763,400). Each milestone deletes the code it replaces (the old builders, `snow.ts` if question 2 is yes). Where it still grows, the limit is raised in that pull request, as Brian chose on 2026-11-17.

---

## 8. Nothing floating, nothing flickering

The tools exist (`tools/scenes/`, `npm run check:scenes`); this plan drives their numbers to zero.

1. **Every prop is placed through the placement list** (`src/skin/scene/placed.ts`) with its footprint and its support (`floor`, `beam`, `bedding`, `post`). A prop not in the list fails the style lint.
2. **Snap to the grid:** footprints on the tile grid; the bottom of every prop exactly on its support's top (gap 0 ± 0.02 m, measured by the existing ray-down check).
3. **Targets per scene** (`RATCHETS.json`, `scenes.connect.loose` and `scenes.coplanar.area`): loose pieces 0 on the farm (today 1,321), pen (66), podium (3) and bedroom (1); coplanar area under 1 m² per scene (today 834 m² on the farm). Exceptions only for meshes placed whole on purpose (distant hills, mountains, the dream's islands), each listed in `docs/visual-overhaul/EXEMPT.json` with a reason.
4. **Snow caps are part of the object they sit on** (built in the same grid), so a cap can never hover.
5. **Diorama bases are one connected piece** with what stands on them.
6. **Lens clearance:** nothing within 1.0 m of any tour or table camera inside its view (the existing check).
7. **Lights on lamps:** every point light inside a lantern recipe (the existing `LIGHTS` check, `placed.ts:478`).
8. **Season off:** a test builds every scene with `FESTIVE` false and checks for zero loose pieces.

---

## 9. Run order (■ = stop for Brian)

One branch and one pull request per milestone, reviewed by Kai; changelog line and version bump; never a push to `main`.

| # | Milestone | Visible change? |
|---|---|---|
| D0 | **Baseline and tools.** Record today's gate result as the baseline: at v0.8.0 it fails on human checks, the test ledger, pictures and counts (`docs/visual-overhaul/reports/m12.md`). From now on, a milestone may not make any check worse than the baseline, and must improve the scene and count numbers it touches. Add the palette, the kit, the recipe format, the style lint, the prop preview, `tools/propMatch.mjs` and the prop board. Brian adds the reference sheets. ■ Brian approves the palette swatches. | No |
| D1 | **Light and render pairs** on today's geometry: tone mapping, fog, day sky, tilt-shift, shadow softness, corner shading, optional screen-space shading. ■ Brian picks. | Yes, as chosen |
| D2 | **The props**, built and matched on the prop board until every match test passes. No scene changes yet. ■ Brian reviews the board. | No (board only) |
| D3 | **Home farm core** (6.1). ■ | Yes |
| D4 | **Countryside and distance** (6.2), wendigo checks green. ■ | Yes |
| D5 | **Barn interior and podium** (6.3, 6.4). ■ | Yes |
| D6 | **Ice and lobby pen** as dioramas (6.5, 6.6). ■ | Yes |
| D7 | **Counting Sheep world and bedroom** (6.7), with the side-on numbers unchanged. ■ | Yes |
| D8 | **Season pass and clean-up:** decorations (6.8); delete replaced builders and helpers; re-bake every picture that shows scenery and is in the bake manifest (the play chooser's pictures in `public/play/`, the link picture `public/og.png`); tighten every ratchet to its new value; the full tour. ■ | Small |

---

## 10. Acceptance

**Automatic (each milestone, for what it touched):**
- Type check, `npm test`, both builds pass.
- `npm run check:scenes`: loose pieces and coplanar area at or under the targets in section 8; the wendigo stage passes.
- `npm run gate` counts at or under section 7's ceilings on every tier.
- The style lint passes (no off-ladder sizes, no off-palette colours, no random colour, every prop placed).
- `tools/propMatch.mjs` passes for every recipe used.
- Framing tests at the table, the Counting Sheep mapping tests and the dream's pixel gates pass unchanged.
- No file in the interface, the engine, the animals, the bomb or the wendigo zone changed (the gate's fences).

**Brian (HUMAN):**
- Before-and-after pairs of every tour shot, the table at 4 and 10 seats, the ice, the pen, the podium and the dream, at 1280 × 800 and 390 × 844, by day and at night.
- The prop board beside his reference sheet.
- Three friends shown the new Home for three seconds can say what the subject of each shot is.

---

## 11. The prompt for Claude Code (one milestone per session)

```
You are executing one milestone of docs/diorama/PLAN.md. Milestone: D0.
1. With the Read tool, read CLAUDE.md to its last line in chunks, then docs/diorama/PLAN.md, every word.
2. git fetch; branch diorama/<milestone> from origin/main. Run npm run gate and compare with the baseline
   recorded in D0. If a check is worse than the baseline before you start, stop and report.
3. Make only this milestone's changes. Scenery only: no interface, no game behaviour, no animal, bomb or
   wendigo change. Never invent a shape: every prop comes from a recipe matched against docs/diorama/reference/.
4. Commit in small steps; run the type check and npm test after each.
5. At the end: npm run check:scenes, npm run gate, tools/propMatch.mjs for every recipe used. Re-bake any
   picture the bake manifest names. Commit the gate report unedited.
6. Open a pull request with before-and-after pairs, the numbers against the targets, and any question for
   Brian. Then stop.
Never: raise a budget or a ratchet, loosen or skip a check, edit a reference picture or a pass mark,
change a camera's gameplay framing or a hit box, add a dependency, or push to main.
```

---

## 12. The CLAUDE.md entry (Brian pastes it at the top, under the overhaul entry)

```
## The diorama scenery (Brian, 2026-11-18) — plan: docs/diorama/PLAN.md
Requested by Brian: the game's scenery should look like his reference sheet (docs/diorama/reference/): clean
micro-voxel models, flat matte colours, no texture or outlines, chunky blocks for structure and tiny blocks
for detail, soft light. No interface, behaviour or animal changes.
- Supersedes for scenery only: "One level of detail for the scenery" (2026-11-07: the refine step); V3 Part 4.1's
  grid table (replaced by the plan's size ladder); per-voxel tone picks for scenery. If question 2 is yes, also
  "Snow with a little texture" (2026-11-08).
- Everything else stands, the wendigo zone above all.
```

---

## 13. Decisions for Brian (each has a default; nothing waits except D0's palette and D1's picks)

| # | Question | Default |
|---|---|---|
| 1 | **Season.** Winter in the new style (snow tops on the reference's farm), or summer green as in the reference? | Winter |
| 2 | **Snow texture.** On 8 November you asked for slight texture because the snow looked flat. The new style uses flat snow and gets its shape from drifts, steps and shading instead. Accept that, judged on pairs? | Yes, judged on pairs; if it still looks flat, add very large, soft two-tone drift shading (no speckle) |
| 3 | **Light limits.** The style wants softer, brighter fill. Keep your limits (fill at most 0.58 by day, exposure 1), or allow one pair at fill 0.7 with the new shading? | Keep the limits; show the one pair |
| 4 | **Tone mapping.** ACES (today), Neutral or AgX, chosen from pairs? | Pick from pairs (Neutral recommended) |
| 5 | **Tilt-shift blur on Home**, off except the paddock shot? | Off |
| 6 | **Lighter fog and a clean day sky**, from pairs? | Yes |
| 7 | **Decorations:** one tree by the doors and one in the barn, wreaths, one light string per building, one group of presents, one snowman? | Yes |
| 8 | **The paddock shot.** The wendigo rules keep its trees, light and fog exactly as today, so that one shot will look older. Accept, or allow the trees around it to take the new colours while the wendigo, its stand and its visibility checks stay exactly as they are? | Accept (nothing near the wendigo changes) |
| 9 | **Diorama bases** with visible soil edges for the lobby pen, the ice and the dream's islands? | Yes |
| 10 | **Item pictures, loading doors and the stall.** They are interface and stay as they are. Re-bake them in the new style later, as a separate request? | Not now |
