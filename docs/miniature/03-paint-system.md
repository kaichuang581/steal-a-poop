# 03. The paint system: solid colours, value steps, chunky blocks, sharp edges

This file removes the noise (milestone M2). It changes how existing models are coloured and how sharp they are, on Home and in the barn. It adds no new objects; file 04 does that.

Rules R1 to R9 are in file 01. The wendigo's line and wedge are in file 05, section 1. Read both first.

## 1. One new module: `src/skin/voxel/paint.ts`

```ts
import type { Paint } from './primitives';
import { hash3 } from './primitives';

/** Five steps per material: index 0 is step −2, index 2 is step 0, index 4 is step +2 (docs/miniature/01, section 4). */
export const LADDER = {
  snow:       ['#D9D6D0', '#E7E5E0', '#F4F2EE', '#FBFAF7', '#FBFAF7'],
  barnRed:    ['#A52A1F', '#AE392D', '#B8473A', '#C25447', '#CB6153'],
  // ... every row of the table in file 01, section 4, copied exactly
} as const;
export type Mat = keyof typeof LADDER;
type RGB = [number, number, number];

/** A material's colour at a step, as linear RGB. No desaturation: these are final colours. */
export function solid(mat: Mat, step = 0): RGB;            // step clamped to −2..2; result cached per (mat, step)

/** Any colour at a step, by the same maths as the ladders (tools/miniature/ladder.mjs). No desaturation. For colours
 *  that are not in the table: animals, garments, skins. `shade('#B8473A', 1)` equals `solid('barnRed', 1)`. */
export function shade(hex: string, step = 0): RGB;

/** The average colour of today's random three-tone pick, with today's desaturation: same overall colour, no speckle. */
export function meanTone(tone: Tone, w: readonly [number, number] = [0.6, 0.9]): RGB;   // w0*t0 + (w1-w0)*t1 + (1-w1)*t2, in linear RGB, each through lin()

/** A paint that gives every cube the same colour (rule R1). */
export const paint = (mat: Mat, step = 0): Paint => { const c = solid(mat, step); return () => c; };

/** A paint whose step depends on which part a cube belongs to. `part` returns the part's number for a cube. */
export const byPart = (mat: Mat, steps: readonly number[], part: (x: number, y: number, z: number) => number): Paint =>
  (x, y, z) => solid(mat, steps[((part(x, y, z) % steps.length) + steps.length) % steps.length]);

/** A paint whose step is chosen per part from −1, 0, +1 with weights 25%, 50%, 25%, seeded. */
export const seededPart = (mat: Mat, seed: number, part: (x: number, y: number, z: number) => number): Paint =>
  (x, y, z) => { const r = hash3(part(x, y, z), seed, 0, 97); return solid(mat, r < 0.25 ? -1 : r < 0.75 ? 0 : 1); };
```

Notes for the coder:

1. `solid()` converts the hex with three's `Color` (sRGB to linear) and stops there. It does **not** call `lin()`, because `lin()` removes 30% of the saturation (`DESATURATE = 0.7` in `palette.ts`).
2. `palette.ts` is not deleted and `DESATURATE` is not changed. `lin()`, `pick()` and `T` stay for everything this plan does not repaint: everything behind the line, the wendigo's surroundings, and any scene not yet reached by its milestone. When the last milestone is done, list in the pull request which callers of `pick()` remain and why.
3. `hash3` may appear inside `part()` functions only as a way to number or choose whole parts (rule R3). It may never take a single cube's own x, y and z together as its only inputs.
4. A copy of the ladder tool is in this folder as `ladder.mjs`. Put it at `tools/miniature/ladder.mjs`. `node tools/miniature/ladder.mjs '#B8473A'` prints the five steps for a step-0 colour. Use it for any material the working tree has that the table lacks (file 01, section 4, rule 3).

`shade()` is used by file 06 (animals keep their own colours and still get value steps). `meanTone()` is used by file 07 (the night scenes keep their overall colour and lose only the speckle).

