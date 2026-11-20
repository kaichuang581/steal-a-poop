# 07. The other scenes: the barn table, the podium, the ice, the pen, the dream, the bedroom

Milestone M7, **except the barn (section 2), which is repainted in M2** together with the rest of Home, because Home shows the same barn from outside and from inside. Brian likes these scenes as they are, so the changes here are the smallest ones that keep the whole game one set: the speckle goes, the light stays, no shape changes.

## 1. Two treatments

| Treatment | What it does | Used for |
|---|---|---|
| **A. Home's palette** | Parts take file 01's ladders through `solid()`, with value steps | The barn (it is the same building Home shows from outside) |
| **B. Same average, no speckle** | Each random three-tone pick is replaced by its own average colour, `meanTone(tone, weights)` from `paint.ts`, which keeps today's desaturation. The scene's overall colour and brightness stay exactly as they are; only the per-cube variation disappears. Parts that need a value step use the tone's own lighter or darker entry | The night scenes and the small scenes: the ice duel, the lobby pen, the dream, the bedroom, the leaderboard stage |

For both treatments:
- **No cube is added, removed or moved** in any of these scenes. No smoothing call changes, except that `grain` becomes 0 (sections 4 and 5).
- **No light, fog, exposure, tone mapping or camera changes** in any of these scenes. Each keeps its own canvas settings.
- No micro objects are added. The micro layer is Home's.
- The global switch `ROUNDED_VOXELS = false` (file 03, section 5) already applies here. If Brian keeps rounded edges for the table from the pair, that needs a per-scene switch; ask first.
- Animals, worn items and the season's decorations in these scenes follow file 06.

## 2. The barn table (`src/skin/scene/barn.ts`, drawn by `src/skin/table/BarnTable.tsx`): built in M2

Treatment A. The table is the game's main view: seven sheep in a ring on a hay floor, the wool pile in the middle, the open back doors behind.

| Part | Today | New |
|---|---|---|
| Wall boards (back wall two cubes wide, side walls three) | One random tone per board: `pick(T.barn, hash3(b, seed, 7, 41))` | `solid('barnRed', [0, -1, 0, 1][b % 4])`, the same rhythm as the outside (file 03, section 7.1), so a board is the same red on both faces |
| Seams, knots, "nails" | `T.barn[2]`, `T.beam[2]`, `T.stone[2]` | Seams `barnRed` −2. Knots and nails take the colour of the board they sit in |
| Rails behind the back wall's gaps | `pick(T.beam, hash3(x, y, z, 9))` per cube | `wood` −1 |
| The inside of the front wall (`frontInside`) | Random tone per board | Same rhythm as the walls |
| Beams (`beams`): posts, plates, the cross beam, pegs | `tone(T.beam, 21)` per cube; pegs `T.beam[0]` | Posts `wood` −1; plates `wood` 0; the cross beam `wood` +1; pegs `wood` +2 |
| Roof boards seen from below | `tone(T.roof, 23)` | `byPart('roofBrown', [0, -1], boardIndex)` |
| The rope on the beam | `pick(T.hay, ...)` | `straw` −2 |
| Hay bales (`bale`) | `pick(T.hay, h)` per cube, twine `T.beam[2]` | Body `hay` 0; the two end faces `hay` −1; twine bands `hay` −2 where they are today. Loose bales that are one random tone each today: `seededPart('hay', seed, baleIndex)` |
| Props (`props`): pitchfork, pail, barrel, sack, horseshoes and the rest | `tone(T.stone, 31)`, `tone(T.beam, 33)`, `pick(T.beam, hash3(...))`, `tone(T.house, 39)` | Metal `stone` 0 with handles `iron` 0; wooden handles `wood` +1; barrel staves `wood` 0 with its rim `wood` −1; sack `straw` −1 with its patch `wood` +2 |
| Floor planks | One random tone per plank | `seededPart('wood', 51, plankIndex)` with the same plank index as today |
| Hay on the floor | Random tones in four-cube and eight-cube patches; trampled ring darker; scattered tufts | Open hay `straw` 0. The trampled ring round the seats `straw` −1. The bare circle under the pile's platform shows the planks. Tufts and the loose straws keep their places (each is a whole part) and become `straw` +1. The places that have no hay cube today (about 8% of the floor) stay bare, so the planks still show through there |
| Snow blown in at the back doors | `pick(T.snow, hash3(x >> 2, y >> 2, z >> 2, 55))` | `snow` 0; the pressed track `snow` −2 as today's `T.path[2]` |
| Lanterns (`lanterns`) | Wire `T.hoof[0]`, glass glowing | Wire and frame `iron` 0. Glass and glow **unchanged** |
| Door leaves (`leaf`) | Random tone per board; brace `tone(T.beam, 61)`; iron `T.stone[2]`; white frame and cross `T.trim[0]`; snow `tone(T.snow, 63)` | Boards by the walls' rhythm; brace `wood` −1; iron `iron` 0; frame and cross `trimWhite` 0; snow `snow` +1 |
| The wolf's tarp (`tarp`) | Random greys with fold lines | `stone` 0; fold lines `stone` −1; the fold's shadow line `darkWood` 0 where it is `T.beam[2]` today |
| The cat | Random grey fur with stripes | Fur `stone` 0; stripes `stone` −2, placed by today's rule without its random test (every third column); ears, eyes and nose as today through `shade()` |
| The robin | Back `tone(T.beam, 91)`; breast `#D9653B` | Back `wood` −1; breast `shade('#D9653B', 0)` |
| The wool pile, its platform, the letter board (`src/skin/voxel/table.ts`) | Mostly solid; two random picks | Solid per part, colours through `shade()` |

