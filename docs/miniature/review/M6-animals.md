# M6: animals, worn things, bombs, and the season's decorations

Branch `miniature/m6-animals`, on top of M5 (`328069f`). Plan file 06. Colours only: no shape, rig, place, glow or
cube changed.

## What was done

- **Animals** (`voxel/animals/*.ts`, `voxel/sheep.ts`): every part is drawn in its own colour from its own file, with
  none of its colour taken off (`shade(hex)` from `voxel/paint.ts` in place of `lin(hex)`, which removed 30% of the
  saturation). Eyes are untouched (`eyePlate` still goes through `lin`), and so is the dark patch under the feet.
- **The frozen sheep's block** (`sheep.ts`): block `ice` 0, its rim, the snow at its foot and its cap `snow` +1,
  icicles `ice` +1, loose chunks `ice` 0; a loose curl is one colour. Cubes unchanged.
- **Worn things, bombs, bursts, the trophy** (`animals/garments.ts`, `bomb.ts`, `bombSkins.ts`, `burstProps.ts`,
  `trophy.ts`): the same rule. Fuses and sparks keep their colours and glow.
- **The old characters** (`characters.ts`: the wolf, the sheepdog and the rest): the seven random picks are one solid
  colour a part, the tone's middle value (the wolf's coat and its head, snout and tail; the old sheep's wool and
  curls; the icicle).
- **The table's own models** (`voxel/table.ts`): the platform's boards, the wool pile and the letter board through
  `shade`; the pile keeps the tone it had.
- **The season** (`scene/festive.ts`): firs by tier (`pine` −1, 0, +1) with `snow` +1 on their shelves; star `brass`
  +1; presents `scarfRed`, `giftGreen` or `brass` with ribbons `brass` +1, `trimWhite` +1 or `scarfRed`; canes
  `scarfRed` and `trimWhite` +1; wreaths `giftGreen` −1 with `scarfRed` berries and bows; stockings and hats
  `scarfRed` with `trimWhite` +1; wires `iron` 0; the light strings' posts `wood` −1. Bulbs: the same colours, the same
  glow, the same grouping. No `pick` is left in the file.

## Where it differs from the plan

| Plan | Built | Why |
|---|---|---|
| Value steps on animals: belly −1, head +1, legs −1, ears and tail −1, mane −1, tufts +1 | None added | The plan was written for the animals of v0.8.0. Since 0.8.x each animal is built one-to-one from Brian's six-view sheet (2026-11-18: "i want it to look like the reference"), part colours included; a step laid over a part would move it off his sheet. Taking the desaturation off moves every part toward his sheet's own colour |
| `props.ts`: five random picks made solid | Untouched | Its name stakes have not been drawn by the game since 2026-11-08, and `signs.test.ts` holds their colours |
| The firs' baubles "one solid colour each" | Unchanged | On this tree the baubles are the string's own bulbs, which the plan keeps as they are |
| Sheared skin, stubble tufts | Nothing to do | The sheet-built sheep has neither |

## Tests

- `animals.test.ts`, "keeps the palette": body saturation under 62% is now under 88%. The 62% was measured on colours
  drawn with 30% taken off (the horse's brown at 0.61); in the sheet's own colours the same brown measures 0.876.
- Baked pictures: 15 went stale (the bomb and burst thumbnails, the sheepdog, the two play cards). All baked again
  with their own tools; `bakeStamp --check`: 47 fresh, 0 stale. `review/M6-shop-thumbs.png` shows six before and after:
  more colourful, none clipped or lost against its tile.

## Checks

- `npx tsc -b` clean; `npm test` 1,851 passed, 86 skipped (the season's z-fighting test among them); build passes;
  `npm run size` 3.00 kB of headroom.
- `check.ts --only connect,wendigo`: both PASS with the season on; pins as they were.

## Pictures

- `review/pairs/sheet-home.jpg`: every Home model and animal, before and after (the plan's decision 6).
- `pairs/pov0-day.jpg`, `pov2-day.jpg` (the paddock's animals; that shot's light is still its own), `pov3-day.jpg`,
  `pov4-day.jpg`, `pov6-day.jpg`, `pov0-night.jpg`, `pov0-day-phone.jpg`, `table-7.jpg`, `table-7-night.jpg`.

## For Brian

- Decision 6, animal colours: the pair above. If he prefers them as they were, the animal files alone go back.
- Whether the plan's value steps should be laid over his sheets' colours after all is his to say.
