# 08. The interface

See `reference/whole-screen.png` (the whole screen), `world-2-the-farm-lifts-off.png` (a card), `moon-show.png` (the "New best" tab and a gold count), and the close-ups of today's build in `reference/build-today/`.

Sizes are px at `--u` = 1 on a 1440 x 900 screen. The interface kit is the one already built (`PLAN_HOME_UI.md`, `PLAN_LEADERBOARD.md` section 4, `PLAN_PEN_LOBBY_POLISH.md` section 2). Pixel grids are in `data/pixel-art.json`; a grid is only ever drawn at a whole multiple of its size.

## 1. What stays as built

The tray's way of working (the sign's letters are already in it; you type the rest), the hint strip, the card component, the ready board's three steps, type-ahead, the Jump button's behaviour, the opening, the two endings. This file changes how they look where they were sloppy, and removes four things: the meter, the star words, the scalloped edge and the tick badge.

## 2. The dream window: his thought bubble

| Part | Today | Now |
|---|---|---|
| The rim | White, with a scalloped lower edge that reads as lace | 6 px of `--wool-hi` on all four sides. Corners cut in three steps of 4 px. **The lower edge is straight** |
| Its shade | None | 4 px of `--wool-lip` under the lower edge, following the same corners. It makes the window a raised, wool-rimmed panel, like the kit's slabs |
| Where it sits | | 10 px from the screen's top, left and right. The bedroom's wall shows right up to the shade: no gap, and nothing of the wall inside the window |
| **The tail** | Three flat violet squares | Three round **wool puffs**, 40, 26 and 16 px across: pixel discs drawn in 2 px steps in `--wool-hi`, each with the same disc in `--wool-lip` drawn 4 px lower behind it as its shade |
| Where the puffs sit | | The smallest: its middle 14 px above and 6 px right of the tip of his cap. The middle one: 24 px above and 14 px right of the smallest's middle. The largest: 32 px above and 26 px right of the middle one's. If the largest does not reach the window's shade, move all three up together until it overlaps the shade by 4 px |
| How they move | | As today: each bobs 2 px every 2.4 s, each 0.3 s after the one above |
| When the dream pops | The rim flies off as white squares | 14 round puffs, 12 to 24 px across, drawn the same way, fly outward and fade |

## 3. The top bar

Three things, and **nothing in the middle**.

| Part | Value |
|---|---|
| **The chip** (top left, 12 px inside the window) | An `ink` tag 30 high with pixel corners. The moon icon (`moon-small` at 2 px: 16 x 16, `--lantern-hi`), 8 px, then "Tonight's dream: Nov 24" or "Practice dream" in Nunito 800, 13, `--wool`. Padding 10 |
| **The close button** (top right, 12 px inside the window) | Today it is a bright cream block. Now a `--night-2` slab 40 wide: a 36 px face over a 4 px side of `--night-deep`, a 2 px `--ink` outline with pixel corners, and a 14 px pixel cross in `--wool` (2 px strokes). Hover and focus: the face turns `--night-3`. Pressed: the face moves down 4 px. Its hit area is 44 x 44 |
| **The counter** (left of the close button, 12 px between them) | A `--night-2` slab of the same height. Inside, from the left: 12 px; the sheep's head (`sheep-head` at 3 px: 33 x 27); 10 px; the count in Fraunces 800, 28, `--wool-hi`; 16 px. It grows wider with the number. The soft brown sheep picture of today is removed |
| **The best tab** | Hung under the counter, 4 px below its side, centred on it: an `ink` tag 22 high, padding 10, "Best 32" in Nunito 800, 12, `--frost`. As "New best": face `--lantern`, text `--ink`. Hidden while the best is 0 (file 01, section 4) |
| The meter | Removed |

**Phones:** the chip is 26 high and shows the date alone ("Nov 24") in 12 px. The counter's face is 32 with the sheep's head at 2 px (22 x 18) and the count at 22. The tab is 18 high with 11 px text. The close button is 36 wide with the same 44 x 44 hit area. The row that held the meter is gone, so the dream gains its height.

