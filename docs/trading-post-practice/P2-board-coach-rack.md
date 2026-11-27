# P2. The chalkboard, the coach and the tile rack

These three things carry everything the old corner box, signpost, message bars and typing line used to carry.

## 1. The chalkboard

A green school chalkboard (`pine −2`) in a barn-red frame, 2.4 x 1.2 m, under a small snowy roof, with a chalk ledge, a stick of chalk and a duster. Two paper cards hang on brass hooks. The game writes on the board and cards with textures that are redrawn only when a value changes. Places are in cells of 0.05 m on the board's front.

| Where | Cells | Shows | Drawn as |
|---|---|---|---|
| The count, on the green | x −23 to −8, y 30 to 54 | How many words you have played | Chalk `#F3EEE6`, Fraunces 800 at 36% of the board's height. Under it, **tally marks** for the words since the last speed-up: upright strokes 18% of the height tall, the fifth across the four. Under them "−1 s at 5" (Fraunces 800, 8.5%) and "best 21" in dimmer chalk `#DCE8E0` (Nunito 800, 7.5%). On phones only the number and the marks |
| The letter card | x −6 to 6, y 34 to 50 | The letter your word must use | `trimWhite 2` card; the letter in ink, Fraunces 800 at 72% of the card; a hinge line across its middle |
| The clock card | x 12 to 22, y 37 to 47 | The turn length | The number at 50% of the card, then a small "s"; ink, or `scarfRed −2` for 1.2 s after it changes |

**Example.** 13 words, a 15 s start, a second off every 5 words: the count reads 13, there are three tally marks (13 − 10), and the clock card reads 13 s.

When the clock is at its shortest, "−1 s at 5" becomes "fastest" and no more marks are drawn. Read the step, the start and any minimum from the code.

**Flip cards.** A card's value changes by a flip: the top half folds down over 100 ms, the new top half unfolds over 100 ms.

**Countdown.** Before the first turn the letter card flips 3, 2, 1, then the letter, 600 ms apart; the first turn starts as the letter lands. (Only if today's start has no countdown; see the choices in `X2`.)

## 2. The coach

The game's own sheepdog, on an umpire's high chair beside the board, with a brass whistle on a red cord. Its model and idle are Brian's and are not changed; the chair, the whistle and these moments are added.

| When | The coach |
|---|---|
| The run starts | Blows the whistle (it rises to the mouth over 150 ms, holds 300 ms, drops; three chalk-white cubes puff from its end). Says "Best 21. Beat it!" (or "First run. Go!" with no best) |
| Your word is not accepted | Says why (`P3` section 5) |
| Every speed-up | Blows; says "Faster! 12 s a turn"; turns its head to the clock card for 400 ms |
| Your count passes your best | Says "New best!" |
| You hold the bomb with 3 s or less | Leans forward 6° |
| The bomb goes off | Blows twice, 250 ms apart |
| Otherwise | Home's sheepdog idle at 0.6× speed |

**The coach's bubble** is the only message surface in Practice. Wool-white with a one-step ink outline and stepped corners; a title in Fraunces 800 18 and, when needed, one more line in Nunito 800 12. On a computer it sits to the left of the dog with its tail pointing right; on phones above the dog with its tail pointing down, kept 10 px inside the screen. It shows for 2.4 s; a new message replaces the old one at once.

## 3. The tile rack

A cream shelf with a lip, 2.3 m long, on the outside of the middle bay of the front boards. **The word you type stands on it as letter tiles**, the same tiles as the FLEECED logo.

| Part | Value |
|---|---|
| Tiles | 0.15 m square (43 px at 1440 x 900), 0.165 m apart, the first at x −1.02 m, standing on the shelf (y 0.15, z 2.47). Draw them as interface tiles at those projected places |
| The first tile | The letter, in lantern, already there. It cannot be deleted |
| Typed tiles | Wool, the letter in ink (Fraunces 800 at 66% of the tile). Each new tile drops 6 px onto the shelf in 80 ms |
| The caret | A lantern underline and a blinking bar where the next tile will stand |
| Long words | 13 tiles fit between the posts. Past that, the gap between tiles shrinks so the word always fits |
| Pass | A lantern tile 112 x 38 on the next bay to the right, the return-key icon and "Pass". Pale and not pressable while the bot holds the bomb. Enter does the same |
| Typing | A real, hidden text field keeps focus; the tiles mirror it |
| Phones | The 3D boards are too small for tiles a finger can read, so the rack is drawn as a strip across the screen just above the keyboard: the same cream shelf and lip, 32 px tiles, Pass at its right end. The scene is laid out in the height left above it |
