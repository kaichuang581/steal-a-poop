# 03. The models

See `reference/models-farm.png`, `models-world-2.png`, `models-world-3.png` and `models-obstacles.png`: every model, drawn from its data.

## 1. The rule: models are data, and nobody models by hand

Claude Code is weak at making 3D models, so it makes none here. Every model of the dream is a file in `data/models/`: a list of boxes with exact corners and exact colours. **The game loads the boxes. Nobody retypes them, rounds them or "improves" them.** If a model looks wrong, say so in the pull request and stop: the fix is made in this pack's data, not in the game's code.

There are **69 models, 2,491 boxes** in all. `data/models/index.json` lists them.

## 2. Getting the data into the game

1. Copy this pack to `docs/dream/v3/` in the repo.
2. Add `tools/dream/packModels.mjs`. It reads `docs/dream/v3/data/models/*.json` and writes `src/skin/dream/models.gen.ts`: for each model its cell size, its lights, and its boxes as plain number rows `[x0, y0, z0, x1, y1, z1, colour index, part index, season flag]`, with one shared list of colour tokens and of part names. The file is generated: never edit it by hand. A test fails if it does not match the JSON (compare a hash of every model).
3. `models.gen.ts` is loaded only with Counting Sheep's own chunk (a dynamic import), never in the main bundle.
4. Add `src/skin/dream/models.ts`: `fill(grid, model, at, opts)` sets every cell of every box in a `Grid` of the model's cell size, with `solid(material, step)` for its colour; `opts.parts` limits it to named parts, `opts.festive` leaves out the season's boxes when `FESTIVE` is false, `opts.tint` multiplies the paint.

## 3. What a model file holds

```json
{ "id": "stump", "cell_m": 0.05, "bounds_cells": [-5, 0, -5, 5, 8, 5], "size_m": [0.5, 0.4, 0.5], "box_count": 5, "boxes": [ … ], "lights": [], "notes": [] }
```

and its boxes, each like this:

```json
  {"n": "bark", "part": "body", "c": "darkWood:0", "season": false, "b": [-4, 0, -4, 4, 6, 4]}
  {"n": "root flare", "part": "body", "c": "darkWood:-1", "season": false, "b": [-5, 0, -2, 5, 2, 2]}
  {"n": "root flare", "part": "body", "c": "darkWood:-1", "season": false, "b": [-2, 0, -5, 2, 2, 5]}
```

| Field | Meaning |
|---|---|
| `cell_m` | The size of one cell. Every corner below is a whole number of cells |
| `b` | A box: `[x0, y0, z0, x1, y1, z1]` in cells. It fills from the first corner up to, not including, the second |
| The origin | The middle of the model's footprint, on the ground. x runs along the lane, y up, z toward the camera |
| `c` | The colour: `material:step` of `LADDER`, or `glow:<name>` for a part that gives light (drawn in its own colour, unlit; the names and colours are in `data/palette.json`) |
| `part` | Which mesh the box belongs to. Most are `body`. Others are named where a part moves or is used alone: the windmill's `sails`, the fence's `string`, an obstacle's `lanterns`, a bed bay's `hang` |
| `season` | `true` for a wreath, a garland or roof bulbs: left out when `FESTIVE` is false |
| `lights` | Where a soft glow goes: `at` in cells, its colour, `radius_m`, `strength` (file 02, section 5) |
| `notes` | Anything the builder must know about that model |

## 4. The farm's models (worlds 1 and 2)

Each is a small copy of something on Home's farm, in Home's colours. They are toy-sized on purpose: the barn is 8 m wide, not Home's full size, so that a whole farm fits in the window.

