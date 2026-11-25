# 07. The gates, the loop and the moon show

See `reference/gate-1-the-farm-gate.png`, `gate-2-the-foot-of-the-bed.png` and `moon-show.png`. Every time below is also in `data/timings.json`.

## 1. Why the gates changed shape

The build's gates are flat goal posts drawn facing the viewer. In a real side view an arch across the track is seen edge-on and almost vanishes. So each gate is now a thing that reads **from the side**:

| Gate | Opens | What it is | Its original |
|---|---|---|---|
| 1 | World 2 | `gateFarm`: a small roofed farm gate, 3.6 m long, that the sheep runs **through**. Four posts, a snowy roof, two lanterns, and under the near beam a hanging board with a sheep cut in it | Home's gate arch over the lane, with its sheep board |
| 2 | World 3 | `gateFootboard`: the foot of his bed, 7 m long and 4.6 m tall, standing **along** the far side of the track. Two posts with balls, a carved board between them, his stocking on the left post | The footboard of his bed, in the strip |
| 3 | World 1 again (from lap 2) | `gateHeadboard`: the head of his bed, the same but 5.6 m tall, with the garland of bulbs along its rail | The headboard of his bed, with its stocking and garland, in the strip |

So the story reads: out through the farm gate, in at the foot of the bed, along the bed, out at its head, and back to the farm.

## 2. Where a gate stands

| | Gate 1 | Gates 2 and 3 |
|---|---|---|
| x | Its middle 3.0 m before the first fence of the world it opens | Its left post 3.0 m before that fence |
| z | 0: it stands over the track. The near posts are at z 1.4 to 1.7, the far posts at z −1.7 to −1.4; the track is 2.4 m wide between them | −1.9: just behind the track's far bank. The sheep runs in front of it |
| y | 0 | Gate 2 stands in world 2, where there is no ground: put two `islandYard` models end to end under it (12 m by 3.4 m), their tops at y 0 and their middles at z −2.9, so they touch the track's far edge. Gate 3 stands on world 3's lining, at y 0.1 |

No fence stands within 2.4 m of a gate's middle. A gate is scenery: it has no rules box.

In gate 1 the near posts pass between the camera and the sheep for a moment. That is wanted: it is the clearest sign of depth in the whole run.

## 3. The three changes of world

Each begins at the moment named and runs by itself. The game never waits for it: the next fence comes when the rules say. Build the next world's meshes before the gate (file 02, section 6).

### 3.1 Gate 1: lift-off (1.4 s; begins when the sheep passes the gate's middle)

| At (ms) | For (ms) | What happens |
|---|---|---|
| 0 | 900 | Every ground mesh of world 1 sinks 9 m, slow at first then fast: the snow, the banks, the ripples, the wall, the mill's hill, the far hills, the pond and the small things on the snow |
| 0 | 500 | Under every track bay its underside grows down from the snow top (soil, stone teeth, icicles, roots): scaled in y from 0 to 1, pinned at the top |
| 0 | 600 | The fence's posts and rails fall 6 m and turn 40 degrees. **The string of bulbs stays** |
| 100 | 300 | Under each building and tree an island grows down in the same way. Row B2 first, row B3 100 ms later, row B4 200 ms later |
| 400 | 600 | Each island moves from the ground's level to its world 2 height, overshooting by a tenth and settling |
| 400 | 1,000 | The sheets of the northern light rise one after another from left to right, 16 ms apart, each over 300 ms |
| 450 | | The snow turns and begins to rise |
| 300 | 600 | The moon fills from a crescent to a full disc, one column of its cells every 40 ms |
| 0 | 1,200 | The sky's colours, the haze and the lights go evenly from world 1's to world 2's |

The ring of light the build sends across the dream at this moment stays.

### 3.2 Gate 2: tucked in (1.6 s; begins when the sheep passes the footboard's first post)

