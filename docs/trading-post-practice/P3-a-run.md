# P3. A run: everything on screen, and every effect

Times are in `data/timings.json`. Nothing here is random, and nothing leaves a mark on the ice.

## 1. What is on screen

`reference/practice-run-computer.png`.

| Thing | Where | Look |
|---|---|---|
| The count, letter and turn length | On the chalkboard (`P2`) | Chalk and cards |
| Name plates | Over each sheep's head, 0.55 m toward the middle line, 1.5 m up | Yours: a lantern tile, 24 high, your name in Fraunces 800 14. The bot's: a wool tile, the name, a thin divider, its level icon and word ("Easy") |
| The bubble | 40 px above a plate | Wool-white, the word a sheep just played, Fraunces 800 17. It stays 1.2 s after the turn passes. While the bot thinks: three dots that fill one by one. On phones it takes the plate's place for that time |
| Your word | The tile rack (`P2`) | Tiles |
| The coach's bubble | By the coach (`P2`) | — |
| Four tiles, top right | 16 from the edges, 38 x 34, 8 apart | Wool tiles with ink icons: how Practice works, the word log, sound, leave. Same jobs as today |
| The bot's bib | On the bot | A knitted tabard: `giftGreen` with a sprout (easy), `coopYellow` with a sapling (medium), `scarfRed` with a pine (hard). Panels cover 29% to 71% of the body's length and the top half of its height; never the face, hat or legs |

There is no corner box, no "VS" bar, no dot on the plates, no "starts with", no "Enter to play".

## 2. The bomb

The skin you wear (`T2`), 0.5 m, sitting by whoever holds it. Its face shows the holder's seconds. Its fuse burns down piece by piece and is whole again at each new turn.

## 3. A word is accepted

1. The bubble shows the word.
2. The bomb hops to the other sheep: 420 ms, peaking 0.9 m up at halfway, turning once so its face ends toward the camera.
3. It lands with a squash (1.12 wide, 0.88 tall, 120 ms). Six ice chips (0.05 m, `ice 2`) spring from under it, at x −0.5, −0.32, −0.15, 0.15, 0.32, 0.5 m, peaking 0.10, 0.22, 0.30, 0.30, 0.22, 0.10 m up, and are gone in 380 ms.
4. If it was your word: the chalk number is rubbed out and rewritten (160 ms), and one tally mark is drawn, top to bottom, in 180 ms. The typed tiles lift off the rack and are gone; the letter card flips to the next letter and the rack's first tile changes with it.

## 4. The speed-up

On the frame your fifth word (or whatever the code's step is) is accepted: the coach blows; the clock card flips to the new length and stays red for 1.2 s; the five tally marks are wiped left to right in 250 ms; the coach says "Faster! 12 s a turn", and the first time each session adds "Every 5 words, a second comes off." `reference/practice-speed-up.png`.

## 5. A word is not accepted

The tiles shake sideways 6, −6, 4, −4, 2, 0 px over 300 ms and turn ember for 600 ms; the locked first tile stays lantern. The letters stay so you can fix them. The bomb keeps burning. The coach says why. Take every reason the code has and give each one a line:

| Reason | The coach says | Second line |
|---|---|---|
| Already played this run | "Already played!" | "{You / name} played {word} this run. Another {L} word." |
| Not in the word list | "Not a word!" | "{word} is not in our list." |
| Breaks the letter rule | "Needs {L}!" | The code's own rule text |

`reference/practice-danger-and-a-wrong-word.png`.

## 6. The last 3 seconds

The seconds on the bomb's face take the skin's danger colour; the bomb wobbles ±1.5°, four times a second; its spark grows to 1.6×; today's tick sounds every 500 ms; if it is yours, the coach leans forward.

## 7. The bomb goes off

| Time | What |
|---|---|
| 0 | The worn burst plays (`T3`) where the bomb stood. The coach blows twice. The letter card flips to "OUT" in red |
| 0 to 260 ms | **The holder is frozen, as today.** The ice grows from its hooves upward |
| 1,100 ms | The report begins (`P4`) |

**The ice block**, remodelled (`iceBlock`): fitted to the sheep with a margin of five voxels (1.5 x 1.6 x 0.9 m), clear (faces drawn as glass at 22% of `ice 0`, so the sheep and its face stay plain to see), frost on its twelve edges and four front corners, a snow cap, three icicles on the front top edge. The sheep inside is whole, in its hat and wool.

`reference/practice-the-bomb-goes-off.png` shows this with the Snowfall burst.

## 8. Reduced motion

No hop (the bomb fades across in 150 ms), no squash, wobble or shake, no flips (values change at once), no flying chips; the burst follows `T3`'s rule; the ice block appears whole. The coach's bubbles and the whistle stay.
