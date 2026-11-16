# 02 · Lighting and rendering

Shadows, ACES tone mapping, bloom and multisampling are already on and approved. This file does not add them. It writes down the light Brian has already tuned as tested limits, lets the four hours differ by key colour, fog colour and sky only, defines every cheaper effect a lower tier may use (each shown to Brian as a pair), protects the wendigo's shot, and gives animals an opaque ground patch where their shadow cannot follow them.

## 1. What exists today (v0.7.4)

- **Shadows:** `PCFShadowMap` on every scene that casts (`FarmBackdrop.tsx:65`, `BarnTable.tsx:157`, `DuelTable.tsx:50`, `PenStage.tsx:40`, `BoardStage.tsx:67`). The sun in `Lights` (`src/skin/table/Rendering.tsx:49-67`) is 4096² (2048² when `phone`), bias −0.0004, normal bias 0.02, a fixed ±20 m box, redrawn every frame. Second maps: the pile spot 1024² (`BarnTable.tsx:379`), the duel spot 1024², the podium spot 1024² (`Podium.tsx:357`). The wendigo casts no shadow (`src/skin/table/Wendigo.tsx`).
- **Tone mapping:** `ACESFilmicToneMapping`, exposure 1, on every canvas (for example `FarmBackdrop.tsx:66`, `PreviewStage.tsx:25`).
- **Composer** (`Effects`, `Rendering.tsx:106-153`): a half-float target with MSAA by `samplesFor` (4 at 1x, 2 to 1.4x, 0 above; `:96`), `UnrealBloomPass` (strength 0.35, radius 0.4, threshold 0.85) no wider than `BLOOM_MAX_W` 720 px (`:97`), then `OutputPass`. Used on Home, the table, the ice and the pen. Tilt-shift 0.15 on Home only (`FarmBackdrop.tsx:89`), blurring the top and bottom fifth (`Rendering.tsx:71`).
- **Hours:** `FOG` (`Rendering.tsx:17`), `SUN` colour and strength (`:18-23`), `SKY` and `AURORA` (`src/skin/scene/Sky.tsx:16-22`). Fill `#AEBEDA` over `#655F5C` at 0.58, 0.62 at night (`:58`, `NIGHT` `:30`). Night lanterns 1.5 times, reach 19 m. Fog `FogExp2` at 0.012 (`:39`).
- **Sun direction:** fixed per scene, 20° up and 35° off the camera's heading (`Rendering.tsx:51-53`); Home passes its camera's yaw, the table `viewYaw={0}` (`BarnTable.tsx:219`). It does not change with the hour.
- **Own rigs:** the ice (`DuelTable.tsx:118-145`), the dream (`DreamStage.tsx:281`), the bedroom (`BedroomBubble.tsx:169-172`), the podium, the pen, the sky board and the closer look.
- **Lights per scene:** Home 6, table 7, ice 8 (all per-pixel Lambert).
- **Precedent for a contact patch:** `shadowDisc` (`src/skin/dream/world.ts:568-574`), an opaque dark voxel ellipse under the dream's sheep (`DreamStage.tsx:347`).
- **Old plan wrong:** `PCFSoftShadowMap` is removed in three r187; `FogExp2` has no near distance; fills of 0.4 to 0.7 and exposures of 0.9 to 1.05 reverse Brian's tuning; a per-hour sun angle; a studio backdrop for thumbnails (C7 keeps dark mats); "five people" and laptop frame times as the proof. CLAUDE.md:37 still says "no bloom"; bloom was approved later (V3.1) and stays.

## 2. Decisions that bind this file

- 2026-11-08: warmer light; "Keep the hemisphere fill low ... and exposure at 1", after "all the snow looks completely flat" (CLAUDE.md:453-456).
- 2026-11-13: "make the room a little brighter ngl i cant see a thing": `NIGHT` (moon 1.15, fill 0.62, lanterns 1.5, 19 m) (:857-859).
- The dream, the ice and the loading doors keep their own light (:453-454).
- 2026-11-13: "make the website less laggy": `samplesFor`, `BLOOM_MAX_W` (:843-850).
- 2026-11-08: the wendigo "should not be so easily seen" (:385). The wendigo is never touched (settled).
- Shadows and tone mapping stay only where they are a shown improvement (settled): change them only with a pair Brian has seen.
- Item art sits on dark mats, no studio backdrop (2026-11-12, :739-740).
- Rulings C5, M6, M8, M13.

