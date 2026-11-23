# Fleeced: the pen screen, polish (version 3)

Written 22 November 2026 from a screenshot of the pen screen as built from `PLAN_PEN_LOBBY.md` (a created lobby, "Player809's room", two players, Ready, desktop 1440 x 900), examined at 3x zoom. Give Claude Code this file, `PLAN_PEN_LOBBY.md` and the screenshot. One pull request. **This replaces version 2 of this file completely.**

(In this repository `PLAN_PEN_LOBBY.md` is `docs/pen/PEN-PLAN.md` and `PLAN_LEADERBOARD.md` is `docs/leaderboards/LEADERBOARDS-PLAN.md`.)

**Brian's request:** the screen already looks good, and he wants it made as good as possible. That means better use of empty space and tidier text, and also every small flaw fixed. His own example is the chat rules banner with the check mark. This plan therefore works at two levels:
1. **Layout and space** (sections 3 to 9).
2. **A detail pass:** every icon, tag, edge, line, gap and baseline on the screen (sections 2, 10 and 11).

**The rules from earlier plans still hold.** This plan applies on top of `PLAN_PEN_LOBBY.md` as built and replaces its sections 6 and 9. It changes parts of 7 and 8. Everything else in that plan still applies, above all "no function changes". Record this in `CLAUDE.md`. Units, recipes and colours are as in `PLAN_PEN_LOBBY.md` and `PLAN_LEADERBOARD.md`. Sizes are px at `--u` = 1, and a step is `--s`.

## 1. What is wrong now

### 1.1 Space
| # | Problem | Seen |
|---|---|---|
| S1 | The left panel overflows | At 1440 x 900 the Game section runs off the bottom and the panel scrolls: the rules are cut in half and "Change rules" cannot be seen |
| S2 | The status card is about 210 px tall for three facts | The headline wraps ("Ready when / you are") because the timer squeezes it; line 2 wraps; an empty gap of about 50 px sits above "Party code" |
| S3 | One number twice | "2 of 10" appears in the status card and again in the Players header |
| S4 | A whole row for one fact | "8 open places" fills a 40 px row |
| S5 | The bar is half empty | About 50% of its width is empty between "Ready" and "Invite friends" |
| S6 | The chat card is empty space | With no messages, about 200 px of empty box; the rules take three lines |
| S7 | The sheep are small | About 70 px tall, with about 150 px of bare snow between the gate and the start button |

### 1.2 Text
| # | Problem | Seen |
|---|---|---|
| T1 | A name cut off while the row has room | "Player…": the seat badge, the avatar and two tags take about 190 px of 320 |
| T2 | Text not centred in its box | "You" sits high in its tag; "You" and "Host" are different heights with misaligned tops; "2 of 10" sits lower than the seat pips beside it; the timer is centred on a two-line headline instead of on line 1 |
| T3 | A serif "of" | "2 of 10" is all Fraunces, so the little word "of" is as heavy as the numbers |
| T4 | Straight apostrophe | "Player809's room" uses ' instead of ’ |
| T5 | The link's underline is loose | "All the rules" has its underline about 4 px under the text, as thick as a border |

### 1.3 Icons and pixel art
| # | Problem | Seen |
|---|---|---|
| I1 | The chat rules badge is lumpy | The shield's steps are uneven, its tip is lopsided, and its check mark is a thin line at a smaller pixel size than the shield. It sits at the top left of three lines of text, not beside them. Brian's own example |
| I2 | Icons at mixed pixel sizes and weights | The arrow is solid at 2 px pixels; the link is a thin outline; the clock is a 1 px ring; the gate's brace is a scatter of dots; the rounds arrow is a broken arc |
| I3 | An off-style picture | The room's title icon is a smooth, shaded blue bomb, not pixel art, and reads as a bomb |
| I4 | The fold arrow is a smooth thin curve | Unlike every other icon |
| I5 | The pause icon is as tall as its button | It touches the button's top and bottom edges |
| I6 | The Players icon is a blank square | A cream box with two dots; it does not read as a sheep |
| I7 | Blurry pictures | The avatars in the rows and the name plate in the pen are soft, scaled by a non-whole amount |
| I8 | The crown is a line | On the pen's plate, only its bottom row is drawn |

