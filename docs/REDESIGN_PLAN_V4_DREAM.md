# Counting Sheep v4 for Claude Code: the farmer's dream

Version 4.0, 6 November 2026. Addendum to v1, v3, v3.1, v3.2 and v3.3; the v1 guardrails and the v3 voxel rules still apply. This plan covers one screen, the daily dream (Counting Sheep), and the home-screen pieces that feed it. It has six milestones: **D0** (discovery), **D1** (the dream is the farmer's), **D2** (the dreamscape, refined), **D3** (the sheep, the fences and the HUD), **D4** (the results screen, streak bookkeeping and sharing) and **D5** (the bounded dream, specified but not yet approved).

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V4_DREAM.md`, add the Part 1 block to `CLAUDE.md`, then paste the prompt below into Claude Code.

Two things first.

1. **The voxel dream in your screenshot is not on GitHub.** `main` still carries the 320 × 180 canvas version of `src/skin/dream/DreamScreen.tsx` (the pixel bedroom with the thought bubble), and so does `play-rework`. The purple voxel dreamscape you showed me (floating islands, the voxel sheep, the fallen fence, the "Bump! the farmer stirs…" board, the "Jump" button) exists only on your machine. Commit and push it before starting, so that the plan's discovery step has real files to map. Milestone D0 exists because I could not read that code; everything after D0 is written against the pure logic in `src/dream/` (which is on GitHub and must not change in behaviour) and the voxel toolkit in `src/skin/voxel/` and `src/skin/scene/`.
2. **Decisions I made for you** are in Part 16. Change any of them before Claude Code starts; the plan refers to them by number.

Prompt to paste:

```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4), @docs/REDESIGN_PLAN_V3.md (Parts 4, 5 and 8), @docs/REDESIGN_PLAN_V3_1.md (Part 1) and @docs/REDESIGN_PLAN_V4_DREAM.md in full. Do Milestone D0 exactly as specified and stop: write docs/skin/DREAM_DISCOVERY.md, attach a screenshot of the current dream at 1920 by 1080 and at 390 by 844, and list any place where the current code and the plan disagree. Do not start D1 until I say so.
```

Then, one milestone per session, in order: D1, D2, D3, D4. D5 only if I say so.

---

## 1. Guardrail additions (append to CLAUDE.md)

```markdown
- Counting Sheep v4 (approved by Brian, 2026-11-06): the plan is docs/REDESIGN_PLAN_V4_DREAM.md. The dream is a voxel
  scene in the painted skin (src/skin/dream); the pure logic in src/dream/dream.ts keeps its behaviour (lettersAt, fenceAt,
  check, speedAt, takeoffDistance, jumpHeight, FIELD) and the screen only plays it out, in metres (PX = 0.036 m per logical
  pixel). Approved changes outside src/skin: (a) src/dream/daily.ts gains Warm Blankets, the longest streak and the
  one-night repair (V4 Part 12), with the tests V4 Part 12.5 lists; (b) src/dream/dream.ts gains `exampleWords` (hints on
  the first three fences only), the glyph row and the game's name in `dreamShareText` (V4 Part 13), with tests; nothing
  else in src/dream changes. The bedroom and the farmer are part of the dream screen (V4 Part 8). The v3 voxel rules
  apply: 0.04 m for the sheep, the farmer and small props, 0.10 m for the bed, fences and signs, 0.20 m for the lane and
  the islands, 1 m for hills and 3 m for mountains; merged face-culled meshes with baked AO; MeshLambertMaterial with
  vertex colours; no bloom, no depth of field; transparency only for the moon halo, the aurora, snow and dream dust.
