# 04. The micro layer: small blocks, soft ground shade, and the review pictures

This file adds what the reference has and the game lacks: a second, much smaller block size for tools, fittings and props, and a soft shade on the ground under everything. It also defines the review pictures every model is judged by. Milestone M3 builds the system and one proof corner; M4 and M5 place the rest (file 05).

## 1. What the micro layer is

- A micro block is a cube of **0.05 m**. A structure block is 0.2 m, so sixteen micro blocks cover one face of a structure block.
- Micro objects are small things a farm really has: crates, barrels, milk cans, tools, hinges, lanterns, bales, a bench. Each is built from solid-coloured parts (file 01, rules R1 to R3).
- The layer exists **on Home only**. It is built in a new file `src/skin/scene/farmMicro.ts` and mounted by `src/skin/table/Farmstead.tsx`, next to the farm's own meshes. The barn table, the podium and the small scenes never mount it, so their triangle counts do not change.
- Nothing in the layer stands inside the wedge or the paddock (file 05, section 1). The layer is hidden on the paddock shot.

## 2. The builder: `src/skin/voxel/micro.ts`

```ts
export const MICRO = 0.05;

/** One micro object: cubes on its own 0.05 m grid, origin at its minimum corner, x right, y up, z back. */
export interface MicroObject { name: string; size: [w: number, h: number, d: number]; cubes: Grid; }

/** Where an object stands: minimum corner in metres (on the 0.05 m grid), and quarter turns about y (0 to 3). */
export interface Placement { kind: string; at: [x: number, y: number, z: number]; turn?: 0 | 1 | 2 | 3; options?: Record<string, unknown>; cluster: string; }

/** Stamps an object's cubes into a cluster's world grid at a placement. Throws if a cube lands on an occupied cell. */
export function place(world: Grid, object: MicroObject, p: Placement): void;
```

- Every object is a function in `src/skin/voxel/microKit.ts` that returns a `MicroObject` (section 6). Objects are pure: the same arguments give the same cubes.
- Turns are quarter turns only, so every cube stays on the world's 0.05 m grid.
- All placements live in one exported list, `MICRO_PLACEMENTS` in `farmMicro.ts` (file 05, section 8 gives every entry). Each placement names its **cluster** (for example `workCorner`); one cluster becomes one mesh.
- `place()` throws when two objects overlap. `farmMicro.ts` also checks each placement against the structure grids it is given (the yard's and the farm's cube maps) and throws if a micro cube lands inside a structure cube. A drift cube of the yard under a placement is the one allowed case: the yard removes its drift cubes under every placement's footprint plus 0.1 m (file 03, section 3.1), and `farmMicro.ts` exports the footprints for that.

## 3. Rules for every micro object

1. Solid colours from file 01's ladders only. One part, one colour.
2. A part is at least 1 cube thick and at least 2 cubes long. No single cube stands alone, except a knob, a peg, an egg or an apple.
3. Every object stands on something: the ground, a floor, a wall or another object. `npm run check:floating` must pass with the layer mounted.
4. No object is taller than 1.9 m. No object is placed inside the wedge or the paddock.
5. Where an object stands in a drift, the drift cubes under it are removed and the object stands on the flat ground.
6. An object against a wall touches the wall, or something that stands proud of the wall (a foundation course, a rail), and shares no cell with either. A leaning tool touches at its foot and within one cube at its top.
7. No object blocks a tour camera's view of the hero sheep, the barn's doorway or the tractor. File 05, section 7 has the keep-clear list.
8. Objects do not move, glow or cast light. A lantern's glass is treated like the farmhouse's lit windows are today.
9. No text, letters, numbers or logos on anything.
10. The kit is closed. If a shot looks empty, choose from the kit; do not invent a new object without asking.

## 4. Meshing, distance, shadows, budget

