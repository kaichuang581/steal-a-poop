# 07. The opening, the endings and the results board

See `reference/sketch-results.png`. Timings are in `data/timings.json` (`opening`, `endOutCold`, `endWoken`).

## 1. What is wrong today

| # | Problem | Seen on the screenshots |
|---|---|---|
| 1 | The opening is a black screen | 0.7 s of near-black before the dream |
| 2 | The transition matches nothing | The clouds that close the dream are smooth flat circles; the rest of the game is voxels and pixels |
| 3 | The results card is the old knitted paper | A red knit band, stitched charcoal, red woven buttons, a brass "Share" |
| 4 | It hides the farmer on phones | The card covers most of the bedroom |
| 5 | A broken pose | On the "woke up" screen, a striped arm crosses the farmer's beard |
| 6 | Unclear marks | The streak boxes are filled with orange "V" shapes |

## 2. The opening (1.2 s at most; any key skips it)

| Time (ms) | What |
|---|---|
| 0 to 200 | Home fades to the bed strip on a dark screen. The farmer is asleep (`bedSleep`). The candle dims by a fifth |
| 200 to 440 | The tail's three puffs pop up from his head, 80 apart |
| 440 to 860 | The dream window grows from the top puff: from nothing to 1.03 to 1. Stage 1's world is already running inside it |
| 860 | The ready board (file 02) |

If the scene is not built yet, the game's loading rule applies as today.

## 3. The endings

The smooth circle clouds are removed. The new endings may take at most 0.3 s longer than today's; measure both.

### 3.1 Out cold (after the last fence)

| Time (ms) | What |
|---|---|
| 0 | Every counted sheep streams across the moon (file 05, section 11). Five shooting stars, 120 apart. The card "Zzz…" / "He’s out cold". The farmer goes to `bedDeep` |
| 900 to 1400 | **The dream sinks into his head:** the dream window shrinks into the top puff. The puffs pop away one by one |
| 900 to 1600 | The bedroom's camera moves from `bedSide` to the results view. If that cannot be one move, cross-fade for 300 |
| 1600 | The results board slides in, in 240 |

### 3.2 Woken (a bump)

| Time (ms) | What |
|---|---|
| 0 | The bump (file 06) and `bedJolt` |
| 350 to 730 | **The dream pops.** The bubble's rim breaks into 14 pixel puffs that fly 60 to 140 px outward (the three puff frames, in order). The picture inside shrinks 6% and fades in 160. Your star words fall as loose dots and fade |
| 730 to 1400 | The camera moves to the results view. The farmer goes to `bedUpright` |
| 1400 | The results board slides in |

### 3.3 Practice
A practice run ends on a bump, as today, with the "woken" ending. Its board is the practice board (section 4.3).

## 4. The results board

The bedroom itself stays as it is: it is the best-looking part of the mode today. The farmer in it is the new farmer. The knitted card becomes a Board from the kit, with this mode's trim (file 02, section 2).

### 4.1 Layout

| Screen | Value |
|---|---|
| Desktop | Width 420, 24 from the right, centred top to bottom. The camera shifts so the bed and the farmer sit in the middle of the uncovered part. **The board never covers him** |
| Phones | A sheet at the bottom, at most 60% of the height, scrolling inside. The farmer's head and the bed fill the part above it |

### 4.2 The board, from the top

Padding 20 at the sides. 16 between parts.

| # | Part | Value |
|---|---|---|
| 1 | **Trim** | The quilt band along the top edge, 10 high, with the blanket-stitch ticks under it. No snow cap |
| 2 | **Title** | The kit's title ribbon (leaderboard 7.2): `lantern`, overhanging the board's left edge by 9 with its fold, its right end a stepped V. In it: "The farmer drifted off", "The farmer woke up!" or "Practice dream", in Fraunces 800, 20, `--ink` |
| 3 | **The count** | On **the nightshirt pocket**, 100 x 88: the number in Fraunces 800, 44, `--ink`, and "sheep" under it in Nunito 800, 12, `#4A4258`. The number counts up from 0 in 600 ms. Beside it, today's facts, one to a line, in Nunito 800, 12.5, `--wool`: "Asleep after 30 fences", "No bumps", "Longest word: 5 letters" |
| 4 | **Your night sky** | Not shown when no word was typed. The label "Your night sky" in Nunito 800, 11.5, `--frost`. Under it a Well, 96 high, the full width: the sky of the stage the night reached, with its moon, and **every word of the night in stars**, laid out as in file 06 at this size (dots 2 x 2, 3 apart). Words fade in one after another, 40 ms apart |
| 5 | **Streak** (not in practice) | A raised card. "9-night streak" in Fraunces 800, 17, `--wool`; "best 9" at the right in Nunito 800, 11.5, `--frost`. Under it, the seven places toward the next Warm Blanket, as squares 24 x 24, 6 apart: earned ones `lantern` with the pixel check; tonight's with the orange ring; the rest sunk. Then the blanket line (file 08, wording) in Nunito 700, 11.5, `--frost` |
| 6 | **Coins** (when any were earned) | A raised card. The coin from Home's purse (18), then "+50 Wool Coins" in Fraunces 800, 17, `--wool`. Then each row in Nunito 800, 12.5: its words in `--frost`, its amount right-aligned in `--wool`, in figures of equal width. The rows fade in one after another, 80 ms apart |
| 7 | **Buttons** | As today, in the same order, 44 high, 4 apart: Share (`lantern`; it holds the focus when the board opens, as today), Practice (`wool`), Back to the farm (`wool`). On phones Share has its own row |
| 8 | **Foot** | The return line (file 08, wording) in Nunito 800, 11.5, `--frost` |

### 4.3 The three boards

| Board | Parts shown |
|---|---|
| Drifted off | All eight |
| Woke up | All eight. Coins only if any were earned. The night sky shows the stage that was reached, and its last word is where the night stopped |
| Practice | 1, 2, 3, 4, 7. In place of the streak: one line, "Practice dreams don’t count toward your streak.", in Nunito 800, 12.5, `--frost` |

### 4.4 The farmer on the results screen

| Ending | Pose | Around him |
|---|---|---|
| Drifted off | `bedDeep` | Large "z"s (4 px an art pixel) rise from him, one every 0.45 s |
| Woke up | `bedUpright` | An "!" over his head for the first second. His cap leans. Both hands are on the quilt. Nothing crosses his beard |
| Practice | As the ending that happened | |

When `FESTIVE` is true, the bedroom keeps its stocking and garland. The farmer's cap is his own in every season.