| At (ms) | For (ms) | What happens |
|---|---|---|
| 0 | 1,300 | A wave runs along the lane from the footboard at 16 m a second. Where it passes, each track bay changes from `laneBayFloat` to its `laneBayBed`, the new bay rising 0.3 m into place over 120 ms |
| 0 | 1,300 | Behind the same wave the lining slides in from the back, and each quilt square pops up (scaled in y: 0, then 1.15, then 1, over 220 ms). The rows nearest the track come first, each row 40 ms after the one before |
| 0 | 900 | Every island sinks 12 m and is removed |
| 0 | 500 | The sheets of the northern light shrink upward and fade |
| 450 | | The snow stops. Feathers begin to fall |
| 600 | 800 | The buttons drop down their threads to their places, one every 60 ms, each with one small bounce |
| 800 | 600 | The candle rises from behind the far folds |
| 0 | 1,200 | Sky, haze and lights go from world 2's to world 3's. The moon grows from 128 to 190 px across |

### 3.3 Gate 3: he turns over (1.4 s; begins when the sheep passes the headboard's second post)

| At (ms) | For (ms) | What happens |
|---|---|---|
| 0 | 1,100 | A wave runs along the lane at 16 m a second. Where it passes, each track bay changes back to world 1's snowy track, and the quilt squares drop flat (scaled in y from 1 to 0 over 180 ms) |
| 200 | 900 | World 1's ground rises 9 m into place with its fence, its wall and its farm |
| 0 | 600 | The buttons are pulled up their threads. The candle sinks behind the far folds |
| 0 | 1,200 | Sky, haze and lights go from world 3's to world 1's. The moon shrinks from 190 to 96 px and its right side empties to a crescent |
| 0 | 900 | In the bed strip the farmer rolls onto his other side and back, once (file 09, section 2) |

### 3.4 The cards

One card at each gate, the build's own card component, at the top centre under the top bar (file 08, section 4).

| Gate | First lap | Later laps |
|---|---|---|
| 1 | "Dreaming…" / "Two letters now" (the island icon) | "Dreaming…" / "The farm lifts off" |
| 2 | "Deep dream" / "Three letters now" (the yarn ball icon) | "Deep dream" / "Under the quilt" |
| 3 | (it does not come on the first lap) | "He turns over" / "Back to the farm" (the "z" icon) |

### 3.5 With reduced motion

Each change of world is a cut inside a 200 ms fade of the dream window. The card still shows.

## 4. Safety at a gate

- Nothing flashes. The window's average brightness may not change by more than 8% from one frame to the next, and may not reverse more than three times a second (version 2's flash test stays).
- Nothing at a gate ever hides the next fence's sign.

## 5. The moon show

It replaces the old finale. It comes **every 10 sheep**, for as long as the night lasts, in whatever world the sheep is in.

*An example.* You count your 20th sheep. The moon swells. Ten small dark sheep hop across it from left to right, one after another, in time with the beat. Then the moon shrinks back. Nothing else stops: the next fence is already coming.

| Part | Rule |
|---|---|
| When | The count reaches 10, 20, 30, and every further 10 |
| How long | 8 beats of the world's own beat |
| Beats 0 to 2 | The moon grows to 1.6 times its size in that world (96, 128 or 190 px across), fast then slow. In world 1 the crescent also fills to a full disc |
| Beats 1 to 7 | Ten sheep hop across it, one starting every half beat from beat 1. Each crossing takes 1.5 beats: from the moon's left edge to its right in one flat arc, rising by a fifth of the moon's width in the middle. The last one lands at beat 7 |
| The sheep | **The game's own sheep model**, hung at the moon's distance and drawn unlit in `ink 0` (a dark shape; never shorn, never changed). Each is a fifth of the moon's width long. They belong to the sky: they do not move with the lane |
| Beats 7 to 8 | The moon returns to its size (and, in world 1, to a crescent) |
| The count | That sheep's number pops up in gold at 1.6 times the usual size |
| A card | None. The moon is the message |
| If a gate comes during it | The moon show finishes at the size of the world that is arriving |
| Reduced motion | No moon show. The count still pops up in gold |
| Cost | At most three or four of the sheep's mesh on the moon at once; nothing else |

The picture `moon-show.png` uses a stand-in sheep; the game uses its own.

## 6. Checks for this file

1. Clips of each gate and of one moon show in each world, at 1440 x 900 and 390 x 844, and the same with reduced motion.
2. The flash test on each of those clips (section 4).
3. A frame from each gate's middle: no mesh of the old world is left standing still on screen, and nothing of the new world is missing.
4. Frame time during each gate stays within file 02's limit.
5. The recorded night gives the same record: a gate and a moon show change no time, no speed and no fence.
