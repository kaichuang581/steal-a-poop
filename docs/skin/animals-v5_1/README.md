# Farm animals v5.1: the final report

Plan: `docs/REDESIGN_PLAN_V5_1.md`. Built F0 to F5 on 2026-11-07. Every measured check passes: `F0-report.md` is the
starting point (81 checks failing), `F5-report.md` is the result (0 failing).

## Pictures

| File | What |
|---|---|
| `lineup.png`, `lineup-squint.png` | the six at level 2, idle, each at its table scale (`?preview=lineup`) |
| `silhouettes-64.png`, `silhouettes-160.png` | the same as black shapes (`?silhouette=1&size=64`) |
| `strips-<species>.jpg` | 12 frames of proud, happy, startled, cold, freezing, thawing and bonk; 6 of grazing, run and jump (`?preview=strips`, saved by `node tools/animalStrips.mjs --base <dev url>`) |
| `dream-cow.png`, `dream-chicken.png` | the worn avatar running Counting Sheep (6.7) |

## By milestone

- **F0 Measure.** `src/skin/voxel/animals/measure.ts` holds the Part 4 measures. `tools/animalReport.ts` prints them.
- **F1 Faces and the sheep.** The rig's mouths take the muzzle's bottom row, so chewing never leaves the face. Brows sit on the face and step down where a head has no room above the eye. The sheep's head is the 5.1 wedge, with the 4 x 4 eyes, sideways ears, hood, collar ring and bell under the chin. `neckX` is channel 17, and a neck group carries the neck and head.
- **F2 Bodies and joins.** The pig, cow, horse and goat are rebuilt to 5.2 to 5.5 and 4.2. Necks are buried three voxels at each end. Collars, bands and scarves trace the neck's outline. Garments cover every exposed face above a straight belly cut and close at the neck.
- **F3 Chicken.** The chicken is a three-ellipsoid horizontal body with a ball head ahead of the breast. It has a beak, wattle, comb, teardrop wings and a raised five-slab fan tail.
- **F4 Animations.** `poseFor` follows 6.2, `flavour` follows 6.3, and the 6.6 ranges clamp every pose. The `bell` and `tailFan` tags are added, the wings follow 6.4, and the grazers' idle chew follows 6.5. The pose test is `src/skin/table/__tests__/animalPose.test.ts`.
- **F5 Sign-off.** The line-up, silhouettes and strips are above. The worn avatar runs the dream.

## Tests

- `npm test`: 996 passed, 65 skipped. This includes the V5.1 Part 7 tests 1 to 9 for all six species, and 180 pose cases with 12 samples each.
- `npm run build`: passes.
- `npx playwright test`: 33 of 34 pass. The one failure is an accessibility check that a "Child safety" link is 39 px wide on the phone accounts screens. It fails the same way on the base branch, `counting-sheep-anchor`, so the Fleece Navidad merge brought it in.

## Where the plan disagreed with itself

The ratio table (4.1) won over a sheet's letter everywhere but one row.

- **The muzzle ratio for the cow, horse and goat.** The table asks 0.6 to 1.0 head lengths ahead of the chest. Their sheets, with a neck buried three voxels at each end (4.2.1), give 1.15 to 1.25. No neck placement meets both, so their range is set to 1.10 to 1.30. **Brian to decide:** keep the necks, or shorten them and accept heads that sit on the chest.
- **The horse and goat are a little bigger than their sheets.** The wedge helper makes odd widths, so a "6-wide" head is 7. The table then fixes the horse's torso at 13 x 14 x 26 voxels and its head at 7 x 8 x 13. The goat's torso becomes 13 x 13 x 20.
- **The pig.** Its torso is one row taller and its head two rows higher, or its head-top ratio fails. There is no separate neck wedge, because at the sheet's z the head and shoulder bulge already overlap. Its belly line is at 0.40, not 0.34, so a third of the torso stays bare (4.5).
- **The chicken.** Its head is centred at z 0.42, not 0.30, because the sheet also wants it 0.14 ahead of the breast. Its torso is 9 rows, the only height that meets the head, width and leg ratios together.
- **The sheep.** The plan said its body is unchanged, but the original failed three ratios. Its back is one row taller, its corner lobes half a row lower and its leg shaft one row shorter, so 0.28 m shows. Its nose is on rows 17 and 18, because the sheet's 15 and 16 are the mouth's row.
- **Budgets.** Longer bodies fit because hollowed shells no longer draw their inner faces, and a coat is hollowed together with the body it covers.

## After review (Brian, 2026-11-07)

- **Eyes.** The sheep, cow, horse, goat and chicken have beady eyes: 2 x 2, dark, no whites, a white glint where the face is dark enough to show it (the sheep, the horse and the cow). The sheep and cow wear them on the front of the face, the horse, goat and chicken on the sides. The cow's coat is a shade under white so its glints show. The pig keeps its plates.
- **The cow is bigger.** Its back stood at the goat's height. It is now drawn at 1.2, so its back is at 1.06 m and it is 1.6 m long, second only to the horse. Growing it in voxels instead would have broken the voxel budget.

- **The chicken's head.** The head rests nearer the breast, a row lower, so the neck reaches forward less. The beak is a two-step wedge that reads from the side. The wattle is a small lobe under the chin. The eyes are the small ones.
- **Small eyes are flat squares.** On a round or tapering head the four eye voxels sat at different depths and read as an L. The head now fills out to one flat patch under each eye. A pale face (the cow, goat and chicken) gets no glint, which melted into it.

- **The cow's spots.** Spots sit where the blanket leaves the coat showing: the lower flanks, the neck, the rump, the chest, the back of the head and two legs. Patches round the eyes and bigger eyes were tried and dropped.

## Not done

- **The two-person silhouette naming test (Part 8).** It needs two people. The 64 px and 160 px silhouettes are ready for it.
- **Dream draw calls.** An animal in the dream costs 6 to 8 more draws than the sheep: 71 to 73 against 65.
