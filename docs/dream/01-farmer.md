# 01. The farmer

Today's farmer is Santa Claus: a red striped cap and a long white beard. Brian's farmer is a slim older man with a short grey beard, an off-white nightcap with one thin red band, and a long cream nightshirt with thin blue stripes. This file rebuilds him to match `reference/farmer-sheet.png`.

## 1. The model

**The exact model is `data/farmer.boxes.json`: 106 boxes.** Build him from that file. The table below explains it; where they differ, the file wins.

- **One unit is 0.02 m.** Standing, he is 84 units tall (1.68 m).
- x runs across him: + is **his** left (the viewer's right when he faces you). y is up from the floor. z is front to back: + is his front.
- **Every width is an odd number of units**, so he has a true centre column. That is how the sheet's centre stripe, buttons and nose line up. Column 0 is the centre line.
- Main masses are large boxes. Small details (stripes, eyes, brows, buttons, the band) are 1 unit.
- His sleeves lean outward as **two stepped boxes**, never a rotated box. That keeps every cell on the grid.

| Part | Size (wide x high x deep) | y from the floor | Colour | Details |
|---|---|---|---|---|
| Slippers (2) | 8 x 5 x 13 | 0 to 5 | `#B8B0A6`; sole row `#9E968C`; top row `#C9C1B6` | Columns 3 to 10 each side. The top row stops 2 short of the toe, so the toe steps down |
| Legs (2) | 6 x 4 x 6 | 5 to 9 | `#4A3A2C` | Columns 4 to 9 each side |
| Nightshirt, skirt | 23 x 16 x 15 | 9 to 25 | `#E6DFD3`; the hem's bottom row `#D8D0C4` | |
| Nightshirt, chest | 21 x 30 x 13 | 25 to 55 | `#E6DFD3` | The shoulder row (55 to 56) is 19 wide, so the shoulders slope |
| Stripes | 1 wide | 10 to 55 | `#8F97AC` | **One on the centre column, then every 4**: columns 0, ±4, ±8, on the front and the back. On each side: three, at the middle and 4 either way. The centre front stripe stops under the placket |
| Placket | 1 x 14 | 38 to 52 | `#D8D0C4` | The centre column, with three buttons (1 x 1, `#BFB6AA`) at 40, 44 and 48 |
| Collar | a V | 52 to 56 | skin `#C9A589` | 3 wide at the top (54 to 56), 1 wide at its foot (52 to 54) |
| Sleeves, upper (2) | 6 x 12 x 6 | 42 to 54 | `#E6DFD3` | Columns 11 to 16: joined to the chest at the shoulder |
| Sleeves, lower (2) | 8 x 10 x 7 | 32 to 42 | `#E6DFD3` | Columns 12 to 19: one column clear of the body, flaring outward |
| Cuffs (2) | 8 x 2 x 7 | 30 to 32 | `#D8D0C4` | |
| Sleeve stripes | 1 wide | with the sleeves | `#8F97AC` | Column 13 on the upper sleeve; columns 14 and 18 on the lower; front and back |
| Hands (2) | 6 x 6 x 5 | 24 to 30 | `#E3C6AB` | A row of fingers, 4 wide, under each (23 to 24). A thumb (2 x 2 x 1, `#D6B596`) on the front inner side |
| Neck | 7 x 2 x 7 | 56 to 58 | `#C9A589` | Mostly hidden by the beard |
| Head | 17 x 16 x 17 | 58 to 74 | `#E3C6AB` | |
| Ears (2) | 1 x 4 x 3 | 64 to 68 | `#D6B596` | Column 9 each side |
| Hair | 1 thick | 60 to 73 | `#B9B2A6` | The whole back of the head, and both sides behind the ears. Above the ears it runs forward to the face |
| Sideburns (2) | 2 x 11 x 1 | 62 to 73 | `#B9B2A6` | Columns 7 and 8 on the face, from the beard up to the cap. The skin of the face is 13 wide between them |
| Eyes (2) | 2 x 2 | 68 to 70 | `#3D2818` | Columns 4 and 5 each side. Closed: a 3 x 1 line of `#7A6C5C` |
| Brows (2) | 4 x 1 | 71 to 72 | `#7A6C5C` | Columns 3 to 6, one unit forward of the face |
| Nose | 3 x 5 x 2 | 64 to 69 | `#D6B596` | The centre columns, 2 forward |
| Moustache | 9 x 2 x 1 | 62 to 64 | `#B9B2A6` | |
| Beard | see details | 55 to 62 | `#B9B2A6`; one row under the mouth `#A69E92` | Across the whole face from 58 to 62, 2 forward. Under the chin: 13 wide at 56 to 58, 9 wide at 55 to 56. It ends just below the shoulder line, as on the sheet |
| Mouth | 3 x 1 | 61 to 62 | `#6A5142` | Inside the beard. Open (deep sleep): 3 x 3 |
| Cap, brim | 19 x 1 x 19 | 73 to 74 | `#E1DAD0` | One unit proud of the head all round |
| Cap, band | 19 x 1 x 19 | 74 to 75 | `#B5594C` | **The only red on him** |
| Cap, dome | 19 x 3, then 17 x 2, 15 x 2, 11 x 2 | 75 to 84 | `#E1DAD0` | Centred. A round, low dome, as on the sheet |
| Cap, tail | 3 x 14 x 3 | 65 to 79 | `#E1DAD0` | On his left, columns 10 to 12, touching the side of his head. Then a red ring (3 x 1 x 3, `#B5594C`, 64 to 65) and a pom-pom (5 x 5 x 5, `#E9E3DA`, 59 to 64) |

**Rules**
- Sample every colour from the sheet with a script and correct the file where a colour is off. Then pass each through the depth plan's `harmonize()`, as for the animals.
- Where views of the sheet disagree, the front view wins, then the back view.
- Find how the farmer is built today. Keep his part names and pivots where they exist, so today's animations still run. The file's parts are: `body`, `head`, `cap`, `capTail`, `armL`, `armR`, `handL`, `handR`, `legL`, `legR`, `slipperL`, `slipperR`. List the mapping in the pull request.
- He replaces the old farmer **everywhere**: the bed strip, the results bedroom and anywhere else he appears. With `FESTIVE` true he still wears his own cap.

## 2. Proving the match

`reference/farmer-model-check.png` shows this model drawn straight on beside the sheet. Its front outline overlaps the sheet's by 0.92 above the hem. The built model must do as well:

1. **A farmer board** at `?preview=farmer` (development only): the built model from the front, back, left, right, top and three-quarter view, on the sheet's off-white, each beside the same view cropped from the sheet. Under them, every pose of section 3.
2. **A test:** render the front and back views straight on, scale them to the sheet's figure (340 px tall in the sheet's front view), and compare outlines from the cap's top to the hem. The overlap (shared area over total area) must be at least **0.88**. Then check the colour at 12 points: cap, band, face, eye, beard, nightshirt, stripe, sleeve, hand, leg, slipper, hair at the back. `tools/farmer_check.py` shows the method. Use `tools/propMatch.mjs` if the repo has it.
3. **Brian compares the board with his sheet before anything else is built** (milestone CS1).

