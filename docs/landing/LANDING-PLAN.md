# Fleeced: the yarn loading screen (version 8)

Written 21 November 2026 against `origin/main` at `f990219` (v0.9.0). **This replaces versions 1 to 7 completely.**

The barn doors are gone (Brian: "can we quit it with the barn stuff, it looks garbage"). This overrides these entries in `CLAUDE.md`:
- "the loading doors" in the overhaul's list of things that stand;
- "One loading screen", "The doors, refined", "The doors are voxels" and "The loading sign";
- "Back to the barn doors", including its line "Don't redesign the loading screen again unless he asks". He asked.

Record all of that in `CLAUDE.md` (section 4).

**How Brian chose this design.** He liked the yarn ball in an earlier mockup ("the yarn ball is hella cool"). He found the knitted texture "too messy" and asked why a sheep stood beside the ball with nothing to do, so both are gone. He approved the yarn ball writing the name ("ok good now turn this into a plan"). He then said not to add a percentage ("nvm dont add a percentage") and asked for the red letters to look more like yarn. A first try (a flat strand with a dark outline and painted stripes) was rejected: "that does not look natural it looks fully ai generated ... kind of like a worm". So:
- the strand is drawn the way real yarn is made: two plies twisted round each other, matte, lit from one side, with fine fibres and a faint shadow, and no outline (section 3.2);
- the ball is wound from the same yarn (section 3.3);
- there is no number and no line of text on the screen.

**Save these files.** Save this plan as `docs/landing/LANDING-PLAN.md`. Put these pictures beside it:
- `loading-yarn-desk.png` (1280 × 720, shown at 2x);
- `loading-yarn-phone.png` (390 × 844, at 2x);
- `loading-yarn-stages.jpg` (0%, 35%, 62% and 100% loaded);
- `loading-yarn-closeup.png` (the yarn up close).

The pictures were drawn by a small prototype. All of its drawing code is in Appendices A to C, so this file is the whole reference: every number in it comes from that prototype. Match the pictures, above all the close-up: that is what "natural" means here. Where they differ from this text, the text wins.

## 1. What it is

The screen is Home's night blue with a few slow snowflakes. In the middle, the game's name, "fleeced", is drawn in plain rounded lowercase as a faint dotted line, like a handwriting tracing sheet. A red yarn ball travels along that line from the bottom of the "f". Behind it, it lays one strand of real-looking yarn that spells the word. The ball spins as it rolls and shrinks as its yarn runs out.

**The strand is the progress.** At 50% loaded, half the word is yarn. When the game is ready, the word is complete and the small ball sits on top of the "d". After a moment the screen fades away onto Home.

There is nothing else on the screen: no text, number, bar, icon, sheep, button or opening animation.

*A simple example.* A player opens the link. In the first frame they see the night, the dotted word and the ball at the foot of the "f". While the farm is being built, the ball lays the "f", then the "l", then the "e"s. If loading pauses, the ball waits and rocks gently. When the "d" is finished, Home appears.

## 2. Rules

1. **Only the game's own things.** Home's night blue, the game's barn red, wool yarn and snow. Nothing borrowed from another game's look. The farm's voxel rules (one part one colour, no texture or outline) govern the 3D models. They do not govern this flat screen, whose yarn has twist, fibres and shading because Brian asked for yarn that looks natural.
2. **Natural, not drawn.** The yarn must look like a real strand of wool lying on the screen:
   - no outline;
   - no painted stripes;
   - no glossy highlight;
   - no regular, repeating marks that read as segments (that is what made it look like a worm).

   Its look comes only from how real yarn is built (two twisted plies of fibres) and one light.
