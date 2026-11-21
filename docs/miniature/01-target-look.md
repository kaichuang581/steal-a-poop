# 01. The target look

This file says what the game should look like when the plan is finished, in rules that can be checked. Every other file obeys it. If another file and this one disagree, this one wins and the coder stops to ask.

## 1. The reference, in this plan's words

Brian's reference picture shows small farm models that look like **painted wooden miniatures photographed in a studio**. (No names of games, films or studios go into the repository: `CLAUDE.md`. Describe, never name.)

| # | What the reference does | Short name used in this plan |
|---|---|---|
| 1 | Everything is built from sharp-edged cubes. Big things (walls, roofs, bodies) use large blocks. Small things (faces, tools, window bars, crops) use blocks about a quarter of that size. | Two block sizes |
| 2 | Each part has one solid colour. There is no texture, no speckle, no painted gradient. | Solid parts |
| 3 | Parts that touch are told apart by a small change of brightness (a fence plank next to a slightly darker plank; legs a little darker than the body), not by black outlines. | Value steps |
| 4 | Colours are warm and a little muted, like painted wood. Nothing is neon, nothing is grey. | Warm palette |
| 5 | The light is soft and bright. Corners and the ground under each object are gently darker. Shadows are short and soft. There are no shiny highlights. | Soft light |
| 6 | Each model stands alone on a small base against an off-white background, seen from a fixed three-quarter angle with no perspective. | Studio framing |

Rows 1 to 5 are what this plan builds into the game. Row 6 cannot be the game's Home screen, because Home needs the forest and the wendigo behind the farm. Row 6 is used for the review pictures instead (file 04, section 7), so every model can be compared with the reference in the reference's own framing.

## 2. The gap: what the game does today

Checked in the pushed code (v0.8.0, commit `4f033f4`). The working tree is newer (v0.8.3); milestone M0 re-checks each line.

