# 02. Light

Solid colours only look good in clear, bright, soft light. This file fixes the light first (milestone M1), because measurements on the real game show that the light, not the models, is the largest single cause of the "low quality" feeling.

## 1. What was measured

These numbers come from the pushed code (v0.8.0, commit `4f033f4`), built and photographed in a headless browser at 1280 x 800, with switches added for the test only and removed afterwards. Colours are the middle value of a small box of pixels, on the usual 0 to 255 scale. The comparison picture is `light-test-day.jpg` in this folder.

Shot: the whole farm from over the orchard (`POV_SHOTS.desktop[1]`), by day.

| # | Setting | Snow in the sun | Snow in shadow | Barn front |
|---|---|---|---|---|
| 1 | Today: haze 0.012, sun 20° up, ACES tone mapping, exposure 1 | 174, 174, 176 | 131, 137, 147 | 151, 149, 154 |
| 2 | Today, haze lowered to 0.005 and nothing else | 156, 152, 150 | 77, 86, 101 | 81, 61, 60 |
| 3 | Haze 0.005, sun 45° up, Neutral tone mapping, exposure 1.9 | 230, 218, 206 | 182, 177, 174 | 98, 76, 76 |
| 4 | As 3, exposure 2.4 | 242, 229, 217 | 203, 198, 194 | 113, 90, 90 |

What the table shows:

1. **The wide shots are mostly haze.** In row 1 the barn's red front reads as plain grey. The fog is `FogExp2` with density 0.012 on every shot. The barn is 50 to 60 m from this camera, so about 35% of what you see there is fog colour, and 76% at 100 m. Row 2 removes most of the haze and the red returns.
2. **Under the haze the picture is dark.** Row 2 shows the snow's real brightness in sunlight: 156 of 255, a mid grey. The sun is only 20° above the horizon, so flat ground receives one third of its light, and exposure is fixed at 1.
3. **Rows 3 and 4 are a bright winter day.** White snow, clear blue-grey shadows that are soft (shadow is 84% as bright as sunlit snow in row 4). Nothing about the models changed between row 1 and row 4.
4. **The barn is still dull in rows 3 and 4** (113, 90, 90). That is the stored colour, which is 30% desaturated. File 03 fixes it; light alone cannot.

The close shots (doorway, tractor, path) look acceptable today because their subjects are 10 to 20 m away, where the haze is thin. That is why the game "looks good but somehow low quality": the wide views are grey.

## 2. The five changes

Changes B and C move values inside "Brian's light limits" (`LIGHT_BOUNDS` in `src/skin/table/Rendering.tsx`, tested by `src/skin/table/__tests__/lightBounds.test.ts`), so they need his yes: `00-README.md`, decision 1.

