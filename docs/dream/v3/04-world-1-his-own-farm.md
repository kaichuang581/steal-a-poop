# 04. World 1: his own farm

See `reference/world-1-his-own-farm.png`, `world-1-jump.png` and `whole-screen.png`.

**He has only just dropped off, so he dreams of his own farm on a snowy night.** Everything stands on the ground, in its place. This world is calm on purpose: the player is learning, and the dream has somewhere to go.

*An example.* The sheep trots along a snowy track between two low banks. Behind it runs the farm fence with its string of bulbs; beyond that stand the red barn and its silo, then the farmhouse with one window glowing: the farmer's own bedroom. At the bottom of the window Home's dry-stone wall slides past, close and fast.

Every place below is in `data/worlds.json` (world 1). One strip is 96 m long and repeats.

## 1. The ground

| Part | Where (m) | Colour | Note |
|---|---|---|---|
| **The track** | z −1.2 to 1.2; its top at y 0 | `snow +2`, tint 1.0 | The brightest thing in the dream. Meshed plain: no corner shading on it |
| The banks, both sides | From the track's edge outward: 0.3 m wide and one step (0.1 m) high, then 0.4 m wide and two steps, then 0.3 m wide and one step | `snow +1`; tint 0.78 behind the track, 0.60 in front | Home's rule for a trodden path (`PLAN_DEPTH_AND_LIGHT.md` 6.4). The track lies between them like a path cut through snow |
| The snow behind the track | z −150 to −1.2; top at y 0.1 | `snow 0`, tint 0.56 | |
| The snow in front | z 1.2 to 9; top at y 0.1 | `snow 0`, tint 0.50 | In shade, so the track stands out |
| Wind ripples, in front | One low ridge every 1.6 m along the lane, starting at x 0.5: 0.3 m wide, 0.1 m high, lying from z 2.7 to z 4.6. Their two ends are staggered by a fixed order of four: the near-track end moves out by 0, 0.6, 0.2, 0.9 m and the far end in by 0.5, 0, 0.8, 0.3 m | `snow +1` | Home's wind ripples, made finer for this close view. They point at the vanishing point, so they show the ground's depth as they pass |
| Wind ripples, behind the fence | The same rule, from z −8.4 to z −4.4 | `snow +1` | |
| The mill's hill | Three steps of land under the windmill at x 64, z −60: half-widths 11, 8 and 5 m; half-depths 7, 5 and 3.5 m; each 0.8 m high | `snow −1`, `snow 0`, `snow +1` | |
| Far hills (row B5) | Three hills, their middles at x 12, 50 and 82: half-widths 30, 22 and 34 m; 3, 2 and 4 steps. Each step is 1.5 m high, 7 m narrower on each side than the one below, and lies from z −124 + 3k to z −100 − 3k for step k | `snow −2`, `−1`, `0`, `0` | On each hill's top, five small pines at fixed places (a trunk 0.6 m wide, a lower tier 2.2 m wide, an upper tier 1.2 m wide; 3.8 to 5.6 m tall) |

**No wheel ruts, no hoofprints, no dents** (`CLAUDE.md`).

## 2. Row B1: the farm fence and its bulbs

`fenceBay`, 40 of them end to end (one every 2.4 m), at z −3. Each bay is a post with a snow cap, two rails, and a wire that sags between the posts with three bulbs on it. The wire and bulbs are their own part (`string`): at the first gate the fence falls away and **the string stays** (file 05).

## 3. Row F2: the dry-stone wall

`wallBay`, 40 of them end to end, at z 5.6: Home's wall, two courses and a snow cap, 0.6 m tall. It is the nearest thing to the camera, so it passes fastest (1.54 times the lane's speed) and frames the bottom of the picture. Nothing stands between it and the track but snow and ripples, so nothing hides the track.

## 4. The farm, in its order along the strip

