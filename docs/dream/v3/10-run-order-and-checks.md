# 10. Run order, checks, and what Brian decides

## 1. Run order

One branch and one pull request for each step, on top of the build's seven branches. ■ means: stop, and wait for Brian.

| # | Step | Files | What Brian sees |
|---|---|---|---|
| V1 | **Endless, with a best score.** The meter goes. The counter loses "of 30" and gains the best tab. The wording of file 01. `worldAt` and `lapAt` are added with their tests but not yet used: until V5 the dream still follows the letters, as built. ■ | 01; 08 section 3 | The top bar without the meter; "Best 32"; "New best" |
| V2 | **The scene's frame.** The camera, the rows and their tints, the model loader and `models.gen.ts`, the prop board. Nothing a player sees changes yet: the voxel dream runs only with the dev switch `?dream=voxel`. ■ Brian compares the game's prop board with the four reference boards | 02; 03 | The prop board |
| V3 | **World 1 in voxels.** The ground, the fence, the wall, the farm, the sky, the light, the motion; the six obstacles and the signpost; the sign level and hung high; the play strip at 76%. The flat world 1 is removed. ■ | 04; 08 section 5 | His own farm, with depth |
| V4 | **Gate 1 and world 2.** ■ | 05; 07 | Lift-off; the floating farm |
| V5 | **Gate 2, world 3, gate 3, the loop, the moon show.** The last flat layers and the 2D canvases are removed. ■ | 06; 07 | Under the quilt; the worlds going round; the moon show |
| V6 | **The interface.** The rim and puffs, snores and marks, the tray's one message, the cards, the ready board, one star for each sheep, the quilt band. ■ | 08 | The frame round the dream, cleaned up |
| V7 | **The farmer in bed and the results board.** ■ | 09 | Him lying naturally; the board with the best score and readable words |

V1 is small and gives Brian the change he asked for first. V2 is where a wrong turn would cost most, so it stops before anything is shown to players.

## 2. Checks, and what done means

Each file ends with its own checks. These hold for every step:

1. **The usual.** Type check, all tests and the build pass.
2. **Proof that no rule changed.** The recorded night and the recorded practice run of version 2 (fixed words, fixed clock) give the same record after every step, to the millisecond: every word taken, jump, count and bump, and the result.
3. **The same places on screen** (file 02, check 1).
4. **The track is the brightest band; nothing is harsh** (file 02, checks 2 and 3), on a screenshot of each world.
5. **Cost** (file 02, section 8), with numbers in every pull request.
6. **The flash test** on every gate and moon show (file 07, section 4).
7. **Reduced motion:** with it on, nothing moves but the sheep, the obstacles, the track's scenery passing, the snow and the farmer's breathing.
8. **No recycling.** In V5's pull request, put the three worlds side by side at the same moment of a run and fill in this table. Every row must differ in shape or behaviour, not only in colour:

   | | World 1 | World 2 | World 3 |
   |---|---|---|---|
   | What the sheep runs on | A snowy track between banks | A floating strip with stone teeth | The turned-down sheet of his bed |
   | Right behind the track | The farm fence and its bulbs | The bulbs alone, in a travelling wave | The quilt's plain lining |
   | The middle distance | The farm on the ground | The same farm, each thing on its own island, bobbing | Quilt hills with his knitting things |
   | Far away | Hills with pines | Far islands; the northern light | Folds of quilt; his candle |
   | In front of the track | Home's stone wall | Clods drifting by | The quilt hanging over the bed's side |
   | In the air | Falling snow | Rising snow | Falling feathers; buttons on threads |
   | The light | Cool moonlight | Teal, from the northern light | Warm, from the candle |
   | What the sheep jumps | Farm things | The same, iced | His own things |

9. **Nothing without a reason.** `data/models/index.json` names, for every model, its original and where the player can see it. Anything added later without an original is removed.
10. **Screenshots in every pull request,** beside today's: every picture of the build's page that the step touches, at 1440 x 900 and 390 x 844 (with the keyboard open where typing happens).
11. **The season:** with `FESTIVE` false, no wreath, garland or coloured bulb remains anywhere in the dream.
12. **The style lint** passes on every dream file (file 02, section 9).

## 3. Changes Brian did not ask for, to confirm at the stops

- The play strip moves down, from 66% to 76% of the window's height.
- The gates' new shapes, and gate 3 (the head of his bed).
- The worlds go round every 15 fences after the first lap.
- The moon show at every 10 sheep, in place of the finale.
- One star for each sheep, in place of your words in the sky.
- The quilt's colours become Home's five, with cream between them, on the bed, in world 3 and on the boards.
- Pillows in place of cushions among world 3's obstacles; no pillow mountains.
- The dry-stone wall along the bottom of world 1.
- The sign hung higher, and level.
- The close button made quiet.
- The strip's camera raised, and how the farmer lies.
- The results board's two tiles and its word list.

## 4. Open choices for Brian (the defaults are used unless he says otherwise)

| # | Choice | Default | Other |
|---|---|---|---|
| 1 | How long each world lasts after the first lap | 15 fences | 10, or 20 |
| 2 | The moon show | Every 10 sheep | Every 25; or never |
| 3 | Your words during play | One star rises for each | The word also shows in plain letters for a second as its star rises; or nothing |
| 4 | The bottom of world 1 | Home's dry-stone wall | Open snow only |
| 5 | The quilt | Cream between the colours | The five colours in a row, as on Home's clothesline |
| 6 | Where the best score is kept | With the streak (so it follows the player) | On the device only |
| 7 | The sheep on the moon | The game's own sheep as dark shapes | The moon swells with nothing on it |

## 5. The prompt for Claude Code (one step per session)

```
You are doing one step of docs/dream/v3 (Counting Sheep, version 3). Step: V1.
1. With the Read tool, read CLAUDE.md to its last line, then docs/dream/v3/README.md and every plan file the
   step names in file 10, every word. Open the pictures in docs/dream/v3/reference/ that those files name.
2. Branch dream/v3-<step> from the tip of the build's branches. Record the fixed night and the fixed practice
   run before you change anything, if their records are not in the repo yet.
3. Make only this step's changes. Every model comes from docs/dream/v3/data/models through models.gen.ts:
   never type, round or reshape a box. Every place comes from data/worlds.json, every time from data/timings.json,
   every colour from LADDER through solid(). If a number is missing, stop and ask; do not invent it.
4. The pictures in reference/ show where things stand and which paint they take. They were drawn by a simple
   renderer: match their places, sizes and colours, and let the game's own lights, corner shading and soft
   edges do better than they do.
5. Run the checks of the step's files and of file 10, section 2. Put the pictures, the numbers and the cost in
   the pull request, with anything you could not do. Then stop and wait for Brian.
Never: change a rule, a speed, a rules box or the sheep; build a flat picture where a model is named; add a
cloud; add a footprint, a dent or a rut; raise a budget; skip a check; push to main.
```
