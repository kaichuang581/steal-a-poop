# The diorama plan's baseline

The plan (docs/diorama/PLAN.md, D0) starts from the game at v0.8.0, commit `4f033f4` (origin/main on 2026-11-18). Its
full gate run is docs/visual-overhaul/reports/m12.md, taken on that commit. From here a milestone may not make any
check worse than this, and must improve the scene and count numbers it touches.

## The gate at v0.8.0 (m12.md)

| Check | Verdict | In one line |
|---|---|---|
| type check, npm test, both builds | PASS | 1,829 tests passed, 86 skipped |
| size | PASS | 763,309 gzipped bytes of 763,400 |
| fences, banned, baked, scenes, smoke | PASS | |
| human checks | FAIL | 40 human checks have no result |
| ledger | FAIL | 11 tests of the base gone or renamed; 3 test files changed |
| pictures | FAIL | 12 pictures changed and not declared for milestone 12 |
| counts | FAIL | two phone means did not repeat to 0.01% |

## The numbers this plan must bring down (section 7 and 8)

Counts, High tier, computer 1280 x 720 (m12.md, "Counts"):

| Screen | Triangles | Draws | Buffer MB |
|---|---|---|---|
| Home, busiest shot (`home-pov1`) | 2,385,197 | 513 | 166.2 |
| Home, first shot (`home-pov0`) | 1,649,795 | 272 | 125.6 |
| Table, 6 seats | 1,132,478 | 143 | 73.6 |
| Practice | 257,206 | 84 | 13.4 |
| Counting Sheep | 202,808 | 54 | 29.2 |

Scenes (docs/visual-overhaul/RATCHETS.json, `scenes`):

| Number | Farm | Pen | Podium | Bedroom | Dream | Ice | Table |
|---|---|---|---|---|---|---|---|
| Loose pieces (`connect.loose`) | 1,321 | 66 | 3 | 1 | 0 | 0 | 0 |
| Coplanar area, m² (`coplanar.area`, coarse) | 833.6 | 54.6 | 1.15 | 0.06 | 14.9 | 6.4 | 1.76 |

## Since v0.8.0, not yet merged

The animal rebuild from Brian's sheets (branch `animals/sheets`, version 0.8.1) changes the animal model ratchets
(`scenes.models.*`: most fell, eleven rose) and `scenes.place.inside.pen` (5 to 6, the bigger animals in the pen), and
the ledger (8 tests gone or renamed, 4 test files changed: the animal tests now pin the sheets). Those are its pull
request's decisions for Brian, not this plan's; once merged, they are part of this baseline.
