# 02. The voxel scene: camera, depth, light, cost

See `reference/camera-side-view.png`, `reference/whole-screen.png` and `reference/before-and-after.png`.

## 1. The idea

**The dream is a long model of his farm on a table, and the camera rides beside it.** Everything is built from the game's voxel blocks, stands at its own distance, and is lit. Depth then comes by itself: near things are bigger and pass faster, far things are smaller and pass slower, tops and sides show, and things hide each other.

*An example.* As the sheep runs, a fence post passes in front of the barn, the barn passes in front of a far pine, and the dry-stone wall at the bottom of the window rushes by nearest of all. Nobody sets those speeds: they follow from where each thing stands.

## 2. Axes and units

| | |
|---|---|
| x | Along the lane. The sheep runs toward +x |
| y | Up. The track's surface is y = 0. The snow beside it is one step higher, y = 0.1 |
| z | Toward the camera. The track lies from z = −1.2 to z = 1.2. Behind it is negative z |
| Units | Metres. Models are built on cells of 0.05, 0.1 or 0.5 m: steps S, M and L of the size ladder (`PLAN_DIORAMA_SCENERY.md` 3.1) |
| The art scale, `A` | The mapping's own number of pixels for one metre on the lane. The build shows about **90** at 1440 x 900. Read the real value from the mapping; never type 90 into code |

## 3. The camera

A camera that tilts down would bend the lane's places on screen. This one never tilts. It looks **level, straight across the track**, and its lens is shifted so the track sits low in the window. Such a camera keeps every upright line upright and puts every point of the lane's plane exactly where the side-on mapping puts it today.

| Value | Number |
|---|---|
| `CAM`: how far in front of the track's middle line the camera stands | 16 m |
| `EYE`: how high it is above the track | 2.4 m |
| Where the lane line (y = 0, z = 0) sits in the dream window | 76% of the way down (72% on phones) |
| Its x | So that the sheep keeps today's place across the window |
| Turning, tilting | None, ever |
| Near and far | 1 m and 600 m |

```ts
// src/skin/dream/camera.ts
export const DREAM_CAM = { CAM: 16, EYE: 2.4, lane: 0.76, lanePhone: 0.72, near: 1, far: 600 } as const;

/** A: px per metre on the lane (from the mapping). W, H: the dream window in px. sheepX: the sheep's x in metres.
 *  sheepShare: where the sheep stands across the window, 0 to 1 (from the mapping). */
export function placeDreamCamera(cam: PerspectiveCamera, A: number, W: number, H: number, sheepX: number, sheepShare: number, phone: boolean) {
  const { CAM, EYE, near, far } = DREAM_CAM;
  const laneY = (phone ? DREAM_CAM.lanePhone : DREAM_CAM.lane) * H;   // px from the window's top
  const horizonY = laneY - A * EYE;
  const k = near / (A * CAM);                                          // px to metres on the near plane
  cam.position.set(sheepX + (0.5 - sheepShare) * W / A, EYE, CAM);
  cam.rotation.set(0, 0, 0);
  cam.projectionMatrix.makePerspective(-W / 2 * k, W / 2 * k, horizonY * k, -(H - horizonY) * k, near, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}
```

Never call `cam.updateProjectionMatrix()` on this camera: it would undo the shift. Call `placeDreamCamera` when the window's size changes and each frame the sheep's x changes.

**Where a point lands** (the same formulas are in `data/camera.json` and in `tools/render.py`):

```
horizon  = laneLine − A × EYE                          (px from the window's top)
screen x = W/2 + A × (x − camX) × CAM / (CAM − z)
screen y = horizon − A × (y − EYE) × CAM / (CAM − z)
```

For z = 0 these become `W/2 + A × (x − camX)` and `laneLine − A × y`: today's mapping.

**At 1440 x 900** (in the pictures here the dream window is 1,420 x 626): the lane line is 476 px from the window's top, the horizon 260 px, and the window's lower edge meets the ground at z = 6.6.

**The sheep.** It is drawn by this camera too, so its back shows a little from above. Its place and size on the lane do not change.

## 4. The rows

Everything stands in one of these rows. A row's **scale** is how big a metre looks there beside a metre on the lane; it is also that row's speed across the window. Nobody types a speed.

