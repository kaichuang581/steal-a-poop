# 00. Overview

## 1. Brian's decisions (24 November 2026)

1. Everything on the Counting Sheep screens looks ugly to him: the dream world, the farmer, the typing area and counters, the results card.
2. The farmer is rebuilt to match his reference sheet, one to one.
3. The farmer sleeps in his bed along the bottom of the screen. The dream rises above him as one big thought bubble.
4. The word you type appears as letter tiles in a tray.
5. The dream world: "do whatever is most exciting, i want this to be as cool as geometry dash".
6. How the game *plays* is not novel enough for him, but that comes later. **This plan changes no rule.**
7. It must be high quality and fit the theme, "without just recycling the same stuff over and over again".

Earlier decisions that still bind this work: he heavily dislikes blocky voxel clouds; he dislikes harsh colour contrasts; he wants texture and detail, with shapes that look intended, never random; he found a knitted texture across a whole screen too messy; he wants no element without a reason for being there; the sheep is never shown shorn.

## 2. The idea

**The deeper he sleeps, the less the dream looks like his farm and the more it looks like his bed.**

| Stage | He is… | So he dreams of… |
|---|---|---|
| 1 | dozing off | **his own farm**, just as it is, on a snowy night |
| 2 | dreaming | **the farm lifting off**: the ground lets go and the barn, the mill and his house float |
| 3 | fast asleep | **his bed**: quilt hills, pillow mountains, his red yarn rolling by, buttons for stars |
| Finale | nearly out cold | every sheep he has counted, jumping across a huge moon |

*An example.* At fence 3 the sheep runs past the barn and the farmhouse, where one window glows: his bedroom. At fence 6 the sheep passes the farm's gate, the ground drops away, and the barn rises on its own island under a northern light. At fence 17 it runs past the foot of a giant bed, a quilt rolls over the snow, and the stars drop down on threads and turn into buttons. For the last five fences the moon swells, and the sheep you counted hop across it one by one.

What makes Geometry Dash exciting is rhythm, speed, a world that reacts, and a world that keeps changing. This plan uses those four ideas with the game's own things. It copies none of that game's look.

## 3. What must not change (binding)

- **Every rule:** which words count, how many fences, when the letters go from one to two to three, speeds, when a bump happens and what it does, type-ahead, streaks, Warm Blankets, coins, sharing, practice, the daily reset.
- **The side-on mapping** and every number in plan file 09: SPAN, the art scale, every x position, every obstacle's rules box and its on-screen size. **One thing moves:** the play strip moves up as one piece (file 02). Nothing else in the mapping changes.
- Fence signs stay at least 26 px tall. The lane stays the brightest band of the dream.
- The bedroom stays its own canvas.
- The sheep's model. It is never shown shorn.
- Every string's meaning. Wording changes are listed in file 08.

**This plan overrides** these lines of `PLAN_DIORAMA_SCENERY.md` 6.7: the cloud sea, "keep the wake clouds", and "keep the moon, stars and aurora" as they are. Everything else in 6.7 stands. The style rules of that plan (sections 3.1 to 3.6) and the palette of `PLAN_DEPTH_AND_LIGHT.md` govern every voxel model here.

## 4. The stage rule

**The stage is the number of letters on the current fence's sign: 1, 2 or 3.** Read it from the game. Do not hard-code fence numbers (today the changes come at fences 6 and 17).

On a counted night, the **finale** is the last 5 fences. Practice follows the same stages and has no finale.

## 5. Where every dream thing comes from

Nothing appears in the dream without a reason. Each thing is the farmer's own, and the player can see the original.

