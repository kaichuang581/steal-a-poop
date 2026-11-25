# T1. The market row

`reference/trading-post-the-market-row.png` shows the whole row. `trading-post-1` to `-4` show each stop as the player sees it.

## 1. What it is

A row of four stops on the farm's snow at dusk, with the farm fence, pines, and Home's barn, silo and farmhouse far behind. The Trading Post opens here, full screen, from the coin button in Home's top bar (a 200 ms fade; nothing swings or slides in). The close tile, or Escape, fades back to Home.

| Stop | Is today's tab | Stands at x | What it is |
|---|---|---|---|
| 1 | Feed Sacks | 0.0 m | A stall with a red and cream awning: three sacks on its counter, a sample bench in front, an odds board beside it |
| 2 | Bell Shelf | 6.4 m | A stand with a green and cream awning: two display steps, and a big brass bell hanging at its left |
| 3 | Missions | 12.4 m | A cork notice board under a little roof, paper slips pinned to it |
| 4 | Barn Book | 18.6 m | A big book standing open on a table, a ledge on its pages for every item |

Opening the Trading Post lands on stop 1 (or the stop the player last stood at this session).

## 2. Axes and the camera

Metres. **x** runs along the row, **y** up, **z** toward the camera. The snow is y 0. All numbers are also in `data/market.json`; where this file and the data disagree, the data wins.

The camera is the level shift-lens camera of the other two voxel plans (`placeShiftCamera`, see `P1`): it looks straight at the row and never tilts. Distance 9.0 m in front of z 0; eye 1.9 m up.

| Stop | Centre x | Scale A at 1440 x 900 (px per m at z 0) | Line where y 0, z 0 lands |
|---|---|---|---|
| Feed Sacks | 0.35 | 185 | 78% of the window height |
| Bell Shelf | 6.4 | 205 | 78% |
| Missions | 12.4 | 212 | 83% |
| Barn Book | 18.6 | 205 | 84% |

For other window sizes, A = the table's value × min(W / 1440, H / 900). Screen x = W/2 + A·(x − centre)·9/(9 − z). Screen y = horizon − A·(y − 1.9)·9/(9 − z), horizon = line − A·1.9. **Test:** at 1440 x 900 on stop 1, the Oat Sack's tag hangs from (−1.3, 2.46, 0.3), which lands at (404, 243) ± 3 px.

**Walking between stops.** Pressing a tab slides the camera to that stop: 500 ms to the stop next door, 700 ms further, easing `cubic-bezier(.3, 0, .2, 1)`; A and the line ease with it. The row is real, so near things pass faster than far ones. The tags on the yarn line swing 6° once and settle. Left and right arrow keys, and a sideways swipe on phones, step one stop. Reduced motion: a 150 ms cross-fade, no slide.

## 3. What stands where

| Model | Where (x, y, z in m) | Count | Job |
|---|---|---|---|
| `feedStall` | (0, 0, −0.1) | 1 | Stop 1. Counter front at z −0.1, counter top at 1.05 m, awning to 3.05 m |
| `sackCrate_*` and `sack_*` | x −1.3, 0, 1.3; crate at y 1.05, z −0.42; sack at y 1.30, z −0.44. **The picked sack and its crate stand 0.12 m forward** | 3 + 3 | Oat (bomb skins), Corn (bursts), Barley (fuse sounds), left to right as today |
| `stallLantern` | (−0.67, 1.98, 0.2) and (0.63, 1.98, 0.2) | 2 | Hang from the front beam, between the sack tags |
| `sampleBench` | (0, 0, 0); its top is 0.35 m up, z 0.4 to 0.9 | 1 | What the picked sack holds stands here (`T5`) |
| `oddsBoard` | (3.0, 0, 0.55) | 1 | The odds, in chalk |
| `barrel` | (−2.62, 0, 0.5) | 1 | Ends the stall on the left; balances the odds board |
| `bellStand` | (6.4, 0, −0.1) | 1 | Stop 2. Lower step top 0.95 m, upper step top 1.65 m |
| `bigBell` | (5.15, 1.44, 0.25), hanging from the stand's bracket | 1 | Names the stand; swings when Bells are spent |
| `noticeBoard` | (12.4, 0, −0.3) | 1 | Stop 3. Cork face 0.2 to 2.5 m up, 3.4 m wide |
| `barnBook8` / `barnBook10` | (18.6, 0, −0.2) | 1 | Stop 4. The 8-pocket book for bomb skins and fuse sounds, the 10-pocket book for bursts |
| `rowPost` | x −3.4, 3.9, 8.9, 10.1, 14.7, 16.0, 21.2; z −0.3 | 7 | Lantern posts between the stops; the season's bulbs run from post to post |
| pavers | three rows at z 1.25, 1.80, 2.35, each paver 0.62 x 0.45 m, 0.02 m high, 0.7 m apart, the middle row shifted 0.35 m. Two in three are `trimWhite 0`, the third `snow −2`, in that fixed order | — | The market lane. The only ground texture: regular, never scattered |
| `fenceBay` | x −9.6 to 28.8 every 2.4, z −5.0, bulbs off | 17 | The farm fence behind the row |
| pines | spire 7 m at (−7.5, −16), (5.4, −24), (11.4, −22), (22.4, −16); cone 5.5 m at (−3.6, −21), (9.6, −16), (17.4, −25); round 6.5 m at (3.6, −17), (15.6, −17), (24.6, −22) | 10 | Home's `tieredPine`; a dark backdrop that makes the awnings stand out |
| `barn`, `silo`, `farmhouse` | (9.5, −34), (15.0, −36), (−8.0, −38) | 3 | Home's own, far and hazed: this is the same farm |

