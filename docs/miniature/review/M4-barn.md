# M4: the micro layer round the barn

Branch `miniature/m4-barn`, on top of M3 (`615a32f`). Plan file 05, sections 4 and 8.2 to 8.5. Four clusters added
to `MICRO_PLACEMENTS` (`src/skin/scene/farmMicro.ts`); five of eight now stand.

## Where each object stands, against the plan

| Cluster | Plan | Built | Why |
|---|---|---|---|
| `toolCorner` | Broom x −6.10, shovel x −5.80, pail (−6.10, 7.70) | Broom x −5.95, shovel x −5.65; the pail as the plan | The white corner board reaches in to x −5.9 and stands proud of the red boards: the broom's handle was inside it |
| `tractorSide` | Four grille bars, five wheel nuts on the tractor; pump and pail by the trough | Pump at (7.80, 15.75), turned so its spout points north; pail under the spout at (7.75, 15.60). No grille bars, no wheel nuts | The trough stands 2.0 m further south than in v0.8.0, and the pump moves with it. The tractor has been parked behind the barn since 0.8.2, in no shot: fittings on it would be drawn and never seen |
| `henCorner` | Four cleats, basket, two sacks, feed pail at the trough's east end, three bales by the west fence | Moved with the coop (now at (−13, 8.4), its ramp on its south side). Two cleats; the pail at the trough's west end; the sacks 0.4 m east of the window's middle; the bales against the run's west fence by its south corner | The pop door stands on the ramp's first step and its last is under the straw, so two steps have a free top. Two hens stand within 1.2 m of the trough's east end. The straw bed reaches under the window's west half |
| `gate` | Hinges at y 0.45 and 1.05, latch at y 0.80 | Hinges at y 0.45 and 0.85, latch at y 0.90, each turned so its back lies on the leaf's east face | The gate's upper rail is at 0.8 to 1.0 m here |

## A flaw found and fixed on the way

The gate leaf's brace was a line drawn half a cell off the leaf: all that was built of it was five cubes standing out
0.2 m beside the leaf's free end (the latch's place was inside one). It is now in the leaf's own plane, from the hinge's
foot up to the latch's rail (`fence` in `scene/yard.ts`). Below 2 m and outside the wedge; the wendigo's pins hold.

## Rules

- Rule 2 (nothing on the path) is for what stands on the ground: the gate's hinges and latch are on the gate, whose
  leaf stands at the lane's edge.
- The ground's height under a place now knows the hens' straw bed (0.10 m): `STRAW_BED` in `farmMicro.ts`, held to
  the coop's place by a test.

## Checks and numbers

- `npx tsc -b` clean; `npm test` 1,851 passed, 86 skipped; build passes; `npm run size` 3.06 kB of headroom.
- `check.ts --only connect,wendigo`: both PASS (nothing new floats; pins 408,004; 80,760; 89,907 / 78,779; 134, 136, 137).
- The layer: 10,200 triangles in five clusters (budget 120,000), built in 85 ms.
- High, computer, against the start: shot 0 1,432,386 to 1,141,547 triangles and 239 to 244 draws; shot 4 995,188 to
  772,964 and 146 to 147; shot 7 2,144,078 to 1,673,607 and 439 to 444. At most 5 more draws on any shot (limit 10).

## The ten checks (`M4-clusters.png`, `pairs/pov4-day.jpg`)

1 recognisable: pass (broom and shovel read against the wall; pump with its pail; bales, basket, sacks; hinges and
latch on the leaf). 2 solid colours: pass. 3 parts apart: pass (pump's handle, cap and body; hinge on wood).
4 two block sizes: pass. 5 crisp: pass. 6 whole caps: pass (the top bale). 7 nothing floats or passes through: pass,
after the three moves the structure check asked for (broom, cleats, latch). 8 sizes: pass. 9 shadows clean: pass.
10 ladder colours: pass.

## Pictures

`review/M4-clusters.png` (the four clusters), `review/cluster-*.jpg`, `review/pairs/pov4-day.jpg` (the hens' shot),
`pairs/pov0-day.jpg`, `pov3-day.jpg`, `pov6-day.jpg`, `pov7-day.jpg`, `pov4-day-phone.jpg`.
