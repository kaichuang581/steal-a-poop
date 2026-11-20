# M3: the micro layer, the ground's shade, the review page, and the proof corner

Branch `miniature/m3-micro`, on top of M2 (`855c6dd`). Plan file 04; file 05, sections 7 and 8.1.

## What was built

- `src/skin/voxel/micro.ts`: `MICRO` (0.05 m), `MicroObject`, `Placement`, `place` (quarter turns, throws on an overlap).
- `src/skin/voxel/microKit.ts`: the whole kit, twenty-seven builders for the plan's nineteen kinds (K10 is two, K19
  seven), every part a ladder colour.
- `src/skin/scene/farmMicro.ts`: `MICRO_PLACEMENTS` (the `workCorner` cluster only, for now), the rules of file 05
  section 7 in code (`breach`: wedge and paddock, lane and footpaths, doorway, 1.2 m from an animal or the hero, 1.9 m
  from the season's tree, 0.3 m from a present or cane, 0.4 m from the snowman, sled, mailbox and feeder), a check that no
  micro cube lies in a cube of the yard or the farm, `underMicro` for the drifts, one merged mesh a cluster, the
  lanterns' glass in one glowing mesh.
- The mesher's `near` option: corner shade from the ground and the wall an object stands against.
- `src/skin/table/Farmstead.tsx`, `Micro`: a cluster is drawn within 40 m of the shot's camera (start or end of its
  push), casts within 25 m, never on the paddock shot, and not at all on Low.
- `src/skin/voxel/groundShade.ts` and the shader lines in `voxel/material.ts`: the shade map, 880 x 660 (440 x 330 on
  Low), baked from what the yard, the barn's walls, the farm, the snowman, the micro layer and the land's trees note as
  they are built. `?shade=off`. Read by the start screen and the barn table only (`scene.userData.groundShade`, set by
  `Lights`); every other scene reads a white texel.
- `?preview=mini` (`src/skin/scene/MiniPreview.tsx`, development only): `piece=<name>` (four views, the sheep for
  scale), `sheet=kit`, `sheet=home`. `farmPiece` and `yardPiece` hand it single models.
- `tools/miniature/shots.mjs`: `cluster <name>` photographs a cluster on Home itself, the camera stood by it with
  `?cam=` and the menu hidden (the wall a cluster stands against is only there); `pair --left`.
- `src/skin/scene/livestock.ts`: `LIVESTOCK` and `HEN_Y` moved out of `Farmstead.tsx` (which still exports them) so
  the placement rules can read where the animals stand.

## Where it differs from the plan

| Plan | Built | Why |
|---|---|---|
| `workCorner` on the south wall, x 2.6 to 6.4 | The bale stack of v0.8.3 stands there (x 3.2 to 6.2). Cart wheel 0.2 m west (x 2.40), in the gap by the door leaf; cans, crates and barrel straight out to the stack's front (z 8.65 to 9.00); pitchfork to the wall's east end (x 6.15, z 7.45), on the corner board | File 05, end of section 8: move the least that clears, and list it |
| Rule 2: nothing on the path | The lane and the two footpaths. The trampled apron before the doors (new in 0.8.3) is not counted | The plan's own corner stands at the wall on it |
| Rules 2 to 4 | Only for what stands under 3 m | The horseshoe on the lintel and the hoist rope are over the doorway by the plan's own places |
| Shade: `mix(shade colour, white, stored value)` on the snow's colour | The stored value is the ground's brightness (0.6 to 1) in the plan's shade colour, laid over the lit colour after the highlight is eased | The plan's line darkens a wall's foot 5%, and snow in the sun is lit past white and eased back, which ate even that. The plan's text says 75% at a wall's foot and 90% round a post: this gives those |
| The cluster's own page (`?preview=mini&cluster=`) | `shots.mjs cluster` on Home | The wall and the ground it stands on are built only there |
| Faces looking down dropped with `dropFaces` | The mesher's `unseen` | `dropFaces` cannot read a mesh with joined faces |
| `milkCan` handles "just outside the body at y 8 to 9" | At the shoulder (y 9 to 10), inside the 6-cube width | Outside the body is outside the object's own box |
| `hayHeap` top layer inset 5 | Inset 5 by 4: two cubes deep | An inset of 5 leaves nothing of a depth of 10 |
| `handPump` 9 deep | 12 deep | A spout of 3 and a handle of 6 do not fit 9 round a body of 3 |
| `skates` 6 wide | 8 wide | The second skate lies a quarter turn from the first |
| `cartWheel` spokes one cube wide | The level and upright spokes are two cubes | Sixteen cubes have no middle row |
| `wallLantern` 3 x 5 x 3 | 3 x 6 x 4 with its arm | The arm lies over the cap and reaches the wall |

