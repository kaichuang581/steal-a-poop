# 04. The first gate and stage 2: the farm lifts off ("Dreaming")

See `reference/sketch-stage-2.png`.

**The dream starts to bend. The ground lets go, and the farm floats.** The player has just seen the barn, the farmhouse and the fence standing on the ground. Now the same barn, the same farmhouse and the same string of bulbs are in the air. That is why this reads as a dream and not as a new level.

*An example.* The sheep passes the farm's gate. The field drops away into mist. The barn rises on its own island with soil hanging under it, the fence posts tumble off, and the string of bulbs is left floating in a slow wave. The moon fills out, the snow starts drifting upward, and a green and blue light begins to dance across the sky.

Stage colours are in `data/palettes.json` (stage 2). Sizes are on-screen px at 1440 x 900. Timings are in `data/timings.json` (`gate1_liftOff`).

## 1. The first gate: "Lift-off"

**The gate itself** is the farm's boundary gate: two plank posts 3.2 sheep high, a beam across the top, nine lanterns along the beam, and a banner (an `ink` tag) reading "Dreaming…" in Nunito 800, 12, `--wool`. It stands on the lane, halfway between the last one-letter fence and the first two-letter fence, behind the sheep. It is scenery only: no rules box, and never within 1.5 sheep lengths of one.

**When the sheep's x passes the gate's x** (times in ms):

| Time | What |
|---|---|
| 0 | The gate's nine lanterns light one after another, 40 apart. The lane shudders 2 px for 300 |
| 0 to 900 | **The field and the wall drop away:** layers 10 and 11 of stage 1 fall 260 px (easing in) and are gone. The mist shows behind them |
| 0 to 900 | **The lane becomes an island:** under the track, the soil and the rock grow downward from nothing to their full depth. The icicles grow last, over the final 200 |
| 0 to 900 | **The farm rises:** each building of stage 1's farm lifts 40 to 90 px, one after another (80 apart), each taking a piece of ground with it. To build this, place stage 2's islands exactly where stage 1's buildings stand, and move them up to their floating heights. Stage 1's ground band fades out in the first 300 |
| 0 to 900 | **The hills sink:** the far hills drop 120 px and fade into the mist |
| 0 to 600 | **The fence falls:** each post and rail drops away, turning up to 20°, one after another. **The string of bulbs stays** |
| 0 to 900 | **The string starts to wave:** its wave grows from 0 to 14 px |
| 450 | **The snow turns round:** the flakes slow, stop, and begin to rise |
| 0 to 600 | Every stage colour blends from stage 1's to stage 2's, easing in and out |
| 0 to 900 | **The moon fills:** the dark disc over the crescent slides off, and the moon grows from 96 to 128 |
| 600 to 1200 | **The northern light** grows from nothing to its full height |
| 0 to 500 | One bright ring spreads from the gate across the whole window: a 3 px line of `--lantern-hi` at 60%, fading to nothing |
| 100 | The card "Dreaming…" / "Two letters now" |

During these 1.2 s, both stages' scenery exists. Before and after, only one stage's does.

With reduced motion: one 200 ms cross-fade from stage 1 to stage 2, and the card.

## 2. Layers of stage 2, back to front

| # | Layer | Speed | What it is |
|---|---|---|---|
| 1 | Sky | 0 | Five flat bands, `sky[0]` to `sky[4]`, and the horizon band, as in stage 1 with stage 2's colours |
| 2 | Stars | 0 | As stage 1 |
| 3 | Your words | 0 | File 06 |
| 4 | **Full moon** | 0.01 | 128 across, centred 82% across and 24% down the sky. `#FFE9A8` with two craters of `#F2D58E`. A halo ring 12 wide at 16% |
| 5 | **The northern light** | 0.03 | Section 3 |
| 6 | **The farm, in the air** | 0.12 | Section 4 |
| 7 | **Fence pieces and pines on clods** | 0.4 | Section 5 |
| 8 | **The bulb string, floating** | 0.8 | Section 6 |
| 9 | **The lane: a floating island** | 1 | Section 7 |
| 10 | **Rising snow** | its own | 40 flakes (18 on the Low tier), 2 x 2 px, white at 75%, each with a 4 px tail under it at 24%. They drift **upward** at 20 to 40 px a second |
| 11 | Speed streaks | 2.2 | 12, as stage 1. None on the Low tier |
| 12 | **Floating rocks** | 1.5 | Stepped rocks in `--ink` at 70%, rising at most 60 px from the window's bottom edge, one about every 700 px. Each turns slowly, 4° each way over 6 s. None on the Low tier |

## 3. The northern light (layer 5)

**Only stage 2 has it.**

- **Vertical bars**, 6 wide and 2 apart, across the middle 52% of the sky.
- Each bar's height is `46 + 30·sin(x/70 + t) + 16·sin(x/23 − 1.7t)` px, where t is the time in seconds.
- The row's top line follows `250 − 26·sin(x/120)` px from the window's top, so the whole ribbon waves.
- Each bar's top 5 px is at 80%; the rest at 37%.
- Colour runs along the row: `#9CCB78`, then `#6FC7D6`, then `#7B67C0`.
- On the Low tier: half the bars (6 wide, 10 apart).

