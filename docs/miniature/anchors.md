# Anchors: file 05, section 2, on the working tree (v0.8.3, commit 6608e99)

Written in M0, 2026-11-20. The plan's positions are v0.8.0's. Between v0.8.0 and v0.8.3 the farm was laid out again as
a farmstead (CHANGELOG 0.8.2 and 0.8.3), so most anchors outside the barn have moved, and some have changed in kind.
"Moved by" is what a placement that names the anchor moves by. Where an anchor changed in kind, a translation does not
carry the placement over: those rows say **needs a place**, and section 2 below proposes one. Nothing is placed from
this file before its milestone (M3 to M5).

## 1. The anchors

| Anchor | v0.8.0 (the plan) | v0.8.3 (the tree) | Moved by | Source in the tree |
|---|---|---|---|---|
| Barn floor | x -6..6, z -4..7; walls 4.2 m; ridge 6.4 m | The same | 0 | `BARN` in `src/skin/scene/layout.ts` |
| Barn south wall | Boards' face z 7.2; foundation, two rails, door frame out to 7.3; corner boards to 7.4 | The same cubes. The barn's outer roof is a gambrel now and the loft has a white-framed door over the doorway (y 3.9..5.6, x -0.9..0.9, z 7.2..7.4) | 0 | `walls()` in `barn.ts`; `barnShell` in `farmstead.ts` |
| Open back doors | x -1.8..1.8, 3.4 m; leaves hinged at (±1.8, 7.25) | The same | 0 | `BARN.backDoor`; `leaf()` in `barn.ts` |
| Door lintel | y 3.4..3.7, x -2.0..2.0, face z 7.3 | The same | 0 | `barnShell` |
| Hoist beam | x -0.1..0.1, y 5.8..6.0, to z 8.5; iron block y 5.6..5.8 | The same | 0 | `barnShell` |
| Hero sheep | (0, 0, 8.2) | The same | 0 | `FarmBackdrop.tsx` (`BARN.maxZ + 1.2`) |
| Silo | (9.7, -0.8), r 1.9, 10.5 m | The same, and a feed room joins it to the barn's east wall (x 6.4..9.0, z -1.6..0.6, 2.4 m) | 0 | `FARM.silo`, `silo()` |
| Tractor | centre (9.6, 8.6), nose -x, by the barn doors | centre (-8, -10.5), nose -x: parked behind the barn, between the pens and the field. No tour shot shows it (Brian, 2026-11-19: "seeing a tractor isnt very pretty") | (-17.6, -19.1) | `FARM.tractor`, `tractor()` |
| Coop | centre (-12, 1.5); ramp on the south side | centre (-13, 8.4); walls x -14.8..-11.2, z 7.1..9.7; floor 0.4 m up; pop door and ramp on the south side at x -14.2..-13.6 | (-1.0, +6.9) | `FARM.coop`, `coop()` |
| Hens' run | x -19..-8.6, z -5..8; gate at z 8 | x -17.4..-9.8, z 6.6..15; its gate is in the EAST side (x -9.8), z 9.9..11.3, toward the court. The pig's sty is on its north side (z 0.4..6.6), with a shelter in its corner | Changed in shape | `FARM.run`, `FARM.sty`, `coop()` |
| Hens' feed trough, water pan, perch | Trough x -16..-14, z 4.9..5.5; pan (-9.8, 5.2); perch x -17.4..-15.5, z 6.6 | All three stand off a point 3.1 m south of the coop's centre, (-13, 11.5): trough from x -16.6, z 12.0; pan at (-10.8, 12.1); perch from x -16.8, z 13.5 | With the coop | `henYard()` |
| Paddock | x 12..22, z -14..7; gate gap z 7, x 15.6..18 | The same | 0 | `FARM.paddock`, `paddock()` |
| Yard fence and gate | z 15, x -16..16; gate x ±1.6; leaf x -1.4..-1.2, z 15.2..18 | z 15, x -9.8..12 (it ends at the run's corner post and turns back north at x 12 to the paddock's corner); gate x ±1.6; the leaf stands open on the west post as it did; a lane fence runs south from the east gate post along x 1.6..1.8 to z 37 | 0 for the gate | `YARD.fence`, `fence()` in `yard.ts` |
| Main path | Centre x = -9 smooth((z - 15) / 8), half-width 1.2, z 7..24.6 | A straight lane on x = 0, half-width 1.5, from z 7 to the road at z 46 (it breaks up into open snow from z 39), with wheel ruts; an apron before the doors; two footpaths (`WALKS`): the porch steps to the gate, and the doors to the hens' gate along z 10.6 | Changed in shape | `YARD.path`, `onPath`, `onWalk`, `WALKS` in `yard.ts` |
| Snowman | (4.5, 11), 2.1 m | The same | 0 | `YARD.snowman` |
| Sled | x 2.0..2.6, z 13.0..14.4 | By the porch steps: x -12.9..-12.3, z 23.0..24.4 | With the farmhouse | `sled()` |
| Mailbox | (2.8, 14.2) | (2.6, 38.0), where the lane's fence ends | (-0.2, +23.8) | `fence()` |
| Bird feeder | post at (-2.8, 12.4) | post at (-10.2, 17.6), in the farmhouse's garden | (-7.4, +5.2) | `feeder()` |
| Trough (yard) | x 5.8..7.6, z 13.6..14.4 | x 5.8..7.6, z 15.6..16.4: the pasture's trough, against the court's fence | (0, +2.0) | `trough()` |
| Woodpile | x 2.2..5.0, z 19.0..20.6, free-standing | **Not there.** The wood is a woodshed built on the farmhouse's north gable end: posts, a sloped roof, logs stacked under it, x -21.0..-18.0, z 14.8..16.6 | **Needs a place** | `farmhouse()` |
| Pond | centre (10, 24), radii 4.5 and 3 | centre (18, 29), radii 6 and 4.2, with an uneven shore (`pondD`) | (+8, +5) | `YARD.pond` |
| Farmhouse | centre (-9, 30), front wall facing north at z 27, porch x -11..-7 | centre (-18.2, 21.2), a storey and a half, its ridge along z. Its FRONT faces EAST: front wall face at x -15.0, a porch along it out to x -13.4 (floor 0.4 m up, z 17.0..25.4), the door in the middle (z 20.8..21.6), two windows each side of it. A kitchen door and the woodshed are on the north gable | **Turned a quarter turn**; needs a place | `YARD.farmhouse`, `farmhouse()` |
| Loose sheep | (-24, 19), (-27.5, 21.5), (-21.5, 23) | (9.4, 18.2), (12.6, 20.4), (6.4, 21.6): in the pasture, by the trough | about (+33, -1) | `LIVESTOCK` in `Farmstead.tsx` |
| Season's big tree and presents | Tree (-4.2, 9.2); presents (-3.1, 10.2), (-4.4, 10.8), (-5.5, 10.2), two on the sled, some behind the tractor | Tree and the three presents by it: the same. No presents on the sled or by the tractor (Brian, 2026-11-19: everything "intentionally placed"; `scale.test.ts` holds it) | 0 | `buildFestive`, `buildFarmFestive` |
| Season's candy canes | x -2.6 and 1.5, z 10 and 12.4 | x -2.9 and 2.2 (the lane is wider), the same z | (∓0.3..0.7, 0) | `buildFestive` |