### 1.4 Surfaces and edges
| # | Problem | Seen |
|---|---|---|
| E1 | Lines inside lines | In the chat card, the card's inner frame, the rules strip's outline, its separate orange band and the messages box's outline make four parallel lines within about 30 px |
| E2 | Stray pixels at corners | The corner brackets render as single light dots at the panel's and chat card's corners; the input has a light pixel at its bottom-left corner |
| E3 | The coloured bars stick out | Your row's orange bar runs past the row's face into its side and gap; the status card's green bar sits outside the card's corners |
| E4 | The knit is cut at the top | On every slab the knit motif starts cut off at the top edge, so a row of half "v"s shows as a wavy line under the highlight |
| E5 | The bar's slabs press into the snow | Their tops (and lit rows) are hidden under the snow strip |
| E6 | The scroll track sits on the frame | It overlaps the panel's inner frame line |
| E7 | Thin icicles | The panel's icicles are 2 px sticks, like rain, not the tapered icicles of the leaderboard |
| E8 | Muddy lights | The bulbs are soft and dull (brown-red, olive, tan), and many are "off" at once |

### 1.5 Controls
| # | Problem | Seen |
|---|---|---|
| C1 | Send's disabled look is mixed | A grey face with an orange-brown lip under it |
| C2 | The input and Send do not line up | Different heights; their tops differ by about 4 px |
| C3 | The "You" pennant's notch looks broken | A small dark bite out of one corner, not a clean V |
| C4 | Two choices, two designs | "Game length" has two-line slabs; "Who can join" has taller one-line slabs; the gaps differ |
| C5 | The start button's knit is loud | Two wavy rows run across its face |

### 1.6 The pen
| # | Problem | Seen |
|---|---|---|
| P1 | A sheep off its mat | Player 2 stands in front of the back row, not on mat 2 |
| P2 | Unreadable mat numbers | Faint, and upside down from the camera |
| P3 | A missing plate | "dosv" has no plate; "Player809"'s plate floats beside the sheep, not above it |
| P4 | A glare | The lantern on the gate post throws a bright patch on the snow in front of the gate |
| P5 | Litter | Green tufts inside the pen; tan stalks sprinkled over the snow |
| P6 | A faint checkerboard | The pen's floor shows large tiles of slightly different snow colours |

## 2. Standing rules for this screen

### 2.1 Text
1. **Headlines never wrap.** If a translation is too long, it shrinks by up to 2 px, then ends in "…" (one character, `text-overflow: ellipsis`).
2. **Line 2 of the status card is one line on desktop.**
3. **A name gives way last.** Tags shrink to icons before a name is cut.
4. **One fact, one place.** Each number appears once on the screen.
5. **Sizes.** Fraunces 800: 18 for the bar's title; 17 for section titles, the headline and values; 15 for names and slab labels; 14 for the pen's plates. Nunito 800: 12.5 for body text; 11.5 for labels, hints and second lines; 11 for tags. Nunito 700 only for long sentences (the chat rules, tooltips, messages).
6. **Numbers with words.** The number is in Fraunces and the words in Nunito, on one baseline: "**2** of 10", "**2** turns a round". Never a serif "of".
7. **Typographic marks:** ’ for apostrophes, … for ellipses, – for "none", and a thin no-break space before units where French needs one.
8. **Centring in boxes.**
   - Text in a box 28 high or less: `line-height` equal to the box's height, with 1 px of padding on top (Nunito sits high).
   - Icons beside text: centred on the text's line box, never on a multi-line block.
   - After building, check every pairing at 2x zoom and list any per-pair nudge in the pull request.
9. **Links:** Nunito 800 in `--lantern-hi`; underline 2 px thick, 2 px below the baseline, in `--lantern-lip`.
10. **Labels above controls:** sentence case, Nunito 800, 11.5, `--frost`, no colon.

### 2.2 Spacing
- 4 inside a group (an icon and its text, two lines of one item).
- 6 between a label and its control, and between tags.
- 10 inside cards, wells and strips.
- 12 between groups in a section.
- 12 above and below each groove between sections.
- 16 between the panel's inner edge and its content.
- **Nothing else.** Every left edge in the panel lines up on the 16 line, or on a card's 10 line inside it.

### 2.3 Icons
1. **Every icon is a grid from section 11,** drawn at 2 px per art pixel: 12 x 12 grids show at 24, and 8 x 8 grids at 16. The Players icon is the exception: it is the 8 x 8 sheep at 3 px (24). Nothing is drawn at 1 px, and nothing is scaled by a non-whole amount.
2. **One pixel size per icon.** A detail inside an icon (a check, eyes, a brace) uses the same art pixel as the icon.
3. **Solid shapes.** Lines are at least one art pixel (2 px) thick, and no icon is an outline thinner than that.
4. **Sizes by context.**
   - 24 beside text of 17 or more, and in section headers.
   - 16 beside text of 15 or less, and in tags and small buttons.
   - 36 or 48 for empty states.
