# Fleeced: Leaderboards stage, poses and island (version 3)

Written 22 November 2026 from a screenshot of the Leaderboards screen as built from `PLAN_LEADERBOARD.md` version 2 (desktop, 1440 x 900, Ranked tab). Give Claude Code this file and the screenshot. One pull request.

**Brian is happy with version 2** ("that actually came out amazing"). This plan changes **only the 3D stage**: the three poses, the island's modelling, the props' arrangement and the distant islands. The interface (bar, tabs, panel, rows, your row, plates, snow caps, lights) stays exactly as built. Record this in `CLAUDE.md`. This plan replaces sections 8.1 and 8.4 of version 2; every other part of version 2 stands.

**Binding rules from earlier plans still hold:** the size ladder and colour rules of `PLAN_DIORAMA_SCENERY.md` sections 3.1 to 3.6 (one flat colour per part, value steps of one ladder step, no noise, no single-cell litter, grouped props, clean edges); the depth plan's palette (`LADDER`); the lantern-light rule (every point light inside a lantern recipe); **no animal is ever shown shorn**. Animal models are not changed: only their poses.

## 1. Units and words

| Term | Meaning |
|---|---|
| `W` | A crate's width (all three are equal since version 2) |
| `D` | A crate's depth |
| `H` | The avatar's height in its own rest pose (standing on four legs), feet to the top of the head, hat not counted |
| X, Z | X from the 1st crate's centre, + toward screen right. Z from the crates' front faces, + toward the camera. Crate centres sit at X = −1.25 W (2nd), 0 (1st), +1.25 W (3rd) |
| Cells | M = 0.1 m, S = 0.05 m, as in the diorama size ladder |
| Angles | From the avatar's rest pose, about each part's own pivot (the head at the neck, legs at the shoulder or hip, the body at its centre) |
| Tip back / forward | The top moves away from / toward the camera |
| Lean left / right | The top moves toward screen left / right |
| Turn left / right | The front turns toward screen left / right |
| Swing forward / up (a leg) | The hoof moves toward the camera / keeps going past forward toward the sky |
| Spread / turn in (a leg) | The hoof moves away from / toward the body's middle line |

## 2. What is wrong today

