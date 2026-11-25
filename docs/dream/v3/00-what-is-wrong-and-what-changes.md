# 00. What is wrong today, and what changes

## 1. What Brian said (25 November 2026)

| His words | What this plan does |
|---|---|
| "a lot of it is out of theme" | Every scenery colour becomes a colour of the game's own table (`LADDER`). The violet and magenta skies go. The lace edge, the violet squares and the dotted words go (sections 2B and 2D) |
| "it should be infinite, like a high score" | A night has no end of its own. The counter shows your count and your best (file 01) |
| "i dont like the thing on the top where it shows when the background changes" | The meter is removed. Nothing on screen says when a world will change (file 01) |
| "a lot of the stuff just looks very one-dimensional" | The dream is rebuilt from voxel models and seen by a real camera, so things have tops and sides, stand in front of each other and catch light (files 02 to 06) |
| "not exactly very in theme with the cutish voxel stuff the rest of the world like the home scenery is in" | The dream's farm is built in Home's style, from Home's colours, as small copies of Home's own buildings (file 03) |

**Why the build came out flat.** Version 2 of this plan described the dream as layers measured in pixels, and its sketches were flat drawings. The build followed them. That was the plan's fault, not the build's. In this version every picture is rendered in 3D from the same box data the game will load, so there is no flat drawing to copy.

## 2. Every flaw found in the build

Pictures are named as in the build's page ("Counting Sheep Redesign"): `08-stage1` and so on. Close-ups are in `reference/build-today/`.

### A. The dream is flat

| # | Flaw | Seen in |
|---|---|---|
| A1 | Every building and tree is a flat picture. No top or side shows, and nothing casts shade | `08-stage1`, `12-stage2`, `16-stage3` |
| A2 | Three sizes of pixel sit in one picture: the moon (6 px), the buildings (4 to 5 px) and the obstacles (3 px), beside the sheep's real voxels | `sign-3x.jpg` |
| A3 | The sheep is the only thing with light on it, so it looks pasted on | every play picture |
| A4 | The bottom third of the dream is one grey-blue slab with dashes. It reads as water or a road, not snow | `lane-2x.jpg` |
| A5 | Distant pines and fence pieces are the same flat dark shapes, repeated | `08-stage1`, `12-stage2` |
| A6 | Nothing ever stands in front of anything else at a believable distance, so the layers slide like paper | every play picture |
| A7 | World 2's islands are flat cut-outs. The track's underside is two flat bands | `12-stage2` |
| A8 | World 3's quilt hills are a flat grid of squares. Its far "pillow mountains" are flat mauve steps | `16-stage3` |
| A9 | The gates are drawn facing you like goal posts, though they stand across the track | `10-gate1`, `14-gate2` |
| A10 | Obstacles are flat pictures. Their two lanterns are grey squares stuck on the corners | `09-stage1-jumps`, `13-stage2-jumps`, `17-stage3-jumps` |

### B. Out of theme