## The ten checks (file 04, section 7), from `sheet-kit.jpg`, `piece-bench.jpg`, `cluster-workCorner.jpg`

| Check | Result |
|---|---|
| 1 Recognisable | Pass for all but two that need their place to read: the three leaning tools stand as stepped handles alone (they read against a wall, as the pitchfork does in the cluster picture), and the fittings are a few cubes each |
| 2 One solid colour a part | Pass (a test holds every cube to a ladder colour) |
| 3 Touching parts told apart | Pass: slats and posts, staves and hoops, lid and box, seat boards. The square bale's twine (two steps under the hay) is faint at sheet size |
| 4 Big and small blocks both visible | Pass in the cluster picture: 0.2 m bales and wall boards behind 0.05 m crates and cans |
| 5 Crisp edges | Pass |
| 6 Snow in whole caps | Pass: crate lid, barrel's recess, bale top, bench's two rear boards |
| 7 Nothing floats or passes through | Pass: `check.ts --only connect` with the layer mounted, 2,684 as stored; the structure check threw once (the pitchfork in the corner board) and the place was fixed |
| 8 Size beside the sheep | Pass: crate 0.5 m, bench seat 0.45 m, milk can 0.65 m |
| 9 Shadow one clean shape, snow darker at the foot | Shadow: pass. Shade: there, but faint round a small object (about 10% at its edge); clear along a wall and round the snowman |
| 10 Ladder colours, one set | Pass |

## Checks and numbers

- `npx tsc -b` clean; `npm test` 1,850 passed, 86 skipped; build passes.
- `check.ts --only connect,wendigo`: both PASS; the pins as they were (408,004; 80,760; 89,907 / 78,779; 134, 136, 137).
- `npm run size`: the budget is raised by 6,000 bytes (3.12 kB over the old limit), as Brian chose on 2026-11-17 for a
  milestone that needs it. 3.48 kB of headroom now.
- Micro layer: 6,676 triangles in all (budget 120,000), one cluster of eight, built in 66 ms.
- High, computer, against M2: shot 0 1,131,748 to 1,138,577 triangles, 239 to 241 draws, 69.7 to 70.0 MB. Shot 1 (the
  corner is 52 m off), the paddock shot, every Low state and the barn table: unchanged. The shade map is one more
  texture of 581 kB.
- Not measured: frame time (this machine draws in software). The shader gains one texture read on ground pixels.

## Pictures

- `review/pairs/pov0-day.jpg`: the doorway, before and now. `pov0-day-shadeoff.jpg`: the shade map off and on.
- `review/sheet-kit.jpg`, `review/sheet-home.jpg`, `review/cluster-workCorner.jpg`, `review/cluster-workCornerDoors.jpg`,
  `review/piece-bench.jpg`.

## For Brian

- This is the plan's proof: the doorway with the light, the solid colours, the chunky walls, the micro objects and the
  ground shade together. If it is wrong, the plan stops here.
- The two lanterns beside the doors hang where the plan put them, but the open door leaves stand in front of them from
  the lane and the doorway shot; they show from the east side (the cluster picture). They can move outward 0.6 m or so.
- The shade is deliberately the plan's strength; it is one number to deepen (`0.30` and `0.20` in `groundShade.ts`).
