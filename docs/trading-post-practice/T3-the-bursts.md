# T3. The bursts

A burst is what plays when a bomb goes off. `reference/models-bursts.png` shows all ten at their fullest. The frozen sheep that follows is the game's own and is not changed here (`P3` restyles its ice block).

## 1. One timing, for all ten

| Time | What |
|---|---|
| 0 | The bomb is gone. One bright frame (at most 80 ms): every face of the bomb drawn in its spark colour. The camera shakes 6 px, fading over 220 ms |
| 0 to 300 ms | The pieces fly out from the bomb's middle (0.25 m up) to the places in the burst's table, easing out |
| 300 ms | The fullest moment: the picture, and the frame the Trading Post shows |
| 300 to 1,400 ms | The burst's own ending (the "then" column below); every piece is gone by 1,400 ms |

Rules: at most 24 pieces; at most three colours; pieces are built of the items' tiny 0.025 m cubes (`ITEMS_REMODEL.md`); **nothing is random** (every piece's place is in `data/bursts.json`); no smoke, no cloud, no blocky puff, no mark left on the ground. Reduced motion: the bright frame, then the fullest moment held for 400 ms and faded.

**Shown small in the Trading Post.** A burst on a display stand is drawn in: each piece's place moves to 42% of its distance from the burst's middle, but **every piece keeps its full size**. So a burst on the bench keeps the same tiny cubes as the bomb beside it, instead of a shrunken copy with cubes about 0.014 m wide, as before. `bursts.place(..., spread=0.42 × scale)`.

## 2. The ten

The pieces' shapes in cubes are in `ITEMS_REMODEL.md`, section 5; every place is in `data/bursts.json`.

| Burst | Colours | Out (0 to 300 ms) | Then (to 1,400 ms) |
|---|---|---|---|
| **Confetti** (20 slabs) | scarf red, coop yellow, gift green | Thrown up in a fan from 20° to 160°, 0.55 to 0.85 m out | Each tumbles end over end (so you see it square, then edge-on) and flutters down |
| **Snowfall** (16 flakes, 6 specks) | white, pale ice | Flakes to a ring, alternately 0.55 and 0.85 m out | Hang for a beat, then drift down, swaying 0.1 m side to side |
| **Hay** (18 straws) | hay, straw, dark hay | Kicked out low and wide, like a bale bursting | Each spins once and settles |
| **Lantern Glow** (12 lanterns) | lantern cream, lantern gold, iron | Lift off to twelve fixed places between 0.3 and 1.6 m up | Keep rising slowly with a sway, each with its own soft glow, and fade at the top |
| **Frost** (12 needles) | ice, pale ice, white tips | Shoot out every 30° and stop dead: a frozen star | Hold 300 ms, then snap into chips that drop |
| **Northern Lights** (3 curtains, 6 stars) | aurora green, teal, violet (all lit) | Rise from the spot, 0.5 to 1.2 m tall | Ripple left to right, then thin out upward |
| **Starlight** (12 stars with tails) | moon yellow, white (lit) | Shoot up into an arc 0.7 to 1.05 m out | Hang and twinkle twice, then fall as shooting stars |
| **Ember** (20 sparks) | pale orange, orange (lit), dark orange | Fountain up between 50° and 130° | Arc over and die out one by one |
| **Bubblegum** (3 bubbles, 6 bits) | pink, dark pink, white | The bubbles swell from nothing | Wobble, then pop one after another, 150 ms apart, each into four bits |
| **Solstice** (a sun, 12 rays) | sun gold, pale gold, orange (lit) | The sun rises to 0.85 m | Its rays push outward once, like a breath, and it sets |

Names, rarities and where each comes from (which seven are in the Corn Sack, which is the starter, Lantern Glow on the Bell Shelf, Starlight from 30 dream nights) are the catalogue's and do not change.

## 3. In the Trading Post

A burst cannot stand on a shelf, so it is shown as its fullest moment, frozen, over a small stand: a dark disc with a brass rim, 0.4 m across (`bursts.stand`). It is drawn in, not shrunk (section 1): on the bench each piece sits at 42% of its distance from the middle; on the Bell Shelf, where stand and spread are 1.6 times larger, at 67%. Every piece keeps its full size. Lit pieces keep their light. Pressing the item, or its Try tile, plays the whole burst once at that spread (1,400 ms). A not-found burst in the Barn Book is the same shape as a paper cut-out.

## 4. Loading them

`data/bursts.json` lists, per burst, every box of its fullest moment: corner x, y, z in metres from the bomb's spot on the ground, then width, height, depth, a colour key, and whether it gives light. Build each piece once and move the pieces by the "Out" and "Then" rules; do not replace them with a particle system that scatters cubes.