## 4. Cards

The built card stays: an `ink` card with a 6 px bar, an icon in a 24 x 24 box, a title in Fraunces 800, 17, `--wool`, a second line in Nunito 800, 12, `--frost`. Its top is 92 px below the window's top (70 on phones), centred. With the star words gone it no longer lies over text.

The cards that remain: the three gate cards (file 07, section 3.4), "Bump!" / "The farmer stirs…", "Zzz…" / "He's out cold". "Nearly out cold" is removed.

## 5. The sign

| Part | Today | Now |
|---|---|---|
| Tilt | About 3 degrees, so every pixel edge is jagged | **Level.** It tilts only when a bump knocks it, as today |
| Where it hangs | Low: the jumping sheep disappears behind it | From the two chain ends of the `signpost` model, **3.75 m above the track**. Its top edge is at the chain ends and it is centred between them. Its lower edge is then about 2.45 m up, and the jumping sheep passes under it |
| If the sheep still gets behind it | | Measure the top of the sheep's back at the highest point of its jump. If it is within 0.3 m of the board's lower edge, raise the post, the arm and the chains together by 0.25 m and measure again. As a last guard: while the sheep's box and the board's box overlap on screen, the board fades to 35% over 100 ms, and back after |
| The tick badge | A yellow square with a tick on the corner, over the outline | **Removed.** When the word is taken, the plank fills and the obstacle's two lanterns light: that says it |
| The board | | Face `--night-2`, a 2 px `--ink` outline with pixel corners, a lit top row of `--night-3`, a 6 px side of `--night-deep`. Padding 12 above, 20 at the sides |
| The letters | | `lantern` tiles: a 42 px face over a 6 px side, Fraunces 800, 28, `--ink`, 8 px apart |
| After them | | Three sunk squares, 10 x 10, 4 px apart: "your letters go here" |
| The word plank | | A Well 20 px high, the board's width less 20. The accepted word lands on it as 14 px `wool` tiles (Fraunces 800, 12), centred |
| Its width | | What the letters need, and never under 150 |
| When the fence is close | | Its outline blinks between `--ink` and `--ember` twice a second, as today |
| Sway | 2 degrees each way | None: a swaying pixel board is jagged half the time |
| Phones | Covers a third of the sky | Tiles 30 over 4 with 20 px letters; sunk squares 8 x 8; the plank 16 high with 12 px tiles. The board is never wider than 46% of the window |

The signpost itself is a voxel model in the dream (file 03, section 8). Only the board is interface, laid over the dream at the point the camera gives for the chain ends.

## 6. The tray

| Part | Today | Now |
|---|---|---|
| The quilt band | Separate dashes with gaps; the last one cut off at the right edge | Section 11: whole squares that fill the width exactly |
| Two messages at once | "Type ahead…" under the Jump button while "Wait for the next fence" shows above the tray | **One message at a time.** The strip above the tray shows, in this order of rank: a refusal ("Not in the dictionary", "Wait for the next fence"), else a hint, else nothing. "Type ahead…" shows only in the meter's row, and only when no fence is on screen and the strip is empty |
| The Jump button when it would do nothing | A dim key with low contrast | Face `--night-3`, the icon and the word "Jump" in `--frost`: quiet, but readable |
| Phones | An icon with no word | 76 wide: the return-key icon and "Jump" in Fraunces 800, 14 |
| Everything else | | As built: `lantern` tiles for the sign's letters, `wool` tiles for yours, the caret, the fence meter, wrong words in `--ember` with a shake |

## 7. Above the farmer: snores and marks