## 3. Problems (verified)

- Dawn and dusk share one sun colour, `#FFD3A8` (`Rendering.tsx:19,21`), and one fill: the hours differ only by fog, sky and 0.15 of strength.
- The sun's 4096² map is redrawn every frame from 1.47 M triangles on Home, though its camera never moves (file 17, section 3).
- The pile spot's shadow pass draws 278 k triangles, 211 k of them the barn (SCENE R2).
- 57 perfectly flat yard ground chunks cast into the sun's map (81 k triangles) and can shadow nothing.
- Nothing tests the light limits Brian set; the next change could undo them silently.

## 4. Changes

### 1. Light bounds as tested constants (milestone 2)
- **What:** No visible change.
- **Where:** export `LIGHT_BOUNDS` from `src/skin/table/Rendering.tsx`; `src/skin/table/__tests__/lightBounds.test.ts` (new file).
- **How:** The test reads `Lights`' constants: fill colours `#AEBEDA` and `#655F5C`; fill at most 0.58 at dawn, day and dusk and 0.62 at night; exposure 1 on every canvas; moon at least 1.15; night lanterns 1.5 times and 19 m; sun elevation 20° and azimuth offset 35° at every hour; shadow type `PCFShadowMap`.
- **Do not:** change any of these values; touch the ice, dream, bedroom or doors rigs.
- **Cost:** none.
- **Check:** `npm test`.

### 2. Hour grades by key colour, fog and sky (milestone 4, pair ■)
- **What:** Dawn reads pink and cool, dusk amber and warm; day and night as today.
- **Where:** `SUN` in `Rendering.tsx:18-23`; `FOG` (`:17`) and `SKY` (`Sky.tsx:16-21`) only if the pair shows need.
- **How:** Proposed key colours: dawn `#FFD6C4`, dusk `#FFC08A` (strengths unchanged at 1.55 and 1.7). Colour only: no new light, no angle, no change to fill or exposure. Values are uniforms, so no shader recompiles.
- **Do not:** move the sun; change fill, exposure or fog density; change the paddock shot (change 4).
- **Cost:** none.
- **Check:** `npm test`: key colours of any two hours at least ΔE2000 8 apart (dawn to dusk today: 0); "snow relief" in Home shot 0 (mean luminance of sunlit drift tops minus shaded sides, a gate module) not below today's at any hour. HUMAN: Brian sees shots 0 and 1 at all four hours, today beside proposed.

### 3. Effect reductions, each a pair (milestone 4, M8)
- **What:** The cheaper ways of drawing that file 17's tiers use. High keeps today's picture within the gate's tolerance.
- **Where:** `Lights` and `Effects` in `Rendering.tsx` read the tier from `src/skin/perf/tier.ts` (file 17).
- **How:** Each row is applied only at a dip or scene change. A row whose High gate shots stay inside tolerance needs no decision; every other row is a pair.

| Reduction | Tier | Saving | Pair shown |
|---|---|---|---|
| Sun map redrawn at 10 Hz (`shadow.autoUpdate = false`, `needsUpdate` every sixth frame at 60) | High, Medium | Home mean from 3.55 M to 2.41 M a frame | 2 s clip of shot 0 and the table, motion on: moving shadows step at 10 Hz |
| Sun map 2048² | Medium | three quarters of the shadow texels | Home shots 0, 3, 7; table speaker shot |
| Sun map 1024², drawn once per shot | Low | the shadow pass on all but one frame a shot | same shots |
| Bloom at most 480 px wide | Medium | about 55% fewer bloom pixels | Home shot 0 at night; table at night |
| Bloom off | Low | 12 draws a frame | same |
| Tilt-shift off except the paddock shot | Low | one pass | Home shots 0 and 1 |
| Caster lists per shot and per light (file 17, step 3) | all | 81 k to 324 k shadow triangles on Home; pile spot 278 k to 21 k | all gate shots; if inside tolerance, none |