Nothing but an item's own tag is ever drawn in front of an item.

## 4. Light, sky and haze

Dusk, warm, lit by the lanterns. The stalls are the brightest things on screen.

| Thing | Value |
|---|---|
| Face light (what each face keeps of its paint; r, g, b) | top (1.00, 0.90, 0.78), front (0.84, 0.74, 0.66), left (0.52, 0.44, 0.48), right (0.66, 0.56, 0.54), under (0.30, 0.26, 0.32) |
| Tint by depth | z 0 and nearer 1.0; −0.8: 0.90; −1.6: 0.74; −6: 0.66; −20: 0.56; −60: 0.50, straight lines between |
| Sky | `#2B2F58` at the top, `#6A4F74` at 55% of the way down, `#E3A482` at the horizon; 26 small stars in the top 45% |
| Haze | `#B98A86`, from 16 m to 80 m, at most 0.72 |
| Lanterns | glow sprites, never real lights: stall lantern radius 0.6 m, strength 0.32; row post 1.0 m, 0.45. Colour `lit` `#FFD38F` |
| A sack that is not picked | tint 0.86 |

These are targets for the game's own lights. Match the picture's balance; do not paste these numbers over the game's lighting rig.

## 5. The season

With `FESTIVE` on: one string of bulbs from row post to row post between x −3.4 and 14.7, 3.1 m up at the posts and sagging 0.3 m, a bulb about every 0.45 m in the order gold, sage, red. Home's wreath on the far barn. With it off: no bulbs. Lanterns always.

## 6. Small movements

| What | How |
|---|---|
| Awning valances | each tab sways ±1° on a 4 s loop, neighbours half a beat apart |
| Lantern glows | breathe 0.92 to 1.0 on a 3 s loop |
| A sack under the pointer | tilts 2° and back, 200 ms |
| Items on the bench | when a sack is picked, drop in from 0.25 m above, 240 ms each, 40 ms apart, left to right |
| The big bell | swings 14° twice (700 ms) when Bells are spent, with today's bell sound |

All off under reduced motion.

## 7. Phones (narrower than 600 px)

The row is the same. The camera is closer: A = 0.22 × W (86 at 390), the y 0 line at 47% of the height, so the stop is a band across the top 45% of the screen. The lower half is one paper roll that scrolls (`T5` section 6, `T6` section 5). `reference/trading-post-phone-feed-sacks.png`.

## 8. Cost

The whole row is about 17,300 boxes in the pictures; about a quarter of that is the bombs on show at 480 to 620 each. Build every model once as one merged mesh with vertex colours and hidden faces removed. Draw only the stop on screen and its neighbours. Targets: at most 40 draw calls, 60,000 triangles on the High tier, 30,000 on Low (Low drops the far farm, the pines and the back-shelf stock). Frame time no worse than Home's.