| Mark | Today | Now |
|---|---|---|
| Snores | Three tiny "z" piled on the smallest puff; a white ladder in world 3 | Three `z` grids at 2, 3 and 4 px an art pixel (10, 15 and 20 px), in `--wool-hi` with a 2 px `--ink` outline all round so they read against the wall. They sit to the right of his head, clear of the puffs: their top-left corners 56, 74 and 98 px right of the tip of his cap: the first level with it, the second 20 px above it, the third 46 px above it. They show in turn, small to large, over 1.8 s, then a 0.6 s rest. From 30 sheep on (his deep sleep): 3, 4 and 5 px |
| "?" on a wrong word, "!" on a bump | 10 px tall | The `question` and `bang` grids at 4 px (20 x 28 and 12 x 28), `--lantern-hi` with the same 2 px outline, 18 px above his cap, for 1 s |

## 8. The count that pops up

At each sheep, its number appears at the sheep's right shoulder, rises 30 px over 500 ms and fades: Fraunces 800, 44, `--wool-hi`, with a 2 px `--ink` outline all round and a 4 px `--ink` drop under it. **In gold** (`--lantern-hi`) at every 10th sheep and at the first sheep past your best; at every 10th also 1.6 times the size.

## 9. One star for each sheep

This replaces the dotted words in the sky.

*An example.* You type FABLE and the sheep clears the fence. A small gold star leaves the sign's plank, rises into the sky and stays there. After twenty sheep there are twenty of your stars up there.

| Part | Rule |
|---|---|
| The star | The `star-plus` grid at 2 px (10 x 10) |
| Its flight | From the middle of the sign's word plank to its place in the sky, over 700 ms, fast then slow, in `--lantern-hi` |
| When it arrives | It grows to 1.35 times and back over 240 ms, turns `--frost` at 80%, and stays for the night |
| Its place | Hashed from the night's date and the sheep's number: above the horizon, not under the chip, the counter or its tab, and not within 80 px of the moon's middle |
| How many | At most 240. After that the oldest fade out as new ones arrive |
| They are sky | They do not move with the lane |
| At a moon show | All your stars grow and shrink once, in a wave from left to right over 2 beats |
| The 60 small stars of the night | Stay, dimmer (file 02, section 5), so yours stand out |

Your words themselves are listed on the results board, where they can be read (file 09, section 4).

## 10. The ready board

| Part | Today | Now |
|---|---|---|
| Where it sits | The middle of the window: it covers the sheep and the track | Centred across the window, its middle 34% of the way down, so the track and the sheep show under it |
| Its captions | 11.5 px | Nunito 800, 13, `--frost` |
| Its third picture | A sheep over a brown table shape | The `sheep-side` grid over the `fence` grid, both at 2 px, 4 px apart: a sheep over a fence |
| Its foot line | "Press any key to start" on every device | Touch devices: "Tap to start" |
| Its band | Dashes | Section 11 |

## 11. The quilt band (tray, ready board, results board)

One band along the top edge of each of those three, inside the outline:

- **Whole squares only.** The number of squares is the board's width divided by 26, rounded; each square's width is the board's width divided by that number. So the band begins and ends on a square's edge.
- **Their order:** red, cream, mustard, cream, green, cream, mauve, cream, and round again: `scarfRed 0` `#BF6055`, `trimWhite 0` `#E4D7C4`, `coopYellow 0` `#DCB87A`, `giftGreen 0` `#478A6B`, `slate 0` `#856D75`. These are the quilt's colours (file 03, section 5).
- **Each square:** 8 px high (10 on the results board), its top 2 px mixed 25% toward white, a 1 px `--ink` line at its right edge. A 1 px `--ink` line runs under the whole band.

## 12. Checks for this file

1. A 3x detail sheet in the pull request, each beside today's: the rim's four corners and its shade, the three puffs, the snores in both sizes, "?" and "!", the top bar in its three states (no tab, "Best 32", "New best"), the sign with one, two and three letters and with a word on its plank, the tray in every state, the quilt band's two ends on each board.
2. No two messages show at once (section 6): a test walks every state of the tray.
3. A clip of a jump in each world: the sheep is never hidden by the sign.
4. Text contrast at least 4.5 to 1 everywhere (`data/checks.json` lists the 28 pairs measured for this plan; all pass).
5. At 360 x 640 with the keyboard open: nothing overlaps anything else.
6. The developer's read-out (picture 22) cannot show in a production build.