3. **Light.** One small picture (the ball's wraps, about 16 kB), no new font and no new library. The page's first-frame copy of the screen (markup and rules in `index.html`) adds at most 12 kB to `index.html`. The 80 kB of door pictures are deleted.
4. **Honest.** The yarn follows real progress. It never goes backwards, and it never finishes before the game is ready.
5. **Simple.** The word, the ball, the night and the snow, and nothing else. **No percentage** and no other number (Brian, 21 November 2026). No line of text, because every text line tried was "bad".
6. **Never naked.** The game's sheep always wears its wool (Brian: "the sheep should never become naked"). No sheep is on this screen. If one is ever added, it never uses the `sheared` part or coat level 0, not even for a moment, and nothing turns its wool into yarn in a way that leaves it bare. This rule applies to every later loading screen too.
7. **Readable by children.** The word is plain print, not joined handwriting. In joined handwriting a "c" after an "e" reads as another "e".

## 3. The parts

### 3.1 The word (`src/skin/loading/yarnWord.ts`, new, no imports)

`vite.config.ts` reads this file, so it must import nothing and be imported with its `.ts` extension, as `bootDoors.ts` is today.

- **The units.** The word is drawn in its own units:
  - the baseline is y = 0, with y pointing **down** on screen;
  - the small letters are 100 units tall and the tall ones 175 to 192;
  - the whole word is about 520 units wide.
- **The points.** The 90 points of Appendix A, written with y **up** as listed there, are copied exactly.
  - Each point is slanted first: x becomes x + 0.1 × y.
  - Then y is turned to point down: y becomes −y.
- **The curve.** The points are joined by a Catmull-Rom spline, written as cubic Béziers. For the piece from p1 to p2, with p0 before and p3 after:
  - the first control point is p1 + (p2 − p0) / 6;
  - the second control point is p2 − (p3 − p1) / 6;
  - at the two ends, the missing neighbour is the end point itself.

  Appendix A has the code.
- **What the strokes spell.** The word is one unbroken stroke, as one strand of yarn must be:
  - **f:** up the stem; a tight loop for the crossbar; over the hook, which flows into the top of the "l".
  - **e:** the bar first, then round.
  - **c:** the join arches over its top, so its mouth stays open.
  - **d:** along the baseline into the bowl, round it, then up the stem. The strand ends at the top of the "d".
- **The frame.** The view box is `-8 -204 542 216`. It holds every point, the strand's half-width and its shadow, with room to spare. The ball may go past it.
- **What the file exports.** Each is a constant, computed once when the module loads:
  - `WORD_PTS`, `SLANT` (0.1) and `VIEWBOX`;
  - `wordCubics()` and `guidePath()`: the smooth path as SVG `d` text, about 3.3 kB;
  - `sampleWord()`: a point every 1 unit along the word, each with x, y, its distance from the start s, and its direction (tx, ty); see Appendix B;
  - `TOTAL`: the word's length, 2,381.9 units in the prototype;
  - `START`, where the strand begins: the slanted first point, (18, 0).

### 3.2 The yarn (`src/skin/loading/yarn.ts`, new, no imports; Appendix B)

It is drawn on a canvas, not in SVG, because real yarn is thousands of small strokes. It is drawn **a little at a time, in order along the word**. A real strand laid later lies on top of what was laid before, so where the word crosses itself (the "f"'s loop, each "e", the "c", the "d") the later pass is on top with no extra work.

- **The strand.** It is 10 units across, made of two plies (round strands, each 0.56 of the half-width in radius) twisted round each other.
  - **Twist.** The plies make one full turn every 26 units. Each ply's centre sits sin(θ) × (half-width − ply radius) to the side of the word's line, where θ = 2π·s/26, plus π for the second ply. cos(θ) says whether that ply is in front (≥ 0) or behind.
  - **Order.** It is laid in pieces 0.25 units long. In each stretch drawn, every piece of a ply that is behind goes first, then every piece in front. The front pieces from the unit before the stretch are drawn again, so stretches join without a seam. A piece behind is never drawn over a piece in front; that was the sawtooth in an earlier try.
  - **Colour and light.** Each ply piece is a round-capped stroke as wide as the ply, in the base colour rgb(196, 74, 58), multiplied by 0.62 + 0.28·cos θ + 0.18·max(0, n·L)·sin θ.
    - L is the light, from the upper left: (−0.71, −0.71) on screen. n is the strand's sideways direction.
    - Over it goes a core 0.9 of the ply radius wide, 14% brighter at 55% opacity, set 0.35 of the ply radius toward the light. That gives each ply its roundness.
  - **Fibres.** On each ply facing us, 7 fine fibres (0.3 units wide, 22% opacity) twist the other way, one turn every 9 units. They make it read as spun wool, not plastic.
  - **Loose fibre ends.** About one every 1.8 units, a loose fibre end stands off an edge: 0.5 to 1.9 units long, 0.22 wide, curving, 28% to 48% opacity.
  - **No randomness.** Every "random" choice is `hash(place along the strand)`, so a strand drawn in pieces is the same picture as one drawn whole, on every load.
- **Its shadow,** on its own canvas under the yarn: the strand's line offset (0.8, 1.7) units, stroked three times with round ends, at widths 12.6, 11.4 and 10.2 and opacities 10%, 12% and 16%, in rgb(4, 8, 20). This is a soft shadow without a canvas filter, which not every browser supports.
- **The canvases.** Two canvases fill the word's box: the shadow, then the yarn.
  - Their backing size is the box's size times `min(devicePixelRatio, 2)`.
  - Their transform maps word units to pixels: a scale of (box width in px × that ratio) ÷ 542, after a shift of (8, 204) units.
- **Drawing as progress moves.** Each frame, the newly reached part from the last drawn s to the new one is drawn in stretches of at most 10 units, shadow first, then yarn.
  - At most 60 units are drawn a frame. A full redraw (the prototype took about 0.25 s for the whole word) is never done in one frame.
  - The ball never runs ahead of the drawn strand.
- **On a resize**, both canvases are cleared and the drawn part is laid again, up to 200 units a frame.

### 3.3 The yarn ball (Appendix C)

It is wound from the same yarn: wraps one way underneath, and a band of wraps the other way on top. At this size, a wound ball's twist is not seen, so each wrap is a smooth round strand.

- **Its parts.**
  - **The wraps.** The ball's unit radius is 50. Each wrap is 9 units wide: a darker rim (1.6 wider, base × 0.45), the strand (base × 0.95), and a core 0.38 as wide toward the light (base × 1.16, 60%).
    - Underneath: 13 wraps round an axis tipped 28° toward us, 13° of latitude apart.
    - On top: 9 wraps from pole to pole, 10° of longitude apart, from −60° to +24°.
    - The whole set is turned by −35° plus the spin.
  - **The shade** (fixed; it does not turn): a radial shade from the upper left, clear in the middle and 45% dark at the rim.
  - **The shadow** (fixed): three discs offset (0.1 r, 0.2 r), at 1.08, 1.04 and 1.0 r, each 10% dark.
- **As built.**
  - **The wraps** are one baked picture, `public/loading/yarn-ball.webp`: 320 × 320 px, the ball's radius 133 px (320 ÷ 2.4), spin 0, transparent outside the ball, WebP at quality 0.9, about 16 kB. It is preloaded from `index.html`.
    - Bake it with a development page, `?preview=yarnball` (`src/skin/loading/YarnBallRender.tsx`, which draws `drawBallWraps` on a canvas), and a tool, `tools/renderYarnBall.mjs`. They follow `tools/renderGuide.mjs` and `GuideRender.tsx`, and run the bake stamp like the other bake tools.
    - The ball turns by rotating this picture with CSS, so the turning costs nothing while the farm builds.
  - **The shade and the shadow** are inline SVG in the ball's box (a radial gradient and three circles), drawn over and under the picture. They are not part of the picture: shading must not turn with the ball.
- **Its size.**
  - Its box is 2.4 r0 square, centred on the strand's tip (the sample at the drawn s).
  - r0 = max(28 px, 38 units). At 1280 × 720, r0 is 57 px; on a 390 × 844 phone, 28 px.
  - It shrinks by `transform: scale(1 − 0.42 × p)`, where p is the progress shown (3.6). Its position is a `translate` in the same transform, so moving and shrinking never cause a layout.
- **Spin.** The picture turns by 300° × p.

### 3.4 The screen

- **The root.** `<div class="sk-doors sk-yarn" data-phase=… role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow=… aria-valuetext=…>`.
  - The class `sk-doors`, the id `boot-doors` and the phase names stay. `Rendering.tsx`, the gate tools and `e2e-painted/helpers.ts` find the screen by them.
  - It is fixed over the whole window at z-index 90 (the page's own copy at 89), and it takes every pointer event.
- **Background:** `#1B2742`, which is Home's `--hm-night`. It is written as a literal because the first-frame rules cannot read tokens.
- **Snow:** 22 flakes from `FLAKES` in `bootDoors.ts`, placed by its fixed hash (the same on every load). The values change to:
  - 2 to 4 px square, white, 16% to 40% opaque;
  - falling over 16 to 30 s, drifting up to 40 px;
  - no shadow.
- **The word's box:** `.sk-yarn-word`.
  - Its width `--ww` is `min(820px, 64vw)`, or `calc(100vw - 44px)` when the window is taller than it is wide.
  - Its aspect ratio is 542 / 216, and one unit is `--u: calc(var(--ww) / 542)`.
  - It is centred in the window with 4vh of padding at the bottom, so it sits a little above the middle.
  - At 1280 × 720 the word is 819 px wide and the strand 15 px thick. At 390 × 844 they are 346 px and 6.4 px.
- **Inside the word's box,** bottom to top:
  1. an SVG in word units holding the guide;
  2. the shadow canvas;
  3. the yarn canvas;
  4. the ball's box.
- **The guide:** `guidePath()`, stroked `#3D5283` at 4.2 units with round ends and `stroke-dasharray: 0.1 11.7`, so it reads as a row of dots. The yarn covers it as it is laid.

### 3.5 Movement

- **Every frame** (`requestAnimationFrame`), the screen takes the progress shown, p (3.6), and:
  - draws the yarn up to s = p × `TOTAL` (3.2);
  - moves the ball's box to the sample at the drawn s, sets its scale, and turns its picture.
- **While the farm builds.** The build runs in 50 ms slices (`scene/slices.ts`), so frames still come between them. The yarn and the ball keep moving even then; at worst they update about every 70 ms.
- **While waiting.** When p has not moved for 600 ms, the ball rocks ±4° about its base over 1.4 s (CSS on the ball's box). It stops as soon as p moves.
- **A tap or click on the ball:** it hops half its radius and lands with a 6% squash, 380 ms in all. Nothing else happens; nothing is kept, and nothing behind the screen gets the click.
- **Reduced motion** (the media query and `:root.reduce-motion`, as today):
  - no snow, spin, rock or hop;
  - the yarn and the ball still advance, because they are the progress.

### 3.6 What counts as progress (`src/skin/loading/progress.ts`, new, pure, no imports)

| Stage | Target | Signal |
|---|---|---|
| Before the code arrives | 0 | the page's own copy (3.7) |
| The code is running | 0.10 | `BarnDoors` has mounted |
| The farm builds | 0.10 + 0.78 × min(1, steps ÷ expected) | a read-only step counter in `scene/slices.ts` (below) |
| The scene draws its first frames | rises from 0.88 to 0.97 over 1.2 s | by time, from when the build finished |
| Ready (today's ready test) | 1 | — |

- **The step counter.** `slices.ts` gains `stepsTaken`, a number exported read-only. It grows by one for each `steps.next()` call, in `slice()` and in `rush()`. Nothing else in the file changes.
- **The expected count.** The device remembers it under `sap:boot-steps` as `{"desktop": N, "touch": M}` (one per detail level), read and written in `try`/`catch` and saved when ready.
  - The first visit uses `DEFAULT_STEPS`. Measure it once by building the farm at each detail level, and write the counts in.
  - Count only the steps taken before ready. The finer farm built after Home is up does not count.
- **Creep.** When the target has not risen for 1.5 s, it creeps by 0.01 every 1.5 s, never past its stage's end less 0.01 (0.87 while building, 0.96 while drawing).
- **The shown value, p.** It chases the target at most 0.9 a second and 2.5 a second once ready. It never goes backwards and never reaches 1 before ready.
- **Other loads** (into a game, practice, the tutorial, the dream or the results) only show the yarn if the wait passes `GRACE_MS` (3.8).
  - They start at 0.10.
  - A screen built in steps (the table) counts the steps taken since the screen came up, against `sap:load-steps`, keyed by the load's label.
  - A screen built in one go (the ice, the dream, the podium) has only the creep and the drawing stage.
- **For screen readers:** `aria-valuenow` is round(p × 100) and `aria-valuetext` is the hold's label, such as "Building the farm". The labels are no longer shown on screen, but the callers keep passing them.

### 3.7 Before the code arrives (the page's own copy)

`vite.config.ts` (`withBootDoors`, unchanged) writes `bootDoorsMarkup(base)` into `index.html` at `<!--boot-doors-->`. Into the head it writes the rules of `skin.css` between `boot-doors:start` and `boot-doors:end`. The mark names stay.

- **The markup:** the screen at p = 0:
  - the root with `id="boot-doors"`, `data-phase="shut"` and `aria-valuenow="0"`;
  - the snow;
  - the word's SVG with the guide alone, and the two canvases, empty;
  - the ball's box at `START` (left 4.797%, top 94.44% of the word's box), at r0, with spin 0: its picture and its shade and shadow. The SVG ids take a prefix, `yb0` here and `yb1` in the game's copy, so the two never share an id during the handover.

  It is plain text with no script: the built page allows none.
- **The rules** draw exactly that, and must stand alone: no tokens, no kit classes, no phase rules. The ball's size is CSS, `--r: max(28px, calc(38 * var(--u)))`, so the page needs no script to size it. The ball's picture path uses the site's base, like the door pictures did.
- **The handover.** The game's first screen renders the same markup from the same functions. As today, it sets each flake to where its twin had got to, then removes `#boot-doors`. Nothing on screen moves. The first thing anyone sees change is the yarn starting.

### 3.8 How it comes and goes

The phases, names and timing constants stay. Only what each phase looks like changes.

- **`shut`** (the first load starts here): the screen as above.
- **`closing`** (a hold that brings the screen up on its own): a 180 ms fade in. No swing, jolt or thud. `CLOSE_MS` and `CLOSE_REDUCED_MS` become 180. `whenDoorsShut` fires at its end, as now.
- **`veiling`** (a quick change of screen): the 180 ms dark fade (`#0D0F1C`), unchanged. If the wait passes `GRACE_MS` (800 ms) awake (`waitedFor`, `FROZEN_MS`), the yarn screen fades in over 240 ms on the dark and holds at least `REVEAL_HOLD_MS` (240).
- **Opening.** It happens when ready and p has reached 1 and stayed there 300 ms (`FULL_HOLD_MS`, new), so the finished word is seen. The `HOLD_MS` and give-up rules still apply; a stuck load (`GIVE_UP_MS`, `GIVE_UP_TOTAL_MS`) opens at once as today.
- **`open`:** the screen fades out over 250 ms and stops taking pointer events. `whenDoorsOpen` fires as it starts, so a solo game's clock starts then, as now. `gone` follows 260 ms later in every case (it was 1,150 ms for the swing).
- **Keys:** blocked exactly as today (`keysBlocked`).
- **Sound:** no door sounds. Stop calling `doorShut` and `doorOpen`; leave their definitions in `src/audio` untouched.

## 4. Files

| File | Change |
|---|---|
| `src/skin/loading/yarnWord.ts` (new) | The word and its sampling (3.1; Appendices A and B), ported to TypeScript with every number kept |
| `src/skin/loading/yarn.ts` (new) | Drawing the yarn and the ball's wraps on a canvas (3.2, 3.3; Appendices B and C) |
| `src/skin/loading/YarnBallRender.tsx` (new, development only), `tools/renderYarnBall.mjs` (new) | The ball's picture bake (3.3). Register both in `tools/bake/stale.ts`, `tools/bakeStamp.ts` and `tools/scenes/baked.ts` where the doors were |
| `public/loading/yarn-ball.webp` (new) | The ball's wraps, about 16 kB, preloaded from `index.html` (approved by this plan) |
| `src/skin/loading/progress.ts` (new) | The progress model (3.6) |
| `src/skin/loading/bootDoors.ts` | The yarn screen's first-frame markup and the new `FLAKES` numbers. `doorArt` goes. `BOOT_DOORS_ID`, `FLAKES`, `bootDoorsMarkup` and `bootDoorsCss` keep their names |
| `src/skin/components/BarnDoors.tsx` | Draws the yarn screen and runs 3.5, 3.6 and 3.8. Removes the doors, the sign, the ropes, the pixel scene, the sheep, `LINES` and the door sounds. Every exported name stays: `playBarnDoors`, `shutDoorsAtBoot`, `whenDoorsShut`, `whenDoorsOpen`, `useLoadingHold`, `doorsShut`, `keysBlocked`, `dropBootDoorsUnlessShut`, `DRAWN_ATTR`, `GRACE_MS`, `REVEAL_HOLD_MS`, `FROZEN_MS`, `waitedFor` |
| `src/skin/styles/skin.css` | Delete every `.sk-doors-*`, `.sk-door*` and `.sk-load*` rule and their keyframes. Add the `.sk-yarn*` rules. The block between the `boot-doors` marks becomes the yarn screen at 0 |
| `src/skin/scene/slices.ts` | Only `stepsTaken` (3.6) |
| `src/skin/PaintedApp.tsx` | Replace the `DoorsRender` lazy import and the `?preview=doors` page with `YarnBallRender` and `?preview=yarnball`. The labels passed to the loading screen stay |
| `src/skin/scene/placed.ts` | Remove the "door bake" light entry |
| `src/skin/audit/allow.json` | Remove the `.sk-door` allowance. The new rules need none: no CSS gradient (the ball's shade is an SVG gradient, which the audit does not count), no radius over 4 px, no blur-only shadow |
| `index.html` | Replace the three `loading/doors-*.webp` preloads with one for `loading/yarn-ball.webp`, page-relative like them, and reword the comments. `<!--boot-doors-->` stays |
| `vite.config.ts` | Only the wording of the error in `withBootDoors` ("the loading screen has nowhere to go") |
| Tests | Rewrite `src/skin/loading/__tests__/bootDoors.test.ts` for the yarn screen (same cases: in the page, rules in the head, says so loudly if the marks are lost, no script, stands alone, the same picture as the game draws, small). Add `yarnWord.test.ts`, `yarn.test.ts` and `progress.test.ts` (section 6). Keep `barnDoorsKeys.test.ts` and `barnDoorsWait.test.ts`. In `src/skin/__tests__/baked.test.ts`, replace the door examples with a stall picture. In `src/skin/table/__tests__/lightBounds.test.ts`, drop the `DoorsRender` skip |
| Tools | `tools/bake/stale.ts`, `tools/bakeStamp.ts`, `tools/scenes/baked.ts`: the doors out, the yarn ball in. Re-run the stamp tool so `tools/bake/baked.json` follows (never edit it by hand). `tools/gate/banned.mjs`: drop row 10's `DoorsRender` exception. `tools/gate/lib/painted.mjs` and `e2e-painted/helpers.ts` need no change: they look for `.sk-doors` and `#boot-doors` |
| Delete | `public/loading/doors-*.webp`, `src/skin/loading/doorsModel.ts`, `doorBoxes.ts`, `DoorsRender.tsx`, `src/skin/loading/__tests__/doors.test.ts`, `tools/renderDoors.mjs` |
| `docs/landing/` | This plan and the four pictures |
| `CLAUDE.md` | A short section, "The yarn loading screen (2026-11-21)": what it is; the names kept and why; rules 2, 5 and 6 (natural yarn, no worm-like look; no percentage or text; never naked) as standing rules; the entries it overrides; and "don't redesign it unless Brian asks" |

## 5. What must not change

- **The ready test and its constants:** `HOLD_MS`, `GRACE_MS`, `GIVE_UP_MS`, `GIVE_UP_TOTAL_MS`, `FROZEN_MS`, `VEIL_MS` and `REVEAL_HOLD_MS`, the waiting rule in `waitedFor`, and the quick dark fade between screens.
- **The solo game's clock** still waits until the screen starts to go (`whenDoorsOpen`).
- **Every exported name** in `BarnDoors.tsx` and `bootDoors.ts`, the class `sk-doors`, the id `boot-doors` and the phase names.
- **The first load always shows the screen,** a refresh included, as "Back to the barn doors" decided.
- **The rest:** the welcome form, the game, the farm and the wendigo zone and its check. No new dependency. Nothing outside the files in section 4.

## 6. Checks

1. **The first frame.** On a 5 Mbps line with an empty cache, the night, the dotted word and the ball are on screen within 1 s. The one picture requested for it is the ball's.
2. **Size.** `index.html` grows by at most 12 kB, and the ball's picture is at most 20 kB. The door pictures are gone, and `npm run size` passes.
3. **The yarn's tests.**
   - `yarnWord.test.ts`: 90 points, exactly Appendix A's; every sample, with the strand's half-width and its shadow, inside the view box; `TOTAL` 2,381.9 ± 1.
   - `yarn.test.ts`, with a stand-in canvas that records calls: drawing the word in 10-unit stretches leaves, for every place along it, the same last front piece as drawing it whole (no seam); the same calls on every run (no randomness); and no piece behind is drawn after a piece in front within a stretch.
   - In a browser: the word drawn in stretches and drawn whole differ in no more than 1% of pixels.
4. **`progress.test.ts`:** p never goes backwards; never reaches 1 before ready; never passes a stage's end while creeping; chases at the stated speeds; and copes with a broken or missing `sap:boot-steps`.
5. **The handover.** A flake and the ball are at the same pixel just before and just after the game takes over (as checked for the doors on 2026-11-13).
6. **Looks.** At 1280 × 720, 1440 × 900 (2x) and 390 × 844 (3x), the screen matches `loading-yarn-desk.png` and `loading-yarn-phone.png`, and up close `loading-yarn-closeup.png`: a twisted, matte strand with no outline, no stripes and no gloss. From 320 to 2560 px wide, the word and the ball stay inside the window.
7. **Movement under load.** Measure as `CLAUDE.md` says: long tasks and `data-drawn` against `data-phase`, at 1x and with the CPU slowed 4x. During the farm build the ball moves at least every 120 ms, no frame spends more than 8 ms drawing yarn, the page's long tasks are no longer than on `main`, and the screen starts to go within 400 ms of ready, plus the 300 ms hold.
8. **Interaction.** A tap makes the ball hop and reaches nothing behind it. Keys are blocked while the screen is up. Typing at the table works afterwards; check it in a browser.
9. **Reduced motion:** no snow, spin, rock or hop, and the yarn still advances.
10. **Never naked.** No sheep, and no sheared coat, on this screen.
11. **The gate:** the type check, `npm test`, the build and `npm run size` pass. `npx vite-node tools/scenes/check.ts -- --only wendigo` gives the same result as on `main` (it already fails there, waiting on Brian, as `CLAUDE.md` says).
12. **Review.** Put the pictures from item 6, a 10-second clip of a first load, and the numbers from item 7 in `docs/landing/review.md`.

## 7. The prompt for Claude Code

```text
Read CLAUDE.md to its last line, then docs/landing/LANDING-PLAN.md whole, then every file it names, whole. Open the
four pictures in docs/landing. Build the plan on one branch, landing/yarn, with local commits; no push or pull
request until Brian says. Port the appendices' code and numbers exactly; draw nothing by eye. No percentage, no text
line, no sheep. Run section 6's checks, put the pictures and numbers in docs/landing/review.md, and stop for Brian.
```

## Appendix A: the word's points and its curve

The prototype's own code. Points are written with y **up**; the code slants them and turns y down.

```js
const WORD_PTS = [
  [18, 0], [18, 40], [18, 86],
  [30, 98], [44, 100], [48, 104], [42, 108], [20, 106], [0, 104], [-6, 100], [0, 96], [14, 98], [19, 110],
  [20, 138], [27, 157], [42, 166], [60, 166], [78, 172], [94, 186], [103, 192], [108, 184], [105, 150], [102, 90], [102, 30], [108, 6], [124, 0],
  // e
  [130, 22], [137, 50], [160, 51], [186, 52], [183, 80], [161, 100], [139, 88], [132, 52], [138, 16], [160, 0], [182, 4], [196, 16],
  // e
  [206, 40], [214, 50], [238, 51], [264, 52], [261, 80], [239, 100], [217, 88], [210, 52], [216, 16], [238, 0], [260, 4], [274, 16],
  // c, the join arching over its top
  [282, 46], [292, 80], [310, 101], [332, 104], [350, 94], [356, 84], [348, 96], [330, 100], [310, 94], [298, 64], [300, 26], [316, 3], [340, 0], [358, 12],
  // e
  [368, 40], [376, 50], [400, 51], [426, 52], [423, 80], [401, 100], [379, 88], [372, 52], [378, 16], [400, 0], [424, 2],
  // d: along the baseline into the bowl, round it, up the stem
  [448, 1], [472, 0], [494, 12], [500, 50], [490, 88], [470, 100], [450, 88], [444, 50], [450, 14], [472, 0], [492, 6], [500, 24], [502, 80], [503, 140], [504, 175],
];
const SLANT = 0.1;

/** The word as cubic Béziers in word units (y down): Catmull-Rom through the slanted points. */
function wordCubics() {
  const P = WORD_PTS.map(([x, y]) => [x + y * SLANT, -y]);
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    out.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
  }
  return out;
}
/** guidePath(): 'M' + first point, then ' C c1 c2 p2' for each cubic, numbers to one decimal. */
```

## Appendix B: sampling the word, and the yarn

The prototype's own code. Port it as it is, into `yarnWord.ts` (`sampleWord`) and `yarn.ts` (the rest).

```js
function bez(c, t) { const u = 1 - t; return [u*u*u*c[0][0] + 3*u*u*t*c[1][0] + 3*u*t*t*c[2][0] + t*t*t*c[3][0], u*u*u*c[0][1] + 3*u*u*t*c[1][1] + 3*u*t*t*c[2][1] + t*t*t*c[3][1]]; }

/** Points every `step` units along the word: x, y, s (distance from the start), and the unit direction tx, ty. */
function sampleWord(step = 1) {
  const fine = []; let s = 0, prev = null;
  for (const c of wordCubics()) for (let k = prev ? 1 : 0; k <= 64; k++) {
    const p = bez(c, k / 64); if (prev) s += Math.hypot(p[0] - prev[0], p[1] - prev[1]); fine.push([p[0], p[1], s]); prev = p;
  }
  const total = s, out = []; let j = 0;
  for (let d = 0; d <= total + 1e-6; d += step) {
    while (j < fine.length - 2 && fine[j + 1][2] < d) j++;
    const a = fine[j], b = fine[j + 1], f = b[2] > a[2] ? (d - a[2]) / (b[2] - a[2]) : 0;
    out.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, s: d });
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 2)], b = out[Math.min(out.length - 1, i + 2)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    out[i].tx = (b.x - a.x) / l; out[i].ty = (b.y - a.y) / l;
  }
  return { pts: out, total };
}

// Yarn as it is made: two plies twisted round each other, each a round strand of fine fibres, lit from the upper left.
// plyStrand() lays the strand along a line of samples ({x, y, s, tx, ty} in word units, k px per unit) from s = a to
// s = b, so it can be drawn a little at a time: what is drawn later lies on top, as a later pass of real yarn does.
// Every "random" number is a hash of the place along the strand, so pieces give the same picture as the whole.
const PLY = { width: 10, pitch: 26, base: [196, 74, 58], fibres: 7, fibreTwist: 9, haloLen: 1.4, haloEvery: 1.8, step: 0.25 };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const colour = (base, f, a = 1) => `rgba(${base.map((v) => Math.max(0, Math.min(255, v * f)) | 0).join(',')},${a})`;

function plyStrand(ctx, pts, k, a, b, o = {}) {
  const F = Object.assign({}, PLY, o), hw = F.width / 2, pr = hw * 0.56, Lx = -Math.SQRT1_2, Ly = -Math.SQRT1_2;
  const at = (s, ply) => {
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(s / (pts[1].s - pts[0].s)))), q = pts[i], nx = -q.ty, ny = q.tx;
    const th = (s / F.pitch) * Math.PI * 2 + ply * Math.PI, off = Math.sin(th) * (hw - pr);
    return { x: (q.x + nx * off) * k, y: (q.y + ny * off) * k, depth: Math.cos(th), nx, ny, th, q };
  };
  ctx.lineCap = 'round';
  const piece = (s, ply, front) => {
    const p = at(s, ply), q = at(s + F.step, ply);
    if ((p.depth >= 0) !== front) return;
    const facing = p.nx * Lx + p.ny * Ly, lit = 0.62 + 0.28 * p.depth + 0.18 * Math.max(0, facing) * Math.sin(p.th);
    ctx.strokeStyle = colour(F.base, lit); ctx.lineWidth = pr * 2 * k;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    const sg = facing > 0 ? 1 : -1, ox = sg * p.nx * pr * 0.35 * k, oy = sg * p.ny * pr * 0.35 * k;   // the ply's roundness
    ctx.strokeStyle = colour(F.base, lit * 1.14, 0.55); ctx.lineWidth = pr * 0.9 * k;
    ctx.beginPath(); ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(q.x + ox, q.y + oy); ctx.stroke();
  };
  const steps = (from, to, fn) => { for (let s = Math.ceil(from / F.step - 1e-9) * F.step; s + F.step <= to + 1e-9; s += F.step) fn(s); };
  // every piece behind first, then every piece in front (and the front of the unit before `a` again, so stretches
  // join without a seam): no piece behind is ever drawn over one in front
  steps(a, b, (s) => { piece(s, 0, false); piece(s, 1, false); });
  steps(Math.max(0, a - 1), b, (s) => {
    piece(s, 0, true); piece(s, 1, true);
    for (let ply = 0; ply < 2; ply++) for (let f = 0; f < F.fibres; f++) {   // fibres, twisting the other way
      const ph = hash(f * 7 + ply * 101) * Math.PI * 2, t1 = ph - (s / F.fibreTwist) * Math.PI * 2, t2 = ph - ((s + F.step) / F.fibreTwist) * Math.PI * 2;
      const p = at(s, ply), q = at(s + F.step, ply);
      if (Math.cos(t1) < 0.2 || p.depth < 0.15) continue;
      const o1 = Math.sin(t1) * pr * 0.8 * k, o2 = Math.sin(t2) * pr * 0.8 * k;
      ctx.strokeStyle = colour(F.base, (0.85 + hash(f + ply * 13) * 0.35) * (0.8 + 0.3 * p.depth), 0.22); ctx.lineWidth = 0.3 * k;
      ctx.beginPath(); ctx.moveTo(p.x + p.nx * o1, p.y + p.ny * o1); ctx.lineTo(q.x + q.nx * o2, q.y + q.ny * o2); ctx.stroke();
    }
    const h = hash(Math.round(s / F.step) + 0.5);                          // now and then a loose fibre end
    if (s >= a && o.halo !== false && h < F.step / F.haloEvery) {
      const q = at(s, 0).q, side = hash(s * 3.1) < 0.5 ? -1 : 1, nx = -q.ty * side, ny = q.tx * side, len = (0.5 + hash(s * 5.7) * F.haloLen) * k;
      const ox = (q.x + nx * (hw - 0.4)) * k, oy = (q.y + ny * (hw - 0.4)) * k, lean = (hash(s * 9.3) - 0.3) * 1.2;
      ctx.strokeStyle = colour(F.base, 1.05, 0.28 + hash(s * 2.2) * 0.2); ctx.lineWidth = 0.22 * k;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.quadraticCurveTo(ox + nx * len * 0.5, oy + ny * len * 0.5, ox + (nx + q.tx * lean) * len, oy + (ny + q.ty * lean) * len); ctx.stroke();
    }
  });
}

/** The strand's soft shadow from a to b, on its own canvas under the yarn: three strokes, each a little wider and
 *  fainter, offset down and to the right (no canvas filter, which not every browser has). */
const SHADOW = { dx: 0.8, dy: 1.7, rings: [[2.6, 0.10], [1.4, 0.12], [0.2, 0.16]] };
function plyShadow(ctx, pts, k, a, b, width = PLY.width) {
  const p = new Path2D(); let first = true;
  for (const q of pts) { if (q.s < a - 1 || q.s > b) continue; first ? p.moveTo((q.x + SHADOW.dx) * k, (q.y + SHADOW.dy) * k) : p.lineTo((q.x + SHADOW.dx) * k, (q.y + SHADOW.dy) * k); first = false; }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [extra, alpha] of SHADOW.rings) { ctx.strokeStyle = `rgba(4,8,20,${alpha})`; ctx.lineWidth = (width + extra) * k; ctx.stroke(p); }
}
// Each frame: for (a = drawn; a < target; a += 10) { b = min(target, a + 10); plyShadow(shadowCtx, …, a, b); plyStrand(yarnCtx, …, a, b); }
```

## Appendix C: the yarn ball

The prototype's own code. `drawBallWraps` makes the baked picture (at r = 133 in a 320 px square, spin 0). The shade and the shadow are drawn in the game as inline SVG with the same numbers: a radial gradient centred at (−0.32 r, −0.36 r) from 0.15 r to 1.02 r, with stops at 0 (rgb(255, 220, 200) at 10%), 0.55 (clear) and 1 (rgb(30, 8, 6) at 45%); and three circles at (0.1 r, 0.2 r) of radius 1.08, 1.04 and 1.0 r, each rgb(4, 8, 20) at 10%.

```js
/** Samples along an elliptical arc, in the ball's units, every `step`. */
function arcSamples(cx, cy, rx, ry, rot, t0, t1, step = 0.6) {
  const c = Math.cos(rot), sn = Math.sin(rot), n = Math.max(8, Math.ceil(Math.abs(t1 - t0) * Math.max(rx, ry) / 0.3)), raw = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, x = rx * Math.cos(t), y = ry * Math.sin(t); raw.push([cx + x * c - y * sn, cy + x * sn + y * c]); }
  let acc = 0; const cum = [0]; for (let i = 1; i < raw.length; i++) { acc += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); cum.push(acc); }
  const out = []; let j = 0;
  for (let d = 0; d <= acc; d += step) { while (j < cum.length - 2 && cum[j + 1] < d) j++; const f = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1); out.push({ x: raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, y: raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f, s: d }); }
  for (let i = 0; i < out.length; i++) { const A = out[Math.max(0, i - 1)], B = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(B.x - A.x, B.y - A.y) || 1; out[i].tx = (B.x - A.x) / l; out[i].ty = (B.y - A.y) / l; }
  return out;
}
/** One wound wrap: a smooth round strand (at this size a ball's twist is not seen), a darker rim where it meets the
 *  next wrap, and a lighter core on the side toward the light. */
function wrap(ctx, pts, k, sw) {
  const path = new Path2D(); pts.forEach((p, i) => i ? path.lineTo(p.x * k, p.y * k) : path.moveTo(p.x * k, p.y * k));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = colour(PLY.base, 0.45); ctx.lineWidth = (sw + 1.6) * k; ctx.stroke(path);
  ctx.strokeStyle = colour(PLY.base, 0.95); ctx.lineWidth = sw * k; ctx.stroke(path);
  const core = new Path2D(); pts.forEach((p, i) => { const nx = -p.ty, ny = p.tx, sg = (nx * -1 + ny * -1) > 0 ? 1 : -1, x = (p.x + sg * nx * sw * 0.18) * k, y = (p.y + sg * ny * sw * 0.18) * k; i ? core.lineTo(x, y) : core.moveTo(x, y); });
  ctx.strokeStyle = colour(PLY.base, 1.16, 0.6); ctx.lineWidth = sw * 0.38 * k; ctx.stroke(core);
}
/** The ball's wraps, which turn as it rolls: wraps one way underneath, a band the other way on top, clipped to the
 *  ball. Drawn at (cx, cy) with radius r px; `spin` in degrees. */
function drawBallWraps(ctx, cx, cy, r, spin = 0) {
  const k = r / 50, rot = (-35 + spin) * Math.PI / 180, sw = 9, tip = 28 * Math.PI / 180;
  ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = colour(PLY.base, 0.5); ctx.fillRect(-r, -r, 2 * r, 2 * r);
  for (let phi = -80; phi <= 80; phi += 13) {                 // underneath: wraps across an axis tipped 28 degrees
    const ph = phi * Math.PI / 180, yc = 50 * Math.sin(ph) * Math.cos(tip), rx = 52 * Math.cos(ph), ry = rx * Math.sin(tip);
    wrap(ctx, arcSamples(0, yc, rx, ry, rot, Math.PI, 0), k, sw);
  }
  for (let l = -60; l <= 24; l += 10) {                       // on top: the band, pole to pole
    const rx = Math.max(0.5, Math.abs(50 * Math.sin(l * Math.PI / 180)));
    wrap(ctx, arcSamples(0, 0, 52, rx, rot + Math.PI / 2, l < 0 ? 0 : Math.PI, l < 0 ? Math.PI : 2 * Math.PI), k, sw);
  }
  ctx.restore();
}
```
