# 05. Home: the farm, asset by asset

Home is the start screen: the farm seen by a camera that tours eight shots on a computer and six on a phone. This file says what is protected, what each part of the farm gets, and where every micro object stands.

All coordinates are metres in the world of the pushed code (v0.8.0): +x is east, +z is south (toward the farmhouse), y is up, the barn's open back doors are at z = 7 and face south. If the working tree has moved something, section 2 says how to carry a position over.

## 1. The wendigo: kept exactly as it is

### 1.1 What is frozen (from `CLAUDE.md`; nothing here is new)
- No change in `src/skin/table/Wendigo.tsx`, `src/skin/table/wendigoPose.ts`, `src/skin/table/WendigoPreview.tsx` or `public/models/wendigo.glb`.
- `WENDIGO_AT` (−9.6, −36.1) and `CLEAR_SIGHT_LINES` in `src/skin/scene/countryside.ts` do not change; `isClear` keeps reading the frozen lines.
- `POV_SHOTS.desktop[2]` and `POV_SHOTS.phone[2]` (the paddock shot) do not change: position, target, lens, push.
- The numbers in `tools/scenes/wendigo.pins.json` do not change and are **not re-pinned**: the country's 487,002 cubes; the 80,760 country cubes and 87,124 cubes of every kind within 12 m of where it stands; the 89,907 cubes in its view cone (76,449 country, 13,103 back hills, 355 mountains); the rays 134, 136 and 137 of 153.
- The figure's magenta mask in the paddock shot overlaps the old one by at least 0.98.

### 1.2 The line
**z = −16 is the line.** Behind it this plan draws nothing, removes nothing, recolours nothing and lights nothing differently. That covers the stubble and its six bales, the scarecrow, the forest, the back hills, the mountains, and the land they stand on.

In front of the line, the country's cubes (`countryside.ts`, `distance.ts`) and the land's cubes (`terrainSteps`) are also never added or removed, because the pins count them. Only their colour may change, and only where section 9 says so.