**Meshing.** Each cluster's grid is meshed once with `buildGeometry(map, MICRO, { merge: true, near })` and then `packGeometry`.
- `merge: true` joins flat faces of one colour into rectangles of up to eight cubes a side (`MERGE_FLAT` in `mesher.ts`). On solid-coloured boxes this removes most triangles. The mesher's own note says merged faces can move a pixel by one step of 255 at a shadow's edge; that is accepted for this new layer.
- `near` is a **new** mesher option: `near?: (x: number, y: number, z: number) => boolean`, asked in the model's own cube indices. The mesher uses it only when it works out corner shade: a corner counts as shut if the model itself has a cube there **or** `near` says something else does. It is never used to hide faces. `farmMicro.ts` passes a function that answers true for the ground (y below the placement's base) and for structure cubes of the yard and the farm at that spot. Result: a crate gets a soft dark line where it meets the wall and the snow, as if it belonged there.
- Faces that look straight down at the ground are dropped with the existing `dropFaces` (`yard.ts`).

**Distance.** A cluster is drawn on a tour shot only if its centre is within **40 m** of the camera at the start or the end of that shot's push. This is decided in the dip, in the same place where `Farmstead.tsx` already decides per shot which scenery casts shadows. Beyond 40 m a 0.05 m block is smaller than two pixels and would only shimmer. On the paddock shot every cluster is hidden. On the Low tier the layer is not drawn at all.

**Shadows.** Every cluster receives shadows. A cluster casts shadows only on shots where it is within 25 m of the camera.

