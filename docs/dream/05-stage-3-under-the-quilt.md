# 05. The second gate, stage 3 and the finale: under the quilt ("Deep dream")

See `reference/sketch-stage-3.png` and `reference/sketch-finale.png`.

**He is fast asleep now, so the dream is made of his bed.** The hills are his quilt. The mountains are his pillows. His red yarn rolls by, his knitting needles tick, and the stars are the buttons of his nightshirt, hanging on threads. Every one of these things is sitting in the bed strip below, where the player can see it (file 00, section 5).

*An example.* The sheep runs past the foot of a giant bed. A quilt rolls out over the snow, patch by patch. The floating islands sink and turn into pillows. The brightest stars drop down on threads and flip over into buttons. The sheep now runs along a turned-down sheet, and each patch of quilt dips a little under its hooves.

Stage colours are in `data/palettes.json` (stage 3, `quilt`, `yarnRed`, `needle`). Sizes are on-screen px at 1440 x 900. Timings are in `data/timings.json` (`gate2_tuckedIn`, `finale`).

The five quilt colours, used all through this stage: red `#A84A42`, cream `#E6DCC6`, green `#3F6B4A`, mustard `#C99A4A`, navy `#2B3A66`.

## 1. The second gate: "Tucked in"

**The gate itself** is the footboard of his bed, grown huge: two turned wooden posts 3.2 sheep high, each with a round knob, and a rail between them at the top, in `darkWood` and `wood`. A banner (an `ink` tag) on the rail reads "Deep dream". It stands on the lane halfway between the last two-letter fence and the first three-letter fence, behind the sheep. It is scenery only: no rules box, and never within 1.5 sheep lengths of one.

**When the sheep's x passes the gate's x** (times in ms):

| Time | What |
|---|---|
| 0 | The footboard's two knobs light (a lantern glow on each) |
| 0 to 1000 | **The quilt rolls out:** a front moves along the lane from the gate toward both edges of the window, at 1,600 px a second. Behind the front, the snow top becomes the sheet, and each patch of the quilt's face flips in from its top edge in 120. The icicles shrink away; the blanket-stitch ticks appear |
| 0 to 600 | **The islands sink and soften:** each far island drops 40 px and cross-fades into a pillow mountain standing in the same place |
| 0 to 600 | The clods with their fence pieces and pines fall away |
| 0 to 900 | **The quilt hills rise** from below the lane's line: each column comes up 80 px, 40 after the column to its left |
| 300 to 900 | **Stars become buttons:** the 22 brightest stars, 30 apart. For each: a thread draws from the window's top edge down to the star in 200, then the star flips over into a button in 120 |
| 0 to 400 | The northern light's bars shrink to nothing |
| 0 to 300 | The rising snow fades out. From 600, feathers begin to fall under the lane |
| 0 to 600 | Every stage colour blends from stage 2's to stage 3's |
| 0 to 900 | The moon grows from 128 to 190 and moves to its stage 3 place |
| 0 to 400 | The bulb string drifts up out of the window and is gone |
| 0 to 500 | One bright ring spreads from the gate across the whole window, as at the first gate |
| 100 | The card "Deep dream" / "Three letters now" |

With reduced motion: one 200 ms cross-fade from stage 2 to stage 3, and the card.

## 2. Layers of stage 3, back to front

