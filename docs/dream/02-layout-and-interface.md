# 02. Layout and interface

See `reference/sketch-stage-2.png` for the whole screen and `reference/sketch-phone.png` for phones.

## 1. What is wrong today

| # | Problem | Seen on the screenshots |
|---|---|---|
| 1 | The typing floats | "a word starting with H" sits on the snow in Patrick Hand, with a dashed line and an "Enter to jump" key. Nothing holds it together |
| 2 | An overlap on phones | The hint line runs straight across the farmer's bubble |
| 3 | The farmer is too small to read | He sits in a bubble about 270 px wide in a corner |
| 4 | Old-style counters | A parchment date tag, a charcoal stitched counter, a round wooden close button |
| 5 | The state is thin | "1/30" in small type is the only sign of how far the night has gone |
| 6 | A word taken gets a paper tag | "✓ HACK" floats above the sign, in another style again |

## 2. This mode's own trim

Counting Sheep keeps the game's navy kit, so it still belongs. It gets two marks of its own, both taken from the farmer's bed. **No snow cap, icicle or festive light appears on this mode's interface**: those belong to the outdoor screens.

| Trim | What it is | Where it is used |
|---|---|---|
| **The quilt band** | A strip of patches in the five quilt colours, in this order: red `#A84A42`, cream `#E6DCC6`, green `#3F6B4A`, mustard `#C99A4A`, navy `#2B3A66`. Each patch has a top row mixed 25% toward white. Patches are 2 px apart, showing `--ink` | Along the top of the tray, the ready board and the results board, in place of the kit's orange band and snow caps. 6 high with patches 18 wide on the tray and the ready board; 10 high with patches 22 wide on the results board |
| **Blanket stitch** | Ticks of `--wool`, 2 wide and 4 high, one every 9 px, hanging under a quilt band | Under the results board's quilt band only |
| **The nightshirt pocket** | A face of `#E6DFD3` with a 1 px stripe of `#8F97AC` every 16 px, a one-step `--ink` outline, text in `--ink` | The count on the results board only |

Use each trim only where the table says. One band per board; never as a texture across a surface.

## 3. Layout

### 3.1 Desktop (900 wide or more, and 600 high or more)

| Part | Value |
|---|---|
| Bed strip | The bottom of the screen, `--bed: clamp(160px, 24vh, 240px)` high, full width |
| Dream window | Inset 10 from the top, left and right. The lowest points of its bottom edge are 6 above the bed strip. The bedroom's wall continues up behind the bumps of that edge, so no gap shows |
| The lane | Its top is at **66%** of the dream window's height. The whole play strip moves up with it, as one piece |
| Bed zone | The left `clamp(380px, 36vw, 590px)` of the strip: the bed and the farmer |
| Tray | Centred on the middle of the space right of the bed zone, `(bed zone + 100vw) / 2`. Its bottom is 14 above the screen's bottom. It overlaps the strip, never the dream |

### 3.2 Phones (otherwise)
Find how the on-screen keyboard is handled today. The layout fills the part of the screen **visible above the keyboard** (`window.visualViewport`), from the top:

| Part | Value |
|---|---|
| Dream window | Full width, inset 6. Height: the visible height minus 150. The lane's top at 70% of its height |
| Bed strip | 56 high. Only the farmer's head and shoulders, in the left 46%. The candle is right of him |
| Tray | Full width less 12, 84 high, 6 above the visible bottom |

Nothing may overlap anything else at 360 x 640 with the keyboard open.

### 3.3 The thought bubble
- **Rim:** 6 of `--wool-hi` all round, with 4 of `--frost` under the bottom edge as its shade. Pixel corners of 4 steps.
- **Scalloped bottom edge:** half-ellipses side by side, 72, 48, 60 and 40 wide in turn, overlapping by 6. Each is half as tall as it is wide. Drawn in 3 px steps, never smooth. On phones: 48, 32, 40 and 28.
- **Tail:** three pixel puffs stepping down and left from the window's bottom edge to the farmer's head: 42, 26 and 16 across, squares with two-step pixel corners, `--wool-hi` with 3 of `--frost` under each, filled with the stage's `sky[3]`. The smallest sits 12 above his cap. They bob 2 px every 2.4 s, each 0.3 s after the one above.
- The bubble is one clip shape over the dream's canvases. It costs no extra canvas.