A unit test `src/skin/voxel/__tests__/paint.test.ts` checks: every ladder has five valid hex colours; lightness never falls from step −2 to +2; `shade(step0, k)` equals the table's colour for every row except `snow` (whose steps are chosen by hand); `solid()` returns the same array for the same arguments; no ladder colour is `#000000` or `#FFFFFF`.

## 2. Three ways to choose a step

| Way | When | Example |
|---|---|---|
| Fixed: `paint('wood', -1)` | The part is one of a kind, or its role decides the step (posts −1, lower rail 0, upper rail +1) | Fence posts |
| By part number: `byPart('barnRed', [0, -1, 0, 1], (x) => Math.floor((x + 62) / 3))` | Parts repeat in a row and should alternate in a regular rhythm | Barn boards, clapboards, shingle courses |
| Seeded per part: `seededPart('stone', 51, (x, y, z) => (x >> 2) * 31 + (y >> 1) * 7 + (z >> 2))` | Parts are irregular by nature | Foundation stones |

A part number must be the same for every cube of the part. For a board three cubes wide, that is the column index divided by three and rounded down, not the cube's own index.

## 3. Snow

| Snow part | Colour | Shape rule |
|---|---|---|
| Open ground | `snow` 0 | Flat |
| Trodden ground: the main path and the two tracks of file 05, section 3 | `snow` −1 | Flat, with a clean edge |
| Dents (hoof prints, sled tracks) | `snow` −2 | As today |
| Drifts (the 0.2 m raised layer by walls, fences and the pond) | `snow` +1 | Clean scalloped outline, section 3.1 |
| Caps on posts, rails, roofs, props, branches | `snow` +1 | Whole top, section 3.2 |

The painted snow texture (`snowPaint`, `snowAt`) is no longer used in front of the line. This overrides "the snow's texture stands" in `CLAUDE.md` and therefore needs Brian's yes (decision 4). Until he answers, build it behind a constant `SOLID_SNOW = true` in `paint.ts`, so that `false` restores the texture on ground and caps and nothing else.

### 3.1 Drifts with clean outlines

Today a drift cube is placed where a random number passes a test (`fenceD < 0.8 && r > 0.45` in `ground()` in `yard.ts`), which gives a ragged, speckled edge. New rule: a drift is a band whose width changes in whole cubes along its length.

- Width function: `w(t) = 0.4 + 0.2 × Math.round(1 + Math.sin(t × 0.8 + 1.3))`, which gives 0.4, 0.6 or 0.8 m. `t` is the distance along the fence or wall in metres.
- By the yard fence: a cube is drift if `|z − fence.z − 0.1| < w(x)`, for x inside the fence's length and outside the gate (`|x| > gateHalfWidth + 0.4`), as today.
- By the barn's back wall and side walls: the same test with the distance to the wall's outer face, as today's `byBarnBack` and `byBarnSide` but with `w()` in place of `0.3 + r × 0.4`. The `underWalls` exclusion stays (it prevents flicker under the wall boards).
- Round the pond: a cube is drift if `1 ≤ pondD < 1.18` (a whole raised rim), in place of `pd < 1.3 && r > 0.35`.
- A drift cube is removed again wherever a micro object will stand (file 04, section 3, rule 5).

### 3.2 Caps

- `cap(x, y, z)` is unchanged: it puts one snow cube on a cube if nothing is there.
- Every call that gates a cap on a random number (`if (hash3(...) > 0.3) cap(...)`, `capAll(..., 0.85)`) becomes a planned shape. The rule for each object is in the tables of section 7. The general patterns:
  - **Rails:** snow on the whole length of the top rail, none on the lower rail (it is sheltered).
  - **Posts:** the whole top.
  - **Pitched roofs:** the whole roof except the lowest two rows at each eave, which are bare where the snow has slid off.
  - **Flat props (hood, bale, crate lid):** the whole top, or the whole top except a straight strip one cube wide at one end.
