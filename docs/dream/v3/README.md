# Counting Sheep, version 3: the dream in voxels, endless, with a best score

Written 25 November 2026 against the build shown on "Counting Sheep Redesign": the seven steps of version 2, on the local branches `dream/cs1-farmer` to `dream/cs7-endings`. Save this pack as `docs/dream/v3/` in the repo. It is a plan on top of that build, not a restart.

## What Brian asked for

1. A lot of it is out of theme.
2. It should be infinite, like a high score: no meter at the top showing when the background changes.
3. It looks one-dimensional: not the cute voxel style of the rest of the world, such as Home's scenery.

## What this pack does

| Ask | Answer |
|---|---|
| One-dimensional | The dream is rebuilt from **69 voxel models** standing at real distances, seen by a real camera. They are given as exact boxes in `data/models/`, so nobody has to model anything by hand |
| Out of theme | Every scenery colour is one of the game's own (`LADDER`). The farm is Home's farm in small. The violet skies, the lace edge, the violet squares and the dotted words are gone. 46 flaws are listed and fixed (file 00) |
| Infinite, a high score | The meter is removed. The counter shows your count and your best. The worlds go round for as long as the night lasts, and every 10 sheep the moon puts on a show |

**Why the build came out flat:** version 2 described the dream as layers measured in pixels, and its sketches were flat drawings. The build followed them. In this pack there are no drawings. Every picture in `reference/` is rendered in 3D by `tools/render.py` from the same boxes and places the game will load, through the plan's own camera.

## What stays from version 2

The idea (the deeper he sleeps, the less the dream looks like his farm and the more it looks like his bed), the three worlds, the farmer's model, the bed along the bottom, the tray of letter tiles, the beat, the opening and the two endings. Version 2's files on how the worlds look (its 03, 04, 05 and the layout parts of 02) are replaced by this pack.

## Contents

| File | What it holds |
|---|---|
| `00-what-is-wrong-and-what-changes.md` | Brian's words; every flaw found in the build; what changes; what must not; corrections to version 2 |
| `01-endless-and-a-best-score.md` | No end, no meter; the best score; which world when; milestones; wording |
| `02-the-voxel-scene.md` | The camera, the rows of depth, the light, how the scene is built, cost, the style rules |
| `03-models.md` | All 69 models, their originals, how the data gets into the game, the quilt's colours, fitting obstacles |
| `04-world-1-his-own-farm.md` | World 1, part by part |
| `05-world-2-the-farm-lifts-off.md` | World 2 |
| `06-world-3-under-the-quilt.md` | World 3 |
| `07-gates-the-loop-and-the-moon-show.md` | The three gates and their timelines; the moon show |
| `08-interface.md` | The window's rim and tail, the top bar, the sign, the tray, snores, one star for each sheep, the ready board, the quilt band |
| `09-the-farmer-in-bed-and-the-results.md` | How he lies; his quilt and basket; the results board |
| `10-run-order-and-checks.md` | Seven steps, the checks, what Brian decides, the prompt for Claude Code |
| `data/models/*.json`, `data/models/index.json` | The models: 2,491 boxes |
| `data/worlds.json` | Where everything stands in each world |
| `data/camera.json`, `data/palette.json`, `data/timings.json`, `data/pixel-art.json` | The camera; every colour and the light targets; every time; the interface's pixel grids |
| `data/checks.json` | What `tools/checks.py` measured |
| `reference/` | 15 pictures made from the data, and 8 pictures of today's build in `build-today/` |
| `tools/` | The code that made the data, the pictures and the checks |

## Which source wins

1. **The data** for every box, place, colour and time.
2. **The text** for behaviour, and for anything the data does not hold.
3. **The pictures** last. They show where things stand, how big they are and which paint they take. They do not show the game's light: the game's own lights, corner shading and soft edges will look better.

If two of these disagree, stop and say so.

## What was checked for this pack

| Check | Result |
|---|---|
| Every picture comes from the data | `tools/pictures.py` draws all 15 from `tools/scenes.py` and the model files, with the camera of file 02 |
| The track is the brightest band of each world | Yes: lightness 0.69 against 0.63 for the next band in world 1; 0.83 against 0.67 in world 2; 0.87 against 0.66 in world 3 |
| Not harsh (the measures of `PLAN_DEPTH_AND_LIGHT.md`) | Hard edges 1.1%, 1.9% and 1.4% (pass mark 2.5%). Strongest colour 0.075, 0.066 and 0.095 (pass mark 0.17) |
| Interface text can be read | 28 colour pairs measured; all pass 4.5 to 1 (3 to 1 for the large count) |
| The style rules | All 69 models use only `LADDER` colours and named glows; none uses more than six materials |
| The camera keeps the lane's places | By its formula (file 02, section 3): for z = 0 it gives the side-on mapping exactly |

## What could not be checked here, and must be in the game

- **Speed:** triangles, draw calls and frame time (file 02, section 8). The pack only counts boxes.
- **The game's real light** against the targets (file 02, section 5).
- **That no rule changed** (file 10, check 2).
- **The no-flashing limits** at the gates.
- **The farmer in bed and the strip's new camera** (file 09): written from the build's pictures, not tested by picture.
- **The art scale.** 90 px a metre is measured from the build's pictures. The game's own value decides.
- **The sheep.** The pictures use a stand-in. The game's sheep is not changed.

## Running the tools

They need Python 3 with Pillow and NumPy. From `tools/`:

```
python3 build_data.py     # writes data/models, worlds.json, camera.json, palette.json
python3 checks.py         # writes data/checks.json
python3 pictures.py       # draws reference/*.png. Set DREAM_FONTS to a folder holding Fraunces 800 and Nunito 700 and 800; without it the labels fall back to DejaVu
```