It looks like the light is dancing to the beat (section 9).

## 4. The farm, in the air (layer 6)

The same buildings as stage 1, each now on its own island. Three islands are on screen at a time on desktop, two on phones. They never enter the top 70 px (the counters).

| Island | Top width | On it |
|---|---|---|
| Barn | 140 | The barn, with the silo leaning 6° |
| Windmill | 150 | The windmill. Its blades now turn smoothly: one turn every four beats |
| Farmhouse | 130 | The farmhouse and one pine. **His bedroom window still glows, and still breathes with him** |
| Coop | 90 | The coop |
| Pond | 120 | The frozen pond. Mist spills off one edge: five thin streaks, 2 px wide, falling 60 px and fading |

**Every island is built the same way:**
- a snow top 8 high, overhanging the soil by 3 each side;
- soil 10 high;
- five stepped rows under it, each 8 high, at 86%, 66%, 50%, 30% and 14% of the top's width, each row shifted 6% of the width further to one side, so the tip is off-centre;
- three clods trailing below the tip: 10, 8 and 6 wide, each 8 high, each 10 lower and 22 further along than the last;
- every colour mixed 50% toward `sky[2]`, so the islands sit back.

Each island also drifts 3 px up and down by itself, over 7 to 10 s.

## 5. Fence pieces and pines on clods (layer 7)

The fence that fell at the gate has not gone far.

- One clod about every 150 px, at a height of 60 to 120 above the lane (set by hash, so it never changes).
- Each clod: a slab 44 x 8 with a smaller one 26 x 8 under it.
- On it, in turn: a piece of the plank fence (two posts 22 high and one rail), or one pine 40 tall.
- Colour: `mid` darkened 10%. They are dark shapes against the sky.
- Each tilts 3° each way, over 5 to 8 s.

## 6. The bulb string, floating free (layer 8)

The string of bulbs from stage 1's fence, with no fence.

- It follows `y = lane − 46 + 14·sin(x/90 − 1.2t)` px, a slow wave travelling along it.
- A bulb every 16 px, 4 x 6, on a 1 px wire of `--ink`.
- Unlit and lit colours as in stage 1. With `FESTIVE` true, the three festive colours.

## 7. The lane: a floating island (layer 9)

From the top down:

| Part | Height | Colour and detail |
|---|---|---|
| Snow top | 12 | `snow`. The sheep runs on this. Stepped drifts two cells high lean against every obstacle's post |
| Snow lip | 4 | `shade`. It overhangs the soil by one cell |
| Icicles | 6 to 15 | Under the lip, at 8, 30, 52 and 74 of every 96; 9, 15, 6 and 12 long; tapering in thirds; `snow` with a `shade` tip |
| Soil | 24 | `soil` |
| Lower soil | 22 | `soil2`, with a stone (14 x 10, `soil2` mixed 35% toward `#9A90B8`) every 96, each second one 6 lower |
| Roots | 30 to 56 | Every 260: a root 4 wide hanging 30 from the lower soil, with a second piece beside it, offset 3, hanging 26 further. `darkWood` |
| Underside | 8 to 72 | `rock`, one stepped profile: depth `34 + 22·sin(x/150) + 14·sin(x/47 + 1.3) + 8·sin(x/19)`, rounded down to 8 px steps, never under 8. Its top 4 px is lighter |
| Mist | to the window's bottom | 46 thin streaks, 2 to 3 px tall and 60 to 280 long, `mist` at 27% to 50%, drifting at speed 0.2. **Streaks only, never cloud shapes** |

## 8. Obstacles in stage 2: the farm's things, iced over

The same box shapes as stage 1, with new looks. Every obstacle stands on the lane exactly as before; none of them floats.

| Shape of the box | Looks (alternate them) |
|---|---|
| Low and wide | A snow-covered log with icicles hanging under it. A slab of ice, two cells thick, on two short stone feet |
| Fence height | A plank fence section crusted with ice, with a row of icicles under each rail. A five-bar gate hanging open from one hinge, frozen in place |
| Tall and narrow | The brick gatepost with roots hanging from its base and two small clods beside it. A signpost with three boards pointing three ways, iced |

## 9. The sheep in stage 2

- **Hoof puffs drift upward** 10 px as they fade.
- **Wool streaks:** three white lines behind the body, 44, 52 and 40 long, at 43%, 31% and 24%.
- No hoofprints.

## 10. What moves to the beat (112 a minute)

| Thing | On each beat |
|---|---|
| The islands | Each dips 4 px and comes back. Alternate islands dip on alternate beats |
| The northern light | Every bar grows 20%, then falls back |
| The bulb string | The same chase as on the fence: bulb `i` is lit when `(i + whole beats) mod 4` is 0. The wave carries on underneath it |
| The moon | Grows to 1.02 and back |
| Stars | As stage 1 |

## 11. What is not in stage 2

No ground under anything. No falling snow. No fence. Nothing from the bedroom yet. No button stars, no quilt.

## 12. Phones and the Low tier

- **Phones:** two islands, a moon 77 across, the northern light across the middle 60% of the sky, 18 flakes.
- **Low tier:** half the northern light's bars, 18 flakes, no speed streaks, no floating rocks, clods without their tilt.
