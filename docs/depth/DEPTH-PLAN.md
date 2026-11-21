# Fleeced: depth, light, palette, ground, new things, trees, sky and life (version 8)

Written 20 November 2026 against the pushed code, v0.9.0 (`origin/main` at `60939f9`). This one file replaces version 7. Save it as `docs/depth/DEPTH-PLAN.md`, and the pictures sent with it (`garden-before-after-v8.jpg`, `garden-and-ripples-v7.jpg`, `cloud-mockups.jpg`, `farm-before-after-v6.jpg`, `new-things-v6.jpg`) beside it. The measuring script is in Appendix A.

## Status

- **M1 (the golden-afternoon light) is built** on the local branch `depth/m1-light`, and its review page passed the legibility checks. Its notes say the bounce light and the soft shading were made stronger than section 4 below. The code on that branch is the truth; this plan does not repeat its numbers.
- **Next: milestone P, the palette (section 3).**
- **New in version 8**, from Brian's note on version 7 (20 November: "the garden just does not look good now, the formatting is really off"): **the kitchen garden is laid out again** on one axis, with six beds of one size in two even columns, one crop per bed in straight rows, and nothing tall inside it; the potting shed, bean frames, scarecrow, birdhouse, compost bin and watering can are dropped (section 7.2, item 1; tested, `garden-before-after-v8.jpg`). The clouds are set aside for now; section 9.3 is unchanged.
- **From version 7**, from Brian's notes on version 6 (20 November):
  - The wind ripples "look too unintentional, but yeah add them there; either add more of them ... or make them bigger": the ripples are now **both denser and bigger** (section 6.4, tested), and the other two versions stay as choices.
  - "Make the farm by the house bigger": the kitchen garden grows from 6 × 4.2 m to **8.5 × 6 m** (section 7.2; its layout was redone in version 8).
  - "Everything looks too unnatural right now": a new rule (section 7.1, rule 7) joins every new thing to the farm, so nothing looks dropped on the snow: a trodden path to it, its own drifts and shade, and a group of related things round it.
  - "Give me 5 mockups of the cloud models": **five cloud styles** were built and rendered in the pond shot (`cloud-mockups.jpg`). Brian picks one; section 9.3 describes all five, and version 5's painted cards are dropped.
- **From version 6:** the stepped, textured snow with every shape planned (section 6); the new things for the empty places (section 7); trees with a slight sway only within budget; no deer, no sparkle.

| Milestone | What | Stop |
|---|---|---|
| M1 | Light (part A, without A4) | Done |
| **P** | **The palette (section 3)** | ■ |
| M2 | Form (B), distance (C), grade (D) | ■ |
| M3 | Cameras (E) | ■ |
| M4 | The ground (section 6), with F1, F3 and F6 | ■ |
| M5 | New things for the empty places (section 7) | ■ |
| M6 | The trees (section 8) | ■ |
| M7 | The sky, the air, ice and light (sections 9.3 to 9.5), with F4 | ■ |
| M8 | Animals and birds (section 9.6) | ■ |
| M9 | Light pools on the snow (A4), then finish | |

■ means: stop after the pull request and wait for Brian's answer on the pairs and decisions.

## 1. Why the farm looked flat (summary)

1. **Light (fixed by M1, B and C):**
   - light wrapped round every block, so every side was equally bright;
   - a very strong, colourless sky fill;
   - the sun stood behind the camera;
   - no shade where things meet;
   - cold white light;
   - no depth with distance;
   - sharp edges with identical cubes.
2. **Not light (fixed by E, F and sections 6 to 9):**
   - cameras at eye level and close;
   - large plains of empty snow, on ground that is one flat layer of one white;
   - nothing gathered round the foot of things;
   - jagged stair-step straw beds;
   - square snowflakes;
   - one pine stamped many times;
   - an empty, still sky;
   - neon bulbs.
3. **Colour (fixed by P):** harsh contrasts between neighbouring colours. Section 2 explains it.

## 2. Why the colours feel harsh

Measured on test renders, with the same light on both sides so only the colours differ. "Lightness" runs from 0 (black) to 1 (white). "Colour strength" runs from 0 (grey) to about 0.2 (neon).

| # | Problem | Example | Measured |
|---|---|---|---|
| H1 | **Too far apart in lightness.** Pure-white snow sits on dark grey roofs; near-black windows sit in white frames; dark fence wood wears white caps; eyes and the dog's and cow's patches are almost black. | Snow 0.96 on slate 0.49; glass 0.35 in a frame of 0.93; eyes 0.19 | Hard edges (a lightness jump over 0.30) cover 4.6 to 7.3% of each picture. The reference: 3.3% |
| H2 | **Red and green both at full strength, side by side.** Opposite colours at full strength "vibrate" where they touch. | Barn red 0.15 next to tree and wreath green 0.11; bulbs at 0.18 to 0.21 | Strongest colour (95th percentile): 0.16 to 0.20 |
| H3 | **Every colour at its own temperature.** A cold blue-grey roof and cold glass on a warm red barn; dead grey stone and iron | Slate hue 264° (blue) on red 29° | — |
| H4 | **Stripes at maximum contrast** | Candy canes: red against near-white. Pines: dark green against pure-white bands | — |
| H5 | **Colours chosen one by one, not as a family** | Animals' beaks, combs and feet at 0.16 to 0.21, stronger than anything else on the farm | — |

A simple example: put a white sugar cube on a black table and the edge "buzzes". Put it on a light wooden table and it looks calm, even though you still see the cube clearly. The new palette moves every pair toward the wooden table.

## 3. Milestone P: the palette

### 3.1 The rules

These seven rules are written for Claude Code. Each comes with an example.

**R1. Warm leads, cool supports.** The light is golden and the shadows lilac (M1). So warm paints (coral red, honey wood, cream, gold) carry about 70% of the picture. Cool paints (sage-teal pines, mauve roofs, blue ice) carry about 20% and sit in the shadow family. Accents carry about 10%.
*Example:* the roof becomes a dusty mauve, a cool colour that belongs to the lilac shadows, instead of a blue-grey that belongs to nothing.

**R2. The scheme is split-complementary around orange.** The warm family runs from 28 to 90° of hue. Its partners are teal-green at 160 to 170° and blue at 215 to 240°. Pure green at 140 to 150° is not used, because against red it vibrates.

**R3. No pure white, no pure black.** Paint lives between lightness 0.28 and 0.95 (0.93 for anything not in the table). The light can still make snow look white and a crevice look dark; the paint never does. Big neighbouring parts differ by at most 0.40 in lightness. Small accents (eyes, buttons, a nose, window glass) may differ more.
*Example:* a snow cap of 0.95 on a roof of 0.56 is a step of 0.39, against 0.50 before.

**R4. The bigger the area, the softer the colour.** Colour strength at most:
- 0.10 for large areas (walls, roofs, snow, trees, ground);
- 0.12 for medium ones (presents, hay, coop);
- 0.14 for small accents (hats, scarves, beaks, the carrot).

Only things that give light (bulbs, lit windows, lanterns, the star) go higher.

**R5. Red leans coral, green leans teal.** Reds sit at hue 28 to 35° with strength 0.125 to 0.13. Greens sit at 160 to 170° with strength 0.065 to 0.085.

**R6. No dead greys.** Every grey takes a little warmth (hue 40 to 70°, strength 0.012 to 0.03). Iron, stone and the dark face colours become warm charcoals and warm greys.

