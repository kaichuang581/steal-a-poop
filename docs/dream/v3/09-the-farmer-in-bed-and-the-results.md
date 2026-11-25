# 09. The farmer in his bed, and the results board

The farmer's model does not change: it matched Brian's sheet (0.914 on the front, 0.905 on the back; the pass mark is 0.88). What changes is **how he lies**, **how the strip looks at him**, his quilt, and the results board.

Nothing in sections 1 to 3 could be tested by picture for this plan, because it needs the game's own bedroom. Build it, look at it, and show Brian the strip at the stop.

## 1. Why he looks wrong today

The strip's camera looks at the bed exactly from the side. A man lying on his back, seen exactly from the side, shows only an ear. So the build turned his head most of the way toward the viewer, and now it reads as a head lying on a pillow by itself: no neck, no shoulder, and a flat quilt with no body under it (`reference/build-today/tail-and-snore-3x.jpg`).

The fix is the same as in the dream: **raise the camera and look down a little.** Then his face, his shoulders, his arm and the quilt's top are all seen naturally.

## 2. The strip's camera, and how he lies

| Part | Today | Now |
|---|---|---|
| The camera `bedSide` | 0.35 m above the mattress, looking level at the bed's long side | **1.1 m above the mattress's top, looking down 18 degrees**, from the same side and the same distance. Field of view 20 degrees, as today. Frame it so the headboard's outer edge is 24 px from the strip's left and the whole bed, the nightstand and the basket are in the bed zone |
| His head (`bedSleep`) | Turned about 80 degrees toward the viewer | Turned **35 degrees** toward the viewer, chin lifted 10 degrees. The back of his head rests in the pillow's middle. His cap's tail lies on the pillow toward the headboard, as today |
| His neck and shoulders | Hidden under the quilt | **Out of the quilt.** The quilt's top edge lies across his chest at the armpits: his collar, both shoulders and the first two stripes of his nightshirt show |
| The turned-down sheet | None | A band of sheet 0.12 m wide across the quilt's top edge, `trimWhite +2`, with red blanket stitch (`scarfRed 0`, one stitch every 0.06 m): the same sheet and stitch the sheep runs on in world 3 |
| His near arm | A straight plank on the quilt | On the quilt, **bent**: the upper arm along his side, the forearm across his body at 80 degrees, the hand resting on his chest |
| His far arm | Under the quilt | Under the quilt, as today |
| `bedDeep` (from 30 sheep on) | The near arm hangs off the bed | As today, with the head now at 35 degrees and rolled back 8 degrees, the mouth open |
| `bedStir`, `bedJolt`, `bedUpright` | | As today, starting from the new `bedSleep` |
| **`bedTurn`** (new; gate 3) | | Over 900 ms he rolls from his back onto his far side and back: the body turns 40 degrees away about its long line and returns; the near arm slides to his side and returns; his eyes stay closed. Used once, at gate 3 (file 07) |

## 3. His bed's things

| Thing | Today | Now |
|---|---|---|
| **The quilt's shape** | One flat slab | It lies **over his body** in steps: above the mattress's top by 0.10 m over his feet (with the two toes' bump 0.16 m), 0.06 m over his shins, 0.08 m over his knees, 0.10 m over his belly, 0.08 m over his chest. Each step runs the bed's full width less 0.1 m at each side, where the quilt falls to the mattress and hangs 0.25 m down the bed's near side |
| **The quilt's squares** | Four big blocks in invented colours | Squares of 0.2 m in the quilt's rule (file 03, section 5): every second one cream, the others `scarfRed`, `coopYellow`, `giftGreen`, `slate` in turn. Each square is one flat colour. It is the same quilt as world 3's |
| **The knitting basket** | Shows yarn | It must show all three things the dream uses: the ball of red yarn (`scarfRed 0`), **two knitting needles** standing crossed (`brass 0` with cream knobs), and **one spool of mauve thread** (`slate 0` on a `wood +1` spool) |
| The five books, the candle, the alarm clock, his stocking and the garland on the headboard | | As built. Each is the original of something in world 3 or of a gate, so none may be hidden by the tray on screens 1280 wide or more |
| The candle's flicker | To the beat in stage 3 | With world 3's candle (file 06, section 7), whenever the dream is in world 3 |

**The strip's light** stays as version 2 set it: its average brightness at or under 0.22 so the dream is the bright thing, and his face at 0.45 or more.

## 4. The results board

See `reference/build-today/results-2x.jpg` for today's board. Its frame, ribbon, pocket, streak card, coins card and buttons stay. These parts change:

| Part | Today | Now |
|---|---|---|
| The quilt band | Dashes | File 08, section 11, 10 px high, with the blanket stitch under it as today |
| **The count and the best** | The pocket with the count; beside it two lines of text and a wide empty space | Two tiles side by side, 12 px apart, each 108 wide and 96 high. Left: the nightshirt pocket with the count, as today ("32" in Fraunces 800, 40; "sheep" under it). Right: a `--night-2` Tile with a lit top row: "Best" in Nunito 800, 12, `--frost`, and the best in Fraunces 800, 32, `--wool-hi`. **On a new best** the right tile's face is `--lantern`, its text `--ink`, and it reads "New best" over the number |
| The facts | "Fence 4 of 30", "Longest word: 7 letters" | To the right of the tiles, one to a line, Nunito 800, 14, `--wool`: "Longest word: 7 letters"; on a night that passed 30, "Fast asleep from sheep 30"; and "Moon shows: 3" when there was at least one. "Fence 4 of 30" is removed |
| **"Your night sky"** | Your words in dotted star letters on a violet box | A Well in two parts. **Above,** a strip 44 px high in world 1's sky colours (`#0E1834` to `#2D406B`) with the small moon at its right and **one `star-plus` for each sheep you counted** (at 2 px, `--frost`; at most 60 drawn, in the places file 08, section 9 gives, scaled to the strip). **Below,** your words in Nunito 800, 13, `--wool`, 10 px apart, wrapped to at most three lines, newest last. Your longest word comes first, as `wool` letter tiles of 16 px, the way the profile shows a longest word. If the words do not fit: "+12 more" in `--frost` |
| The streak card's right corner | "best 1" | "Longest: 1" |
| The foot line | | As built |

**Phones:** the two tiles stay side by side at 96 wide; the facts go under them; the word list is at most two lines.

**The board's title** stays: "The farmer woke up!" or "The farmer drifted off".

## 5. Checks for this file

1. The strip at 1440 x 900 and at 390 x 844 in each pose, beside today's: `bedSleep`, `bedDeep`, `bedStir`, `bedJolt`, `bedUpright`, and three frames of `bedTurn`.
2. In `bedSleep` and `bedDeep`: his neck, both shoulders and at least two stripes of his nightshirt are visible; no part of his head passes through the pillow; his hand rests on the quilt, not in it.
3. The farmer's match test still passes unchanged (the model is not touched).
4. The originals: the quilt, the pillow, the candle, the alarm clock, the five books, the basket with its yarn, needles and spool, his stocking and the garland are all visible in the strip at 1280 wide.
5. The results board in four states, beside today's: woke up with no best yet; woke up under the best; a new best; drifted off past 30 with moon shows. No "of 30" anywhere.
6. The kit's surface test passes on the board; the buttons are at least 44 high.
