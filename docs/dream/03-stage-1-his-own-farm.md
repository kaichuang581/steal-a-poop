# 03. Stage 1: his own farm ("Dozing off")

See `reference/sketch-stage-1.png`.

**He has only just dropped off, so he dreams of his own farm on a snowy night.** Everything is in its real place and nothing is strange yet. This stage is calm on purpose: the player is learning, and the dream has somewhere to go.

*An example.* The sheep trots along the snowy track beside the farm fence. Behind it stand the barn and the silo, then the farmhouse with one window glowing: the farmer's own bedroom. Smoke puffs from the chimney. The bulbs on the fence blink along in time.

Stage colours are in `data/palettes.json` (stage 1). Sizes are on-screen px at 1440 x 900.

## 1. Layers, back to front

| # | Layer | Speed | What it is |
|---|---|---|---|
| 1 | Sky | 0 | Five flat bands of equal height from the window's top to the lane, `sky[0]` to `sky[4]`. Stepped, never a smooth fade. A sixth band, 46 high, just above the lane: `sky[4]` mixed 55% toward `glow` |
| 2 | Stars | 0 | 160 on desktop, 70 on phones. Squares of 2 and 3 px, and 5 x 5 plus shapes; `--frost` at 45%, 65% and 90%. Fixed places, hashed from the night's date |
| 3 | Your words | 0 | File 06 |
| 4 | **Crescent moon** | 0.01 | 96 across, centred 82% across and 22% down the sky. A disc of `#FFE9A8`, with a disc of `sky[1]` 90 across laid over it, 26 to the right and 12 up |
| 5 | **Snowfall** | its own | 46 flakes (20 on the Low tier), 2 x 2 px, white at 78%. Each falls at 30 to 60 px a second and drifts left at 20% of the lane's speed |
| 6 | **Far hills** | 0.08 | Columns 60 wide in `far`. Each column's height is `60 + 30·sin(x/210) + 18·sin(x/67)`, rounded to 12. One pine stands on every column, in `far` darkened 15%. Once every 2,400 px, on a hilltop: **the farm's windmill** (a tower 18 x 46, four blades 34 long), mixed 40% toward `far` |
| 7 | **The farm** | 0.35 | Section 2 |
| 8 | **The farm fence** | 0.8 | Section 3 |
| 9 | **The lane** | 1 | Section 4 |
| 10 | **The field in front** | 1.3 | Section 5 |
| 11 | **The dry-stone wall** | 1.6 | Section 5 |
| 12 | Speed streaks | 2.2 | 6 thin white lines, 1 to 2 px tall and 30 to 90 long, at 27%, in the band from 160 to 10 above the lane. None on the Low tier |

## 2. The farm (layer 7)

One strip, 2,400 px long, that repeats. It stands on a ground band 30 high: `snow` mixed 55% toward `mid`. Every model is the farm's own, built from the diorama recipes at this small size, with every colour of the game's `LADDER` mixed 35% toward `mid` so the farm sits back in the night.

In this order, left to right, with 60 to 140 px between groups:

| Thing | Size | Details |
|---|---|---|
| Barn | Walls 180 x 120 | `barnRed`; a snow roof 56 high; the white X doors 52 x 62 (`trimWhite`) |
| Silo | 50 x 150 | `stone`; a round snow cap, stepped. It stands against the barn's right side |
| Two pines | 70 and 110 tall | `pine`, with a snow row on each tier |
| **The farmhouse** | Walls 160 x 92 | `houseCream`; a gable roof 50 high in `roofBrown`, with snow on its left slope; a chimney 16 x 40 |
| **His bedroom window** | 34 x 36 | On the farmhouse wall. `--lantern-hi`, with a cross of two bars. A glow 70 across at 24% around it. **It is the only lit window on the farm** |
| Scarecrow | 70 tall | A post, arms 50 across, a straw head 22 x 20, a hat |
| Hay bales | 40 x 26 each | Two side by side and one on top, with snow on the top one |
| Coop | 90 x 54 | `coopYellow`; a snow roof |
| Pond | 140 across | A frozen sheet in `ice`, 6 high, with a stone rim and three reeds |
| Three pines | 60 to 100 tall | |

## 3. The farm fence and its bulbs (layer 8)

The farm's own plank fence runs along the far edge of the lane, the whole way.