## 4. The tray

A small Board: face `--night` with felt, a one-step `--ink` outline, **the quilt band along its top**, a 6 side of `--night-deep`, a hard shadow. Padding 14 at the top (under the band), 16 at the sides, 12 at the bottom.

| Part | Value |
|---|---|
| Locked tiles | The sign's letters, already in place: `lantern` slabs, a 40 face plus a 6 side, Fraunces 800, 26, `--ink` |
| Typed tiles | `wool` slabs, the same size. Each pops from 1.08 to 1 in 120 ms as it arrives |
| The next place | A sunk square with a 16 x 3 `--night-3` dash, the orange ring, and a blinking caret (3 x 24, `--lantern-hi`, 0.53 s on and off) |
| Empty places | Sunk squares with the dash. At rest there are always at least three places after the locked letters |
| Spacing | 6 between tiles |
| Long words | Tiles shrink from 40 to 28 in steps of 4 as the word grows. Past that, the typed tiles slide left under a "…" tile placed after the locked letters |
| Jump | At the right: a `lantern` slab, 96 wide, a 40 face plus a 6 side: the return-key icon (16, `--ink`) and "Jump" in Fraunces 800, 17. It does exactly what Enter does, and looks disabled exactly when Enter would do nothing. Tooltip "Enter" |
| Fence meter | Under the tiles: segments 22 wide, 8 high, 5 apart, as many as fit under the tiles. It is full when the fence appears and empties as the fence nears the sheep. `--lantern`; `--ember` when 3 or fewer are left; sunk when empty. With no fence coming, all are sunk and the row reads "Type ahead…" at its right, in Nunito 800, 12.5, `--frost` |
| Phones | Tiles a 28 face plus a 4 side, shrinking to 20. Jump is 64 wide, icon only. The quilt band is 5 high with patches 14 wide |

**Every state**

| State | The tray shows |
|---|---|
| A fence is coming, nothing typed | Locked tiles, the next place with its caret, two empty places, the meter filling down |
| Typing | Typed tiles arrive one by one |
| The word is taken | The tiles fly to the sign (file 06). The tray empties: each remaining tile drops 6 px and fades in 100 ms |
| Type-ahead | Three empty places, no locked tiles, "Type ahead…" in the meter row. If the game shows typed letters here today, they appear as `wool` tiles |
| A wrong word | The tiles shake and turn `--ember` (file 06). They stay, so the player can fix the word, as today |
| The night has ended | The tray drops 20 px and fades in 200 ms |

Today's "a word starting with H" line, the dashed line and the "Enter to jump" key are removed. The locked tiles and the Jump button say the same.

## 5. The hint and the messages

One Ink strip: felt, a 6 wide bar inside its left edge, padding 8 and 12. Text in Nunito 700, 12.5, `--frost`, two lines at most.

| Kind | Bar | Text |
|---|---|---|
| A hint (the first fence of each letter count, as today) | `--lantern`, with the candle icon (24, `--lantern-hi`) | Today's words. The example word and its letters ("SHEEP", "S") in Nunito 800, `--lantern-hi` |
| "Not in the dictionary", and any other refusal the game has | `--ember` | Today's words, for 1.6 s |

**Where it sits**
- Desktop: 8 above the tray, as wide as the tray.
- Phones: **inside the dream window**, along its bottom edge, at full width less 12. It never covers the lane, the bed or the farmer.

## 6. The sign

The sign hangs from the same post and arm as today. Its board becomes an HTML overlay placed from the arm's hang point, so the letters are crisp. **It is the same in every stage**, because it is the thing you read. It has no cap.

