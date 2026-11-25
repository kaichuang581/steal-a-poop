# VOXEL_GRAIN.md — one detail size for every model

**The problem.** Models did not match. The bombs and fuse sounds were covered in details half a cube wide (0.025 m): a maker's mark, speckled cracks, a fuse twisted in single rows. Meanwhile the stalls, benches and boards were single plain blocks up to 4 m long. Small things looked fussy and big things looked like massive cubes.

**What does not work.** Building everything from the same 0.05 m cube. It makes a 0.5 m bomb only 10 cubes across, so every round thing turns blocky and pixelated.

**The fix.** Match the *smallest visible part*, not the cube. Every stripe, crack, eye, rivet and board on every model is at least 0.05 m, the "small detail" step of the miniature plan (`PLAN_MINIATURE_SUMMARY`). Small round things may still use finer cubes, but only so their outline stays round. Big surfaces are made of real parts (boards, panels, steps), one flat colour each, as the diorama plan already asks (`PLAN_DIORAMA_SCENERY` 3.2).

*An example.* The Ember bomb sits on the bench beside the Oat Sack. Before, its glowing cracks were one tiny cube wide (about 5 px on screen), next to sack weave rows 9 px tall. Now it is still a smooth ball (20 cubes across), but each crack is 0.05 m wide (10 px), the same as one weave row on the sack. The cloth on the bench is panels 0.25 m wide in two tones, not one 3.9 m slab.

The data in `data/` is already rebuilt to these rules.

## 1. The rules

| # | Rule | In numbers |
|---|---|---|
| 1 | **One detail size.** Seen from the camera, no part of any model is narrower than 0.05 m. Only the fuse's sparks are smaller | ≥ 0.05 m |
| 2 | **Cube size by role** (the ladder of `PLAN_DIORAMA_SCENERY` 3.1). Props, stalls and scenery: 0.05 m. Small round things shown up close (the bombs, the fuse sounds): 0.025 m, **for the outline only**, never for detail. Things an animal wears (bibs, whistle): the animals' 0.04 m. Home's far backdrop (behind z = −4.5 m) is not checked | 0.05 / 0.025 / 0.04 m |
| 3 | **One part, one colour.** No noise, no speckle, no painted lines. Parts that touch differ by one step of their material's colour ladder | — |
| 4 | **Big surfaces are real parts.** A wall, counter, bench or board run is built from boards or panels at most 0.4 m wide, in the base colour and one step darker, taking turns (`tile()` in `tools/kit.py`). No one-colour flat area holds a square larger than 0.4 m | ≤ 0.4 m |
| 5 | **Snow is whole.** A snow cap is one piece. A bank or mound is stepped, one colour per step, one step lighter going up | — |
| 6 | **Patterns on round things** are worked out on 2 x 2-cube blocks as the camera sees them, then any leftover sliver takes its neighbours' colour (`clean()` in `tools/skins.py`). So a band or crack is always whole | blocks of 0.05 m |
| 7 | **Same on screen.** At 1440 x 900, every placed model's smallest part draws 6 to 15 px | now 7.1 to 14.2 px |
| 8 | **Nothing shrunk past the detail size.** A model is shown at 0.8x to 1x. A burst on a display stand is drawn in: each piece moves to 42% of its distance from the middle (67% on the Bell Shelf's larger stand), but every piece keeps its full 0.05 m size | scale 0.8 to 1.0 |
| 9 | **Overlaps.** Where two boxes overlap, the later one wins, as the game's `fill()` does. The packer keeps the JSON's box order | — |

## 2. What changed

"Slivers" counts cube faces, seen from the front, that are part of something narrower than 0.05 m. "Plain" counts one-colour areas wider than 0.4 m.

| Model | Before | After | What changed |
|---|---|---|---|
| 8 bomb skins | 19 to 61 slivers each | 0 | Still 20 cubes across, so still round. Patterns redrawn as bold parts: Ice's snow cap and two icicles; Ember's cracks 2 cubes wide; Peppermint's candy bands, 0.1 m each; Plum's bloom, cleft and a leaf on the left (the fuse goes right); Gold's belt, rivets and one shine; Diamond's facets in two tones; Brass Bell's lip and rings; Aurora's three-colour ribbon and three stars. The face is a flat disc 0.2 m across and 0.05 m thick; outside a game it shows **10**. No maker's mark. The fuse is 12 cubes of 0.05 m, each one colour, the two colours taking turns (`T2`) |
| 8 fuse sounds | 0 to 93 slivers each | 0 | Same 0.025 m cubes, details 0.05 m or more: the owl's big square eyes and three chest feathers, the 8-bit's 2 x 2 screen pixels and bold pad, icicles that taper 3 to 2 cubes, three round sleigh bells with a slit at the bottom (`T4`) |
| 10 bursts | Shrunk to 34% in the shop, so their cubes were about 0.014 m | 0.05 m pieces, drawn in, not shrunk | Rule 8 (`T3`) |
| Big bell (Bell Shelf) | 0.04 m cubes | 0.05 m | It is 0.8 m wide, so it stays round at 0.05 m |
| Whistle | 0.025 m | 0.04 m | Onto the animals' grid |
| Feed stall, bell stand | 5 and 8 plain | 0 | Back walls, counters and steps in boards 0.2 to 0.25 m wide, two tones; cloth tops in 0.2 m panels |
| Sample bench, notice board, Barn Book (2), sack crates (3) | 1 plain each | 0 | Planks and panels; the notice board's roof snow is one cap 0.4 m deep |
| Barrel | One smooth block | Staves 0.1 m wide | Two tones; its lid is four boards |
| Coach's chair, practice crate, ice block | 2, 2 and 1 plain | 0 | The cushion in two pads; boarded crate sides; a stepped snow mound on the ice block |
| Rink boards, snow bank | Boards in three tones; two of the bank's steps shared a colour | Same shapes | Boards in two tones taking turns; each bank step one step lighter than the one below |
| Snow everywhere | Cut into patchwork in the last draft | Whole caps and stepped banks | Rule 5 |
| Sacks (3), odds board, lanterns, posts, tally board, broom, tile rack, light post | Already followed the rules | Unchanged | — |

**Result.** Every one of the 47 models passes rules 1 to 4. The Trading Post row is about 15,700 boxes (16,000 before) and the rink's own models about 450 (as before), so the cost to draw does not change.

## 3. What Claude Code does

1. Use this folder's `data/` as it is. Every model is already rebuilt; model nothing by hand.
2. Pack the models as step S1 of `X2` says, keeping box order (rule 9).
3. Bombs: build the 12 fuse pieces from `fuse_pieces` in `data/skins.json` (each piece 2 x 2 x 2 cubes). Remove any `emblem` mesh. Outside a game, draw **10** on the face in the skin's digit colour.
4. Trading Post bursts: place them with `spread` (rule 8), never by scaling the whole burst.
5. Run the checks below.

## 4. Checks

- `python3 tools/checks.py`: 379 checks pass, 0 fail. For every model it checks the cube size for its role, that no plain area is wider than 0.4 m, that no part seen from the front is narrower than 0.05 m, the scale range, and the 6 to 15 px band on screen.
- `python3 tools/grain_audit.py` prints nothing. It lists only models that break rule 1, 2 or 4. Use `-v` to list every model and `--data DIR` to audit another data folder (this is how the "Before" column was measured).

**A new model:** pick its cube size by role (rule 2), make every part at least 0.05 m, build any big surface from `tile()` boards, then run `grain_audit.py`.
