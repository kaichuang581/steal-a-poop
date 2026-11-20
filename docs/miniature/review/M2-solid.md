# M2: solid colours, chunky structure, sharp edges

Branch `miniature/m2-solid`, on top of M1 (`7bbbfa3`). Plan files 03 and 07 section 2, read against the tree as it
stood at v0.8.3 (`anchors.md`, `inventory.md`).

## What was built

- `src/skin/voxel/paint.ts`: the 25 ladders of file 01, `solid`, `shade`, `meanTone`, `paint`, `byPart`, `seededPart`,
  `SOLID_SNOW`. Tests in `voxel/__tests__/paint.test.ts`.
- `CHUNKY` and `structureSteps` in `voxel/refine.ts`: the near farm, the tractor and what stands in the yard are their
  own blocks, not smoothed. The land and the back hills are smoothed exactly as before.
- `ROUNDED_VOXELS = false` in `voxel/rounded.ts` (the switch and `?voxels=round` stay).
- Repainted with one colour a part: `scene/farmstead.ts` (barn shell and roof, cupola, silo and feed room, fences,
  paddock shed and rack, coop, sty, hens' yard, orchard, tractor, windbreak, drifts, land in front of the line),
  `scene/yard.ts` (ground, path, pond, fence, gate, lantern, mailbox, pines, snowman, sled, feeder, bale stack,
  trough, farmhouse, porch, woodshed), `scene/barn.ts` (walls, front, beams, roof boards, rope, bales, props, floor,
  blown snow, lantern frames, door leaves, tarp, cat, robin), and the letter board's grain in `voxel/table.ts`.
- Pines take their paint by tier (`pinePaint` in `scene/style/pine.ts`): lowest third a step down, top third a step
  up, one tree in three a step darker. The country's pines behind the line keep the diorama's paint.

## Where the tree differed from the plan, and what was done

| Plan (written against v0.8.0) | Tree at v0.8.3 | Done |
|---|---|---|
| Drifts by the yard fence and the barn walls, `w(t)` outline | Those drifts were removed in 0.8.3; the eaves' berms and the lee drifts are ellipses with a soft noisy edge | The ellipses kept, their edge made clean (no noise). `w(t)` has nothing to apply to |
| Pond rim `1 <= pondD < 1.18` | A noisy bank, a second step on the east shore | Whole rim under 1.18; the second step kept, with a clean outline |
| Roof snow: whole roof but the two lowest rows | `blanket` (Brian, 2026-11-19: thinner windward, a lip, bare round the chimney) | `blanket` kept as it is, in `snow` +1 |
| Farmhouse: white window frames, curtains, porch rail, bench | Rebuilt in 0.8.3: timber frames, lit panes, no curtains, rail or bench | Timber `darkWood` 0, sills −1, panes one colour (`brass` +1), boards `houseCream` 0 and +1, eave step, door `roofBrown` 0 and −1, door-knob cube removed (the micro kit's, M4) |
| Yard fence nails, extra snow lumps, random rail caps | Already gone | Posts −1, lower rail 0, upper rail +1 |
| Cattails, woodpile roof snow by random test | No cattails; the woodshed has a blanket | Nothing to do |
| Barn floor: 8% bare places, tufts | One straw mat with a wandering edge, loose straws by the walls | Mat `straw` 0, the trodden ring `straw` −1, loose straws +1, planks `seededPart('wood')` |
| Orchard `capAll` over a 7 m box | Same | Snow on the limbs only (their own cells), none on twigs or trunk. Random draws and `ORCHARD_TIPS` unchanged |
| Field bales, stubble, windbreak behind the line | Same | Untouched: old paint, old snow (`oldSnow`), old pines' shape. The windbreak (in front of the line) takes the tier paint |
| The field's fence crosses the wendigo's zone | Same | In the zone it keeps the paint and the snow it had |

Other deviations:
- Tractor: without smoothing its tyres' lowest row stood 0.05 m over the land (one new floating piece). Each tyre has a
  foot three cubes long pressed into the snow. The model was fixed, not the check.
- Shot 6's camera stands 6 cm east (`[-0.54, 1.9, 14.2]`): unsmoothed, the gate post's snow cap came 0.976 m from the lens.
- The wool pile and the platform in `voxel/table.ts` are left for M6, so the pile stays the colour of the sheep's wool.

## Tests whose expectations changed (look only)

- `homePovFrame.test.ts`: `LENS_TODAY['computer 2']` 0.71 to 0.66. The paddock camera never moves; the court fence's
  corner post keeps the corner of its snow cap, 0.663 m from the lens.
- `scale.test.ts`: the tractor is found by its 0.1 m cubes (was 0.05 m, the smoothed size).
- Baked pictures: 47 went stale because `ROUNDED_VOXELS` changed. All baked again with their own tools; the two play
  cards re-taken by their recipe. `bakeStamp --check`: 47 fresh, 0 stale.

## Checks

- `npx tsc -b`: clean. `npm test`: 1,840 passed, 86 skipped, 0 failed. `npm run build`: passes.
- `npm run size`: PASS, 2.96 kB of headroom.
- `check.ts --only connect,wendigo`: both PASS. Wendigo as pinned: country 408,004; stand 80,760; cone 89,907 / 78,779;
  rays 134, 136, 137 of 153. Nothing new floats (2,684, the stored number).
- Magenta pixels with `?wendigoDebug`: paddock shot 565 on M1 and 573 now (JPEG pictures; the cone's hash and the
  rays are equal); computer 1 and 7 and phone 5: 0.
- Light targets, shot 1 by day: barn wall in sun 179, 80, 68 (red 160 to 200, 2.2 times green); snow in sun 239,
  235, 226; near pine (shot 5) green 1.67 times red.

## Numbers against the start (`start-numbers.json`), High

| State | Triangles | Buffers |
|---|---|---|
| Home shot 0, computer | 1,432,386 to 1,131,748 | 105.8 to 69.7 MB |
| Home shot 1, computer | 2,206,282 to 1,708,278 | 143.8 to 100.4 MB |
| Table, six seats, computer | 948,647 to 846,747 | 64.1 to 44.0 MB |
| Home shot 1, phone | 963,490 to 939,763 | 68.2 to 60.6 MB |

Draw calls unchanged everywhere. Of 282 numbers compared over six states, three tiers and two devices, none is worse.

## Pictures (`review/pairs/`, before on the left)

- Day, all eight shots: `pov0-day` … `pov7-day`; phone `pov0-day-phone`, `pov1-day-phone`.
- Dawn, dusk, night, shots 0 and 1: `pov0-dawn` … `pov1-night`.
- Table, seven players: `table-7`, `table-7-phone`, `table-7-night`, `table-7-phone-night`.
- Switches (off on the left, on on the right): smoothing `pov0-day-smooth`, `pov4-day-smooth`; rounded edges
  `pov0-day-round`, `pov5-day-round`; textured snow `pov1-day-texsnow`, `pov6-day-texsnow`.

## For Brian

- Decisions 2 (chunky), 3 (sharp edges), 4 (solid snow) and 8 (dusk and night unchanged): the pairs above. Each is one
  constant to put back.
- Decision 7, the barn table's palette: the plan's solid floor is built. In the pair it reads flatter than the floor
  of 0.8.2, whose soft patches he asked for on 2026-11-19 ("a flat yellow rectangle"). The plan allows the old
  colours back for the table alone (its treatment B); that is one function, `floor` in `scene/barn.ts`.