| Part | Value |
|---|---|
| Hanger | A wooden bar across the top, 5 high, hung from the arm; two 2 px chains, 12 long, down to the board |
| Board | Face `--night-2` with felt; a one-step `--ink` outline; a lit top row of `--night-3` |
| Required letters | `lantern` slab tiles: a 42 face plus a 6 side (30 plus 4 on phones), Fraunces 800, 28 (20), `--ink`, 8 apart |
| After them | Three sunk squares, 10 x 10, 4 apart: "your letters go here". They replace today's "…" |
| Word plank | Under the letters: a Well 18 high, the board's width less 20. Your accepted word lands here as 16 px `wool` tiles |
| Swing | The board sways 2° each way about the chains' tops, every 2.2 s |
| When the fence is close | Its outline blinks between `--ink` and `--ember`, twice a second |
| On a bump | It is knocked askew, as today |

The paper tag "✓ HACK" is removed. The word on the plank replaces it.

## 7. The counters, inside the top of the dream window

| Part | Value |
|---|---|
| Mode chip (top left, 16 in) | An `ink` tag, 28 high: the small moon icon (16, `--lantern-hi`), then "Tonight's dream · Nov 24" or "Practice dream", in Nunito 800, 12.5, `--wool`. Phones: "Nov 24" alone |
| **The night track** (top centre; counted nights only) | One pip per fence: 8 x 8 with a one-step `--ink` outline, 4 apart, in three groups split where the letter count changes, 10 between groups. Before each group, its letter count ("1", "2", "3") in a 16 x 16 `ink` tag, Nunito 800, 11, `--frost`. Cleared: `--lantern` with a `--lantern-hi` top row. Current: `--lantern-hi`, blinking on the beat. Ahead: sunk. The fence that ended the night: `--ember`. Phones: 6 x 6 pips, 3 apart, no tags, on their own line under the chip |
| Counter (top right) | A `night` slab, 40 high: the sheep head (24), the count in Fraunces 800, 24, `--wool`, then " of 30" in Nunito 800, 12, `--frost`, both on one baseline (practice: the count alone). The number pops to 1.25 and back in 180 ms on each count |
| Close | Home's 44 `wool` square with the pixel cross. It does what it does today |

## 8. Cards

One component for every announcement: an Ink card with a 6 wide bar, an icon centred in a 24 x 24 box (each at a whole multiple of its grid; the "z" at 4 px an art pixel), a title in Fraunces 800, 17, `--wool`, and a second line in Nunito 800, 12, `--frost`. It sits at the top centre, 12 under the track. It drops in 8 px and fades in over 160 ms, stays 1.4 s, and fades out in 160 ms.

| Card | Bar | Icon | Title | Line 2 |
|---|---|---|---|---|
| Stage 2 | `--lantern` | island | "Dreaming…" | "Two letters now" |
| Stage 3 | `--lantern` | yarn ball | "Deep dream" | "Three letters now" |
| Finale | `--lantern` | "z" | "Nearly out cold" | "Five fences to go" |
| Bump | `--ember` | bump star | "Bump!" | "The farmer stirs…" |
| Asleep | `--lantern` | "z" | "Zzz…" | "He’s out cold" |

## 9. The ready board

Before the first key, in the middle of the dream window: an Ink card 440 wide (full width less 24 on phones), with the quilt band along its top.

- **Title:** "Count sheep to keep the farmer asleep" (practice: "How far can you run?"), Fraunces 800, 20, `--wool`.
- **Three pictures in a row,** each in a Well 120 x 64, with the arrow icon (16, `--frost`) between them:
  1. the sign with one tile, "S";
  2. the tray with the tiles "SHEEP";
  3. the sheep in the air over a fence.

  Under each, in Nunito 800, 11.5, `--frost`: "Read the sign", "Type a word that starts with it", "Press Enter to jump".
- **Foot:** "Press any key to start", Nunito 800, 12.5, `--lantern-hi`, blinking once a second (steady with reduced motion).

## 10. Text rules for this mode

The rules of `PLAN_PEN_LOBBY_POLISH.md` section 2 apply. In short: Fraunces 800 for titles, tiles and numbers; Nunito for everything else; no Patrick Hand; sentence case; one fact in one place; numbers in figures of equal width; a number in Fraunces with its words in Nunito ("**6** of 30").