- The bounded dream (V4 Part 15, Milestone D5) is NOT approved: `DREAM_LENGTH` stays null until Brian says otherwise.
```

---

## 2. What the screen must say in one second

A player who has never seen the game must read, without a word of text: *a farmer is asleep, and this is his dream; a sheep is jumping fences in it; I keep him asleep by keeping the sheep jumping.* Three devices carry that, and all three ship in D1 before any other polish:

| Device | What it is | Why it is enough |
|---|---|---|
| **The sleeper in the corner** | The farmer's bed in the bottom-left of the frame, in the real world below the dream: headboard, pillow, nightcap, moustache, closed eyes, a quilt that rises and falls, Z's drifting up | The classic picture of "someone is dreaming" is a sleeper with Z's; nothing else needs explaining |
| **The thought trail** | Three small cloud puffs climbing from the farmer's head to the underside of the dream | The comic-strip convention for "this is what he is dreaming"; it ties the dream to him, not to the player |
| **The dream is a cloud** | The lane the sheep runs on is the top of a floating cloud island with a scalloped near edge; the other islands float; the whole dream pops when he wakes | Floating ground and a cloud rim say "dream" even with the farmer cropped out on a small phone |

Two worlds, two palettes. The bedroom is the real world at night: navy, dark wood, cream linen, one cool moonlight. The dream is lavender and snow with warm cream accents. Nothing lavender appears in the bedroom and nothing navy in the dream, so the eye separates them at a glance.

What stays from the current build (your screenshot): the purple sky with stars, the floating voxel islands with pines, the snowy ground, the voxel sheep with its collar and bell, the fence that falls when bumped, the wooden board with the snow cap, the letter tile and input bar with the Jump button. What goes: the random cube field as ground, islands that read as rubble, the hint that prints the letter instead of a word ("like R…"), the bare right third of the frame, and any sign that the ground is infinite flat terrain rather than a cloud.

---

## 3. Milestone D0: discovery (one short session)

Map the current voxel dream before touching it. Write `docs/skin/DREAM_DISCOVERY.md` with:

1. **Files.** Every file the voxel dream uses, with one line each: the screen component, the R3F scene, the builders (islands, ground, fences, sheep use), the HUD, the store, the CSS, the tests. Say which of them import from `src/dream/dream.ts` and `src/dream/daily.ts`.
2. **The loop.** Where the run state lives (a ref, a store, a class), how it advances (a `useFrame`, `requestAnimationFrame`), and where the pure functions are called: `fenceAt`, `check`, `matched`, `speedAt`, `takeoffDistance`, `jumpHeight`. Confirm that the logical pixel field (`FIELD`, 320 wide) is still the unit of the run and name the current pixel-to-metre factor if one exists.
3. **The scene.** Camera position, target and fov on desktop and phone; the lighting rig; fog; the grid size of each voxel object; triangle count, draw calls and frame time from the dev overlay at 1920 × 1080 and on a phone.
4. **The sheep.** Whether the dream uses `src/skin/table/Sheep.tsx` (and which `SheepState`s) or its own copy of the model.
5. **The HUD.** Every string on screen, verbatim, and which element shows it.
6. **Persistence.** Confirm `localDateKey` is the day key, that `markDreamStarted`, `recordDream`, `recordBest`, `getDreamStreak` are called as in the canvas version, and whether the results dialog still says "midnight UTC" (it must not; the reset is local since 2026-11-05).
7. **Disagreements.** Anywhere the current code and this plan conflict, as a list. Do not resolve them; Brian decides.
8. **Screenshots.** Ready, running, bump and results at 1920 × 1080; running and results at 390 × 844.

Acceptance: the file exists, the eight sections are filled, and no source file changed.

---

## 4. Composition, camera and units (applies to D1 to D3)

### 4.1 World

- Axes: +y up; the lane runs along +x; the sheep runs toward +x and stays at x = 0; the world scrolls toward −x. The camera stands at negative z and looks toward +z, so the player sees the sheep's left flank with a little of its face, as now.
- **Units.** One logical pixel of `src/dream/dream.ts` is `PX = 0.036 m`. The sheep is 20 logical px = 0.72 m long, which is the real model at scale 1.0 (do not use the table's 1.3×). The fence is 12 × 16 px = 0.43 m wide × 0.58 m tall. Jump height 28 px = 1.0 m. Speeds 58 to 100 px/s = 2.1 to 3.6 m/s. `FIELD.sheepX` (78) is the lane's origin offset: a fence at logical x is drawn at world x = (x − 78) × PX. The spawn point (320 + 24 px) and the type window (320 + 70 px) stay in logical units; the screen converts, the logic does not.
- **The lane** is the top of a cloud island: y = 0 is the snow surface, z from −2.0 (near edge, toward the camera) to +3.0 (far edge). The sheep runs at z = 0. The island's near face is a scalloped cloud edge from y = 0 down to y = −1.6; beyond the far edge a lower cloud sea lies at y = −1.5.
- **Depth layers** (all scroll with the run at the factor shown, so nearer layers move faster): lane 1.0; near islands 0.35; mid islands 0.2; far islands 0.1; hills 0.05; mountains 0.02; sky, moon and stars 0.

### 4.2 Camera

| Screen | Position | Target | fov | Notes |
|---|---|---|---|---|
| Desktop and landscape | (1.5, 2.3, −8.7) | (1.5, 0.9, 0.0) | 30 | About 8.5 m of lane visible; the sheep sits 24% in from the left with its hooves at 68% of frame height; fences enter at the right edge 6.6 m ahead (1.8 s at top speed), and the HUD tiles show the letters earlier, when the type window opens |
| Phone portrait | (3.2, 3.0, −9.5) | (1.2, 0.9, 1.5) | 46 | Yawed 25° so the lane runs from the lower left toward the upper right and about 7 m of it is visible; the bed is scaled 0.8 |

The camera does not move during the run (no shake, no zoom); on the bump it shakes ±0.03 m for 300 ms (off under reduced motion). Pin `?hour=` is irrelevant here: the dream is always night.

### 4.3 Frame targets (desktop, 16:9)

Tune positions until a screenshot matches these; they matter more than the metres above:

- Sheep hooves at (24%, 68%) of the frame; the sheep spans about 10% of the frame width.
- The lane's cloud edge runs along 72 to 76% of frame height, scalloped, full width.
- The bed occupies the bottom-left 26% × 24%; the farmer's head is centred near (10%, 86%); only headboard, pillow, head, shoulders and the top of the quilt are inside the frame. The foot of the bed is cropped by the bottom edge (decision 16.3).
- The three trail puffs lie on a curve from (14%, 79%) to (22%, 70%).
- The nearest island's lowest point stays above 30% of frame height so nothing floats in front of a fence sign.
- The moon at (84%, 14%); the board at the top centre; the count plaque top-right; the chip top-left; the input bar across the bottom 10%, never covering the bed's pillow (the bar starts at 30% width on desktop and runs to 94%).

---

## 5. Milestone D1: the dream is the farmer's

Build the bedroom, the farmer, the thought trail and the cloud rim; make the wake-up sequence; fix the two-palette rule. Scene polish waits for D2.

### 5.1 The bedroom (real world, bottom-left)

Everything here uses the bedroom palette only:

| Token | Hex | Use |
|---|---|---|
| `bed.wood` | #6B4A32 / #5A3C25 / #4A311E | headboard, bedside table, floorboards (three tones, `T.trunk` is close; add a `T.bedwood` tone with these) |
| `bed.linen` | #F3EAD6 / #E6DCC4 / #CFC3A8 | pillow, sheet |
| `bed.quilt` | #8E7CC3, #F3E9D2, #D99B95, #5E8F8A | the four patchwork tones (lavender here is allowed because it is a quilt, not light) |
| `bed.night` | #1E1A33 / #14112A | the bedroom's floor shadow and wall |
| `bed.skin` | `T.skin` | the farmer's face and hands |
| `bed.cap` | #C24E45 and #F3EAD6 | nightcap stripes |
| `bed.moon` | #CFD8FF | moonlight tint on the linen's lit side (baked into the paint by face normal: faces pointing +x and +y get the light tone) |

Objects, all built once and memoised, world positions relative to a `bedroom` group at (−1.7, −0.6, −4.6) rotated +30° about y (so the headboard, at the group's −x end, faces the camera's left and the farmer's face turns toward the camera):

- **Floor**: 0.10 m grid, boards 0.12 m wide running along the bed, 2.4 × 2.4 m, `bed.wood`, 2% tone noise, a rag rug (0.9 × 0.6 m, `bed.quilt` tones in rings) beside the bed, two slippers on it (0.10 m grid, `bed.cap` red with a cream pom, 0.22 m long).
- **Bed**: headboard 1.10 wide × 0.80 tall × 0.08, two posts 0.10 square rising 0.10 above the rail, `bed.wood`; mattress 1.10 × 0.30 × 2.00; sheet as the mattress's top layer in `bed.linen`; pillow 0.64 × 0.14 × 0.44, chamfer 1, linen with the shadow tone on its −x and −y faces and the moon tone on +x.
- **Quilt**: 0.10 m grid, patchwork of 0.30 m squares in the four tones, cream stitch lines one voxel wide between squares, from 0.45 m below the headboard to the foot; under it an ellipsoid body bump 0.46 wide × 0.22 tall × 1.3 long so the quilt rises over the chest and falls toward the feet. The bump and the quilt over it are one `quiltBump` group whose y-scale breathes 1.00 → 1.035 → 1.00 over 3.6 s (sine); the quilt's flat part does not move.
- **Bedside table**: 0.40 × 0.60 × 0.40, `bed.wood`, one drawer line and a brass knob (`T.brass`); on it an alarm clock (0.04 m grid: a 0.16 m drum, two bells on top, cream face, dark hands at ten past two) and a candle stub (0.04 m grid, cream, with a 0.02 m dark wick) with a curl of smoke built with `helix` (0.04 m voxels, radius 0.03, 1.5 turns, `bed.linen` at 45% opacity: the one transparent object in the bedroom; off under reduced motion it is static).
- **Wall**: a single dark plane behind the headboard in `bed.night`, 3 × 2.4 m, receives the moonlight as a soft lighter wedge from the right (a second plane in #2A2550 at 60% width, rotated to taper).

### 5.2 The farmer

On the 0.04 m grid, built around a head pivot at the top of the pillow, lying on his back with the head turned 20° toward the camera:

- **Head**: a rounded box 0.30 wide × 0.28 tall × 0.26 deep (chamfer 2), `T.skin`; ears as two 2-voxel bumps; a nose 3 × 3 × 3 at the centre line; cheeks two 4 × 3 patches in `T.pink[1]`; closed eyes as 4-voxel dark lines at 58% of head height (`LID`), a 2-voxel brow above each in grey #8C8C8C; a grey moustache 11 × 3 × 2 under the nose with the ends drooping one voxel; grey hair tufts (3 voxels) at each temple below the cap.
- **Nightcap**: a `taperedBox` from the crown (0.30 × 0.30) to a 0.08 tip over 0.42 m, bent so the tip falls to the +x side and rests on the pillow; stripes of 3 voxels alternating `bed.cap` red and cream; a cream pom (ellipsoid r 0.06) at the tip.
- **Shoulders and hands**: shoulders as two linen bumps under the sheet line; one hand (skin, 0.12 × 0.04 × 0.10) resting on the quilt edge.
- **Awake face** (used from the bump onward): eyes as 3 × 3 open squares with white and a dark pupil, brows raised 2 voxels, mouth a 3 × 2 dark "o". Build both faces as two head geometries and swap.
- **Z's**: three voxel Z glyphs (the `FONT` map in `src/skin/voxel/table.ts` has `Z`; export a small `letterGeometry(ch, cell)` next to `letterBoardGeometry` rather than copying the font) at 0.06, 0.08 and 0.10 m cell sizes, `bed.linen` with transparent material; each rises 0.55 m and drifts 0.25 m toward +x over 2.2 s on a staggered loop, fading from 0.9 to 0 over the last 40%. Under reduced motion three static Z's at fixed heights. The Z's point toward the trail puffs: they are what the puffs are made of.

Breathing drives the Z's: one Z leaves the pillow on each exhale (every 3.6 s, three in flight at once). Snoring sound: decision 16.6.

### 5.3 The thought trail and the cloud rim

- **Trail puffs**: three cloud clusters on the 0.10 m grid, each 4 to 6 overlapping `ellipsoid` lobes, radii 0.12, 0.18 and 0.26 m, at world (−1.8, 0.35, −4.0), (−1.6, 0.62, −3.4) and (−1.4, 0.92, −2.8), in the dream cloud tones (`cloud` below). Each bobs ±0.02 m on its own phase over 5 s (static under reduced motion). The smallest sits just above the farmer's cap; the largest touches the island's near face. The straight line through them is the only diagonal in the bottom-left of the frame, so the eye follows it from the sleeper into the dream.
- **Cloud tones** (`T.cloud`, add to `palette.ts`): #F4F1FC, #DCD5F3, #BBB0E6. Clouds are lit like everything else; the third tone appears only in creases between lobes, as the wool rule in V3 Part 5.
- **The island's near face**: along z = −2.0 for the full lane, a ridge of ellipsoid lobes on the 0.20 m grid, radii 0.6 to 1.1 m, centres at y −0.5 to −0.9, overlapping by a third, with smaller lobes (r 0.3 to 0.4) hanging under them to y −1.6; the ridge scrolls with the lane and repeats every 12 m with a seeded variation so it never tiles visibly. The snow surface meets the ridge at y = 0 with a one-voxel lip of `T.snow[2]` so the edge reads.
- **The cloud sea**: beyond the far edge (z 6 to 10), a band of lobes at y −1.5, radii 1.5 to 2.5 m, scrolling at 0.5, in the two lighter cloud tones; it is what the hills float on in D2.

### 5.4 Lighting and the two worlds

One rig serves both worlds (decision 16.4): a `DirectionalLight` moon #CFD8FF intensity 1.1 from (−4, 9, −6) toward the origin (upper right from the camera's view, slightly in front), shadow map 2048 fitted to x −4..10, z −6..6; a `HemisphereLight` sky #8A78D2 ground #3A2E6B intensity 0.6; `FogExp2` in the dream horizon colour (Part 6.1) density 0.035, which the sky dome ignores. The bedroom reads darker because its palette is dark and it sits below the fog's reach; do not add a second rig.

### 5.5 The wake-up (bump) sequence

Timeline from the bump at t = 0 (the pure logic already fires the bump when the sheep overlaps an unjumped fence; the screen plays the sequence and calls `finish` when it ends):

| t (ms) | Dream | Bedroom | HUD and sound |
|---|---|---|---|
| 0 | the fence tips away from the sheep (Part 7.3); the sheep bonks (Part 7.2); camera shake 300 ms | — | `trap` sound; board shows "Bump!" |
| 350 | three small stars orbit the sheep's head | the farmer's awake face replaces the sleeping one; the quilt bump stops breathing; the Z's vanish | board subline "the farmer stirs…"; the alarm clock rocks ±2° at 30 Hz |
| 600 | the dream pops: the `dream` group (lane, ridge, sea, islands, fences, sheep, dust) scales from 1 to 0.02 toward the top puff over 500 ms, ease-in; 20 cloud-puff particles burst from the trail and fade; the sky gradient cross-fades to `bed.night` over the same 500 ms | the three trail puffs shrink to the farmer's head in sequence (top first) | `alarm` sound at low volume for 400 ms (decision 16.6) |
| 1100 | the dream group is hidden | the bedroom is the whole scene: moonlight on the pillow, the farmer awake, a "!" voxel glyph above his head for 800 ms | — |
| 1500 | — | — | `finish()`; the results card slides in over the bedroom (Part 11) |

Under reduced motion: no shake, no stars, the pop is a 150 ms fade, the results card appears at 600 ms. On a phone the sequence is the same; the bed is scaled 0.8 and sits at (12%, 70%) so the keyboard cannot cover the farmer.

### 5.6 The ready state (before the first key)

The sheep stands at x = 0 in the `grazing` state (from `Sheep.tsx`), the lane is still, the first fence waits 150 logical px ahead (5.4 m, at the right edge), the farmer snores, the puffs bob, the dust drifts, the board reads "Count sheep to keep the farmer asleep" with the subline "Type a word with the fence's letters, in order · press any key" blinking every 500 ms. Any letter key, Enter, Space or a tap on the scene begins the run (as now). The transition from ready to running is the lane starting to scroll over 600 ms (the existing speed easing).

### 5.7 Acceptance for D1

- Screenshots at 1920 × 1080 and 390 × 844 of ready, running, t = 350 ms and t = 1100 ms of the bump sequence, and results.
- A person shown only the running screenshot, with no caption, says "a farmer is dreaming about a sheep" or words to that effect (ask two people who have not seen the game; report their words).
- Palette check: sample ten pixels inside the bed area and ten inside the dream: no lavender in the first set, no navy in the second.
- The three puffs, the Z's and the quilt breathing are visible at 390 × 844 with the keyboard closed.
- Frame time within the Part 14 budget with the bedroom on.

---

## 6. Milestone D2: the dreamscape, refined

### 6.1 Sky, moon, aurora, dust

- **Sky**: reuse `Sky` from `src/skin/scene/Sky.tsx` with a new hour-independent `dream` variant: gradient top #5B4AA6, middle #8A78D2 at 55%, horizon #D2C6F4; 180 stars from the existing field, twinkling (static under reduced motion); no blizzard. Add the variant by a prop (`palette="dream"`), do not fork the component.
- **Moon**: the existing 1 m voxel moon disc, tinted #FFF1B8, 6 m across at (84%, 14%) of the frame, and a halo: one additive transparent quad behind it, radial gradient from rgba(255,241,184,0.18) to 0 at 2.2× the disc, facing the camera. The crescent: a second disc in the sky's middle tone offset by 40% of the radius, drawn on top, so the moon reads as a crescent from the camera (both discs face the camera; no transparency needed).
- **Aurora**: the existing night aurora plane with dream colours, #F2A7D8 → #8FE3D9, opacity 0.35, two ribbons low on the right behind the islands, drifting slowly (static under reduced motion).
- **Dream dust**: a `Points` system of 140 motes, lavender #D9D0FF (two thirds) and cream #FFF1B8 (one third), size 0.06 m, rising 0.4 m/s and drifting toward −x at 0.3 × lane speed, wrapped in a box x −6..10, y 0..6, z −3..8, each mote fading in and out over its 7 s life. Off under reduced motion.
- **Wisps**: four cloud wisps, thin ellipsoid lobes 2 to 3 m long and 0.3 m tall on the 0.20 m grid in the lightest cloud tone, at y 3.5 to 5 and z 4 to 8, scrolling at 0.08.

### 6.2 The islands

Six islands, built once from a seeded list and placed on the three parallax layers (two per layer); each island is one merged geometry:

| # | Layer (factor) | Size (m, across × tall) | Position band (x at spawn, y, z) | Contents |
|---|---|---|---|---|
| 1 | near (0.35) | 4.5 × 2.6 | x 6..9 (enters right), y 2.6..3.0, z 1.5 | two pines, a snow bench |
| 2 | near (0.35) | 3.2 × 2.0 | x 12..15, y 3.4..3.8, z 2.5 | one pine, a lantern post (emissive lantern voxels, `T.lantern[0]`, intensity 1.2) |
| 3 | mid (0.2) | 6.0 × 3.2 | x 2..5, y 4.4..4.8, z 6 | a tiny red barn (0.20 m grid, 1.6 m long, `T.barn`, snow roof) |
| 4 | mid (0.2) | 4.0 × 2.4 | x 10..13, y 3.8..4.2, z 7 | three pines |
| 5 | far (0.1) | 7.0 × 3.5 | x −2..2, y 5.2..5.6, z 12 | the windmill from `Sky.tsx` (blades turning once per 40 s) |
| 6 | far (0.1) | 5.0 × 2.8 | x 8..12, y 4.6..5.0, z 13 | a pine clump and a haystack |

- **Shape**: a flat snow top (0.20 m grid, 2% noise, `T.snow`) on a cloud underside of 4 to 7 ellipsoid lobes in `T.cloud` whose radii shrink toward the bottom, so the island reads as a cloud carrying a piece of farm, not as a clod of earth. No cube noise on the underside. Each island's lowest lobe is at least 2.2 m above the lane's snow so no island crosses a fence sign on screen.
- **Motion**: each island bobs ±0.08 m over its own period (7 to 11 s) and scrolls with its layer; when an island leaves the left edge (x < −12 at its layer) it re-enters on the right at x = 14 + a seeded offset, so the sky never empties. Static under reduced motion (scrolling still happens).
- **Pines**: reuse the yard's pine builder on the 0.20 m grid (`T.pine`, `T.trunk`), 1.2 to 2.4 m tall, snow on the upper tiers.

### 6.3 The lane and the far ground

- **Snow surface**: 0.20 m grid, value noise (the `distance.ts` noise) amplitude 0.25 m with a 6 m period over the whole island top, except a flat **trampled lane** 1.6 m wide centred on z = 0 (the sheep's line) in `T.path`, with hoofprints every 0.4 m as one-voxel pits in `T.path[2]`, and the fences' shadows. On the surface: a grass tuft every 1.5 m (three `T.pine` voxels poking through the snow), a flower voxel (`T.pink[0]` or `T.lantern[0]`) every 4 m, a rock (`T.stone`, 0.4 m) every 9 m, and ten brighter snow voxels per 10 m (`#FFFFFF`) as sparkle. No random cubes on the surface: variation comes from the noise, the light and the AO.
- **Chunks**: the island top, ridge and lane are built as 4 m chunks on a ring of 6 (24 m), each chunk seeded by its index so recycling never shows a seam; a chunk moving past x = −10 is rebuilt as the chunk 24 m ahead. Building a chunk must take under 2 ms on desktop (measure; if not, build the ring ahead on open and keep it).
- **Hills**: 1 m grid, two ranges at z 14..22 and z 24..32, `T.cloud`-tinted lavender-grey (#B9B0E0, #A89DD4, #8F84C4), rolling with the distance noise, floating on the cloud sea (their bases hidden in it). Scroll factor 0.05.
- **Mountains**: 3 m grid at z 40..70, three peaks 18 to 26 m tall, #9B92D0 with snow caps in `T.snow[1]`, scroll factor 0.02, fading in the fog.

### 6.4 Acceptance for D2

- Screenshots at 1920 × 1080: ready; running at count 0, 10 and 25; and a 30 s capture showing an island recycling with no visible pop.
- Zoomed to 400%, a flat section of the lane shows no grid lines and no cube noise; the only visible steps are the drifts and the trampled lane's edge.
- Triangles, draws, frame time and the chunk build time reported from the dev overlay; within Part 14.
- Nothing lavender-lit touches the bedroom; the sky dome ignores fog.

---

## 7. Milestone D3: the sheep, the fences and the HUD

### 7.1 Run architecture (the screen plays the logic out)

Keep the canvas version's `Live` structure and its `update` exactly (fence queue of four, spawn at `SPAWN_X`, type window at `TYPE_X`, take-off at `takeoffDistance`, overlap test, count on pass, bump on overlap below `FH − 6`). Replace only the draw: each frame, after `update`, the scene reads `L` and sets positions in metres. The run must stay deterministic for a given seed and input, as the pure tests require; nothing in the scene may write to `L`.

### 7.2 The sheep

Use `src/skin/table/Sheep.tsx` with the default look at scale 1.0 and add four dream states to its `SheepState` union (an addition inside `src/skin`, not an engine change): `run`, `jump`, `bonk`, `land`. Existing states keep their timings.

| State | Driven by | Spec |
|---|---|---|
| `grazing` (ready) | phase `ready` | existing grazing: head down, chew, blink |
| `run` | phase `running`, `jumpAt === null` | a trot: front-left with back-right, 110 ms per half-step at 58 px/s scaling to 70 ms at 100 px/s; legs swing ±28° about their top pivots; head bobs ±0.02 m at the step rate; ears flap 8°; tail wags; the wool scales 1 ± 0.015 at the step rate; a blink every 3.5 to 5 s; breath puffs off |
| `jump` | `jumpAt !== null` | anticipation squash (y 0.92) for 80 ms before take-off (the screen knows take-off is coming when `ahead.x − (SX + SW) ≤ takeoffDistance + speed × 0.08`), then the airborne pose: front legs forward 50°, back legs back 40°, ears up, wool stretched y 1.06 at the apex (height from `jumpHeight`), eyes wide, mouth `smile`; the bell rings (sound `play`) at take-off |
| `land` | the first frame after `jumpAt` returns to null | squash y 0.90 for 100 ms, six snow particles from the hooves, then back to `run` |
| `bonk` | `crashAt !== null` | recoil 0.25 m toward −x over 200 ms, sit (back legs fold, body tilts back 15°), ears back, brows `worried`, mouth `o`, eyes closed `arc` for 200 ms then open; three star voxels (`T.lantern[0]`, 0.04 m) orbit 0.25 m above the head at 1 turn per 1.1 s from t = 350 ms |

The shadow: a dark ellipse (`T.hoof[2]` at 30% opacity, flat voxel disc on the 0.04 m grid, 0.5 × 0.3 m) under the sheep that shrinks to 60% at the apex of a jump.

The count pop: an HTML number in Fraunces 800 at 26 px, `--paper` colour with the dark outline, anchored to the scene point (0, 1.4, 0) and rising 0.5 m while fading over 1.2 s, one per passed fence, as the canvas version's `pops`.

### 7.3 The fences and their signs

- **Fence** (0.10 m grid): two posts 0.12 square, 0.58 m tall at x ±0.2 of the fence centre, two rails 0.08 × 0.08 at y 0.25 and 0.50 spanning the posts, `T.beam` tones with a 1-voxel lighter top on each rail; snow caps on both posts and on the top rail (`T.snow`, 1 voxel thick, 2 at the posts); a shadow ellipse under it. Width and height match the logical 12 × 16 px; the overlap test stays in logical units.
- **Sign post**: 0.3 m to the +x side of the fence, a post 0.08 square 0.9 m tall carrying a board 0.5 × 0.22 × 0.06 (`T.beam[0]` face, `T.beam[2]` edge) with a snow cap. The fence's letters are carved into the board as voxels with the `FONT` map from `src/skin/voxel/table.ts` at 0.04 m cells (the same `letterGeometry` as the Z's), in `--wood-ink` (#2A1E14), separated by one dark dot voxel: `S·P`. One to five letters fit; for five, cells go to 0.035 m. The active fence's board gets a cream rim (1-voxel `T.snow[0]` border) and, while the player's last word bounced for the `letters` reason, its letters flash `T.collar[0]` for 320 ms (the existing `wrongUntil`).
- **Cleared fence**: the board's letters go `T.pine[0]` green and the typed word appears as a 3D-anchored HTML tag just above the board (Patrick Hand 16 px on paper, a green tick), since a word can be 16 letters. The tag scrolls with the fence and is removed with it.
- **Bumped fence**: on the bump the fence (not the sign) rotates about its base's +x edge from 0 to 70° over 400 ms with a small bounce (overshoot 78°, settle 70° by 550 ms); both snow caps shed as six snow particles; the sign stays up. This is the fallen fence from your screenshot, kept.

### 7.4 The HUD

All HTML over the canvas, in the painted skin's components and tokens (wooden boards with snow caps, paper tags, the existing fonts). Every string is in this table; use them verbatim:

| Element | Where | Ready | Running | Bump | Practice difference |
|---|---|---|---|---|---|
| Chip | top-left | "Tonight's dream · 6 Nov" (local date, short month) | same | same | "Practice dream" |
| Board (wood, snow cap) | top centre | "Count sheep to keep the farmer asleep" + subline "Type a word with the fence's letters, in order · press any key" | hidden | "Bump!" + subline "the farmer stirs…" | same |
| Count plaque | top-right | sheep icon + "0" + small "best 31" | count | count | best includes practice |
| Caption | above the input bar | hidden | "Next fence: S·P. Any word with those letters, in that order." and on fences 0 to 2 only: " Like SHEEP, STOP or WHISPER." (Part 13.1) | hidden | same |
| Tiles | left end of the bar | the first fence's letters, unlit | the active fence's letters, lit as matched (`matched(fence, typed)`), shaking for 320 ms on a bounce; "· · ·" when no fence is in the type window | hidden | same |
| Input | the bar | placeholder "a word with S then P" (letters joined by "then") | the typed word in capitals with a caret | disabled | same |
| Bounce line | under the bar, 1.2 s | — | the `SAYS` strings, unchanged: "Three letters or more", "Needs those letters, in order", "Not in the dictionary", "Already counted that one", "Wait for the next fence" | — | same |
| Jump button | right end of the bar | "Jump" (begins the run) | "Jump" (submits) | disabled | same |
| Leave | top-right corner, below the plaque | the close icon, aria "Leave the dream" | same (Esc) | same | same |
| Help line | under the bar on desktop | "Each fence names letters: type any real word with them in that order and press Enter. Esc wakes up." | same | same | same |

Typing rules do not change: letters only, 16 max, Enter or Space submits, Backspace deletes, the hidden input keeps focus during the run, a tap on the scene refocuses it. The "Jump" button is the touch equivalent of Enter and nothing more.

### 7.5 Phone

- Portrait: the camera from Part 4.2; the chip and plaque in one row at the top; the board below them; the bar at the bottom with the tiles above the input (two rows), the Jump button 44 px tall; the bed scaled 0.8 at (12%, 70%); the scene's height follows `visualViewport` so the keyboard never covers the bar; the help line is dropped.
- Landscape phones use the desktop layout at fov 34.

### 7.6 Acceptance for D3

- A 20 s capture of a run with at least one jump, one bounce and the bump; the sheep's hooves never sink into or float above the snow; the shadow follows the jump.
- Every string in 7.4 appears as written; "like R…" is gone; hints show on fences 0 to 2 only.
- Determinism: with the dictionary mocked, the same seed and the same typed input produce the same count in the canvas version and the voxel version (write this as a test against `update`).
- Frame time within budget on a phone with the keyboard open.

---

## 8. Milestone D4: the results screen, streak bookkeeping and sharing

The post-dream screen is the retention screen (research report, Part 5): the moment after the farmer wakes is when the next night is decided.

### 8.1 The results card (over the bedroom, the farmer awake behind it)

Order, top to bottom, on one paper card (390 px wide on desktop, full width minus 24 px on phones):

1. Title: "The farmer woke up!" (D5 adds "The farmer drifted off").
2. The count, big: "23 sheep" in Fraunces 800 at 44 px; under it "Longest word: ROOSTER (7 letters)" or "Longest word: –".
3. The streak row: a flame and "5-night streak", then small "best 12"; for practice, the row reads "Practice dreams don't count."
4. The seven-night calendar: seven circles labelled by weekday initial (today at the right), filled for nights played (`dreamStreakDays`), a blanket icon on a night a Warm Blanket covered, hollow for missed nights, today ringed.
5. The blanket line: two blanket icons, filled for each Warm Blanket held, with the caption "Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights." (hidden in practice).
6. Buttons: "Share" (copies the card image and the text; label "Copied!" for 2 s), "Practice" (a new practice dream, as `again` now), "Back to the farm".
7. The note: "Tonight's dream returns at 12:00 am." (local; the existing `timeOfNext` from the home screen) or, in practice, "Practice dreams don't count toward your streak."

Nothing else goes on the card: no shop, no Pro, no invite.

### 8.2 The home screen

- The Counting Sheep ticket keeps its streak chip and adds, under the caption, the same seven-night calendar in miniature (dots) and the blanket icons when at least one is held.
- When a repair is available (Part 12.3), a second small ticket appears under it: "Dream last night's dream · keeps your streak" with "until 11:59 pm" (the end of the repair window); it opens the dream with yesterday's seed, flagged `repair`.
- The share-from-home flow stays as it is, with the new share text.

### 8.3 Acceptance for D4

- Screenshots of the results card in all three cases: a normal night, a night a blanket covered, practice.
- The card never says "UTC".
- The streak, blanket and repair rules pass the tests in Part 12.5; the share text passes Part 13.3.

---

## 9. Sound

Existing kinds only, unless decision 16.6 adds `snore`: `bank` on a cleared fence (as now), `play` for the bell at take-off, `fail` on a bounce, `trap` on the bump, `alarm` at low gain for 400 ms when the farmer wakes, `playTick` on each typed letter with the matched share as now. All through `playSound`; nothing new in `src/audio` without asking.

---

## 10. Reduced motion and accessibility

- Reduced motion: no parallax bobbing of islands or puffs, static dust (none), static Z's, no camera shake, the pop is a 150 ms fade, no tile shake, the sheep still runs and jumps (that is the game), fences still fall.
- The hidden input keeps the existing `aria-label`, the `aria-live` line reads "S·P. 12 sheep." as now; the board text is in the DOM, not drawn; the results card is a `role="dialog"` with focus on the first button; Esc leaves at any time and still spends the night's attempt during a run, as now.
- Colour is never the only signal: a lit tile also gets a check mark; the bumped fence falls; the awake farmer gets the "!".

---

## 11. Performance budget

| Measure | Desktop (dpr 2) | Phone (dpr 1.5) |
|---|---|---|
| Triangles on screen | under 500 k | under 350 k |
| Draw calls | under 60 | under 50 |
| Frame time | under 5 ms | under 8 ms with the keyboard open |
| Open to first frame | under 1.2 s (geometry memoised across opens) | under 2 s |
| Chunk rebuild | under 2 ms | under 4 ms |

Report numbers from the dev overlay (`?dev=1`, `src/skin/table/DevStats.tsx`; mount it on the dream screen too) in every milestone.

---

## 12. Streak bookkeeping (approved change to `src/dream/daily.ts`)

### 12.1 Data

```ts
interface Streak {
  count: number;      // consecutive nights, as now
  last: string;       // the last night counted (a blanket-covered night counts)
  best: number;       // longest ever
  blankets: number;   // Warm Blankets held, 0..2
  earnedAt: number;   // the count at which the last blanket was earned
}
```
Stored under the existing key with a migration from the old `{ count, last }` shape (`best = count`, `blankets = 0`, `earnedAt = 0`).

### 12.2 Rules

1. **Counting**: `recordDream` for date D: if `last === D` nothing changes; if `last === D − 1` then `count + 1`; otherwise `count = 1`. `best = max(best, count)`. This is the current rule.
2. **Earning**: after counting, if `count ≥ 7` and `count − earnedAt ≥ 7` and `blankets < 2`, then `blankets + 1` and `earnedAt = count`.
3. **Covering a missed night**: `getDreamStreak(today)` and `recordDream` both first call `settle(today)`: while `last` is older than `today − 1` and `blankets > 0` and the gap `today − 1 − last` is at most `blankets`, each missed night from `last + 1` up to `today − 1` is covered: `last` advances one night and `blankets − 1`, `count` unchanged. If the gap is larger than the blankets held, nothing is covered (a blanket is never spent on a lost cause) and the streak reads 0 as now. Coverage happens the first time the app looks at the streak after the miss, so the home screen shows "A Warm Blanket kept your streak warm" the next day.
4. **Repair**: if `settle` could not cover the gap, the gap is exactly one night (`last === today − 2`), and `getDream(today − 1)` is null, a repair is available until the end of today: playing the dream with seed `dreamSeed(today − 1)` and recording it with `date = today − 1` restores the chain (`last = today − 1`, `count + 1`). One repair per missed night; it does not earn a blanket by itself; the record keeps `repaired: true` for the calendar.
5. **Practice** never touches the streak, as now.
6. `dreamStreakDays(today)` marks covered nights with `'blanket'` and repaired nights with `'repair'` (change the return type to `('played' | 'blanket' | 'repair' | 'missed' | 'today')[]`; the only caller is the painted skin).

### 12.3 Worked example

A player on a 12-night streak with one blanket misses Friday. On Saturday the home screen settles the streak: Friday is covered, `last = Friday`, `blankets = 0`, the streak still reads 12; the Saturday dream makes it 13. Had the player held no blanket, Saturday shows the repair ticket: dreaming Friday's dream on Saturday restores 13; skipping it leaves the streak at 0 and Saturday's dream starts a new one.

### 12.4 Where it shows

Results card and home ticket (Part 8); the chip "A Warm Blanket kept your streak warm · 12 nights" on the home ticket on the day a cover happened (a flag set by `settle`, cleared when read).

### 12.5 Tests (new file `src/dream/__tests__/daily.test.ts`)

1. Old-shape storage migrates with `best = count`, `blankets = 0`.
2. Seven consecutive nights earn one blanket; fourteen earn two; the third is not earned while two are held.
3. One missed night with a blanket: streak unchanged, blanket spent, `last` advanced.
4. Two missed nights with one blanket: nothing spent, streak 0.
5. Two missed nights with two blankets: both spent, streak unchanged.
6. Repair available only when the gap is one night and no blanket covered it; recording yesterday's dream restores the chain; the record carries `repaired`.
7. A blanket is not spent on a night already played.
8. `best` tracks the longest streak across a break.
9. Practice records change nothing.

---

## 13. Hints and the share text (approved change to `src/dream/dream.ts`)

### 13.1 `exampleWords(fence): string[]`

For `fence.index < 3` only: up to three words from `FENCE_WORDS` that contain the fence's letters in order, excluding `fence.source`, seeded by the fence so everyone sees the same examples, shortest first. For `index ≥ 3` it returns `[]`. No other function changes.

### 13.2 `dreamShareText(r)`

```
{title} · Counting Sheep {date}
The farmer counted {count} sheep then woke up          (or: and drifted off, D5)
🟩🟩🟩🟦🟦 🟦🟦🟦🟪🟪 🟪🟪🟪🟪🟪 🟪🟪🟧⬛
Longest word: 8 letters
5-night streak · 🛏 1 Warm Blanket
```
- `{title}` is the title the home screen shows (`PAINTED_TITLE`; decision 16.7).
- The glyph row: one glyph per fence cleared, by letters asked (`lettersAt(i)`): 1 🟩, 2 🟦, 3 🟪, 4 🟧, 5 🟥, grouped in fives with a space, and ⬛ for the fence that was bumped; a count of 0 gives "⬛" alone; rows wrap at 40 glyphs (a second line). No words, no letters: spoiler-free.
- The streak line only when the streak is above 1; the blanket part only when at least one is held.
- `DreamResult` gains `blankets` and `bumped: boolean` (false in D5's drift-off case).

### 13.3 Tests (extend `src/dream/__tests__/dream.test.ts`)

1. `exampleWords` returns 1 to 3 words for indices 0 to 2, none for 3, never the source, all matching `matched(fence, w) === fence.letters.length`, deterministic per seed.
2. Share text for counts 0, 3, 12 and 41 has the right glyphs, grouping and line count; the title is the painted title; no "Finish the Word" string remains anywhere in `src/dream` or `src/skin/dream`.

---

## 14. Tests for the screen (new, under `src/skin/dream/__tests__/`)

1. `PX` mapping: logical x 78 → world 0; the spawn and type windows convert as specified.
2. Chunk ring: after 30 m of scroll every chunk index has been rebuilt exactly once and no two chunks overlap.
3. Island recycling: an island past x −12 re-enters at ≥ 14 with the same layer.
4. Determinism (Part 7.6).
5. The bump timeline calls `finish` at 1500 ms (600 under reduced motion) and never twice.
6. The results card strings for the three cases in Part 8.3.

End-to-end (add to the existing Playwright suite, painted build): open Counting Sheep, press a key, type a word that fits the first fence (read it from the DOM caption's example), press Enter, see the plaque reach 1, press Esc, see the home ticket read "used".

---

## 15. Milestone D5: the bounded dream (specified, NOT approved)

Do not implement until Brian approves; the constant ships as null.

- `DREAM_LENGTH: { fences: number; bumps: number } | null = null` in `src/dream/dream.ts`. When set (proposed 30 fences, 3 bumps): a bump costs a bump instead of ending the dream: the sheep bonks for 700 ms, the fence falls, the farmer stirs (awake face for 600 ms, then sleeping again with a "mmf…" voxel glyph), the lane resumes at `speedAt(count)`; the third bump wakes him as today. At fence `fences`, the dream ends with the farmer drifting off: the board reads "Zzz… he's out cold", the dream does not pop; it softens (dust doubles for 1 s) and the results card reads "The farmer drifted off", with "30 fences · 1 bump · longest word 9".
- Share text: "The farmer drifted off after 30 fences" and the glyph row shows each bump as ⬛ in place (not at the end).
- Practice keeps the endless rule ("How far can you run?") regardless of `DREAM_LENGTH`.
- Tests: the bump count, the drift-off at `fences`, the share text, and that `DREAM_LENGTH = null` reproduces today's behaviour byte for byte in the existing tests.
- Decide the numbers from a playtest of ten people on the D3 build: the target is eight of ten finishing most nights (research report, Part 5).

---

## 16. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 16.1 | The bedroom is 3D voxels in the same scene, not a 2D overlay | a pixel-art corner inset (cheaper, but two art styles on one screen) |
| 16.2 | The bed sits below the dream (y −0.6) in the bottom-left, foreshortened, the foot cropped | the whole bed small in the corner (reads less well) |
| 16.3 | Head, shoulders and the top of the quilt only; the body is a bump under the quilt | the full body (more voxels, no gain) |
| 16.4 | One lighting rig for both worlds; the split comes from palettes | a second rig on layers (more code, risk of double shadows) |
| 16.5 | The dream pops toward the farmer's head on the bump (scale-in), then the results card | a fade (cheaper, duller) |
| 16.6 | No new sound; the alarm reuses `alarm` at low gain; no snoring | add a soft `snore` kind in `src/audio/sound.ts` (synthesised like the others), played in ready and results only |
| 16.7 | The share text uses the painted title | pick one name for the game first; the code carries two (`GAME_TITLE` "Steal a Poop", `PAINTED_TITLE` "Finish the Word") |
| 16.8 | Hints on fences 0 to 2 only | hints after a bounce on any fence (gives words away) |
| 16.9 | Two Warm Blankets at most, earned every 7 nights, never sold | one blanket; or earn by a weekly task |
| 16.10 | Repair window ends at the end of the following day (local) | 48 hours from the miss |
| 16.11 | The islands carry a tiny barn, a windmill and a lantern post | plain islands (the farm pieces make it the farmer's dream, not any dream) |
| 16.12 | Camera fixed; no zoom on the jump | a slight zoom on long jumps (motion sickness risk on phones) |

---

## 17. Order of work and prompts

| Session | Milestone | Prompt to paste |
|---|---|---|
| 1 | D0 | the Part 0 prompt |
| 2 | D1 | "Read @docs/REDESIGN_PLAN_V4_DREAM.md Parts 4 and 5 and @docs/skin/DREAM_DISCOVERY.md. Do Milestone D1 exactly as specified. Attach the Part 5.7 screenshots and report file by file with the overlay numbers." |
| 3 | D2 | "Read Parts 4 and 6. Do Milestone D2. Attach the Part 6.4 screenshots and the 30 s capture; report the chunk build time." |
| 4 | D3 | "Read Parts 4, 7, 9, 10 and 14. Do Milestone D3 with the tests in Part 14 items 1 to 5. Attach the 20 s capture and the phone screenshots." |
| 5 | D4 | "Read Parts 8, 12 and 13. Do Milestone D4: the daily.ts change in its own commit with the Part 12.5 tests, the dream.ts change in its own commit with the Part 13.3 tests, then the results card and the home ticket. Attach the Part 8.3 screenshots." |
| 6 | D5 | only when Brian says so |

After every milestone: `npm run build`, `npm test`, and the e2e suite in the classic build, as CLAUDE.md requires.

---

## 18. In one paragraph

Counting Sheep becomes unmistakably the farmer's dream: he sleeps in the bottom-left of the frame in a moonlit bed, snoring Z's that climb as three cloud puffs into a lavender dreamscape where his sheep runs along the snowy top of a floating cloud and jumps fences that carry the night's letters, past floating islands with his own barn, windmill and pines; when the sheep bumps a fence he stirs, the dream pops back into his head, and the results card over his bedroom shows the count, the streak with its calendar and Warm Blankets, and a spoiler-free card to share, with one dream a night at local midnight and practice that never counts.