5. **Colour by surface.**
   - On `wool` and `lantern` faces: `--ink`.
   - On dark faces: `--wool` for objects, `--lantern` for status and attention, `--frost` for quiet hints.
   - Multi-colour grids say their colours.
6. **No smooth, shaded or photographic pictures** in the interface. The avatars come from the same pictures as Home's chip, drawn at a whole multiple of their own pixel size.

### 2.4 Surfaces and edges
1. **One outline per surface.**
   - Boards (the panel and the chat card) have their outline and their inner frame.
   - Nothing inside a Board has an outline, except text fields.
   - Cards, strips, wells and tiles inside a Board are shaped only by their face, lit row and side or sunk rows.
   - No two parallel lines are closer than 6 px.
2. **Coloured bars sit inside the face:**
   - 6 wide, the face's full height, with no side or gap;
   - the face's one-step pixel corner is cut from the bar too;
   - this covers the status card's state bar, your row's bar and the chat rules strip's bar.
3. **Knit:** position it so that the first motif row starts one step below the face's lit row (`background-position: 0 var(--s)`), so no cut motif shows at the top. On slabs wider than 200, the knit is at 5% (it is 7% elsewhere).
4. **Corner brackets** (`PLAN_LEADERBOARD.md` 4.3) are drawn as the full 4 x 4 grid at one step per art pixel (12 x 12 px), exactly at the inner frame's corners.
   - Where a snow cap covers a top corner, leave that bracket out.
   - Below `--u` 0.9, leave all brackets out rather than let them shrink to dots.
5. **No stray pixels.** Every corner of every element is checked at 3x zoom (check 12.4).

## 3. The top bar

