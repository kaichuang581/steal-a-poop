# Fleeced: depth, warm light and finish (version 2)

Written 20 November 2026 against the pushed code, v0.9.0 (`origin/main` at `60939f9`). It replaces version 1 of this plan.

What version 2 adds:
- a warm, bright look named **golden afternoon**;
- rules so that nothing becomes hard to see;
- the causes that are not light;
- higher cameras;
- six fixes to the world itself.

Every "test render" picture in `pictures/` was rendered from the real game with switches (section 9). Parts A4, E (beyond the two tested shots) and F are not yet tested and are marked so.

This folder holds:
- this plan;
- `pictures/`: the light pairs, the dusk pair, the camera pairs, `not-shading-problems.jpg`, the edges close-up, the rejected test and Brian's reference;
- `experiment.patch`: the throwaway URL switches the tests used;
- `measure.py`: the measuring script.

## 1. Why the farm looks flat

Two kinds of cause. The light (section 1.1) explains about half. The rest is in the cameras and the world (section 1.2).

### 1.1 Light

| # | Cause | Where | Measured |
|---|---|---|---|
| L1 | Light wraps round every block, so a side turned away from the sun is still lit | `STUDIO = { wrap: 0.35, fill: 0.22 }` in `src/skin/voxel/material.ts` | A sheep's top, front and side are 96%, 96% and 100% of each other (tour stop 8). The reference: 100%, 49%, 45% |
| L2 | A very strong sky fill whose two colours are nearly the same | `DAYLIGHT.day.fill 1.4`; sky `#E3ECF7` over ground `#CFC8BE` | A shadow on snow is 83 to 88% as bright as sunlit snow |
| L3 | The sun stands almost behind the camera | `sunAzimuthOffsetDeg 40` | Every face the camera sees is lit; shadows hide behind objects |
| L4 | No shade where things meet | `AO_STEP` reaches one cube, inside one model | Presents, hens and sheep look pasted on |
| L5 | Cold, colourless light: white light, blue-white haze, a pale sky | `DIORAMA.day` | Colourfulness 0.05 to 0.25 against the reference's 0.54 |
| L6 | No depth with distance: no tilt-shift on Home, thin haze | `LOOK.tilt`, `HAZE_FIT` | Near and far trees look alike |
| L7 | Edges are sharp and every cube in a part is identical | `ROUNDED_VOXELS = false`; "nothing random per cube" | Flat area is 31 to 69% of each tour picture, against 26% in the reference |

### 1.2 Not light

Each row is shown in `pictures/not-shading-problems.jpg`.

| # | Cause | Measured or seen |
|---|---|---|
| N1 | **The cameras stand at eye level and close.** Five of the seven shots that may move look down 13° or less (two look slightly up), from 6 to 30 m, through wide lenses of 26 to 48°. So the camera sees the fronts of things and almost never their tops, which is where light shows shape best. Close up, one cube is 35 px wide, which shows how coarse the models are. The reference looks down about 35° from far away. | Camera numbers in `src/skin/scene/homePov.ts`; the two camera pairs |
| N2 | Large plains of flat, empty snow | Shots 1, 5 and 7; 54 to 58% of the pond shot is flat even with the new light |
| N3 | Nothing gathers round the foot of anything: posts, trunks, walls and props stand straight out of perfectly flat snow | Every shot |
| N4 | Straw beds are stair-step circles, which read as jagged sawteeth | Hens' run and the paddock |
| N5 | Snowflakes are square points (`PointsMaterial`, size 0.09 m, in `Sky.tsx`). Near the camera one becomes a big white square that looks like a glitch | Tour stop 5 |
| N6 | The same pine is stamped again and again | Shot 1 |
| N7 | Neon green and red bulbs (`GLOW` in `festive.ts`: `#3FBF5F`, `#E8402E`) fight the warm light | Shots 0 and 1 |
| N8 | Mostly white with a few spots of strong colour, rather than colour everywhere | Colourfulness, as L5 |

Things that cannot change: the woods, the hills and everything behind z = −16 belong to the wendigo's frozen country. So N6 can be fixed only for the yard's ten pines, and the far hills can only be softened by haze.

## 2. The look: golden afternoon

A low golden sun from one side. A lavender sky light, so shadows are lilac and never black. A rose glow bounced back off the snow, which lifts every shaded side so nothing is hard to see. A peach haze and a warm horizon. Every lamp warm amber.

