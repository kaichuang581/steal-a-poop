# Finish the Word v3.1 for Claude Code: start screen, outlines, resolution, look

Version 3.1, 3 November 2026. Addendum to `docs/REDESIGN_PLAN_V3.md`; the v1 guardrails and the v3 rules still apply. This file adds two milestones to run before v3 Milestone 2: **R (render fixes)** and **H (the start screen)**. Nothing here changes a game rule.

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V3_1.md`. Run Milestone R first (it fixes the outlines and the resolution everywhere, including the start screen), then Milestone H.

```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4), @docs/REDESIGN_PLAN_V3.md (Parts 1, 4 and 8) and @docs/REDESIGN_PLAN_V3_1.md. Do Milestone R exactly as specified. Attach before and after screenshots at 1920 by 1080 and report the diagnosis in Part 1.1 with evidence.
```

---

## 1. Milestone R: render fixes

### 1.1 Remove the outline on every voxel
Every cube in the current build shows a dark edge on all sides, which turns a wall into a grid of tiles. Diagnose before changing anything; report which of these is true, with the file and line:

| Likely cause | How to check | Fix |
|---|---|---|
| Each voxel is its own box and the boxes are scaled below 1.0 (for example 0.95), so the background shows through the gaps | search for `scale(` on voxel meshes or a `size * 0.9x` in the box geometry | scale 1.0; then replace the boxes with the merged mesher below |
| An `EdgesGeometry` / `LineSegments` / `wireframe: true` is attached to voxel meshes | search `EdgesGeometry`, `LineSegments`, `wireframe` under `src/skin` | delete it; edges are allowed only on the ice cube |
| An outline post-process (`OutlinePass`, Sobel, toon outline shader) is in the composer | search `OutlinePass`, `Sobel`, `outline` | remove it |
| Each cube face carries a texture with a darker border, or a UV-based border in a shader | inspect the voxel material: `map`, custom `onBeforeCompile`, `fragmentShader` | plain `MeshLambertMaterial({ vertexColors: true })`, no map |
| Per-voxel colour noise is strong enough that neighbouring faces on one plane differ visibly | look at a flat plank: do coplanar faces share one colour? | noise under 4% luminance on broad surfaces; variation comes from light and AO, not from random tones |
| Screen-space AO with a tiny radius darkens every cube edge | search `SSAOPass`, `SAOPass`, `GTAO`; check `kernelRadius` | radius 0.6 to 1.0 m, intensity 0.5; or remove SSAO and rely on baked vertex AO |

Whatever the cause, the end state is the same: voxel objects are **face-culled merged meshes** built by `src/skin/voxel/mesher.ts` (v3 Part 8). Coplanar faces of the same colour then share identical shading, so a flat plank wall renders as one unbroken surface and the grid is visible only at silhouettes and real steps.

Acceptance: a screenshot of a flat section of barn wall at 1920 by 1080 shows no lines between cubes; zoomed to 400%, adjacent faces of one plank differ by less than 4% luminance.

### 1.2 Resolution ("low bitrate")
The 3D view is rendered at a lower resolution than the page and stretched, so it looks soft and stair-stepped while the HTML text beside it is sharp. Check and fix all of the following:

- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`; in react-three-fiber `<Canvas dpr={[1, 2]}>`. Never a dpr below 1 on desktop. If the current code lowers dpr for performance, the merged meshes from 1.1 pay for the pixels; remove the reduction.
- `renderer.setSize(width, height, false)` where width and height are the container's CSS size, and the canvas has `width: 100%; height: 100%` in CSS. No fixed low `width`/`height` attributes, no CSS transform scaling the canvas.
- `antialias: true` on the renderer. If a post-processing composer is used (which disables MSAA), add an SMAA or FXAA pass at the end.
- Remove any `image-rendering: pixelated` or `crisp-edges` on the canvas and any "retro" pixelation pass.
- Phones: dpr 1 to 1.5, same rules.

Acceptance: at 1920 by 1080 a diagonal plank edge shows a staircase no larger than 1 physical pixel; `renderer.getPixelRatio()` logged at startup equals `min(devicePixelRatio, 2)`.

### 1.3 The look (apply once, globally)
| Setting | Value |
|---|---|
| Tone mapping | `ACESFilmicToneMapping`, exposure 1.0; output colour space sRGB |
| Sun | `DirectionalLight`, warm (#FFD3A8 dusk, #FFF1D6 day), intensity 1.6, elevation 20°, azimuth 35° to the side of the camera; shadow map 4096 desktop / 2048 phone, PCFSoft, bias −0.0004, normal bias 0.02, shadow camera fitted to the barn and yard |
| Sky light | `HemisphereLight` sky #9FB7D6 ground #5B6B7A, intensity 0.55 (cool fill; shadows read blue) |
| Lanterns and windows | `PointLight` #FFB45A intensity 2.0, distance 12, decay 2; glow boxes emissive |
| Bloom | `UnrealBloomPass` threshold 0.85, strength 0.35, radius 0.4 (only lanterns, windows and the sun disc bloom) |
| Ambient occlusion | baked vertex AO from the mesher (mandatory) plus optional SSAO radius 0.8 m intensity 0.5 |
| Fog | `FogExp2` density 0.012 in the hour's fog colour, fading toward the sky; the sky dome ignores fog |
| Sky | gradient dome (hour colours from v3), stars and aurora at night |
| Palette | v3 Part 4.3 three-tone table, saturation reduced 25 to 35% from the current build; shadows cool, highlights warm; no pure black |
| Depth of field | a very light tilt-shift (`BokehPass` or a two-band blur) on the Home screen only: focus on the doorway, blur strength 0.15 at the top and bottom 20% of the frame; off during play |
| Camera lens | fov 24 to 28 and the camera three times farther away than now (Part 2 gives exact values); during play the v3 table camera stays at fov 44 but moves back 1.5 m |

Acceptance: before/after screenshots at the same time of day; the after image has visible blue shadow faces and warm lit faces, no clipped whites except lantern cores, and a soft horizon.

### 1.4 Budget after R
Under 1.5 M triangles on screen, frame under 6 ms on a mid-range phone at dpr 1.5, under 3 ms on desktop at dpr 2; first render under 3.5 s on 4G. Report numbers from a dev overlay.

---

## 2. Milestone H: the start screen

### 2.1 What is wrong now
- The camera stands at eye level a few metres from the barn's blank side wall, so the barn fills the frame, the near corner bulges, and the hero (a sheep in the doorway) is cut off at the bottom.
- The scene has no focal point: the door light is weak, there is no path to the door, nothing in the distance.
- The right column asks for everything at once: name, sheep count, difficulty, five modes, How to Play, settings and four legal links. Mode choice and game setup are mixed together.
- The title uses a pixel typeface that fights the voxel art; the v1 typefaces (Fraunces, Nunito, Patrick Hand) are the standard.

### 2.2 The shot
A diorama view of the barn from the yard at the player's hour.

- Camera: fov 26, position (−12.5, 7.0, 23.0), looking at (0.6, 1.6, 4.5) (the open doorway). The barn's front-left corner and both open doors are in frame; the doors open toward the camera; the side wall recedes to the right.
- Idle drift: the camera moves on an ellipse of 0.25 m × 0.12 m over 40 s and the target stays fixed; off under reduced motion.
- Light spill: a `SpotLight` inside the doorway (#FFC278, intensity 3, angle 0.55 rad, penumbra 0.6, distance 16) pointed down the path, so warm light lies on the snow in front of the doors; two lanterns inside as v3.
- Path: trampled snow (#CFD9E6) from the lower-left of the frame to the door with sheep footprints; drifts against the walls; two pines flanking the frame at left; the fence and gate on the right; the farmhouse with lit windows and chimney smoke in the far left; hills and mountains behind; snow falling; stars and aurora at night.
- Hero: the default sheep (the player's) standing in the doorway light, 1.2 m in front of the doors, facing the camera, idle with blinks; it looks toward the pointer on desktop (head yaw up to 0.3 rad) and does a small hop when the player's name field receives focus. A second sheep is half visible inside, eating hay. Both use the one default model.
- Title: an HTML sign, not 3D text: a wooden board with a snow cap, Fraunces 700 at 44 to 56 px, in the upper-left over the sky; one line beneath in Nunito: "Chain words. Grow your wool. Don't get stolen from."

### 2.3 The panel (right column, 380 px; stacked on phones)
Two steps instead of one form.

Step 1, "Choose a table":
- Three large paper tickets: **Quick Game** ("You and the bots in the barn"), **Daily Table** ("One attempt today; the same table for everyone"), **Practice** ("Easy bots, 25-second turns, no penalties, hints"). Each ticket shows its small voxel icon (a lantern, a calendar lantern string, a book) rendered as an SVG, not an emoji.
- Two text links under them: **Tutorial** ("A guided first game with the sheepdog") and **Play with others** (disabled, "Rooms open when the game server is live").
- A footer line: version, Send feedback, Privacy, Terms, Child safety, in one row of small links.
- Settings as a gear icon and a mute icon at the bottom-left of the screen, over the snow.
- How to Play opens a paper overlay with the rules (existing text), not a separate button in the stack.

Step 2, "Set the table" (slides in over the tickets when Quick Game is chosen):
- Your name (the existing field, same `id`).
- Sheep at the table: the counts the engine supports today, shown as small sheep icons that walk in as the number rises.
- Bot difficulty: Easy, Medium, Hard as seedling, leaf, acorn chips (existing values).
- One wooden button: **Sit down**. A small "Back" link returns to the tickets.
- Daily Table and Practice skip step 2 and start immediately with the engine's defaults, exactly as today.

All controls call the existing callbacks only; the counts and difficulties offered are whatever the engine already offers.

### 2.4 Phone
Scene behind everything at fov 34, camera (−9, 6.5, 21) looking at (0.4, 1.6, 4.5); title at the top; the three tickets stacked at the bottom with the two links below; step 2 as a bottom sheet. The hero sheep stays visible between the title and the tickets at 667 px tall.

### 2.5 Motion
Tickets lift 2 px on hover and sink 1 px on press; step 2 slides in over 300 ms with `--ease-out`; the sheep's hop on name focus; snow and the camera drift are the only ambient motion. Reduced motion: no drift, no slide, no hop.

### 2.6 Acceptance
- Screenshots at 1920 by 1080 and 390 by 844 at dusk and night.
- The doorway is the brightest area of the frame and sits on the right-hand third line; the hero sheep is fully visible and uncut.
- Nothing on the screen uses a pixel typeface; the title is Fraunces.
- Step 1 shows exactly three tickets, two links and the footer; step 2 shows name, count, difficulty and Sit down.
- Starting each mode reaches the same engine entry points as before (verify by calling the same functions; no new game-start path).
- Frame time within the Part 1.4 budget with the Home depth-of-field on.

---

## 3. Order of work
1. Milestone R (render fixes), one session.
2. Milestone H (start screen), one session.
3. Continue with v3 Milestone 2 (the barn table) using the R settings.