**The floor needs care.** It is the largest surface of the main view, and its hay hides the grid of planks on purpose. If the solid floor looks flat or tiled in the pair, do not add texture. Use two planned zones only (open hay, trampled ring) and stop to show Brian.

**The pair.** Photograph the table before and after from the game's own camera with seven players seated, by day and at night, and the same from a phone's size. This pair is shown to Brian before M2 is merged (decision 7). If he prefers the table's colours as they were, switch the barn to treatment B (same average, no speckle) and keep only the door leaves, which Home sees from outside, in treatment A.

## 3. The podium (`src/skin/table/Podium.tsx`)

The podium builds its own small set in the component (a `Grid`, `hash3`, the letter mask, the trophy). Treatment B for its set; animals and the trophy by file 06. Its canvas keeps ACES tone mapping and its own lights.

## 4. The ice duel (`src/skin/scene/duel.ts`, drawn by `src/skin/table/DuelTable.tsx`)

A night scene on a frozen lake. Treatment B. It has ten calls to `pick()`.

| Part | New |
|---|---|
| The snow spit the two sheep stand on (`spit`) | `meanTone(T.snow, w)` with the weights it uses today; its edge row one entry darker (`T.snow[2]` through `lin`) |
| Water (`water`) | Its colour today, one solid |
| Ice floes (`floes`), 22 | One colour per floe: the mean of today's pick. Floes may differ from each other by using `T.ice[0]`, `[1]` or `[2]` chosen per floe by seed |
| The crack under the letter (`crackAt`) | Unchanged |
| Shore (`shore`) and its 22 pines (`pines`) | Shore: mean of today's pick. Pines: trunk one colour; needles by tier using `T.pine[2]`, `[1]`, `[0]` from the lowest third to the top third; snow the mean of today's snow pick |
| Lamps and the signpost (`lamps`) | Posts one colour; lamp glass and glow **unchanged** |
| Smoothing | `detailed(g.map, g.size)` becomes `detailed(g.map, g.size, 0)`: the same cubes, no brightness grain |

## 5. The lobby pen (`src/skin/scene/pen.ts`, drawn by `src/skin/rooms/PenStage.tsx`)

A night scene: a fenced pen in a meadow, with drifts, pines, boulders, a mountain wall, two lanterns. Treatment B. It has twenty calls to `pick()` and two smoothing calls.

| Part | New |
|---|---|
| Ground and its twenty drifts (`ground`) | Ground: mean of today's pick. Drifts: `T.snow[0]` through `lin`, one colour |
| Land beyond (`land`) and the mountain wall (`mountains`) | Mean of today's pick per layer |
| Pines, 9 near and 64 far (`pine`, `trees`) | As the duel's pines |
| Boulders, bushes (`nature`) | One colour per boulder and per bush, chosen per object by seed from the tone's three entries |
| Grass tufts, 90 (`nature`) and the pen's ten grass spots (`PEN.grass`) | One colour per tuft |
| Fence, gate, hay rack, water trough (`fence`) | Posts `T.beam[2]`, lower rail `T.beam[1]`, top rail `T.beam[0]` (all through `lin`); snow on the rails as today, one colour; hay one colour; ice one colour |
| The lantern post and the gate lantern | Iron one colour; glass and glow **unchanged** |
| Smoothing | Both `detailed(g.map, g.size)` calls get `grain` 0 |

`pen.ts` has its own `pine` function, separate from the yard's.

## 6. The dream and the bedroom (`src/skin/dream/world.ts`, `stage.ts`, `bedroom.ts`)

The once-a-day runner over clouds, and the farmer's bedroom in a bubble. These are already close to the target: the clouds use planned tones (`ISLAND_TONES`, with the third tone "only in the creases"). Treatment B.

1. `world.ts` has one call to `pick()` and fifteen to `hash3()`. Replace the pick by its mean. Check each `hash3`: one that places or sizes a whole thing stays; one that tints single cubes becomes a fixed colour.
2. `bedroom.ts`: the same check. Wood, linen and quilt each one colour per part; the candle's flame and glow unchanged.
3. Nothing about the runner's side-on mapping, hit boxes, speeds or layout changes (`stage.ts` constants).
4. Run `npm run dream:gate` once at the end of M7. It must pass.

## 7. The leaderboard stage (`src/skin/boards/BoardStage.tsx`)

It shows animals, a trophy and cloud props against a sky. Its models follow file 06. Its own fog (`#D3E6F4`, 0.009) and light do not change.

## 8. M7's own inventory

The list is committed as `docs/miniature/other-scenes.md`. Its `barn.ts` part is written in M2, the rest at the start of M7. For each of `barn.ts`, `duel.ts`, `pen.ts`, `world.ts`, `bedroom.ts`, `Podium.tsx`, `table.ts`, `props.ts`: every line that calls `pick(`, `tone(` or `hash3(`, what it colours or places, and which of these it becomes:

| Verdict | Meaning |
|---|---|
| Solid | One colour for the part (treatment A or B as the scene says) |
| Step | One colour, a step away from its neighbour |
| Keep | It places, sizes or counts whole parts; it does not tint single cubes |
| Glow | A light or a lit surface; untouched |

No line may be left without a verdict. The pull request carries the finished list.

## 9. Acceptance for M7

1. In each scene, a picture enlarged four times shows no per-cube speckle on any part.
2. For treatment B scenes, the average colour of the whole picture, before and after, differs by no more than 3 of 255 in any channel (measure by shrinking both pictures to one pixel).
3. For the barn table (done in M2), the pair of section 2 has been shown to Brian.
4. Triangle and draw counts of the podium, the ice, the pen, the dream, the bedroom and the leaderboard stage are unchanged (no cube changed).
5. Every scenery test passes; `npm run dream:gate` passes.