**Legibility rules.** These bind every step:
1. A shot's average brightness may fall by at most 0.05 from today's (`measure.py`).
2. The share of the picture darker than 0.25 may rise by at most 3 percentage points.
3. A white block's shaded side is at least 50% as bright as its lit side.
4. Every piece of Home's text over the scenery reads at 4.5 to 1 or better.

The test render of this look (`pictures/light-*.jpg`) meets rules 1 and 2 on all four shots:

| Shot | Brightness, today → new | Darker than 0.25, today → new | Flat area, today → new |
|---|---|---|---|
| 0 Doorway | 0.57 → 0.54 | 5.0% → 7.5% | 32% → 29% |
| 1 Whole farm | 0.76 → 0.73 | 0.4% → 0.2% | 35% → 33% |
| 4 Hens | 0.60 → 0.54 | 8.1% → 10.2% | 49% → 36% |
| 7 Pond | 0.73 → 0.72 | 1.5% → 0.7% | 58% → 54% |

An earlier test without the bounce light, with cooler light, reached 18% dark on shots 0 and 4: whole shaded walls went nearly black. That is why A2 has a bounce light.

## 3. The steps

Five milestones. ■ means stop and wait for Brian's answer on the pairs.

| Milestone | Parts | Stop |
|---|---|---|
| M1 | A1 to A3, A5 (light) | ■ |
| M2 | B (form), C (distance), D (grade) | ■ |
| M3 | E (cameras) | ■ |
| M4 | F (the world) | ■ |
| M5 | A4 (light pools), then finish | |

### A. Light (Home only; every other scene keeps its own)

**A1. Soft-light amounts per scene.** In `material.ts`, turn `wrap` and `fill` into two shared uniforms (`uWrap`, `uFill`), set before drawing from `scene.userData.studio`, as `plainLight` is set today. A scene that sets nothing gets today's 0.35 and 0.22. Home sets the values in A2.

**A2. The lights, per hour.** Add these fields to `DAYLIGHT`: `sunColour`, `sky`, `ground`, `bounce`, `bounceColour`, `haze`, `skyTop`, `skyHorizon`, `wrap`, `fill`. Home's `Lights`, `Atmosphere` and `Sky` read them on every shot except the paddock shot.

| | Day (tested) | Dawn (not tested) | Dusk (tested) | Night |
|---|---|---|---|---|
| Sun strength, colour | 3.9, `#FFDDB0` | 3.3, `#FFCFA8` | today's strength, `#FFB27A` | today's |
| Sun height; turned from behind the camera | 32°; 60° | 22°; 60° | today's | today's |
| Sky light strength | 1.25 | 1.15 | today's | today's |
| Its sky and ground colours | `#B8B9E6`, `#EFD8C4` | `#C4B6E2`, `#F2D0C0` | `#CDB4DA`, `#EBC6B0` | today's |
| **Bounce light** (new) | 0.9, `#FFCBA8` | 0.8, `#FFC0A8` | 0.6, `#FFB89A` | none |
| Soft wrap, self-fill | 0.12, 0.06 | 0.12, 0.06 | 0.14, 0.08 | today's |
| Haze colour | `#F2E6DA` | `#F4DDD2` | `#E8B7A6` | today's |
| Sky: top, horizon | `#86B6E8`, `#F4DCC6` | `#9FB7D6`, `#F6CDB8` | `#6F69A8`, `#F0A88C` | today's |
| Exposure (Neutral) | 1.05 | 1.05 | 1.0 | 1.0 |

How to place and size the lights:
- The **bounce light** is a second directional light with no shadow. It stands exactly opposite the sun across the compass, 15° up (12° at dusk). It is what lifts the shaded sides; without it, rules 1 and 2 of section 2 fail.
- Shadow box fitting stays as built. Bias and shadow radius 2.5 stay.
- Leave `src/skin/voxel/unseen.ts` alone (its sun copy decides how the far land near the wendigo is merged). On shots 1 and 7, look for one-pixel steps at shadow edges on the far land and report any.