## 3. Poses

Poses are data, blended in the frame loop (as on the leaderboard stage). The numbers are in `data/farmer.poses.json`.

In bed he lies on his back with his head at the headboard end, which is the screen's left. So **his right side faces the camera**. "Near" below means his right; "far" means his left.

| Pose | When | What |
|---|---|---|
| `stand` | The farmer board only | As the sheet |
| `bedSleep` | Stages 1 and 2 | On his back, head on the pillow. His head is turned 20° toward the camera, so one eye, the nose and the beard show. Eyes closed. The near arm lies on the quilt along his side. The far arm is under the quilt. The quilt reaches his armpits. The cap's tail lies on the pillow toward the headboard. His chest, and the quilt over it, rise 4% and fall every 3.2 s. The beard rises half a unit with it |
| `bedDeep` | Stage 3, the finale, and the "drifted off" results | As `bedSleep`, with the mouth open, the head rolled back 8°, the cap slipped 3 units down over the brows, and the near arm hanging off the side of the bed, 70° down. He breathes every 4.0 s, with a 0.2 s hitch at the top: a snore |
| `bedStir` | The fence is close | The brows drop one unit. The head turns 10° more toward the camera. The near hand turns 30° and grips the quilt. He breathes every 1.6 s. He blends in over 250 ms, and back to sleep over 400 ms once the fence is cleared |
| `bedJolt` | A bump | In 120 ms: his body rises 25° off the pillow, the eyes open wide (2 x 3), the brows rise 2 units, the mouth opens, the cap's tail swings up 40°. An "!" pops over his head. Held 300 ms, then the waking (file 07) |
| `bedUpright` | The "woke up" results | Sitting up straight. Both hands flat on the quilt, one each side. Eyes open. The brows' inner ends one unit lower: he is grumpy. The cap leans 12°. **No arm ever crosses his face or beard** (today a striped arm crosses his beard) |