| In the dream | Stage | The original | Where the player sees the original |
|---|---|---|---|
| Barn, silo, farmhouse, coop, pond, scarecrow, hay bales, windmill, plank fence | 1 and 2 | The farm | Home's farm |
| The lit window on the farmhouse | 1 and 2 | His bedroom window | The bed strip (the window on the wall) |
| The string of bulbs | 1 and 2 | The farm fence's lights | Home's farm |
| Quilt hills, the quilt under the sheep | 3 | His patchwork quilt (red, cream, green, mustard, navy) | On his bed, in the strip |
| Pillow mountains, feathers | 3 | His pillow | Under his head |
| The candle as a lighthouse | 3 | The candle on his nightstand | In the strip |
| Yarn balls, knitting needles, the thread spool | 3 | His knitting basket (**new prop**, file 01) | By the nightstand, in the strip |
| Button stars | 3 | The three buttons on his nightshirt | On him |
| Books as obstacles | 3 | The five books on his shelf | On the wall, in the strip |
| The alarm clock as an obstacle | 3 | The clock on his nightstand | In the strip |
| The bed's footboard as the second gate | 2 to 3 | His bed | In the strip |
| The moon | all | The moon in his window | The strip's window |
| The sheep crossing the moon | Finale | The sheep you have counted | The counter |

## 6. The three worlds at a glance

Every row differs from stage to stage. That is the test for "no recycling" (file 08, check 9).

| | 1: His own farm | 2: The farm lifts off | 3: Under the quilt |
|---|---|---|---|
| Sky | Navy; a crescent moon | Violet; a full moon; **the northern light** | Plum; a huge moon; **button stars on threads** |
| Weather | Snow falls | Snow drifts **upward** | Feathers fall under the lane |
| Far scenery | Hills, forest, the windmill on a hill | The farm's buildings, each on **its own island** | **Pillow mountains**, the candle lighthouse |
| Middle scenery | The farm on the ground: barn, silo, farmhouse, scarecrow, bales, coop, pond | Fence pieces and pines on small floating clods | **Quilt hills**, yarn balls, knitting needles, a thread spool |
| Behind the lane | The farm fence with its string of bulbs | The bulb string, **floating free**, waving | (nothing: the hills come right up to the lane) |
| What the sheep runs on | A snowy farm track with wheel ruts | A floating island: snow lip, icicles, soil, roots | The turned-down sheet, over the quilt's patches |
| In front of the lane | A shadowed field with crop rows; a dry-stone wall | Mist streaks; dark floating rocks | Mattress stripes; falling feathers; bedpost knobs |
| Obstacles | Farm things: bales, gates, crates | The same, iced and hung with icicles | Bedroom things: books, cushions, spools, the clock |
| What moves to the beat | The bulbs chase; the windmill ticks; the chimney puffs | The islands bob; the northern light jumps; the bulb string waves | Buttons flip; yarn balls roll; needles click; quilt stitches nudge |
| The sheep leaves | Hoofprints in the snow | Puffs that drift upward; wool streaks | Feathers; a dent in the quilt |
| Beats a minute | 96 | 112 | 128 |

## 7. What is the same in every stage, on purpose

The sheep. The fence's sign and its letters. The tray. The counters. The star words. The farmer in his bed. The beat's clock. These are what the player reads and plays with, so they never change shape or place.

## 8. Words used in this pack

| Word | Meaning |
|---|---|
| The lane | The strip the sheep runs along |
| The bed strip | The band along the bottom of the screen showing the farmer asleep |
| The dream window | The thought bubble above the strip |
| The tray | The board of letter tiles you type into |
| The sign | The board hanging over each fence, showing the letters your word must start with |
| A gate | The set piece between two stages |
| Speed | How fast a layer scrolls, as a share of the lane's speed |
| Mixed N% toward X | A colour blended that far toward colour X |
| On-screen px | Sizes at 1440 x 900; they scale with the dream's art scale |
| A unit | 0.02 m, used only for the farmer's model |

## 9. The interface kit

The interface uses the kit already built: `PLAN_HOME_UI.md` (tokens, slabs, knit, `--u`), `PLAN_LEADERBOARD.md` section 4 (Board, Tile, Well, Ink card, felt, nothing flat) and `PLAN_PEN_LOBBY_POLISH.md` section 2 (text, spacing, icon and edge rules). Interface sizes are px at `--u` = 1. A step is `--s`. In pixel grids, `.` is transparent.

## 10. Files to start from

`src/skin/dream/world.ts`, `bedroom.ts`, `DreamSky.tsx`, `DreamStage.tsx`, `BedroomBubble.tsx`. Search for "Tonight's dream", "type ahead", "out cold" and "Not in the dictionary" to find the interface. List every file you change in each pull request.
