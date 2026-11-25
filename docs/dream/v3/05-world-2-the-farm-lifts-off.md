# 05. World 2: the farm lifts off

See `reference/world-2-the-farm-lifts-off.png`, `gate-2-the-foot-of-the-bed.png` and `phone-dream-window.png`.

**He is dreaming now, so the ground lets go.** It is the same farm: every building keeps its place along the strip. But each one rides its own island, the track is a strip of snow in the air, and the northern light hangs behind.

*An example.* The barn that stood on the snow a moment ago now floats past on a chunk of its own yard, icicles under its edge, its lanterns still lit. The fence is gone, but its string of bulbs is still there, drifting free in one long wave. Below the track there is only sky, and a clod of earth slides by close to the camera.

Every place below is in `data/worlds.json` (world 2).

## 1. The track

`laneBayFloat`, 40 of them end to end at z 0. Each bay is 2.4 m long and 1.4 m thick: a snow top (`snow +1`, tint 1.0), two rows of soil, and a stone underside in five uneven teeth, with five icicles under the front lip, two stones in the soil and one root. The teeth give the track a broken lower edge against the sky, so it reads as a thing floating, not as a band.

There is **no ground** in this world. Below and behind the track is sky: the fourth sky colour of file 02 fills the window under the horizon.

## 2. Islands and clods

Each building, pine and yard thing keeps the x and z it had in world 1 and stands on the island or clod listed at that place. Its foot is at the island's top.

| Island or clod | x (m) | y of its top (m) | z (m) | Row | What rides on it |
|---|---|---|---|---|---|
| `clodSmall` | 2 | 2.2 | -33 | B3 | a spire pine |
| `clodWide` | 6 | 2.3 | -9 | B2 | a fence bay (post and rails) |
| `clodSmall` | 8 | -0.5 | 3.6 | F1 | nothing: it drifts by in front of the track |
| `clodWide` | 12 | 7 | -105 | B5 | nothing: a far island |
| `islandBarn` | 16.2 | 1.4 | -30 | B3 | the barn, the silo |
| `clodWide` | 20 | -0.2 | 5.2 | F2 | nothing: it drifts by in front of the track |
| `clodSmall` | 24 | 1.7 | -13 | B2 | a cone pine |
| `clodSmall` | 26.5 | -2 | -36 | B3 | a spire pine |
| `islandYard` | 29 | 0.9 | -10.5 | B2 | the scarecrow, a bale stack |
| `clodSmall` | 31 | -0.6 | 3.8 | F1 | nothing: it drifts by in front of the track |
| `clodSmall` | 33 | -1.1 | -8.5 | B2 | a round pine |
| `islandHouse` | 40 | -0.9 | -29 | B3 | the farmhouse |
| `clodSmall` | 46.5 | 2.6 | -35 | B3 | a spire pine |
| `clodWide` | 47 | -0.25 | 5.4 | F2 | nothing: it drifts by in front of the track |
| `clodSmall` | 49.5 | 0.8 | -14.5 | B2 | a spire pine |
| `clodWide` | 50 | -5 | -112 | B5 | nothing: a far island |
| `islandYard` | 54 | -0.7 | -11.5 | B2 | the coop |
| `clodSmall` | 57 | -2.4 | -31 | B3 | a cone pine |
| `clodSmall` | 58 | -0.45 | 3.6 | F1 | nothing: it drifts by in front of the track |
| `clodSmall` | 59.5 | -1.5 | -9 | B2 | a cone pine |
| `islandMill` | 64 | 5 | -60 | B4 | the windmill |
| `clodSmall` | 67 | 1.2 | -13 | B2 | a spire pine |
| `clodWide` | 70 | -0.2 | 5.2 | F2 | nothing: it drifts by in front of the track |
| `islandYard` | 73.5 | 1.6 | -9.5 | B2 | a round pine, a cone pine |
| `clodSmall` | 77.5 | 0.4 | -32 | B3 | a spire pine |
| `clodSmall` | 81 | -0.5 | -8.5 | B2 | a round pine |
| `clodWide` | 82 | 10 | -108 | B5 | nothing: a far island |
| `clodSmall` | 84.5 | 3 | -35 | B3 | a cone pine |
| `clodSmall` | 87 | 1 | -14 | B2 | a cone pine |
| `clodSmall` | 88 | -0.55 | 3.8 | F1 | nothing: it drifts by in front of the track |
| `clodWide` | 89.5 | -1.9 | -9.5 | B2 | a fence bay (post and rails) |
| `clodSmall` | 93 | -1.3 | -11 | B2 | a spire pine |