| Model | What it is | Its original, which the player can see | Width x height x depth (m) | Cell (m) | Boxes |
|---|---|---|---|---|---|
| `barn` | The red barn with white X doors and a snowy stepped roof | Home's barn | 8 x 5.7 x 5.9 | 0.1 | 165 |
| `silo` | The grain silo with three hoops and a round snow cap | Home's silo, beside the barn | 2.4 x 6.2 x 2.4 | 0.1 | 35 |
| `farmhouse` | The cream farmhouse; its left window is lit: the farmer's bedroom | Home's farmhouse | 6.8 x 5.8 x 5.7 | 0.1 | 77 |
| `windmill` | The windmill: a stone foot, a pale tower, a brown cap, four sails | Home's windmill | 5.2 x 7.4 x 2.1 | 0.1 | 32 |
| `coop` | The yellow hen coop on legs, with its ramp | Home's chicken coop | 3 x 2.5 x 3.2 | 0.1 | 28 |
| `scarecrow` | The scarecrow: a red coat, a straw head, a brown hat | Home's scarecrow | 1.5 x 2.2 x 0.6 | 0.05 | 21 |
| `baleStack` | Three hay bales: two below, one on top, snow on them | Home's bale stack | 2.1 x 1.3 x 0.65 | 0.05 | 15 |
| `pineSpire` | A spire pine, 4.6 m, with snow on each shelf | Home's pines (tieredPine with genes) | 1.8 x 4.7 x 1.8 | 0.1 | 23 |
| `pineCone` | A cone pine, 3.4 m, with snow on each shelf | Home's pines (tieredPine with genes) | 1.6 x 3.5 x 1.6 | 0.1 | 18 |
| `pineRound` | A round pine, 2.4 m, with snow on each shelf | Home's pines (tieredPine with genes) | 1.4 x 2.5 x 1.4 | 0.1 | 15 |
| `fenceBay` | One 2.4 m bay of the farm fence: a post, two rails, a snow cap, and the string of bulbs | Home's plank fences, and the season's bulbs | 2.45 x 0.95 x 0.25 | 0.05 | 13 |
| `wallBay` | One 2.4 m bay of dry-stone wall, two courses, snow on top | Home's dry-stone wall along the lane | 2.4 x 0.6 x 0.4 | 0.1 | 16 |
| `pond` | The frozen pond: ice, three streaks of snow, a stone rim, reeds | Home's pond | 5.2 x 1.3 x 3 | 0.1 | 47 |
| `gateFarm` | Gate 1: the farm gate as a small roofed gateway the sheep runs through | Home's gate arch over the lane (posts, beam, the board with a sheep cut in it) | 3.6 x 4.7 x 4.1 | 0.1 | 53 |
| `shrubMound` | A buried shrub: a snow mound in two tiers with five twig tips | Home's buried shrubs (PLAN_DEPTH_AND_LIGHT 6.6) | 1.4 x 0.7 x 1 | 0.1 | 7 |
| `stump` | A tree stump with a snow cap | Home's stump west of the farmhouse (PLAN_DEPTH_AND_LIGHT 6.7) | 0.5 x 0.4 x 0.5 | 0.05 | 5 |
| `log` | A fallen log, 1.6 m, with a line of snow along it | Home's log on the pond's east bank (PLAN_DEPTH_AND_LIGHT 6.7) | 1.7 x 0.45 x 0.25 | 0.05 | 5 |
| `snowman` | A small snowman: two balls, a carrot nose, a red scarf | Home's snowman by the snow fort | 0.85 x 0.75 x 0.6 | 0.05 | 10 |

Notes:
- **The farmhouse's left window is lit, and it is the only lit window on the farm.** It is the farmer's bedroom: the player is looking at the house he is asleep in.
- The three pines follow the three shapes of Home's pines (`PLAN_DEPTH_AND_LIGHT.md` 8.3: spire, cone, round). In the dream they are fixed models, so the picture is the same for every player.
- The barn's wreath and its roof bulbs follow the season's rule (one wreath and one string of lights per building). Its two lanterns stay all year.

## 5. The quilt's colours

One quilt, everywhere: on his bed in the strip, as the squares of world 3, and as the band on the tray and the boards. Its five colours are those of the quilts on Home's clothesline (`PLAN_DEPTH_AND_LIGHT.md` 7.3): `scarfRed 0`, `coopYellow 0`, `giftGreen 0`, `trimWhite 0` (the cream) and `slate 0`.