**His "z"s.** The pixel "z" rises from his nose, along the bubble's tail, into the smallest puff, and fades there. Colour `--wool-hi`.

| Stage | One every | Size of one art pixel |
|---|---|---|
| 1 | 0.8 s | 2 px |
| 2 | 0.6 s | 3 px |
| 3 | 0.45 s | 4 px |

When a word is taken, he lets out one extra "z", one size larger.

**Small reactions**
- A wrong word: a "?" over his head for 800 ms. He does not move.
- A word taken: the extra "z".

## 4. The bed strip

The strip is the existing bedroom, in its own canvas, seen through a second camera.

| Part | Value |
|---|---|
| Camera `bedSide` | On the room's open side, 0.35 m above the mattress, looking straight at the bed's long side. Field of view 20° |
| Framing | The headboard's outer edge is 24 px from the strip's left. The foot of the bed ends 70 px before the bed zone's right edge |
| The wall | The plank wall and the green panelling run the strip's full width. Extend their meshes if they are too short. The window, with snow on its sill and the moon in it, sits at the strip's right end on screens 1200 wide or more |
| Light | The candle and a little moonlight. The strip's average brightness is at or under 0.22, so the dream above is the bright thing. The farmer's face is at 0.45 or more, so he reads clearly |
| Phones | The camera moves in to his head and shoulders |
| Cost | On the Low tier the strip may redraw on every fourth frame. Poses still ease |

**The originals.** These things must be visible in the strip, because the dream is made from them (file 00, section 5). On screens 1280 wide or more, none of them is hidden by the tray.

| Thing | Where | Details |
|---|---|---|
| His quilt | On the bed | Seven patches along its side in the five quilt colours: red `#A84A42`, cream `#E6DCC6`, green `#3F6B4A`, mustard `#C99A4A`, navy `#2B3A66`. Each patch's top row is 25% lighter. It rises over his body |
| His pillow | Under his head | White `#F4F0EA`, with a shaded bottom row |
| The nightstand | In the gap after the foot of the bed | As today |
| The candle | On the nightstand | Its glow is a soft disc at 15%. **It flickers to the beat** only when the dream is in stage 3 (file 05) |
| The alarm clock | On the nightstand | As today |
| The shelf | On the wall above the nightstand | **Five books**, standing: red, mustard, green, navy, cream. Some of these exist today; make them five in these colours |
| **The knitting basket (new prop)** | On the floor beside the nightstand | A small wicker basket, 0.3 m wide. In it: one ball of the game's red yarn (`#C44A3A`, the loading screen's yarn) and two steel knitting needles standing crossed. Build it from the diorama recipes and place it through the placement list |
| His slippers and the rug | On the floor | As today |

The small cloud-shaped bubble of today is removed. The whole dream window is his bubble now (file 02).