### 1.3 The keep-clear wedge
The paddock camera looks across the farm at the wendigo. The wedge is the ground under that view, with a wide margin (14° each side of the line to the figure, for both ends of the camera's push; the pinned cone itself is about 6° each side).

**Wedge: the four-sided area with corners (22.5, 7.5), (18.0, 7.5), (−6.5, −16.0) and (12.5, −16.0).**

Inside the wedge:
1. **Nothing new rises above y = 2.0 m.** The lowest pinned ray passes 2.1 m above the ground at the camera and climbs from there.
2. **Whatever stands there today keeps its place and its cubes** if it is taller than 2.0 m: the east side of the silo, the barn's north-east corner and the roof above it, the paddock shed. They are repainted only (file 03, section 7). The one tested exception is the smoothing change of file 03, section 4.
3. Lower things there (paddock fence, hay rack) may have their snow caps made whole (file 03) but keep their place and stay under 2.0 m.
4. **No micro object stands in the wedge or anywhere inside the paddock** (x 12 to 22, z −14 to 7). A placement inside either makes `farmMicro.ts` throw.
5. Flat things are free: ground colour, tracks and the ground shade map.

### 1.4 The paddock shot keeps today's picture settings
On `PADDOCK_SHOT`, on every tier, through `exemptShot()`: sun 20° up and 35° round, `TODAY_SUN` colours, haze 0.012, ACES tone mapping, exposure 1, shadow box ±20 m round the barn, shadow radius 1, tilt-shift 0.15, the same place in the tour and the same hold and dip times. File 02 switches all of these in the dark dip before and after the shot. Every micro cluster is hidden on this shot.

The shot's foreground will look different (solid colours, whole snow caps on the rails). Its upper part, where the wendigo stands, will not.

### 1.5 Other shots: the wendigo must be no easier to see
The place where the wendigo stands also falls inside the frame of three other shots: computer shot 1 (whole farm, 83 m away, upper left), computer shot 7 (across the pond, 72 m, upper right) and phone shot 5 (the path, 60 m, top left). Today the haze hides that far treeline. File 02's fitted haze thins it there.

Check once, in M1, after Change A: photograph those three shots with `?wendigoDebug` (which paints the figure magenta), before and after. Count the magenta pixels.
- If the count is zero in both, or not higher after: nothing to do.
- If it is higher after: show Brian the pair (decision 5). Until he answers, that shot keeps haze 0.012.

### 1.6 The one check that is never skipped
After any commit that touches Home, the land or the country, run `npx vite-node tools/scenes/check.ts -- --only wendigo` (about 25 seconds). It must pass with the pins file unchanged. If it fails: undo the commit and stop. Do not edit the pins, the check, or `src/skin/scene/__tests__/wendigoFence.test.ts`.

## 2. Anchors (for milestone M0)

Every position in this file hangs on one of these anchors. In M0 the coder finds each anchor in the working tree and writes its real position into `docs/miniature/anchors.md`. If an anchor has moved, every placement that names it moves by the same amount. If an anchor is missing, stop and ask.

| Anchor | In v0.8.0 | Source |
|---|---|---|
| Barn floor | x −6 to 6, z −4 to 7; walls 4.2 m; ridge 6.4 m | `BARN` in `src/skin/scene/layout.ts` |
| Barn south wall | The boards' outer face is at z = 7.2. Standing 0.1 m proud of it, out to z = 7.3: the stone foundation (y 0 to 0.4), two level rails (y 0.9 to 1.1 and y 3.0 to 3.2, for x beyond ±2.1), and the white door frame. Corner boards out to z = 7.4 at x ±6.2 to ±6.4 | `walls()` in `barn.ts`; `barnShell` in `farmstead.ts` |
| Open back doors | x −1.8 to 1.8, 3.4 m high; each leaf hinged at (±1.8, 7.25), swung out to about (±2.1, 9.0), 0.2 m thick | `BARN.backDoor`; `leaf()` and `doorLeaves` in `barn.ts` |
| Door lintel (white) | y 3.4 to 3.7 across x −2.0 to 2.0, its face at z = 7.3 | `barnShell` |
| Hoist beam | x −0.1 to 0.1, y 5.8 to 6.0, out to z = 8.5; iron block under its end at y 5.6 to 5.8 | `barnShell` |
| Hero sheep | (0, 0, 8.2) | `FarmBackdrop.tsx` |
| Silo | centre (9.7, −0.8), radius 1.9, 10.5 m high | `FARM.silo` |
| Tractor | centre (9.6, 8.6), nose toward −x; body x 7.6 to 11.3, z 7.4 to 9.9 | `FARM.tractor`, `tractor()` |
| Coop | centre (−12, 1.5); walls x −13.8 to −10.2, z 0.2 to 2.8; floor 0.4 m up on legs; ramp on the south side at x −13.2 to −12.6 | `FARM.coop`, `coop()` |
| Hens' run | x −19 to −8.6, z −5 to 8; gate gap at z = 8, x −13 to −11 | `FARM.run` |
| Hens' feed trough, water pan, perch | Trough x −16.0 to −14.0, z 4.9 to 5.5. Pan at (−9.8, 5.2). Perch x −17.4 to −15.5 at z 6.6 | `henYard()` |
| Paddock | x 12 to 22, z −14 to 7; gate gap at z = 7, x 15.6 to 18 | `FARM.paddock` |
| Yard fence and gate | z = 15, x −16 to 16; gate x −1.6 to 1.6; gate leaf at x −1.4 to −1.2, z 15.2 to 18.0 | `YARD.fence`, `fence()` in `yard.ts` |
| Main path | Centre line x = −9 × smooth((z − 15) / 8), half-width 1.2, from z = 7 to 24.6 | `pathX`, `onPath` in `yard.ts` |
| Snowman | (4.5, 11), 2.1 m tall | `YARD.snowman` |
| Sled, mailbox, bird feeder | Sled x 2.0 to 2.6, z 13.0 to 14.4. Mailbox at (2.8, 14.2). Feeder post at (−2.8, 12.4) | `yard.ts` |
| Trough (yard) | x 5.8 to 7.6, z 13.6 to 14.4 | `trough()` |
| Woodpile | x 2.2 to 5.0, z 19.0 to 20.6 | `woodpile()` |
| Pond | centre (10, 24), radii 4.5 and 3 | `YARD.pond` |
| Farmhouse | centre (−9, 30); front wall face at z = 27.0, x −12.6 to −5.4; porch floor 0.6 m up, x −11 to −7, z 25.4 to 27; door x −9.4 to −8.6; windows x −11.8 to −10.4 and −7.4 to −6.0, y 1.4 to 2.8 | `farmhouse()` |
| Loose sheep | (−24, 19), (−27.5, 21.5), (−21.5, 23) | `LIVESTOCK` in `Farmstead.tsx` |
| Season's big tree and presents | Tree at (−4.2, 9.2), 4.4 m. Presents at (−3.1, 10.2), (−4.4, 10.8), (−5.5, 10.2), on the sled at (2.3, 13.5) and (2.3, 14.1), and behind the tractor at about (13.3 to 14.0, 9.0 to 9.8) | `buildFestive`, `buildFarmFestive` in `festive.ts` |
| Season's candy canes | Both sides of the path at x = −2.6 and x = 1.5, z = 10 and 12.4 | `buildFestive` |

## 3. The ground

| Zone | Where | Colour | Note |
|---|---|---|---|
| Open snow | Everywhere else in front of the line | `snow` 0 | Yard grid and land, file 03 |
| Main path | As today | `snow` −1 | With today's hoof dents and sled tracks in `snow` −2 |
| West track (new) | 0.8 m wide. From the main path at z 11.4 to 12.2, west to x = −12.4; then north along x −12.4 to −11.6 up to the hens' gate at z = 8 | `snow` −1 | Flat colour only, no height change |
| East track (new) | 0.8 m wide. From the main path at z 11.8 to 12.6 (south of the snowman), east to x = 17.2; then north along x 16.4 to 17.2 up to the paddock gate at z = 7 | `snow` −1 | Flat colour only |
| Hoof dents on the two tracks | One dent every 0.45 m, alternating 0.2 m left and right of the track's middle, as the main path does today | `snow` −2 | Same `dent()` as the path |
| Drifts | By the yard fence, the barn's walls, the pond's rim | `snow` +1 | Outlines by file 03, section 3.1 |
| Straw bed | Hens' yard | `straw` 0 and −1 | File 03, section 7.1 |
| Pond | Ice with skate marks | `ice` 0, `ice` +2 | |
| Ground shade | Under and beside everything | From the map | File 04, section 5 |

The two tracks give the wide shot (the whole farm) readable lines between the barn, the hens and the paddock, in place of one flat white field. They are built in `ground()` in `yard.ts` with a test like `onPath`. They lie in the yard only (z ≥ 7). The west track passes 0.2 m south of the season's presents; the east track passes 0.2 m south of the snowman and north of the sled. Check both on the review picture.

The paddock's floor stays `snow` 0, so the paddock shot's ground keeps one tone.

## 4. Buildings: what each gets

File 03 repaints every building. This table lists what else each gets.

| Building | Eave step (R7.3) | Micro fittings (placed in section 8) | Not touched |
|---|---|---|---|
| Barn | Top 0.4 m of all four walls, one step darker | Two wall lanterns beside the back doors, a horseshoe on the lintel, a rope and hook on the hoist beam | Roof cubes, cupola, weathervane, door leaves |
| Silo | None | None (in the wedge) | Every cube |
| Paddock shed and hay rack | None | None (in the paddock) | Shed cubes |
| Coop | Top 0.2 m of the walls under the roof | Four cleats on the ramp | |
| Farmhouse | Top 0.4 m of the walls | Four shutters, a door knob, a wall lantern | Chimney smoke, window places |
| Tractor | None | Four grille bars, five wheel nuts | Shape |
| Yard gate | None | Two strap hinges, a latch | Gate's place and swing |

## 5. Trees

| Tree | Paint | Shape |
|---|---|---|
| Yard pines (ten) | By tier, file 03, section 7.2 | Unchanged; chunky on every device |
| Orchard trees | Trunk −1, limbs 0, twigs +1; snow on limbs | Unchanged; `ORCHARD_TIPS` identical |
| Country trees in front of the line | Section 9 | Cubes identical |
| Country trees behind the line | Untouched | Untouched |

## 6. Animals and the season on Home

File 06. In short: animals keep their shapes and places and get solid colours with value steps; the season's decorations get solid colours; bulbs keep their glow.

## 7. Keep-clear list for micro objects

Nothing from the kit may stand:

| # | Where | Why |
|---|---|---|
| 1 | In the wedge or the paddock | The wendigo (section 1.3) |
| 2 | On the main path or the two tracks | They must read as walked ground |
| 3 | In the doorway: x −1.8 to 1.8, z 7.2 to 15, below 3 m | The hero, and tour shots 0, 3 and 6 |
| 4 | Within 1.2 m of an animal's place in `LIVESTOCK`, or of the hero | Animals move a little |
| 5 | Within 1.9 m of the season's big tree at (−4.2, 9.2); within 0.3 m of any present or candy cane | The season is on (`FESTIVE = true`) |
| 6 | Between the tractor shot's camera (6, 2.6, 16.6) and the tractor, if it would show in that shot | Shot 5 is the tractor's |
| 7 | Within 0.4 m of the snowman, the sled, the mailbox or the bird feeder | Existing props |

`farmMicro.ts` checks rules 1 to 5 and 7 in code and throws on a breach. Rule 6 is checked on the review picture.

## 8. The micro clusters

Eight clusters. "Ground" in the y column means the object stands on whatever the ground is there: the yard's snow (0), the land (−0.05) or the straw bed (+0.10). `farmMicro.ts` looks that up. A number in the y column is the height of the object's underside in metres. x and z are the object's minimum corner, on the 0.05 m grid. "Turn" is in quarter turns about y; 0 means the object as the kit describes it.

### 8.1 `workCorner`: the barn's south wall, east of the doors, and the doorway (milestone M3, the proof)

Seen in shots 0 and 5. Drift cubes under these footprints are removed.

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `cartWheel` | 2.60 | ground | 7.30 | 0 | Against the foundation, under the lower rail, 0.28 m east of the open door leaf |
| `pitchfork` | 3.60 | ground | 7.25 | 0 | Leaning: its foot 0.2 m out, its top one cube from the boards, clear of the rail |
| `milkCan` | 4.05 | ground | 7.45 | 0 | |
| `milkCan` | 4.30 | ground | 7.75 | 0 | |
| `crate` | 4.75 | ground | 7.30 | 0 | Against the foundation. No snow (another crate stands on it) |
| `crate` (snow) | 4.80 | 0.45 | 7.30 | 1 | On the first crate; its top is under the lower rail |
| `crateOpen` (apples) | 5.30 | ground | 7.35 | 0 | |
| `barrel` (snow) | 5.85 | ground | 7.35 | 0 | |
| `ropeCoil` | 4.90 | 1.35 | 7.20 | 0 | On the boards, above the lower rail |
| `wallLantern` | 2.75 | 2.30 | 7.20 | 0 | East of the doors; its arm starts at the boards |
| `wallLantern` | −2.90 | 2.30 | 7.20 | 0 | West of the doors |
| `horseshoe` | −0.10 | 3.45 | 7.30 | 0 | On the white lintel, over the middle of the doorway |
| `hoistRope` | −0.05 | 4.65 | 8.30 | 0 | Hangs from the iron block under the beam's end, y 4.65 to 5.60 |

### 8.2 `toolCorner`: the west end of the same wall (M4)

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `broom` | −6.10 | ground | 7.25 | 0 | Leaning, as the pitchfork |
| `shovel` | −5.80 | ground | 7.25 | 0 | Leaning |
| `pail` (empty) | −6.10 | ground | 7.70 | 0 | Clear of the season's tree |

### 8.3 `tractorSide`: the tractor's fittings and the pump by the trough (M4)

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| Grille bars, four | 7.65 | 0.85, 0.95, 1.05, 1.15 | 8.30 | 0 | Each 1 x 1 x 14 cubes, on the front face of the grille, `iron` +2 |
| Wheel nuts, five | In a ring of radius 0.15 m round the south rear wheel's hub centre, which is at x 10.75, y 0.75 | | 9.90 | 0 | Each 1 cube, `iron` 0, on the hub's south face (the side the cameras see). None on the north wheel |
| `handPump` with its `pail` | 7.80 | ground | 13.75 | 0 | Spout toward −z; the pail under it at (7.75, ground, 13.45) |

The pump must not show in shot 5 (it stands below that shot's frame). If it does, move it 0.5 m south.

### 8.4 `henCorner`: the hens' run (M4)

Seen in shot 4.

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `cleat`, four | −13.20 | On the top front edge of each of the ramp's four steps | 2.80 to 3.60 | 0 | Each 12 x 1 x 1 cubes (the ramp's width) |
| `eggBasket` | −12.40 | ground | 3.00 | 0 | Beside the ramp |
| `sack` | −11.55 | ground | 2.85 | 0 | In front of the coop, under its window |
| `sack` | −11.10 | ground | 2.85 | 0 | |
| `pail` (feed) | −13.85 | ground | 5.05 | 0 | At the east end of the feed trough |
| `squareBale` | −18.70 | ground | 3.00 | 0 | By the west fence |
| `squareBale` | −18.70 | ground | 3.50 | 0 | |
| `squareBale` (snow) | −18.45 | +0.45 | 3.00 | 1 | Across the two below |

### 8.5 `gate`: the yard gate (M4)

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `strapHinge` | −1.20 | 0.45 | 15.05 | 1 | On the leaf's face that looks at the path, at the lower rail |
| `strapHinge` | −1.20 | 1.05 | 15.05 | 1 | At the upper rail |
| `latch` | −1.20 | 0.80 | 17.75 | 1 | At the leaf's free end |

### 8.6 `pondSide`: the pond's west bank and the woodpile (M5)

Seen in shot 7.

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `bench` (snow) | 4.10 | ground | 23.50 | 1 | Its back toward −x, so it faces the pond |
| `skates` | 4.60 | ground | 24.10 | 0 | On the snow in front of the bench |
| `choppingBlock` with `axe` | 3.00 | ground | 21.10 | 0 | South of the woodpile |
| `splitLogs` | 3.70 | ground | 21.10 | 0 | |

### 8.7 `porch`: the farmhouse front (M5)

Seen from the barn in shot 3.

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `shutter` | −12.10 | 1.60 | 26.95 | 2 | Left of the west window. Each shutter is 6 x 24 x 1 cubes (0.30 x 1.20 m), starting above the sill's snow |
| `shutter` | −10.40 | 1.60 | 26.95 | 2 | Right of the west window |
| `shutter` | −7.70 | 1.60 | 26.95 | 2 | Left of the east window |
| `shutter` | −6.00 | 1.60 | 26.95 | 2 | Right of the east window |
| `knob` | −8.75 | 1.45 | 26.90 | 2 | On the door, where the old 0.2 m cube was |
| `wallLantern` | −8.45 | 2.20 | 26.80 | 2 | Beside the door, clear of the season's wreath |
| `broom` | −9.75 | 0.60 | 26.80 | 2 | On the porch floor, leaning on the wall |
| `crateOpen` (carrots) | −10.80 | 0.60 | 26.30 | 0 | On the porch floor, in the west corner |

### 8.8 `flockSpot`: where the three loose sheep graze (M5)

Seen in the foreground of shot 1 (about 34 m from that camera).

| Object | x | y | z | Turn | Note |
|---|---|---|---|---|---|
| `squareBale` | −26.30 | ground | 19.20 | 0 | |
| `squareBale` | −26.30 | ground | 19.70 | 0 | |
| `squareBale` (snow) | −26.05 | +0.45 | 19.20 | 1 | Across the two below |
| `hayHeap` | −25.60 | ground | 20.40 | 0 | Loose hay the sheep eat from |

If any position collides with something in the working tree, move the object the least distance along its wall or fence that clears it, keep every rule of section 7, and list the move in the pull request.

## 9. The country in front of the line (milestone M5)

`countryside.ts` builds the woods, the forest ring, scrub, long drifts, a stone wall and tracks. Its cubes are pinned. **The set of cubes must come out identical. Only the colour of a cube may change, and only for cubes that belong to something standing at z ≥ −16.** A tree belongs to the side its trunk stands on, so no tree is half and half.

| Thing | Today | New, in front of the line only |
|---|---|---|
| `forestPine`: trunk | One bark tone per tree | `darkWood` 0 |
| `forestPine`: needles | Two-cube patches of two greens, lighter at the rim | Store each cube's tier number when the tiers are built. Colour by tier as the yard pines: lowest third `pine` −1, middle 0, top +1, then the whole tree shifted by 0 or −1 from its seed |
| `forestPine`: snow | On open cubes set back from the rim, chosen by a test on two-cube patches, in two tones | Every cube that is snow today becomes `snow` +1. Every cube that is green today stays green. The same test decides which, so each tree keeps its balance of white and green |
| Scrub: bushes | Random green and snow per cube | `pine` −1; cubes that are snow today `snow` +1 |
| Scrub: twigs, rocks, grass | Random per cube | `darkWood` 0; `stone` 0 with today's snow cubes `snow` +1; `straw` −1 |
| Stone wall | Two-cube stones with random tone; snow on top with random holes | `seededPart('stone', 341, stoneIndex)`; snow cubes `snow` +1. The holes stay holes (no cube may be added) |
| Long drifts, tracks | `snowAt` texture | `snow` +1 for drifts, `snow` −1 for tracks, blended to today's colour between z = −16 and z = −10 exactly as the land is (file 03, section 7.1) |

Not touched at all: `distance.ts` (the back hills, the village, the windmill, the mountains), the scarecrow, and everything else behind the line.

After this step run the wendigo check. Then photograph shots 1 and 7 with `?wendigoDebug` and count magenta pixels, as in section 1.5. If the count rose, undo this step and report.

## 10. The tour, shot by shot

What each shot should show when the plan is finished.

| Shot | View | Light (file 02) | What must read clearly |
|---|---|---|---|
| Computer 0, doorway | The barn's south face from the south-west, the hero in the doorway | Haze 0.0076, shadow box 23 m | Red boards in a 0, −1, 0, +1 rhythm; white trim; lanterns beside the doors; the work corner's crates and barrel; soft darker snow along the wall's foot |
| Computer 1, whole farm | From high over the orchard | Haze 0.0050, shadow box 44 m | Red barn, cream house and green pines against white snow; every building and tree with its own shadow; the two tracks; three sheep at their bales |
| Computer 2, paddock | The wendigo's shot | Today's, all of it | The figure exactly as today. No micro cluster is drawn |
| Computer 3, from inside the barn | Out through the doors toward the gate and the farmhouse | Haze 0.0086 | The gate with its hinges; the farmhouse with green shutters |
| Computer 4, hens' run | The coop, the straw bed, the hens | Haze 0.0113 | Yellow clapboards in two steps; red roof with a whole snow cap; a clean straw ellipse; bales, sacks, basket |
| Computer 5, tractor | The tractor's nose | Haze 0.0115 | Hood, body and fenders in three reds; grille bars; wheel nuts; the work corner behind |
| Computer 6, path | Low along the path to the doorway | Haze 0.0140 | The path one step darker than the snow, with dents; lanterns and horseshoe at the doors |
| Computer 7, across the pond | Over the ice toward the barn | Haze 0.0069, shadow box 24 m | Solid ice with skate marks; the raised snow rim; the bench and skates |
| Phone 0 to 5 | The same subjects, narrower | The phone values of file 02 | The same, at phone size |

Which clusters are drawn on a shot follows the 40 m rule of file 04, section 4. On the doorway shot all eight are within range; on the whole-farm shot only `flockSpot` and `porch` are.

## 11. Home seen from the barn table

The barn table's camera looks out through the open back doors at the yard. It mounts the yard (`yard.ts`) but not the farm's own meshes and not the micro layer. So from the table:
- the yard's colours are solid and its models chunky (file 03);
- the two new tracks and the clean drifts show;
- the ground shade map darkens the snow at the foot of the yard's fence and trees (the map is shared);
- no micro object shows, and the table's triangle and draw counts do not rise.

The table's own light does not change (file 07, section 1).

## 12. What to expect in numbers

Starting point, measured on the pushed v0.8.0 on High at 1280 x 720: Home shot 1 draws 2.39 million triangles in 513 draw calls; shot 0 draws 1.65 million in 272.

| Change | Effect on a computer |
|---|---|
| Chunky structure (file 03, section 4) | The smoothed models fall to roughly a third of their triangles. Expect Home shot 1 to fall by several hundred thousand |
| Whole snow caps | A few thousand more cubes |
| Micro layer | At most 120,000 triangles in all, at most 80,000 on a shot, at most 10 draws |
| Fitted shadow box | More scenery inside the shadow map on wide shots; the map's size does not change |
| Ground shade map | One texture read on ground pixels; 581 kB of memory |

The rule for the totals is in file 08, section 3: no shot may end above its starting numbers.
