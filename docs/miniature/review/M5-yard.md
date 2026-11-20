# M5: the yard's last clusters, the east track, and the country in front of the line

Branch `miniature/m5-yard`, on top of M4 (`1219735`). Plan file 05, sections 3, 8.6 to 8.8 and 9. All eight clusters
now stand: 17,718 triangles in the whole layer (budget 120,000), built in 117 ms.

## The tracks (section 3)

| Plan | Built | Why |
|---|---|---|
| West track, lane to the hens' gate | Nothing new | 0.8.3 already wears a footpath from the doors' apron to the hens' gate (z 10.6) |
| East track: from the lane at z 11.8 to 12.6 east to x 17.2, then north to the paddock's gate | From the paddock's gate (16.8, 7.5) round the court's corner post to the pasture's trough (8.6, 16.0), on the pasture's side of the fence | Since 0.8.3 the court's fence runs along x 12 from z 7.2 to 15: the plan's line goes through it. This is the animals' own way to water, and gives the wide shot the same line between the paddock and the pasture |
| Hoof dents on both | None | Brian, 2026-11-19: square holes in the ground read as a fault; 0.8.3 has none on the lane either |

Built as two more entries of `WALKS` in `scene/yard.ts` (packed snow, `snow` −1, flat). Nothing of it lies in the paddock.

## The clusters

| Cluster | Plan | Built | Why |
|---|---|---|---|
| `pondSide` | Bench (4.10, 23.50) and skates on the west bank; chopping block and logs south of the woodpile | Bench (10.50, 28.60) with its back to the west, skates (11.00, 29.20) | The pond stands 8 m east and 5 m south and is wider; moved with it the bench stood on the ice, so it is 1.6 m further west, on the bank. The block and logs went to `porch` (below): they are 35 m from the pond now, and a cluster is drawn by its middle |
| `porch` | Four shutters 1.2 m tall, knob, lantern beside the door, broom and crate on the porch floor, on a front facing north | Eight shutters 1.8 m tall (a pair at each of the four front windows, as tall as their frames) on the east front; the knob where the door's cube was; the lantern on the porch post north of the steps; the crate of carrots in the porch's north corner; the chopping block and split logs before the woodshed; the broom by the kitchen door | The farmhouse was rebuilt in 0.8.3. Every strip of wall beside the door holds a shutter, and none of the front wall's free strips is as wide as a broom. There is no woodpile: the logs are under the woodshed on the kitchen end |
| `flockSpot` | By the sheep at (−24, 19) | Moved with the three sheep (+33, −1): bales at (6.70, 18.20), heap at (7.40, 19.40) | They graze in the pasture by the trough now |

One place was fixed by the floating check: the porch lantern's arm started 0.2 m east of the post's face.

## The country in front of the line (section 9): not done

The plan recolours the land's pines, bushes, rocks and stone wall in front of z = −16 without changing a cube. Built
and undone: `check.ts --only wendigo` failed with `fine.countryside.hash` changed. The wendigo's pins hash the
countryside's colours as well as its cubes, and the pins are frozen. So the land outside the farmstead keeps its paint
of 0.8.3 (flat colours already; the diorama's tiered pines). This needs Brian: either the countryside stays as it is,
or he says the pins may be recorded again for a colour-only change, as he did on 2026-11-19.

`countryside.ts` has two lines from M3 that only read its cubes for the ground's shade map; the check passes with them.

## Checks and numbers

- `npx tsc -b` clean; `npm test` 1,851 passed, 86 skipped; build passes; `npm run size` 2.95 kB of headroom.
- `check.ts --only connect,wendigo`: both PASS; pins 408,004; 80,760; 89,907 / 78,779; rays 134, 136, 137.
- Magenta pixels with `?wendigoDebug`: computer 1 and 7 and phone 5: 0. Paddock shot 573 (565 on M1; JPEG).
- High, computer, against the start: shot 0 1,432,386 to 1,148,447 triangles, 239 to 245 draws; shot 1 2,206,282 to
  1,710,682, 454 to 457; shot 5 1,071,278 to 850,476, 161 to 164; shot 7 2,144,078 to 1,683,277, 439 to 447. The
  paddock shot draws none of the layer. At most 8 more draws on a shot (limit 10).

## The ten checks (`M5-clusters.png`, `pairs/pov5-day.jpg`, `pairs/pov7-day.jpg`)

1 recognisable: pass (bench and skates; shutters; block with its axe; bales and heap). 2 solid colours: pass.
3 parts apart: pass (shutter battens, bench boards, log ends). 4 two block sizes: pass. 5 crisp: pass. 6 whole caps:
pass (bench's rear boards, the top bale). 7 nothing floats or passes through: pass after the lantern's move. 8 sizes:
pass. 9 shadows clean: pass. 10 ladder colours: pass.