Also new since v0.8.0, and standing where the plan places things:
- **Square bales stacked against the barn's south wall east of the doors**, x 3.2..6.2, z 7.4..8.6, up to 1.8 m. This is
  where `workCorner` (file 05, 8.1) puts its crates, barrel, milk cans and cart wheel.
- An orchard of eight bare trees behind the hens (x -29.5..-24, z -7..9); a windbreak of 23 pines down the west side
  (x -35 and -38.8); eight yard pines in three groups (`YARD.pines`: the plan counts ten).
- The tour: computer shot 1 looks at the whole farmstead from the south ((12, 22, 52) to (-10, 0.5, 8)); shot 4 looks at
  the hens over their fence; shot 5 is the farmhouse from the lane, not the tractor; shot 7 looks over the pond from its
  far bank. Shot 2, the paddock, is where it was.

## 2. What needs a place, and what is proposed (nothing is built from this before its milestone)

| Cluster | The plan's place | On the tree | Proposal |
|---|---|---|---|
| `workCorner` (M3, the proof) | Barn south wall, x 2.6..6.4 | The bale stack stands there | Its own rule (05, 8, last paragraph): move each object the least distance along the wall that clears. East of the doors the wall is full. So the ground objects go to the wall WEST of the doors, x -6.0..-2.4 (clear of the season's tree by the 1.9 m rule only from x -6.0 to about -5.4, so most of them cannot stand there either). **Settled at M3** (review/M3-micro.md): the bale stack stays; the cans, crates and barrel stand in a row in front of it, the cart wheel in the gap by the door leaf, the pitchfork at the wall's east end; the wall fittings (lanterns, horseshoe, hoist rope, rope coil) keep their places |
| `toolCorner` (M4) | West end of the same wall | Free | As the plan |
| `tractorSide` (M4) | Tractor by the doors; pump by the trough | Tractor behind the barn, in no shot | Fittings move with the tractor (they cost almost nothing and it is the same model); the pump and pail move with the trough, +2.0 in z |
| `henCorner` (M4) | Coop and run of v0.8.0 | Coop moved (-1.0, +6.9); the run is another shape | Ramp cleats, basket and sacks move with the coop; the pail with the trough; the bales to the run's west fence at the same offset from its corner |
| `gate` (M4) | Yard gate | The same | As the plan |
| `pondSide` (M5) | Pond's west bank; chopping block and logs south of the woodpile | Pond moved (+8, +5); no woodpile | Bench and skates move with the pond. Chopping block, axe and split logs: by the woodshed, in front of its open side (about x -20.4..-18.6, z 14.0..14.6) |
| `porch` (M5) | Farmhouse front facing north | Front faces east, four windows | Every placement turned a quarter turn about the house's centre and laid on the east front: shutters at each of the four front windows (eight, not four), knob on the front door, lantern beside it, broom and crate on the porch floor (0.4 m up, not 0.6) |
| `flockSpot` (M5) | By the three loose sheep at (-24, 19) | The sheep are by the pasture trough | Moves with the sheep: the bales and the hay heap about (+33, -1), clear of the trough and each sheep by 1.2 m |
| The two new tracks (M5, file 05 section 3) | West track to the hens' gate at z 8; east track to the paddock gate | A footpath to the hens' gate exists already (z 10.6, to the run's east side). No track to the paddock gate | Keep the footpath as the west track; add the east track only, from the lane at z 11.8..12.6 to x 17.2 and north to the paddock gate |
