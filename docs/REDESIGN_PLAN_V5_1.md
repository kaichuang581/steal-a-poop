# Farm animals v5.1 for Claude Code: final proportions, connections and every animation

Version 5.1, 7 November 2026. The last plan for the six avatars. It builds on v5 (the rig, the eye standard, the garments as lives, the tests) and changes only what the six-up screenshot of 7 November shows to be wrong: proportions, the joins between parts, the sheep's head, the chicken, and the animations, starting with the cow's chewing. Everything here is measured, and every milestone ends with the tests in Part 7 and the pictures in Part 8.

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V5_1.md`, add the Part 1 block to `CLAUDE.md`, and paste:

```
Read @docs/REDESIGN_PLAN_V5_ANIMALS.md (Part 4 only) and @docs/REDESIGN_PLAN_V5_1.md in full. Do Milestone F0 exactly as specified: add the measurements and tests of Part 7, run them against the current models, and attach the report with every number. Change no model. Stop there.
```

Then F1 to F5, one per session, each ending with the Part 7 test output and the Part 8 pictures attached. Part 10 lists the decisions I made; change any before Claude Code starts.

---

## 1. Guardrail addition (append to CLAUDE.md)

```markdown
- Farm animals v5.1 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V5_1.md is the final animal plan. The proportion
  sheet (V5.1 Part 4.1), the connection rules (4.2), the face rule (4.4: every mouth, lid and brow voxel sits on a head
  voxel; chewing never leaves the head), the neck channel (4.6) and the animation ranges (6.6) are binding for every
  species, the sheep included: the sheep's head is rebuilt under V5.1 Part 5.1 (this supersedes "the sheep model does not
  change"). The tests in V5.1 Part 7 are part of `npm test`; a model that fails one is not done.