| # | Reference | The game today | Evidence | Fixed in |
|---|---|---|---|---|
| 1 | Soft bright light | The wide views are grey. Sunlit snow measures 174 of 255. The red barn measures 151, 149, 154, which is plain grey. | Haze `FogExp2` 0.012 on every shot; sun 20° up; exposure 1 (`src/skin/table/Rendering.tsx`). Measurements in file 02. | File 02 |
| 2 | Solid parts | Most surfaces are speckled: each cube picks one of three tones at random (60% light, 30% mid, 10% dark). | `tone()` = `pick(t, hash3(x, y, z, seed))` in `farmstead.ts`, `yard.ts`, `barn.ts`, `countryside.ts`, `duel.ts`, `pen.ts`, `festive.ts`. | File 03 |
| 3 | Solid parts | A second speckle is added when models are smoothed: every cube's brightness wanders by up to 4%. | `refine(map, grain = 0.04)` in `src/skin/voxel/refine.ts`; the yard uses 0.04, the tractor 0.03. | File 03 |
| 4 | Solid parts | Snow has a painted texture, and snow caps on rails and roofs have random holes. | `snowPaint` / `snowAt` in `src/skin/voxel/snow.ts`; caps gated by `hash3(...) > 0.3`. | File 03 |
| 5 | Value steps | Planned in a few places only (the barn's boards, the roof's shingle courses, the coop's clapboards). Elsewhere it is random per cube. | `barnShell`, `barnRoof`, `coop` in `farmstead.ts`. | File 03 |
| 6 | Two block sizes | One block size per object. A "nail" on the yard fence, the gate's latch and the farmhouse's door knob are each one 0.2 m cube, as big as a wall block. | `fence`, `farmhouse` in `yard.ts`. | File 04 |
| 7 | Sharp cubes | On a computer every model is smoothed to half-size cubes with the outer corners cut off, and edges are shaded as if rounded. | `detailedSteps` in `refine.ts`; `ROUNDED_VOXELS = true` in `rounded.ts`. | File 03 |
| 8 | Warm palette | Every colour is stored 30% less saturated than its table value, then pushed toward grey again by the tone mapping and the haze. | `DESATURATE = 0.7` in `palette.ts`; `ACESFilmicToneMapping`. | Files 02, 03 |
| 9 | Soft corners and ground shade | Corner shading exists but reaches one cube and only inside one model. The sun's shadows stop 20 m from the barn. Only animals have a dark patch under them. | `AO_STEP` in `mesher.ts`; shadow camera ±20 m in `Rendering.tsx`; `contactPatch.ts`. | Files 02, 04 |

The models themselves are good and stay. Their shapes, places and sizes do not change. What changes is how they are lit, how they are coloured, how sharp they are, and a new layer of very small detail.

## 3. The rules

Each rule has a test the coder can run by looking at a review picture (file 04, section 7).

**R1. One part, one colour.** A part is something that would be one piece of wood in a toy: one board, one post, one rail, one stone, one shingle course, one tier of a tree, one wheel. Every cube of a part has exactly the same colour.
*Test:* zoom into any part in the review picture. If you can see individual cubes inside it by colour, it fails.

**R2. Neighbours differ by a step.** Two parts of the same material that touch use colours one step apart on that material's ladder (section 4). This is how the eye separates them.
*Test:* fence rails against posts, legs against bodies and boards against boards are visibly separate in flat light, with no outline.

**R3. Nothing random per cube.** No random tone, no brightness grain, no random holes in snow. Randomness is allowed only for whole parts: which step a board gets, how long an icicle is, how tall a tree is. It is always seeded, so every load looks the same.
*Test:* the code for a model contains no `hash3(x, y, z, ...)` that decides the colour or the presence of a single cube inside a part.

**R4. Two block sizes.** Structure is built from 0.2 m blocks ("chunky") and is never smoothed. Small detail is built from 0.05 m blocks ("micro", file 04). The 0.1 m grid stays where the game already uses it (the barn's outside shell, the tractor, the hens' yard) and counts as structure there.
*Test:* in a close shot you can count the big blocks on a wall, and the tools beside it are clearly made of much smaller blocks.

**R5. Sharp edges.** Cubes have crisp edges. The rounded-edge shading is off by default. It stays a switch (`ROUNDED_VOXELS`, `?voxels=round`) because Brian asked for it on 2026-11-09 and decides with a pair of pictures (decision 3).

**R6. Matte.** Every surface is plain matte paint (`MeshLambertMaterial`, as today). No gloss, no texture image, no outline. Only real lights glow: lantern glass, lit windows, the season's bulbs.

**R7. Shade comes from light, not paint.** No painted gradients. Three kinds of built-in shade are allowed because they stand in for soft light:
1. corner shading from the mesher (as today, file 04 extends it across meshes);
2. the ground shade map (file 04, section 5): the snow is gently darker next to anything standing on it;
3. the eave step: wall cubes within 0.4 m under a roof's overhang use one step darker.

**R8. Snow is solid.** Snow is one colour per part (open snow, a drift, a trodden path, a cap). A cap covers the whole top it lies on, or stops at a straight planned line. Drifts are steps 0.2 m high with clean outlines.

**R9. No pure black, no pure white, no outline.** `#000000` and `#FFFFFF` are never used. The ladders in section 4 are the whole range of colours.

**R10. Size limit for detail.** Nothing thinner than 0.05 m exists. Micro detail is drawn only on shots whose camera is within 40 m of it (file 04, section 4), because further away it would be smaller than a pixel and would shimmer.

## 4. The palette

One ladder of five steps per material: −2, −1, **0**, +1, +2. Step 0 is the material's own colour. Steps are about 3.5% apart in lightness, which is the "subtle value shift" of the reference. Most parts use 0, −1 and +1. Steps −2 and +2 are for seams, deep shade and small accents.

These are final colours. They are converted to the renderer's linear colour **without** the 30% desaturation that `lin()` applies (file 03, section 1).

| Material | −2 | −1 | 0 | +1 | +2 | Used for |
|---|---|---|---|---|---|---|
| `snow` | `#D9D6D0` | `#E7E5E0` | `#F4F2EE` | `#FBFAF7` | `#FBFAF7` | Open snow 0, drifts and caps +1, trodden path −1, dents −2 |
| `barnRed` | `#A52A1F` | `#AE392D` | `#B8473A` | `#C25447` | `#CB6153` | Barn boards, shed planks |
| `trimWhite` | `#D8D1C0` | `#E4DCCC` | `#EFE8D8` | `#FAF4E4` | `#FFFAEB` | Painted trim, frames, silo staves |
| `slate` | `#474C56` | `#50555F` | `#5A5F69` | `#646973` | `#6E737D` | Barn, shed and cupola roofs |
| `wood` | `#835325` | `#8C5D32` | `#96683F` | `#A0734C` | `#A97E58` | Fences, beams, crates, handles |
| `darkWood` | `#4F3013` | `#58391E` | `#614329` | `#6A4D34` | `#74573F` | Trunks, bark, dark doors |
| `roofBrown` | `#644329` | `#6E4D34` | `#77573F` | `#81614A` | `#8A6C55` | Farmhouse roof and door, woodpile roof |
| `stone` | `#7E7973` | `#89837D` | `#938E88` | `#9E9993` | `#A8A39E` | Foundation, chimney, tin pails |
| `hay` | `#C99F35` | `#D3AA49` | `#DDB65A` | `#E7C26B` | `#F2CD7B` | Bales, hay rack |
| `straw` | `#D1B569` | `#DBC178` | `#E6CC86` | `#F1D894` | `#FBE3A3` | Straw beds, sacks, baskets |
| `pine` | `#2F5D37` | `#3B6641` | `#46704C` | `#517A57` | `#5D8462` | Needles, shutters, pump |
| `houseCream` | `#C4B28E` | `#CEBD9B` | `#D9C8A7` | `#E4D3B3` | `#EFDFC0` | Farmhouse walls |
| `tractorRed` | `#AF180C` | `#B82D20` | `#C23E2F` | `#CB4D3D` | `#D55B4B` | Tractor, coop roof |
| `iron` | `#2B2726` | `#34302F` | `#3D3938` | `#464241` | `#4F4C4B` | Tyres, hinges, tools, weathervane |
| `brass` | `#DBA306` | `#E5AF30` | `#EFBB48` | `#F9C75C` | `#FFD36E` | Lantern glass, lit windows, hubs, grain |
| `coopYellow` | `#C9A24D` | `#D3AE5D` | `#DDB96C` | `#E7C57B` | `#F2D08A` | Coop walls |
| `glass` | `#1F2A39` | `#283341` | `#313C4A` | `#3A4553` | `#444F5C` | Unlit window panes |
| `ice` | `#A7C6D2` | `#B3D1DD` | `#BFDCE8` | `#CBE7F3` | `#D8F3FE` | Pond, troughs, icicles |
| `reed` | `#5E6A36` | `#687442` | `#727E4E` | `#7C885A` | `#879366` | Cattail stems |
| `scarfRed` | `#AF312C` | `#B84038` | `#C24E45` | `#CC5B51` | `#D5685E` | Scarf, sled, mailbox flag, apples |
| `carrot` | `#D36E04` | `#DC7B27` | `#E6873C` | `#F0934E` | `#F9A05E` | Snowman's nose, carrots |
| `wool` | `#DBD4C4` | `#E7DFD0` | `#F2EBDC` | `#FDF7E8` | `#FFFAEC` | Sheep's fleece |
| `faceDark` | `#312B2A` | `#3A3433` | `#433D3C` | `#4C4645` | `#56504F` | Dark faces, legs, hooves |
| `pink` | `#D99B91` | `#E3A69D` | `#EDB2A9` | `#F7BEB5` | `#FFCAC1` | Pink faces, pig, ears |
| `giftGreen` | `#1F763E` | `#30804A` | `#3F8A55` | `#4D9461` | `#5B9E6C` | Season: wrapping, wreaths |

Rules for the table:
1. No colour outside the table is used in front of the line (file 05, section 1), except the glow colours of the season's bulbs (`GLOW` in `festive.ts`), eye colours of animals, and anything in the wendigo's files.
2. A new material may be added only as a full five-step ladder, built the same way: step 0 chosen, then lightness moved by 0.035 per step in the OKLab colour space with the colour strength scaled by `1 − 0.04 × step`. The tool `tools/miniature/ladder.mjs` (file 03, section 1) does this.
3. If the working tree (v0.8.3) already has animals or props in colours not in this table (pink-faced sheep, for example), keep their step-0 colour as it is in the working tree and take its steps from `shade()` (file 03, section 1), which uses the same method as the tool. Do not repaint an animal to match this table's step 0.

## 5. Which step goes where

The same conventions everywhere, so the whole farm reads as one set.

| Situation | Steps | Example |
|---|---|---|
| Boards side by side on a wall | Cycle 0, −1, 0, +1 by board number | Barn walls: board 0 is step 0, board 1 is −1, board 2 is 0, board 3 is +1, then repeat |
| The gap or seam between boards | −2 | The one-cube seam column between barn boards |
| Post and rail | Post −1, lower rail 0, upper rail +1 | Every rail fence |
| Frame against wall | The frame's own material at 0 | White window frame on red wall |
| Courses of a roof | Cycle 0, −1, +1 by course | Barn shingles |
| Stones in a course | Seeded per stone from −1, 0, +1 | Foundation |
| Tiers of a pine | Lowest third −1, middle third 0, top third +1; then the whole tree shifted by 0 or −1 (seeded per tree) | Yard pines |
| Trunk, limb, twig | Trunk −1, limbs 0, twigs +1 | Orchard trees |
| Body and limbs of an animal | Body 0, legs and ears −1, belly −1, head +1 or its own material | File 06 |
| Under an overhang (R7.3) | One step darker than the part would be | Top 0.4 m of a wall under the eaves |
| Lit glass | `brass` +1, one solid colour | Farmhouse windows |
| Unlit glass | `glass` 0, with the upper pane +1 | Barn side windows |
| Metal fittings | `iron` 0 on wood; `iron` +1 on dark surfaces | Hinges, latches |

Steps are clamped to the range −2 to +2.

## 6. Detail and noise are different things

The coder must add detail and remove noise. This table is the test for which is which.

| Detail (wanted) | Noise (forbidden) |
|---|---|
| A window with a frame, a cross bar, a sill and a snow cap, each a separate part in its own solid colour | A wall whose cubes are three random reds |
| A fence where posts, lower rail and upper rail are three close browns | A fence where every cube is a random brown |
| A crate made of corner posts and slats with dark gaps between the slats | A crate painted with a random speckle to "look like wood" |
| Snow that lies in clean steps and covers whole tops | Snow with random holes, or a painted ripple texture |
| A hinge, a latch and a handle on a door, built from 0.05 m cubes | A single 0.2 m grey cube standing for "a nail" |
| Icicles of planned, repeating lengths | Icicles with random lengths per cube column |
| A soft darker band on the snow along the foot of a wall (from the ground shade map) | A painted grey gradient on the snow |

When an area looks empty, the fix is a real part from file 04's kit or a planned value step. It is never texture, grain, gradient or random tone.

## 7. What stays exactly as it is

- The wendigo, its files, its place, its shot and its pins (file 05, section 1).
- Everything behind the line z = −16: the stubble field, the scarecrow, the forest, the back hills, the mountains.
- Every rule of the game, every timer, bot, score, word list, network call and save.
- The interface: every screen, button, text and layout.
- The place and size of every building, prop, tree and animal.
- The light at dusk and at night, and the light of the barn table, unless Brian picks otherwise from a pair (file 02, section 5).