| # | Layer | Speed | What it is |
|---|---|---|---|
| 1 | Sky | 0 | Five flat bands, `sky[0]` to `sky[4]`, and the horizon band, with stage 3's colours |
| 2 | Small stars | 0 | 90 on desktop, 40 on phones: 2 and 3 px squares only |
| 3 | Your words | 0 | File 06 |
| 4 | **Button stars on threads** | 0 | Section 3 |
| 5 | **The huge moon** | 0.01 | 190 across, centred 78% across and 30% down the sky. `#FFE9A8` with two craters. A halo ring 16 wide at 14% |
| 6 | **Pillow mountains and the candle** | 0.1 | Section 4 |
| 7 | **Quilt hills, yarn, needles, a spool** | 0.4 | Section 5 |
| 8 | **The lane: the turned-down sheet** | 1 | Section 6 |
| 9 | **Falling feathers** | its own | 34 pixel feathers (16 on the Low tier), white at 47% and 31%, in the band from 112 below the lane to the window's bottom. Each falls at 12 to 24 px a second and sways 6 px each way over 2 to 3 s |
| 10 | Speed streaks | 2.2 | 18, as before. None on the Low tier |
| 11 | **Bedpost knobs** | 1.5 | Turned wooden posts in `--ink` at 70%: a post 30 wide with a round knob 44 across on top, rising at most 60 px from the window's bottom edge, one about every 900 px. None on the Low tier |

There is nothing between the hills and the lane in this stage: the quilt hills come right up to it.

## 3. Button stars on threads (layer 4)

**Only stage 3 has them.** They are the buttons of his nightshirt.

- 22 buttons on desktop, 10 on phones.
- Each is one of the two button grids (two holes or four), 14 px across, in quilt cream, quilt mustard, quilt red or `--wool-hi`, in turn.
- Each hangs on a thread: a 1 px line of `--wool` at 27%, from the window's top edge straight down, 50 to 240 long (set by hash).
- Shorten any thread that would put its button over the moon's disc, the counters or a card.
- Each sways 3° each way about its thread's top, over 3 to 5 s.

## 4. Pillow mountains and the candle (layer 6)

| Thing | Size | Details |
|---|---|---|
| Pillow mountain | 280 to 360 wide | Six stepped tiers, each 18 high, each 15% narrower than the one below. `#F4F0EA` mixed 45% toward `sky[3]`. At its left end, the pillowcase's stripes: four stripes 3 wide and 30 high, 12 apart, in `#8F97AC` mixed the same way. Two or three are on screen at a time |
| **The candle, as a lighthouse** | 24 wide, 160 tall | One every 2,400 px. A cream candle (`#F4F0EA` mixed 35% toward `sky[3]`) on a brass dish 44 x 8. The flame is a stepped teardrop, 14 x 32, in `--lantern-hi`, with a glow 80 across at 24% |

## 5. Quilt hills (layer 7)

- **Columns** 48 wide. Each column's height is `54 + 22·sin(x/190 + 1) + 14·sin(x/61)`, rounded to 12.
- **Patches:** each column is a stack of patches 46 wide and 22 high, with 2 px seams.
- **Colours:** the five quilt colours in turn. A patch's place in the turn is its column number plus twice its row number, so the colours run in diagonals, like a real quilt. Each is mixed 30% toward `mid`. Each patch's top 2 px is 18% lighter.

On the hills, once in every 2,400 px:

| Thing | Size | Details |
|---|---|---|
| Yarn ball, large | 68 across | The game's yarn red `#C44A3A`, with five darker wrap lines (`#933529`) curving one way and three lighter ones (`#D97A66`) curving the other. A loose strand, 3 px thick, trails 150 px along the hilltops behind it |
| Yarn ball, small | 52 across | The same, with no strand |
| Knitting needles | Two, each 160 long and 5 thick | `#B8B0A6`, each with a round knob 12 across (`#C9C1B6`). Stuck in a hill, crossed like an X, 20° either side of upright |
| Thread spool | 40 x 60 | Standing on end. Two wooden ends, 40 x 8 (`wood`). Between them a body 30 x 44 of quilt navy, with four lighter thread lines across it |

## 6. The lane: the turned-down sheet (layer 8)

From the top down:

| Part | Height | Colour and detail |
|---|---|---|
| **The sheet** | 12 | `snow` (in stage 3 this is `#FBEFF6`). The sheep runs on this. It is the brightest band in the dream |
| Its fold | 3 | `shade` |
| Blanket stitch | 6 | Ticks of `--wool`, 2 wide and 6 high, hanging from the fold, one every 12 |
| **The quilt's face** | 47 | Patches 96 wide with 2 px seams (`--ink` at 30%). The five quilt colours in turn, each mixed 18% toward `soil`. Each patch's top 2 px is 20% lighter |
| The binding | 6 | Quilt mustard mixed 20% toward `soil` |
| The mattress | 32 | Ticking: stripes repeating every 14. 11 of cream (`#E6DFD3` mixed 55% toward `rock`), then 3 of blue (`#8F97AC` mixed 50% toward `rock`) |
| Below | to the window's bottom | `rock`, with the feathers falling through it |

**The squish.** The patch under the sheep's body is pressed in: its top edge sits 3 px lower, and the patch each side sits 2 px lower. When the sheep moves on, a patch springs back over 180 ms. This is drawn only; the sheep's own height and its rules box do not change.

Measured: the sheet is brighter than every patch under it (by 1.6 times over the cream patch, and by 2.9 to 9.9 times over the others).

## 7. Obstacles in stage 3: things from his bedroom

The same box shapes, with new looks. Each fills its box exactly.

| Shape of the box | Looks (alternate them) |
|---|---|
| Low and wide | Two cushions lying flat, one overlapping the other, in a striped pillowcase. A row of four thread spools lying on their sides, in four quilt colours |
| Fence height | **A stack of three books** from his shelf: spines in quilt red, mustard and green, with cream page edges. A knitted fence: two short needles standing upright, with five rows of knitting between them in quilt red and cream |
| Tall and narrow | **His alarm clock** standing on two books. A tall thread spool standing on end |

## 8. The sheep in stage 3

- **Hoof puffs are feathers:** two or three pixel feathers at each landing, in place of the puff.
- **Wool streaks**, as in stage 2.
- **The squish** (section 6).

## 9. What moves to the beat (128 a minute)

| Thing | On each beat |
|---|---|
| Button stars | One button in four flips: it narrows to a fifth of its width and widens again, in 160 ms, as if turning over on its thread |
| Yarn balls | Each turns 30° and rolls 4 px along the hills |
| Knitting needles | On every second beat the pair clicks: each needle swings 6° and back in 100 ms |
| The candle | Its flame grows to 1.15 and back; its glow goes from 24% to 32% and back |
| Quilt stitches | The blanket-stitch ticks under the sheet nudge down 1 px and back |
| The moon | Grows to 1.02 and back |

In the bed strip, the real candle on the nightstand flickers on the same beats as the lighthouse.

## 10. What is not in stage 3

No snow, no icicles, no islands, no northern light, no bulbs, no farm. Stage 3 has no cold thing in it at all: it is warm, soft and indoors.

## 11. The finale: the last five fences

On a counted night only. The world stays stage 3's. One thing is added, and it is the picture the mode is named for.

| When | What |
|---|---|
| The finale starts | The card "Nearly out cold" / "Five fences to go" |
| Over the next 1.2 s | **The moon swells** from 190 to 300 across and moves to 44% across and 38% down the sky. The button threads shorten out of its way |
| From then on, every beat | **One counted sheep sets off across the moon.** It is the sheep silhouette (24 x 16 px, `--ink`). It enters at the moon's left edge and leaves at its right edge four beats later, along an arc that rises 0.62 of the moon's radius at the middle: one long jump. So four or five sheep are on the moon at a time, in a line |
| Each time you count a sheep | One more silhouette joins the line |
| Every fourth beat | A shooting star crosses the sky: a 2 px white head with a 40 px tail, 500 ms long |
| Every beat | Half the buttons flip, the other half on the next beat |
| **The 30th sheep** | Every sheep you counted streams across the moon within 1.5 s, three to a beat. Then the ending (file 07) |

These are not sheep with no purpose: each one is a sheep the player counted, and the counter says how many.

## 12. Phones and the Low tier

- **Phones:** 10 buttons, one pillow mountain, a moon 114 across (180 in the finale), quilt columns 36 wide.
- **Low tier:** 10 buttons with no sway, 16 feathers, no speed streaks, no bedpost knobs, yarn balls that turn but do not roll.