**R7. Soft stripes.** Two colours that alternate in a pattern (canes, pine snow bands, presents' ribbons) differ by at most 0.36 in lightness. The canes go from 0.39 to 0.32; the pine bands from 0.48 to 0.35.

### 3.2 The new colour table

Replace `LADDER` in `src/skin/voxel/paint.ts` with this one. It adds `ink` for eyes and black patches. Every row was made with the ladder's own arithmetic from the chosen step 0:
- lightness moves 0.035 a step;
- colour strength is scaled by `1 − 0.04 × step`;
- steps are capped at lightness 0.95 and floored at 0.26.

```ts
export const LADDER = {
  snow:       ['#D8D2C9', '#E3DDD5', '#EEE9E1', '#F3EEE6', '#F3EEE7'],
  barnRed:    ['#A3412D', '#AD4D3A', '#B75946', '#C06653', '#CA725F'],
  trimWhite:  ['#CEC0AC', '#D9CCB8', '#E4D7C4', '#EFE3D0', '#F9EDDA'],
  slate:      ['#715961', '#7B636B', '#856D75', '#8E7780', '#99828A'],
  wood:       ['#885A33', '#926540', '#9B704C', '#A57B58', '#AF8564'],
  darkWood:   ['#5B3923', '#65432E', '#6E4D38', '#775743', '#81614E'],
  roofBrown:  ['#714B38', '#7A5542', '#84604D', '#8D6A58', '#977563'],
  stone:      ['#867B71', '#90867C', '#9A9087', '#A59B92', '#AFA69D'],
  hay:        ['#CAA153', '#D4AC62', '#DEB870', '#E8C37F', '#F3CF8E'],
  straw:      ['#D0B476', '#DBBF84', '#E5CB91', '#F0D69F', '#FBE2AD'],
  pine:       ['#306A56', '#3D7460', '#497E6A', '#568875', '#62927F'],
  houseCream: ['#C2AA88', '#CDB594', '#D8C0A1', '#E2CCAD', '#EDD7BA'],
  tractorRed: ['#A73F30', '#B14C3C', '#BB5949', '#C46555', '#CE7161'],
  iron:       ['#382E2A', '#413633', '#4A403C', '#544945', '#5D534F'],
  brass:      ['#DBA342', '#E5AE54', '#EFBA64', '#F9C675', '#FFD38F'],
  coopYellow: ['#C8A15E', '#D2AC6C', '#DCB87A', '#E7C388', '#F1CF96'],
  glass:      ['#2B3D4A', '#354653', '#3E505C', '#485965', '#53636F'],
  ice:        ['#98C3CE', '#A4CED9', '#B0D9E4', '#BDE4EE', '#CAF0F9'],
  reed:       ['#656B3E', '#6F754A', '#797F55', '#838961', '#8E946D'],
  scarfRed:   ['#AC473D', '#B65349', '#BF6055', '#C96C61', '#D3786D'],
  carrot:     ['#CC7228', '#D57E3B', '#DF8A4B', '#E9965B', '#F2A26A'],
  wool:       ['#D8CEBE', '#E3D9CA', '#EEE5D6', '#F6EDDF', '#F6EDE0'],
  faceDark:   ['#3B2C2A', '#433533', '#4D3F3C', '#564846', '#5F524F'],
  pink:       ['#D49A95', '#DEA6A0', '#E8B1AC', '#F3BDB8', '#FDC9C4'],
  giftGreen:  ['#2A7656', '#398060', '#478A6B', '#549476', '#619E81'],
  ink:        ['#2D2020', '#2E2221', '#362A2A', '#3F3333', '#483C3C'],
} as const;
```

What changed, step 0 only, in OKLCH (lightness, strength, hue):

| Material | Old | New | Why |
|---|---|---|---|
| snow | #F4F2EE (0.96, 0.006, 85°) | #EEE9E1 (0.935, 0.012, 75°) | A warm cream that the sun lifts to white; never paper-white (R3) |
| barnRed | #B8473A (0.55, 0.15, 29°) | #B75946 (0.575, 0.125, 33°) | Coral brick: softer and warmer, so it no longer shouts against green and white (R4, R5) |
| trimWhite | #EFE8D8 (0.93, 0.023) | #E4D7C4 (0.885, 0.03, 78°) | A warm ivory one step under the snow, so trim against red is no longer a white outline: a gap of 0.31 instead of 0.38 (R3) |
| slate | #5A5F69 (0.49, 0.017, 264°) | #856D75 (0.56, 0.032, 355°) | Dusty mauve. It belongs to the lilac shadows, sits closer to the snow caps (a gap of 0.39 instead of 0.50) and is in the same family as the barn red (R1, R3) |
| wood | #96683F (0.56, 0.08) | #9B704C (0.58, 0.075, 60°) | A touch lighter: fence posts under white caps are a softer step |
| darkWood | #614329 (0.41) | #6E4D38 (0.45, 0.055, 52°) | Trunks and dark doors lifted out of near-black |
| roofBrown | #77573F (0.48) | #84604D (0.52, 0.055, 48°) | Lighter, a little redder, in the barn's family |
| stone | #938E88 (0.65, 0.011) | #9A9087 (0.66, 0.018, 65°) | A warm grey, not a dead grey (R6) |
| hay, straw | #DDB65A, #E6CC86 | #DEB870, #E5CB91 | Strength 0.12 → 0.10 and 0.09 → 0.08: honey, not mustard (R4) |
| pine | #46704C (0.50, 0.074, 148°) | #497E6A (0.55, 0.065, 168°) | Sage-teal: the split-complement of the reds, lighter so its snow bands are a softer stripe (R2, R7) |
| houseCream | #D9C8A7 | #D8C0A1 (0.82, 0.05, 75°) | Slightly warmer |
| tractorRed | #C23E2F (0.17) | #BB5949 (0.58, 0.13, 31°) | The loudest red on the farm, brought into the family |
| iron | #3D3938 (0.35, 0.006) | #4A403C (0.38, 0.016, 40°) | A warm charcoal (R3, R6) |
| brass | #EFBB48 (0.14) | #EFBA64 (0.82, 0.12, 78°) | Gold, not yellow |
| glass | #313C4A (0.35) | #3E505C (0.42, 0.03, 240°) | Windows read as openings without black holes: 0.46 under the frame instead of 0.58 |
| ice | #BFDCE8 (0.035) | #B0D9E4 (0.86, 0.045, 215°) | A little stronger, so warm light cannot turn the pond grey |
| scarfRed | #C24E45 (0.15) | #BF6055 (0.60, 0.125, 28°) | Canes, scarves and presents: a softer red against the ivory |
| carrot | #E6873C (0.146) | #DF8A4B (0.71, 0.13, 55°) | An accent, at the accent ceiling |
| wool | #F2EBDC (0.94) | #EEE5D6 (0.925, 0.022, 80°) | One step under the snow, so a sheep stands out from the snow by its warmth and its shadow |
| faceDark | #433D3C (0.37) | #4D3F3C (0.38, 0.02, 30°) | Warm charcoal |
| pink | #EDB2A9 | #E8B1AC (0.81, 0.065, 25°) | Unchanged in feeling, a little softer |
| giftGreen | #3F8A55 (0.11, 151°) | #478A6B (0.58, 0.085, 162°) | The season's green moved to teal-sage, so a green present beside a red one is calm (R5) |
| ink (new) | — | #362A2A (0.30, 0.018, 20°) | For eyes, pupils, the dog's and cow's black, and any "black". Warm and deep, never `#000` (R3) |

**Where each colour is used does not change.** The step conventions stay: boards 0, −1, 0, +1; posts −1; lower rail 0; upper rail +1; and so on.

Two changes of step:
1. Snow on the pines' shelves uses `snow −1` instead of `snow +1`, so the green-and-white bands are a softer stripe (R7).
2. Candy canes use `scarfRed 0` and `trimWhite +1`, which with the new table is a softer stripe by itself.

### 3.3 Everything not in the table

**Animals, worn things and the eyes.** These come through `shade(hex)` from Brian's sheets. Pass every such colour through one rule before it is used: `harmonize()` in Appendix B. It applies R3 to R6 by arithmetic:
- lightness is clamped to 0.28 to 0.93;
- greys get warmth;
- greens move toward teal and are capped at 0.085;
- blues and purples are capped at 0.10;
- everything else is capped at 0.13.

Every shape and every part's place stays Brian's. Only how loud each colour is changes. For example:
- the hens' beak `#F2D21B` becomes a mustard-gold;
- the comb `#D42A1F` becomes a softer red;
- the eye black `#141212` becomes a deep warm brown;
- the cow's purple blanket keeps its hue and softens a little.

Leave these out of `harmonize()`: bombs and bomb skins, their fuses and sparks, the trophy, and anything that glows. Their strength is part of the gameplay and the shop.

**Bulbs.** These replace the colours in depth plan A3.2. `GLOW` in `src/skin/scene/festive.ts` becomes:
- red `#E8402E` → warm red `#F07A5A`;
- green `#3FBF5F` → sage `#9CCB78`;
- gold `#FFC24B` → warm gold `#FFD08A`.

There are still three colours, so the twinkle groups do not change. If M1 already changed `GLOW`, replace its values with these.

**Lit windows, lantern glass, the star.** Keep their colours; they are light.

**The barn's inside** (decision 4).
- The problem: at the barn table and in Home's inside shot, red walls under orange lanterns become the strongest colour on screen (strength 0.17 to 0.19).
- The default fix:
  1. Faces seen only from inside use `barnRed −1`, at 0.85 of its colour strength.
  2. The lanterns' light colour `LANTERN_LIGHT.color` `#FFB862` becomes `#FFC890`, a less orange amber.
- A condition: if the inside and outside of a wall are the same cubes (one layer), do only step 2, and say so.
- Brian likes the table, so this is a pair.

**The woods, the hills and the land.** The wendigo's pins hash their colours, so they cannot be repainted. Section 3.4 brings them into the palette on screen instead.

**The small scenes** (ice duel, lobby pen, dream, bedroom, podium, leaderboard stage) keep their colours in P. They are night scenes Brian likes. They may follow later as their own pair.

**The interface** is not touched.

### 3.4 A palette pass on the picture

Add these three lines to Home's grade pass. If the grade pass does not exist yet, create it in P; depth plan D adds its own lines in M2. They work on the finished picture, so they reach the woods and hills without changing a cube or a colour in the scene. The pass is off on the paddock shot, as every grade is.

```glsl
// 1. Tame pure greens toward teal (the woods and hills, which cannot be repainted).
float gr = max(0.0, x.g - max(x.r, x.b)); x.g -= 0.45 * gr; x.b += 0.25 * gr; x.r += 0.08 * gr;
// 2. Roll the brightest whites toward warm cream.
float lw = dot(x, vec3(0.2126, 0.7152, 0.0722)); x = mix(x, x * vec3(1.0, 0.975, 0.93), smoothstep(0.75, 1.0, lw) * 0.6);
// 3. Lift the deepest darks to a warm plum, never black.
x = vec3(0.07, 0.05, 0.07) + x * (1.0 - vec3(0.07, 0.05, 0.07));
```

### 3.5 What the test showed

Test renders of Home by day, with the same light and finish on both sides:

| Shot | Hard edges | Strongest colour | Average colour strength | Brightness | Darker than 0.25 |
|---|---|---|---|---|---|
| 0 Doorway | 2.9% → 1.6% | 0.198 → 0.166 | 0.090 → 0.081 | 0.54 → 0.57 | 7.5% → 1.1% |
| 1 Whole farm | 3.4% → 1.9% | 0.097 → 0.088 | 0.044 → 0.042 | 0.73 → 0.74 | 0.2% → 0.0% |
| 3 Inside the barn | 1.9% → 1.2% | 0.188 → 0.169 | 0.117 → 0.106 | 0.51 → 0.53 | 2.8% → 0.9% |
| 4 Hens | 2.4% → 1.6% | 0.125 → 0.110 | 0.064 → 0.061 | 0.54 → 0.55 | 10.2% → 4.0% |
| 7 Pond | 3.5% → 2.2% | 0.122 → 0.109 | 0.047 → 0.048 | 0.72 → 0.72 | 0.7% → 0.2% |

Each cell is before → after, measured with `measure.py`.

What this means:
- The harsh edges roughly halve.
- The loudest colours come down.
- The average colour barely moves and the brightness rises a little. The farm gets calmer, not greyer.
- Very dark areas shrink a lot (on the doorway, from 7.5% to 1.1%), because no paint is near-black any more. That serves the legibility rules too.

The test did not include the barn's inside change or the step changes of section 3.2.

### 3.6 Checks for P

1. **A unit test, `src/skin/voxel/__tests__/paint.test.ts`.** Every `LADDER` colour must obey R3, R4 and R6, using these classes:
   - large: snow, barnRed, trimWhite, slate, wood, darkWood, roofBrown, stone, pine, houseCream, wool, ice;
   - medium: hay, straw, coopYellow, tractorRed, giftGreen, reed, glass, iron;
   - accents: scarfRed, carrot, brass, pink, faceDark, ink.

   Update the existing assertion that `shade(step0, k)` equals the ladder.
2. **A test of neighbour pairs**, in lightness, at the steps they are used at. The values in brackets are the new table's.
   - Big neighbours, at most 0.40:
     - snow +1 against slate 0 (0.39);
     - trimWhite 0 against barnRed 0 (0.31);
     - snow +1 against wood +1 (0.34).
   - Stripes, at most 0.36:
     - snow −1 against pine 0 (0.35);
     - trimWhite +1 against scarfRed 0 (0.32).
   - An accent, at most 0.47: trimWhite 0 against glass 0 (0.46).
3. **Pictures.**
   - Shots 0, 1, 3, 4 and 7 by day, and shot 0 at dusk.
   - The barn table by day and at night.
   - `?preview=mini&sheet=home` and `sheet=kit`, before and after.
   - Measure each with `python3 measure.py edges`, `colour` and `flat` (Appendix A).
4. **Baked pictures.** Animal and worn colours change, so run `npx vite-node tools/bakeStamp.ts -- --check`, bake again with each picture's own tool, and check again. Never stamp by hand.
5. **The wendigo check** after every commit: `npx vite-node tools/scenes/check.ts -- --only wendigo`. P changes no countryside colour; if the check fails, something did. Undo it.
6. **The legibility rules** of section 4 still bind.

| Target | Pass |
|---|---|
| Hard edges on shots 0, 1, 4 and 7 | ≤ 2.5% each |
| Strongest colour (95th percentile) | ≤ 0.17 on every shot |
| Average colour strength | no lower than 0.01 under the before picture |
| Brightness | within 0.03 of the before picture |

### 3.7 Decisions for Brian in P

The plan runs on the defaults.

| # | Decision | Default | Other choice |
|---|---|---|---|
| 1 | Roofs | Dusty mauve `#856D75` | A warm brown-grey `#857266` |
| 2 | Pines and the season's green | Sage-teal | Keep today's green, softened only to 0.07 |
| 3 | Bulbs | Warm red, sage, warm gold | Keep today's red, green, gold |
| 4 | The barn's inside | Softer red and amber lanterns | Unchanged |
| 5 | Animals through `harmonize()` | Yes | Leave the animals as Brian's sheets give them |

## 4. The look and the legibility rules (bind every milestone)

The look is a low golden sun from one side, a lavender sky light, a rose bounce light that lifts every shaded side, a peach haze, a warm horizon and warm amber lamps.

The legibility rules:
1. A shot's average brightness may fall by at most 0.05 from before the milestone (`measure.py flat` prints it).
2. The share of the picture darker than 0.25 may rise by at most 3 percentage points.
3. A white block's shaded side is at least 50% as bright as its lit side.
4. Every piece of Home's text over the scenery reads at 4.5 to 1 or better.

## 5. The remaining milestones

### A4. Warm light pools on the snow (M9; not tested)

1. Add a second single-channel picture beside the ground shade map in `src/skin/voxel/groundShade.ts`: same area and size, with a 1 × 1 black picture as its fallback.
2. For each source, paint `(1 − d / 2.5)²` within 2.5 m. The sources:
   - every `wallLantern` in `MICRO_PLACEMENTS`;
   - the doorway (`DOOR_LIGHT.bounceAt`);
   - the lamp posts and the fire pit of section 7;
   - the foot of every lit window, 0.8 m out from its wall.
3. On ground-level top faces, add `#FFB862 × pool × strength` after the light. Strength: 0.12 by day, 0.2 at dawn, 0.35 at dusk, 0.6 at night.
4. "Ground-level" uses the shade map's own test (`vShadeAt.y < 0.26`), so the pools lie on G1's low steps too.

### B. Form (M2)

**B1. Shade where things meet.**
1. Add three's `GTAOPass` straight after the `RenderPass`, at half the composer's size, blend 0.8. Home only, High tier only; off on the paddock shot.
2. `updateGtaoMaterial`: radius 0.6, distanceExponent 1.5, thickness 1.5, scale 1, samples 16, distanceFallOff 1, screenSpaceRadius false.
3. `updatePdMaterial`: lumaPhi 10, depthPhi 2, normalPhi 3, radius 6, rings 2, samples 16.
4. Budget: at most +2.5 ms a frame on High. If over, try 8 samples; if still over, stop. Never raise `AO_STEP`.

**B2. Rounded edges.**
1. `ROUNDED_VOXELS = true` and `BEVEL = { width: 0.22, strength: 1.2 }`.
2. Outer edges only. **Never** draw a seam round every cube: a test of that turned every wall into bathroom tiles.

**B3. A 3% difference from cube to cube.**
1. Add the option `vary` to `buildGeometry`: a cube's colour × `(1 + vary × r)`, with `r` from −1 to 1 hashed from its cell, the same on every load.
2. Pass 0.03 for these: buildings, fences, props, the micro layer, the yard and orchard trees, animals, worn things, and decorations other than bulbs and the star.
3. Never pass it for these: the snow ground, drifts and path; ice, glass, windows, bulbs, eyes and the letter board; anything from `countryside.ts`, `distance.ts` or `terrainSteps`.
4. Report the extra triangles on shots 0 and 1.

### C. Distance (M2)

1. Tilt-shift on for every Home shot, at strength 0.15.
2. Haze × 1.35: `HAZE_FIT.share` 0.5 → 0.675, `HAZE_FIT.max` 0.014 → 0.019.
3. The paddock shot keeps its own haze and tilt-shift.

### D. Grade (M2)

Into the grade pass, before P's three lines:
1. saturation 1.12;
2. an S-curve: `mix(x, x * x * (3.0 - 2.0 * x), 0.2)`;
3. a vignette: `x *= 1.0 - 0.04 * smoothstep(0.3, 0.85, d)`.

Off on the paddock shot. Because P comes first, check that saturation 1.12 does not break P's ceiling of 0.17 for the strongest colour. If it does, use 1.06.

**Pairs for M2:**
- shots 0, 1, 4 and 7;
- an edges close-up;
- shots 0 and 4 with and without B3;
- the frame times.

### E. Cameras (M3)

**The rule for every shot except the paddock shot:**
- look down 18 to 32°;
- use a lens of 26 to 36°;
- keep the subject in the right half of the frame (the menu covers the left);
- keep the 1.0 m clearance from every voxel;
- keep each push under 2 m.

| Shot | Today | Starting point | Tested |
|---|---|---|---|
| 4 Hens | (−5, 3.6, 12.2) → (−14.6, 0.2, 13.6), lens 34 | (−3.5, 7.5, 10.5) → same target, lens 30 | Yes |
| 7 Pond | (20.5, 1.8, 35.2) → (2, 2.6, 12), lens 40 | (22, 12, 38) → (2, 1.5, 12), lens 36 | Yes |
| 5 Farmhouse | (0, 2.4, 31) → (−25, 3.4, 22), lens 40 | Raise to y 11, lens 34 | No |
| 6 Your sheep | (−0.54, 1.9, 14.2) → (−1.3, 1.1, 8.2), lens 48 | Raise to y 4.5, back 2 m, lens 40 | No |
| 0 Doorway | (−12.5, 7, 23) → (0.6, 1.6, 4.5), lens 26 | Raise to y 10.5 | No |

**Shot 6 needs care.** Brian disliked a long lens close on the sheep on 2026-11-19. Raise the camera; do not narrow the lens below 40°.

**What else applies:**
- Phones follow the same rule.
- Update `src/skin/scene/__tests__/homePov.test.ts` and `homePovFrame.test.ts` for moved shots only; the paddock entries never change.
- For any shot whose frame now holds the wendigo's place, compare the magenta count with `?wendigoDebug` before and after. If it rises, keep that shot's old camera.

### F. Small fixes to the world (M4 and M6; not tested)

No existing model is reshaped, except the pines of section 8. Nothing is added in the country or the land. Nothing new taller than 2.0 m stands in the wedge.

**F1. Snow round the foot of things (M4).** A one-cube collar of `snow +1`, 0.1 m high on the farm's 0.1 m grid, in every free ground cell that touches a fence post, a trunk, a wall's foot, a prop or a micro object. Never on a path, a track, a straw bed or the pond.

**F2. Removed in version 4.** Its low banks are replaced by G1 (section 6.4). Its hoof trails and sled tracks are dropped: `CLAUDE.md` forbids footprints, hoof dents and sled ruts (Brian, 19 November: square marks in the ground "just read as a bug").

**F3. Straw beds as mats (M4).**
1. In `henYard` and `paddockBed`, replace each ellipse with a rounded rectangle of the same area (corner radius 0.6 m).
2. Give each a rim: the outermost ring one cube higher, in `straw −1`.

**F4. Snowflakes (M6).**
1. A round, soft flake: a 16 × 16 circle with a soft edge, as the points' `map`.
2. `sizeAttenuation` on, size 0.06 m.
3. Count × 0.6.
4. Fade out between 3.5 m and 1.5 m from the camera.
5. Tint `#FFF4E8` by day.

**F5. Replaced by section 8.**

**F6. The pond (M4).** If it reads grey, use `ice +1` for the open ice.

## 6. The ground (M4)

### 6.1 The rule: textured, and intentional

This rule binds every item in sections 6 to 9. Brian, 20 November: the stepped snow of version 4 was better than the smooth snow of version 5; its fault was that it "looks too randomized" and "should look intentional". He does not like flat surfaces, and wants texture so the game has more depth.

1. **Texture stays.** The snow is built in visible steps of 0.1 m, as in version 4. The steps catch the light and give the ground depth. A large plain of flat white is a fault.
2. **Intentional means planned.** Every shape follows a cause you could name (the wind, a path, a tree, an object) and one fixed shape for that cause. Nothing comes from a random noise field. Version 4's "waves" (`patches` noise over the whole yard) were the random part; they are removed.
3. **One shape language**, used everywhere:

| Cause | Shape | Example |
|---|---|---|
| Something stands in the west wind | a **drift tail**: a teardrop pointing east, in even tiers, highest next to the object | a tail of three tiers behind each fence post |
| A path is trodden | **banks**: a band either side of the path, one step, then two, then one, the same width all along | the lane runs between two neat banks |
| A tree holds snow off the ground | a **drip-line ring**: one step round the crown's edge, bare ground inside | each pine stands in a neat ring |
| Wind across an open field | **wind ripples**: short, evenly spaced ridges across the wind, staggered like bricks | the pasture and the lawns carry rows of ripples instead of flat white |
| Snow shovelled off a path | a **heap**: a round mound in even tiers | a heap at each side of the court's gate |
| Something buried | a **tiered mound** (G3) | a buried stone, a buried shrub |

4. **Consistent.** The same cause gives the same shape everywhere; two posts of the same size get the same tail.
5. **Clean outlines.** No single-cube islands, notches or specks.
6. **Composed.** Banks and tails run along paths and fences, so they lead the eye toward the farm; ripples fill the open fields, so no plain stays flat.
7. **No holes.** Nothing goes below today's ground top (y = 0). No footprints, hoof dents, ruts or tracks (Brian, 19 November: square marks in the ground "just read as a bug").

**The test for every picture:** for each shape on the ground, can you say why it is there, and does it look placed on purpose? If not, change it.

### 6.2 What is wrong today

The yard's ground is one layer of 0.2 m cubes in one white (`ground()` in `src/skin/scene/yard.ts`). Its top is flat from x −40 to 40 and z −7 to 46. Only the paths (one step darker), the pond's stepped rim and four stepped drifts break it.

### 6.3 Other rules for the ground

They come from `CLAUDE.md`.
1. **The yard's ground only.** No cube of the country or the land is added or removed; nothing behind z = −16 changes; nothing goes in the wedge (`WEDGE` in `farmMicro.ts`) or the paddock box; the paddock shot shows nothing new. Run the wendigo check after every commit.
2. **Nothing new** on the lane, a footpath, the barn's apron, the pond's open ice, the straw beds or the pens.
3. Raised snow is meshed plain (no corner shade, no rounded edges), as the roofs' snow is; otherwise a low slab reads as two stacked planks.

### 6.4 G1. Intentional stepped snow (tested)

Steps of 0.1 m on the yard's 0.2 m grid, at most three steps (0.3 m). The test build's code is Appendix C.

| Shape | Rule | Height |
|---|---|---|
| Drift tails | `lee = max over d = 0.4 … 4.2 m of weight(x − d, z) × (1 − d / 4.4)`; tiers `round(0.45 × lee × (0.35 + 0.65 × clear) / 0.1)` | up to 3 steps |
| Banks | by the distance from the path's edge: under 0.25 m one step, 0.25 to 0.65 m two steps, 0.65 to 0.95 m one step | 1, 2, 1 steps |
| Drip-line rings | between `R − 0.1` and `R + 0.35` m from a tree's trunk, where `R = 0.22 × height`; nothing inside `R − 0.1` (the well) | 1 step |
| Wind ripples (tested) | where the ground is otherwise flat and at least 1.2 m from anything standing and 2.0 m from a path: `u = x + 0.35 sin(z / 2.3 + 1.1)`; a ridge every **1.6 m**, **0.64 m wide** (`frac(u / 1.6) < 0.4`), with a second step along its middle 0.26 m (the middle 40% of the ridge, and not in its last tenth at either end), so each ridge is stepped 1, 2, 1 across; each ridge **7 m long** then a gap of **0.7 m**, the gaps of neighbouring ridges offset by a fixed hash, like brick courses; each ridge's ends bent **0.3 m downwind** (a shallow crescent opening east) | 1 and 2 steps |
| Heaps (not tested) | either side of the court's gate (about x ±2.6, z 16.2) and at the porch walk's east end, each moved the least distance that clears the fences and the canes: round, 1.4 m across, tiers inset 0.3 m | 3 steps |

- `weight` is the ground shade map's raw weight (what stands over each 0.1 m texel, 0 to 1). `clear = 1 − min(1, wide / 0.12)`, where `wide` is the weight blurred by 1.2 m.
- **Ripples, why these numbers:** version 6's ripples (1 step, 0.5 m wide, 2.0 m apart, straight) were too faint and too few, and looked accidental. Brian asked for more of them or bigger ones; both were tested (1.2 m apart; or 3.0 m apart and 1.0 m wide, two steps), and the version in the table, both denser and taller, reads best as a deliberate pattern. Even so, from the whole-farm shot they stay a soft texture, which is what open snow should be (`garden-and-ripples-v7.jpg`).
- **Where never:** within 0.5 m of anything standing; on the lane, a footpath or the apron; on the barn or within 0.6 m of it; in the pens (x −17.4 to −9.8, z 0.4 to 15); in the wedge or the paddock box (x 11.4 to 22.6, z −14 to 7.6); on the pond or its rim (`pondD < 1.32`); under or within 0.1 m of a micro object; within 2.0 m of an animal, 1.6 m of the dog, 2.2 m of the hero, 2.4 m of the season's tree, 0.6 m of a festive part; on or beside a cube of today's drifts and berms (they stay; this was not checked in the test).
- **Clean outlines:** each step level is opened and then closed with a disc of 1 cell; the ripples are added after this, so it does not erase them.
- **Mesh:** one plain mesh, drawn at `scale.y = 0.5` so a step is 0.2 × 0.1 × 0.2 m; `buildGeometry(..., { ao: false, merge: true })`, bevel and downward faces dropped. Casts and receives shadows.
- **The pond's ice (G5)** gets the same treatment: the snow lying on it today is drawn from `patches` noise (random). Replace it with three to five streaks of snow running east–west (with the wind), each 0.6 to 1.2 m wide and 3 to 6 m long, on the east half of the ice.
- **Build** after the yard, the farm, the micro layer and the land have noted their cubes, in the farm's build steps (`scene/slices.ts`), so no frame freezes. Low builds it without the ripples.
- **Budget:** at most 70,000 triangles (version 4's relief, with waves, was 41,922; the denser ripples add more and their count was not logged: measure it, and if it is over, merge each ridge's top into one rectangle); build at most 0.4 s on a laptop in steps of at most 50 ms; frame time on High up by at most 0.5 ms.

### 6.5 G2. Needle beds under the pines (not tested)

Inside every pine's drip-line ring (yard, windbreak, young trees):
1. The ground cubes (y = −1) within `max(0.5, 0.45 × the lowest tier's radius)` m of the trunk take `darkWood +1`: a rusty bed of fallen needles. Its edge is round, its radius fixed by the tree. The top stays at 0.
2. Three to six `pineCone` (G4) on the bed, at angles and distances fixed by the tree's seed.
3. One tree in three: a `twig` on the bed, pointing outward. One tree in two: a `snowClump` at the ring.

### 6.6 G3. Buried things: tiered mounds (not tested)

1. **Buried stones:** six to ten, along the lane's banks and the pasture's edges: round mounds 0.8 to 1.4 m across in two tiers (inset 0.3 m), a `stone` (G4) showing on the west (windward) side of one in two.
2. **Buried shrubs:** along the court's fence and the lane's fence, every 6 to 10 m: mounds 1.2 to 1.6 m across in three tiers, with three to five `twig` tips standing out of the top.
3. Places fixed by a hash of the place; each keeps G1's "where never" list and 1.0 m from every camera's path.

### 6.7 G4. Things that poke through the snow (not tested)

A new small kit on the micro layer's 0.05 m grid. `CLAUDE.md` says to ask before adding a kind; Brian's approval of this plan is that request, for exactly these kinds (and section 7's).

| Kind | Size (0.05 m cubes) | Colours | Where |
|---|---|---|---|
| `grassTuft` (3 variants) | 3 to 5 blades, 1 cube wide, 3 to 6 tall, leaning east | blades `straw −1`, tips `straw 0` | at the west foot of one fence post in three; on the lane's banks every 3 to 5 m, alternately left and right |
| `stone` (2 sizes) | 4 × 3 × 3 and 6 × 3 × 4 | sides `stone 0`, top `snow 0` | on buried stones (G3) |
| `pineCone` | 2 × 3 × 2 | `darkWood +1`, top `snow 0` | needle beds |
| `twig` | 8 to 14 long, 1 wide, a fork of 3; built joined | `darkWood 0` | needle beds; buried shrubs |
| `snowClump` | 4 × 2 × 4, corners cut | `snow +1` | at a pine's ring |
| `stump` | 6 × 5 × 6, cut face set in by 1 | bark `darkWood 0`, cut `wood +1`, cap `snow 0` | about (−29, 26), west of the farmhouse |
| `log` | 32 × 5 × 5 | bark `darkWood 0`, ends `wood +1`, a line of `snow 0` on top | the pond's east bank, between its pines |

Every placement passes `breach()` (`farmMicro.ts`). The layer is `src/skin/scene/groundDetail.ts`, in 8 m chunks, drawn only within 40 m of a shot's camera, never on the paddock shot, not on Low. Budget 25,000 triangles.

### 6.8 Checks for M4

1. The wendigo check after every commit; `npm run check:floating`.
2. A new test, `src/skin/scene/__tests__/groundRelief.test.ts`: nothing on a path, the open ice, the pens, the wedge or the paddock box, or within the animals' distances; nothing below y = 0; no island of a step level smaller than 0.4 m except the ripples, which are exactly the width the rule gives.
3. Budgets: relief ≤ 60,000 triangles, kit ≤ 25,000; frame time on shot 1 (High) up by at most 1 ms.
4. Pictures before and after: shots 0, 1, 4, 5 and 7 and phone shots 1 and 7, by day and at dusk. For each, one line naming the cause of every visible shape (section 6.1's test).
5. Numbers: the flat share (Appendix A) falls by at least 3 points on shots 1 and 5.
6. Movement: three frames across the push of shots 1 and 5; no step edge may crawl.

**Decisions for M4:**

| # | Decision | Default | Other choices |
|---|---|---|---|
| G-a | Wind ripples on the open fields | More and bigger: 1.6 m apart, 0.64 m wide, stepped 1-2-1 | More only (1.2 m apart, 0.4 m wide, 1 step); bigger only (3.0 m apart, 1.0 m wide, 2 steps); none |
| G-b | Buried stones and shrubs | Yes | No |
| G-c | The ground kit | Yes | Cones and stones only |

## 7. New things for the empty places (M5)

### 7.1 The rule

Brian, 20 November: "add more stuff in general to the empty spaces, like the house view." The farm has wide empty areas of snow in most shots; this section fills them with things a real winter farm has. It comes before the trees and the sky because it is the largest change he asked for.

1. **Real and useful.** Each thing is something a farm in winter has, and stands where it is used (`CLAUDE.md`, the farmstead's rules): a kitchen garden by the house, firewood by the door, hives by the orchard.
2. **Built in the farm's style.** Voxels on the farm's 0.1 m grid (refined like the props), one colour per part, parts that touch one step apart. Texture comes from the parts themselves (pickets, planks, log ends, stones in courses), never from noise.
3. **Placed for the shots.** Each item names the shots that see it. Things go where a shot has empty snow, in the half of the frame the menu does not cover, mostly in the middle distance (8 to 15 m from the camera). Nothing stands within 1.0 m of a camera's path or blocks a shot's subject.
4. **The usual limits.** Nothing in the wedge, the paddock box, on the lane, a footpath or the pond's ice; nothing within 1.5 m of an animal or 0.6 m of another model; no string of lights on a fence (`CLAUDE.md`). Every placement passes the micro layer's `breach()` checks or the same checks written for the 0.1 m grid. Move a thing the least distance that passes, and write the move in the review page.
5. **Budget.** All of section 7 together: at most 60,000 triangles, drawn by distance like the micro layer (within 45 m of the camera), never on the paddock shot. Low draws only the garden, the woodpile, the arch and the shelter.
6. **New kit kinds.** Brian's approval of this plan is the request to add every new kind this section names.
7. **Joined to the farm, so nothing looks dropped on the snow** (Brian: "everything looks too unnatural"). Three things, for every new item:
   - **A trodden path to it** from where it is used, added to `WALKS` in `yard.ts` (packed snow, with G1's banks): the walk to the garden's gate and down its middle (x −7.7, z 19.4 to 27.6), the porch to the woodpile (−13.4, 25.0 to −14.2, 26.9), the kitchen door to the clothesline (−21.6, 17.2 to −24.0, 21.5), the bench to the fire pit (10.4, 28.0 to 9.2, 27.4). Tested.
   - **Its own snow:** it notes its cubes in the ground shade map (`noteShade`) before G1 is built, so the ground darkens at its foot and G1 gives it drift tails and banks like everything else; and F1's collar. Tested for the shade and the drifts.
   - **Company:** things stand in groups that belong together, never one alone in open snow: the garden with the porch, the woodpile and the lamp posts; the fire pit with the bench, a log seat and the skates; the hives with the orchard; the woodpile with the porch and a wheelbarrow; the fort with its snowman and snowballs.

The test build blocked out the items marked "tested" with plain boxes (Appendix G) to check the places and sizes; the pictures `farm-before-after-v6.jpg` and `new-things-v6.jpg` show them. Claude Code builds each properly from the descriptions below.

### 7.2 The house view (shot 5)

Today: the farmhouse on the right, and a wide plain of empty snow in front of the porch.

1. **The kitchen garden (tested, 8.5 × 6 m, laid out again in version 8).** In front of the porch, south of the walk to the court's gate: x −11.9 to −3.4, z 22.4 to 28.4. A real winter kitchen garden, big enough to feed the house.
   - **The layout rule:** the garden is drawn on one axis, the line from the gate down the path (x −7.65). Everything is mirrored across it: two columns of beds of one size, every margin and walkway the same width (0.6 m), one crop per bed, plants in straight rows at equal spacing. Nothing inside is taller than the fence's arch, so the garden never covers the porch in shot 5 (`garden-before-after-v8.jpg`). Version 7's mixed sizes, the shed, the scarecrow and the bean frames read as clutter and hid the porch; they are dropped.
   - **Fence:** white pickets (`trimWhite 0`), 0.1 m wide every 0.2 m, 0.7 m tall with a snow cube on each; two rails (`trimWhite −1`) at 0.2 and 0.5 m. **The gate** on the north side, centred on the path (x −8.25 to −7.05), facing the porch's walk: two posts 1.2 m tall (`trimWhite 0`) joined by a beam with snow on it; no gate leaf.
   - **The path:** packed snow 1.0 m wide from the gate to the south fence (x −8.15 to −7.15), the `WALKS` entry at x −7.7, with G1's banks along it.
   - **Six raised beds** of 2.55 × 1.2 m, three either side of the path, running east–west: west column x −11.3 to −8.75, east column x −6.55 to −4.0; rows z 23.0 to 24.2, 24.8 to 26.0, 26.6 to 27.8. Plank frames 0.25 m tall (`darkWood +1`), with a snow layer 0.05 m thick on top, set 0.1 m in from the edge so the plank rim shows all round.
   - **Crops,** one per bed, in two straight rows 0.6 m apart, six plants to a row every 0.4 m: north row, kale (west) and cabbages (east); middle row, leeks (west) and a cold frame (east); south row, cabbages (west) and kale (east), so the beds cross-match like a chequerboard. Kale: a `pine −2` plant 0.2 m square and 0.25 m tall, a `pine −1` leaf on top. Cabbages: a `giftGreen +1` head 0.3 m square and 0.2 m tall, a snow dab on top. Leeks: a white stem (`trimWhite −1`, 0.3 m) and a green fan (`pine 0`, 0.2 m). The cold frame fills its bed: a low front (0.1 m) and a high back (0.25 m) of `wood 0`, sides, and a glass lid (`ice +1`) with snow on its back half.
   - **Nothing else inside.** The tools and compost, if wanted later, go out of sight behind the house, not in the garden.
2. **The woodpile (tested).** Against the porch's south end: x −14.9 to −13.5, z 26.0 to 26.6, 1.0 m tall. Bark `darkWood 0`; log ends `wood +1` in a brick pattern on the south face (a 0.1 m cube every 0.2 m, rows offset); a snow cap. **Add:** a lean-to roof over it (`roofBrown 0`, snow on top) and a wheelbarrow beside it with three logs in it.
3. **Two lamp posts (tested)** along the walk from the porch to the court's gate, 0.7 m south of it, at (−8.6, 20.5) and (−4.4, 19.1): a stone foot (`stone 0`), an iron post 1.8 m (`iron 0`), a lantern of lit glass (`brass +2`, drawn with the lantern glass material) under an iron cap with snow. They glow at dusk and night like the other lanterns, and flicker with them (section 9.5).
4. **The porch (not tested):** a rocking chair (`wood 0`) with a red knitted blanket (`scarfRed 0`) over its arm; two barrels as planters either side of the steps, each holding a small fir bough with a red bow; a pair of boots by the door. New micro kinds `rockingChair`, `planter`, `boots`, in the porch cluster.

### 7.3 The whole farm (shot 1)

1. **A clothesline (tested)** west of the farmhouse: two T-posts (`wood 0`, 1.9 m) at (−24.2, 19.0) and (−24.2, 24.0) with a line (`trimWhite −1`). Three patchwork quilts, each 1.0 × 0.8 m in squares of 0.2 m, from five colours (`scarfRed 0`, `coopYellow 0`, `giftGreen 0`, `trimWhite 0`, `slate 0`) in a fixed order, held by brass pegs. **Add:** two pairs of mittens. In a gust the quilts swing 5° (section 9.4).
2. **A snow fort (tested, rough)** on the south lawn at (−8.0, 35.5): a wall of snow blocks 0.3 m (alternately `snow 0` and `snow +1`, offset like bricks), 2.7 m long and three courses high on the north side, two courses on the east and west, open to the south; crenels on the top course (every second block left out); a pyramid of ten snowballs inside; a red cloth flag on a stick; a small two-ball snowman beside it with a carrot nose and a scarf.
3. **Beehives (tested)** at the orchard's south edge, where they work its blossom: three hives at (−27.4, 11.0), (−26.4, 11.0) and (−25.4, 11.0): a stand (`darkWood 0`), two boxes (`trimWhite −1`, `trimWhite 0`), the entrance slot (`faceDark 0`), a roof (`roofBrown 0`) with snow.
4. **A gate arch (tested)** over the lane's entrance at z 42.6: two posts 0.3 m square, 3.3 m tall, at x −2.2 and 1.9 (`wood −1`); a beam 5.0 m long (`wood 0`); a board 1.8 × 0.6 m (`wood +1`) hanging on two short chains (`iron 0`), with a sheep cut on both faces (`trimWhite 0`, 7 × 4 cubes of 0.1 m); snow on the beam and posts. **Add:** a lantern on each post (no string of lights). Shot 3 sees it framed by the barn's doors.
5. **A sheep shelter (not tested)** in the east pasture at about (28.0, 13.0), its open side facing west toward the flock: three plank walls 4.0 × 2.0 m (`wood 0` and `−1` boards), a lean-to roof (`roofBrown 0`) sloping east with a snow blanket, a hay rack on the back wall (`wood +1`, hay showing), straw on its floor (`straw 0`).
6. **A round-bale feeder (tested, to improve)** in the pasture at (22.0, 16.5): a round bale 1.0 m across and 1.0 m tall (`hay 0`, two bands of `hay −1`, its top in snow) inside a ring of iron bars (`iron +1`: a top and a bottom ring and twelve uprights, 1.3 m across). The test's ring was too thin to read: make the bars two cubes thick and leave a gap between the bale and the ring. Loose hay in a ring 0.4 m wide on the snow round it (`hay −1`).
7. **A dry-stone wall (not tested)** along the lane's west side from z 33 to z 41 (south of shot 5's camera), 0.6 m tall and 0.5 m thick, 0.6 m from the lane's edge, enclosing the south lawn where the fort stands: stones of 0.3 × 0.2 m in courses, offset like bricks, each stone one of `stone −1`, `0` or `+1` in a fixed repeating order (never random), a snow cap on top. It turns the open lawn into a named place and gives the lane a textured edge.

### 7.4 The pond (shot 7)

1. **A fire pit (tested)** for the skaters, beside the pond's bench at (9.2, 27.4): a ring of twelve stones 1.1 m across (`stone 0` and `−1` alternately, 0.2 and 0.3 m tall), two crossed logs (`darkWood −1`), five glowing embers (`carrot +1`, drawn lit), a log seat to the west (`darkWood 0` with snow). **Add:** a thin wisp of smoke (the chimney's puffs, smaller) and a warm pool of light on the snow round it (A4's pools, radius 2.5 m; no real light, which would cost every material a light), flickering (section 9.5).
2. **A sled** leaning against the bench: a smaller copy of the yard's sled (`sled()` in `yard.ts`), as a new micro kind `sledSmall`.

### 7.5 What each shot gains

| Shot | New things in its empty areas |
|---|---|
| 0 Doorway | heaps by the gate (G1), icicles (section 9) |
| 1 Whole farm | the garden, the woodpile, the lamp posts, the clothesline, the hives, the feeder, the shelter (the fort and the wall where the frame reaches them) |
| 3 Inside the barn | the arch, framed by the doors |
| 4 Hens | icicles (section 9) |
| 5 Farmhouse | the garden, the woodpile, the porch, the lamp posts |
| 7 Pond | the fire pit, the sled, the lamp posts |

### 7.6 Checks for M5

1. The wendigo check after every commit; `npm run check:floating`.
2. A test: every item's box is outside the wedge, the paddock box, the lane, the footpaths and the ice; 1.5 m from every animal, 0.6 m from every other model, 1.0 m from every camera's path.
3. Pictures before and after: shots 0, 1, 3, 4, 5 and 7 and the phones' matching shots, by day and at dusk; the review page shows each new item alone (`?preview=mini&piece=<name>`).
4. Triangles before and after; frame time on shot 1 (High) up by at most 1 ms.

**Decisions for M5:**

| # | Decision | Default | Other choice |
|---|---|---|---|
| N-a | The kitchen garden (version 8 layout) | Yes | A smaller garden of four beds |
| N-b | The clothesline, fort, hives, feeder, shelter, wall | All | Choose by name |
| N-c | The arch's board | A carved sheep | A plain board |

## 8. The trees (M6)

### 8.1 What is wrong today

Every pine on the farm is one shape: `tieredPine` with six round tiers, the same width for its height (0.23), the same bare trunk (0.14) and the same snow rings. Only the heights differ, and one tree in three is a step darker. So the 8 yard pines and the 23 windbreak pines read as one tree stamped 31 times.

### 8.2 What may change

| Trees | Built by | Count | Change? |
|---|---|---|---|
| Yard pines | `pine()` in `yard.ts` | 8 | Yes |
| Windbreak | `fieldAndTrees()` in `farmstead.ts` | 23 | Yes |
| Orchard | `bareTree()` in `farmstead.ts` | up to 8 | No: already different tree to tree |
| The season's tree | `festive.ts` | 1 | No: its baubles, star and tests are fitted to its shape |
| Woods and forest | `countryside.ts` | hundreds | No: the wendigo's pins hash them |
| The pen's pines | `pen.ts` | — | No: another scene |

Every new parameter is optional. `countryside.ts`, `festive.ts` and `pen.ts` pass none, and `pinePaint` stays as it is, so their cubes and colours stay identical.

### 8.3 T1. Each pine its own shape (tested)

`genesFor(seed)` gives each pine one of three types:

| Gene | Spire (30%) | Cone (40%) | Round (30%) |
|---|---|---|---|
| Tiers | 7 | 5 or 6 | 4 |
| Width at the foot | 0.17 to 0.20 × height | 0.21 to 0.24 × height | 0.26 to 0.29 × height |
| How fast the tiers narrow (profile) | 1.25: a narrow top | 1.0 | 0.8: a full top |
| Skirt | each tier's rim droops one row | no | no |
| Needles (T2) | spruce | pine | fir |

And for every type: a bare trunk of 0.10 to 0.18 of the height; a lean of the tiers toward +x of 0 or 1 cube (yard) or 1 or 2 (windbreak); each middle tier moved one cube in x, z or both with chance 0.45; the windbreak's west row wind-flagged (the upper tiers lose their west side beyond 0.45 × their radius) and carrying snow only on the east half of each shelf (not tested); a tone of 0 or +1 (never darker, for P's stripe rule); windbreak heights × 0.85 to 1.15.

**Neighbours.** No two pines within 8 m share both type and tone, and no three windbreak trees in a row share a type. If a seed breaks this, step the seed. A test checks it. Code: Appendix D.

### 8.4 T2. Three needle colours (not tested)

| Material | −2 | −1 | 0 | +1 | +2 | Lightness of 0 | Hue |
|---|---|---|---|---|---|---|---|
| pine (P) | `#306A56` | `#3D7460` | `#497E6A` | `#568875` | `#62927F` | 0.55 | 168° |
| spruce (new) | `#4C7466` | `#577E70` | `#63887A` | `#6F9285` | `#7A9D90` | 0.60 | 170° |
| fir (new) | `#30684C` | `#3D7257` | `#487C61` | `#55866C` | `#619076` | 0.54 | 160° |

Both obey P's rules (greens 160° to 170°, strength under 0.10, snow bands within 0.36). If Brian keeps today's green in P, make them from it by the same offsets: spruce lightness +0.045, strength × 0.72, hue +2°; fir lightness −0.008, strength × 1.08, hue −8°. Add both to the `large` class of P's paint test.

### 8.5 T3. Young trees (tested)

Eight small pines at the groves' edges, into `YARD.pines`: (−21.6, 32.2, 2.4), (−16.8, 31.4, 1.6), (−25.8, 24.6, 3.2) by the farmhouse; (−2.8, 44.8, 2.2), (8.2, 44.6, 2.8) at the lane's end; (27.6, 24.6, 2.6), (21.8, 35.8, 1.8), (30.4, 33.4, 3.4) on the pond's far bank (x, z, height in m).

### 8.6 T4 and T5. Birches and holly (not tested)

- **Three birches:** (−26.4, 21.0) 6.4 m and (−27.6, 17.4) 5.2 m west of the farmhouse (keep 1.0 m from the clothesline; move the least distance that passes), and (−6.6, 41.0) 5.8 m at the lane's end. Built like `bareTree`: a straight trunk to 70% of the height, four to six limbs at 50° to 70°, two or three twigs each. Bark `trimWhite 0` with `roofBrown +1` marks on alternating sides every 0.6 to 1.0 m; limbs `darkWood +1`; twig tips `roofBrown 0`; snow along the limbs' tops.
- **Two holly bushes** at the farmhouse's south corners, about (−21.0, 26.6) and (−15.6, 26.6) (the woodpile is at x −14.9 to −13.5: keep 0.6 m from it): a mound 0.9 m wide and 0.7 m tall, leaves `fir −1`, three clusters of three berries `scarfRed +1`, a snow cap `snow −1`.

### 8.7 T6. A slight sway, only if it costs nothing (not tested)

Brian: the trees may sway "slightly if it doesnt lag the game too much".
1. **How:** in the vertex shader only, no work on the processor per frame. Build the yard's pines, the windbreak, the young trees and the birches into their own meshes (one per grove). Store each vertex's height share in one extra attribute. Move a vertex east by `0.015 × share² × sin(t × 0.8 + phase)` m, where `phase` is the tree's seed; the trunk's foot never moves. A gust (section 9.4) doubles it for 2 s.
2. **Budget:** at most 0.2 ms a frame on a laptop's High tier, and no extra draw call beyond the grove meshes. Measure with and without; if it costs more, turn it off and say so.
3. **Not on Low, not under reduced motion, not on the paddock shot.**

### 8.8 Checks for M6

1. The wendigo check after every commit (the countryside's hash must not move); the festive tests; `npm run check:floating`.
2. A test: T1's neighbour rule; no tree cube within 0.6 m of another model; new trees outside the wedge, the paddock, the lane and every camera's 1.0 m clearance.
3. Pictures before and after: shots 1, 5 and 7 and phone shots 1 and 5; each type alone on the review page (add a `seed` parameter to `?preview=mini&piece=pine`, and pieces `birch` and `holly`).
4. The sway's frame time, with and without (section 8.7).

**Decisions for M6:**

| # | Decision | Default | Other choice |
|---|---|---|---|
| T-a | Spruce and fir colours | Yes | One green; shapes alone differ |
| T-b | Birches and holly | Yes | Pines only |
| T-c | Sway | Yes, if within budget | Still trees |

## 9. The sky, the air and life (M7 and M8)

### 9.1 What is wrong today

Home's sky is a two-colour gradient (`Dome` in `src/skin/scene/Sky.tsx`), with snowflakes, and the moon, stars and an aurora at night. Nothing moves except the snow, the chimney smoke, the windmill and the animals' own small poses.

### 9.2 The rule: something alive in every shot

In every Home shot, something moves at least every 3 seconds, and something new happens at least every 15 seconds. Moves are small and calm; events are a little bigger. Nothing flashes or hides the farm. None of it plays on the paddock shot; under reduced motion only the calm moves play. Section 9.7 lists what each shot gets.

### 9.3 S1. The sky and the clouds (tested; M7)

The dome gets three colours and the sun's glow (tested). The clouds are Brian's pick of five (below).

**The dome.** A shader on `Dome`'s sphere: three colours from the horizon up (`mix(horizon, middle, smoothstep(−0.02, 0.25, y))`, then `mix(…, top, smoothstep(0.2, 0.9, y))`), plus the sun's glow `glow × (c³ × 0.22 + c²⁰ × 0.3 + c⁶⁰⁰ × 1.4) × (1 − 0.4 × smoothstep(0, 0.6, y))`, where `c` is how closely the direction points at the sun, read each frame from the scene's shadow-casting light. Tone mapping and colour space as every material.

| Hour | Top | Middle | Horizon | Glow | Cloud tint | Cloud opacity |
|---|---|---|---|---|---|---|
| Day | `#5E9AD6` | `#9CC4EA` | `#F2DCCB` | `#FFD7A6` | `#FFFFFF` | 1 |
| Dawn | `#7F9DCC` | `#C6B6D6` | `#F6CDB6` | `#FFC79E` | `#FFE6DA` | 1 |
| Dusk | `#4E5692` | `#A88BB8` | `#F3A985` | `#FFB078` | `#F7BFAE` | 1 |
| Night | `#0E1834` | `#1C2B52` | `#2D406B` | `#3A4B7A` | `#4E5A86` | 0.75 |

If M1's built sky colours differ, keep M1's horizon and top and add only the middle and the glow.

**Clouds: Brian picks one of five.** He disliked version 4's blocky clouds and version 5's painted cards. Five styles were built and rendered in the pond shot with the same sixteen clouds, the same light and the same sky (`cloud-mockups.jpg`; Appendix E has the tested code). Every style uses the same cloud shape: a cumulus of seven lobes (a tall middle lobe, two shoulders, two small ends, two bumps on top) on a long, flat base, 50 to 85 m long and 14 to 22 m tall.

| # | Style | How it is built | What it looks like |
|---|---|---|---|
| 1 | **Toon puffs** | Smooth spheres for the lobes and a flattened sphere for the base, `MeshToonMaterial` with a three-step light map (85, 165, 232 of 255), colour `#D8D4DC`, the haze as a faint emissive | Round and soft, lit by the real sun: warm cream by day, pink at dusk |
| 2 | **Low-poly** | The same lobes as faceted icosahedra (one subdivision, corners moved by up to 5%), flat-shaded Lambert | Faceted lumps, like the low-poly models |
| 3 | **Paper cut-outs** | Each cloud's outline as one flat shape, in two layers (a white front `#FFFBF4`, a lilac back `#D9D1EE` set 3 m right and 4 m up) and a soft shadow layer; unlit, turned to face the farm | Crisp flat paper, like a pop-up book |
| 4 | **Fine voxel** | The lobes and base filled with 1.5 m cubes, with corner shading; top, side and bottom rows in three tones | Voxels, but small enough to read as a soft lump |
| 5 | **Pixel art** | Each cloud painted at 72 × 30 pixels with hard edges, three shades and a dithered underside, on a card with nearest-pixel filtering | Retro pixel clouds |

The plan's default, until Brian picks: **1, toon puffs**, because it is lit by the scene's own sun and so changes with the hour by itself, and it reads as soft without blur. (In the test, styles 1, 2 and 4 needed a colour well under white, `#D8D4DC`, or the sun pushed them past white into a glow.)

Whichever he picks:
1. **Place:** fourteen to sixteen clouds in a ring 280 m from the farm's middle (beyond the mountains), 6° to 20° above the horizon, spread so that every shot whose frame holds sky shows three to five. The mockups placed seven clouds in the pond shot's view to compare the styles; the real placement spreads them round the whole sky.
2. Fog off; drawn after the dome; the mountains hide what is behind them. The ring turns 0.0012 rad/s; still under reduced motion.
3. **Keep them out of M2's corner-shade pass (GTAO):** a flat card there becomes a dark rectangle (seen in version 5's test). Hide the clouds, and every effect of section 9.4, for that pass only.
4. Home only, never on the paddock shot (it keeps today's `Dome`). At most 20,000 triangles and one or two draw calls.
5. **By hour:** 1, 2 and 4 are lit by the scene, so they follow the hour by themselves; 3 and 5 take a tint (dawn `#FFE6DA`, dusk `#F7BFAE`, night `#4E5A86` at 75%).

**At night:** a shooting star every 20 to 40 s; a soft halo round the moon (3 × its size, `#F4F1E4` at 18%).

### 9.4 S2. The air (not tested; M7)

1. **Snowflakes** (F4): round, soft, fading near the camera.
2. **Gusts** every 6 to 12 s, west to east. Each drives: a puff of 40 to 80 snow points off one pine's tier, the barn's ridge or a drift's crest within 35 m and in frame (drifting 2 to 4 m east, fading over 2.5 s); two or three low streams of spindrift over the open ground (shots 1, 5 and 7); the trees' sway (T6) and the quilts on the clothesline; **the weathervane**, whose arrow and fins (the cupola's last three `b.box` lines in `farmstead.ts`, rows `top + 4` to `top + 6`) become their own mesh turning ±25° about the rod.
3. **Snow slides off a roof** every 40 to 80 s on the barn or the farmhouse: 60 to 120 points tip off a 0.6 to 1.2 m run of the eave and puff where they land. The roof's snow itself does not change.
4. **Breath.** Every animal on Home, and the hero, breathes out a small cloud every 3 to 5 s, each on its own rhythm: 6 to 10 soft white points rising 0.15 m and fading over 1.2 s.
5. **Smoke** from the chimney and the fire pit leans further east during a gust.

### 9.5 S3. Ice and light details (icicles tested; M7)

1. **Icicles (tested).** Under every roof edge where the snow overhangs (a roof-snow cube at least 1.6 m up with nothing in the three cells under it): 62% of edge cubes get one icicle and a quarter of those two, 0.1 to 0.55 m long (most short), the top third 2 × 2 cubes of 0.05 m and the rest 1 × 1, `ice +1` with an `ice +2` tip. Appendix F has the tested code. The test made 34,160 triangles from 720 edge cubes: build with `merge`, only on eaves some shot sees; budget 12,000.
2. **Drips:** in sunlight, one icicle in frame drops a bright point every 2 to 4 s.
3. **Frost** in the two lower corners of every lit window's pane: a triangle of `trimWhite +1` cubes at 0.05 m, 3 to 5 cubes a side.
4. **Lamps that live:** lanterns, lit windows, the lamp posts and the fire pit flicker by ±6% (the fire pit ±15%), each on its own smooth rhythm of 0.5 to 1.5 Hz; never a blink.
5. **Dust in the doorway (shot 3):** thirty slow warm motes (`#FFE2B0`) in the light of the barn's open doors.

### 9.6 S4. Animals and birds (not tested; M8)

1. **A flock of crows:** five to seven in a loose V crossing the sky every 45 to 70 s, 20 to 28 m up, at 12 m/s, west to east; each on the 0.05 m grid (body 6 × 3 × 3, wings 5 × 1 × 3, `ink +1`), two frames flapping three times a second, gliding 1 s in 4; six fixed paths 10 m or more from every camera.
2. **Two small birds on the fence:** a red cardinal (`scarfRed +1`, an `ink +1` mask) and a chickadee (`trimWhite 0`, an `ink +1` cap), each 3 × 3 × 5 cubes, on the court fence's top rail where shot 7 sees it clear of the sheep. They hop and peck; every 30 to 50 s one flies off and returns 6 s later.
3. **Two rabbits** in the pasture's open snow: 6 × 5 × 8 cubes at 0.05 m, `roofBrown +1` with a `trimWhite 0` tail and inner ears, `ink +1` eyes. They sit, twitch an ear, hop 1 to 3 m, sit again; never within 3 m of the dog or the sheep; no tracks.
4. **A cat on the porch:** ginger (`carrot −1`, `trimWhite 0` chest and paws), curled asleep on the boards clear of the porch's objects, 0.45 m long; its tail tip flicks every 4 to 8 s; once a minute it lifts its head. Shot 5 sees it.
5. **The farm's own animals:** the sheepdog gets up every 40 to 70 s, trots a wide loop round the flock (8 to 12 s) and lies down again (split its legs into four meshes if they are not separate, ±25° at a trot); two of the pasture sheep walk 1 to 2 m to a new spot every 30 to 60 s with the existing `walk` pose, staying within 2 m of their places in `LIVESTOCK` (widen G1's clearance to 3.5 m for those two); the hens peck in turns, and one now and then flaps its wings.
6. Every animal and bird stays out of the wedge, the paddock (but its own animals), every path and every camera's 1.0 m clearance, and is hidden on the paddock shot.

No deer (Brian, 20 November). No sparkle on the snow (the same day: "unnecessary").

### 9.7 What each shot gets

| Shot | Calm moves (at least every 3 s) | Events (at least every 15 s) |
|---|---|---|
| 0 Doorway | bulbs twinkle, the hero's breath, lamps flicker, flakes | a snow puff off the barn's ridge, an icicle drips, snow slides off the side roof |
| 1 Whole farm | smoke, sway, the sheep graze, flakes | the crow flock, the dog's loop, a sheep walks, spindrift, the quilts swing |
| 3 Inside the barn | dust in the doorway, the table's game | snow blows past the open doors |
| 4 Hens | hens peck, breath, lamps flicker | a hen flaps, an icicle drips, a gust puff |
| 5 Farmhouse | smoke, sway, clouds drift, the cat's tail, the lamp posts flicker | the crow flock, snow puffs off the pines, snow slides off the roof |
| 6 Your sheep | breath, flakes, bulbs | a gust and its puff |
| 7 Pond | clouds, breath, the fire pit flickers and smokes, the fence birds hop | the crow flock, a sheep walks, the dog's loop, a fence bird flies off and back |
| 2 Paddock | today's, unchanged | none |

### 9.8 Checks for M7 and M8

1. The wendigo check after every commit. On the paddock shot nothing of section 9 is drawn (a test of the switch), and the magenta count with `?wendigoDebug` is unchanged.
2. Frame time on High up by at most 1.0 ms for all of section 9; at most 12 more draw calls. Every particle effect is one draw call, parked at zero size when idle.
3. Pictures: shots 5 and 7 and phone shot 7 at day, dawn, dusk and night (M7); a 10-second clip of every shot (M7 and M8), counting section 9.2's moves and events.
4. The title and menu stay readable over the sky (section 4, rule 4). Under reduced motion only the calm moves play.

**Decisions for M7 and M8:**

| # | Decision | Default | Other choices |
|---|---|---|---|
| S-a | The clouds' style (`cloud-mockups.jpg`) | 1, toon puffs, until Brian picks | 2 low-poly; 3 paper cut-outs; 4 fine voxel; 5 pixel art; none |
| S-b | Gusts, sliding snow, breath | All | Breath only |
| S-c | Icicles, frost, flicker, dust | All | Icicles only |
| S-d | Crows, fence birds, rabbits, the cat | All | Birds only |
| S-e | The dog's loop and the walking sheep | Yes | No |

## 10. What must not change

- **The wendigo.** On the paddock shot, every tier keeps its light, haze, tone mapping, exposure, shadows and tilt-shift through `exemptShot()`. It gets no grade, no corner shade, no bounce light and no camera change. No cube or colour of the country or the land changes. Run `npx vite-node tools/scenes/check.ts -- --only wendigo` after every commit; if it fails, undo and stop. Never edit the pins.
- **The ground is textured and intentional** (section 6.1): stepped, every shape planned, nothing from random noise.
- **No holes in the ground.** Nothing goes below today's ground top; no footprints, dents, ruts or tracks.
- **The season's tree, the country's trees and the pen's pines** keep their shapes and colours; `pinePaint` stays as it is.
- **No rule, timer, bot, score, word list, network call, save or interface change.**
- Branches, commits and pushing follow `CLAUDE.md`. The full gate runs once, at the end.

## 11. The prompts for Claude Code

```text
Read CLAUDE.md to its last line, then docs/depth/DEPTH-PLAN.md whole, then every file the milestone edits, whole.
Do milestone P (the palette, section 3) and nothing else. Use the colour table exactly as written. Render the
pictures section 3.6 lists, open every one, measure them with measure.py (Appendix A), check section 3.6's targets
and section 4's legibility rules, and put the pictures and numbers in the review page and the pull request.
After every commit run: npx vite-node tools/scenes/check.ts -- --only wendigo. If it fails, undo and stop.
Never change a colour of the country, the land or anything behind z = -16. Stop after P and wait for Brian.
```

**For M4 to M8**, one at a time, only after Brian has answered the milestone before. Replace `<M>` and `<section>`:

```text
Read CLAUDE.md to its last line, then docs/depth/DEPTH-PLAN.md whole, then every file the milestone edits, whole.
Do milestone <M> (section <section>) and nothing else, on its own branch. Use the numbers, places and colours as
written; where the plan says "move the least distance that passes", do that and write the move in the review page.
Items marked "not tested" are new: build each, look at it in a picture, and say in the review page what you saw.
Judge every picture by section 6.1 (textured and intentional), section 7.1 (new things placed for the shots) and
section 9.2 (something alive in every shot).
Run the section's checks, render its pictures, open every one, measure them with measure.py (Appendix A), and put
the pictures, numbers and budgets in the review page and the pull request. After every commit run:
npx vite-node tools/scenes/check.ts -- --only wendigo. If it fails, undo and stop. Never dig into the ground, never
change the country, the land, the season's tree or anything behind z = -16. Stop after <M> and wait for Brian.
```

## Appendix A. `measure.py`

Save as `tools/depth/measure.py`. It needs Pillow and NumPy (`pip3 install pillow numpy`).

```python
#!/usr/bin/env python3
"""The depth plan's measures. Every picture is first scaled to about 264,000 pixels so any size compares.

    python3 measure.py flat <picture> ...     flat area, brightness, and the share darker than 0.25
    python3 measure.py edges <picture> ...    hard edges: share of pixels where lightness jumps over 0.30 across 2 px
    python3 measure.py colour <picture> ...   average colour strength and the strongest colour (95th percentile)
    python3 measure.py faces <picture> <x,y> <x,y> ...   brightness of points (median of 5 x 5) against the brightest
"""
import sys

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image


def load(path, scale=True):
    im = Image.open(path).convert('RGB')
    s = (264000 / (im.width * im.height)) ** 0.5
    if scale and s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return np.asarray(im).astype(np.float64) / 255


def linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(a):
    r, g, b = linear(a[..., 0]), linear(a[..., 1]), linear(a[..., 2])
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def brightness(a):
    lum = 0.2126 * linear(a[..., 0]) + 0.7152 * linear(a[..., 1]) + 0.0722 * linear(a[..., 2])
    return lum ** (1 / 2.2)


def flat(path):
    lp = brightness(load(path))
    share = (sliding_window_view(lp, (5, 5)).std(axis=(-1, -2)) < 0.006).mean()
    print(f'{path}: flat {share:.1%}  brightness {lp.mean():.2f}  darker than 0.25 {(lp < 0.25).mean():.1%}')


def edges(path):
    L, _, _ = oklab(load(path))
    jump = np.maximum(np.abs(L[:, 2:] - L[:, :-2])[1:-1, :], np.abs(L[2:, :] - L[:-2, :])[:, 1:-1])
    print(f'{path}: hard edges {(jump > 0.30).mean():.2%}')


def colour(path):
    _, A, B = oklab(load(path))
    C = np.hypot(A, B)
    print(f'{path}: average colour strength {C.mean():.3f}  strongest colour {np.percentile(C, 95):.3f}')


def faces(path, points):
    a = load(path, scale=False) * 255
    rows = []
    for p in points:
        x, y = (int(v) for v in p.split(','))
        c = np.median(a[y - 2:y + 3, x - 2:x + 3].reshape(-1, 3), axis=0)
        lum = float((0.2126 * linear(c[0] / 255) + 0.7152 * linear(c[1] / 255) + 0.0722 * linear(c[2] / 255)))
        rows.append((p, c, lum))
    top = max(r[2] for r in rows)
    for p, c, lum in rows:
        print(f'{p:>10}  rgb {tuple(int(v) for v in c)}  {lum / top:5.0%} of the brightest')


if __name__ == '__main__':
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 2 else (None, [])
    if cmd == 'faces':
        faces(args[0], args[1:])
    elif cmd in ('flat', 'edges', 'colour'):
        for p in args:
            {'flat': flat, 'edges': edges, 'colour': colour}[cmd](p)
    else:
        print(__doc__)
        sys.exit(1)
```

## Appendix B. `harmonize()` for `src/skin/voxel/paint.ts`

Use the file's existing `toOklab` and `toHex`. Call it inside `shade()` before `shadeHex`, except for the exempt colours of section 3.3. Pass those through a flag or a separate `shadeRaw()`.

```ts
/** Brings a colour from a sheet into the palette (docs/depth/DEPTH-PLAN.md, section 3.1, rules R3 to R6). */
export function harmonize(hex: string): string {
  const [L0, a0, b0] = toOklab(hex);
  const L = Math.min(0.93, Math.max(0.28, L0));
  let C = Math.hypot(a0, b0), h = (Math.atan2(b0, a0) * 180) / Math.PI;
  if (h < 0) h += 360;
  if (C < 0.025) { h = 55; C = Math.max(C, 0.012); }                     // R6: no dead greys
  else if (h >= 115 && h <= 165) { h += (168 - h) * 0.6; C = Math.min(C, 0.085); }  // R5: greens toward teal
  else if (h >= 200 && h <= 320) C = Math.min(C, 0.1);                   // blues and purples
  else C = Math.min(C, 0.13);                                            // R4: warm accents
  const r = (h * Math.PI) / 180;
  return toHex(L, C * Math.cos(r), C * Math.sin(r));
}
```

It was tested in this form on every `shade()` colour, bombs included. The exemptions of section 3.3 come from the plan, not the test.

## Appendix C. Intentional stepped snow (G1, tested)

The test build's code, with its switches taken out. `groundShade.ts` must first export:

```ts
/** The raw weight of what stands over each texel (read-only), and the box blur, for the stepped snow. */
export const shadeWeight = (): Float32Array | null => weight;
export const shadeBlur = (src: Float32Array, radius: number, times: number) => blur(src, radius, times);
```

```ts
import type { BufferGeometry } from 'three';
import { buildGeometry, packGeometry } from '../voxel/mesher';
import { Grid } from '../voxel/primitives';
import { solid } from '../voxel/paint';
import { SHADE_AREA, shadeBlur, shadeWeight } from '../voxel/groundShade';
import { inWedge, underMicro } from './farmMicro';
import { onWalk, pondD } from './yard';
import { BARN, YARD } from './layout';
import { FLOCK_DOG, LIVESTOCK } from './livestock';
import { buildFestive } from './festive';
import { FARM } from './farmstead';

const S = 0.2;
/** The ripple versions tested; the plan's default is `both` (decision G-a). */
const RIPPLE_KIND = 'both';
const RIPPLE: Record<string, { spacing: number; width: number; len: number; gap: number; steps: number; bend: number }> = {
  base: { spacing: 2.0, width: 0.25, len: 6, gap: 0.9, steps: 1, bend: 0 },
  more: { spacing: 1.2, width: 0.34, len: 9, gap: 0.5, steps: 1, bend: 0.15 },
  big: { spacing: 3.0, width: 0.34, len: 7, gap: 1.0, steps: 2, bend: 0.4 },
  both: { spacing: 1.6, width: 0.4, len: 7, gap: 0.7, steps: 2, bend: 0.3 },
};
/** G1: stepped snow in planned shapes: drift tails, path banks, drip-line rings, wind ripples (docs/depth/DEPTH-PLAN.md, section 6.4). */
/** `trees`: every pine as [x, z, height]. */
export function buildIntentional(trees: [number, number, number][], o = { lee: 0.45, ripple: true }): { geo: BufferGeometry; cells: number } | null {
  const w = shadeWeight();
  if (!w) return null;
  const blur = shadeBlur;
  const near = blur(w, 6, 2), far = blur(w, 12, 2);
  const T = SHADE_AREA.texel, NX = Math.round(SHADE_AREA.w / T), NZ = Math.round(SHADE_AREA.d / T);
  const at = (a: Float32Array, x: number, z: number) => {
    const i = Math.floor((x - SHADE_AREA.x) / T), k = Math.floor((z - SHADE_AREA.z) / T);
    return i < 0 || k < 0 || i >= NX || k >= NZ ? 0 : a[k * NX + i];
  };
  const festive = buildFestive().parts;
  const keepOff: [number, number, number][] = [...LIVESTOCK.map(([, x, z]) => [x, z, 2.0] as [number, number, number]), [FLOCK_DOG[0], FLOCK_DOG[1], 1.6], [0, BARN.maxZ + 1.2, 2.2], [-4.2, BARN.maxZ + 2.2, 2.4]];
  const pathy = (x: number, z: number) => (z >= YARD.path.fromZ && Math.abs(x) <= YARD.path.halfWidth + 0.05) || onWalk(x, z) || (z >= YARD.path.fromZ && (x / 4.4) ** 2 + ((z - YARD.path.fromZ) / 3.2) ** 2 < 1);
  const X0 = Math.round(YARD.minX / S), Z0 = Math.round(-6.6 / S), W = Math.round(YARD.maxX / S) - X0, D = Math.round(YARD.maxZ / S) - Z0;
  // distance to the nearest path, in cells (two-pass chamfer)
  const INF = 1e9, dist = new Float32Array(W * D).fill(INF);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (pathy((x + X0 + 0.5) * S, (z + Z0 + 0.5) * S)) dist[z * W + x] = 0;
  const pass = (fw: boolean) => {
    for (let zz = 0; zz < D; zz++) for (let xx = 0; xx < W; xx++) {
      const z = fw ? zz : D - 1 - zz, x = fw ? xx : W - 1 - xx, i = z * W + x, s = fw ? -1 : 1;
      let d = dist[i];
      const nb = (dx: number, dz: number, c: number) => { const a = x + dx, b = z + dz; if (a >= 0 && b >= 0 && a < W && b < D) d = Math.min(d, dist[b * W + a] + c); };
      nb(s, 0, 1); nb(0, s, 1); nb(s, s, 1.414); nb(-s, s, 1.414);
      dist[i] = d;
    }
  };
  pass(true); pass(false);
  const level = new Uint8Array(W * D), allowed = new Uint8Array(W * D), rip = new Uint8Array(W * D);
  const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  for (let xi = X0 + 2; xi < X0 + W - 2; xi++)
    for (let zi = Z0; zi < Z0 + D - 2; zi++) {
      const x = (xi + 0.5) * S, z = (zi + 0.5) * S, i = (zi - Z0) * W + (xi - X0);
      if (x > BARN.minX - 0.6 && x < BARN.maxX + 0.6 && z > BARN.minZ - 0.6 && z < BARN.maxZ + 0.6) continue;
      if (inWedge(x, z) || (x > 11.4 && x < 22.6 && z > -14 && z < 7.6)) continue;
      if (x > FARM.run.minX - 0.3 && x < FARM.run.maxX + 0.3 && z > FARM.sty.minZ - 0.3 && z < FARM.run.maxZ + 0.3) continue;
      if (dist[i] === 0 || pondD(x, z) < 1.32 || underMicro(x, z)) continue;
      if (keepOff.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)) continue;
      if (festive.some((p) => x > p.min[0] - 0.6 && x < p.max[0] + 0.6 && z > p.min[2] - 0.6 && z < p.max[2] + 0.6)) continue;
      if (at(w, x, z) > 0.001 || at(near, x, z) > 0.04) continue;
      const clear = 1 - Math.min(1, at(far, x, z) / 0.12);
      allowed[i] = 1;
      // tree wells and the ring at the drip line
      let well = false, ring = false;
      for (const [tx, tz, th] of trees) { const d = Math.hypot(x - tx, z - tz), R = 0.22 * th; if (d < R - 0.1) well = true; else if (d < R + 0.35) ring = true; }
      if (well) continue;
      let lee = 0;
      for (let d = 0.4; d <= 4.2; d += 0.2) lee = Math.max(lee, at(w, x - d, z) * (1 - d / 4.4));
      let n = Math.min(3, Math.round((o.lee * lee * (0.35 + 0.65 * clear)) / 0.1));
      const pd = dist[i] * S; // metres from the path
      if (pd < 0.25) n = Math.max(n, 1); else if (pd < 0.65) n = Math.max(n, 2); else if (pd < 0.95) n = Math.max(n, 1);
      if (ring) n = Math.max(n, 1);
      level[i] = n;
      // wind ripples: long north-south ridges across the open snow, gently curving, broken into staggered lengths
      if (o.ripple && clear > 0.999 && pd > 2.0 && n === 0) {
        const RV = RIPPLE[RIPPLE_KIND];
        const u0 = x + 0.35 * Math.sin(z / 2.3 + 1.1), r = Math.floor(u0 / RV.spacing);
        const along = z + hash(r) * RV.len, seg = along - Math.floor(along / RV.len) * RV.len;
        if (seg > RV.gap) {
          const q = ((seg - RV.gap) / (RV.len - RV.gap)) * 2 - 1, ph = (u0 - RV.bend * q * q) / RV.spacing - r; // the ends bend downwind: a crescent
          if (ph >= 0 && ph < RV.width) rip[i] = 1;
          if (RV.steps > 1 && ph >= RV.width * 0.3 && ph < RV.width * 0.7 && Math.abs(q) < 0.8) rip[i] = 2;
        }
      }
    }
  const R = 1;
  const morph = (m: Uint8Array, grow: boolean) => {
    const out = new Uint8Array(m.length);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let dz = -R; dz <= R && v === (grow ? 0 : 1); dz++) for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx, zz = z + dz, inside = xx >= 0 && zz >= 0 && xx < W && zz < D ? m[zz * W + xx] : 0;
        if (grow && inside) { v = 1; break; }
        if (!grow && !inside) { v = 0; break; }
      }
      out[z * W + x] = v;
    }
    return out;
  };
  const final = new Uint8Array(W * D);
  for (let k = 1; k <= 3; k++) {
    let m = new Uint8Array(W * D);
    for (let i = 0; i < m.length; i++) m[i] = level[i] >= k ? 1 : 0;
    m = morph(morph(m, false), true);
    m = morph(morph(m, true), false);
    for (let i = 0; i < m.length; i++) if (m[i] && allowed[i] && (k === 1 || final[i] >= k - 1)) final[i] = k;
  }
  for (let i = 0; i < final.length; i++) if (!final[i] && rip[i]) final[i] = rip[i];
  const g = new Grid(S), snow = solid('snow', 0);
  let cells = 0;
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) for (let y = 0; y < final[z * W + x]; y++) { g.set(x + X0, y, z + Z0, snow); cells++; }
  if (!cells) return null;
  const geo = buildGeometry(g.map, S, { ao: false, merge: true });
  geo.deleteAttribute('bevel');
  packGeometry(geo);
  return { geo, cells };
}
```

The test drew the mesh with the farm's voxel material at `scale.y = 0.5`. What the plan adds (section 6.4): the heaps, the check against today's drifts, G3's mounds, the pond's streaks, and dropping the downward faces. The `o.spacing` option of earlier versions is gone; the ripple versions are in `RIPPLE`.

## Appendix D. Pine genes (T1, tested)

Changes to `src/skin/scene/style/pine.ts`. The tested code; the windward snow of T1 is not in it.

```ts
/** What makes one pine its own (docs/depth/DEPTH-PLAN.md, section 8.3). Every field is used only when genes are given. */
export interface PineGenes { width: number; profile: number; bare: number; lean: number; jitter: number; flag: boolean; skirt: boolean; seed: number }

// pineShape(height, cell, tiers = 6, genes?: PineGenes):
//   bare = max(2, round(H * (genes?.bare ?? 0.14)))
//   R    = max(2, height * (genes?.width ?? 0.23) / cell)
//   radius(k) = max(k >= n ? 1 : 1.2, R * max(0, 1 - k / (n + 0.6)) ** (genes?.profile ?? 1) + 0.5)

// tieredPine(..., paint?: PinePaint, genes?: PineGenes): after pineShape, each tier's centre offset:
const jr = rng((genes?.seed ?? 1) * 977 + 3);
const offs = Array.from({ length: n + 1 }, (_, k) => {
  if (!genes) return [0, 0];
  const lean = Math.round((genes.lean * k) / n); // toward +x, downwind
  const jx = jr() < genes.jitter ? (jr() < 0.5 ? -1 : 1) : 0, jz = jr() < genes.jitter ? (jr() < 0.5 ? -1 : 1) : 0;
  return [lean + (k > 0 && k < n ? jx : 0), k > 0 && k < n ? jz : 0];
});
// `disc` draws round (cx + ox, cz + oz); with `trimWest` it skips cells with x + 0.5 < -r * 0.45; with `ringFrom` it draws only
// cells at least that far out. In the tier loop, before the tier's rows:
//   [ox, oz] = offs[k]; trimWest = !!genes?.flag && k >= n / 2;
//   if (genes?.skirt && k < n - 1) { ringFrom = radius(k) - 1.3; disc(yb - 1, radius(k) - 0.2, under); ringFrom = 0; }
// Before the tip: [ox, oz] = offs[n]; trimWest = false; and the tip's cubes are placed at cx + ox, cz + oz.

/** A pine's genes from its seed. `windbreak`: lean 1 or 2. `windward`: the windbreak's west row (flagged). */
export function genesFor(seed: number, windbreak = false, windward = false) {
  const r = rng(seed * 131 + 7), t = r();
  const kind = t < 0.3 ? 'spire' : t < 0.7 ? 'cone' : 'round';
  const tiers = kind === 'spire' ? 7 : kind === 'cone' ? 5 + Math.floor(r() * 2) : 4;
  const width = kind === 'spire' ? 0.17 + r() * 0.03 : kind === 'cone' ? 0.21 + r() * 0.03 : 0.26 + r() * 0.03;
  const profile = kind === 'spire' ? 1.25 : kind === 'cone' ? 1 : 0.8;
  const genes: PineGenes = { width, profile, bare: 0.1 + r() * 0.08, lean: windbreak ? 1 + Math.floor(r() * 2) : Math.floor(r() * 2), jitter: 0.45, flag: windward, skirt: kind === 'spire', seed };
  // The test used tones -1, 0, +1; the plan uses 0 or +1 (section 8.3).
  return { kind, tiers, tone: Math.floor(r() * 2), genes };
}
```

Callers in the test: `pine()` in `yard.ts` used `genesFor(seed + 40)`; the windbreak used `genesFor(i + 100, true, x < -37)` with the height × `0.85 + ((i * 37) % 10) / 30`. Keep `pinePaint` as it is (the season's tree uses it) and add a paint that takes the material (`pine`, `spruce` or `fir`) and the tone.

## Appendix E. The sky and the five cloud styles (S1, tested)

The test build's code for `Sky.tsx`, with its switches taken out. It needs `useThree` from `@react-three/fiber` and, from `three`, `CanvasTexture`, `DataTexture`, `DirectionalLight`, `IcosahedronGeometry`, `MeshToonMaterial`, `NearestFilter`, `Object3D`, `RedFormat`, `ShaderMaterial`, `Shape`, `ShapeGeometry`, `Sprite`, `SpriteMaterial`, `SRGBColorSpace` and `Vector3`. The test drew `<PaintedSky>` in place of `<Dome>`.

**Mockup only:** `cloudPlaces` puts its first seven clouds inside the pond shot's view (azimuth −2.245 rad), so the five styles could be compared in one picture. Section 9.3 says how the real clouds are spread.

```tsx
/** S1: the sky: a three-colour gradient with the sun's glow (docs/depth/DEPTH-PLAN.md, section 9.3), and Brian's pick of cloud style. */
const PAINT: Record<Hour, { top: string; mid: string; horizon: string; glow: string; tint: string; opacity: number }> = {
  day: { top: '#5E9AD6', mid: '#9CC4EA', horizon: '#F2DCCB', glow: '#FFD7A6', tint: '#FFFFFF', opacity: 1 },
  dawn: { top: '#7F9DCC', mid: '#C6B6D6', horizon: '#F6CDB6', glow: '#FFC79E', tint: '#FFE6DA', opacity: 1 },
  dusk: { top: '#4E5692', mid: '#A88BB8', horizon: '#F3A985', glow: '#FFB078', tint: '#F7BFAE', opacity: 1 },
  night: { top: '#0E1834', mid: '#1C2B52', horizon: '#2D406B', glow: '#3A4B7A', tint: '#4E5A86', opacity: 0.75 },
};
function PaintedSky({ hour, reduced }: { hour: Hour; reduced: boolean }) {
  const scene = useThree((st) => st.scene);
  const pal = PAINT[hour];
  const { geo, mat } = useMemo(() => {
    const geo = new SphereGeometry(DISTANCE.skyRadius, 64, 32);
    const mat = new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new Color(pal.top) }, uMid: { value: new Color(pal.mid) }, uHorizon: { value: new Color(pal.horizon) }, uGlow: { value: new Color(pal.glow) }, uSun: { value: new Vector3(0.4, 0.5, 0.3) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float t = d.y;
          vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.25, t));
          col = mix(col, uTop, smoothstep(0.2, 0.9, t));
          float c = max(dot(d, normalize(uSun)), 0.0);
          col += uGlow * (pow(c, 3.0) * 0.22 + pow(c, 20.0) * 0.3 + pow(c, 600.0) * 1.4) * (1.0 - 0.4 * smoothstep(0.0, 0.6, t));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    return { geo, mat };
  }, [pal]);
  const sun = useRef<DirectionalLight | null>(null);
  const group = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!sun.current) scene.traverse((o) => { if (!sun.current && (o as DirectionalLight).isDirectionalLight && (o as DirectionalLight).castShadow) sun.current = o as DirectionalLight; });
    const l = sun.current;
    if (l) { const v = new Vector3().copy(l.position).sub(l.target.position).normalize(); mat.uniforms.uSun.value.copy(v); }
    if (group.current && !reduced) group.current.rotation.y += Math.min(dt, 0.05) * 0.0012;
  });
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return (
    <>
      <mesh geometry={geo} material={mat} renderOrder={-10} />
      <group ref={group}><MockClouds style={CLOUD_STYLE} /></group>
    </>
  );
}

/** The five cloud styles of the mockups (section 9.3). 1 toon puffs, 2 low-poly, 3 paper cut-outs, 4 fine voxel, 5 pixel art. */
const CLOUD_STYLE = 1;
interface Lobe { t: number; y: number; r: number }
interface CloudAt { az: number; d: number; base: number; lobes: Lobe[]; L: number; H: number }
function cloudPlaces(): CloudAt[] {
  const r = rng(77), out: CloudAt[] = [];
  for (let i = 0; i < 16; i++) {
    const az = i < 7 ? -2.245 + (i / 6 - 0.5) * 1.05 + (r() - 0.5) * 0.06 : ((i - 7) / 9) * Math.PI * 2 + 0.4, d = 280, e = (i < 7 ? [7, 15, 9, 19, 8, 13, 10][i] : 6 + r() * 9) * Math.PI / 180, base = Math.sin(e) * d;
    const L = 50 + r() * 35, H = 14 + r() * 8, j = () => 0.85 + r() * 0.3, sh = (r() - 0.5) * 0.15 * L;
    // a cumulus: a tall middle, two shoulders, two small ends, two bumps on top
    const lobes: Lobe[] = [
      { t: sh, y: H * 0.55, r: H * 0.75 * j() },
      { t: sh - L * 0.22, y: H * 0.42, r: H * 0.55 * j() }, { t: sh + L * 0.22, y: H * 0.4, r: H * 0.52 * j() },
      { t: -L * 0.4, y: H * 0.28, r: H * 0.36 * j() }, { t: L * 0.4, y: H * 0.26, r: H * 0.34 * j() },
      { t: sh - L * 0.08, y: H * 0.98, r: H * 0.32 * j() }, { t: sh + L * 0.1, y: H * 0.9, r: H * 0.28 * j() },
    ];
    out.push({ az, d, base, lobes, L, H });
  }
  return out;
}
const HAZE = new Color('#E8E2EE');
function placeCloud(o: Object3D, c: CloudAt) {
  o.position.set(Math.cos(c.az) * c.d, c.base, Math.sin(c.az) * c.d);
  o.lookAt(0, c.base, 0); // its long side faces the farm
  return o;
}
function MockClouds({ style }: { style: number }) {
  const group = useMemo(() => {
    const root = new Group(), places = cloudPlaces();
    if (style === 1) { // toon puffs: round lobes, three crisp bands of light
      const grad = new DataTexture(new Uint8Array([85, 165, 232]), 3, 1, RedFormat); grad.minFilter = grad.magFilter = NearestFilter; grad.needsUpdate = true;
      const mat = new MeshToonMaterial({ color: '#D8D4DC', gradientMap: grad, emissive: new Color('#C9C0E6'), emissiveIntensity: 0.18, fog: false });
      for (const c of places) {
        const g = new Group();
        for (const l of c.lobes) { const m = new Mesh(new SphereGeometry(l.r, 28, 18), mat); m.position.set(l.t, l.y, 0); m.scale.set(1.15, 0.85, 0.9); g.add(m); }
        const base = new Mesh(new SphereGeometry(1, 32, 16), mat); base.position.set(0, c.H * 0.22, 0); base.scale.set(c.L * 0.5, c.H * 0.24, c.H * 0.5); g.add(base);
        root.add(placeCloud(g, c));
      }
    } else if (style === 2) { // low-poly: faceted lumps, flat shaded
      const mat = new MeshLambertMaterial({ color: '#D8D4DC', flatShading: true, emissive: HAZE, emissiveIntensity: 0.18, fog: false });
      const r = rng(5);
      for (const c of places) {
        const g = new Group();
        for (const l of c.lobes) {
          const geo = new IcosahedronGeometry(l.r, 1), pos = geo.getAttribute('position');
          for (let k = 0; k < pos.count; k++) { const f = 0.95 + r() * 0.1; pos.setXYZ(k, pos.getX(k) * f, Math.max(pos.getY(k) * f, -l.r * 0.35), pos.getZ(k) * f); }
          geo.computeVertexNormals();
          const m = new Mesh(geo, mat); m.position.set(l.t, l.y, 0); m.scale.set(1.15, 0.9, 0.85); g.add(m);
        }
        const bg = new IcosahedronGeometry(1, 1), bm = new Mesh(bg, mat); bm.position.set(0, c.H * 0.22, 0); bm.scale.set(c.L * 0.5, c.H * 0.24, c.H * 0.5); g.add(bm);
        root.add(placeCloud(g, c));
      }
    } else if (style === 3) { // paper cut-outs: two flat layers and a soft shadow, crisp edges
      const layer = (c: CloudAt, grow: number) => {
        const lo = Math.min(...c.lobes.map((l) => l.t - l.r)), hi = Math.max(...c.lobes.map((l) => l.t + l.r)), sh = new Shape();
        sh.moveTo(lo + 2, 0);
        for (let k = 0; k <= 60; k++) {
          const x = lo + ((hi - lo) * k) / 60;
          let y = 0;
          for (const l of c.lobes) { const dx = x - l.t, rr = l.r * grow; if (Math.abs(dx) < rr) y = Math.max(y, l.y * 0.7 + Math.sqrt(rr * rr - dx * dx)); }
          sh.lineTo(x, Math.max(1.5, y));
        }
        sh.lineTo(hi - 2, 0); sh.lineTo(lo + 2, 0);
        return new ShapeGeometry(sh, 4);
      };
      const back = new MeshBasicMaterial({ color: '#D9D1EE', fog: false, side: DoubleSide }), front = new MeshBasicMaterial({ color: '#FFFBF4', fog: false, side: DoubleSide }), shade = new MeshBasicMaterial({ color: '#B4AAD4', fog: false, side: DoubleSide, transparent: true, opacity: 0.55 });
      for (const c of places) {
        const g = new Group();
        const b = new Mesh(layer(c, 1.0), back); b.position.set(3, 4, -2); g.add(b);
        const s2 = new Mesh(layer(c, 0.92), shade); s2.position.set(1.5, -1.2, -1); g.add(s2);
        const f = new Mesh(layer(c, 0.92), front); g.add(f);
        root.add(placeCloud(g, c));
      }
    } else if (style === 4) { // fine voxel: small cubes, rounded, corner shading
      const C = 1.5, g = new Grid(C), top = lin('#FFFFFF'), side = lin('#F4EEF0'), under = lin('#D6D0E8');
      for (const c of places) {
        const cx = Math.cos(c.az) * c.d, cz = Math.sin(c.az) * c.d, tx = -Math.sin(c.az), tz = Math.cos(c.az);
        for (const l of [...c.lobes, { t: 0, y: c.H * 0.22, r: -1 }]) {
          const flat = l.r < 0, px = cx + tx * l.t, pz = cz + tz * l.t, py = c.base + l.y, R = flat ? c.L * 0.5 : l.r;
          for (let x = Math.floor((px - R * 1.2) / C); x <= Math.ceil((px + R * 1.2) / C); x++)
            for (let z = Math.floor((pz - R) / C); z <= Math.ceil((pz + R) / C); z++)
              for (let y = Math.floor(c.base / C); y <= Math.ceil((py + R) / C); y++) {
                const along = ((x + 0.5) * C - px) * tx + ((z + 0.5) * C - pz) * tz, across = ((x + 0.5) * C - px) * -tz + ((z + 0.5) * C - pz) * tx;
                const dx = along / (flat ? c.L * 0.5 : R * 1.15), dy = ((y + 0.5) * C - py) / (flat ? c.H * 0.24 : R * 0.85), dz = across / (flat ? c.H * 0.5 : R * 0.9);
                if (dx * dx + dy * dy + dz * dz <= 1) g.set(x, y, z, side);
              }
        }
      }
      for (const v of g.map.values()) { if (!g.has(v.x, v.y - 1, v.z)) v.c = under; else if (!g.has(v.x, v.y + 1, v.z)) v.c = top; }
      const geo = buildGeometry(g.map, C); geo.deleteAttribute('bevel');
      root.add(new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, color: '#D8D4DC', emissive: HAZE, emissiveIntensity: 0.18, fog: false })));
    } else if (style === 5) { // pixel art: hard pixels, three shades and a dither line, on cards
      for (const c of places) {
        const W = 72, Hh = 30, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
        const ctx = cv.getContext('2d')!, lo = Math.min(...c.lobes.map((l) => l.t - l.r)), hi = Math.max(...c.lobes.map((l) => l.t + l.r)), sc = (W - 4) / (hi - lo);
        const inside = (px: number, py: number) => {
          const x = lo + (px + 0.5 - 2) / sc, y = (Hh - 2 - (py + 0.5)) / sc;
          if (y < 0) return false;
          return c.lobes.some((l) => (x - l.t) ** 2 + (y - l.y * 0.7) ** 2 <= l.r * l.r);
        };
        for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
          if (!inside(px, py)) continue;
          const edgeUp = !inside(px, py - 2), low = !inside(px, py + 3);
          ctx.fillStyle = edgeUp ? '#FFFFFF' : low ? (((px + py) % 2 === 0) ? '#CFC7E6' : '#E6E0F2') : '#F3EFF6';
          if (!inside(px, py + 1)) ctx.fillStyle = '#BDB3DC';
          ctx.fillRect(px, py, 1, 1);
        }
        const tex = new CanvasTexture(cv); tex.magFilter = tex.minFilter = NearestFilter; tex.colorSpace = SRGBColorSpace; tex.generateMipmaps = false;
        const sp = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
        const w = (hi - lo) * 1.05; sp.scale.set(w, w * Hh / W, 1);
        sp.position.set(Math.cos(c.az) * c.d, c.base + (w * Hh / W) * 0.45, Math.sin(c.az) * c.d);
        root.add(sp);
      }
    }
    return root;
  }, [style]);
  return <primitive object={group} />;
}
```

## Appendix F. Icicles (S3, tested)

The test collected the lips while building: in `buildYardSteps` after `farmhouse(...)` (cubes of `caps` at `y >= 8`), and in the farm's build before the props are meshed (cubes of `big.caps` at `y >= 10`), each where the cube and the three cells under it in both the caps and the model are empty. Each lip is `[x * S + 0.1, y * S, z * S + 0.1]`.

```ts
import { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { Grid } from '../voxel/primitives';
import { solid } from '../voxel/paint';

/** Icicles under every roof lip LIPS holds, on a 0.05 m grid: some lips bare, the rest one or two icicles of their own length. */
/** `lips`: the bottom middle (metres) of every roof-snow cube with nothing in the three cells under it. */
export function buildIcicles(lips: [number, number, number][]): BufferGeometry | null {
  if (!lips.length) return null;
  const C = 0.05, g = new Grid(C), top = solid('ice', 1), tip = solid('ice', 2);
  const hash = (a: number, b: number, c: number) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
  for (const [x, y, z] of lips) {
    const h0 = hash(x, y, z);
    if (h0 > 0.62) continue;
    const n = h0 < 0.25 ? 2 : 1;
    for (let m = 0; m < n; m++) {
      const ox = Math.floor(hash(x, z, m + 3) * 3), oz = Math.floor(hash(z, x, m + 7) * 3);
      const cx = Math.round((x - 0.1) / C) + ox, cz = Math.round((z - 0.1) / C) + oz, cy = Math.round(y / C) - 1;
      const L = 2 + Math.floor(hash(x + m, y, z) ** 1.6 * 10);
      for (let s = 0; s < L; s++) {
        const wide = s < Math.ceil(L / 3);
        g.set(cx, cy - s, cz, s === L - 1 ? tip : top);
        if (wide) { g.set(cx + 1, cy - s, cz, top); g.set(cx, cy - s, cz + 1, top); g.set(cx + 1, cy - s, cz + 1, top); }
      }
    }
  }
  if (!g.map.size) return null;
  const geo = buildGeometry(g.map, C, { ao: false });
  geo.deleteAttribute('bevel');
  return geo;
}
```

The plan adds `merge: true` and keeps only lips some shot sees, to stay under 12,000 triangles.

## Appendix G. The block-outs of section 7 (tested for place and size only)

Plain boxes, written quickly to check where each new thing stands and how big it reads in each shot. They are not the finished models: build each properly from section 7's descriptions (the lean-to, the porch's things, the crenels, the flag, a thicker feeder ring and so on). The test drew them as one mesh with the voxel material, and the lit glass with the lantern material, and built them before G1 so that their `noteShade` reaches the snow. Where the plan names `fir` or `ink`, which the test's palette did not have yet, the test used `pine −2` and `faceDark 0`. The walks of section 7.1, rule 7, were added to `WALKS` in `yard.ts`.

```ts
/** The test's block-outs of section 7's new things, on a 0.1 m grid: places and sizes only. */
import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { Grid } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { solid } from '../voxel/paint';
import { noteShade } from '../voxel/groundShade';

const C = 0.1;
export function buildXProps(): { geo: BufferGeometry; glow: BufferGeometry } {
  const g = new Grid(C), lit = new Grid(C);
  const i = (m: number) => Math.round(m / C);
  /** A box from (x0, y0, z0) to (x1, y1, z1) metres, ends exclusive. */
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, grid = g) => {
    for (let x = i(x0); x < i(x1); x++) for (let y = i(y0); y < i(y1); y++) for (let z = i(z0); z < i(z1); z++) grid.set(x, y, z, c);
  };
  const snowCap = (x0: number, y: number, z0: number, x1: number, z1: number) => box(x0, y, z0, x1, y + 0.1, z1, solid('snow', 1));

  // ---- 1. The kitchen garden, in front of the porch: 8.5 x 6 m, laid out on one axis: the gate and the path.
  // Six beds of one size in two columns either side of the path, every margin and walkway the same, one crop per bed.
  const G = { x0: -11.9, x1: -3.4, z0: 22.4, z1: 28.4 }, white = solid('trimWhite', 0), rail = solid('trimWhite', -1);
  const picketLine = (ax: number, az: number, bx: number, bz: number, gate?: [number, number]) => {
    const n = Math.round(Math.max(Math.abs(bx - ax), Math.abs(bz - az)) / C);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      if (gate && x > gate[0] && x < gate[1]) continue;
      box(x, 0.2, z, x + C, 0.3, z + C, rail); box(x, 0.5, z, x + C, 0.6, z + C, rail);
      if (k % 2 === 0) { box(x, 0, z, x + C, 0.7, z + C, white); g.set(i(x), i(0.7), i(z), solid('snow', 1)); }
    }
  };
  picketLine(G.x0, G.z0, G.x1, G.z0, [-8.25, -7.05]);
  picketLine(G.x0, G.z1, G.x1, G.z1);
  picketLine(G.x0, G.z0, G.x0, G.z1);
  picketLine(G.x1 - C, G.z0, G.x1 - C, G.z1);
  // the gate: two posts and a beam over the path, no leaf
  box(-8.35, 0, G.z0, -8.25, 1.2, G.z0 + C, white); box(-7.05, 0, G.z0, -6.95, 1.2, G.z0 + C, white);
  box(-8.35, 1.2, G.z0, -6.95, 1.3, G.z0 + C, white); snowCap(-8.35, 1.3, G.z0, -6.95, G.z0 + C);
  const cols = [[-11.3, -8.75], [-6.55, -4.0]] as const, rows = [[23.0, 24.2], [24.8, 26.0], [26.6, 27.8]] as const;
  const crops = [['kale', 'cabbage'], ['leek', 'frame'], ['cabbage', 'kale']] as const;
  rows.forEach(([z0, z1], r) => cols.forEach(([x0, x1], c) => {
    const crop = crops[r][c], mid = (z0 + z1) / 2;
    box(x0, 0, z0, x1, 0.25, z1, solid('darkWood', 1));
    box(x0 + 0.1, 0.25, z0 + 0.1, x1 - 0.1, 0.3, z1 - 0.1, solid('snow', 1));
    if (crop === 'frame') { // a cold frame filling the bed: a low front, a high back, a glass lid
      box(x0 + 0.1, 0.3, z0 + 0.1, x1 - 0.1, 0.4, z0 + 0.2, solid('wood', 0)); box(x0 + 0.1, 0.3, z1 - 0.2, x1 - 0.1, 0.55, z1 - 0.1, solid('wood', 0));
      box(x0 + 0.1, 0.3, z0 + 0.1, x0 + 0.2, 0.5, z1 - 0.1, solid('wood', 0)); box(x1 - 0.2, 0.3, z0 + 0.1, x1 - 0.1, 0.5, z1 - 0.1, solid('wood', 0));
      box(x0 + 0.2, 0.45, z0 + 0.2, x1 - 0.2, 0.5, z1 - 0.2, solid('ice', 1)); snowCap(x0 + 0.2, 0.5, mid, x1 - 0.2, z1 - 0.2);
      return;
    }
    for (const dz of [-0.3, 0.3]) for (let k = 0; k < 6; k++) { // two rows of six, evenly spaced
      const x = x0 + 0.275 + k * 0.4, z = mid + dz;
      if (crop === 'kale') { box(x - 0.1, 0.3, z - 0.1, x + 0.1, 0.55, z + 0.1, solid('pine', -2)); box(x - 0.05, 0.55, z - 0.05, x + 0.05, 0.6, z + 0.05, solid('pine', -1)); }
      if (crop === 'cabbage') { box(x - 0.15, 0.3, z - 0.15, x + 0.15, 0.5, z + 0.15, solid('giftGreen', 1)); box(x - 0.05, 0.5, z - 0.05, x + 0.05, 0.55, z + 0.05, solid('snow', 1)); }
      if (crop === 'leek') { box(x - 0.05, 0.3, z - 0.05, x + 0.05, 0.6, z + 0.05, solid('trimWhite', -1)); box(x - 0.1, 0.6, z - 0.05, x + 0.1, 0.8, z + 0.05, solid('pine', 0)); }
    }
  }));

  // ---- 2. Three beehives under snow, south of the garden.
  for (const hx of [-27.4, -26.4, -25.4]) { // in the orchard, whose blossom they work
    const hz = 11.0;
    box(hx, 0, hz, hx + 0.5, 0.2, hz + 0.5, solid('darkWood', 0));
    box(hx, 0.2, hz, hx + 0.5, 0.5, hz + 0.5, solid('trimWhite', -1));
    box(hx, 0.5, hz, hx + 0.5, 0.8, hz + 0.5, solid('trimWhite', 0));
    box(hx + 0.15, 0.2, hz + 0.5, hx + 0.35, 0.3, hz + 0.6, solid('faceDark', 0));
    box(hx - 0.05, 0.8, hz - 0.05, hx + 0.55, 0.9, hz + 0.55, solid('roofBrown', 0));
    snowCap(hx - 0.05, 0.9, hz - 0.05, hx + 0.55, hz + 0.55);
  }

  // ---- 3. Two lamp posts along the walk from the porch to the court's gate.
  for (const [lx, lz] of [[-8.6, 20.5], [-4.4, 19.1]] as const) {
    box(lx - 0.1, 0, lz - 0.1, lx + 0.2, 0.2, lz + 0.2, solid('stone', 0));
    box(lx, 0.2, lz, lx + C, 2.0, lz + C, solid('iron', 0));
    box(lx - 0.1, 2.0, lz - 0.1, lx + 0.2, 2.1, lz + 0.2, solid('iron', -1));
    box(lx - 0.1, 2.1, lz - 0.1, lx + 0.2, 2.4, lz + 0.2, solid('brass', 2), lit); // the lit glass
    box(lx - 0.15, 2.4, lz - 0.15, lx + 0.25, 2.5, lz + 0.25, solid('iron', -1));
    snowCap(lx - 0.15, 2.5, lz - 0.15, lx + 0.25, lz + 0.25);
  }

  // ---- 4. A woodpile at the porch's south end: log ends in a brick bond, a snow cap.
  const W = { x0: -14.9, x1: -13.5, z0: 26.0, z1: 26.6 };
  box(W.x0, 0, W.z0, W.x1, 1.0, W.z1, solid('darkWood', 0));
  for (let row = 0; row < 5; row++) for (let k = 0; k < 7; k++) {
    const x = W.x0 + (k * 2 + (row % 2)) * C, y = row * 0.2;
    if (x + 0.1 > W.x1) continue;
    box(x, y, W.z1, x + C, y + C, W.z1 + C, solid('wood', 1));
  }
  snowCap(W.x0, 1.0, W.z0, W.x1, W.z1);

  // ---- 5. A clothesline west of the farmhouse with three patchwork quilts.
  const cx = -24.2, cz0 = 19.0, cz1 = 24.0;
  for (const z of [cz0, cz1]) { box(cx, 0, z, cx + C, 1.9, z + C, solid('wood', 0)); box(cx - 0.3, 1.8, z, cx + 0.4, 1.9, z + C, solid('wood', 0)); snowCap(cx - 0.3, 1.9, z, cx + 0.4, z + C); }
  box(cx, 1.8, cz0, cx + C, 1.85, cz1, solid('trimWhite', -1));
  const patch = [solid('scarfRed', 0), solid('coopYellow', 0), solid('giftGreen', 0), solid('trimWhite', 0), solid('slate', 0)];
  [[19.4, 0], [20.8, 2], [22.3, 1]].forEach(([qz, s0]) => {
    for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) box(cx, 1.0 + b * 0.2, qz + a * 0.2, cx + C, 1.2 + b * 0.2, qz + (a + 1) * 0.2, patch[(a + b * 2 + s0) % 5]);
    box(cx, 1.8, qz + 0.1, cx + C, 1.9, qz + 0.2, solid('brass', 0)); box(cx, 1.8, qz + 0.8, cx + C, 1.9, qz + 0.9, solid('brass', 0)); // pegs
  });

  // ---- 6. A snow fort on the south lawn, a heap of snowballs, a small snowman.
  const fx = -8.0, fz = 35.5;
  for (let course = 0; course < 3; course++) for (let k = -4; k <= 4; k++) {
    const shade = (k + course) % 2 === 0 ? solid('snow', 0) : solid('snow', 1);
    box(fx + k * 0.3 - 0.15 + (course % 2) * 0.15, course * 0.3, fz - 1.2, fx + k * 0.3 + 0.15 + (course % 2) * 0.15, (course + 1) * 0.3, fz - 0.9, shade); // north wall
  }
  for (let course = 0; course < 2; course++) for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) box(fx + side * 1.35 - 0.15, course * 0.3, fz - 0.9 + k * 0.3, fx + side * 1.35 + 0.15, (course + 1) * 0.3, fz - 0.6 + k * 0.3, (k + course) % 2 ? solid('snow', 0) : solid('snow', 1));
  }
  for (const [bx, by, bz] of [[0, 0, 0], [0.2, 0, 0], [0.1, 0, 0.2], [0.1, 0.2, 0.1]] as const) box(fx - 0.3 + bx, by, fz - 0.4 + bz, fx - 0.1 + bx, by + 0.2, fz - 0.2 + bz, solid('snow', 1));
  box(fx + 1.9, 0, fz - 0.3, fx + 2.4, 0.5, fz + 0.2, solid('snow', 0)); box(fx + 1.95, 0.5, fz - 0.25, fx + 2.35, 0.8, fz + 0.15, solid('snow', 1));
  box(fx + 2.05, 0.65, fz + 0.15, fx + 2.15, 0.7, fz + 0.3, solid('carrot', 0)); box(fx + 1.95, 0.8, fz - 0.25, fx + 2.35, 0.85, fz + 0.15, solid('scarfRed', 0));

  // ---- 7. A ring feeder with a round bale in the pasture.
  const rx = 22.0, rz = 16.5;
  for (let y = 0; y < 10; y++) for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) {
    const d = Math.hypot(x + 0.5, z + 0.5);
    if (d < 5.2) g.set(i(rx) + x, y, i(rz) + z, (y === 3 || y === 7) ? solid('hay', -1) : solid('hay', 0));
    else if (d < 6.2 && (y === 9 || y === 0 || (Math.abs(Math.atan2(z + 0.5, x + 0.5)) * 6 / Math.PI) % 1 < 0.17)) g.set(i(rx) + x, y, i(rz) + z, solid('iron', 1));
  }
  for (let x = -5; x < 5; x++) for (let z = -5; z < 5; z++) if (Math.hypot(x + 0.5, z + 0.5) < 4.6) g.set(i(rx) + x, 10, i(rz) + z, solid('snow', 1));

  // ---- 8. The farm's gate arch over the lane's entrance, a sheep cut into its board.
  const az = 42.6;
  for (const px of [-2.2, 1.9]) { box(px, 0, az, px + 0.3, 3.3, az + 0.3, solid('wood', -1)); snowCap(px, 3.3, az, px + 0.3, az + 0.3); }
  box(-2.5, 3.0, az + 0.05, 2.5, 3.3, az + 0.25, solid('wood', 0)); snowCap(-2.5, 3.3, az + 0.05, 2.5, az + 0.25);
  box(-0.65, 2.8, az + 0.1, -0.55, 3.0, az + 0.2, solid('iron', 0)); box(0.55, 2.8, az + 0.1, 0.65, 3.0, az + 0.2, solid('iron', 0));
  box(-0.9, 2.2, az + 0.1, 0.9, 2.8, az + 0.2, solid('wood', 1));
  const sheep = ['..XXXX.', '.XXXXXX', 'XXXXXXX', '.X.X.X.'];
  sheep.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'X') box(-0.35 + c * C, 2.7 - r * C, az + 0.2, -0.25 + c * C, 2.8 - r * C, az + 0.3, solid('trimWhite', 0)); }));
  // ---- 9. A fire pit for the skaters, beside the pond's bench: a ring of stones, logs, embers, a log seat.
  const px = 9.2, pz = 27.4;
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2, x = px + Math.cos(t) * 0.55, z = pz + Math.sin(t) * 0.55; box(x - 0.1, 0, z - 0.1, x + 0.1, a % 2 ? 0.2 : 0.3, z + 0.1, solid('stone', a % 2 ? -1 : 0)); }
  box(px - 0.3, 0, pz - 0.05, px + 0.3, 0.1, pz + 0.05, solid('darkWood', -1)); box(px - 0.05, 0.1, pz - 0.3, px + 0.05, 0.2, pz + 0.3, solid('darkWood', -1));
  for (const [ex, ez, ey] of [[0, 0, 0.2], [0.1, 0.1, 0.2], [-0.1, 0, 0.1], [0, -0.1, 0.1], [0, 0, 0.3]] as const) box(px + ex - 0.05, ey, pz + ez - 0.05, px + ex + 0.05, ey + 0.1, pz + ez + 0.05, solid('carrot', 1), lit);
  box(px - 1.6, 0, pz - 0.2, px - 0.9, 0.3, pz + 0.2, solid('darkWood', 0)); box(px - 1.5, 0.3, pz - 0.15, px - 1.0, 0.35, pz + 0.15, solid('snow', 1)); // a log seat
  noteShade(g.map.values(), C); // the ground's shade, and the snow's drifts, see them
  return { geo: buildGeometry(g.map, C), glow: buildGeometry(lit.map, C, { ao: false }) };
}
```
