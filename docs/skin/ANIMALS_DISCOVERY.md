# Farm animals: discovery (V5 Milestone A0)

7 November 2026. The state of the avatar animals before Milestone A1, as committed in `12f22c3`..`ab425a8`. No source
file changed for this document.

## 1. Builders and selection

- `src/skin/voxel/animals.ts` builds pig, cow, goat, horse and chicken with one function, `animalModel(animal)`, memoised
  per animal. Every one is a parameterised copy of `sheepModel()`: the sheep's `HEAD_ROWS` wedge head (built in the
  sheep's rows and shifted up or down by a per-species `dy`), the sheep's `EYE_BASES`, an ellipsoid body in place of the
  fleece, the sheep's leg boxes, and a few voxels added per species (ears, snout, horns, comb, beard, mane, tail,
  accessory). `animalModel('sheep')` returns `sheepModel()` itself.
- They are selected from the catalogue: `src/skin/avatars/catalog.ts` has six characters, one per animal (`sheep`, `pig`,
  `cow`, `goat`, `horse`, `chicken`), each with `colors: { body, shade, dark, soft, pop }` and a blurb. There are no
  named characters, packs, `worn` items or `accent`/`mane`/`nose` colours any more (the fifteen-character catalogue the
  plan describes was replaced on 2026-11-06). The admin avatar (`kaiyan`) is a photo, not a model, and is out of scope.
- Rendering: `src/skin/table/Sheep.tsx` takes `model?: SheepModel`; `BarnTable.tsx`, `FarmBackdrop.tsx` and
  `SheepPreview.tsx` pass `animalModel(byId(avatar).animal)`. The speaker camera aims by `CROWN_ROWS` in `animals.ts`.

## 2. The viewer

`?skin=painted&preview=sheep` (`src/skin/table/SheepPreview.tsx`): one model with chips for the animal (sheep, pig, cow,
goat, horse, chicken), the wool level (0 to 4), every `SheepState`, `speaker` and `close-up`. Default camera
`(0.5, 1.0, 2.6)` looking at `(0, 0.6, 0)`, fov 32; close-up `(0.3, 0.95, 1.5)` looking at `(0.02, 0.8, 0.3)`.
Lighting: a hemisphere and one directional light with shadows, a tiled floor.

## 3. The current models (level 2, viewer camera)

| Model | Voxels before culling | Parts | Distinct colours (approx.) | Screenshot |
|---|---|---|---|---|
| Sheep | about 2,400 | wools ×4, frosts ×4, head, hood, tail, eyes ×2, lids ×2, brows ×3, mouths ×6, ears ×2, legs ×4, collar, bell, sheared, breath | 12 | `docs/skin/animals-a0/sheep.png` |
| Pig | 1,772 | the same slots | 11 | `docs/skin/animals-a0/pig.png` |
| Cow | 2,857 | the same slots | 12 | `docs/skin/animals-a0/cow.png` |
| Goat | 1,844 | the same slots | 11 | `docs/skin/animals-a0/goat.png` |
| Horse | 2,901 | the same slots | 12 | `docs/skin/animals-a0/horse.png` |
| Chicken | 1,479 | the same slots (two legs empty) | 11 | `docs/skin/animals-a0/chicken.png` |

Triangles after meshing were not measured per model; the table's seven-animal total sits under the dev overlay's
budget. All five share the sheep's silhouette: a tall wedge head on a blob body, as the plan's Part 2 describes.

## 4. States and levels

Every model supports every `SheepState` (idle, proud, happy, startled, cold, freezing, frozen, thawing, sleeping,
grazing, thinking, run, jump, bonk, land) because the parts carry the sheep's pivots. Coat levels 1 to 4 scale the
body ellipsoid by 60% of the sheep's `LEVEL_K`; level 0 is a thinner body in the same colours (no shivering look of
its own); freezing uses the sheep's frost dots on the body's upper surface and the ice block.

## 5. Worn items

Nothing. The catalogue has no `worn`; the models carry one fixed accessory each as part of the body or head (the pig's
beanie, the cow's leather strap and bell, the goat's and hen's scarves, the horse's blanket), painted in a shared knit
family. The 2D icons (`AvatarIcon.tsx`) draw pixel portraits from `portraits.ts` with no accessories.

## 6. Disagreements with the plan

1. The catalogue has one character per animal with `{ body, shade, dark, soft, pop }`, not fifteen characters with
   `accent`, `mane`, `nose`, `worn` and `wornColor`. The builders must map the plan's roles onto these colours.
2. The chicken is already in the catalogue as one character ("Chicken"), not three with names.
3. Every model is a recoloured sheep with a vertical wedge head and the sheep's 3 × 2 eyes (recently widened to 2 × 3),
   against Parts 4.3 to 4.5.
4. Accessories are baked into the models (beanie, strap, scarves, blanket), against 4.7's three-signature rule and
   4.8's worn-item rule; there are no warmth layers, and lives scale the body instead (4.9).
5. There is no `AnimalModel`, `Animal.tsx`, `frostOf`, connectivity test or budget test (4.1, 4.13).
6. The speaker camera aims by a per-species row count (`CROWN_ROWS`), not by the model's measured height.
