# T6. Stops 2 to 4, and looking closely at one item

## 1. Stop 2: the Bell Shelf

`reference/trading-post-2-bell-shelf.png`.

- **The stand.** Green and cream awning with the sign "Bell Shelf". Two cloth-covered steps: the lower at 0.95 m, the upper at 1.65 m. The big brass bell (0.8 m across) hangs from a bracket on the left front post.
- **Items** stand on the lower step, evenly spaced, at most four; a fifth and later ones go to the upper step. Today there are two: the Brass Bell skin and the Lantern Glow burst.
- **Under each item:**
  1. a brass price tag on yarn (60 x 26, face `#F2CE7C`): the bell icon and the price, Fraunces 800 16;
  2. a paper tag 160 x 50: the name (Fraunces 800 16) and its kind, "Bomb skin" or "Burst" (Nunito 800 11);
  3. one tile, 160 x 36. If you have enough Bells: "Buy" (lantern). If not: "{n} more Bells" (pale, not pressable). If owned: "Wear it", or "Wearing" in green with the tick and no tile.
- **Buying:** the Bells leave the wallet, the big bell swings twice with today's bell sound, the item hops 0.15 m, and its tile becomes "Wear it". No reveal, because nothing here is random.
- **One small tag** on the upper step: "More on the way". No empty pegs.
- **One paper note** under the stand, 660 x 50, with the bell icon: "Golden Bells: +5 every level, +10 every milestone, +20 every 7 dream nights." and "Bells buy only what is on this shelf." Read the three numbers from the code.

## 2. Stop 3: Missions

`reference/trading-post-3-missions.png`.

A cork board (3.4 x 2.3 m) in a barn-red frame under a small roof. Brass pins hold four pieces of paper. The board model has the paper and pins; the game draws the words on them.

**Three mission slips** across the top, each 1.0 x 0.75 m (about 210 x 160 px):
- a picture of the reward, 68 x 68, rendered from its model (bursts on a dark `iron −1` square, the others on paper);
- the reward's name (Fraunces 800 19) and kind (Nunito 800 12);
- the goal in one line (Nunito 800 12), as today: "Count sheep 7 nights in a row";
- progress. **7 or fewer: one stamp box per night**, filled red with a tick as each is done. **More than 7: a knitted row** (file `T7`);
- "3 / 7" at the lower right, Fraunces 800 15.

A finished mission: a round red "Done" stamp across the picture, the slip moves to the right end, and a "Wear it" tile sits under it. When a mission completes while the player is elsewhere, the Missions tab's tag carries a small red dot until it is visited.

**The milestone sheet** under them, 3.1 x 1.15 m: "Milestones" (Fraunces 800 20) and "Different words played at the table. Each pays once." Then one ruled row per milestone, in today's order:

| Column | From the left | What |
|---|---|---|
| Goal | 16 px in | "50 different words", Nunito 800 13 |
| Progress | 42% to 64% of the sheet's width | a knitted row |
| Count | right-aligned at 79% | "12 / 50", Fraunces 800 14 |
| Coins | at 81.5% | the coin icon and "+25" |
| Bells | at 91.5% | the bell icon and "+10" |

A paid milestone: its row's text turns soft grey and the tick replaces the knitted row.

**One paper note** under the board: "Missions are earned by playing, never found in a sack. Each one is yours for good."

## 3. Stop 4: the Barn Book

`reference/trading-post-4-barn-book.png`.

A book 3.7 m wide and 2.4 m tall stands open on a low table: a barn-red cover, two cream pages. On each page, small ledges; every item of one kind stands on its own ledge.

- **Three bookmarks** stick out of the top edge: Bomb skins, Bursts, Fuse sounds (paper tags 140 x 32; the open one is lantern). Pressing one turns the page (350 ms): the items fold flat, the page turns, the new items pop up 30 ms apart.
- **Page heads.** Left page: the kind (Fraunces 800 22) and "3 of 8 found". Right page, right-aligned: "3 of 26 found" for the whole book.
- **Ledges.** Eight items: two columns and two rows on each page. Ten items: three columns, five to a page (three above, two below, centred). Ledge places are in `data/market.json` (`book_pockets_cells`).
- **A found item** stands on its ledge as its real model at 80% size.
- **A not-found item** is a flat paper cut-out of its own shape (every box drawn in `trimWhite −2`, unshaded): you can see what is missing, and nothing looks greyed-out or locked.
- **Under each ledge:** the name (Fraunces 800 15); the rarity square and word (Nunito 800 11); then one line: "Wearing" or "Found. Wear it" in green with the tick, or where it comes from with the small lock: "In the Oat Sack", "30 Bells, Bell Shelf", "Mission: 7 dream nights". Take these from the catalogue's own fields.
- Pressing any item opens the close view.

Removed: the All / Found / Not found chips (a spread shows a whole kind at once), and "NOT FOUND YET".

## 4. Looking closely at one item

Pressing an item anywhere brings it close. The camera pushes in (A × 2.2, 300 ms) and the rest of the stop dims to 60%. The item stands on the nearest surface on a small turning stand, turning once every 8 s.

A paper tag hangs beside it (260 wide):
- the name (Fraunces 800 22), its kind and rarity;
- its one line (for bombs: the lines in `T2`);
- where it comes from, if not found;
- tiles: "Wear it" / "Wearing"; for a burst, "Try it" (plays it once); for a fuse sound, "Listen"; for a bomb, "See it lit" (the face counts down from 10 to 0 with the fuse burning, once).
Pressing outside, or Escape, steps back.

## 5. Phones

Each stop is the band at the top, then one paper roll:
- **Bell Shelf:** one row per item (the price tag, the name, the kind, the tile), then the note.
- **Missions:** the three slips stacked full width, then the milestone rows (the goal on one line; the knitted row, count and rewards on the next).
- **Barn Book:** the camera frames one page (A = 0.5 × W); swipe or the bookmarks turn pages; names sit under the ledges as on a computer.
