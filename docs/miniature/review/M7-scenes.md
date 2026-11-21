# M7: the other scenes

Branch `miniature/m7-scenes`, on top of M6 (`3e7b543`). Plan file 07, sections 3 to 9 (the barn table was M2).
Treatment B: where a part's cubes were tinted one by one, the part is now its own average colour. No cube, light, fog,
camera or smoothing call changed, and no micro object was added.

## What the tree already had

Since 2026-11-18 `pick` returns the one tone its weights favour, and the smoothing's grain defaults to 0. So most of the
plan's list (the ten picks of `duel.ts`, the twenty of `pen.ts`) was already one colour a part, and what was left were
the places that tint cubes with a random number directly. Those are what changed:

| Scene | Parts averaged |
|---|---|
| The ice (`scene/duel.ts`) | Water, the shore's bank, the shore pines' needles |
| The pen (`scene/pen.ts`) | The land beyond the pen, the mountain wall's snow and rock |
| The podium (`table/Podium.tsx`) | Podium timber, straw on the lower blocks, the straw floor and its tufts, the bales |
| The dream (`dream/world.ts`) | Shrub leaves, sapling needles, rocks, hurdle posts, the hay obstacle, the sign's planks |
| The bedroom (`dream/bedroom.ts`) | The window view's hill, window trim, lamp foot, clock, toy sheep, cuff, shirt stripes; the farmer's hair, brows and moustache (one grey a part, the average of the grizzled mix) |

`docs/miniature/other-scenes.md` lists every remaining line that picks a tone or draws a random number in the eight
files, with its verdict (85 lines).

## Where it differs from the plan

| Plan | Built | Why |
|---|---|---|
| Replace each `pick` by `meanTone` | Left as it is | `pick` is already one tone a part; the mean of three tones would move every scene's colour, which the plan's own acceptance forbids |
| Duel and pen pines "by tier using `T.pine[2]`, `[1]`, `[0]`" | The duel's needles are their own average; the pen's pines untouched | The ice's shore pines are near-black on purpose, and the pen's are the diorama's tiered pine already. Green tiers would change both pictures far past 3 of 255 |
| Floes "one colour per floe, chosen by seed from three" | Untouched | Each floe is already one tone |
| Fence posts, rails by `T.beam[2]`, `[1]`, `[0]` in the pen | Untouched | Value steps would move the picture's colour; the pen's fence is one tone a part today |
| `detailed(…)` calls get grain 0 | Nothing to do | Grain has defaulted to 0 since 2026-11-18 |
| The leaderboard stage | Nothing of its own | Its animals and trophy follow M6 |

## Acceptance

1. No per-cube speckle: the parts above were the last; `pairs/ice.jpg`, `podium.jpg`, `dream.jpg`, `pen.jpg`.
2. Average colour of the whole picture, M6 against M7 (limit 3 of 255 a channel): ice 89.12, 98.85, 111.44 to
   89.09, 98.86, 111.49; podium 91.52, 59.25, 34.08 to 91.51, 59.28, 34.21; dream 167.26, 155.22, 200.78 to
   167.26, 155.22, 200.79; pen 98.61, 115.74, 133.74 to 98.64, 115.84, 133.71. The largest move is 0.13.
3. The barn table's pair went to Brian with M2.
4. Counts against the start, High: practice 243,006 triangles and 78 draws, unchanged; results 221,812 to 221,274
   triangles, draws unchanged; Counting Sheep 134,444 to 123,414, draws unchanged (flat faces of one colour join).
   Nothing rose.
5. `npm test` 1,851 passed, 86 skipped; `npm run dream:gate` exits 0; `npx tsc -b` clean; build passes; size 3.06 kB of
   headroom; `bakeStamp --check` 47 fresh (the ice's play card re-taken); `check.ts --only connect,wendigo` both PASS.

## Not checked

The bedroom bubble was not photographed for a pair (it shows only after a dream ends); its change is the farmer's
hair and a few small props, covered by the tests and the dream's gate.