All five apply to **Home, by day and at dawn, on every tour shot except the paddock shot**. The paddock shot (`PADDOCK_SHOT = 2` in `src/skin/voxel/unseen.ts`, the wendigo's) keeps today's light, haze, tone mapping, exposure, shadow box, shadow softness and tilt-shift on every tier, through the existing `exemptShot()` in `src/skin/perf/tier.ts`. Dusk, night and the barn table keep today's values unless Brian picks otherwise (section 5).

### Change A. Haze fitted to each shot

**Today:** `scene.fog = new FogExp2(FOG[hour], 0.012)` in `Atmosphere`, one density for every shot.

**New:** the density is set per shot so that the farm stays clear and only the country beyond it fades.

- Rule: `density = 0.5 / farEdge`. `farEdge` is the distance in metres from the shot's camera (at its start position) to the farthest point on the edge of the **farm rectangle** (x from −40 to 40, z from −16 to 46, at y = 0) that lies inside the shot's horizontal field of view at 1280 x 800.
- With this rule the far edge of the farm is 22% haze, the middle of the farm about 6%, the forest behind it about 40%, the back hills about 55% and the mountains about 90%. (Haze share at distance d is `1 − exp(−(density × d)²)`.)
- Clamp the result to the range 0.004 to 0.014.
- Values for the shots as they are in the pushed code. The coder recomputes them from `POV_SHOTS` with the rule and writes each next to its shot:

| Shot | What it is | `farEdge` | Density |
|---|---|---|---|
| Computer 0 | Doorway | 66 m | 0.0076 |
| Computer 1 | Whole farm | 100 m | 0.0050 |
| Computer 2 | Paddock (wendigo) | not used | **0.012, as today** |
| Computer 3 | From inside the barn | 58 m | 0.0086 |
| Computer 4 | Hens' run | 44 m | 0.0113 |
| Computer 5 | Tractor | 44 m | 0.0115 |
| Computer 6 | Path | 35 m | 0.0140 |
| Computer 7 | Across the pond | 72 m | 0.0069 |
| Phone 0 | Doorway | 47 m | 0.0106 |
| Phone 1 | Whole farm | 101 m | 0.0050 |
| Phone 2 | Paddock (wendigo) | not used | **0.012, as today** |
| Phone 3 | From inside the barn | 50 m | 0.0099 |
| Phone 4 | Hens' run | 40 m | 0.0124 |
| Phone 5 | Path, from the gate | 39 m | 0.0129 |

- How it changes: `scene.fog.density` is set in the dark dip between shots (the 0.4 s in which the camera jumps, where `noteNewShot()` is already called). The fog object and its type are not replaced, so no material is rebuilt and there is no hitch.
- The fog's colour by hour (`FOG`) does not change.
- Thinner haze could make the wendigo easier to see on three shots. File 05, section 1.5 has the check that must be run before this change is kept.

### Change B. A higher sun

**Today:** `sunElevationDeg: 20`, `sunAzimuthOffsetDeg: 35`. A low sun gives long, raking shadows and leaves flat ground dim.

**New (day):** elevation 45°, azimuth offset 40°. **New (dawn):** elevation 30°, azimuth offset 40°.

- At 45° the ground receives 71% of the sun instead of 34%. Every object drops a short, clear shadow about as long as the object is tall. That is the miniature look: you read each shape from its shadow.
- The sun's colour and strength do not change (`SUN.day` stays `#FFE8C8` at 1.85; `SUN.dawn` stays `#FFD6C4` at 1.55). The sky fill does not change (`fillDay` 0.58, `#AEBEDA` over `#655F5C`). The ratio of sun to fill is Brian's and stays.
- The sun's heading stays as it is: on Home it is set once from Home's first camera (`viewYaw={yawToward(cam.position, cam.target)}` with `cam = HOME_CAMERA` in `src/skin/table/FarmBackdrop.tsx`). It does not turn from shot to shot today and must not start to.
- `src/skin/voxel/unseen.ts` keeps its own copy of the sun's side angle and box (`SUN = { asideDeg: 35, halfWidth: 20, margin: 3 }`, used by `sunReaches`). **Leave that copy as it is.** It decides where the far land's faces are merged, and changing it would rebuild far-land meshes near the wendigo. `shadowSeen` in the same file is given the light's real direction as an argument and needs no edit; check that the caller (`src/skin/table/Farmstead.tsx`) passes the new direction.

### Change C. Exposure and tone mapping

**Today:** `toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1` on the Home canvas (`src/skin/table/FarmBackdrop.tsx`).

**New (day):** `NeutralToneMapping`, exposure **2.2**. **New (dawn):** `NeutralToneMapping`, exposure **2.0**.

- Why exposure and not stronger lamps: the bloom pass looks at the picture before exposure is applied. Raising exposure brightens the snow without making it glow. Raising the lamps would push sunlit snow over the bloom's threshold (0.85) and the whole ground would bloom.
- Why Neutral: ACES bends colours toward grey and yellow as they get bright. Neutral leaves a colour alone until it is nearly white, so a red wall in the sun is the same red on the screen. This is what lets file 01's palette be trusted.
- Starting value 2.2 lies between the two tested values (1.9 and 2.4). The targets in section 4 decide the final number.
- **Bloom must be scaled down with exposure**, or every lantern and bulb flares (seen in a doorway test at 2.4). In `Effects`, the bloom's strength becomes `0.35 / exposure` (0.16 at 2.2). Threshold 0.85 and radius 0.4 stay.
- Things that are not lit by the sun (sky dome, haze colour, snowflakes, window glow, the season's bulbs) also get brighter by the same factor. In the tests the sky and haze became a pale winter white, which suits the look and is accepted. If the bulbs or windows look blown out in the pair, lower only their own glow strength by dividing it by the exposure. Change nothing else.
- How it switches: exposure is one number on the renderer. The tone mapping is read by the composer's `OutputPass`, which is the only shader that depends on it. Both are set in the dip. On the paddock shot they go back to ACES and 1. If any tier draws without the composer, do not switch tone mapping per shot on that tier (it would rebuild every material). Keep Neutral for the session there and return only exposure, sun and haze to today's values on the paddock shot. Say so in the pull request.

### Change D. Shadows that reach the whole view

**Today:** the sun's shadow camera is a fixed box of ±20 m around the barn (`shadow-camera-left={-20}` and so on, far 160). Anything further out (the yard's pines, the farmhouse, the far side of the paddock) casts no shadow. Objects without shadows look pasted on.

**New:** on each shot the shadow box is centred on the shot's target and sized to the view.

- Centre: the shot's `target`, with y set to 0. The directional light's own `target` object moves there, and the light's position is that point plus the sun's direction times 60, as today.
- Half-size `h` in metres: `clamp(0.75 × d + 6, 20, 44)` on High and Medium, `clamp(0.75 × d + 6, 20, 30)` on Low, where `d` is the flat distance from the shot's camera to its target. Values for the pushed shots: doorway 23, whole farm 44, across the pond 24, every other shot 20.
- Map size stays as `sunPlan` gives it (4096 on a computer, 2048 on a phone on High; 2048 on Medium; 1024 on Low). At the largest box that is 2.1 cm a texel on a computer, 4.3 cm on a phone and 5.9 cm on Low.
- Bias grows with the box so no stripes appear: `shadow-bias = −0.0004 × h / 20`, `shadow-normalBias = 0.02 × h / 20`.
- The box changes in the dip. The map is redrawn then, which `noteNewShot()` already asks for.
- Shadow type stays `PCFShadowMap`.

### Change E. Slightly softer shadow edges

**Today:** `light.shadow.radius` is not set, so it is 1.

**New:** `shadow-radius={2}` on the Home sun, on every shot except the paddock shot.

- In the installed three.js (0.187) `PCFShadowMap` blurs the shadow's edge with five samples spread over `radius` texels, turned differently at every pixel. At radius 2 the edge is about 5 cm soft on a wide shot and 2 cm on a close one, and still clean.
- **Do not go above 2.5.** With only five samples a larger radius turns the edge into visible grain, which breaks rule R3 of file 01. The soft "drop shadow under everything" of the reference does not come from blurring the sun's shadow. It comes from the ground shade map (file 04, section 5), which is smooth by construction.

## 3. What does not change

| Thing | Value kept |
|---|---|
| Sun colour and strength by hour | `SUN` as it is |
| Sky fill | `#AEBEDA` over `#655F5C`, 0.58 by day, 0.62 at night |
| Haze colour by hour | `FOG` as it is |
| Lanterns | `LANTERN_LIGHT`, and the night values in `NIGHT` |
| Shadow type | `PCFShadowMap` |
| Tilt-shift | Strength 0.15 on Home, top and bottom fifth of the frame |
| Resolution logic, tiers, frame cap | Everything in `src/skin/perf/` |
| The paddock shot | Every value, on every tier, including `TODAY_SUN` colours |
| The barn table, the podium, the small scenes | Every light value (file 07) |
| The per-face shade and corner shade in the mesher | `FACE_SHADE` and `AO_STEP` 0.2 stay |

## 4. Targets (how the coder knows the light is right)

After changes A to E, photograph Home by day on `?pov=1` (whole farm) and `?pov=5` (tractor) at 1280 x 800 on High. Sample a 20 x 20 pixel box on each and compare. Do it at M1 on the scenery as it then is, and again at the end of M2 on the repainted scenery.

| Sample | Target | If it misses |
|---|---|---|
| Open snow in full sun, nearer than 40 m | Brightest channel 236 to 248; never 255 | Change exposure in steps of 0.1 |
| The same snow in a pine's shadow | Brightest channel 185 to 212, and blue not lower than red | Do not touch the fill; report it |
| The far edge of the farm on `?pov=1` | Visibly hazed, but fence posts there still readable | Recheck `farEdge` |
| Mountains on `?pov=1` | Paler than the forest, no hard black shapes | Recheck the clamp |
| A shadow's edge on snow on `?pov=5` | Smooth, no dots or grain when the picture is enlarged 4 times | Lower the radius to 1.5 |
| From M2 on: a `barnRed` wall facing the sun | Red channel 160 to 200, and red at least 1.8 times green | Check the wall uses `solid()` and not `lin()` |
| From M2 on: a `pine` tier top in the sun | Green at least 1.25 times red | Same check |
| Every piece of text on Home that lies over the 3D picture (menu, title line, word of the day, footer), at the brightest moment of shots 0, 1 and 5 | As easy to read as in the "before" picture: at least 4.5 to 1 against the pixels behind it | Do not touch the interface. Lower exposure in steps of 0.1, no lower than 1.9. If it still fails, stop and show Brian |

Put the numbers and the text check's result in the pull request. No other light value may be tuned to hit them.

## 5. Dusk, night and the table

Brian likes these as they are. Default: **no change to their light at all**, including haze.

Their colours will still change, because colours are built into the models and the same models are shown at every hour (file 03). So show Brian these pairs once, at the end of M2 (pictures of `?pov=0` and `?pov=1`), and keep whichever he picks for each hour:

| Hour | Option 1 (default) | Option 2 | Option 3 (tested once, for information) |
|---|---|---|---|
| Dusk | Today's light on the new colours | As 1, with Change A (fitted haze) | Change A, sun 28° up, Neutral, exposure 1.9, sun 1.6, fill 1.0 |
| Night | Today's light on the new colours | As 1, with Change A | Change A, moon 40° up, Neutral, exposure 1.7, moon 1.15, fill 0.9 |

Option 3 raises the fill above Brian's limits (0.58 and 0.62) and is listed only so he can ask to see it. If he picks it, his choice is recorded in `CLAUDE.md` with the new numbers.

If the new colours look wrong under today's dusk or night light (for example, snow too yellow at dusk because the colours are no longer desaturated), do not tune the palette. Show Brian the pair and stop (file 08, section 7).

## 6. How to build it

1. One table replaces the scattered values. In `Rendering.tsx` add `DAYLIGHT: Record<Hour, { toneMapping; exposure; sunElevationDeg; sunAzimuthOffsetDeg; shadowRadius; fitHaze: boolean; fitShadow: boolean }>`, with today's values for dusk and night and the new values for dawn and day. `LIGHT_BOUNDS` keeps the fill, moon, lantern and shadow-type entries and points at `DAYLIGHT` for the rest.
2. `lightBounds.test.ts` is updated in the same commit to the values Brian approved, each with the date of his yes in a comment. It is not deleted and no other assertion in it is loosened. The assertion that every canvas uses `LIGHT_BOUNDS.exposure` is changed to allow the Home canvas alone to follow `DAYLIGHT`.
3. A switch for comparing: `?light=today` makes Home use today's values on every shot; `?light=mini` forces the new ones. Without the switch the table decides. The switch is read once at load, like `?hour=`.
4. A helper `shotLight(shot, hour, tier)` returns the fitted haze density, the shadow half-size, bias and radius for a shot. `Drift` (the tour) applies them in the dip together with the camera jump. On the paddock shot the same helper returns today's values, so there is one place to read.
5. The Home canvas is the only one touched. `BarnTable.tsx`, `DuelTable.tsx`, `PenStage.tsx`, `DreamStage.tsx`, `BedroomBubble.tsx`, `BoardStage.tsx`, `Podium.tsx` and the baked-picture canvases keep their own light.
6. Run the wendigo check after every commit of this milestone (file 05, section 1.6).