| # | Problem | Seen on the screenshot |
|---|---|---|
| 1 | The 1st looks stiff | It stands upright on its hind legs, tipped back about 15°, with the front legs hanging at the chest and the trophy hanging at its hip like a bag. Nothing says "winner" |
| 2 | The 2nd looks as if it is sliding off | It sits on the crate's front edge leaning back and to the right about 12°; its hind legs hang down the front face to the top of the carved "2" |
| 3 | The 3rd looks broken, not asleep | It lies on its side, seen side-on, while the other two face the camera. Its head is twisted about 60° and hangs below the crate's top at the left corner. Its body's side reads as one big flat cream block |
| 4 | The snow has spikes | About forty small grey notches in a regular grid across the snow, like rows of teeth |
| 5 | The snow in front reads as stairs | Four even terraces step down from the crates to the rim |
| 6 | The rim is one flat band | A plain snow band about 40 px tall across the whole front, one thin brown line under it, then grey steps |
| 7 | The left pine is cut off | About half of it is off the screen's left edge |
| 8 | The right corner is crowded | The lantern post (about as tall as the 3rd crate, its lantern as big as a sheep's head) stands in front of the hay bales and the small pine and hides most of both |
| 9 | The fence is lost | Only two posts peek out behind the left pine |
| 10 | The distant islands look like spinning tops | Symmetric upside-down cones, taller than they are wide, each with one white, ghost-like pine |

## 3. The poses

### 3.1 Shared rules
- **New poses for this stage only,** named `lbChampion` (1st), `lbGoodSport` (2nd) and `lbNap` (3rd). The end-of-game podium's dances stay as they are.
- **Poses are data:** for each keyframe, each part's rotation, offset and scale. They are blended in the frame loop, never through React state per frame. Find where avatars are posed today (the podium's dances and the avatar animations) and add these beside them.
- **Map the parts first.** List each species' rig parts and pivots in the pull request. If a part named here is not its own part in a species (separate ears, a hat, eyes), skip that line for that species and say so.
- **Clocks.** Loops run on the screen's own clock, staggered: the 1st starts at 0 s, the 2nd at 0.8 s, the 3rd at 1.6 s, so their big moments never land together. They pause when the browser tab is hidden.
- **When the top three change** (a tab switch), the new avatar takes its place's rest pose at once and starts its loop from 0.
- **Reduced motion** (`prefers-reduced-motion`): each avatar holds its rest pose; the 3rd's "z"s stand still.
- **Contact.** At rest, the parts that bear weight (the 1st's hind feet, the 2nd's rump, the 3rd's belly) touch the crate's top: gap 0 ± 0.01 m.
- **Overhang.** No part passes the crate top's edges, except the 2nd's hind legs (over the front edge, by design) and the 1st's raised front legs and trophy (above).
- **Never shorn.** Every sheep keeps its full coat in every frame.

### 3.2 Species
- **Sheep, goat, pig, cow, horse:** as written.
- **Chicken:** its wings play the front legs (wings raise the trophy, wings clap, wings fold for the nap); its two legs play the hind legs; for the nap its legs are hidden under its body, as a roosting hen's are, and its head drops 10° further.
- **Tall species (horse, cow):** if the 1st's trophy at the top of the jump would come within 24 px of the bar (or the lowest bulb), lower that species' jump height. Never move the camera for it.
- **Horns, the cow's blanket, manes:** if a pose pushes one part through another, adjust only the part that collides, and list it in the pull request.

### 3.3 The 1st: `lbChampion` (trophy held overhead)

**Rest pose**

| Part | Rest |
|---|---|
| Whole avatar | Stands on its hind legs at the crate top's centre (X 0, Z −0.5 D), facing the camera (turn 0°) |
| Body | Upright: tip back 4° only (today about 15°) |
| Hind legs | Straight; each spread 6°, so the feet sit under the body's outer edges; feet flat on the top |
| Front legs | Both swing forward and up 160°, and turn in 12°, so the two front hooves meet above the centre of the head |
| Trophy | Held between the front hooves, upright, centred over the head; its base 0.06 H above the top of the hat |
| Head | Tip back 6°, turn 0°: the face stays fully visible |
| Ears | Spread 20° (perked up) |
| Hat | Its tip flops 25° toward screen right |
| Tail | Swing up 25° |

**Loop, 2.4 s**

| Time (s) | Motion | Ease |
|---|---|---|
| 0.00 to 0.16 | Crouch: the whole avatar drops 0.05 H; body scale Y 0.94, X and Z 1.03 | ease-in-out |
| 0.16 to 0.40 | Jump: rises 0.20 H above rest; the body stretches to scale Y 1.04 at the top; the front legs push the trophy 0.04 H higher | ease-out |
| 0.40 to 0.62 | Falls back to rest height | ease-in |
| 0.62 to 0.70 | Lands: body scale Y 0.93, X and Z 1.04; the hat's tip flops 15° further | — |
| 0.70 to 0.86 | Settles to the rest pose | ease-out |
| 0.86 to 1.36 | Trophy wiggle: the front legs and trophy roll 8° left and right, twice | sine |
| 1.36 to 2.40 | Rest, breathing: body scale Y 1.00 to 1.015 and back | sine |

### 3.4 The 2nd: `lbGoodSport` (applauding the winner, legs swinging)

**Rest pose**

| Part | Rest |
|---|---|
| Whole avatar | Sits on its rump on the crate's top, centred left to right, its hips 0.04 W behind the front edge; turned 10° toward screen right (toward the 1st) |
| Body | Upright: tip back 6°, lean 0° (today it leans back and right about 12°) |
| Hind legs | Swing forward 40°: they hang down and out over the front face without touching it (at least 0.01 m clear). Their hooves stay above the carved "2" with at least 0.03 W between them (at least 6 px at 1440 x 900) |
| Front legs | Swing forward 70° and turn in 20°: the hooves meet in front of the chest, level with the bottom of the chin |
| Head | Turn 12° further toward screen right; tip forward 4° |
| Ears | Rest |
| Hat | Its tip flops 20° toward screen left |
| Tail | Rest |

**Loop, 3.0 s**

| Time (s) | Motion | Ease |
|---|---|---|
| 0.00 to 0.60 | Two claps: the front legs spread 22° each and close, twice (0.3 s per clap, touching at 0.15 and 0.45). At each touch the body pulses to scale 1.02 for 0.06 s and the head nods forward 4° | ease-in-out |
| 0.00 to 3.00 | The hind legs swing 12° forward and back about their rest angle, opposite to each other, one full swing every 1.5 s. They never touch the front face | sine |
| 0.60 to 3.00 | The front hooves stay together; the head turns from 12° to 4° toward the 1st and back, as if looking up at the winner | sine |

### 3.5 The 3rd: `lbNap` (curled up asleep)

**Rest pose**

| Part | Rest |
|---|---|
| Whole avatar | Lies on its belly ("loaf"), facing the camera, turned 25° toward screen left (toward the 1st). Every part inside the top's edges with at least 0.03 W to spare |
| Body | Level; lowered until the belly rests on the top |
| Hind legs | Folded under the body: swing forward 90° and tucked up so they are hidden (the hooves may show up to 0.02 H at the sides) |
| Front legs | Swing forward 90° (lying flat, pointing at the camera) and turn in 15°, so the two front hooves lie side by side under the chin, 0.06 H in front of the chest |
| Head | Its chin rests on the front hooves (gap 0 ± 0.01 m): tip forward 18°, lean 10° toward screen right (a dozing tilt). The face stays visible: never twisted, never below the crate's top |
| Eyes | Closed. If the eyes are their own parts, scale each to 25% of its height, a thin line. If they are painted cells, change nothing and say so |
| Ears | Droop: swing down 30° |
| Hat | Slid over one eye: lean 28° toward screen left, its tip lying on the crate's top beside the head |
| Tail | Rest |
| The "z"s | Today's pixel "z"s, rising from a point 0.1 H above the head's top, on its right |

**Loop, 3.2 s**

| Time | Motion | Ease |
|---|---|---|
| 0.00 to 3.20 s | Breathing: body scale Y 1.00 to 1.035 and back; the head rises 0.012 H and falls with it | sine |
| Every 0.8 s | A new "z" appears. Each rises 0.28 H over 2.4 s, drifting 0.06 H toward screen right, growing from 60% to 100% of its size, fading in over its first 0.3 s and out over its last 0.6 s | linear |
| Once every third loop, at 1.6 s | One ear twitches up 15° and back, in 0.2 s | — |

## 4. The island

### 4.1 The snow top
1. **Remove the spikes.** Find what draws the rows of small grey notches (single cells, corner shading on one-cell bumps, or a texture) and remove it. No feature on the snow is smaller than one M cell.
2. **No stairs.** Replace the four terraces in front of the crates with a top that is level except for one step: one M cell (0.1 m) down, running parallel to the crates, 0.5 m in front of their front faces. Behind and beside the crates the top is level.
3. **Drifts**, stepped mounds of M cells in `snow`, their shaded sides one value step down (`snow−1`):
   - against the back and both sides of every crate: 2 cells high for 2 cells out, then 1 cell high for 2 more;
   - against the outer (left) side of the fence: 3 cells high at the posts, stepping down one cell every 2 cells out;
   - a ring round each pine's trunk: 2 cells high, 2 cells wide;
   - against the front of the hay bales: 2 cells high, 2 cells out.
4. **Wind ripples** on the open snow in front of the crates: three straight ridges, each one M cell high and one cell wide, in `snow+1`, with one cell of `snow−1` along their far side. They run at 30° to the crates' line, rising toward screen right, 0.6 m apart, 1.2 m, 1.8 m and 1.5 m long from left to right. Each stops 0.3 m short of the rim and of any crate. They make the snow read as shaped by wind, in a pattern, not as noise.
5. **Footprints** (open choice 2): one trail from the middle of the front rim to the foot of each crate. Each print is a dent one M cell square and one cell deep, `snow−1` at its bottom. Prints come in pairs, the two dents of a pair one cell apart sideways, pairs 2 cells apart along the trail. A trail turns by moving one cell sideways, at most once every 2 pairs. The three trails share their first 3 pairs from the rim, then split. Where a trail meets a ripple, the ripple breaks for one cell.

### 4.2 The rim and its layers
1. **Snow layer:** 0.2 m (2 M cells) thick at the edge. It overhangs the soil by one M cell all the way round, with a clean, straight lower edge.
2. **Icicles** under that overhang, made with `buildIcicles` (`PLAN_DEPTH_AND_LIGHT.md` Appendix F) at S cells. The lips are the bottom middles of the overhang's cells that have nothing under them. Only along the edge the camera sees.
3. **Soil**, with clean vertical faces: `soil`, 0.2 m, then `soil−1`, 0.3 m.
4. **Stones** in the `soil−1` layer: 2 x 2 M cells on the face, flush with it, alternately `stone` and `stone−1`, one every 0.8 m along the visible edge, alternately 0.1 m higher and lower.
5. **Roots** under each pine: two per pine, hanging from the bottom of the soil, one M cell thick, `darkWood−1`, 0.3 m and 0.5 m long, each moving one cell sideways halfway down.
6. **Result:** at 1440 x 900 no single-colour area on the rim is taller than 24 px.

### 4.3 The underside
1. **Bands:** `stone` and `stone−1` alternating, each 0.2 m thick.
2. **Shape:** each band is narrower than the one above by 0.5, 0.3, 0.4, 0.3 and 0.5 m per side, in that order, down to a tip under the 1st crate, 0.4 m left of its centre. A second, smaller lobe hangs under the 3rd crate, reaching 60% as deep. The total depth below the soil is 2.2 m.
3. **Floating rocks** (open choice 3): two stepped `stone` chunks, 0.4 m and 0.25 m across, hovering 0.4 m and 0.7 m under the main tip, one a little left and one a little right. They bob 0.04 m up and down over 4.0 s and 5.2 s (sine). With reduced motion, they are still.
4. **Framing:** at 1280 x 720 and 1440 x 900, the rim, the soil and at least the first two underside bands are on screen. If they are not, move the camera's target down. Do not change its angle or lens, and keep the 1st's trophy limit.

### 4.4 The props, rearranged
The crates and sheep now fill **66%** of the uncovered width (was 70%), so both side groups fit. Each side has a tall thing at the back and something low in front of it, so nothing hides anything else.

| Prop | Place (X, Z in W) | Size | Notes |
|---|---|---|---|
| Tall pine | −2.15, −1.0 | 1.8 m, as today | Its outermost cells at least 24 px from the screen's left edge, at 1280 x 720 and wider |
| Fence | Three posts 0.5 m apart, two rails; front post at −2.40, +0.55; back post at −2.00, −0.20 | 0.6 m tall | Snow caps on every post and rail; the drift of 4.1 on its outer side. Fully visible, in front of the pine's trunk |
| Small pine | +2.20, −1.0 | 1.4 m, as today | — |
| Hay bales | +2.00, −0.20 | Two bales, as today | The top one turned 20° and set half back; snow caps; a drift in front |
| Lantern post | +2.40, +0.60 | 1.0 m tall; the lantern about half today's size | Its light inside its lantern. On screen it covers at most a quarter of the bales and none of the 3rd's "z"s |

**Pine sway** (open choice 4): each pine sways 1.5° each way about the base of its trunk, every 5.0 s (left) and 6.2 s (right), sine. Only if the frame time stays within budget; off with reduced motion.

### 4.5 The distant islands
Three islands replace today's two. Place them in the world so that at 1440 x 900 each lands within 3% of the screen position given here.

| Island | On screen (centre) | Top width | On top | Distance |
|---|---|---|---|---|
| A | 12% across, 27% down | 2.6 m | Two pines (1.2 m and 0.9 m) and a small barn (1.0 x 0.8 m; `barnRed` walls, a snow roof) | 3 times the main island's |
| B | 57% across, 45% down | 1.8 m | One pine and a fence of two posts | 3 times |
| C | 50% across, 20% down (the empty sky right of the 1st sheep) | 1.2 m | Two small pines | 5 times |

- **Shape:** a flat, wide top; snow and soil together 0.15 of the top's width thick; the underside in three stepped bands narrowing to a blunt tip off the centre (the left side steps twice as fast as the right; mirrored on B). The whole island's height is about 0.6 of its top's width (today's are taller than wide).
- **Tones:** every colour mixed toward the sky's colour at that height, 55% for A and B and 70% for C. The pines stay a pale green (`pine` mixed the same way), never white. The barn's red is mixed the same way.
- **Motion:** each bobs 0.06 m up and down, every 7 s (A), 8.5 s (B) and 10 s (C), sine. Still with reduced motion.
- **Limits:** none is brighter than the main island's snow, and none overlaps a sheep, a crate or a plate on screen.