| # | Flaw | Seen in |
|---|---|---|
| B1 | The skies of worlds 2 and 3 are bands of strong violet and magenta. Those colours are nowhere else in the game, and they clash with the quilt (Brian's rule: no harsh contrasts) | `12-stage2`, `16-stage3` |
| B2 | The quilt's colours are invented (dark red, bottle green, mustard, navy). Home's own quilts, on the clothesline, use five colours of the game's table | `03-bed`, `16-stage3` |
| B3 | The thought bubble's tail is three flat violet squares | `tail-and-snore-3x.jpg` |
| B4 | The bubble's lower edge is a row of scallops. It reads as lace, and the bedroom wall pokes up between them like spikes | `tail-and-snore-3x.jpg`, `lane-2x.jpg` |
| B5 | Your words in the sky: by fence 16 more than twenty pale dotted words lie over the scenery, the sign and the moon. None can be read | `stage-3-sky.jpg` |
| B6 | The button stars are flat dots on hair-thin lines | `stage-3-sky.jpg` |
| B7 | The northern light is a row of flat bars | `12-stage2` |
| B8 | The counter's sheep is a soft, blurred brown picture. Everything else in the interface is crisp pixel art | `top-bar.jpg` |
| B9 | The close button is a bright cream block: the brightest thing in the top bar | `top-bar.jpg` |
| B10 | Hoof puffs are a flat white scribble at the left edge | `06-word-rises`, `12-stage2` |

### C. The meter, and an ending that should not be one

| # | Flaw | Seen in |
|---|---|---|
| C1 | The meter of 30 pips with its "1 2 3" tags tells the player when the background will change, and that the night ends at 30 | every play picture |
| C2 | The counter reads "of 30" | `top-bar.jpg` |
| C3 | The results board reads "Fence 4 of 30" | `21-results-woke` |
| C4 | The card "Nearly out cold / Five fences to go" counts down to an end | `18-finale` |
| C5 | No best score is shown anywhere | all |

### D. Small faults in the interface

| # | Flaw | Seen in |
|---|---|---|
| D1 | The sign's board is tilted about 3 degrees, so its pixel edges are jagged | `sign-3x.jpg` |
| D2 | A yellow tick badge sits on the sign's corner, over its outline. The word on the plank already says the word counted | `sign-3x.jpg` |
| D3 | The sign hangs low. It is drawn over the dream, so the jumping sheep disappears behind it | `05-jump` |
| D4 | The quilt band on the tray and the boards is a row of separate dashes, and the last dash is cut off at the right edge | `tray-3x.jpg` |
| D5 | "Type ahead…" under the Jump button shows at the same moment as "Wait for the next fence" above the tray: two messages for one moment | `tray-3x.jpg` |
| D6 | The snores are three tiny "z" piled on the smallest puff. In world 3 they turn into a white ladder | `tail-and-snore-3x.jpg`, `16-stage3` |
| D7 | The "?" and "!" over the farmer are 10 px tall, yellow on brown: easy to miss | `07-wrong`, `20-pop` |
| D8 | The ready board covers the sheep and the track. Its captions are 11.5 px | `02-ready` |
| D9 | The ready board's third picture shows a sheep over a brown table shape, not a fence | `02-ready` |
| D10 | On phones the sign covers a third of the sky, and the Jump button is an icon with no word | `24-phone-play` |
| D11 | When the dream pops, its rim flies off as white squares | `20-pop` |
| D12 | The developer's read-out shows in picture 22. Make sure a player can never see it | `22-sink` |

### E. The bed strip and the farmer

| # | Flaw | Seen in |
|---|---|---|
| E1 | His head is turned so far toward the viewer that it reads as a head lying on the pillow by itself. No neck or shoulder shows | `03-bed`, `28-farmer-poses` |
| E2 | His arm lies on the quilt as one straight plank | `03-bed` |
| E3 | The quilt is one flat slab in four big blocks. No body shows under it | `03-bed` |
| E4 | The basket by the nightstand shows yarn only. The dream also uses his needles and a spool of thread, so they must be in it | `03-bed` |

### F. The results board

| # | Flaw | Seen in |
|---|---|---|
| F1 | "Your night sky" lists your words in the dotted star letters, which are hard to read | `results-2x.jpg` |
| F2 | That sky box is violet | `results-2x.jpg` |
| F3 | A wide empty space lies to the right of the two facts | `results-2x.jpg` |
| F4 | "best 1" at the end of the streak row will be confused with the new best score | `results-2x.jpg` |
| F5 | The board's quilt band is dashes (as D4) | `results-2x.jpg` |

## 3. What changes, at a glance

| Thing | In the build today | In this plan |
|---|---|---|
| The dream world | Flat pixel-art layers | 69 voxel models, placed in depth, seen by a camera (files 02 to 06) |
| The lane | A white line on a flat slab | A snowy track 2.4 m wide with banks, a real surface the sheep stands on |
| The foreground | An empty slab, a third of the window | A quarter of the window: snow, then Home's dry-stone wall passing close by |
| The gates | Flat goal posts | Gate 1: a small roofed farm gate you run through. Gates 2 and 3: the foot and the head of his bed, standing along the track |
| The length of a night | 30, then on (shown as "of 30") | Endless. A best score. The worlds go round (file 01) |
| The meter | 30 pips in three groups | Removed |
| The last five fences | The finale: a huge moon with sheep on it | "The moon show", every 10 sheep, for as long as the night lasts (file 07) |
| Your words | Dotted words filling the sky | One star rises for each sheep. The words are listed, readable, on the results board |
| The bubble's edge and tail | Scallops; violet squares | A wool rim with a straight lower edge; round wool puffs (file 08) |
| The quilt's colours | Invented | Home's five quilt colours, with cream between them (file 03, section 5) |

## 4. What must not change (binding)

- **Every rule:** which words count, when the letters go from one to two to three, speeds and the ramp past 30, when a bump happens and what it does, type-ahead, streaks, Warm Blankets, coins and the bonus at 30, sharing, practice, the daily reset.
- **The side-on mapping:** the sheep's and every obstacle's place along the lane, every rules box, the art scale. On the lane's plane the new camera puts every point exactly where the mapping puts it (file 02, section 3). **One thing moves:** the play strip moves down as one piece, from 66% to 76% of the window's height (72% on phones).
- The sheep's model. It is never shown shorn.
- The farmer's model from version 2 (it passed its match test at 0.914 and 0.905). Only his poses in bed change (file 09).
- The beat's clock, the tray's way of working (you may type only the rest of the word), the two endings, the opening.
- The bedroom stays its own canvas.
- The wendigo's rules do not come into it: nothing here touches Home.

## 5. Corrections to version 2

These lines of version 2 are withdrawn.

| Version 2 said | Now |
|---|---|
| Layers with speeds in pixels; two 2D canvases for sky and effects | A 3D scene. Speeds come from distance by themselves (file 02) |
| Wheel ruts in the track; hoofprints that stay 2 s | **Removed.** `CLAUDE.md` forbids footprints, hoof dents and ruts (Brian, 19 November: square marks in the ground "just read as a bug") |
| Your words as dotted stars, 30 places in the sky | One star for each sheep (file 08, section 9) |
| The scalloped lower edge; puffs filled with the sky's colour | File 08, section 2 |
| The night track of 30 pips; "of 30"; the finale and its card | File 01 |
| The quilt in five invented colours | Home's five (file 03, section 5) |
| Pillow mountains far away in world 3 | Removed: they read as blocky clouds, which Brian dislikes. The far land is folds of quilt (file 06) |
| The lane at 66% of the window's height | 76%: less empty foreground, more farm and sky |
| The sign's board hung from 2.45 m | From 3.75 m, so the jumping sheep passes under it (file 08, section 5) |
| Cushions as an obstacle | Pillows: he has a pillow, not cushions |