| Row | z (m) | Scale and speed | Its ground is this far from the lane line (at `A` = 90) | Tint | What stands there |
|---|---|---|---|---|---|
| F2 | 5.6 | 1.54 | 116 px below | 0.46 | The wall (world 1), drifting clods (world 2) |
| F1 | 3.4 | 1.27 | 58 px below | 0.54 | Open snow with a few ripples |
| The lane | 0 | 1 | 0 | 1.0 | The track, the sheep, obstacles, signposts, gate 1 |
| B1 | −3 | 0.84 | 34 px above | 0.72 | The fence and its bulbs; the bed gates stand at −1.9 |
| B2 | −10 | 0.62 | 83 px above | 0.68 | The yard: pines, the scarecrow, bales, the coop, the pond |
| B3 | −30 | 0.35 | 141 px above | 0.68 | The barn and silo, the farmhouse, taller pines |
| B4 | −60 | 0.21 | 171 px above | 0.66 | The windmill on its hill; the candle (at −52) |
| B5 | −110 | 0.13 | 189 px above | 0.64 | Far hills |
| The sky | −180 and −420 | 0.08 and 0.04 | above the horizon | none | The northern light; the moon |

`scale = CAM / (CAM − z)`. The foreground rows F1 and F2 lie below the lane on screen. Nothing in them may be taller than 0.6 m, so nothing ever covers the track.

**The tint** is a number each row's paint is multiplied by when its mesh is built. It makes the track the brightest band of the picture and everything else quieter, as the binding rule asks. For a z between two rows, take the straight line between their tints. A few things carry their own tint; they are marked in `data/worlds.json` (for example the track is always 1.0, and things that give light are never tinted).

## 5. Light

Each world has one sky fill and one moon (or candle) light, and no other real lights. The values below are where to start. **The target** is in `data/palette.json` under `light_targets`: what a block of each paint must look like on its top, front and side faces in each world. Tune the lights until an untinted block standing on the track comes within 8% of those colours on every face, with haze off.