**A3. Lamps in tone.**
1. On Home by day and at dawn, multiply by 1.6 the emissive strength of every light-giving material: `glassMat` in `src/skin/table/Farmstead.tsx`, the star and bulb materials in `src/skin/table/Festive.tsx`, and `glowMat` and `paneMat` in `src/skin/table/BarnTable.tsx` where Home shows them. At dusk use 1.3. Nothing else that glows changes.
2. **Bulb colours** (decision 3): change `GLOW` from red `#E8402E`, green `#3FBF5F` and gold `#FFC24B` to warm red `#F26B4F`, warm white `#FFE2B0` and amber `#FFB45A`. Keep one muted green, `#8CC26A`, for every fourth bulb, so the lights still read as the season.

**A4. Warm light pools on the snow (not tested; M5).**
1. Add a second single-channel picture beside the ground shade map in `src/skin/voxel/groundShade.ts`: same area and size, with a 1 × 1 black picture as its fallback, so a scene without pools is unchanged.
2. For each source, paint `(1 − d / 2.5)²` within 2.5 m, where `d` is the distance in metres. The sources:
   - every `wallLantern` in `MICRO_PLACEMENTS`;
   - the doorway (`DOOR_LIGHT.bounceAt`);
   - the foot of every lit window, 0.8 m out from its wall.
3. In the material, on ground-level top faces, add `#FFB862 × pool × strength` after the light, where strength is 0.12 by day, 0.2 at dawn, 0.35 at dusk and 0.6 at night. The pools cost one picture read and no extra lights.

**A5. Pairs for M1:**
- shots 0, 1, 4 and 7 by day, and shots 0 and 7 at dawn and at dusk;
- the barn table, to show it is unchanged;
- the numbers of section 2 for every shot, and the text check on shots 0, 1 and 4.

### B. Form

**B1. Shade where things meet.**
1. Add three's `GTAOPass` straight after the `RenderPass`, at half the composer's size, blend 0.8. Home only, High tier only; off on the paddock shot.
2. `updateGtaoMaterial`: radius 0.6, distanceExponent 1.5, thickness 1.5, scale 1, samples 16, distanceFallOff 1, screenSpaceRadius false.
3. `updatePdMaterial`: lumaPhi 10, depthPhi 2, normalPhi 3, radius 6, rings 2, samples 16.
4. Budget: at most +2.5 ms a frame on High on the pull request's computer. If it costs more, try 8 samples. If still too slow, stop. Never raise `AO_STEP`: the mesher's colours feed the wendigo's pins.