- **Do not:** remove a light, add a light, or change a canvas's light count at run time; change MSAA or `samplesFor`; add sprite halos in bloom's place (not adopted).
- **Cost:** under 1 kB.
- **Check:** gate counts per tier against file 17, section 6; head-against-base pictures for High within tolerance; pairs saved for Brian.

### 4. The wendigo's shot is exempt (milestone 4, M13)
- **What:** On the paddock shot (`POV_SHOTS.desktop[2]`, `POV_SHOTS.phone[2]`, `src/skin/scene/homePov.ts:46`) every tier draws today's light, fog, shadow map size and redraw, bloom width and tilt-shift 0.15, at today's hour colours.
- **Where:** the dip handler in `Drift` (`FarmBackdrop.tsx:102-130`); `Lights`, `Atmosphere`, `Effects`.
- **How:** Entering shot 2's dip, save the tier's settings and the hour grade, apply today's values; restore them in the next dip. The tour stays on every tier.
- **Do not:** touch `src/skin/table/Wendigo.tsx`, `src/skin/table/wendigoPose.ts`, `src/skin/table/WendigoPreview.tsx`, `public/models/wendigo.glb`, `WENDIGO_AT` or `forest()` (`src/skin/scene/countryside.ts`), or the two shots.
- **Cost:** none; shot 2 costs today's figures on Low (one exemption entry).
- **Check:** gate: on `?pov=2&wendigoDebug`, magenta-mask IoU at least 0.98 at day and night on computer, on every tier; uniforms on shot 2 equal today's constants; ray counts 134, 136, 137 of 153 (`npm run check:scenes`).

### 5. The ground-contact patch (milestone 4, question)
- **What:** On Low, each animal stands on an opaque, stepped, dark voxel patch instead of a shadow it cannot carry with it.
- **Where:** `src/skin/voxel/contactPatch.ts` (new file, built like `shadowDisc`); mounted under each animal in `src/skin/table/Sheep.tsx` when the tier is Low; Low animals do not cast.
- **How:** An ellipse on the 0.04 m grid sized from the model's foot bounds plus 0.04 m, one voxel thick, in the hoof tone `shadowDisc` uses, at y = 0.005 as in `DreamStage.tsx:347`. One draw per animal; parked and reused.
- **Do not:** use a transparent or blurred blob; show it on High or Medium.
- **Cost:** about 300 triangles and 1 draw an animal on Low.
- **Check:** `npm run check:scenes`: patch connected, under every foot in every pose, no coplanar face with the ground. HUMAN: pair on Low (table and pen).

## 5. Integrity (nothing floats, nothing breaks)

- Every tier keeps ground contact for every animal: a shadow on High and Medium, the patch on Low.
- Caster lists never drop an animal or the bomb.
- No change here moves a voxel; hour grades and reductions are uniforms and map settings.
- A changed light value forces no re-bake: baked pictures use their own rigs (bake manifest unchanged).

## 6. Budget

From file 17, section 6. Lights per scene never more than today (Home 6, table 7, ice 8). Shadow texels redrawn per frame on Home: today 16.8 M; High after change 3 at 10 Hz 2.8 M on average; Medium 0.7 M; Low under 0.1 M. Full-screen passes: today Home 15, table 14; never more; Low 2.

## 7. Acceptance

- [ ] `npm test`: `lightBounds.test.ts` green, hour colours ΔE at least 8.
- [ ] `npm run gate`: counts per tier within file 17; snow relief not below today's; High pictures within tolerance.
- [ ] Paddock shot: mask IoU at least 0.98 on every tier; constants equal today's; rays 134, 136, 137.
- [ ] `npm run check:scenes`: contact patch checks green.
- [ ] HUMAN: Brian approves the hour pair and each reduction pair outside tolerance.

## 8. Decisions for Brian

- Dawn pinker and dusk more amber (pair)? Recommended: yes.
- On weaker devices, simpler shadows, smaller glow and no edge blur (pairs per row)? Recommended: yes, except the paddock shot, which never changes.
- On the weakest devices, a plain dark patch under each animal instead of a moving shadow? Recommended: yes.