- **Exception, for the wendigo:** inside the wedge, above y = 2.0 m, caps stay exactly where they are today, random holes included (the barn roof's north-east corner, the silo's cap, the paddock shed's roof). Only their colour changes. Section 8 lists this.

## 4. Chunky structure: no smoothing

**Today:** on a computer, three builds pass their models through `detailedSteps`, which halves every cube, cuts the outermost corners and adds grain: the near farm (`detailedSteps(big.g.map, S)` in `farmstead.ts`), the tractor (`detailedSteps(small.g.map, F, 0.03)`), and everything standing in the yard (`detailedSteps(g.map, S, 0.04, standing)` in `yard.ts`). Touch screens and the Medium and Low tiers already skip this and show the blocks as authored.

**New:** those three calls always take the unsmoothed path, on every device and tier. In code, add to `refine.ts`:

```ts
/** Structure is shown as authored, never smoothed (docs/miniature/03, section 4). False restores the smoothing, with no grain. */
export const CHUNKY = true;
export function* structureSteps(map: VoxelMap, size: number, only?: (v: Voxel) => boolean) {
  return yield* (CHUNKY ? detailedSteps(map, size, 0, only, true, true) : detailedSteps(map, size, 0, only));
}
```

and call `structureSteps` at those three places. The last two arguments matter: the farm and the world are built under `inDetail(...)` (`src/skin/table/Farmstead.tsx`, `src/skin/table/BarnTable.tsx`), which overrides the `coarse` argument unless `deaf` is true. With `coarse` true the function returns the model untouched and adds no grain.

- Do **not** make this a global switch inside `detailedSteps`. The land (`detailedSteps(g.map, 1, 0)` in `terrainSteps`) and the back hills (`distance.ts`, called with `deaf`) must keep their smoothing exactly, because their cubes near the wendigo are pinned.
- Result on a computer: walls, roofs, trees and fences show clean 0.2 m blocks; the tractor shows 0.1 m blocks. Triangles for those models fall to roughly a third. That saving pays for file 04's micro layer.
- The game builds the farm twice on a strong computer: once at the tier's detail and once at "the desktop's detail" in the background (`startFine` in `Farmstead.tsx`, and the same for the world in `BarnTable.tsx`). After this change the two builds differ only in the land. Leave that machinery as it is; do not remove it in this plan.
- This is a visible change to models Brian likes, so it is shown as a pair (decision 2). If he prefers the smoothed models, set `CHUNKY = false`; the three calls then smooth as today but with `grain` 0.

**The wendigo test for this change.** The silo and the paddock shed stand partly inside the wedge and are taller than 2.0 m. Unsmoothed, their outlines are up to 0.1 m fuller.
1. Build with `CHUNKY = true` and run the wendigo check (file 05, section 1.6).
2. If it passes, keep it.
3. If it fails, build the silo and the paddock (fence, shed, hay rack) in a second `Builder` passed through `detailedSteps(map, S, 0)` (today's path, with no grain), and everything else chunky. Run the check again; it must pass. Say in the pull request which path was taken.

## 5. Sharp edges

Set `ROUNDED_VOXELS = false` in `src/skin/voxel/rounded.ts`. Nothing else in that file changes; `?voxels=round` still turns the rounding on for a comparison. Record in the file's header comment that the default changed on Brian's decision 3 of this plan, with the date, and that his trial of 2026-11-09 can be restored by setting it back to `true`.

## 6. What does not change in M2

- No object is added, removed, moved or resized.
- The mesher's per-face shade (`FACE_SHADE`) and corner shade (`AO_STEP`) stay.
- `voxelMaterial()` stays a `MeshLambertMaterial` with vertex colours.
- Nothing behind the line z = −16 is repainted: `fieldAndTrees`' stubble and its six field bales keep `tone()` and `snow` exactly; `countryside.ts` and `distance.ts` are not edited in M2 (file 05, section 9 covers the trees in front of the line, in M5).

## 7. The Home repaint, object by object

"Today" is the pushed v0.8.0 code. Cube indices are on each function's own grid. Where the working tree differs, apply the same intent to what is there and note it in the pull request.

### 7.1 `src/skin/scene/farmstead.ts`

Shared paints at the top of the file:

| Paint | Today | New |
|---|---|---|
| `tone(t, seed, w)` | Random tone per cube | Keep the function for behind-the-line callers only. No caller in front of the line may use it |
| `snow` | `snowPaint(F, 3)` | Keep under the name `oldSnow` for the six field bales. New `cap` paint: `paint('snow', 1)` |
| `white` | `tone(T.trim, 5, [0.6, 0.95])` | `paint('trimWhite', 0)` |

**Barn shell (`barnShell`, 0.1 m grid).** No cube changes.

| Part | Today | New |
|---|---|---|
| Wall boards, front wall (three cubes wide, board number `i`) | `pick(T.barn, hash3(i, seed, 7, 41))`, random per board | `solid('barnRed', [0, -1, 0, 1][i % 4])` |
| Seams between boards, and the strips closing the back wall's gaps | `T.barn[2]` | `solid('barnRed', -2)` |
| Top 0.4 m of each wall under the eaves (R7.3) | Same as the board | The board's step minus 1 |
| Foundation course (`y` 0 to 3) | `pick(T.stone, hash3(x >> 1, y >> 1, z >> 1, 51))` | Stones 0.4 m long and 0.2 m high in a running bond: `seededPart('stone', 51, ...)` with part number from `(x + 2 × ((y >> 1) & 1)) >> 2`, `y >> 1` and `z >> 2` |
| Door frames and crosses on the front wall; corner boards; rake boards under the roof; frame of the open doors | `white` | `trimWhite` 0; the rake boards `trimWhite` −1 (they are under the roof's edge) |
| Side door's boards (two cubes wide) | `pick(T.barn, hash3(0, 0, z >> 1, 44))` | `byPart('barnRed', [-1, 0], (_x, _y, z) => z >> 1)` |
| Side windows: frame | `white` | `trimWhite` 0 |
| Side windows: lower panes, upper panes | `#2C3644`, `#39465A` | `glass` 0, `glass` +1 |
| Side windows: sill and its snow | `white`, `snow` | `trimWhite` −1, `snow` +1 |
| Loft door's boards (four cubes wide) | `pick(T.barn, hash3(x >> 2, 3, z, 45))` | `byPart('barnRed', [1, 0], (x) => x >> 2)` |
| Loft door's frame and cross | `white` | `trimWhite` 0 |
| Hoist beam, its hook, its snow | `tone(T.beam, 46)`, `T.stone[2]`, `snow` | `wood` −1, `iron` 0, `snow` +1 |
| Round vent: rim, louvres | `T.trim[0]`, `T.barn[2]` | `trimWhite` 0, `barnRed` −2 |

**Barn roof and cupola (`barnRoof`, 0.2 m grid).** No cube changes at all (its north-east corner is in the wedge, above 2.0 m).

| Part | Today | New |
|---|---|---|
| Shingle courses | `T.shingle[(y + (((z >> 1) + y) & 1)) % 3]` | `solid('slate', [0, -1, 1][sameIndex])` with the same index expression |
| Fascia and soffit | `white` | `trimWhite` −1 |
| Snow blanket | `snow` | `snow` +1 |
| Icicles | `tone(T.ice, 7)` | `ice` +1 |
| Cupola: corners and bands, louvres | `T.trim[0]`, `T.shingle[2]` | `trimWhite` 0, `slate` −1 |
| Cupola roof, its snow | `T.shingle[1]`, `snow` | `slate` 0, `snow` +1 |
| Weathervane | `T.face[1]` | `iron` 0 |

**Silo (`silo`).** No cube changes.

| Part | Today | New |
|---|---|---|
| Staves (alternate by angle index `a`) | `T.trim[1]` / `T.trim[2]` | `trimWhite` −1 / −2 |
| Hoops (every eighth row) | `T.stone[2]` | `stone` −1 |
| Dome | `pick(T.stone, hash3(px, py, pz, 21))` per cube | `stone` 0 |
| Snow cap | `snow` via `capAll(..., 0.95)` | Same cubes, `snow` +1 |
| Ladder | `T.stone[2]` | `iron` +1 |

**Rail fences (`fenceRun`: the paddock, the hens' run, the field fence at z = −15).**

| Part | Today | New |
|---|---|---|
| Posts | `tone(T.beam, 31)` per cube | `wood` −1 |
| Lower rail (`y` 2), upper rail (`y` 4) | Same | `wood` 0, `wood` +1 |
| Snow on rails | `if (hash3(x, y, z, 32) > 0.3) cap` on both rails | `cap` on every cube of the upper rail; none on the lower rail |
| Snow on posts | `cap` | Unchanged |

All of this is below 2.0 m, so it is allowed inside the wedge. After the change run `src/skin/scene/__tests__/zfighting.test.ts`: the season's lights hang along the paddock rails at 1.25 m, and a new cap may now share a face with a bulb. If one does, remove that single cap cube and list it in the pull request.

**Paddock shed and hay rack (`paddock`).** The shed's cubes do not change (in the wedge, above 2.0 m).

| Part | Today | New |
|---|---|---|
| Shed planks (two cubes wide) | `pick(T.barn, hash3(x >> 1, 2, z >> 1, 33))` | Back wall `byPart('barnRed', [0, -1], (x) => x >> 1)`; side walls the same by `z >> 1` |
| Shed corner posts | `tone(T.beam, 34)` | `wood` −1 |
| Shed roof (alternate columns) | `T.shingle[(x & 1) + 1]` | `solid('slate', [0, -1][x & 1])` |
| Shed roof snow | `if (hash3(x, y, z, 35) > 0.1) cap` | Same cubes as today, `snow` +1 |
| Hay rack frame, legs | `tone(T.beam, 36)` | `wood` 0, legs `wood` −1 |
| Hay | `tone(T.hay, 37, [0.4, 0.85])` | `hay` 0 |
| Snow on the hay | `capAll(..., 0.6)` | Whole top except the end column at each end, where the hay shows |

**Coop and hens' run (`coop`).**

| Part | Today | New |
|---|---|---|
| Wall clapboards (alternate rows) | `#E3C27A` / `#D7B368` | `solid('coopYellow', py % 2 ? 1 : 0)` |
| Corner legs, floor frame | `tone(T.beam, 41)`, `tone(T.beam, 42)` | `wood` −1, `wood` 0 |
| Roof | `T.tractor[...]` in a two-by-two checker | Courses along the ridge: `solid('tractorRed', [0, -1][(pz >> 1) & 1])` |
| Roof snow | `if (hash3(px, y, pz, 43) > 0.12) cap` | Whole roof except the lowest row at each eave |
| Pop door, ramp | `T.roof[2]`, `tone(T.beam, 44)` | `darkWood` 0, `wood` 0 |
| Window: frame, lit pane | `T.trim[0]`, `T.lantern[1]` | `trimWhite` 0, `brass` +1 |

**Hens' yard (`henYard`, 0.1 m grid).**

| Part | Today | New |
|---|---|---|
| Straw bed | Two random tones, with random wisps and holes at the rim | A clean ellipse: a cube is straw if `d ≤ 1.0` (same `d` as today). `straw` 0, and `straw` −1 where `d ≤ 0.45` (the trodden middle). No wisps |
| Feed trough: box, trestles | `tone(T.beam, 49)` | `wood` 0, trestles `wood` −1 |
| Grain | Random per cube, `T.lantern[1]` or `T.hay[2]` | `brass` −1 |
| Water pan: base, rim, ice | `T.stone[2]`, `T.stone[1]`, `tone(T.ice, 52)` | `stone` −1, `stone` 0, `ice` 0 |
| Perch: posts, rail | `wood`, `tone(T.trunk, 53)` | `wood` −1, `darkWood` +1 |

**Round bales (`roundBale`).** The function takes a new argument that selects the paint. The six field bales (behind the line) pass the old `twist` and `oldSnow` and come out cube for cube and colour for colour as today. The two bales at (24.6, 3) and (24.8, 5.6) use:

| Part | Today | New |
|---|---|---|
| Body | Random by ring and length | `hay` 0, with two twine bands one cube wide at `pz = −2` and `pz = 2` in `hay` −2 |
| End faces | Same | Rings by distance from the centre: `byPart('hay', [0, -1], ringIndex)` |
| Snow | `capAll(..., 0.9)` | Whole top |

**Orchard trees (`bareTree`).** Not in the wedge.

| Part | Today | New |
|---|---|---|
| Trunk (three lines) | `tone(T.trunk, seed + 50)` | `darkWood` −1 |
| Limbs (depth 2 and 1) | Same | `darkWood` 0 |
| Twigs (depth 0) | Same | `darkWood` +1 |
| Snow | `capAll(..., 0.75)` over the whole tree | `cap` on every limb cube of depth 2 and 1; none on twigs or trunk |

`ORCHARD_TIPS` must come out identical (the season's baubles hang from them): do not change the order or number of random draws in `bareTree`.

**Tractor (`tractor`, 0.1 m grid).**

| Part | Today | New |
|---|---|---|
| Hood | `tone(T.tractor, 61)` | `tractorRed` 0 |
| Body under the seat | Same | `tractorRed` −1 |
| Fenders | Same | `tractorRed` +1 |
| Grille | `T.face[1]` | `iron` 0 |
| Headlights | `T.lantern[0]` | `brass` +1 |
| Tyres and lugs | `tone(T.face, 62)` | `iron` −1 |
| Hubs | `T.lantern[1]` | `brass` 0 |
| Axles, steering column and wheel, exhaust | `T.face[1]` | `iron` +1 |
| Seat | `T.face[1]` | `iron` 0 |
| Snow | `capAll(..., 0.85)` on the hood, `capAll(..., 0.55)` on the fenders | Hood: whole top except the front two columns. Fenders: whole top |

**The land (`terrainSteps`).** One mesh covers ground on both sides of the line. Its cubes do not change. Its paint becomes:
- z < −16: today's `snowAt(x, y, z, 1, 71)`, untouched.
- z ≥ −10: `solid('snow', 0)`.
- Between −16 and −10: the two colours mixed, `t = (z + 16) / 6`, so there is no visible seam along the field fence. This one planned blend is the only gradient in the plan.

If `SOLID_SNOW` is false, the land keeps today's paint everywhere.

### 7.2 `src/skin/scene/yard.ts`

The yard is also seen from the barn table through the open back doors, so these changes show there too (file 05, section 11).

**Ground (`ground`).**

| Part | Today | New |
|---|---|---|
| Open snow | `groundSnow = snowPaint(S, 2)` | `snow` 0 |
| Path | `tone(T.path, 5, [0.5, 0.85])` | `snow` −1 |
| Pond ice | `tone(T.ice, 6, [0.5, 0.85])` | `ice` 0 |
| Skate marks | `SKATE` (`#EEF8FC`) | `ice` +2 |
| Drifts | `snow`, placed by random tests | `snow` +1, placed by section 3.1 |
| Hoof dents, sled tracks | `T.path[2]` | `snow` −2 |

**Yard fence, gate, lantern, mailbox (`fence`).**

| Part | Today | New |
|---|---|---|
| Posts and gate posts | `tone(T.beam, 11, [0.45, 0.85])` | `wood` −1 |
| Rails (`y` 2, `y` 5) | Same | `wood` 0, `wood` +1 |
| "Nails" where a rail meets a post | One 0.2 m cube of `T.stone[2]` per post per rail | Removed as a colour: those cubes take the rail's colour. Real fittings come from file 04 |
| Extra snow lump on some posts | `if (hash3(px, 0, 0, 4) > 0.4) set(..., 8, zf, snow)` | Removed |
| Snow on rails | `if (hash3(x, y, 1, 8) > 0.3) cap` | `cap` on every cube of the upper rail; none on the lower |
| Gate leaf: rails, uprights and brace | `wood` | Rails `wood` 0, uprights and brace `wood` −1 |
| Gate leaf snow | Random | Whole upper rail |
| Gate hinges, latch | 0.2 m cubes of `T.stone[2]`, `T.brass[1]`, `T.brass[2]` | Those cubes take the colour of the wood they sit in; file 04 adds micro hinges and a latch in M3 |
| Gate-post lantern: base and hood, glow | `tone(T.face, 12)`; `T.lantern[1]`, `T.lantern[0]` | `iron` 0; `brass` 0 (lower), `brass` +1 (upper) |
| Mailbox: post, box, door, flag | `wood`, `tone(T.stone, 13)`, `T.stone[2]`, `T.collar[1]` | `wood` −1, `stone` 0, `stone` −1, `scarfRed` 0 |

**Pines (`pine`).** Shape unchanged.

| Part | Today | New |
|---|---|---|
| Trunk | `tone(T.trunk, seed, [0.4, 0.85])` | `darkWood` 0 |
| Bark ridges, bare lower branches | `T.trunk[2]` | `darkWood` −1 |
| Needles | `tone(T.pine, seed + 50, [0.45, 0.85])` | By tier (file 01, section 5): `tierStep = t < 0.34 ? −1 : t < 0.67 ? 0 : 1`, where `t` is the tier's height fraction already computed in the loop; `treeStep = seed % 3 === 0 ? −1 : 0`; colour `solid('pine', tierStep + treeStep)` |
| Snow on branches, leader's tip | `snow` | `snow` +1 |

`pine()` in `yard.ts` is called only for the yard's ten pines. The lobby pen has its own `pine` in `pen.ts` (file 07), and the country's trees are built in `countryside.ts` (file 05, section 9).

**Snowman (`snowman`).** Stays its own mesh with corner shading off, as today.

| Part | Today | New |
|---|---|---|
| Balls | Two random tones per two-cube block | Bottom ball `snow` 0; middle and head `snow` +1 |
| Eyes, buttons | `T.face[2]` | `iron` −1 |
| Nose | `CARROT` | `carrot` 0 |
| Scarf band, tail | Random red per cube | Band `scarfRed` 0, tail `scarfRed` −1 |
| Arms | `tone(T.trunk, 43)` | `darkWood` 0 |

**Small props.**

| Object | Part | Today | New |
|---|---|---|---|
| Sled | Runners | `tone(T.stone, 51)` | `iron` +1 |
| | Boards (three, along z) | `tone(T.collar, 52)` | `byPart('scarfRed', [0, -1, 0], (x) => x - x0)` |
| | Snow | Random on the middle board | Whole middle board from `z0 + 2` to `z0 + len − 2` |
| Woodpile | Posts | `tone(T.beam, 61)` | `wood` −1 |
| | Roof (alternate columns) | Two tones plus random | `solid('roofBrown', [0, -1][a & 1])` |
| | Roof snow | `if (hash3(x, y, z, 63) > 0.15) cap` | Whole roof except its lowest row |
| | Logs | `tone(T.trunk, 64)` per cube | Per log: `darkWood` 0 or −1 by `(row + k) % 2` |
| | Cut ends | Two-by-two checker | `wood` +2, one colour per end |
| Bird feeder | Post, tray | `tone(T.beam, 71)` | `wood` −1, `wood` 0 |
| | Seed | `T.hay[1]`, `T.hay[2]` | `hay` 0 |
| | Roof (two layers) | `tone(T.roof, 72)`, `tone(T.roof, 73)` | `roofBrown` 0, `roofBrown` +1 |
| Trough | Base, sides | `tone(T.beam, 81)` | `wood` −1, `wood` 0 |
| | Ice | `tone(T.ice, 82)` | `ice` 0 |
| Cattails | Stem, head, tip | Random greens, `T.trunk` random | `reed` 0, `darkWood` 0, `reed` +1 |

**Farmhouse (`farmhouse`).**

| Part | Today | New |
|---|---|---|
| Wall clapboards (three cubes high) | A dark line every third row; random tone per four-cube block between | Line row (`y % 3 === 2`): `houseCream` −1. Boards: `solid('houseCream', Math.floor(y / 3) % 2 ? 0 : 1)` |
| Top 0.4 m of the walls under the eaves | Same | One step darker (R7.3) |
| Roof shingles | Seams `T.roof[2]`; rows alternate `T.roof[1]`, `T.roof[0]` | Seams `roofBrown` −1; rows `roofBrown` 0 and +1 |
| Roof snow | Ridge strip, plus random elsewhere | Whole roof except the lowest two rows at each eave |
| Windows: frame and cross | `WINDOW_FRAME` | `trimWhite` 0 |
| Windows: curtains (alternate rows) | `T.collar[0]`, `T.collar[1]` | `scarfRed` 0, `scarfRed` −1 |
| Windows: glow | Five rows shading from light to dark | `brass` +1, one colour |
| Sills | `WINDOW_FRAME` with a cap | `trimWhite` −1 with a whole cap |
| Door boards (alternate columns) | `T.roof[1]`, `T.roof[2]` | `roofBrown` 0, `roofBrown` −1 |
| Door knob | One 0.2 m cube of `T.brass[0]` | Cube removed; file 04 adds a micro knob in M4 |
| Chimney | A light row every third; random between | `stone` 0, light rows `stone` +1, the cap ring `stone` −1 |
| Porch floor (boards three cubes wide) | Seam `T.beam[2]`; random between | Seams `wood` −2; boards `byPart('wood', [0, 1], boardIndex)` |
| Porch rail, balusters | `tone(T.beam, 105)` | Rail `wood` 0, balusters `wood` −1 |
| Porch rail snow | Random | Whole rail |
| Bench | `rail` paint | Seat `wood` 0, legs `wood` −1 |

### 7.3 `src/skin/scene/barn.ts`

Home shows the barn's own walls from outside (its south wall with the open doors is the first thing the tour shows), its door leaves, and its inside through the doors and from tour shot 3. So the barn is repainted in this milestone too, in Home's palette. The part-by-part table is in file 07, section 2. No cube of `barn.ts` changes.

Keep one rule in mind: a wall board must be the same colour on its inner and outer face, and `barnShell` in `farmstead.ts` continues those boards on the front wall. Use the same rhythm (`[0, -1, 0, 1]` by board number) in both files.

## 8. Cubes that M2 may change, and cubes it may not

May change (all below 2.0 m, or outside the wedge):
1. The three smoothing calls of section 4 (subject to the wendigo test there).
2. Snow caps listed as "whole" in section 7.
3. Drift outlines (section 3.1) and the pond's rim.
4. The straw bed's outline in the hens' yard.
5. The removed extra snow lumps on yard fence posts, and the farmhouse's door-knob cube.

May not change:
1. Any cube behind the line z = −16.
2. Any cube above 2.0 m inside the wedge: the barn roof, the silo with its cap and ladder, the paddock shed with its roof.
3. The order and number of random draws in any function whose output something else reads: `bareTree` (`ORCHARD_TIPS`), `pine` (shape), `cattails` (places).
4. Any land cube (`terrainSteps`), any cube in `countryside.ts` or `distance.ts`.

## 9. Tests

- Scenery tests under `src/skin/scene/__tests__/` that count cubes or triangles of the yard or the farm, or that pin a colour, will change. Update the expected numbers in the same commit that causes the change, and write the old and new number in the commit message. Do this only for `yard`, `farmstead`, `scale`, `slices` and `zfighting` expectations that describe the look.
- Never edit `wendigoFence.test.ts`, `homePov.test.ts`'s paddock entries, `tools/scenes/wendigo.pins.json`, or any test outside `src/skin/`.
- `check:floating` must still pass: turning smoothing off must not leave anything in the air. If it reports a floating piece, fix the model (add the joining cube), not the check.
