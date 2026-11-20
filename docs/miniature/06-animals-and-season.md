# 06. Animals, the hero, and the season's decorations

Milestone M6. Shapes do not change here. Only colours do.

## 1. What is fixed

- No animal's shape, size, rig, animation, anchor, facial expression or place changes. This covers `src/skin/voxel/sheep.ts`, `src/skin/voxel/characters.ts`, every file under `src/skin/voxel/animals/`, and the components that draw them (`src/skin/table/Sheep.tsx` and the rest).
- If the working tree (v0.8.3) has newer animal models than the pushed code (block-style sheep with pink faces, cube hens), those newer models are the ones kept. Apply this file's colour rules to them as they are.
- Eye colours (`WHITE`, `IRIS`, `PUPIL`, `WOLF_EYE` in `palette.ts`) are not changed.
- The dark patch under each animal's feet (`contactPatch.ts`) is not changed.
- No rule, score, timer or animation timing changes.

## 2. Why animals need a colour change at all

Animals are already close to the target: in the pushed code the cow, pig, goat, horse and hen use one solid colour per part (their files call `lin()` only, never `pick()`). Two things are still off:

1. **They would look washed out.** `lin()` removes 30% of every colour's saturation. After file 03 the farm round them is no longer desaturated, so the animals would be the dullest things on screen.
2. **Their parts touch without a value step.** Legs, ears and bodies of one colour run together in flat light.

## 3. The colour rule for animals

1. Each part keeps **its own colour from its own file** as step 0. It is converted with `shade(hex, 0)` from `paint.ts` (file 03, section 1), which does not desaturate, in place of `lin(hex)`.
2. Parts take the steps of the table below, with `shade(hex, step)`.
3. No animal is repainted to a colour from file 01's table. The table's `wool`, `faceDark` and `pink` rows are there for objects that must match an animal (a tuft of wool on a fence, for example), not to overwrite the animals.

| Part | Step | Why |
|---|---|---|
| Torso | 0 | The reference colour of the animal |
| Belly: the lowest row of the torso's cubes | −1 | Reads as shade under the body |
| Head, when it is the torso's colour | +1 | Lifts the face toward the viewer |
| Head or face in its own colour (dark face, pink face) | 0 of that colour | |
| Legs | −1 of their colour | Separates legs from the body (the reference does exactly this) |
| Hooves, feet | 0 of their colour | |
| Ears, tail | −1 of their colour | |
| Horns, beak, comb, wattle, snout, udder | 0 of their colour | Small accents stay pure |
| Patches on a hide (cow) | 0 of the patch colour; the patch's belly row −1 | |
| Mane (horse), beard (goat) | −1 of their colour | |
| Wool tufts and curls that stand out from the fleece | +1 | |

Rules R1 to R3 of file 01 apply: one part, one colour; nothing random per cube.

### 3.1 The sheep (`sheep.ts`)

The sheep has more states than the other animals. Geometry in every state stays as it is.

| State or part | Today | New |
|---|---|---|
| Fleece, at every wool level | Solid, through `lin()` | `shade(hex, 0)`; the belly row −1 |
| Face, legs, ears | Solid | By the table above |
| Sheared skin | `pick(T.skin, hash3(x >> 2, y >> 2, z >> 2, 53))`: random patches of three skin tones | One colour: `shade(T.skin[1], 0)`, the belly row −1 |
| Stubble tufts left after shearing | Single cream cubes placed by a random test | Unchanged in place (each tuft is a whole part, seeded); colour `shade(CREAM[0], 0)` |
| The ice block of a frozen sheep | Bands by height with random patches of `T.ice` tones; a rim of two snow tones | Block `solid('ice', 0)`; rim `solid('snow', 1)`. Cubes unchanged |
| Snow heaped at the block's foot, and the cap on top | Random tones of `T.snow` | `solid('snow', 1)`. Cubes unchanged |
| Icicles on the block; loose ice chunks | Random `T.ice` tones | `solid('ice', 1)`; chunks `solid('ice', 0)` |
| The loose curls that fly off | Two cream tones by patch | One colour per curl, `shade(CREAM[0], 0)` |

`T.skin` and `CREAM` are the names in the pushed code; use whatever the working tree calls them.

### 3.2 The wolf and other characters (`characters.ts`)