- The far islands (row B5) and the clods in front (rows F1 and F2) carry nothing.
- **The clods in front** float just under the track's level, so only their snow tops and a little soil show at the bottom of the window. They take the rows' dark tints and pass fastest of all: they are what makes this world feel fast.
- **Bobbing.** Every island and clod belongs to one of three groups, by its place in the list above (first, second, third, first, …). A group moves up and down together: `y + 0.18 × sin(2π × beats / 8 + phase)`, with phases 0, 2.1 and 4.2. What rides on an island moves with it. Merge each group in each row into one mesh (file 02, section 6).

## 3. The string of bulbs

The fence's part `string` (wire and bulbs), 40 bays end to end at z −3, with no posts or rails. Each bay's height is `0.35 + 0.30 × sin(x / 3.0 − 2π × beats / 8)` metres above the track's level, so the string lies in one long wave that travels along the lane. Its bulbs keep world 1's chase.

## 4. The northern light

Sixty upright sheets of light to a strip, **180 m behind the track** (z −180), one every 1.6 m, each 1.0 m wide. For sheet `i` of 60, with `p = 2π × i / 60`:

| | |
|---|---|
| Its foot | `y = 9.0 + 5.0 × sin(2p) + 2.0 × sin(5p + 1.0)` metres |
| Its height | `15 + 6 × sin(3p + 0.6)` metres |
| Its colour | By quarter of the strip: `glow:aurora2` (teal `#6FB7B0`), `glow:aurora1` (sage `#7BC48E`), `glow:aurora1`, `glow:aurora3` (blue-violet `#8C8FD8`) |
| Its strength | Strongest along the lower edge, fading upward, in four parts: the lowest 15% of its height at 0.50, the next 25% at 0.34, the next 30% at 0.20, the top 30% at 0.09 |
| How it is drawn | Added to whatever is behind it (additive blending), unlit, with no haze. The moon shows through it |
| On the beat (112 a minute) | A swell travels along the sheets: `height × (1 + 0.12 × pulse(beats − x / 24))` |

Build the sheets as one mesh of flat quads. They are light, not blocks: there is nothing cloud-like about them.

## 5. The sky and the moon

File 02, section 5. The moon is `moonFull`, 128 px across at `A` = 90, its middle 70% of the way across the window and 36% of the way down the sky.

## 6. What else moves

| Thing | How |
|---|---|
| Snow | The same cubes as world 1, now **rising** at 0.4 to 0.7 m a second |
| The windmill, the chimney, his window | As in world 1 |
| The sheep's hooves | The same puffs; their cubes drift up 0.4 m and do not fall back |

## 7. What the sheep jumps

The iced models: `obGateIced`, `obPlanksIced`, `obBrickIced`, `obLogsIced`, `obBalesIced`, `obCratesIced`. Each is its world 1 model with its snow turned to ice (`ice +1`, `ice +2`) and four icicles under its top edge.

## 8. What is not in world 2

No ground, no wall, no fence posts. Nothing from the bedroom yet, except that gate 2 stands at this world's end.

## 9. Phones and the Low tier

- **Phones:** the same world.
- **Low tier:** no far islands, no clods in front, 30 sheets of light (every second one, each twice as wide), 45 snow cubes.
