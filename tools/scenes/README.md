# The scene checker

One command that builds every scene and model of the painted game, the way the game builds them, at both detail
levels, and judges them in stages. It is plan file 18, section 4.2 (`docs/visual-overhaul/18-asset-integrity.md`), and
file 16, section 4.1 (i). Nothing here ships to players.

```
npm run check:scenes                           # every stage
npm run check:floating                         # the connect stage alone: what floats, and where
npm run check:scenes -- --only connect,place   # some stages
npm run check:scenes -- --scene pen            # some scenes (a bare name works too: npm run check:floating -- pen)
npm run check:scenes -- --details coarse       # one detail level
npm run check:scenes -- --json out.json        # everything, for a machine
npm run check:floating -- --detail=pine        # every loose piece from code that matches, with its box and its gap
```

`check:scenes` is `vite-node tools/scenes/check.ts --`; `check:floating` is the same with `--only connect`. The gate
runs it as its `scenes` module (`tools/gate/scenes.mjs`), and CI's `check-scenes` job runs `npm run check:scenes`.

| File | What it is |
|---|---|
| `check.ts` | The command: reads the flags, builds the world once, runs the stages in order, compares the numbers, prints the verdict. |
| `build.ts` | The world: every scene and model, caught from the mesher and laid where the game draws it. The types every stage uses. |
| `connect.ts` | Stage 1: nothing floats. |
| `<id>.ts` | A stage: `place`, `lights`, `coplanar`, `lens`, `models`, `wendigo`, `baked`. |

## The stages

They run in this order: `connect`, `place`, `lights`, `coplanar`, `lens`, `models`, `wendigo`, `baked` (`STAGE_IDS` in
`build.ts`). A stage is one file, `tools/scenes/<id>.ts`. **A stage whose file does not exist is `NOT BUILT`, and the
run fails.** Nothing that was not checked ever reads as green. `--only` runs a part, says `PART RUN`, and passes or
fails on what ran.

| What you see | What it means | Fails the run? |
|---|---|---|
| `PASS` | The stage ran clean and every number it handed in held against the stored one. | No |
| `FAIL` | It returned `ok: false`, threw, did not follow the interface, or a stored number rose. | Yes |
| `NOT STORED` | It ran clean, and a number it handed in has no stored value yet. | Yes |
| `NOT BUILT` | Its file does not exist. | Yes |
| `NOT RUN` | It could not do its work (a summary that starts `NOT RUN:`), or the scenes could not be built. | Yes |

Exit code: 0 everything that ran passed and every ratchet held; 1 anything else; 64 the command line was wrong.

## The interface

```ts
// tools/scenes/<id>.ts
import type { StageOptions, StageResult, World } from './build';

export const id = 'place';                                  // the file's name
export const needs = { scenes: 'all', models: false };      // optional: what it reads (below)
export function run(world: World, options: StageOptions): StageResult | Promise<StageResult> { ... }
```

`options`:

| Field | What it is |
|---|---|
| `root` | The repo, an absolute path. |
| `scenes`, `details` | What this run is about: all seven scenes and both levels, unless `--scene` or `--details` said less. Judge only these. |
| `exempt` | The entries of `docs/visual-overhaul/EXEMPT.json` whose `check` is this stage's id. |
| `stored` | This stage's stored numbers (`scenes.<id>` in `RATCHETS.json`), or `undefined`. For a message; the comparing is `check.ts`'s. |
| `flags` | Every flag `check.ts` does not know itself: `--show=pine` is `{ show: 'pine' }`, `--all` is `{ all: true }`. A stage may have flags of its own without touching `check.ts`. |
| `cache` | A directory the stage may write into (`<gate cache>/scenes/<id>/`). Never write into the repo: the gate fails a run that leaves anything there. |
| `log(line)` | Prints a line while the stage runs. |

The result:

| Field | What it is |
|---|---|
| `ok` | False **only** for what no stored number can allow: the stage could not do its work, or it found something that must never be. A known failure does not make it false (below). |
| `summary` | One line. It starts `NOT RUN:` when the stage could not do its work. |
| `lines` | The report, as lines. `check.ts` prints them as they are. |
| `measured` | Numbers that may only fall, an object of any depth. |
| `failures` | Every failure, by name: `{ scene, detail, what, where, source }`, and `excusedBy` when an exemption covers it. |
| `data` | Anything else, for the JSON. No times, no absolute paths (the gate's report must be the same from run to run). |

`needs` keeps a run of one stage from building what it never reads: `scenes` is `'all'` (the default), `'none'`, or a
list of names; `models: false` leaves the models unbuilt. Leave `needs` out and everything is built.

### How known failures are counted and named

The plan knows that today's code fails some checks (the pen's loose pieces, animals inside the wheelbarrow, coplanar
faces, missing tails), and no pull request could merge before milestone 3 if those made the run red. So:

1. **Every failure is one entry of `failures`**, named so a person can find it: the scene, the detail level, what is
   wrong, where in metres, and the code that built it (a part's `mount` and `label`).
2. **Every failure is counted in `measured`.** The stored number is a ratchet: it may fall and never rise. A new failure
   raises a count, and the run fails with `ROSE`. A fix lowers one, the run says `can be lowered`, and the stored
   number is lowered by hand in the pull request that earned it.
3. **`ok` stays true.** The stored number decides whether a count may stand, not the stage. A stage that set `ok: false`
   for a known failure would be red on today's code for ever.
4. **Hand in the zeros too**, and the same leaves every run (one for each scene and detail level, say). A number that is
   always there cannot be stored later by a careless `--seed`: if `pen.fine` is stored as 0, a first loose piece is
   `ROSE`. If the leaf only appeared with the first failure it would be `NO STORED VALUE`, which `--seed` cures.
5. **Only `EXEMPT.json` excuses anything.** A stage never skips a failure because it looks harmless. An excused failure
   is still listed (with `excusedBy`) and still counted, as excused: that count is a ratchet too, so an entry can never
   come to cover something new.

`measured` may not hold an object whose only key is `min` (that shape is how a stored floor is written), and a key may
be any string (`'fence:rail'` is fine).

### The numbers, and who stores them

`check.ts` hands in `{ exemptions: <entries in EXEMPT.json>, <id>: <that stage's measured>, ... }` and compares it with
the `scenes` section of `docs/visual-overhaul/RATCHETS.json` using the gate's own comparison
(`tools/gate/lib/ratchets.mjs`, imported, not copied). So `npm run check:scenes` alone passes or fails the way
`npm run gate` would.

- With nothing stored it prints every number, says they are not stored, and fails. Only the gate stores:
  `npm run gate -- --milestone none --only scenes --seed`, once, and `RATCHETS.json` is committed.
- The gate's module takes the stages' verdict without the ratchets, because the gate's runner judges those itself
  (it must be able to store them the first time). The comparison is the same code on the same numbers.
- A part run is held only to what it measured: `--only connect` is compared with `scenes.connect` and
  `scenes.exemptions`; with `--scene` or `--details`, a stored number the run did not measure is left out.

### Adding a stage

1. Write `tools/scenes/<id>.ts` to the interface above. The id is already in `STAGE_IDS`, in its place in the order.
2. Read the world (below). Import nothing from `src/` that *builds* anything: ask the world for it (`world.load`,
   `world.capture`). A stage's own import of a builder is another copy of the module, with its own kept models,
   built at whatever the pointer answers at that moment. Constants and pure functions (camera shots, layout numbers)
   are safe to import.
3. Count and name what you find (above). Use `options.exempt` for nothing but excusing.
4. Run it alone, `npm run check:scenes -- --only <id>`, then with the others. Break something in a plain copy of the
   tree (never in the repo) and see the number rise.
5. `tools/scenes/` is not in `tsconfig.json`'s `include`, so `npx tsc --noEmit` does not read it. To type-check a
   stage, give `tsc` the repo's options by hand: `npx tsc --ignoreConfig --noEmit --strict --target ES2022
   --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution bundler --jsx react-jsx --skipLibCheck
   --allowImportingTsExtensions --types vite/client,node tools/scenes/<id>.ts`.

## The world

`buildWorld()` in `build.ts` builds everything once; `check.ts` hands the same `World` to every stage.

```ts
world.details                       // ['fine', 'coarse'], or what --details asked for
world.scenes                        // every scene built, at every level built
world.scene('pen', 'coarse')        // one; throws if this run did not build it
world.models, world.model('animal:pig')
await world.load('src/skin/scene/layout.ts')            // a game file, from the graph the fine world was built in
await world.capture('ice:big', 'prop', async (load) =>
  (await load<typeof import('../../src/skin/voxel/sheep')>('src/skin/voxel/sheep.ts')).iceBlock([1.3, 1.4, 1.5]))   // a Model
```

### Fine and coarse

A touch device builds coarser geometry: `coarse()` in `src/skin/voxel/refine.ts` reads
`matchMedia('(pointer: coarse)')`, which is false under Node. So every scene is built twice:

- **fine**: what a computer builds. `globalThis.matchMedia` is not set.
- **coarse**: what a touch device builds. `globalThis.matchMedia` answers true for `(pointer: coarse)`, set before that
  graph imports anything and for as long as it builds.

One process builds both, but **not one module graph**: the pen, the duel, the countryside, the season and the bedroom
keep what they built, so a graph asked for the pen a second time hands back the first (measured: the mesher is called 8
times for the coarse pen and 0 times more for the fine one). `build.ts` therefore makes its own vite-node server and
one runner for each level; three.js is shared between them. Measured on 2026-11-16: every scene's hash from the
two-level process equals the hash from a process that built that level alone (14 of 14), and fine and coarse differ in
five scenes of seven:

| Scene | Fine voxels | Coarse voxels | |
|---|---|---|---|
| table | 564,216 | 288,919 | |
| farm | 1,807,627 | 906,397 | |
| duel | 440,451 | 86,906 | |
| pen | 221,157 | 95,010 | |
| bedroom | 45,475 | 45,475 | the same: it never reads the pointer |
| dream | 237,628 | 186,464 | it never reads the pointer either: see below |
| podium | 36,096 | 36,096 | the same |

The dream's other build is for a narrow screen (`phone` in `DreamStage.tsx`: its own sea and island boxes), not for a
touch pointer. The coarse level builds that one, so both of the dream's builds are checked; a tablet (touch, wide) and
a narrow computer window draw the other level's dream.

The models are built once, at the fine level: no model's builder calls `detailed` (only `scene/yard.ts`,
`distance.ts`, `farmstead.ts`, `duel.ts` and `pen.ts` do).

### A scene

```ts
interface Scene { name; detail; parts: Part[]; world: Part[]; things: Thing[]; voxels; hash; notes: string[] }
```

| Scene | Built as | Notes |
|---|---|---|
| `table` | `Farm` in `table/BarnTable.tsx` (barn, yard, distance, season), the table's platform, the letter board | The wool pile changes with the game and is not laid out. |
| `farm` | Home: the same farm, and what `table/Farmstead.tsx` adds (the range turned round, the farmstead, the season, the countryside) | In the order the page builds them. The wendigo is not voxels. |
| `duel` | `table/DuelTable.tsx`: the ice, the water at its height, the shore, the season, the letter board | |
| `pen` | `rooms/PenStage.tsx` | Every mesh is drawn where it was built. |
| `bedroom` | `dream/BedroomBubble.tsx`, asleep | The clock, the quilt and the farmer are things. |
| `dream` | `dream/DreamStage.tsx` before the first key (nothing has scrolled) | Every mesh is moved by its group every frame, so everything is a thing. |
| `podium` | `table/Podium.tsx` with a full table of ten | Its layout numbers are not exported: they are copied and pinned. |

`scene.notes` says what was built and not laid out, and why. Animals, the bomb, the dream's fences and signs are not
scenery: they are models.

### A part

One voxel set where the game draws it: what one call of the mesher was given, on one mesh.

| Field | What it is |
|---|---|
| `label` | The code that built it, as `tools/floatingVoxels.ts` wrote it: `ground scene/pen.ts:107 < make scene/pen.ts:64`. For a person; the line numbers move. |
| `mount` | What the game calls the geometry: `pen.ground`, `barn.doorLeaves[0]`; in a model, where it is in what the builder returned (`wools.2`, `legs[0]`). Stable: use it for keys and exemptions. |
| `mesh` | Parts merged into one geometry share this number (one draw). |
| `body` | `'world'`, or the name of the thing it is part of. **This is how a stage tells them apart** (below). |
| `size`, `count` | The cell size in metres; how many voxels. |
| `cells` | `Int32Array`: x, y, z of each voxel in whole cells. |
| `colors` | `Float32Array`: linear red, green, blue of each voxel, 0 to 1. |
| `offset` | Where the builder moved the geometry after meshing it (`.translate`), metres. |
| `local`, `turns`, `scale` | Where its mesh sits in its body's frame: quarter turns about y, one scale, then a move in metres. |
| `aligned` | False when it is turned off the axes inside its body, so it has no boxes. (No part is, today.) |
| `set` | The number of the mesher call it came from. A set drawn twice (one hay bale, twelve times) is two parts sharing their arrays. |

A voxel's place in its body's frame is `turn((cell * size + offset) * scale) + local`. Do not work it out by hand:

```ts
import { atRest, boxes, restBoxes, thingOf } from './build';

boxes(part)              // Float64Array, six numbers a voxel (x0, y0, z0, x1, y1, z1), in its BODY's frame; null if not aligned
restBoxes(part, thing)   // the same in WORLD metres, where the game draws it at rest; null if its thing rests turned off the axes
thingOf(scene, part)     // its thing, or null for a part of the world
atRest(scene)            // { laid: [{ part, thing, boxes }], turned }: the whole scene in world metres
atRest(scene, { things: false })   // the static world alone: what a ray cast down to find the floor wants
```

Boxes are made on first use and kept (48 bytes a voxel: about 90 MB for the fine farm).

### World or thing: how a stage tells them apart

**`part.body === 'world'`**: the game draws this part with a transform that never changes and keeps its voxels on the
world's axes: none at all, a move (the duel's water at its height, the podium's wall), a quarter or half turn about y
(the mountain range turned round behind the barn), one scale. `boxes(part)` are world metres. Everything a ray, a lens
or a neighbour can meet in the static scene is here.

**Anything else is a thing**, and `part.body` is its name. A thing is what a mesh transform sets down or moves: a
group something moves every frame (`thing.moves` says what, in words: the cat breathes, the raft scrolls), or a mesh
set down turned off the axes (a door leaf standing open at 1.75 radians, a hay bale turned 0.05). `scene.things` lists
them:

```ts
interface Thing { name; at: { position, rotation, scale }; moves: string | null; aligned: boolean; parts: Part[] }
```

`at` is where the thing rests (rotation as three.js Euler angles in the order `'YXZ'`, so a turn about y alone reads
`[0, turn, 0]`). Its parts are laid out in its own frame. `aligned` is true when it rests on the world's axes, and
then `restBoxes` can put it in the world.

Today's things: the two door leaves, the cat (body and tail), the robin, the windmill's blades, the letter board (table
and duel); the clock (with its ring lines), the quilt and the farmer (bedroom); the raft, the cloud sea, three islands,
the island windmill's blades, two wisps, the hills and the mountains (dream); eight of the podium's twelve bales (the
four that are not turned are world).

Who judges what:

- **connect** judges the world (every piece joins the ground piece) and asks of each thing only whether it is whole.
  It never asks whether a thing touches the world.
- **place** judges where things stand: the gap under them, what they stand inside. A thing that no `PLACED` entry
  covers is judged by nobody, so the place stage should fail for any `scene.things` name it has no entry for.

### A model

```ts
interface Model { id; kind; parts: Part[]; built: unknown; partsOf(geometry): Part[]; hash; notes: string[] }
```

`built` is what the game's builder returned (an `AnimalModel`, a `BombLook`, a `Grid`), from the graph the world was
built in. `parts` are every geometry and `Grid` in it, named by where they were found (`mount`), in the model's own
frame: an animal's part is built about its pivot and put back at it, so `boxes(part)` is model space at rest.
`partsOf(model.built.head.geo)` finds the parts drawn from one geometry. `notes` names what a builder meshed and did
not hand back (the goat's fringe).

| Ids | Kind | Built by |
|---|---|---|
| `animal:sheep`, `:pig`, `:cow`, `:goat`, `:horse`, `:chicken` | `animal` | `animalModel(species)`: every coat level is in it (`wools.1` to `wools.4`, `sheared`) |
| `bomb:bomb-ice` and the seven other skins of the shop catalogue | `bomb` | `bombLook(id)`: `body`, `glow`, `fuse`, `spark`, `chunk`, and `ground`, its floor mark |
| `burst:blast-hay` and the other bursts | `burst` | `propGrid(shape, palette)`; Frost and Northern Lights have no prop and no parts |
| `tick:tick-chime` and the other fuse sounds | `tick` | `soundGrid(id)` |
| `sack:bomb`, `sack:blast`, `sack:tick` | `sack` | `sackGrid(sack)` |
| `sheepdog`, `trophy`, `hat`, `ice` | `prop` | `sheepdogModel()`, `trophyGeometry()`, `santaHat()`, `iceBlock(BLOCK)` with the size written in `Sheep.tsx` |
| `bomb`, `fence:rail`, `fence:picket`, `fence:wall`, `fence:log`, `bale`, `sign post` | `prop` | The old tool's own `--props` |

A model is laid out as its builder returned it. How the game then assembles it (the fuse on the neck, the hat on the
head, the pose) is the models stage's to work out, from `built` and the component. For anything not in the list:
`world.capture(id, kind, build)` builds it and catches its voxels the same way.

## How the layout is kept honest

The hook in `src/skin/voxel/mesher.ts` hands over voxels before there is a geometry, and where a geometry is drawn is
written in JSX, which cannot be imported. Three things keep `build.ts` from telling a stage something that is not so:

1. **Which geometry came of which voxels is followed, not guessed.** `build.ts` wraps four methods of three.js's
   `BufferGeometry` in the tool's own process (`tap`): the mesher's last step binds the voxels to the geometry,
   `.translate()` is added to the part's `offset`, `.clone()` carries it over, and `dropFaces` (which makes a new
   geometry) passes it on. A merged geometry is matched to what it was merged from, position by position.
2. **Every scene's list is pinned to its component** (`mirrors`). Each list in `build.ts` copies the JSX lines that
   mount the meshes; the lines are checked against the file at every run. A line that is gone or changed stops the
   build: `tools/scenes/build.ts copies where src/skin/rooms/PenStage.tsx draws its meshes, and this line of it is gone
   or changed`. Read the component, bring the list up to date, and pin the new line.
3. **A voxel set nobody places stops the build**: `tools/scenes/build.ts does not say where the game draws 1 voxel set
   it built`. Add it to its scene's list (`Layout.put`, `Layout.thing`), or set it aside with a reason
   (`Layout.skip`), which goes into `scene.notes`.

When the build stops, every stage is `NOT RUN` and the run fails. That is on purpose: a layout that may be wrong
judges nothing.

Known limits, all in `scene.notes` or here:

- Under Node there is no display face: the letter board, the dream's signs and the podium's numbers are cut in the
  5 x 7 fallback letters, not the letters players see.
- The podium's hayloft beam, lanterns and lights are three.js boxes, not voxels, and are not laid out. Nor is the
  wendigo.
- The dream is laid out at the moment before the first key. Its fences and signs come and go and are models.
- The podium is built for ten places; the letter board shows an A.

## The exemption file

`docs/visual-overhaul/EXEMPT.json` (plan file 18, section 4.6) is the only place a check may be excused.

```json
{
  "about": ["..."],
  "exemptions": [
    { "check": "connect", "scene": "table", "match": "buildDistance", "reason": "...",
      "status": "pending", "brian": { "date": null, "words": null } }
  ]
}
```

- `check` is a stage id, `scene` one scene's name. An entry covers one scene: the same thing in two scenes is two
  entries.
- `match` is text that must be in the failure's `source` as the report prints it: for a part,
  `<mount>: <label>`; for a piece inside a thing, `thing "<name>": <mount>: <label>`. A stage with other things to
  excuse (a `PLACED` id) says in its own header what it matches against.
- `brian` holds his dated words: `{ "date": "2026-11-20", "words": "..." }`.
- `"status": "pending"` marks an entry he has not answered: date and words are `null`. The two there now are the old
  tool's two exemptions, moved in milestone 0. **No pending entry may be added later.** `check.ts` refuses an entry
  with no words that is not marked pending, a pending one that has words, and any field it does not know.
- The number of entries is handed in as `scenes.exemptions` and may only fall. What each entry excuses is counted too
  (`scenes.connect.excused`), so a broad match cannot swallow a new piece.

## Stage 1: connect

The old tool's method (`tools/floatingVoxels.ts`, still there to read): every voxel is a box in metres, two boxes
touch when they share a face or an edge (they overlap on at least one axis and meet or overlap on the others; a shared
corner is not touching), touching boxes are joined, and what is left apart is a piece. `pieces(parts)` in
`connect.ts` is exported for any stage that needs it.

What changed from the old tool:

| | Old tool | Connect |
|---|---|---|
| A piece with its foot at y <= 0 | Passed, ground under it or not | No pass: a piece is grounded only if it joins the ground piece (the one with the most voxels) |
| Where a voxel set lies | Where it was built. A set built round its own origin (the cat, a door leaf, the clock) lay in the middle of the barn floor and joined it by accident. A geometry the builder moved (`.translate`) lay unmoved. | Where the game draws it |
| Scenes | table, farm, duel, bedroom | And pen, dream, podium |
| The farm | Built after the table in one process, and `buildFestive` keeps what it built: the mesher was not called again, so the farm was judged without the barn's and the yard's decorations (15,388 voxels) | Every scene holds everything the game draws in it |
| The fences | `lookOf('fence', index)` deals the looks in another order: its `fence:wall` was the log and its `fence:log` the wall | Each fence by its own look |
| Detail | What a computer builds | And what a touch device builds |
| Excused | Everything from `buildDistance`; every bedroom part not on the `room:` line | The two pending entries of `EXEMPT.json`, each one scene and one match |
| When something floats | Exit 1 | The count is a ratchet: exit 1 when it rises or is not stored |

It judges three kinds of body:

- **A scene's world**: every piece must join the ground piece. A piece that does not is loose
  (`measured.loose.<scene>.<detail>`).
- **Each thing, alone**: it must be one piece. Its other pieces are loose inside it
  (`measured.things.<scene>.<detail>`). Where the thing stands is the place stage's.
- **The old tool's eight props, each alone** (`measured.props.<name>`): one piece. There is no floor under a model,
  so the second of two round bales and the ice bomb's four frost specks are counted; whether each lies on the floor
  where the game puts it is for the place and models stages.

`measured.excused.<scene>.<detail>` counts what `EXEMPT.json` excuses.

Each line of its report is one source of loose pieces: how many, how many voxels, what the game calls it and the code
that built it, where four of them are, and how far they hang over what is under them (`gap below 0.05 m`,
`nothing under`). The chunks of one builder (`countryside.scrub[36]`, `[39]`...) are one line, `countryside.scrub[*]`.
`--detail=<text>` (or `--show=<text>`) lists every piece of the lines that match, with its box. The last line says how
many pieces float in all; it says `Nothing floats.` only when none does and none is excused.

### What it finds today (2026-11-16, base 6edc7fe)

Loose pieces, fine / coarse. Every one is in the report by name.

| Scene | World | Inside things | Excused | What they are |
|---|---|---|---|---|
| table | 0 / 0 | 0 / 0 | 2 / 2 | Excused, pending: the low hills behind the barn and the mountain range (`buildDistance`). |
| farm | 1,321 / 1,321 | 0 / 0 | 0 / 0 | 1,319 pieces that stand 0.05 m over the land: `terrain` in `scene/farmstead.ts` moves the land down 0.05 m after meshing it ("just under the yard's snow, so the two never share a plane"), and everything standing on it outside the yard was built to y = 0 (955 from `farmstead.props`, 345 from `countryside.scrub`, 15 from `farmstead.fine`, 3 drifts, 1 forest chunk). And the mountain range twice (once turned round): the pending entry names the table, one scene. |
| duel | 0 / 0 | 0 / 0 | 0 / 0 | One piece, with the water at its real height. |
| pen | 74 / 73 | 0 / 0 | 0 / 0 | The plan's 74: 48 from `nature`, 24 from `trees` (8 near pines, 16 on the ridge), the lantern glass 1.60 m under its bracket (fine only), the mountains slab. |
| bedroom | 1 / 1 | 1 / 1 | 7 / 7 | The night view behind the window stands apart from the room. One voxel of the farmer's sleeping head touches nothing. Excused, pending (the clock): its face one cell off its drum, its two feet, the four ring lines. |
| dream | 0 / 0 | 0 / 1 | 0 / 0 | The narrow screen's cloud sea is in two banks. The raft and every island are whole. |
| podium | 3 / 3 | 0 / 0 | 0 / 0 | The carved boards of places 1, 2 and 4 hang 5 mm in front of their blocks (`front + 0.005`) and touch nothing; the other seven happen to rest on a tuft of straw. |

Props: `bale` 1 (the second round bale), `bomb` 4 (frost specks on the floor), the other six 0.

## How long it takes

Measured on this machine (10 cores, 16 GB, other work running), 2026-11-16:

| | Time |
|---|---|
| Building the world: 14 scene builds and 46 models | 17 to 21 s, about 1 GB of memory |
| The connect stage over all of it | 8 to 14 s |
| `npm run check:floating`, start to end | 24 to 35 s over six runs, and 74 s once while other work loaded the machine (the old tool: 23 s for four scenes at one level) |
| `npm run check:floating -- pen` | 3 to 8 s |

The plan allows `check:scenes` about 5 minutes of CI in all.