`characters.ts` has seven calls to `pick()`. For each, replace the random pick by one solid colour for the part (`shade(tone[1], 0)`, the tone's middle value) and apply the table of section 3. List the seven replacements in the pull request.

## 4. Garments, skins, hats, bombs, trophies

Files: `src/skin/voxel/animals/garments.ts`, `worn.ts`, `src/skin/voxel/bomb.ts`, `bombSkins.ts`, `burstProps.ts`, `trophy.ts`, `props.ts`, `table.ts`.

1. Colours convert with `shade(hex, 0)` in place of `lin(hex)`, so worn items are as vivid as the animal wearing them.
2. Where one of these files picks a random tone per cube (`props.ts` has five such calls, `table.ts` two), make it one solid colour per part.
3. No shape changes. No value steps are added to worn items, except the scarf: band 0, hanging tail −1.
4. Things that glow (a lit fuse, a spark) keep their glow colours and strengths.

**Bake the pictures again.** The shop's item pictures, the stall, the tour guide and the loading doors are picture files baked from these same models by four tools: `tools/renderThumbs.mjs`, `tools/renderStall.mjs`, `tools/renderGuide.mjs` and `tools/renderDoors.mjs`. A manifest (`tools/bake/baked.json`) records which model made each picture, and `npx vite-node tools/bakeStamp.ts -- --check` fails when a model has changed since its picture was baked. So after this milestone:
1. Run the check. It will list every picture whose model changed colour.
2. Bake those pictures again with their own tool. The tools stamp what they bake. Never stamp a picture by hand, and never use `--known-stale` to get past the check.
3. Run the check again. It must report nothing stale.
4. Put the shop's grid, before and after, in the pull request. The baked pictures keep their own light and tone mapping, which this plan does not touch, so they will simply be more colourful. If any item becomes hard to read against its tile, or clips to pure white or pure colour, stop and show Brian. Do not change the interface or the bake's light.

## 5. The pair for Brian

At the end of the animal work, make one picture: every animal from `?preview=mini&sheet=home`, before and after, side by side. Decision 6 in `00-README.md`: the default is this file's rule. If Brian prefers the animals as they were, revert the animal files only; everything else in the plan still holds.

## 6. The season's decorations (`src/skin/scene/festive.ts`)

`FESTIVE = true` in `src/config.ts` puts decorations on Home, in the barn and in the small scenes. Their places were tuned cube by cube so that nothing floats and no two faces flicker against each other. **No cube of any decoration is added, removed or moved.** Only colours change.

| Decoration | Today | New |
|---|---|---|
| Firs (the big one by the doors, the one in the barn) | Tiers of `T.pine` tones | By tier, as the yard's pines: lowest third `pine` −1, middle `pine` 0, top `pine` +1 |
| Snow on the firs' shelves | Snow tones | `snow` +1 |
| Baubles (not lights) | Their colours | One solid colour each: `scarfRed` 0, `brass` 0 or `giftGreen` 0, in the order they are placed today |
| Star | Gold | `brass` +1 |
| Presents: wrap | `T.collar[1]`, `T.pine[1]` or gold, passed in per present | `scarfRed` 0, `giftGreen` 0, `brass` 0 respectively |
| Presents: ribbon | The contrasting colour passed in | Gold becomes `brass` +1; snow white becomes `trimWhite` +1; red becomes `scarfRed` 0 |
| Candy canes | Red and white stripes | `scarfRed` 0 and `trimWhite` +1 |
| Wreaths | Green ring with red | Ring `giftGreen` −1; bow and berries `scarfRed` 0 |
| The snowman's hat and other hats (`santaHat`) | Red and white | `scarfRed` 0; band and bobble `trimWhite` +1 |
| Light strings: wire | Dark | `iron` 0 |
| Light strings: bulbs | `GLOW` colours (`#E8402E`, `#3FBF5F`, `#FFC24B`), glowing | **Unchanged**: same colours, same glow strength, same grouping (`BULB_GROUPS`) |
| Orchard baubles | Hung on `ORCHARD_TIPS` | Unchanged places; one solid colour each |

`festive.ts` has six calls to `pick()` and eight to `hash3()`. After this step none of them may decide a single cube's colour. A `hash3` that chooses a whole bauble's colour or a whole present's place may stay.

If the brighter day exposure of file 02 makes the bulbs flare on Home, divide the bulbs' glow strength by the exposure on Home only (file 02, Change C). Do not change it in the barn or the small scenes.

## 7. Acceptance for M6

1. The animal sheet (section 5) passes the ten checks of file 04, section 7, with check 4 (two block sizes) left out, since animals are one size.
2. In the Home tour, no animal is duller than the building nearest to it, and legs can be told from bodies in every shot.
3. Every baked picture has been baked again and `bakeStamp --check` reports nothing stale (section 4).
4. `src/skin/scene/__tests__/zfighting.test.ts` and `npm run check:floating` pass with the season on.
5. The wendigo check passes.