| World | Sky fill (`HemisphereLight`: sky, ground, strength) | Main light (`DirectionalLight`: colour, strength, where it comes from) | Target for a snow block: top, front, left side |
|---|---|---|---|
| 1 | `#9FB4E8`, `#3A4670`, 0.60 | `#DDE6FF`, 0.9, from the front left and above: (−0.30, 0.80, 0.52) | `#C1C9E2`, `#9BA4C5`, `#828AAC` |
| 2 | `#8FD0CC`, `#2A3F5C`, 0.60 | `#D8F4EE`, 0.85, the same place | `#B2D2DC`, `#8FA8C0`, `#788CA9` |
| 3 | `#C9A9B8`, `#3A2A40`, 0.55 | `#FFDDB0`, 1.0, from the front right and above (the candle's side): (0.45, 0.75, 0.48) | `#EAD5BD`, `#C4AEA9`, `#9D8C99` |

Brian's standing limits hold: the fill never above 0.62, exposure 1, `PCFShadowMap`, the same tone mapping as Home.

| Part | Rule |
|---|---|
| Shadows | One map of 1,024 px, covering 12 m either side of the sheep and from z = −6 to z = 3. Casting: the sheep, obstacles, signposts, gates, the fence. Receiving: the track and its banks. Soft edge: Home's value |
| Shade further back | Baked, as on Home: under and around every placed model the ground's cells are darkened by up to 18% by distance to its footprint (`PLAN_DIORAMA_SCENERY.md` 4.3). No shadow map beyond z = −6 |
| Corner shading and soft edges | The mesher's own (`AO_STEP`, `ROUNDED_VOXELS`), as on Home. Flat things made to be flat (ground steps, the track) are meshed plain, as Home's roof snow is |
| Things that give light | Bulbs, lit windows, lanterns, the candle's flame, the moon, the northern light. Their boxes are drawn in their own colour, unlit, never tinted and never hazed. Each model's `lights` list says where a soft round glow goes: an added sprite of that colour, as wide as `radius_m`, as strong as `strength` |
| Pools of light on the ground | Only for glows of 1.5 m or more (the barn's two lanterns, the bedroom window, gate 1's lanterns, the candle): a soft warm disc lying on the ground under the light, 1.5 times the glow's radius, at a quarter of its strength. No real light is added (as `PLAN_DEPTH_AND_LIGHT.md` A4) |
| Haze | three's `Fog`, in each world's haze colour, from its start distance. World 1: `#2D406B`, from 26 m, full at 177 m. World 2: `#1E4459`, 26 m, 206 m. World 3: `#4A3340`, 20 m, 165 m. (These give the strengths the pictures use: 82%, 80% and 62% at 150, 170 and 110 m.) |
| The sky | A dome or a far card with three colours from the top down to the horizon, and one more below it. World 1: `#0E1834`, `#1C2B52`, `#2D406B` (Home's night sky). World 2: `#0B1730`, `#16304F`, `#235066`, and `#0F2238` below. World 3: `#1A1430`, `#2C1F3F`, `#5A3A4A`, and `#241A30` below. The middle colour sits 55% of the way from the top to the horizon |
| Stars | Small squares of `#B9C8E6`, 2 and 3 px, at 35%, 55% and 80%: 60 on desktop, 30 on phones, at places hashed from the night's date, above the horizon only. They do not move with the lane |

## 6. How the scene is built

1. **Models are data** (file 03). A loader fills a `Grid` of the model's cell size with each box's cells and its colour, exactly as Home's new things do (`box()` into a `Grid`, then `buildGeometry`; `PLAN_DEPTH_AND_LIGHT.md` Appendix G).
2. **One strip is 96 m long** and repeats. `data/worlds.json` lists every model and every plain box of each world's strip, with its x, y and z.
3. **Meshes.** Build each world's strip into one mesh for each row group: F rows, the track, B1, B2, B3, B4 with B5. Things that move by themselves are their own meshes: the windmill's sails, the string of bulbs, each island group of world 2 (three groups by bobbing phase in each of B2 and B3), yarn balls, buttons, the needles. Scenery is merged, not instanced (the existing rule).
4. **Two copies** of the strip are drawn end to end. When one has passed fully out of the left of every row's view, it jumps to the right end. The far rows see about 100 m at once, so check the jump with row B5, not with the lane.
5. **Build in idle slices** (as the farm's build steps do), a world ahead: world 2's meshes are built while world 1 plays. Only during a gate do two worlds exist together.
6. **Particles** (snow, rising snow, feathers, hoof puffs) are small cubes in one instanced mesh per kind, spread through z = −14 to z = 6 so they too have depth.

## 7. What is removed from the build

- The flat scenery layers of all three worlds, the flat gates, the flat obstacles and their corner lanterns, the flat moon and stars, the bar-shaped northern light, the dotted star words.
- The 2D canvases that drew them. The dream window ends with one 3D canvas for the dream and the interface over it.
- Wheel ruts and hoofprints, if any were built.

## 8. Cost

`data/worlds.json` counts the boxes of one strip: world 1 has 2,131, world 2 has 2,312 (and 240 sheets of light), world 3 has 5,632.

| Thing | Limit |
|---|---|
| Triangles in view, any world, High tier | 90,000. On the Low tier 45,000: leave out rows B4 and B5, world 3's quilt beyond z = −21, and half the particles |
| Draw calls for the dream | 40 |
| Frame time | At most 2.5 ms more than the build today on High, 1.5 ms on Low. Measure each world and each gate |
| Building a world | At most 0.6 s on a laptop, in slices of at most 50 ms, finished before its gate |
| Memory | Two worlds at most, and only during a gate |
| Canvases | One for the dream (the two 2D ones go), one for the bedroom as today |
| Particles | 90 snow cubes on desktop, 45 on phones and on Low; 40 feathers; 24 hoof-puff cubes |
| The bundle | The models load only with Counting Sheep's own chunk (file 03, section 2). Say by how many bytes the main bundle and that chunk change |

If a limit is missed: stop and report. Never remove something from the High tier to meet a number.

## 9. Style rules that bind every model and box

They are the game's own (`PLAN_DIORAMA_SCENERY.md` 3.1 to 3.5, `PLAN_DEPTH_AND_LIGHT.md` 3 and 6.1):

1. Cells only of 0.05, 0.1 or 0.5 m (and 1 m for the far moon).
2. One flat colour for each part. Every colour is `solid(material, step)` from `LADDER`, step −2 to +2. No hex value in scenery code.
3. Neighbouring parts of one material differ by one step.
4. No model uses more than six materials (snow, light-giving parts and the season's parts are not counted).
5. Nothing random: every place, height and order in the data follows a fixed rule. The ground's shapes are Home's planned shapes (banks beside a path, wind ripples), not noise.
6. Every model stands on something: the ground, an island, the quilt, a thread.
7. No blocky clouds anywhere. No footprints, dents or ruts.

## 10. Checks for this file

1. **The same places on screen.** For the recorded night, the on-screen x of the sheep and of every rules box matches the record at every frame, and their y differs by one fixed amount (the play strip moved down). Add a unit test of `placeDreamCamera`: for z = 0, any x and y project to the mapping's x and to `laneLine − A × y`, to within half a pixel, at 1440 x 900, 1920 x 1080 and 390 x 844.
2. **The track is the brightest band.** In a screenshot of each world with the interface hidden, the average lightness of the band the track fills is higher than that of every other band of the same height. (The pictures here: 0.69 against 0.63, 0.83 against 0.67, 0.87 against 0.66.)
3. **Not harsh.** With `tools/depth/measure.py` on a screenshot of each world: hard edges at most 2.5%, the strongest colour at most 0.17. (The pictures here: 1.1%, 1.9%, 1.4%; and 0.075, 0.066, 0.095.)
4. **The light targets** of section 5, within 8%.
5. **The cost** of section 8, with numbers in the pull request.
6. **The style lint** passes on every dream file: no off-ladder size, no off-palette colour, no `rng`, `hash3`, `pick` or `snowPaint` for a colour.