**Budget** (measured with the game's own counter, `DevStats`, on High at 1280 x 720):

| Limit | Value |
|---|---|
| Triangles in the whole micro layer, after merging | 120,000 at most |
| Micro triangles drawn on any one shot | 80,000 at most |
| Extra draw calls on any one shot (before the shadow pass) | 10 at most |
| Clusters | 8 |
| Build time of the layer on the reference computer | 150 ms at most, in the same sliced build as the farm |

If a limit is passed: first check that `merge` is on; then lower the number of objects in the largest cluster, starting from the end of its list in file 05. Do not thin objects by removing parts.

## 5. The ground shade map

The reference has a soft, slightly darker patch on the ground under and beside every object. Blurring the sun's shadow cannot give that (file 02, Change E). A small picture baked once at build time can, at no cost per frame.

**What it is.** One single-channel texture that covers the farm from above. White means "open ground". Darker means "something stands here or close by". The voxel material multiplies the snow's colour by it, on ground-level top faces only.

**Area and size.** x from −44 to 44, z from −16 to 50: 88 m by 66 m. One texel per 0.1 m: 880 x 660 texels (581 kB). On the Low tier one texel per 0.2 m: 440 x 330. `DataTexture`, `RedFormat`, `UnsignedByteType`, `LinearFilter`, clamped at the edges, no mipmaps. Behind the line (z < −16) there is no map, so nothing changes there.

**How it is baked** (new file `src/skin/voxel/groundShade.ts`, run at the end of the farm's sliced build):
1. Start with an array of zeros, one number per texel: "how much is standing here".
2. For every cube of these models whose underside is lower than 0.8 m above the ground, add to the texels under it the weight `w = 1 − max(0, underside − 0.05) / 0.75` (1 for something touching the ground, falling to 0 at 0.8 m). Keep the largest weight per texel. Models: the farm's structure (`big`, `small`, `shell` in `farmstead.ts`), the yard's standing cubes (`v.y >= 0` in `yard.ts`), the snowman, every micro cluster, and the trunks of country trees in front of the line (cubes of `countryside.ts` with z ≥ −16 and height under 0.8 m: read them, do not change them).
3. Do **not** count ground itself: the snow layer, drifts, the path, the straw bed, the pond's ice, dents.
4. Blur twice: a tight blur (box blur of radius 1 texel, run twice) and a wide blur (box blur of radius 4 texels, run three times).
5. Shade per texel: `s = 1 − 0.30 × tight − 0.20 × wide`, clamped to 0.6 at the least. Store `round(s × 255)`.
6. Set texels inside the barn's floor (x from −6.2 to 6.2, z from −4.4 to 7.2) to 255, so the barn table's floor is untouched.

What that gives: along the foot of a long wall the snow is about 75% as bright as open snow, fading to 100% within 1.2 m. Round a fence post it is about 90%, fading within 0.4 m. Beside a crate it is darkest right at the crate's edge.

**How the material uses it** (in `src/skin/voxel/material.ts`, inside the existing `onBeforeCompile`):
- Vertex shader: pass down the world position's x and z, its y, and the world normal's y. (World position is `modelMatrix × vec4(transformed, 1.0)`. If any voxel mesh is drawn instanced, also multiply by `instanceMatrix`, as three's own `worldpos_vertex` chunk does.)
- Fragment shader, right after `#include <color_fragment>`:

```glsl
if ( vUp > 0.5 && vWorldY < 0.26 ) {
  float s = texture2D( uGroundShade, ( vWorldXZ - uShadeOrigin ) / uShadeSize ).r;
  diffuseColor.rgb *= mix( vec3( 0.78, 0.83, 0.93 ), vec3( 1.0 ), s );
}
```

- The shade colour `(0.78, 0.83, 0.93)` is slightly blue, because ground in shade is lit by the sky.
- `vWorldY < 0.26` limits it to the ground, drifts and dents. Tops of crates, bales and roofs are not touched.
- The three uniforms are one shared object, so every voxel material reads the same map. Until the map is baked, and in every scene that has none (the duel, the pen, the dream, the bedroom, the podium), the uniform is a 1 x 1 white texture and nothing changes.
- Change `customProgramCacheKey` (today `'voxel-color16'`) so the new program is compiled.

**Switch.** `?shade=off` leaves the white texture in place, for pairs.

**Animals.** The small dark patch under each animal's feet (`src/skin/voxel/contactPatch.ts`) stays exactly as it is, colour included. It is also used on the barn's hay floor and on the ice, where a snow colour would be wrong.

**If it cannot be done this way.** If the shader edit costs more than 0.3 ms a frame on the Low tier, or any existing picture test of the table fails because of it, stop and report. Do not fall back to painting grey gradients into the ground's cubes.

## 6. The kit

Sizes are in micro cubes, width x height x depth, then in metres. Coordinates inside an object start at 0 at its minimum corner. "Ring" and "disc" tests use the distance from the object's centre line, in cubes. Every colour is a ladder name and step from file 01.

### K1. `crate` and `crateOpen` — 10 x 9 x 10 (0.50 x 0.45 x 0.50 m)
| Part | Cubes | Colour |
|---|---|---|
| Dark inside | x 1–8, y 0–7, z 1–8 | `darkWood` −1 |
| Four corner posts | 1 x 8 x 1 at the four corners | `wood` −1 |
| Slats, three per side, 2 cubes high | y 0–1, 3–4, 6–7 on the outer layer between the posts. Rows y 2 and y 5 of the outer layer are left empty, so the dark inside shows as two gaps | Sides facing ±z: `wood` 0. Sides facing ±x: `wood` +1 |
| Lid (`crate` only) | x 0–9, y 8, z 0–9 | `wood` +1 |
| Snow (option `snow: true`, `crate` only) | One more layer on the whole lid | `snow` +1 |
| Contents (`crateOpen` only; no lid) | The top layer of the inside, y 7 | `apples`: each cube is one apple, `scarfRed` 0 and +1 in a checker. `carrots`: rows along x, `carrot` 0 and −1 alternating |

### K2. `barrel` — 10 x 14 x 10 (0.50 x 0.70 x 0.50 m)
| Part | Cubes | Colour |
|---|---|---|
| Staves | Every column within 5.0 of the centre line, y 0–13 | Sixteen staves by angle, alternating `wood` 0 and `wood` −1 |
| Two hoops | Rows y 2 and y 11, cubes further than 4.0 from the centre | `iron` 0 |
| Recessed lid | Remove the cubes of row y 13 within 4.0 of the centre; row y 12 within 4.0 | `wood` −1 |
| Snow (option) | Fill the recess at y 13 | `snow` +1 |

### K3. `milkCan` — 6 x 13 x 6 (0.30 x 0.65 x 0.30 m)
| Part | Cubes | Colour |
|---|---|---|
| Body | Within 3.0 of the centre, y 0–8 | `stone` +1 |
| Shoulder | Within 2.2, y 9–10 | `stone` 0 |
| Neck | Within 1.6, y 11 | `stone` −1 |
| Lid | Within 2.2, y 12 | `stone` +1 |
| Two handles | One 1 x 2 x 2 block on each side in x, just outside the body, at y 8–9 | `iron` 0 |

### K4. `pail` — 6 x 6 x 6 (0.30 x 0.30 x 0.30 m)
| Part | Cubes | Colour |
|---|---|---|
| Foot | Within 2.2 of the centre, y 0–1 | `stone` 0 |
| Wall | Within 3.0, y 2–5 | `stone` 0; the top row y 5 is the rim, `stone` +1 |
| Contents | Row y 5, within 2.0 | `ice` 0 (frozen water), or `hay` 0 (feed), or removed with row y 4 painted `stone` −2 (empty) |

### K5. `sack` — 8 x 6 x 5 (0.40 x 0.30 x 0.25 m)
| Part | Cubes | Colour |
|---|---|---|
| Body | x 0–7, y 0–4, z 0–4, without the two long top edges (y 4 at z 0 and at z 4) | `straw` −1 |
| Stripe | Every body cube with x 3 or 4 | `scarfRed` 0 |
| Tied neck | x 6–7, y 5, z 2 | `straw` −2 |

### K6. `pitchfork`, K7. `shovel`, K8. `broom` — leaning tools
All three lean against a wall. The handle is 1 x 1 cube thick, `wood` +1, and steps one cube toward the wall every 7 cubes of height, so the foot stands 0.2 m out from the wall and the top touches it.

| Tool | Parts | Total height |
|---|---|---|
| `pitchfork` | Handle 28 high. On top, a cross bar 5 x 1 x 1 in `iron` +1, and three tines 1 x 4 x 1 above it at x 0, 2 and 4, `iron` +1 | 33 cubes, 1.65 m |
| `shovel` | Blade at the bottom, 4 x 5 x 1, `stone` −1. Handle 24 high from the blade's top centre. A grip 3 x 1 x 1 on top, `wood` 0 | 30 cubes, 1.50 m |
| `broom` | Head at the bottom, 5 x 4 x 2, `straw` −1. A band 5 x 1 x 2 above it, `scarfRed` 0. Handle 24 high | 29 cubes, 1.45 m |

### K9. `wallLantern` — 3 x 5 x 3, plus its arm (0.15 x 0.25 x 0.15 m)
| Part | Cubes | Colour |
|---|---|---|
| Arm from the wall | 1 x 1 x 4, level with the lantern's top; the lantern hangs under its outer 3 cubes | `iron` 0 |
| Cap and base | 3 x 1 x 3 each, at y 4 and y 0 | `iron` 0 |
| Glass | 3 x 3 x 3 at y 1–3 | `brass` +2 |
| Cage | The four vertical corner columns of the glass | `iron` 0 |

It hangs one cube clear of the wall. It adds no light. Put its glass in whatever mesh and material the farmhouse's lit windows use today, so it behaves like them at night.

### K10. `squareBale` — 18 x 9 x 9 (0.90 x 0.45 x 0.45 m), and `hayHeap` — 14 x 4 x 10
| Part | Cubes | Colour |
|---|---|---|
| Bale body | The whole box | `hay` 0 |
| Two end faces | The layers x 0 and x 17 | `hay` −1 |
| Two twine bands | Surface cubes with x 5 or x 12, all the way round | `hay` −2 |
| Snow (option) | One layer on the whole top | `snow` +1 |
| `hayHeap` | Four layers: 14 x 10, then inset by 1, by 3 and by 5 cubes on every side | Bottom layer `hay` 0, the three above `hay` +1 |

### K11. `choppingBlock` with `axe` — 8 x 6 x 8 (0.40 x 0.30 x 0.40 m)
| Part | Cubes | Colour |
|---|---|---|
| Bark | Columns between 3.0 and 4.0 from the centre, y 0–5 | `darkWood` 0 |
| Wood | Columns within 3.0, y 0–5 | `wood` +2; on the top row the middle 2 x 2 is `wood` 0 (the heart of the log) |
| Axe head | 3 x 3 x 1, its lowest row sunk into the block's top | `stone` −1 |
| Axe handle | 1 x 1, 9 cubes, rising from the head and stepping one cube in +x every 3 | `wood` +1 |

### K12. `splitLogs` — 12 x 6 x 9 (0.60 x 0.30 x 0.45 m)
Three logs side by side (each 12 x 3 x 3, at z 0–2, 3–5, 6–8) and one on top (at z 2–4, y 3–5). Bark `darkWood` 0, −1, 0 for the lower three and `darkWood` −1 for the top one. Both end faces of every log (x 0 and x 11): `wood` +2.

### K13. `handPump` — 5 x 19 x 9 (0.25 x 0.95 x 0.45 m), with a `pail`
| Part | Cubes | Colour |
|---|---|---|
| Base slab | 5 x 1 x 5 | `stone` −1 |
| Body | 3 x 14 x 3, centred on the slab, y 1–14 | `pine` −1 |
| Cap | 3 x 1 x 3 at y 15 | `pine` 0 |
| Spout | 1 x 2 x 3 out of the body's front at y 10–11, with one cube hanging down at its end | `pine` −1 |
| Handle | From the back of the cap: 1 x 1, 6 cubes going back, rising one cube every 2; a grip 1 x 2 x 1 at its end | `iron` 0 |
| Pail under the spout | K4 with ice | |

### K14. `cartWheel` — 16 x 16 x 2 (0.80 x 0.80 x 0.10 m), upright against a wall
| Part | Cubes (distance from the wheel's centre, in its own plane) | Colour |
|---|---|---|
| Rim | Between 7.0 and 8.0 | `wood` −1 |
| Eight spokes | Four straight lines through the centre (level, upright and both diagonals), 1 cube wide, between 1.6 and 7.0 | `wood` +1 |
| Hub | Within 1.6 | `iron` 0 |

### K15. `bench` — 20 x 14 x 7 (1.00 x 0.70 x 0.35 m)
| Part | Cubes | Colour |
|---|---|---|
| Two end frames, at x 1 and x 18 | Front leg at z 0, y 0–7. Back post at z 6, y 0–13. A stretcher z 1–5 at y 3 | `wood` −1 |
| Seat: three boards along x, at y 8 | z 0–1, z 2–4, z 5–6 | `wood` 0, `wood` +1, `wood` 0 |
| Back: two rails along x, at z 6 | y 10–11 and y 13 | `wood` 0, `wood` +1 |
| Snow (option) | One layer on the two rear seat boards | `snow` +1 |

### K16. `eggBasket` — 6 x 7 x 6 (0.30 x 0.35 x 0.30 m)
| Part | Cubes | Colour |
|---|---|---|
| Floor and wall | Floor: row y 0 within 3.0. Wall: between 2.0 and 3.0, y 0–2 | `straw` −2 |
| Lining | Row y 2 within 2.0 | `straw` −1 |
| Five eggs | Five of the lining's cubes, in a plus shape | `trimWhite` +1 |
| Handle | Two posts 1 x 3 x 1 on opposite sides of the rim (y 3–5) and a bar across at y 6 | `straw` −2 |

### K17. `skates` — a pair, 6 x 4 x 5 together
Each skate: a blade 1 x 1 x 5 at y 0, `stone` +2; a boot 2 x 3 x 4 on it at y 1–3, `trimWhite` −1, with its top row `scarfRed` 0. The second skate stands one cube beside the first, turned a quarter.

### K18. `shutter` — 6 x H x 1, one each side of a window
Boards: the whole panel, `pine` −1, as tall as the window's frame. Two battens across it, 6 x 1 x 1, one cube proud of the panel, at a quarter and at three quarters of its height: `pine` 0.

### K19. Fittings
| Fitting | Size | Colour |
|---|---|---|
| `strapHinge` | 6 x 2 x 1, lying flat on a door or gate | `iron` 0 |
| `latch` | A bar 4 x 1 x 1 and a knob 1 x 1 x 1 at its end | `iron` 0, `brass` 0 |
| `knob` | 2 x 2 x 2 | `brass` 0 |
| `horseshoe` | 5 x 5 x 1, a U with its open end up: four rows `#...#`, then a bottom row `.###.` | `iron` +1 |
| `ropeCoil` | A ring 6 across and 1 thick (between 1.6 and 3.0 from its centre), hanging on a peg 1 x 1 x 2 | `straw` −2, peg `iron` 0 |
| `hoistRope` | 1 x 16 x 1 hanging from the end of the barn's hoist beam, with a three-cube hook at its end | `straw` −2, hook `iron` 0 |
| `cleat` | W x 1 x 1, across a ramp, as wide as the ramp | `wood` +1 |

## 7. The review pictures and the self-review loop

Claude Code cannot judge a model from its numbers. It can judge a picture. So every model is photographed and looked at before it is committed, and the pictures use the reference's own framing.

**The page.** `?preview=mini` (development builds only, next to the existing previews):

| Address | Shows |
|---|---|
| `?preview=mini&piece=<name>` | One kit object, or one Home model (`barn`, `silo`, `coop`, `tractor`, `farmhouse`, `pine`, `fence`, `woodpile`, `snowman`, `orchardTree`, `gate`, each animal), standing alone on a floating slab of snow 0.4 m thick (top `snow` 0, sides `snow` −1), against a plain `#F4F1EC` background. Camera without perspective (orthographic), 35° down and 45° round. Day light of file 02. A 2 x 2 grid: two three-quarter views from opposite corners, one front view, one top view. The player's sheep stands beside it for scale. |
| `?preview=mini&sheet=kit` | Every kit object in rows, at one scale, each on its own small slab. |
| `?preview=mini&sheet=home` | Every Home model in rows, at one scale, each on its own slab. This picture is the one to hold next to the reference. |
| `?preview=mini&cluster=<name>` | One micro cluster with the piece of wall or ground it stands on. |

The slabs exist only on this page. Home itself does not get bases.

**The tool.** `node tools/miniature/shots.mjs` (new, modelled on the scripts under `tools/`):
- `shots.mjs piece <name>`, `sheet kit`, `sheet home`, `cluster <name>`: opens the page in a headless browser at 1600 x 1200 and saves a PNG to `docs/miniature/review/`.
- `shots.mjs tour [--hour day|dawn|dusk|night] [--phone]`: saves every tour shot of Home through `?pov=N` (and the hour through `?hour=`), 1280 x 800 for the computer and 390 x 844 for the phone, to `docs/miniature/review/tour/`.
- `shots.mjs before`: the same tour pictures, saved once in M0 to `docs/miniature/before/` and never overwritten. These are the "before" half of every pair.

**The loop, for each model or cluster.**
1. Build it from this plan's numbers.
2. Run the tool. Open the saved picture with the Read tool and look at it.
3. Go through the ten checks. Write one line per check in the commit message: pass, or what was fixed.
4. Fix and repeat until all ten pass. Do not move on with an open check.

**The ten checks.**
1. It is recognisable in the top view and the front view without its name.
2. Every part is one solid colour. No speckle anywhere when the picture is enlarged.
3. Parts that touch can be told apart (posts from rails, boards from boards, lid from box).
4. Big blocks and small blocks are both visible, and the small ones are clearly smaller.
5. Edges are crisp. Nothing looks melted or rounded.
6. Snow lies in whole caps with straight or stepped edges.
7. Nothing floats, nothing passes through anything else.
8. Next to the sheep it is the size this plan says.
9. Its shadow on the slab is one clean shape, and the snow is gently darker round its foot.
10. It uses only colours from file 01's table, and it looks like it belongs to the same set as the rest of the sheet.

**The sheet for Brian.** Each pull request that adds or changes models includes the current `sheet-home.png` or `sheet-kit.png`. That one picture is how Brian approves models without reading code.

## 8. What the coder must not do

- Do not invent an object, a count or a place. If a shot needs something the kit lacks, stop and ask.
- Do not "fix" a failed check by deleting the model.
- Do not add texture, grain, gradient or random tone to make a flat area "less empty".
- Do not place anything in the wedge or the paddock, or anything taller than 1.9 m anywhere.
- Do not edit the wendigo's files, `countryside.ts`'s cubes, or any file under `src/engine/`, `src/net/`, `src/state/` or `server/`, or the word lists.