| Part | Value |
|---|---|
| Posts | 8 x 44, one every 64, in `darkWood`. A snow cap 10 x 4 on each |
| Rails | Two, 5 high, at 30 and 14 above the lane, in `wood` darkened one step |
| The string of bulbs | Hung from post to post. Three bulbs between each pair of posts, each 4 x 6. The wire sags 8 at the middle, drawn in 2 px steps |
| A bulb, unlit | `--lantern` mixed 50% toward `sky[2]` |
| A bulb, lit | `--lantern-hi`, with a glow 20 across at 24% |
| When `FESTIVE` is true | The bulbs take the three festive colours in turn (`#F07A5A`, `#9CCB78`, `#FFD08A`) |

This string matters later: at the first gate the fence falls away and **the string stays**, floating (file 04).

## 4. The lane: a snowy farm track (layer 9)

| Part | Height | Colour and detail |
|---|---|---|
| The track | 14 | `snow`. This is what the sheep runs on. It is the brightest band in the dream |
| Wheel ruts | 2 each | Two lines of `shade`, 4 and 9 below the track's top, the whole way along |
| The bank | 10 | `shade`. A stepped drift, two cells high, leans against every obstacle's post |
| **Hoofprints** | | At each hoof's landing a dent, 6 x 3 in `shade`, stays in the track. It fades after 2 s. At most 24 at once |

## 5. In front of the lane (layers 10 and 11)

Today the bottom third of the screen is flat, empty snow. Here it is a field in shadow, with a wall along the bottom.

**The field** fills from the bank down to the window's bottom edge: `snow` mixed 62% toward `sky[2]`. It is in shadow, so the lane stays the brightest band (measured: the lane is 3.8 times brighter).

- **Crop rows under snow:** one row every 26 px down the field. Each row is a line of ridges, 84 long and 3 high (the field's colour mixed 35% toward `snow`), with a furrow shadow 5 high under each (the field's colour mixed 35% toward `sky[1]`). Ridges repeat every 120, and each row starts 18 further right than the row above. The rows catch the moon; they are a pattern, not noise.

**The dry-stone wall** runs along the window's bottom edge, nearest the camera:
- stones 42 wide and 46 to 56 high, every second one 6 lower;
- `stone` mixed 55% toward `sky[1]`;
- a snow top 5 high on each, in `snow` mixed 30% toward `sky[2]`;
- four stones, then a gap of 12;
- never higher than 60 above the window's bottom edge, so it never reaches the lane.

## 6. Obstacles in stage 1: farm things

Every obstacle keeps its rules box and its on-screen size. Only its look changes. List the obstacle shapes the game has today (`lookOf`) and give each shape the looks below. Each look fills its box exactly.

| Shape of the box | Looks (alternate them) |
|---|---|
| Low and wide | Two hay bales side by side with snow on top. A log pile: three logs under two, round ends showing |
| Fence height | A five-bar gate with a diagonal brace. A plank fence section with two rails |
| Tall and narrow | A brick gatepost with a snow cap. A stack of three crates |

Each obstacle carries two lanterns, on its posts or on its top corners. They are dim until the word is taken (file 06).

## 7. The sheep in stage 1

- **Hoof puffs:** at each hoof's landing a pixel puff is left behind: three frames, 60 ms each. At most 6 at once.
- **Hoofprints** (section 4).
- No wool streaks: this stage is calm.
- **The roll** in the air (file 06).

## 8. What moves to the beat (96 a minute)

| Thing | On each beat |
|---|---|
| The fence's bulbs | A chase: bulb `i` is lit when `(i + whole beats) mod 4` is 0. The lit bulbs walk along the fence |
| The windmill | Its blades step one eighth of a turn, like a clock's hand |
| The chimney | On every second beat, one pixel puff leaves the chimney. It rises 60 px over 1.6 s, grows from 14 to 22 across, and fades |
| Stars | One star in four grows to 1.35 and back |

Two things move to the farmer instead of the beat: **his bedroom window's glow** rises from 24% to 32% and back with each of his breaths (every 3.2 s), and the snow keeps falling.

## 9. What is not in stage 1

No northern light. Nothing floats. Nothing from the bedroom. No wool streaks. Those arrive later, and they only feel like something if this stage does not have them.

## 10. Phones and the Low tier

- **Phones:** two groups of the farm are on screen at a time. The wall along the bottom is 40 high. The far hills' columns are 40 wide.
- **Low tier:** 20 snowflakes, no speed streaks, the far hills without their pines, the field with every second crop row.