| Part | Value |
|---|---|
| Height | 60: the 8 high snow strip, then 52 in which the slabs (a 34 face plus a 6 side) are centred. The bar's lit row runs under the snow; nothing touches the snow |
| Left, 10 apart | Leave; the title tag (the room icon 11.13 in a created lobby; Home's Queue icon in a queue); the state chip; the waiting time |
| Right, 10 apart | The party code (lobbies that have one); Invite friends |
| State chip | An `ink` tag, 28 high, one-step pixel corners: an 8 x 8 square dot, 6 gap, the state in Nunito 800, 12.5, `--wool`. Dot colours: `--lantern` while finding players and starting; `--pasture-hi` (`#7BC48E`, new) when Ready or Full |
| Waiting time | The clock (11.9, 16, `--frost`), 4 gap, "0:15" in Nunito 800, 12.5, `--frost` (moved here from the status card) |
| Party code | A sunk pill (Well recipe), 40 high, padding 0 12: "Code" in Nunito 800, 11.5, `--frost`, 6 gap, the code in Fraunces 800, 18, `--lantern-hi`, letter spacing 0.12em. Not a button (moved here from the status card, beside Invite, because both are about bringing friends in) |
| Invite friends | The solid link icon (11.10) in `--ink`; after copying, the check (11.16) and "Link copied" for 2 s |
| Phones | Leave and Invite as 44 squares with icons only; the waiting time is hidden; the code moves to the Players tab's header |

## 4. The status card

A raised card: face `--night-2` with felt; one step of `--night-3` as its lit top row; a 3 side of `--night-deep`; one-step pixel corners; the 6 wide state bar inside its face (`--lantern` while finding players and starting, `--pasture-hi` when Ready or Full). Padding 10, with content starting 10 after the bar. **About 92 high (today about 210).**

| Line | Content |
|---|---|
| 1 | The state icon at 24 (the hourglass while finding players; the gate when Ready, Full or Starting; both `--lantern`), 8 gap, the headline in Fraunces 800, 17, `--wool`, one line |
| 2 | 4 under: line 2 (below) in Nunito 800, 12.5, `--frost`, one line |
| 3 | 10 under: the seat row, 16 x 16 seats 5 apart, filled seats being the sheep head (11.2) and empty seats the empty slot (11.3). At the right, on the seats' centre line: "**2**" in Fraunces 800, 17, `--wool`, and " of 10" in Nunito 800, 12, `--frost` |
| 4 | Only below `min`: the "start" caret under seat `min`, adding 16 |

| State | Line 2 |
|---|---|
| Finding, you are the host | "Invite friends to fill it faster." |
| Finding, someone else is host | "{host} starts when enough are here." |
| Ready, you are the host | "More can join until you open the gate." |
| Ready, someone else is host | "More can join until {host} opens the gate." |
| Full, you are the host | "Open the gate to start." |
| Full, someone else is host | "Waiting for {host}." |
| Starting | No line 2; the card is 66 high |
| Starts by itself | "Starts by itself in 0:30", in `--lantern-hi` |

## 5. Players

**Header.** The sheep icon (11.2 at 3 px, 24), 8 gap, "Players" in Fraunces 800, 17, `--wool`. At the right, on the title's baseline: "{max − n} open places" (or "Full") in Nunito 800, 11.5, `--frost`. On phones the party code pill sits here at 34 high, and the open places move under the title. The "8 open places" row is removed.

**Rows.** One Tile each (a 34 face, a 3 side, a 3 gap), 8 under the header.

| Part | Value |
|---|---|
| Padding | 6 on the left (12 for your row, after its bar), 8 on the right |
| Avatar | 28 square, `night` face, one-step pixel corners, the avatar picture crisp (2.3.6). **The seat badge is removed** (mats lose their numbers, 9.2) |
| Name | 8 after: Fraunces 800, 15, `--wool` |
| Tags | 6 after the name, not pushed right, 6 apart, both 20 high, vertically centred on the name's line |
| "You" | Face `--lantern`, text `--ink`, Nunito 800, 11, padding 0 10 0 6. Its right end is a clean V: `clip-path` cutting one step deep to a point at mid-height. No dark bite |
| Host | Face `--ink`, the crown (11.4) at 16 x 10, 4 gap, "Host" in Nunito 800, 11, `--lantern-hi`, padding 0 6 |
| Squeezing | If the name and tags do not fit: first "Host" loses its word (crown only, a 20 square, tooltip "Host"); then "You" becomes a 6 x 6 `--lantern` square; only then is the name cut |
| Host controls | As today, last, pushed right |
| Your row | Its 6 wide `--lantern` bar inside the face (2.4.2) |

Five rows show, then the list scrolls inside itself. Its track is inside the inner frame, 6 from it (E6).

## 6. Game

**Header.** The die (11.14, 24, `--wool`), 8 gap, "Game" in Fraunces 800, 17, `--wool`. At the right:
- **Host:** "Change rules", a `wool` slab (a 28 face plus a 3 side): the small gear (11.15, 16, `--ink`), 4 gap, "Change rules" in Nunito 800, 12, `--ink`. This replaces the full-width slab.
- **Others:** "Host chooses", an `ink` tag with the padlock at 16.

**Two choices, one design.** Each is a label, then 6 gap, then joined slabs: a 38 face plus a 6 side, 6 apart, sharing the width, each with two lines centred. Line 1 is the label in Fraunces 800, 15; line 2 is a hint in Nunito 800, 11.5. The chosen slab is `lantern` (`--ink` text); the others are `wool` (`--ink` label, `--night` hint). 12 between the two groups.

| Label | Slabs |
|---|---|
| "Game length" | "Quick" / "about 2 min"; "Standard" / "about 3 min"; "Long" / "about 6 min" (estimates from the code) |
| "Who can join" (only where the code has it) | "Friends only" / "with your code"; "Public" / "anyone can join" |

**Rule chips.** One Well, 12 under the choices, in three equal columns divided by grooves. Padding 10. Each column is centred:
- **Line 1:** the icon at 24 (rounds 11.11 in `--frost`; wool ball 11.12; twist 11.7 of `PLAN_PEN_LOBBY.md` in `--lantern`), 6 gap, the value in Fraunces 800, 17, `--wool` ("2", "3", "On").
- **Line 2:** 4 under, in Nunito 800, 11.5, `--frost`: "turns a round", "wool balls (lives)", "twists". At most two lines.
- **Tooltip:** hover, focus or tap shows the full explanation (from `PLAN_PEN_LOBBY.md` 6.3) in an Ink card tooltip with a pointer. Each column is focusable and reads its explanation to screen readers.

## 7. The chat card

| Part | Value |
|---|---|
| Height | Fits its content, from about 260 (no messages) to `min(360, 45vh)` |
| Header | 44 high. The chat icon (24, `--wool`), 8 gap, "Chat" in Fraunces 800, 16. At the right, 6 apart: **Pause chat** (host only), a `night` slab with a 28 face plus a 3 side, holding the small pause (11.17, 16, centred, with 6 above and below) and "Pause chat" in Nunito 800, 11.5; then **Fold**, a 28 square `night` slab with the stepped chevron (11.8, 16 x 8) |
| Rules strip | See 7.1 |
| Messages | 6 under the strip: a Well, no outline. Empty: the chat icon at 36 (3 px per art pixel) in `--night-3`, 8 gap, "No messages yet. Say hi." in Nunito 800, 12.5, `--frost`, centred; 96 high in all |
| Input row | 8 under the messages: the text field and Send, **both 40 high in all, tops and bottoms aligned**. The field: an `--ink` face, a one-step outline of `--night-3` on all four sides, one-step pixel corners with no stray pixel, placeholder "Be kind…" in `--frost`, centred vertically. Send: 72 wide; a `lantern` slab (a 34 face plus a 6 side) when there is text; when there is none, the disabled slab: face `#3A4664`, a 2 side of `#2A3350`, text `--frost`. **Never an orange lip under a grey face** |

### 7.1 The rules strip: Brian's example
- **Shape:** one strip, 6 under the header, the full inner width. Face `--ink` with felt; one-step pixel corners; a 6 wide `--lantern` bar inside its face at the left. **No outline, no separate orange band on top**, so there are no lines inside lines.
- **Layout:** padding 8 at the top and bottom, 10 after the bar, 10 on the right. The new shield (11.6, 24) sits **centred on the text block's height**, 10 before the text.
- **Text:** Nunito 700, 11.5, `--frost`, line height 16, at most two lines: "No swearing, nothing sexual, no slurs, or you get suspended." Then, with a no-break space, the link "All the rules" (2.1.9) on the same line if it fits, or starting line 2.
- **Height:** 48 in all for two lines.
- **Meaning kept:** the rule and its consequence are unchanged; "Be kind" stays as the input's placeholder.

## 8. The start button

- A `lantern` slab, 300 wide (wider if French needs it), a 56 face plus a 6 side, knit at 5%, and the hard shadow `filter: drop-shadow(0 4px 0 rgba(14, 21, 40, 0.38))` with no blur.
- The gate icon (11.5, 24, `--ink`) and the two lines form one group, centred in the face as a group. The lines are left-aligned within the group, 10 after the icon.
- Line 1 is "Open the gate" in Fraunces 800, 20. Line 2 is the state text in Nunito 800, 12; each is centred on its own line box.
- The disabled and busy states come from Home's kit, as before.

## 9. The pen

1. **Each sheep on its own mat.**
   - Seat order fills the front row from left to right (mats 1 to 5), then the back row (6 to 10).
   - A test checks, for every `n` from 1 to `max`, that each player's sheep is centred on its mat within 0.05 m.
2. **No numbers on the mats** (open choice 1). A mat with no sheep is an open place. The list and the pen are tied together by the name plates.
3. **Plates.**
   - Every player has a plate, every time; a test checks this for `n` from 1 to `max`.
   - Plates are drawn in HTML over the canvas, positioned from each head's projected point, so they stay crisp. If they are textures in the scene today, switch them to HTML.
   - Each plate's centre sits over its own head, within 4 px, 0.12 H above the hat.
   - The crown is the full 8 x 5 grid at 16 x 10.
   - The name is Fraunces 800, 14.
   - Plates are 26 high in all: a 23 face plus a 3 side.
4. **The lantern** moves from the gate post to the pen's front-right corner post. Its light is halved, reaches no further than 2.5 m and has no bloom. The snow in front of the gate keeps its normal colour.
5. **The floor** inside the pen is one flat `snow` colour; the faint checkerboard of large tiles goes. A drift one M cell high runs along the inside of the back and side fences.
6. **No litter.**
   - Remove the green tufts inside the pen.
   - Inside the camera's view, gather the tan stalks into three or four deliberate clumps of five to eight, at the pen's back corners and beside one or two pines.
7. **The camera.**
   - Between the panel and the chat card, the pen and its plates fill **84%** of the width (it was 72%).
   - The gate's bottom sits 20 above the start button; the plates' tops sit at least 16 below the lowest bulb.
   - The sheep are then about 90 px tall at 1440 x 900.
   - It keeps looking down 20°.

## 10. Snow, lights and frames

**Snow caps on the panel** (as `PLAN_LEADERBOARD.md` 9.1, built exactly):
- the face in `--wool-hi` with the speckle, a white top row, the stepped bottom edge, and the `--frost` shade row;
- **icicles 6 wide at the top, narrowing one step every 3, in the 96 pattern** (8/9, 30/15, 52/6, 74/12), with a `--frost` right column. They are not 2 px sticks;
- no icicle hangs past the panel's outer edges.

**Festive lights** (as `PLAN_LEADERBOARD.md` 9.2, built exactly):
- bulbs drawn from the 4 x 7 grid at 2 px per art pixel, on whole pixels, crisp;
- full colours `#F07A5A`, `#9CCB78`, `#FFD08A`, each with its white highlight pixels;
- **at most one bulb in six is "off" at any moment**; "off" means 45% toward `--ink`;
- the wire is drawn in 2 px steps.

**Frames:** the Board's inner frame is one step of `--night-2`, 3 steps inside the face's edge. Brackets follow 2.4.4. Nothing else draws a line within 6 px of the frame.

## 11. Pixel art

These replace the matching grids in `PLAN_PEN_LOBBY.md` section 9. Grids not listed here (the hourglass, the wool ball, the twist, the back arrow, the chat bubble) stay as they are, drawn at 2 px per art pixel. `.` is transparent. Unless a grid lists its colours, `X` is the colour sections 3 to 8 give.

**New colours** (interface only): `--pasture-hi` `#7BC48E`; `--face` `#E9B99A`; `--face-lip` `#C98F72`; `--nose` `#D98C86`.

The grids themselves are written into `src/skin/rooms/penArt.tsx` exactly as the plan gives them: 11.2 sheep head, 11.3 empty seat, 11.4 crown, 11.5 gate, 11.6 shield with a check, 11.8 chevron, 11.9 clock, 11.10 link, 11.11 rounds, 11.13 room, 11.14 die, 11.15 small gear, 11.16 check, 11.17 small pause (every row `.XX..XX.`).

Brian's own icons, when they come, replace these as PNG files in `src/skin/assets/pen/` with the same names, under the same rules.

## 12. Checks, and what done means

1. Type check, all tests and the build pass, including the new tests for mats and plates (9.1 and 9.3).
2. The surface test passes in every state.
3. **Screenshots in the pull request**, next to the one that came with this file:
   - every state, as host and not host;
   - 1, 2, 5 and 10 players;
   - a lobby with a code and "Who can join", and a queue without them;
   - chat empty, busy, folded and paused;
   - at 390 x 844, 1280 x 720, 1280 x 800, 1440 x 900 and 1920 x 1080, in English and French.
4. **A detail sheet for Brian:** 3x crops of the rules strip, a player row with both tags, the status card, the input row, the bar's left group, a name plate in the pen, a snow cap with icicles, a stretch of lights, and each corner of the panel and of the chat card. List anything still off.
5. **Fit:**
   - At 1280 x 800 with five players, the left panel does not scroll.
   - At 1280 x 720 with three players it does not scroll either; beyond that, only the player list scrolls.
   - No headline wraps, and no name is cut while its row has room.
6. **Every number appears once.** List each, with where it sits.
7. **Icons:** a test that every icon element's rendered size is a whole multiple of its grid, and that no icon is drawn from anything other than the grids or Brian's PNGs.
8. In the pen, every sheep stands on its own mat and every player's plate is centred over its own head.
9. No function changed (as `PLAN_PEN_LOBBY.md` check 8). Contrast is at least 4.5 to 1, click areas are at least 44, and frame time is no worse.

**Changes Brian did not ask for, to confirm in the pull request:**
- the waiting time and party code move to the bar;
- the seat badges and mat numbers are removed;
- the rule explanations move into tooltips;
- the shorter chat rules line;
- the die for Game and the room icon for lobbies;
- the lantern moves to the corner post;
- the drift inside the pen's fences.

## 13. Open choices for Brian (the defaults are used unless he says otherwise)

1. **Mat numbers.**
   - Default: removed, along with the list's seat badges.
   - Other: kept and made readable, as `darkWood` digits 0.2 m tall on each mat's front edge, upright as seen from the camera.
2. **Rule explanations.** Default: in tooltips on the chips. Other: always shown under the chips, in one line each.
3. **The party code.** Default: in the bar, beside "Invite friends". Other: back in the status card, as one line under the seats.