**B2. Rounded edges** (Brian's request).
1. `ROUNDED_VOXELS = true` and `BEVEL = { width: 0.22, strength: 1.2 }`.
2. Outer edges only. **Never** draw a seam round every cube (`pictures/rejected-seams-on-every-cube.jpg`).

**B3. A 3% difference from cube to cube.**
1. Add the option `vary` to `buildGeometry`: a cube's colour × `(1 + vary × r)`, with `r` from −1 to 1 hashed from its cell, the same on every load.
2. Pass 0.03 for these: buildings, fences, props, the micro layer, the yard and orchard trees, animals, worn things, and decorations other than bulbs and the star.
3. Never pass it for these: the snow ground, drifts and the path; ice, glass, windows, bulbs, eyes and the letter board; anything from `countryside.ts`, `distance.ts` or `terrainSteps`, whose colours the wendigo's pins hash.
4. Report the extra triangles on shots 0 and 1.

### C. Distance

1. Tilt-shift on for every Home shot, at today's strength of 0.15 (decision 4).
2. Haze × 1.35: `HAZE_FIT.share` 0.5 → 0.675, `HAZE_FIT.max` 0.014 → 0.019.
3. The paddock shot keeps its own haze and tilt-shift.

### D. Grade

One `ShaderPass` after the `OutputPass`, on Home, every tier, off on the paddock shot. In this order:
1. saturation 1.12;
2. an S-curve: `mix(x, x * x * (3.0 - 2.0 * x), 0.2)`;
3. a vignette: `x *= 1.0 - 0.04 * smoothstep(0.3, 0.85, d)`.

The vignette is light on purpose (legibility rule 1).

**Pairs for M2:**
- shots 0, 1, 4 and 7 by day;
- the edges close-up;
- shots 0 and 4 with and without B3;
- the frame times.

### E. Cameras (M3)

**The rule for every shot except the paddock shot:**
- look down 18 to 32°;
- use a lens of 26 to 36°;
- keep the subject in the right half of the frame (the menu covers the left);
- keep today's 1.0 m clearance from every voxel over the push;
- keep each push under 2 m.

| Shot | Today | New starting point | Tested? |
|---|---|---|---|
| 4 Hens | (−5, 3.6, 12.2) → (−14.6, 0.2, 13.6), lens 34, looks down 19° | (−3.5, 7.5, 10.5) → same target, lens 30, looks down 30° | Yes (`pictures/camera-2-hens.jpg`) |
| 7 Pond | (20.5, 1.8, 35.2) → (2, 2.6, 12), lens 40, looks up 1.5° | (22, 12, 38) → (2, 1.5, 12), lens 36, looks down 19° | Yes (`pictures/camera-1-pond.jpg`) |
| 5 Farmhouse | (0, 2.4, 31) → (−25, 3.4, 22), lens 40, looks up 2° | Raise to y 11, lens 34 | No |
| 6 Your sheep | (−0.54, 1.9, 14.2) → (−1.3, 1.1, 8.2), lens 48 | Raise to y 4.5 and step back 2 m, lens 40 | No |
| 0 Doorway | (−12.5, 7, 23) → (0.6, 1.6, 4.5), lens 26, looks down 13° | Raise to y 10.5, same target and lens | No |

**Shot 6 needs care.** Brian disliked a long lens close on the sheep on 2026-11-19 ("its a little unsettling"). Raise the camera; do not narrow the lens below 40°.

**What else applies:**
- Phones follow the same rule.
- Update `src/skin/scene/__tests__/homePov.test.ts` and `homePovFrame.test.ts` for the moved shots only; the paddock entries never change.
- For any shot whose frame now holds the wendigo's place, count magenta pixels with `?wendigoDebug` before and after. If the count rises, keep that shot's old camera and report it.

**Pairs:** every changed shot, computer and phone.

### F. The world (M4; not tested)

No existing model is reshaped. Everything here is added on the yard's and the farm's own grids, outside the country and the land. Nothing new taller than 2.0 m stands in the wedge.

**F1. Snow round the foot of things.** A one-cube collar of `snow +1`, 0.1 m high on the farm's 0.1 m grid, in every free ground cell that touches:
- a fence post, a tree trunk, a wall's foot or a prop;
- the micro layer's objects.

The collar is never placed on the path, the two tracks, a straw bed or the pond.

**F2. Break the snow plains.**
- **Low banks in long curves.** On the yard's open snow, a cell becomes a bank of `snow +1` (one cube high) where `sin(0.35x + 0.12z) + 0.6 sin(0.11x − 0.29z) > 1.15`. Not within 1.5 m of a path, a track, a building, a fence or anything standing.
- **Trails.** A trail of hoof dents (`snow −2`, as the path's) from the flock to the trough and to the barn doors.
- **Sled tracks.** Two parallel lines of `snow −1` from the sled down the slope toward the pond.

**F3. Straw beds that read as mats.**
1. Replace the ellipses in `henYard` and `paddockBed` with rounded rectangles of the same area (corner radius 0.6 m).
2. Give each a rim: the outermost ring one cube higher, in `straw −1`.

**F4. Snowflakes.**
1. A round, soft flake: a 16 × 16 circle with a soft edge, as the points' `map`.
2. `sizeAttenuation` on, size 0.06 m.
3. Count × 0.6.
4. Fade out between 3.5 m and 1.5 m from the camera.
5. Tint `#FFF4E8` by day.

**F5. The yard's ten pines in three shapes, by seed.**
- Heights × 0.85, 1.0 and 1.15.
- Five, six or seven tiers.
- Snow on two of every three tiers.
- On one shape, the top leans one cube.
- The woods do not change.

**F6. The pond.** If it reads grey under the warm light in the pair, use `ice +1` for the open ice and nothing else.

**Pairs:** shots 1, 4, 5 and 7, and a close-up of a fence foot.

## 4. What must not change

- **The wendigo.** On the paddock shot, every tier keeps today's light, haze, tone mapping, exposure, shadows and tilt-shift through `exemptShot()`. That shot gets no corner shade, no grade, no bounce light and no camera change. No cube or colour of the country or the land changes. After every step run `npx vite-node tools/scenes/check.ts -- --only wendigo`; if it fails, undo the step and stop. Never edit the pins.
- **The barn table, the small scenes and night** keep their light. They see only rounded edges, cube variation and the warm bulbs, each shown as a pair.
- **No rule, timer, bot, score, word list, network call, save or interface changes.**
- Branches, commits and pushing follow `CLAUDE.md`. The full gate runs once, at the end.

## 5. Decisions for Brian

The plan runs on the defaults.

| # | Decision | Default | Pair at |
|---|---|---|---|
| 1 | Golden-afternoon light by day and at dawn | Yes | M1 |
| 2 | A warmer dusk (night unchanged except pools and bulbs) | Yes | M1 |
| 3 | Warm bulb colours, with one muted green in four | Yes | M1 |
| 4 | Tilt-shift back on Home (off since 2026-11-18) | Yes | M2 |
| 5 | Rounded edges at 0.22 and 1.2 | Yes | M2 |
| 6 | 3% cube-to-cube variation (overrides "nothing random per cube") | Yes | M2 |
| 7 | Higher cameras on shots 0, 4, 5, 6 and 7 | Yes, each separately | M3 |
| 8 | The world fixes F1 to F6 | Yes, each separately | M4 |
| 9 | Warm light pools on the snow | Yes | M5 |

## 6. Targets

Render at 1440 × 900 on High and measure with `python3 measure.py`.

| Target | Today | Test | Pass |
|---|---|---|---|
| Legibility rules 1 to 4 (section 2) | — | rules 1 and 2 met | all four met |
| Flat area, shot 4 | 49% | 36% | ≤ 38% (≤ 30% after E and F) |
| Flat area, shot 7 | 58% | 54% | ≤ 55% (≤ 45% after E and F) |
| A white block: lit side against shaded side | about 1.0× (a sheep, tour stop 8) | not measured | 1.3× to 2.0× |
| Lamps, windows, star and bulbs still bloom | yes | yes | yes |
| Frame time on High | — | — | B1 at most +2.5 ms; everything else together at most +1 ms |

Tune only the step's own numbers to meet a target. Never add texture, outlines or seams.

## 7. The prompt for Claude Code

```text
Read CLAUDE.md to its last line, then docs/depth/DEPTH-PLAN.md whole, then every file the milestone edits, whole.
Do milestone M_ of the plan and nothing else. Render the pairs it lists, open every picture, check section 2's
legibility rules and section 6's targets with measure.py, and put the pictures and numbers in the pull request.
After every step run: npx vite-node tools/scenes/check.ts -- --only wendigo. If it fails, undo and stop.
Never draw a seam round every cube, never make any part of the picture hard to see, never change a rule or the
interface, and never change anything behind z = -16. Stop where the plan marks a stop and wait for Brian.
```

## 8. Not in this plan

- New models or reshaped ones.
- The woods and hills (they are the wendigo's frozen country).
- The interface.

## 9. The tests, so they can be repeated

`experiment.patch` adds development-only switches to v0.9.0. Use it to repeat the pictures; **do not merge it**.

The day test (`light-*.jpg`):

```text
?hour=day&gfx=high&pov=N&wrap=0.12&fill=0.06&xsun=3.9&xsunc=FFDDB0&xel=32&xaz=60&xfill=1.25&xsky=B8B9E6
&xgnd=EFD8C4&xkick=0.9&xkickc=FFCBA8&xkickaz=60&xkickel=15&xfog=F2E6DA&xhaze=1.35&xskyt=86B6E8&xskyh=F4DCC6
&voxels=round&xbevw=0.22&xbevs=1.2&xgtao=0.8&tilt=1&xgrade=0.2&xsat=1.12&xvig=0.04&xemis=1.6&xexp=1.05
```

The dusk test (`light-5-*.jpg`):

```text
?hour=dusk&gfx=high&pov=N&wrap=0.14&fill=0.08&xsunc=FFB27A&xsky=CDB4DA&xgnd=EBC6B0&xkick=0.6&xkickc=FFB89A
&xkickaz=60&xkickel=12&xfog=E8B7A6&xskyt=6F69A8&xskyh=F0A88C&voxels=round&xbevw=0.22&xbevs=1.2&xgtao=0.8&tilt=1
&xgrade=0.2&xsat=1.1&xvig=0.04&xemis=1.3
```

The camera tests add `&cam=22,12,38,2,1.5,12,36` (pond) or `&cam=-3.5,7.5,10.5,-14.6,0.2,13.6,30` (hens) to the day test.

How the tests differ from the plan:
- They did not use cube variation, because the switch could not leave the snow out.
- They did not change the bulb colours.
- They were rendered in software (SwiftShader), so they say nothing about speed.
