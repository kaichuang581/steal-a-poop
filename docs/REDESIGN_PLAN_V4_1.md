# Counting Sheep v4.1 for Claude Code: the dream, rebuilt properly

Version 4.1, 7 November 2026. **Supersedes v4 Parts 4, 5 and 6** (composition, the farmer, the dreamscape). v4 Parts 7 to 15 (the sheep's run states, fences, the HUD, results, streak bookkeeping, sharing, the bounded dream) stay in force and are not repeated here. The v1 guardrails and the v3 voxel rules still apply, with the dream's own grid sizes in Part 1.

The current build (screenshot of 7 November) is not acceptable, and Part 2 says exactly why. The difference in method this time: every milestone ends at a **gate**, a screenshot measured by a script against the numbers in Part 10. A milestone is not done until its gate passes, and the next one does not start before that.

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V4_1.md`, replace the v4 line in `CLAUDE.md` with the Part 1 block, and paste:

```
Read @docs/REDESIGN_PLAN_V4_DREAM.md (Parts 7 to 15 only) and @docs/REDESIGN_PLAN_V4_1.md in full. Do Milestone E0 exactly as specified: strip the listed elements, build tools/dreamGate.ts, run it on the stripped build, and attach its output and the screenshot. Stop there. Do not start E1 until I say so.
```

Then E1, E2, E3, E4, E5, one per session, each ending with the gate output attached. If a gate fails, the report names the number that failed and by how much, and nothing else is attempted in that session.

---

## 1. Guardrail replacement (replace the v4 line in CLAUDE.md)

```markdown
- Counting Sheep v4.1 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V4_1.md supersedes v4 Parts 4 to 6; v4 Parts 7 to 15
  still apply. The dream scene is built in the order E0 to E5 and each milestone ends at the gate in V4.1 Part 10, measured by
  tools/dreamGate.ts; a milestone is not done until every gate number passes. The bedroom is a separate small canvas
  (V4.1 Part 7), never an object inside the dream scene. Grid sizes in the dream: 0.04 m the sheep and the farmer; 0.10 m
  fences, signs, lane details and the bedroom; 0.20 m the raft, its cloud ridge, the cloud sea and the islands; 0.5 m the
  hills; 1 m the mountains (the dream looks straight at its distance, so it uses finer far grids than the barn). The
  on-screen size limits in V4.1 Part 5.3 apply. Pure logic in src/dream is unchanged; PX = 0.036 m.
```

---

## 2. What is wrong in the current build, and what replaces it

| Seen in the screenshot | Cause | Replacement |
|---|---|---|
| Everything is one pale lilac; the sheep is the only thing with contrast | fog too dense and too light (the horizon colour at 0.035), lavender-tinted snow, no value separation between layers | the value ladder (4.2), fog 0.012, snow near white; gate G5 measures contrast |
| A wall of giant pale blocks across the middle | hills on the 1 m grid placed close (z 14 to 32) and tall, seen from a low camera | hills at z 50 to 58 on 0.5 m voxels, 3.5 to 6 m tall; mountains at z 100 to 120 on 1 m voxels; a limit on the on-screen size of any far voxel (5.3) |
| Dark purple cloud masses hanging from the top edge, cropped | islands too near, too big, undersides in a dark tone, no margin rule | three islands at z 11 to 14, light undersides, each fully in frame with a margin (6) |
| The lane looks like a tiled floor | per-voxel tone noise on the 0.20 m grid plus a trampled-lane texture of alternating squares | one tone on lane tops, AO only; the trampled strip is one darker tone with hoofprints (5.2) |
| Dark green 0.6 m cubes and pink cubes on the lane | "grass tufts" and "flowers" built on the 0.20 m grid | lane details on the 0.10 m grid, one or two voxels, on the far strip only (5.2) |
| A lump of lavender cubes in the middle of the lane | the cloud ridge built as a heap, not as the raft's near edge | the raft's near edge is a continuous scalloped ridge along the bottom of the frame (5.1) |
| The bedroom is a flat quilt pattern and a heap of grey lumps; no farmer can be seen | a bed seen from above, cropped, inside the dream camera's frame | the bedroom is its own small canvas with its own camera on the farmer's face (7) |
| No moon, no visible stars, no aurora, no fence at the start | not built, or lost in the fog | 4.3, 4.4, 5.2, gate G7 |
| The board covers the sky and the islands | board too wide | board at most 44% of frame width between 6 and 13% height (8) |

---

## 3. The target picture, in words and as a map

A side-on runner seen from a little above the sheep's eye line. The sheep stands near the left on a bright snow lane that runs along the top of a long cloud raft; the raft's puffy near edge runs along the bottom of the frame; its far edge drops to a soft cloud sea. Above the sea, three small islands float at mid distance, each carrying a piece of the farm (a pine and a lantern post, the windmill, a bench and a signpost). Behind them, low lavender hills, then hazier snow-capped mountains, then a dusk-violet sky with a cream crescent moon, stars, and a faint pink-teal aurora at the upper right. In the bottom-left corner, inside a cloud-shaped bubble, the farmer sleeps in his bed by a moonlit window, z's drifting up out of the bubble into three cloud puffs that lead to the raft. The HUD sits on top: the chip, the plaque, a modest board, and the typing bar.

Frame map (desktop 16:9; percentages of width and height from the top-left; the camera of 4.1 produces these positions):

```
 0%      10%      20%      30%      40%      50%      60%      70%      80%      90%     100%
 +---------------------------------------------------------------------------------------+ 0%
 | chip                     [ board 28..72% x, 6..13% y ]          MOON (88,10)  plaque x |
 |   *       *     *                                   *      *        *        *   *    | 10%
 |      mountains, hazy, snow caps: tops 11..18% ..... island B (62..76, 12..22) ........| 20%
 |          island A (12..26, 18..30)        island C (40..50, 25..33)                    | 30%
 |     hills, darker, tops 22..27% .............. horizon 34% ........................... |
 |------------------------------ cloud sea, 34..58% ------------------------------------- | 40%
 |                                                                                        | 50%
 | raft far edge 58%   grass strip 58..61%                                                | 60%
 |                 SHEEP (hooves 22%, 67%)       lane (bright)       fence+sign ~82%      | 70%
 | puffs (14,78)(18,72)(22,66)   raft near edge: scalloped cloud ridge 76..100%           | 80%
 | [ BUBBLE 2..28% x, 70..98% y ]      [ typing bar 30..94% x, 90..98% y ]                | 90%
 +---------------------------------------------------------------------------------------+ 100%
```

---

## 4. The world: units, camera, light, colour

### 4.1 Units and camera

- `PX = 0.036 m`; the sheep at x = 0 facing +x; the world scrolls toward −x; the camera at negative z looks toward +z (as in v4).
- **Desktop camera**: position (2.5, 1.6, −8.8), target (2.5, 0.83, 0.0), fov 32 (vertical). That is an eye line of 1.6 m pitched 5° down. It gives: the horizon at 34% of frame height, the lane at the sheep's line at 67%, the raft's far edge at 58%, the near ridge from 76% down, about 9.0 m of lane visible, the sheep 8% of the frame width wide with its hooves at (22%, 67%), the first fence (150 logical px = 5.4 m ahead) at about 82% of the width.
- **Phone portrait**: position (3.8, 2.0, −9.6), target (1.6, 0.9, 1.2), fov 44, yawed so the lane runs lower-left to upper-right; the sheep's hooves at about (30%, 58%).
- The camera never moves during a run. The bump shakes it ±0.03 m for 300 ms (off under reduced motion).

### 4.2 The value ladder (the rule that creates depth)

Every layer has a target luminance L (relative, 0 to 1, as the gate script measures it on the final frame). The near world is bright, the sky is darkest at the top and lightest at the horizon, the far ranges sit between, the nearer range darker than the hazier one behind it.

| Layer | Target L | Colour (lit top faces) | Side faces |
|---|---|---|---|
| Moon disc | ≥ 0.92 | #FFF1B8 | — |
| Lane top (snow) | 0.84 to 0.92 | #F3F0FA | #CFC8EA |
| Island tops (snow) | 0.80 to 0.90 | #F3F0FA | — |
| Raft near ridge (cloud) | 0.78 to 0.86 | #EDE8F9 | #CDC4EC |
| Island undersides (cloud) | 0.66 to 0.78 | #D8D0F2 | #BCB1E6 in creases only |
| Cloud sea | 0.66 to 0.76 | #DCD5F3 | #C4BAEA |
| Sky at the horizon (34%) | 0.58 to 0.66 | #A99BDD | — |
| Mountains (hazy, far) | 0.48 to 0.58 | #8577C7, snow caps #D6CFF2 above 14 m | — |
| Hills (nearer, darker) | 0.36 to 0.46 | #6A5DB0 tops, #58499C sides, snow caps #BDB3E6 above 5 m | — |
| Sky at 8% | 0.26 to 0.38 | gradient | — |
| Sky at the top | 0.20 to 0.30 | #3F3480 | — |
| Bedroom wall (in the bubble) | ≤ 0.20 | #1E1A33 | — |

Contrast rules the gate checks: the hills are at least 0.08 darker than the mountains above them; the mountains differ from the sky above their tops by at least 0.08; the islands' undersides are at least 0.15 lighter than whatever is behind them; the lane is at least 0.20 lighter than the horizon; the frame's middle band (20 to 70% height) has a luminance standard deviation of at least 0.12. A wash of one colour fails the last rule.

### 4.3 Light, fog, sky

- `DirectionalLight` moon #E4E9FF intensity 1.4 at (−5, 10, −7) toward the origin (upper right from the camera, slightly in front), shadow map 2048 fitted to x −5..10, z −4..6, PCFSoft, bias −0.0004, normal bias 0.02.
- `HemisphereLight` sky #6E5FB5, ground #2E2560, intensity 0.5.
- `FogExp2` colour #A99BDD (the horizon colour), density **0.012**. Objects keep 99% of their colour at 8 m, 97% at 15 m, about 60% at 60 m and 15% at 120 m: islands crisp, hills softened, mountains melting into the sky. Nothing else fades anything. The sky dome ignores fog.
- Sky: the `Sky` component with a `dream` palette: top #3F3480 at 0%, #7E6FC4 at 25% of the dome's height, #A99BDD at the horizon, #B8ADE6 below it; 180 stars, 2 px, white, twinkling (static under reduced motion), only above 60% of the dome.
- Moon: the existing voxel moon disc tinted #FFF1B8, 4.5 m across, placed so it sits at (88%, 10%) on screen, with a crescent made by a second disc in the sky's 25% tone overlapping from the upper right by 40% of the radius, and a halo quad behind (additive, radial rgba(255,241,184,0.16) to 0 at 2.2 radii).
- Aurora: two ribbons of the existing aurora plane, #F2A7D8 to #8FE3D9, opacity 0.30, between 4 and 16% height on the right half, behind the mountains, drifting (static under reduced motion).
- Dream dust: 120 motes (`Points`), #D9D0FF and #FFF1B8, size 0.05 m, rising 0.3 m/s, drifting −x at 0.2 × lane speed, in x −6..10, y 0..5, z −2..8, 7 s life with fade; off under reduced motion.

### 4.4 Tone mapping and dpr

ACES filmic, exposure 1.0, sRGB output; `dpr = min(devicePixelRatio, 2)` desktop, 1.5 phones; antialias on; no bloom, no depth of field; shadows on.

---

## 5. The near world: the raft, the lane, the details

### 5.1 The cloud raft

The ground is a long raft of cloud with a snow top, 5 m deep (z −2.0 to +3.0), scrolling with the run in 4 m chunks on a ring of 6, each chunk seeded by its index.

- **Top**: the 0.20 m grid, snow (#F3F0FA), height from a value noise with a 6 m period and 0.20 m amplitude, so there are drifts but no step taller than one voxel between neighbours. **One tone on every top face**; shading comes from the light and the baked AO only. Per-voxel tone noise: none.
- **Near ridge** (z −2.0, toward the camera): a continuous scalloped ridge of cloud lobes on the 0.20 m grid, `ellipsoid` radii 0.5 to 0.9 m, centres at y −0.35 to −0.6 every 0.9 to 1.3 m along x, overlapping by a third, with a second row of smaller lobes (r 0.3) hanging below to y −1.5, in the ridge tones (4.2). The ridge's top meets the snow at y 0 with a one-voxel lip of #DCD5F3. On screen it runs from 76% of frame height to the bottom for the full width; nothing of it rises above 74%.
- **Far edge** (z +3.0): the top drops 0.6 m over two voxels into a smaller scalloped edge (lobes r 0.3 to 0.5) that meets the cloud sea.
- **Cloud sea**: from z 12 to 60, a bank of lobes r 1.5 to 2.5 m at y −1.2 in the sea tones, scrolling at 0.3, with slow drift (±0.05 m over 9 s; static under reduced motion). Nearer than z 12 the sea is hidden behind the raft's far edge, so it starts there. On screen it is the soft band from 58% up to the horizon at 34%.

### 5.2 The lane and its details

- **Trampled lane**: a 2.0 m strip centred on z = 0 in #E7E2F4 (one tone, flat), straight edges; hoofprints as one-voxel pits on the 0.10 m grid every 0.4 m along the sheep's line, in #CFC8EA. Fences' shadows fall on it.
- **Far strip** (z 1.5 to 3.0, behind the lane): on the 0.10 m grid, a grass tuft every 1.5 m (one voxel wide, two tall, #5E7A5A), one flower voxel every 4 m (#E9B4C8 or #FFF1B8), a rock every 9 m (3 × 2 × 3 voxels, #B9B0DC with #9C92C8 sides). Nothing on the lane itself, nothing taller than 0.2 m, nothing on the 0.20 m grid.
- **Sparkle**: ten pure-white voxels per 10 m on the top faces, scattered on the far strip and the near third of the top, never in the lane.
- **Fence and sign**: exactly as v4 Part 7.3 (0.10 m grid, `T.beam` browns, snow caps, the letters on the board). The first fence is visible at about 82% of the width in the ready state.

### 5.3 On-screen size limits (the gate measures them)

- No far voxel (hills, mountains) spans more than 1.6% of frame height on screen; hence 0.5 m voxels at 50 m and 1 m voxels at 100 m, never nearer.
- Nothing on the raft is taller than 0.6 m except fences, signs and the sheep.
- No cloud lobe anywhere exceeds r 2.5 m.

### 5.4 Hills and mountains

- **Hills**: a heightfield strip 160 m long × 8 m deep at z 50 to 58, 0.5 m voxels, height h(x) = 4.5 + 1.2·sin(x/9) + 0.9·sin(x/4.3 + 1) + 0.4·sin(x/2.1) (3.5 to 6 m), tops #6A5DB0, sides #58499C, snow caps #BDB3E6 on voxels above 5 m; scroll factor 0.02. On screen the tops lie between 22 and 27% height.
- **Mountains**: a strip at z 100 to 120, 1 m voxels, h(x) = 14 + 4·sin(x/23) + 2.5·sin(x/11 + 2) + 1·sin(x/5) (12 to 20 m), #8577C7 with snow caps #D6CFF2 above 14 m; scroll factor 0.01; tops between 11 and 18% height.
- Both ranges are closed shapes whose bases sit below the cloud sea's top (y −1.5), so no bottom edge shows.

---

## 6. The islands (three, and no more)

| Island | On-screen box (x%, y%) | World (centre x at spawn, y, z) | Size (across × tall) | Carries |
|---|---|---|---|---|
| A | 12..26, 18..30 | x −3.0, y 2.7, z 11 | 3.6 × 1.8 m | one pine 1.6 m and a lantern post with an emissive lantern (#FFB45A voxels, `PointLight` 0.8, distance 4) |
| B | 62..76, 12..22 | x 5.0, y 3.7, z 14 | 4.2 × 2.0 m | the windmill from `Sky.tsx`, blades one turn per 40 s |
| C | 40..50, 25..33 | x 1.0, y 2.1, z 12 | 2.6 × 1.3 m | a snow bench and a signpost |

- **Shape**: a flat snow top (0.20 m grid, one tone) over a cloud underside of 4 to 6 `ellipsoid` lobes in the island tones (4.2), the lobes shrinking toward the bottom. No cube noise, no tone noise.
- **Rules**: each island is fully inside the frame with at least 4% margin from the top and sides at every moment of its scroll; no island's on-screen box overlaps the lane band (58 to 76%); none is nearer than z 10; none spans more than 16% of the frame width. Islands scroll at 0.12 (A, C) and 0.08 (B) of the lane speed and bob ±0.06 m over 8 to 11 s (static under reduced motion). When an island leaves the left edge it re-enters on the right 20 m later at the same y and z, so its on-screen band is preserved.
- Wisps: two thin lobes 2.5 × 0.3 m in #E6E0F8 at y 3.4 and 3.9, z 7 and 8, scroll 0.06.

---

## 7. The bedroom bubble (its own canvas)

The farmer is not an object in the dream scene. He is in a second, small R3F `<Canvas>` at the bottom-left of the screen, masked to a cloud shape, with its own camera and lights, so he is always framed correctly whatever the dream camera does.

### 7.1 Placement and mask

- Desktop: a `div` at left 2%, bottom 2%, width 26% of the frame (max 420 px), aspect 3 : 2; on phones width 42% at the bottom-left above the typing bar, max 240 px.
- Mask: `mask-image` with an inline SVG of a cloud, an ellipse 100 × 66 with nine scallop circles (r 12 to 16) around its edge, union; the same SVG drawn as a 3 px rim in #EDE8F9 at 85% opacity by a second element on top. Under reduced motion nothing moves; otherwise the bubble breathes (scale 1.00 to 1.012 over 4 s).
- The canvas: dpr as the main one, antialias, shadows off, `alpha: false`, background #1E1A33.

### 7.2 Inside the bubble

Camera at the foot of the bed: position (1.4, 1.25, 1.9) looking at the farmer's face at (0, 0.78, −0.1), fov 34; the face fills about 30% of the bubble's height, slightly left of centre; the headboard and the window fill the background; the quilt fills the foreground.

Everything on the 0.10 m grid except the farmer (0.04 m), in the bedroom palette: wall #1E1A33 (a plane), floor boards #4A311E / #3A2616, headboard and table #6B4A32 / #5A3C25 / #4A311E, pillow and sheet #F3EAD6 / #E6DCC4 / #CFC3A8, quilt squares #8E7CC3 / #F3E9D2 / #D99B95 / #5E8F8A with cream stitch lines, skin `T.skin`, cap stripes #C24E45 and cream.

- **Bed**: headboard 1.1 × 0.8 × 0.08 with two posts; mattress 1.1 × 0.3 × 2.0; pillow 0.64 × 0.14 × 0.44, chamfer 1; quilt from 0.45 m below the headboard to the foot, over a body bump (ellipsoid 0.46 × 0.22 × 1.3) whose group breathes (y scale 1.00 to 1.035 over 3.6 s).
- **Farmer**: as v4 Part 5.2 (head 0.30 × 0.28 × 0.26, chamfer 2, nose, pink cheeks, closed eyes as 4-voxel lid lines at 58% of head height, grey moustache 11 × 3 × 2, grey temple tufts, a nightcap as a bent `taperedBox` with 3-voxel stripes and a cream pom, one hand on the quilt). Two head geometries, asleep and awake (eyes 3 × 3 open with pupils, brows up, mouth "o"), swapped on the bump.
- **Window**: on the wall behind the headboard, to its right: a frame 0.8 × 1.0 (0.10 m grid, headboard wood) with a cross bar, panes as a lighter plane #4A4080, and the moon as a cream disc (0.25 m) painted on the pane plane; a `PointLight` #CFD8FF intensity 1.2 just inside the window, so cool light falls across the pillow and the right side of the face.
- **Nightlight**: on the bedside table (0.40 × 0.60 × 0.40, one drawer line, brass knob), a small lamp: a 2 × 2 × 3 stem and a 4 × 3 × 4 shade in #F3E9D2 with emissive #FFD9A0 voxels inside, and a `PointLight` #FFB45A intensity 0.6, distance 2.5, so the left of the face is warm and the right is cool. Beside it the alarm clock (0.04 m grid: a 0.16 m drum, two bells, cream face, hands at ten past two).
- **Slippers** on the floor at the bed's near side, on a rag rug.

### 7.3 Z's and the trail puffs (HTML, not voxels)

- Three "z" glyphs in Fraunces 700, #EDE8F9 at 90% opacity, 18, 24 and 30 px on desktop, positioned over the bubble (`.dream-z`): each starts at the farmer's cap (about 40%, 45% of the bubble), rises 55% of the bubble's height while drifting right 20% over 2.2 s, fading over the last 40%, staggered 0.73 s apart, looping. Under reduced motion, three static z's at fixed heights. The largest z leaves the rim and ends at the first puff.
- Three puffs (`.dream-puff`): SVG clouds (the bubble's shape, scaled) of widths 3%, 4.5% and 6% of the frame at (14%, 78%), (18%, 72%) and (22%, 66%), fill #EDE8F9 at 92%, each bobbing ±3 px on its own 5 s phase (static under reduced motion). The third puff overlaps the raft's near ridge, so the trail touches the dream.

### 7.4 The wake-up sequence (replaces v4 Part 5.5)

| t (ms) | Dream canvas | Bubble | HUD and sound |
|---|---|---|---|
| 0 | the fence tips (v4 7.3), the sheep bonks (v4 7.2), camera shake 300 ms | — | `trap`; the board shows "Bump!" |
| 350 | three stars orbit the sheep's head | the awake head replaces the asleep one; the quilt stops breathing; the z's vanish; the clock rocks ±2° at 30 Hz for 600 ms | board subline "the farmer stirs…" |
| 600 | the dream canvas wrapper scales from 1 to 0.02 toward the third puff (`transform-origin` 22% 66%) over 500 ms, ease-in; 20 cloud-puff SVG particles burst from the puffs and fade | the puffs shrink into the bubble in sequence, third first, 120 ms apart | `alarm` at low gain, 400 ms |
| 1100 | hidden | the bubble grows to 40% width (desktop) over 300 ms, anchored lower-left; a "!" glyph above the farmer for 800 ms | — |
| 1500 | — | — | `finish()`; the results card (v4 Part 8) slides in beside the bubble |

Under reduced motion: no shake or stars; the dream canvas fades over 150 ms; the card appears at 600 ms.

### 7.5 Ready state

The sheep idles (`grazing`), the lane holds, the first fence waits at about 82% of the width, the farmer snores (z's and breathing), the puffs bob, the dust drifts, the board reads "Count sheep to keep the farmer asleep" with the subline "Type a word with the fence's letters, in order · press any key" blinking every 500 ms. Any letter, Enter, Space or a tap starts the run with the 600 ms speed ease, as now.

---

## 8. HUD adjustments (v4 Part 7.4 stays; only these change)

- The board is at most 44% of frame width and sits between 6 and 13% of frame height; its text wraps to two lines if needed. It never overlaps island A, B or C.
- The typing bar runs from 30 to 94% of width at 90 to 98% height on desktop (it must not cover the bubble); the help line sits inside the bar's bottom padding, not below it.
- The chip and plaque are unchanged; the plaque stays clear of the moon.

---

## 9. Milestones

| Milestone | Build | Gate |
|---|---|---|
| **E0 Strip and gate** | Remove from the current scene: the hills and mountains as built, the islands, the lane's tone noise, the trampled texture, every 0.20 m detail cube, the bedroom objects inside the dream scene and the in-scene puffs. Keep the sheep, fences, signs, HUD and the run loop. Write `tools/dreamGate.ts` (Part 10) and run it on the stripped build. | the script runs and prints every number; no pass required |
| **E1 Sky, light, far** | 4.2 to 4.4; 5.4 hills and mountains; the moon, stars, aurora, dust | G1, G3, G5 |
| **E2 The raft** | 5.1 to 5.3: the raft top, the near ridge, the far edge, the cloud sea, the lane strip, the far-strip details, the sparkle; the first fence visible at ready | G2, G5, G7 |
| **E3 Islands** | Part 6 | G4, G5 |
| **E4 The bubble** | Part 7 entire: the second canvas, the mask and rim, the bedroom, the farmer, the window, the nightlight, the z's, the puffs, the wake-up sequence | G6 and the two-person read test (Part 11) |
| **E5 HUD and phone** | Part 8; the phone layout from 4.1 and v4 7.5; the dev overlay on the dream (`?dev=1`) | all gates at 1920 × 1080 and at 390 × 844 (phone positions from the phone map the script derives by the same camera) |

After each milestone: `npm run build`, `npm test`, the e2e suite in the classic build; the gate output and the screenshot attached to the report.

---

## 10. The gate script (`tools/dreamGate.ts`)

A Playwright script (the repo's e2e setup) that opens the painted skin, enters Counting Sheep in practice with a fixed seed (`?dreamSeed=1`, honoured by the practice route only; it must not touch tonight's dream), waits for the ready state, takes a 1920 × 1080 screenshot at dpr 1, and measures. L is the sRGB relative luminance of a pixel; a sample averages a 9 × 9 patch. The script prints every measurement with its pass range and exits non-zero on any failure. Positions are percentages of width and height. HUD boxes (chip, board, plaque, bar, bubble) are excluded from region statistics.

| Gate | Measurement | Pass |
|---|---|---|
| **G1 sky** | L at (50, 3) | 0.20 to 0.30 |
| | L at (20, 8) and (80, 8) | 0.26 to 0.38 |
| | white pixels (L > 0.9) in y 0..10% excluding the moon's box and the HUD | ≥ 40 (stars) |
| | L at the moon centre (88, 10) | ≥ 0.92 |
| **G2 lane and raft** | L at (50, 67) and (70, 67) (lane) | 0.84 to 0.92 |
| | L at (45, 84) and (65, 84) (near ridge) | 0.78 to 0.86 |
| | L at (50, 46) (cloud sea) | 0.66 to 0.76 |
| | the standard deviation of L inside a 60 × 20 px box at (50, 67) | ≤ 0.03 (no tiling) |
| | hue and saturation of that box | hue within 8° of #F3F0FA, saturation ≤ 0.12 (no lilac snow) |
| **G3 far layers** | L at (30, 25) and (70, 25) (hills) | 0.36 to 0.46 |
| | L at (30, 25) minus L at (30, 19) (mountains above the hills) | ≤ −0.08 |
| | L at (50, 15) (mountains) | 0.48 to 0.58 |
| | absolute difference between L at (50, 15) and L at (50, 9) (sky above) | ≥ 0.08 |
| | edges along the row y = 25% (count of neighbouring samples differing by ≥ 0.04), x 0..100% | ≥ 12 (no giant slabs) |
| **G4 islands** | for each box in Part 6: at least 60% of its pixels differ from the sky sample at (20, 8) by L ≥ 0.15 | pass |
| | no lavender cloud tone (L 0.66..0.90, saturation ≤ 0.25) within 4% of the top edge or the side edges, outside the HUD | pass |
| | island undersides at (19, 29), (69, 21), (45, 32) | 0.66 to 0.78 |
| **G5 contrast** | standard deviation of L over y 20..70%, x 0..100%, HUD excluded | ≥ 0.12 |
| **G6 bubble** | the bubble element exists within x 2..28%, y 70..98% | pass |
| | inside the bubble, L at the wall sample (its upper-right third) | ≤ 0.20 |
| | inside the bubble, a 9 × 9 patch within 10% of `T.skin` in hue and L 0.55..0.75 somewhere in its middle band | pass |
| | three `.dream-z` and three `.dream-puff` elements in the DOM | pass |
| **G7 fence** | a patch in the `T.beam` hue with L 0.25..0.45 exists in x 70..95%, y 58..72% at ready | pass |

The script also prints triangles, draw calls and frame time from the dev overlay against v4 Part 11's budgets (desktop: under 500 k triangles, under 60 draws, under 5 ms).

---

## 11. Acceptance beyond the script (E4 and E5)

- Two people who have not seen the game look at the running screenshot for five seconds and say what is happening; both must mention a sleeping person or a dream. Report their words.
- During a 20 s capture the sheep's hooves never sink into or float above the snow; the shadow follows the jump; the fence falls on the bump; the bubble's farmer wakes and the dream pops as in 7.4.
- Phone: the bubble, the sheep, the first fence and the typing bar are all visible at 390 × 844 with the keyboard closed; the bubble does not cover the sheep.

---

## 12. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 12.1 | The bedroom is a second small canvas masked as a cloud bubble | a pixel-art inset (two art styles) or an in-scene bed (failed) |
| 12.2 | Z's and puffs are HTML/SVG, not voxels | voxel z's (hard to read against the rim) |
| 12.3 | The dream pops with a CSS transform of the whole dream canvas | scaling the 3D group (sorting and shadow artefacts) |
| 12.4 | Three islands in fixed bands, no more | five or six (crowding was the failure) |
| 12.5 | Hills at 50 m on 0.5 m voxels, mountains at 100 m on 1 m voxels | the barn's 1 m and 3 m grids (the wall) |
| 12.6 | Fog 0.012; depth from the value ladder | heavier fog (the wash) |
| 12.7 | A nightlight on the table instead of a candle | a candle with smoke (less light on the face) |
| 12.8 | The moon appears twice: in the dream sky and through the bedroom window | window without a moon |
| 12.9 | Gates are measured by a script; a failed gate ends the session | eyeballing (how the current build happened) |

---

## 13. In one paragraph

The dream is rebuilt as a diorama with measured depth: a side-on camera at eye level, a bright snow lane along the top of a long cloud raft whose puffy edge runs along the bottom of the frame, a soft cloud sea, three small farm-bearing islands fully in frame, low hills and hazy snow-capped mountains far enough away to read as scenery, a crescent moon, stars, an aurora and drifting dream dust, each layer a step lighter or darker than the next so the picture has depth without fog; the farmer sleeps in his own cloud-shaped bubble at the bottom-left, a small separate canvas with its own camera on his face, his z's rising out of the bubble into three puffs that touch the raft, and when the sheep bumps a fence he wakes and the dream pops back into the bubble. Every milestone is measured by a gate script before the next begins.