```

---

## 2. What the six-up shows, and what fixes it

| Seen | Why | Fix |
|---|---|---|
| The sheep reads as a dog | its head is taller than it is wide (10 rows by 7 columns), pointed, hanging below the back line; the ears are one voxel thick and invisible; the collar and bell hang at mid-chest like a dog's tag | a head wider than tall with a blunt muzzle, held level with the back, sideways ears, the eye standard, the collar at the neck and the bell under the chin (5.1) |
| Bodies too short and tall, heads too big (cow, horse, goat, pig) | the bodies were shortened to fit the voxel budget before the hollowing made length cheap; the heads kept their size | the proportion sheet (4.1): torso length to height 1.5 to 1.9, head height 0.5 to 0.8 of torso height, and the budget re-measured on hollowed shells |
| Heads and necks look stuck on; the pig's head is fused into its body | necks thinner than the head's back; the pig's head box starts inside the body; no shoulder bulge where the neck leaves the chest | the connection rules (4.2): overlaps of three voxels, neck sections at 70 to 90% of what they join, a notch test on the top outline |
| Sweaters look like shells or bags | the shell is grown on the hollowed body's top and side faces only and stops at a hard belly line; it does not reach the neck | garment rules (4.5): the shell follows every exposed face down to the belly line, closes at the neck with its own band, and leaves a third of the belly bare |
| The cow's "tongue" hangs below its jaw when it chews | `chewDown` draws the mouth one row below the mouth row, and the mouth row is the muzzle's bottom row | the face rule (4.4): the mouth sits on the second row from the bottom, so every chewing frame stays on the face; a test checks it for every species |
| The chicken is a penguin | an upright egg with a ball on top, wings too small to see, the tail hidden | a horizontal, plump body with the breast low and forward, the head on a short neck ahead of the breast, big flank wings, a raised fan tail (5.6) |
| The horse has no mane; the cow's front legs are grey | the mane is too thin to read; a sock or shade tone applied to the front legs | the mane as a 2 by 3 ridge along the neck (5.4); legs in one tone unless the sheet says socks |

---

## 3. Milestone F0: measure

Add the measurements and tests of Part 7 (they are plain functions over the models' cells) and run them against the current six models. Produce `docs/skin/animals-v5_1/F0-report.md` with, for each species, every number the tests compute and which ones fail. Do not change any model. Expected failures: the proportion ratios of the cow, horse, goat and pig; the notch test at the pig's and goat's necks; the face test for the cow, sheep and goat (chewing frames); the chicken's orientation test; the sheep's head-shape test.

---

## 4. Shared rules (final)

### 4.1 The proportion sheet

Measured on the level-2 model from its cells. Torso means the body part without the neck; H is height, L length (along z), W width (along x).

| Ratio | Sheep | Pig | Cow | Horse | Goat | Chicken |
|---|---|---|---|---|---|---|
| Torso L / H | 1.40 to 1.55 | 1.40 to 1.55 | 1.65 to 1.80 | 1.85 to 2.00 | 1.50 to 1.65 | 1.60 to 1.75 |
| Torso W / H | 1.05 to 1.20 | 1.00 to 1.15 | 0.95 to 1.10 | 0.80 to 0.95 | 0.90 to 1.05 | 0.95 to 1.10 |
| Head H / torso H | 0.50 to 0.62 | 0.75 to 0.85 | 0.55 to 0.65 | 0.50 to 0.60 | 0.50 to 0.60 | 0.70 to 0.85 |
| Head W / torso W | 0.60 to 0.72 | 0.72 to 0.82 | 0.58 to 0.68 | 0.50 to 0.60 | 0.48 to 0.58 | 0.65 to 0.80 |
| Head L / head W | 0.80 to 1.00 | 0.75 to 0.90 | 1.10 to 1.25 | 1.70 to 1.95 | 1.25 to 1.45 | 1.00 to 1.15 |
| Head H / head W | 0.70 to 0.85 | 0.95 to 1.05 | 0.85 to 1.00 | 1.10 to 1.25 | 1.00 to 1.15 | 0.95 to 1.05 |
| Leg height (visible) / torso H | 0.40 to 0.55 | 0.30 to 0.45 | 0.45 to 0.60 | 0.70 to 0.85 | 0.55 to 0.70 | 0.45 to 0.60 |
| Head top / back line | 1.00 to 1.10 | 0.95 to 1.08 | 0.90 to 1.00 | 1.30 to 1.45 | 1.15 to 1.30 | 1.20 to 1.40 |
| Muzzle tip ahead of the chest, as a share of head L | 0.55 to 0.75 | 0.45 to 0.60 | 0.60 to 0.80 | 0.80 to 1.00 | 0.60 to 0.80 | 0.70 to 1.00 (beak tip) |
| Eye height / head H | ≥ 0.40 (4 by 4) | ≥ 0.36 | ≥ 0.55 | ≥ 0.60 | ≥ 0.60 | ≥ 0.45 |

"Head top / back line" is the head's highest voxel over the torso's highest voxel (the sheep's wool counts as torso). "Visible leg height" is the leg from the ground to the torso's lowest voxel at that leg. All six ratios of every species are printed by the test; one outside its range fails the model.

### 4.2 Connections

1. **Necks.** Every species but the sheep and the pig has a `neck` part built with `segment`: its base section is 70 to 85% of the chest's height at the join, its top section 80 to 95% of the head's back height; the base is buried three voxels into the torso and the top three voxels into the head. The sheep has no neck (the wool hood meets the head); the pig has a neck wedge two voxels long between the shoulder bulge and the head.
2. **Heads.** The head's back face is never visible: it is inside the neck's top (or, for the sheep and pig, inside the hood or shoulder bulge) by at least three voxels in z. The head's back-bottom pivot is the neck joint, and the head's centre is at least 0.45 of its length ahead of the torso's front face (pig 0.45, others as 4.1).
3. **Shoulders and hips.** An ellipsoid bulge 1 voxel proud of the torso around each leg socket (radii 0.6 of the torso height); the top two voxels of every leg are inside the torso.
4. **Ears, horns, tails, combs, beards, wattles, wings.** Rooted at least two voxels inside the part they grow from, in every axis they touch (the connectivity test already catches air; this catches thin roots).
5. **The notch test.** Take the side silhouette of torso ∪ neck ∪ head (max y per z column). Between the withers (the torso's highest column) and the crown (the head's highest column), the outline may dip no more than two voxels below the lower of its two ends, and no single column may be more than two voxels below both neighbours. A head that sits on a thin neck fails here, as the goat's and pig's do now.
6. **Collars** hug the neck at the join: a one-voxel ring whose centre is the neck's section centre one voxel in front of the chest; the bell's top touches the ring's lowest voxel. Never lower.

### 4.3 Heads

All horizontal, as v5 Part 4.4, with the sheep now a short blunt wedge (5.1). Pitch at rest: sheep 0°, pig 8° down, cow 10° down, horse 0°, goat 0°, chicken 0°. A head is never taller than it is wide except the horse (4.1).

### 4.4 The face rule (mouths, lids, brows)

- The **mouth row** is the second row from the bottom of the muzzle (or of the head's front, where there is no muzzle). `flat`, `smile`, `chewL` and `chewR` sit on that row; `chewDown` sits on the row below it (the bottom row); `o` uses the row above, the row itself, and the row below. So every frame lies on the face. The `mouths()` helper takes the muzzle's bottom row and places the mouth one above it; no species passes the bottom row as the mouth row.
- **Painted on the face**: every voxel of every mouth, lid and brow part, at rest, has a head (or muzzle) voxel directly behind it (one voxel further in, along the face's normal). Test 7.4 checks all six species and all nine face parts.
- There is no tongue on any species. Chewing is the mouth line moving; the chicken has no mouth parts except `o`, which is one dark voxel under the beak (an open beak).
- Lids cover the eye plate exactly (the same columns, the middle row for `closed`, the arc for happy); brows sit one row above the plate, never on it.

### 4.5 Garments (lives)

- A garment shell grows one voxel proud of **every** exposed face of the torso cells inside its zone (not only the top and sides): the belly line is a straight horizontal cut and below it the body shows. Zones leave at least a third of the torso's height bare below the belly line (pig and goat) or a quarter (cow and horse blankets); the chicken's vest covers only the top above its wings (5.6).
- The sweater and the vest close at the neck with their own one-voxel band around the neck's base (the same ring as the scarf, in the knit tones), so the neck does not look cut off; the blanket does not.
- The hem is one ribbed row; the rest is plain knit; the blanket's fringe is one row of the second tone.
- Scarf, leg warmers and the level mapping are unchanged from v5 Part 4.9. A garment never touches the head or the ears.

### 4.6 The neck channel

Add `neckX` to the pose channels: a pitch about the neck's base joint, applied to a group that parents the neck and the head (the head still has its own `headX` about the neck joint). Species without a neck ignore it. Ranges in 6.6. This is what makes a horse or cow graze with its neck, not its skull.

### 4.7 Budgets

As v5 Part 4.12, measured on the hollowed shells: voxels at most 3,200, triangles at most 10,000, colours at most 14, parts at most 24. Lengthening a body costs a few hundred voxels; the F0 report prints the margin.

---

## 5. Species sheets (final numbers; metres, and voxels in brackets at 0.04 m)

Conventions as the code: +z forward, +y up, x sideways; the torso centred at z 0. "Rows" count voxels from y 0.

### 5.1 Sheep (the head rebuilt; body, wool, legs, tail unchanged)

- **Head**: a blunt wedge 0.36 wide (9) × 0.28 tall (7) × 0.30 long (8), rows 15 to 21 (y 0.60 to 0.88), replacing `HEAD_ROWS`: `[21, 4, 8, 12], [20, 4, 7, 13], [19, 4, 7, 14], [18, 4, 7, 14], [17, 3, 8, 14], [16, 3, 9, 14], [15, 2, 10, 13]` (row, half-width, z back, z front). The crown row is shorter at both ends (convex top), the muzzle rows narrower and blunt. The pivot stays `HEAD_PIVOT` (the neck joint); the head's back (z 7 to 8) sits inside the hood. The head's top (0.88) is at the back line (0.80 to 0.88); its bottom (0.60) is above the body's centre.
- **Face**: FACE[0] #4A3B34 with the bridge and cheeks FACE[1] #6A5A50; nose a 2 × 2 patch in #8E7B78 at rows 15 to 16 with the inverted-Y nostrils in #5A4A46; mouth on row 16 (the second from the bottom), width 3; chewing frames on rows 15 to 16.
- **Eyes**: the 4 × 4 variant of the eye standard, wrapped on the sides at the front third (two columns onto the front face), rows 17 to 20; iris in #2B2522; lids and brows from the rig's `lidsAndBrows`.
- **Ears**: 5 long × 2 tall × 2 deep (0.20 × 0.08 × 0.08), from the head's sides at rows 19 to 20, z 9 to 10, straight out sideways and drooping 10°; the lower front voxels in EAR_PINK; pivots at the roots. They must show in the front view.
- **Hood**: the wool lobes over the crown and down the cheeks to row 17 behind the eyes, never on the front face below row 21; the topknot of three lobes above row 21 at z 9 to 12.
- **Collar and bell**: the ring at rows 14 to 15 around (CX, 0.58, 0.36) with radius 0.13; the bell 3 × 3 × 3 directly under the chin at rows 11 to 13, z 0.44 to 0.52, its top touching the ring.
- **Checks**: head W / H = 1.29 (wider than tall); muzzle ahead of the chest 0.6 of head L; ears visible from the front at 64 px.

### 5.2 Pig

| Part | Numbers |
|---|---|
| Torso | ellipsoid radii (0.29, 0.27, 0.40) at (0, 0.46, 0): 0.58 W × 0.54 H × 0.80 L; belly 0.19, back 0.73; shoulder bulge radii (0.26, 0.22, 0.16) at (0, 0.48, 0.30); hip bulge (0.25, 0.22, 0.14) at (0, 0.50, −0.30) |
| Neck wedge | 2 voxels long, section 0.30, between z 0.40 and 0.48 at y 0.52 |
| Head | box 0.44 W (11) × 0.44 H (11) × 0.36 L (9), chamfer 2, x ±0.22, rows 6 to 16 (y 0.24 to 0.68), z 0.30 to 0.66 (the back 0.10 inside the shoulder bulge); pivot (0, 0.44, 0.34); pitch 8° down |
| Eyes | 4 × 4 front plates, rows 12 to 15, columns x −5..−2 and 2..5, iris in the character's dark tone |
| Snout | disc 6 wide × 4 tall × 2 proud at rows 8 to 11, x −3..2, nose tone; nostrils at row 10, x −2 and 1 |
| Mouth | row 7 (the second from the bottom, 6), width 5; chew frames on rows 6 to 7 |
| Cheeks | 2 × 2 in `T.pink[1]` under the outer eye columns at rows 10 to 11 |
| Ears | triangles 5 wide × 5 tall × 1 thick rooted at the top corners (x ±4..±5, rows 15 to 16, z 0.40 to 0.44), tilted 35° forward so the tips reach row 13 over the brow; pink inner |
| Legs | 3 × 3 × 8 (0.32) at (±0.16, ±0.24), tops 0.13 inside the belly; hooves 2; splay 1 |
| Tail | `helix` radius 0.03, 1.5 turns, 2 voxels thick at (0, 0.56, −0.42) |
| Garment | sweater zone z −0.22..0.22, belly line 0.34 (0.15 of belly bare); neck band at (0, 0.56, 0.36) rx 0.17 ry 0.14; scarf tails (0, 0.42, 0.50) |
| Size | height 0.78, length 1.06, drawScale 1.0 |

### 5.3 Cow

| Part | Numbers |
|---|---|
| Torso | barrel 0.56 W × 0.54 H × 0.92 L, chamfer 3, chest rounder 0.8, rump rounder 0.5, at (0.02, 0.60, 0); belly 0.33, back 0.87; shoulder and hip bulges as 4.2.3 |
| Neck | `segment` (0.02, 0.72, 0.40) → (0.02, 0.66, 0.60), sections 0.30 → 0.26 |
| Head | wedge back-bottom (0, 0.52, 0.56), length 0.40 (10), 0.34 → 0.28 wide, 0.32 tall (rows 13 to 20); pitch 10° down; the back 0.04 inside the neck |
| Muzzle | box 0.28 W × 0.12 H × 0.12 L at rows 13 to 15, the front three slices, nose tone, 1 proud; nostrils at row 15 |
| Mouth | row 14, width 7; chew frames on rows 13 to 14 |
| Eyes | 5 × 5 wrapped at rows 16 to 20 |
| Horns, forelock | nubs 2 × 2 × 2 at the crown's back corners curving out one voxel; three light voxels between |
| Ears | leaves 5 long × 3 wide × 2 thick at the crown's back corners, sideways and 15° down; pink inner |
| Patches | masks in the dark tone with a one-voxel mid-tone edge: left shoulder (−0.22, 0.66, 0.26) r (0.16, 0.14, 0.18); right hip (0.24, 0.62, −0.30) r (0.14, 0.13, 0.17); saddle (0.10, 0.86, −0.04) r (0.18, 0.06, 0.16) |
| Legs | 4 × 4 × 11 (0.44) at (±0.19, ±0.32), tops 0.11 inside the belly; knee notch; one body tone, no socks; hooves 2 |
| Tail | line (0.02, 0.80, −0.46) → (0.02, 0.44, −0.52), 2 thick, dark tuft 3 × 3 × 3 |
| Collar, bell | ring at (0.02, 0.70, 0.44) rx 0.15 ry 0.13; bell 3 × 3 × 3 under the throat, its top on the ring |
| Garment | square blanket zone z −0.34..0.30, belly line 0.46; scarf at the collar's centre, tails (0.02, 0.56, 0.58) |
| Size | height 0.90, length 1.34, drawScale 1.0 |

### 5.4 Horse

| Part | Numbers |
|---|---|
| Torso | barrel 0.44 W × 0.50 H × 0.96 L, chamfer 3, rounder 1, at (0.02, 0.70, 0); belly 0.45, back 0.95 |
| Neck | `segment` (0.02, 0.86, 0.36) → (0.02, 1.16, 0.62), sections 0.28 → 0.20 (rises 49°) |
| Mane | a ridge 2 wide × 3 tall along the neck's top from the withers to the poll, plus a forelock 3 × 2 × 2 at the crown, in the `mane` tone; at least 48 voxels |
| Head | wedge back-bottom (0, 1.02, 0.58), length 0.44 (11), 0.24 → 0.16 wide, 0.28 tall (rows 26 to 32); level; the back 0.04 inside the neck's top |
| Muzzle, blaze | the front three slices in the nose tone, nostrils 2; blaze two columns wide down the front face |
| Mouth | row 27, width 5; chew frames on rows 26 to 27 |
| Eyes | 5 × 5 wrapped at rows 27 to 31 |
| Ears | 3 wide × 4 tall × 1, upright at the crown's back corners, body tone with one pink inner column |
| Legs | 3 × 3 × 13 (0.52) at (±0.15, ±0.34), tops 0.07 inside the belly; knee notch; socks (light, bottom 3 rows above the hoof) on front-left and back-right only; hooves 2 |
| Tail | line 0.34 long (0.02, 0.86, −0.50) → (0.02, 0.52, −0.60), 2 thick, 3-voxel flare, mane tone |
| Garment | saddle blanket zone z −0.30..0.24, belly line 0.58; scarf at the neck's base (0.02, 0.92, 0.44) rx 0.15 ry 0.14, tails (0.02, 0.76, 0.56) |
| Size | height 1.34 (ear tips), length 1.40, drawScale 1.0 (the tallest, as decided) |

### 5.5 Goat

| Part | Numbers |
|---|---|
| Torso | barrel 0.46 W × 0.48 H × 0.76 L, chamfer 2, at (0.02, 0.60, 0); belly 0.36, back 0.84; a belly fringe of 2-voxel drops every 2 voxels along both belly edges between z −0.30 and 0.30, dark tone |
| Neck | `segment` (0.02, 0.76, 0.32) → (0.02, 0.92, 0.50), sections 0.22 → 0.18 (35° up) |
| Head | wedge back-bottom (0, 0.82, 0.46), length 0.32 (8), 0.24 → 0.16 wide, 0.26 tall (rows 21 to 27), Roman bump 1; level |
| Beard | 3 wide × 4 down × 2 deep under the chin at the front, dark tone, ≥ 18 voxels |
| Horns | two curves, 2 voxels thick, from the crown's back corners, points relative to the crown (±0.07, 0, 0.54), (±0.09, 0.08, 0.50), (±0.12, 0.12, 0.44), (±0.16, 0.12, 0.36), (±0.20, 0.10, 0.30): they rise 0.12 then sweep back and out; horn tones #6B5D50 / #5A4D42 / #473C33 |
| Mouth | row 22, width 5; chew frames on rows 21 to 22 |
| Eyes | the goat variant (horizontal iris) wrapped at rows 22 to 26 |
| Ears | flaps 5 long × 2 wide × 1 thick, drooping 30° from the crown's back corners; pink inner |
| Legs | 3 × 3 × 11 (0.44) at (±0.15, ±0.26), tops 0.08 inside the belly; knee notch; hooves 2 |
| Tail | stub 2 × 2 × 3 up and back at (0.02, 0.80, −0.40) |
| Garment | sweater zone z −0.24..0.22, belly line 0.44 (the fringe shows below it); neck band at (0.02, 0.78, 0.40) rx 0.14 ry 0.12; scarf tails (0.02, 0.64, 0.50) |
| Size | height 1.22 (horn tips), length 1.12, drawScale 1.0 |

### 5.6 Chicken (rebuilt)

| Part | Numbers |
|---|---|
| Torso | three ellipsoids: main radii (0.19, 0.16, 0.26) at (0.02, 0.42, 0); breast (0.16, 0.14, 0.14) at (0.02, 0.38, 0.16), low and forward; rump (0.14, 0.13, 0.12) at (0.02, 0.50, −0.16), high and back: a plump body 0.38 W × 0.36 H × 0.60 L whose top line slopes up toward the tail; belly 0.24, back 0.63 |
| Wings | shells over the flanks (the exposed ±x faces between z −0.16 and 0.12, y 0.32 to 0.52, one voxel proud), trimmed to a teardrop pointing back (the back half two rows lower than the front); dark tone with a one-voxel light edge along the bottom and back; `wingL`/`wingR`, ≥ 30 voxels each |
| Tail | five slabs 2 voxels wide from (0.02, 0.56, −0.24) to (0.02, 0.84, −0.46), spread ±0.26 rad; dark tone, the top two voxels of each slab light |
| Neck | `segment` (0.02, 0.50, 0.22) → (0.02, 0.62, 0.28), sections 0.14 → 0.12 |
| Head | ball radius 0.14 (7 across) at (0.02, 0.66, 0.30): its centre is 0.14 ahead of the breast's front; the back of the ball inside the neck's top |
| Beak | `taperedBox` 0.08 long × 0.06 wide × 0.05 tall, horizontal, at the head's front lower-middle (y 0.62 to 0.66); BEAK tones; wattle 2 × 3 × 1 under it |
| Comb | three 2 × 2 × 2 bumps along the crown from z 0.26 to 0.36 at y 0.80 to 0.84, the middle one a voxel taller |
| Eyes | 4 × 4 wrapped at rows 16 to 19 on the sides at the front |
| Mouth | no parts except `o`: one dark voxel under the beak's tip |
| Legs | 2 × 2 × 7 (0.28) at (−0.04, −0.02) and (0.08, −0.02), tops two voxels inside the belly; BEAK tones; three toes forward, one back |
| Garment | vest: a shell over the top only (zone z −0.16..0.14, cut at y 0.54, above the wings), closing at the neck with its band at (0.02, 0.58, 0.26) rx 0.09 ry 0.08; scarf tails (0.02, 0.50, 0.34); leg warmers rows 2 to 4 |
| Size | height 0.86 (comb), length 0.98 (beak to tail tip), drawScale 1.1 |
| Orientation test | torso L / H ≥ 1.6; the head's centre z is ahead of the torso's front at the head's height; the tail's tip is the model's highest point after the comb |

---

## 6. Animations (every state, every species)

### 6.1 Channels

The existing seventeen (`bodyY, bodyRotX, bodyRotZ, headX, headY, headZ, earL, earR, earBack, eye, puff, legLift, tail, legSwing, squash, legFront, legBack`) plus `neckX` (4.6). The face (`brows, mouth, lids, breath, bubble`) as today. Blends between states stay 150 to 250 ms ease-out; no state is a cut. Signature parts animate by their `anim` tag as today (`snout, wingL, wingR, beard, comb`) plus two new tags: `bell` (swings about its top) and `tailFan` (the chicken's tail spreads by x-scale).

### 6.2 The base table (all species; durations as `DURATION` today)

| State | Body and legs | Head and neck | Face | Ears, tail, extras |
|---|---|---|---|---|
| idle | breath ±2.5% at 1.9 rad/s | head sway ±0.05 rad yaw, pitch ±0.03 | blink every 3.5 to 5 s (120 ms) | ear twitch every 7 s; species idle layer (6.5) |
| thinking | — | head tilt `headZ` 0.15, yaw 0.6 × sway | bubble | one ear up (`earR` −0.4) |
| sleeping | breath at 1.0 rad/s | `headX` 0.2, `neckX` species (6.6) | lids closed, mouth flat | ears down (DROOP + 0.3) |
| grazing | — | `neckX` species, `headX` species (6.6), ±0.03 bob at 3.1 rad/s | chew frames at 200 ms each (grazers); peck or root for the others (6.3) | — |
| proud (1.2 s) | `puff` 1.06, `bodyRotX` −0.05 | `headX` −0.3 (chin up), `neckX` −0.1 | smile; one slow blink at 0.4 to 0.9 s | tail up |
| happy (1.6 s) | two hops: `bodyY` 0.16 × abs(sin) over 0.8 s, `legSwing` 1.5 × hop | — | arc lids, smile | ears up (DROOP − 0.25); tail wag at 12 rad/s × 0.5; bell swings |
| startled (0.9 s) | jump `bodyY` 0.14 for 0.3 s, `legSwing` 0.35 for 0.5 s | `headX` −0.15 | eyes wide (`eye` 1.25), mouth o, brows up | ears back (`earBack` 1) |
| cold (2 s or `coldFor`) | hunch `bodyRotX` 0.12, shiver ±0.01 at 25 rad/s | `headX` 0.25 | brows worried, breath puffs | ears down; the lost garment or tuft blows toward `gustFrom` over 600 ms |
| freezing (2.4 s) | shiver grows to ±0.02, frost fades in | — | eyes closed at the end | — |
| frozen | the ice block, the lean 4° | caught mid-stride pose | — | — |
| thawing (1.2 s) | shake ±0.03 at 20 rad/s, block fades | — | blink twice | ears flap |
| run | trot: front-left with back-right, half-step 110 ms slowing to 70 at full pace, `legSwing` ±28°, `squash` 1 ± 0.015 at the step rate | head bob ±0.02 m | — | ears flap 8°, tail wags |
| jump | anticipation `squash` 0.92 for 80 ms; airborne `legFront` 50°, `legBack` −40°; apex stretch `squash` 1.06 | — | eyes wide, smile | ears up; bell rings |
| land | `squash` 0.90 for 100 ms, six snow particles | — | — | — |
| bonk | recoil 0.25 m, sit (back legs fold, `bodyRotX` 0.26), three stars from 350 ms | `headX` 0.1 | brows worried, mouth o, lids arc for 200 ms | ears back |
| speaking (overlay) | chest up `puff` 1.03 | — | — | tail wags slowly |
| attention (overlay) | — | `headY` toward the speaker, clamped ±0.6 | — | — |

### 6.3 Species deltas (only what differs from the base)

| State | Pig | Cow | Horse | Goat | Chicken |
|---|---|---|---|---|---|
| idle layer | snout sniff: `snout` scale 1.08 twice per 6 s; ears flop ±0.1 with the breath | chew 4 frames every 8 s; tail swish ±0.35 at 1.4 rad/s; ear flick every 9 s | tail swish ±0.45 at 1.6 rad/s; head toss (`headX` −0.25 over 0.5 s) every 9 s; mane still | head tilt `headZ` 0.15 for 1.2 s every 7 s; beard ±0.12 at 2.2 rad/s | head bob `headX` +0.1 × max(0, sin 2.5t); comb wobble ±0.08; tail fan ±4% |
| grazing | rooting: `neckX` 0.25, `headX` 0.35, snout pushes forward 3 × (`headZ` 0 and a 0.03 m z-nudge at 2.6 rad/s); no chew frames | `neckX` 0.35, `headX` 0.30; chew frames | `neckX` 0.55, `headX` 0.15; chew frames; one front hoof paws (`legLift` 0.06) every 4 s | `neckX` 0.30, `headX` 0.30; chew frames; beard swings | peck: `neckX` 0.40 and `headX` 0.45 three times in 1.2 s every 3 s, no chew frames |
| proud | chest up, snout up (`headX` −0.35) | chin up, slow blink | neck arched higher (`neckX` −0.2), ears forward | head high (`neckX` −0.15), one hoof forward (`legFront` 0.3) | chest out (`puff` 1.08), wings half open (0.4 rad), tail fan 1.2 |
| happy | tail curl spins (`tail` sin 30e × 0.8) | one hop only, bell rings | rear: `legFront` −0.5 and `bodyRotX` −0.15 for 0.6 s, mane shake (`headY` ±0.2 at 20 rad/s) | two hops with a twist (`bodyRotZ` ±0.1) | wing flap 0.9 rad at 18 rad/s for 1 s, hop |
| startled | ears straight up | ears back | ears back, tail up | jump sideways (`bodyY` 0.14, x-nudge 0.06) | feathers puff (`puff` 1.1), wings out 0.6 rad |
| cold | — | — | — | — | puff up (`puff` 1.12) and shiver |
| sleeping | ears down | — | `neckX` 0.3 (head lowered) | — | head tucked: `neckX` 0.35, `headX` 0.2 |
| thinking | one ear up | ear flick | ear turns toward the speaker | iris widens (`eye` 1.2) | one eye to the camera (`headY` 0.4) |
| run | trot | trot | trot, mane and tail stream (tail −0.4) | trot | waddle: two legs alternate (`legSwing` ±20° on each), body rolls `bodyRotZ` ±0.08 at the step rate, wings held 0.2 rad |
| jump | — | — | — | — | wings out 0.7 rad while airborne |

### 6.4 Signature-part animations

| Tag | Motion | Where used |
|---|---|---|
| snout | scale 1.08 pulse, twice per 6 s in calm states; a 0.03 m forward nudge in grazing | pig |
| wingL, wingR | rotation about the shoulder root: 0 at rest, 0.2 held in run, 0.4 proud, 0.6 startled, 0.7 airborne, 0.9 × abs(sin 18e) for 1 s in happy | chicken |
| beard | rotation ±0.12 about the chin at 2.2 rad/s in idle and grazing | goat |
| comb | ±0.08 roll at 2.5 rad/s whenever moving | chicken |
| bell | swings about its top: ±0.3 rad decaying over 0.8 s on happy, jump and bonk; ±0.08 in run | sheep, cow |
| tailFan | x-scale 1.0 at rest, 1.2 in proud and happy, 0.9 in cold | chicken |

### 6.5 Idle layers

Every species: breath, blink and the ear twitch as today. The third layer depends on the species: the grazers (sheep, cow, goat, horse) chew four frames every 12 s; the pig sniffs; the chicken bobs and pecks. Each animal keeps its own clock (random phase, rate within ±18%) as today, so a table of six never moves in step.

### 6.6 Ranges (the pose test clamps and checks these)

| Channel | Sheep | Pig | Cow | Horse | Goat | Chicken |
|---|---|---|---|---|---|---|
| headX (down +) | −0.35 to 0.60 | −0.35 to 0.45 | −0.30 to 0.35 | −0.30 to 0.25 | −0.30 to 0.35 | −0.25 to 0.50 |
| neckX (down +) | 0 | 0 | −0.15 to 0.40 | −0.25 to 0.60 | −0.20 to 0.35 | −0.15 to 0.45 |
| headY | ±0.6 | ±0.6 | ±0.6 | ±0.6 | ±0.6 | ±0.8 |
| headZ | ±0.2 | ±0.2 | ±0.2 | ±0.2 | ±0.25 | ±0.25 |
| bodyY | 0 to 0.18 | 0 to 0.18 | 0 to 0.14 | 0 to 0.16 | 0 to 0.20 | 0 to 0.16 |
| squash | 0.90 to 1.06 | 0.90 to 1.06 | 0.92 to 1.05 | 0.92 to 1.05 | 0.90 to 1.06 | 0.88 to 1.08 |
| legSwing | ±0.49 | ±0.49 | ±0.45 | ±0.49 | ±0.49 | ±0.35 |
| ears | DROOP −0.3 to DROOP +0.4 | ±0.5 | ±0.4 | ±0.4 | ±0.5 | 0 |

Hard constraints checked at every sampled frame (test 7.7): no hoof above the belly line; no muzzle voxel below the ground or inside the torso; no ear voxel inside an eye plate; no mouth or lid voxel off the face (4.4); the tail never inside the torso; wings never inside the head.

### 6.7 The dream

The worn avatar runs in Counting Sheep (decision 10.5): `run`, `jump`, `land` and `bonk` apply to every species with the 6.3 deltas; the chicken waddles and flaps.

---

## 7. Tests (new or extended, in `src/skin/voxel/__tests__/animals.test.ts` and `src/skin/table/__tests__/animalPose.test.ts`)

1. **Proportions**: every ratio of 4.1 for every species, printed and range-checked.
2. **Notch**: the side outline test of 4.2.5.
3. **Roots**: every ear, horn, tail, comb, beard, wattle and wing overlaps its parent by two voxels in each touched axis.
4. **Face**: every voxel of every mouth, lid and brow part has a head or muzzle voxel directly behind it; `chewDown` and `o` never fall below the head's bottom row; the chicken's mouth parts are empty except `o`.
5. **Garments**: the shell follows every exposed face in its zone; the belly line leaves the stated share bare; the sweater and vest have a neck band; no garment voxel within two voxels of the head or ears.
6. **Chicken orientation**: 5.6's test.
7. **Pose ranges**: for every species and every state, sample 12 times across the state's duration (or 6 s for the continuous ones) at pace 0 and 1; every channel inside 6.6; every hard constraint of 6.6 holds on the transformed part boxes.
8. **Sheep head**: width > height, the muzzle's bottom above the torso's centre, the head's top within 0.08 of the back line, ears at least 4 voxels long.
9. **Budgets, connectivity, symmetry, eyes, palette, levels, catalogue**: as v5 (unchanged).
10. **Strips**: a test renders nothing, but the viewer (Part 8) exports the strips the acceptance needs.

---

## 8. Viewer and acceptance

- `?preview=lineup` as now (six at level 2, idle, the table's speaker camera), plus `?preview=strips`: for each species a strip of 12 frames of each timed state (proud, happy, startled, cold, freezing, thawing, bonk) and 6 frames of grazing, run and jump, 160 px each, saved to `docs/skin/animals-v5_1/`.
- `?silhouette=1` at 64 px: the two-person naming test that v5 left unrun. Both people name all six; a species missed by both is reworked before F5 closes.
- Acceptance per milestone: all Part 7 tests green; the line-up, the silhouettes and the strips attached; the F0 report re-run with every previously failing number now passing.

---

## 9. Milestones

| Milestone | Scope |
|---|---|
| **F0 Measure** | Part 3 |
| **F1 Faces and the sheep** | 4.4 in the rig (`mouths` takes the bottom row), the face test, the sheep's head (5.1), `neckX` (4.6) with the neck-parented head in `Sheep.tsx`/`Animal.tsx` |
| **F2 Bodies and joins** | pig, cow, horse, goat to 5.2 to 5.5; the connection rules (4.2); garments (4.5); the notch, roots and proportion tests green |
| **F3 Chicken** | 5.6 and its tests |
| **F4 Animations** | 6.2 to 6.6: the base table verified species by species, the deltas, the signature tags (`bell`, `tailFan`), the idle layers, the pose-range test, the strips |
| **F5 Line-up and sign-off** | the six-up, the silhouettes with the two-person test, the dream run for avatars (6.7), the final report with every number |

Prompts: "Read Parts 4 to 7 of @docs/REDESIGN_PLAN_V5_1.md. Do Milestone F<n> exactly as specified. Attach the Part 7 test output and the Part 8 pictures. Report file by file." After each: `npm run build`, `npm test`, the e2e suite in the classic build.

---

## 10. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 10.1 | The sheep's head is rebuilt (blunt, wide, level, sideways ears, the eye standard); the dark Suffolk face stays | a pale face (reads sweeter, loses the breed look) |
| 10.2 | No tongue on any species; chewing is the mouth line moving | a one-voxel pink tongue tip for the cow's "happy" only |
| 10.3 | The horse is 1.34 m tall and 1.40 m long, the largest at the table | shrink it to the cow's size |
| 10.4 | Lives as knitwear stay as v5; shells now follow every exposed face and close at the neck | natural winter coats |
| 10.5 | The worn avatar runs in Counting Sheep | the dream always uses the sheep |
| 10.6 | The cow keeps no socks; the horse keeps two | — |
| 10.7 | The chicken's vest covers the top only, so the wings show | a full vest (hides the wings) |
| 10.8 | The neck channel is added to the shared rig (a small change to `Sheep.tsx`) | grazing by `headX` alone (the horse and cow graze with their skulls) |

---

## 11. In one paragraph

The six avatars keep the rig, the eyes and the knitwear from v5 and are finished by numbers: a proportion sheet per species, necks that are buried three voxels into chest and head with a notch test on the top outline, garments that follow every face of the body and close at the neck, a face rule that keeps every mouth frame on the face so nothing chews below its jaw, a sheep head that is wider than tall with sideways ears and level with its back, a chicken that is a plump horizontal body with a forward head and big flank wings, a neck channel so cows and horses graze with their necks, and one animation table for all fifteen states with species deltas and hard ranges that a test samples frame by frame.