## 5. Checks, and what done means

1. Type check, all tests and the build pass.
2. **A pose test** for every species in every place, at rest and at every keyframe:
   - the weight-bearing parts touch the crate's top (0 ± 0.01 m) at rest and on landing;
   - no part passes the crate top's edges, except the ones section 3.1 allows;
   - the 2nd's hind legs stay out of the carved number's box and at least 0.01 m off the front face;
   - no part enters the name plate's box on screen.
3. **Screenshots in the pull request:**
   - every species in every place at rest, cropped to the stage (18 pictures);
   - six frames of each loop, for the sheep;
   - the whole screen at 390 x 844, 1280 x 720, 1440 x 900 and 1920 x 1080;
   - all next to the screenshot that came with this file.
4. The island is one connected piece (zero loose pieces in the scene check); no feature on the snow is smaller than one M cell.
5. No single-colour area on the rim is taller than 24 px at 1440 x 900.
6. Both pines, the fence, the bales and the lantern are fully on screen at 1280 x 720 and wider, and none hides more than a quarter of another.
7. Frame time is no worse than before, with the sway and bobbing included.

**Changes Brian did not ask for, to confirm in the pull request:**
- the three new poses replace today's;
- wind ripples, roots and icicles on the island;
- the small barn on island A, and a third distant island;
- the crates and sheep framed at 66% instead of 70%.

## 6. Open choices for Brian (the defaults are used unless he says otherwise)

1. **The 3rd place.**
   - Default: the nap of 3.5.
   - Other: sitting up with its front legs folded, turned away from the 1st in a sulk.
   - Other: standing and waving one front leg at the camera.
2. **Footprints in the snow.** Default: yes, as in 4.1. Other: none.
3. **Floating rocks under the island.** Default: yes, as in 4.3. Other: none.
4. **Pine sway.** Default: on, if it does not slow the game. Other: off.