**Every second square is cream.** A square in column `ix`, row `iz` is cream when `ix + iz` is even. Otherwise it takes `scarfRed`, `coopYellow`, `giftGreen`, `slate` in turn, by `floor((ix + 3 × iz) / 2) mod 4`. So no two strong colours ever touch, and red never sits against green: the quilt stays calm (Brian's rule on harsh contrasts).

## 6. World 2's models

| Model | What it is | Its original, which the player can see | Width x height x depth (m) | Cell (m) | Boxes |
|---|---|---|---|---|---|
| `islandBarn` | World 2: the island the barn and silo ride on | The ground under Home's barn | 12.4 x 4.9 x 7.6 | 0.1 | 69 |
| `islandHouse` | World 2: the island the farmhouse rides on | The ground under Home's farmhouse | 8.4 x 4.2 x 7 | 0.1 | 45 |
| `islandMill` | World 2: the island the windmill rides on | The windmill's hill | 4.4 x 2.8 x 4 | 0.1 | 23 |
| `islandYard` | World 2: an island for the scarecrow, the bales or the coop | A piece of the farmyard | 6 x 2.8 x 3.4 | 0.1 | 32 |
| `laneBayFloat` | World 2: one 2.4 m bay of the floating track, 1.4 m thick, its underside in uneven teeth | The farm track of world 1, lifted | 2.4 x 1.9 x 2.4 | 0.1 | 22 |
| `clodSmall` | World 2: a small floating clod, for a pine or for the foreground | A piece of the farm's ground that broke off at lift-off | 1.6 x 1 x 1.2 | 0.1 | 7 |
| `clodWide` | World 2: a wide floating clod, for a fence bay | A piece of the farm's ground that broke off at lift-off | 3 x 1.2 x 1.4 | 0.1 | 7 |
| `moonCrescent` | The crescent moon of world 1 | The moon in the bedroom's far window | 26 x 32 x 2 | 1 | 32 |
| `moonFull` | The full moon of worlds 2 and 3 (scaled up for world 3 and the moon show) | The moon in the bedroom's far window | 32 x 32 x 3 | 1 | 44 |

- An island's top is at its y = 0, so whatever stood on the ground stands on the island unchanged.
- Icicles, roots and the stones in the soil sit at places given by a fixed rule in the data. They are not random.
- **The moons** are flat voxel discs two cells thick, hung 420 m away and scaled to the size each world asks for (file 07, section 5). `moonFull` at one size serves world 2, world 3 and the moon show.

## 7. World 3's models

| Model | What it is | Its original, which the player can see | Width x height x depth (m) | Cell (m) | Boxes |
|---|---|---|---|---|---|
| `quiltPatch0` | A quilt square in scarfRed | The patchwork quilt on his bed (the five colours of Home's clothesline quilts) | 2 x 0.5 x 2 | 0.1 | 7 |
| `quiltPatch1` | A quilt square in coopYellow | The patchwork quilt on his bed (the five colours of Home's clothesline quilts) | 2 x 0.5 x 2 | 0.1 | 7 |
| `quiltPatch2` | A quilt square in giftGreen | The patchwork quilt on his bed (the five colours of Home's clothesline quilts) | 2 x 0.5 x 2 | 0.1 | 7 |
| `quiltPatch3` | A quilt square in trimWhite | The patchwork quilt on his bed (the five colours of Home's clothesline quilts) | 2 x 0.5 x 2 | 0.1 | 7 |
| `quiltPatch4` | A quilt square in slate | The patchwork quilt on his bed (the five colours of Home's clothesline quilts) | 2 x 0.5 x 2 | 0.1 | 7 |
| `quiltPatchFar0` | A quilt square in scarfRed, for the far rows | The patchwork quilt on his bed | 2 x 0.5 x 2 | 0.1 | 2 |
| `quiltPatchFar1` | A quilt square in coopYellow, for the far rows | The patchwork quilt on his bed | 2 x 0.5 x 2 | 0.1 | 2 |
| `quiltPatchFar2` | A quilt square in giftGreen, for the far rows | The patchwork quilt on his bed | 2 x 0.5 x 2 | 0.1 | 2 |
| `quiltPatchFar3` | A quilt square in trimWhite, for the far rows | The patchwork quilt on his bed | 2 x 0.5 x 2 | 0.1 | 2 |
| `quiltPatchFar4` | A quilt square in slate, for the far rows | The patchwork quilt on his bed | 2 x 0.5 x 2 | 0.1 | 2 |
| `candle` | His candle, as tall as a lighthouse, in its brass dish | The candle on his nightstand | 4.2 x 6.9 x 3.6 | 0.1 | 22 |
| `yarnBall` | A ball of his red yarn, 1.6 m across, with a loose end | The red yarn in his knitting basket (the yarn of the loading screen) | 3 x 1.6 x 1.7 | 0.1 | 210 |
| `needles` | Two knitting needles stuck in the quilt, crossed | The needles in his knitting basket | 2.4 x 4.3 x 0.4 | 0.1 | 42 |
| `spool` | A spool of thread, 1.7 m tall | The spool of thread in his knitting basket | 1.6 x 1.8 x 2 | 0.1 | 29 |
| `buttonBrass` | A nightshirt button (brass) on a thread: a star of world 3 | The three buttons on his nightshirt | 0.8 x 0.8 x 0.2 | 0.1 | 24 |
| `buttonCream` | A nightshirt button (trimWhite) on a thread: a star of world 3 | The three buttons on his nightshirt | 0.8 x 0.8 x 0.2 | 0.1 | 24 |
| `buttonRed` | A nightshirt button (scarfRed) on a thread: a star of world 3 | The three buttons on his nightshirt | 0.8 x 0.8 x 0.2 | 0.1 | 24 |
| `bedpost` | A bedpost with its ball, 6.4 m tall | The posts of his bed | 1.2 x 6.3 x 1.2 | 0.1 | 123 |
| `gateFootboard` | Gate 2: the foot of his bed, 6.6 m long, standing behind the track | The footboard of his bed, with its two posts | 7 x 4.6 x 1 | 0.1 | 178 |
| `gateHeadboard` | Gate 3: the head of his bed, taller, with his stocking and the garland | The headboard of his bed, with his stocking and the garland of bulbs | 7 x 5.6 x 1 | 0.1 | 188 |
| `laneBayBed0` | World 3: one 2.4 m bay of the track: the turned-down sheet, the quilt hanging over the bed's side, the mattress under it | His bed, made: sheet, quilt, mattress | 2.4 x 3 x 2.6 | 0.1 | 24 |
| `laneBayBed1` | World 3: one 2.4 m bay of the track: the turned-down sheet, the quilt hanging over the bed's side, the mattress under it | His bed, made: sheet, quilt, mattress | 2.4 x 3 x 2.6 | 0.1 | 24 |
| `laneBayBed2` | World 3: one 2.4 m bay of the track: the turned-down sheet, the quilt hanging over the bed's side, the mattress under it | His bed, made: sheet, quilt, mattress | 2.4 x 3 x 2.6 | 0.1 | 24 |
| `laneBayBed3` | World 3: one 2.4 m bay of the track: the turned-down sheet, the quilt hanging over the bed's side, the mattress under it | His bed, made: sheet, quilt, mattress | 2.4 x 3 x 2.6 | 0.1 | 24 |
| `feather` | A pillow feather, 0.5 m long | His pillow | 0.5 x 0.2 x 0.05 | 0.05 | 4 |

- `quiltPatch0` to `4` are for the rows near the track; `quiltPatchFar0` to `4` are the same squares in two boxes, for the rows further back.
- The four `laneBayBed` models differ only in which colours hang over the bed's side.
- A button's thread is one more box, 0.1 m wide, in `trimWhite −2`, from the button's top up out of the picture.

## 8. What the sheep jumps, and the signpost

| Model | What it is | Its original, which the player can see | Width x height x depth (m) | Cell (m) | Boxes |
|---|---|---|---|---|---|
| `obGate` | A five-bar farm gate with a brace | Home's pen gates | 1.1 x 1.1 x 0.3 | 0.05 | 29 |
| `obPlanks` | A plank fence panel: five pointed planks on two rails | Home's plank fences | 1.1 x 1.05 x 0.25 | 0.05 | 27 |
| `obBrick` | A brick gatepost with a stone cap | The farmhouse's brick chimney | 1.1 x 1.1 x 0.8 | 0.05 | 58 |
| `obLogs` | A log pile between two stakes, the cut ends showing | Home's woodpile by the porch | 1.1 x 1.05 x 0.75 | 0.05 | 51 |
| `obBales` | Three hay bales stacked, with straps | Home's bale stack | 1.1 x 1.1 x 0.75 | 0.05 | 22 |
| `obCrates` | Two crates stacked, each with a frame and a brace | Home's crates in the tool shed | 1.1 x 1.05 x 0.75 | 0.05 | 36 |
| `obGateIced` | A five-bar farm gate with a brace, iced over | Home's pen gates | 1.1 x 1.1 x 0.45 | 0.05 | 33 |
| `obPlanksIced` | A plank fence panel: five pointed planks on two rails, iced over | Home's plank fences | 1.1 x 1.05 x 0.4 | 0.05 | 31 |
| `obBrickIced` | A brick gatepost with a stone cap, iced over | The farmhouse's brick chimney | 1.1 x 1.1 x 0.8 | 0.05 | 63 |
| `obLogsIced` | A log pile between two stakes, the cut ends showing, iced over | Home's woodpile by the porch | 1.1 x 1.05 x 0.65 | 0.05 | 56 |
| `obBalesIced` | Three hay bales stacked, with straps, iced over | Home's bale stack | 1.1 x 1.1 x 0.75 | 0.05 | 27 |
| `obCratesIced` | Two crates stacked, each with a frame and a brace, iced over | Home's crates in the tool shed | 1.1 x 1.05 x 0.75 | 0.05 | 41 |
| `obBooks` | Four of his books in a pile | The five books on his bedroom shelf | 1.1 x 1.05 x 0.75 | 0.05 | 25 |
| `obPillows` | Three pillows in a pile, each with its seam and two corner ears | The pillow under his head | 1.1 x 1.05 x 0.75 | 0.05 | 23 |
| `obSpools` | Two spools of thread, one on the other | The spool of thread in his knitting basket | 1.1 x 1.1 x 0.8 | 0.05 | 39 |
| `obClock` | His alarm clock: red, two brass bells, two feet | The alarm clock on his nightstand | 1.1 x 1.05 x 0.55 | 0.05 | 42 |
| `signpost` | The post and arm the sign hangs from, 4.2 m tall. The board itself is interface (file 08) | The dream's own signpost, as today, rebuilt in voxels | 1.45 x 4.25 x 0.45 | 0.05 | 13 |

**Fitting an obstacle to the game's rules box.** Each obstacle's body is drawn at one size: 0.70 m wide, 1.05 m tall, 0.60 m deep. The game's rules box decides the real size:
1. Put the body's middle on the rules box's middle, and its foot on the track.
2. If the box's width or height is not 0.70 m or 1.05 m, stretch the body in x and y to the box, then round its size to whole cells of 0.05 m. Its depth stays 0.60 m.
3. The two lanterns (part `lanterns`) are not stretched: they stay just outside the body's two sides, at two thirds of its height.

**Which look for which box.** The build has these looks today: a gate, a plank fence, a brick gatepost, a log pile, hay bales; then books, cushions, spools and the alarm clock. Replace each flat look by the model of the same name (`obPillows` replaces the cushions) and add `obCrates` to world 1's set. World 2 uses the iced models. Keep the build's rule for which look follows which.

**The signpost** stands 0.45 m behind the lane's middle line and 0.62 m to the left of its obstacle's middle. The board that hangs from it is interface (file 08, section 5).

## 9. Checks for this file

1. `models.gen.ts` matches the JSON (the hash test of section 2).
2. For every model built in the game: the number of filled cells, its bounds and the count of cells of each colour equal those computed from its JSON.
3. **The prop board.** Add `?preview=dreamprops` (dev only): every model alone on the off-white studio colour `#ECEBE6`, in the order and grouping of the four reference boards. Put the game's board beside each reference board in the pull request. Brian compares them at the stop.
4. The style lint passes (file 02, section 9). `tools/checks.py` already reports for the data: every colour is in `LADDER`, and no model uses more than six materials.
5. With `FESTIVE` false: no wreath, garland or coloured bulb remains, and the fence's bulbs are all `glow:lit`.
