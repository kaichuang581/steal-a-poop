# P4. The end of a run: the coach's report

`reference/practice-results-computer.png`, `practice-results-phone.png`. There is no results card. The chalkboard is the results.

## 1. What happens

1,100 ms after the bomb goes off:
1. **The camera cranes up and in to the board** over 700 ms (`P1` section 2: eye 2.7 to 4.8 m, A 210 to 420). The frozen sheep, the rack and the plates leave the bottom of the picture; the coach stays at the left.
2. The two cards lift off their hooks (200 ms), leaving the whole green face.
3. The board is wiped and the report is written in chalk, left to right, in 600 ms.
4. Your words are pinned up under the board, one slip every 30 ms.
5. 400 ms later the two buttons rise into place.
Any tap or key skips to the finished state.

## 2. The report, in chalk

Places are shares of the board's face (w wide, h tall), from its top left.

| Part | Where | Value |
|---|---|---|
| Title | 5% in, 7% down | Fraunces 800 at 15% of h. "Warm-up done" under 10 words; "Good session" at 10 or more (chalk white); "New best!" when the run beat your best for this bot and clock (lantern yellow `--lantern-hi`) |
| A chalk line | under the title, at 27% | from 5% to 95% of w |
| The count | 5% in, 27% down | Fraunces 800 at 40% of h, then "words" at 11% beside its foot |
| The whole run in tally marks | 5% in, 80% down | every word of the run in fives (23 is four fives and three) |
| Four facts | right-hand 40%, from 33% down, one every 10.5% | The name in dim chalk (Nunito 800), the value right-aligned (Fraunces 800): **Best** (after this run); **Clock** "15 to 11 s" (start to where you got); **Bot** "Easy"; **Rating** (the profile's own function: words × bot × clock) |
| The rosette | pinned to the top right corner, new best only | the rosette icon; it drops in from 40 px above with a small bounce (350 ms) |

## 3. Under the board

- "Your words" (Nunito 800 13, cream), then every word you played, in order, each on a small wool slip (22 high, Nunito 800 13, 6 apart), centred, wrapping. A computer shows two rows, a phone four; if there are more, the last slip is a lantern "+{n} more" that opens the word log.
- **Go again**: a lantern tile 320 x 48 (phones: full width less 28). Same bot and clock. Enter presses it.
- **Back to the farm**: a wool tile 320 x 40, 18 under it.
- Only if tonight's Counting Sheep is unplayed: a small cream tag under the buttons, the moon icon and "Tonight's dream is waiting", which goes there.

The four top-right tiles stay.

## 4. Example

23 words against the Easy bot from a 15 s clock, best before 21: "New best!" in yellow, the rosette, a big 23, four fives and three marks, Best 23, Clock 15 to 11 s, Bot Easy, Rating 23 (where Easy and 15 s each count × 1), then the 23 words on slips.

## 5. Checks

- Rating equals the profile's rating for the same run, for every bot and clock.
- Best equals the stored best after the run is saved.
- The Clock line's second number equals the clock card's last value.
- The number of tally marks equals the count.