| Thing | Model | x (m) | z (m) | Row |
|---|---|---|---|---|
| A spire pine | `pineSpire` | 2 | -33 | B3 |
| A bale stack | `baleStack` | 6 | -9 | B2 |
| A buried shrub | `shrubMound` | 9.5 | -6.2 | B2 |
| The barn | `barn` | 14 | -30 | B3 |
| The silo | `silo` | 19.4 | -29.4 | B3 |
| A stump | `stump` | 22 | -6.6 | B2 |
| A cone pine | `pineCone` | 24 | -13 | B2 |
| A spire pine | `pineSpire` | 26.5 | -36 | B3 |
| The scarecrow | `scarecrow` | 29 | -10.5 | B2 |
| A cone pine | `pineCone` | 30.5 | -33 | B3 |
| A round pine | `pineRound` | 33 | -8.5 | B2 |
| The snowman | `snowman` | 36.5 | -6.4 | B2 |
| The farmhouse | `farmhouse` | 40 | -29 | B3 |
| A buried shrub | `shrubMound` | 44 | -7 | B2 |
| A spire pine | `pineSpire` | 46.5 | -35 | B3 |
| A spire pine | `pineSpire` | 49.5 | -14.5 | B2 |
| The coop | `coop` | 54 | -11.5 | B2 |
| A cone pine | `pineCone` | 57 | -31 | B3 |
| A cone pine | `pineCone` | 59.5 | -9 | B2 |
| A log | `log` | 61 | -6.8 | B2 |
| The windmill, on its hill | `windmill` | 64 | -60 | B4 |
| A spire pine | `pineSpire` | 67 | -13 | B2 |
| A stump | `stump` | 70 | -6 | B2 |
| The pond | `pond` | 73.5 | -9.5 | B2 |
| A spire pine | `pineSpire` | 77.5 | -32 | B3 |
| A buried shrub | `shrubMound` | 78 | -6.6 | B2 |
| A round pine | `pineRound` | 81 | -8.5 | B2 |
| A cone pine | `pineCone` | 84.5 | -35 | B3 |
| A cone pine | `pineCone` | 87 | -14 | B2 |
| A bale stack | `baleStack` | 90 | -9.5 | B2 |
| A spire pine | `pineSpire` | 93 | -11 | B2 |
| A log | `log` | 95 | -6.4 | B2 |

- Things in row B2 pass in front of things in row B3. That is wanted: at one moment a pine hides the barn's corner, a moment later it has moved on.
- The stump, the logs, the snowman and the buried shrubs are Home's own small things. Each stands beside something bigger, never alone in open snow (Home's rule: nothing looks dropped on the snow).

## 5. The sky and the moon

The sky's colours, the haze and the light are in file 02, section 5. The moon is `moonCrescent`, 96 px across at `A` = 90, its middle 42% of the way across the window and 36% of the way from the window's top to the horizon. It does not move with the lane.

## 6. What moves

| Thing | How |
|---|---|
| The fence's bulbs | A chase on the beat (96 a minute): bulb `i` is at full glow when `(i + whole beats) mod 4` is 0, and at 45% otherwise. With `FESTIVE` true they take the three bulb colours in turn; otherwise all are `glow:lit` |
| The windmill's sails | One eighth of a turn at each beat, each step over 120 ms, about the axle given in the model |
| The chimney | At every second beat, three `snow +2` cubes of 0.1 m leave the chimney's top, rise 1.2 m over 1.6 s and shrink to nothing |
| His bedroom window | Its glow rises from 0.55 to 0.70 and back with each of his breaths (every 3.2 s) |
| Snow | 90 cubes of 0.05 m (45 on phones and on Low), `snow +2`, spread from z −14 to z 6 and from y 0 to y 6. Each falls at 0.6 to 1.0 m a second; when it reaches the ground it starts again at the top |
| The sheep's hooves | At each landing, four `snow +2` cubes of 0.05 m jump up 0.25 m and fall back over 260 ms. At most 24 at once |

Under reduced motion only the snow and the hoof puffs stay.

## 7. What the sheep jumps

`obGate`, `obPlanks`, `obBrick`, `obLogs`, `obBales`, `obCrates` (file 03, section 8), each with its signpost. An obstacle's two lanterns are dim (their glow at 0.15) until its word is taken; then they light to full over 120 ms.

## 8. What is not in world 1

No northern light. Nothing floats. Nothing from the bedroom. Those arrive later, and they only feel like something if this world does not have them.

## 9. Phones and the Low tier

- **Phones:** the same world. Their art scale is smaller, so more of the strip shows at once (`reference/phone-dream-window.png`).
- **Low tier:** no rows B4 and B5 (the windmill and the far hills), no ripples, 45 snow cubes.
