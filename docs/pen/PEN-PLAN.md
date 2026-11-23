# Fleeced: the pen screen (queue and lobby), clearer and lighter

Written 22 November 2026 from a screenshot of the pen screen while queuing for a Casual game (desktop, 1280 x 800). Give Claude Code this file and the screenshot. One pull request.

**This is Brian's own request:** the screen "looks too chunky and really unclear". Record it in `CLAUDE.md`. It overrides the "Keep" line of `PLAN_DIORAMA_SCENERY.md` 6.6 for the screen's layout and panels, the name planks and where the sheep stand. Everything else in 6.6 stands.

**What stays exactly as it is:** every function and rule. That covers queueing, joining and leaving, the invite link, who may start, the minimum and maximum number of players, the rules editor, chat sending and moderation, pausing chat, and any host controls on other players. Only how the screen looks, where things sit and some wording change. Wording changes are listed in section 10.

**It builds on what is already built:**
- the slab, tokens, knit texture and scale `--u` of `PLAN_HOME_UI.md`;
- the surface recipes of `PLAN_LEADERBOARD.md` section 4: Board, Bar, Tile, Well, Ink card, felt texture, snow caps and festive lights, and its "nothing flat" rule.

If those recipes still live only inside the leaderboard's files, move them into the shared kit (`src/skin/kit/`) first, unchanged, and use them from there.

**Units:** as in `PLAN_LEADERBOARD.md`. Sizes are px at `--u` = 1. A step is `--s`. In pixel-art grids each character is one art pixel; each grid says its size, and `.` is transparent.

**Files to start from:** `src/skin/rooms/PenStage.tsx` and `src/skin/scene/pen.ts`. Search for "Open the gate" and "Finding players" to find the interface. List every file you change in the pull request.

## 1. Which screens

This screen appears whenever players gather in the pen before a game: the Casual queue (the screenshot), the Ranked queue and a lobby someone created. Find every way into it and list them in the pull request. The layout is the same for all of them. Only the title and the state text change, as in section 4.

## 2. What is wrong today

| # | Problem | Seen on the screenshot |
|---|---|---|
| 1 | Heavy panels hide the game | Three tall wooden panels fill the bottom 48% of the screen. About half of their inside is empty: one player row in a 330 px box, a 170 px gap of bare wood in Game, an empty chat |
| 2 | The pen is squeezed out | The pen, the scene's subject, sits in a strip about 110 px tall above the panels. The panels' tops cut through its front fence |
| 3 | You cannot see your own sheep | Only its back and hat show behind the fence. Its label "Brian2 host you" floats about 70 px above it, in two styles |
| 4 | The state is scattered | It appears in four places: an "In queue" tag, a "Finding players ··· 1/10" box, "1 player", and "Finding players..." inside the start button |
| 5 | Nothing says what happens next | Not how many players are needed to start, who can start, or whether it will start by itself |
| 6 | Mixed signals | "Leave queue" and "In queue" (looking for strangers) sit next to "Copy invite link", "Host" and "Change rules" (a private room). It is unclear which this is |
| 7 | The wrong thing shouts | The brightest thing on screen is "Copy invite link", in glowing orange. The button that starts the game is a muddy green block with snow on it, and when disabled it looks broken rather than "not yet" |
| 8 | Two controls for one thing | "Quick / Standard / Long" and "Change rules" both change the rules, with nothing linking them. "about 3 min" floats away from the choice it describes |
| 9 | Game words with no meaning | "2 turns a round · 3 wool balls · Twists on" means nothing to a new player |
| 10 | The chat shouts | "CHAT RULES: BREAK THEM AND YOU ARE SUSPENDED" is in capitals and takes about a third of the chat panel |
| 11 | A big action hides as a hint | "Pause chat for everyone", which affects everyone, is a tiny underlined link beside "Chat" |
| 12 | The old style | Wood planks, metal brackets, dashed stitching, charcoal boxes, round snow blobs with drips on every panel and on the button; three fonts (Fraunces, Nunito, Patrick Hand) |

## 3. The idea, in one picture

**The pen is the screen.** The sheep in the pen are the players, standing on numbered straw mats, and every empty mat is a free place.

A slim panel on the left answers three questions, from top to bottom:
1. What is happening?
2. Who is here?
3. What game will we play?

The chat is a small card at the bottom right that can be folded away. One orange button under the pen starts the game, and it always says why it can or cannot be pressed.

*An example.* A player joins. They see their sheep hop onto mat 1 in the pen. The panel says "Finding players…" and "Others will join you here". It shows a row of ten seats with one filled. The button under the pen reads "Open the gate: needs 1 more player". When a second sheep hops onto mat 2, the button lights up orange and reads "Start with 2 players".

## 4. States: what the screen says

Read the real rules from the code: the minimum players (`min`), the maximum (`max`, 10 in the screenshot), who may start, and whether a queue starts by itself after a wait. Then show exactly these. `{n}` is the number of players in the pen; `{need}` is `min − n`; `{host}` is the host's name. Use "player" when the number is 1 and "players" otherwise.

| State | Chip in the bar | Status headline | Status line 2 | Under the pen |
|---|---|---|---|---|
| Below `min`, you are the host | "Finding players" (lantern dot) | "Finding players…" | "Others will join you here. Invite friends to fill it faster." | The start button, disabled: "Open the gate" / "Needs {need} more player(s)" |
| Below `min`, someone else is host | "Finding players" | "Finding players…" | "{host} opens the gate when enough players are here." | A Well pill: "Needs {need} more player(s)" |
| At least `min`, you are the host | "Ready" (pasture dot) | "Ready when you are" | "More players can still join until you open the gate." | The start button, enabled: "Open the gate" / "Start with {n} players" |
| At least `min`, someone else is host | "Ready" | "Waiting for {host}" | "{host} opens the gate to start. More can still join." | A Well pill: "Waiting for {host} to open the gate" |
| Full (`n` = `max`) | "Full" (pasture dot) | "The pen is full" | Host: "Open the gate to start." Others: "Waiting for {host}." | As in the two rows above |
| Starting | "Starting" (lantern dot) | "Opening the gate…" | — | The start button in its busy state |
| Starts by itself (only if the code has this) | as above | as above | Adds a line: "Starts by itself in 0:30", counting down | as above |

**Waiting time.** Beside the headline: a clock icon and the time since you entered the pen ("0:42"), counted on the screen. Hide it once the state is Starting.

**Title in the bar:** "Casual game", "Ranked game", or the lobby's name for a created lobby (use the name the code already has; if it has none, "Your lobby").

## 5. Layout

### 5.1 Desktop (1000 wide or more, and 640 high or more)

| Thing | Value |
|---|---|
| Top bar | Bar recipe, 56 high, with its snow strip (no icicles) and, when `FESTIVE`, the lights |
| Left panel | Board recipe; width `clamp(300, 25vw, 360)`; 16 from the left; its top 16 under the lowest bulb (or the bar); 16 from the bottom at most, shorter if its content needs less. Snow cap with icicles on its top. Its content scrolls inside if it overflows |
| Chat card | Board recipe, **no snow cap** (only the panel and the bar carry snow); width `clamp(280, 24vw, 340)`; 16 from the right and the bottom; height `min(360, 45vh)`. When folded, it is only its 52 high header |
| The stage | The pen is centred in the space between the panel and the chat card, whose middle is at `(panel's right edge + chat's left edge) / 2`. Shift the picture with a camera view offset, as Home does |
| Under the pen | The start button (or the Well pill), centred on that same middle, its bottom 24 above the screen's bottom |

At 1280 x 800 the panel and chat together cover about 50% of the screen's area, against about 60% today. The pen itself is never covered.

### 5.2 Phones and narrow windows (otherwise)

| Thing | Value |
|---|---|
| Top bar | 56 high: the Leave button as an icon only (44 square), the title and chip, and Invite as an icon only (44 square) |
| Stage | 34% of the screen's height, under the bar |
| Sheet | Board recipe, from the stage to the start button, full width, with a snow cap and icicles. Inside it, from the top: the status card (6.1), then a tab row (5.3), then the chosen tab's content, which scrolls |
| Start button | Pinned to the bottom: full width less 24, 12 above the bottom safe area |

### 5.3 Phone tabs
Three joined slabs, 34 face plus a 6 side, sharing the sheet's inner width with 6 gaps: "Players {n}", "Game", "Chat". The chosen tab is `lantern`; the others are `wool`. Chat shows an unread count as a small `ink` tag with `--lantern-hi` text (Nunito 800, 11.5) when messages arrive while another tab is open. The default tab is Players.

## 6. The left panel

Inner padding: 16 at the sides and bottom, 24 at the top (for the icicles). Sections are 14 apart, each pair separated by a groove: one step of `--ink` over one step of `--night-3`, the full inner width. There is no snowflake here; it stays on the leaderboard.

### 6.1 Status card (what is happening)
A raised card: face `--night-2` with felt; one step of `--night-3` along the top; a 3 side of `--night-deep`; one-step pixel corners; a 6 wide `--lantern` bar at its left (`--pasture` when the state is Ready or Full). Padding 12.

| Line | Content |
|---|---|
| 1 | The hourglass icon (24, `--lantern`; grid 9.1), 8 gap, the headline in Fraunces 800, 18, `--wool`. At the right: the clock icon (12, `--frost`) and the waiting time, Nunito 800, 12, `--frost` |
| 2 | Line 2 of section 4: Nunito 800, 13, `--frost`, up to two lines. A countdown line, if there is one, follows in the same style but `--lantern-hi` |
| 3 | The seat row, 10 under line 2: `max` seats, each 16 x 16 (grids 9.2), 6 apart. Seats `1` to `n` are filled; the rest are empty. Right-aligned: "{n} of {max}", Fraunces 800, 15, `--wool` |
| 4 | Under seat number `min`: a small `--lantern` caret pointing up (3 steps wide, 2 tall), and under it "start" in Nunito 800, 11, `--lantern-hi`. It shows at a glance how many are needed. Hide it once `n` ≥ `min` |

If `max` seats will not fit in one row, make them 12 x 12 (the same grids at 1.5 px per art pixel) before wrapping to two rows.

### 6.2 Players (who is here)
- **Header:** the sheep-head seat icon (16, filled), 8 gap, "Players" in Fraunces 800, 17, `--wool`. At the right, "{n} of {max}", Nunito 800, 12.5, `--frost`.
- **One Tile per player** (a 34 face, 3 side, 3 gap), 8 under the header:

| Part | Value |
|---|---|
| Padding | 6 |
| Seat badge | A 28 x 28 `ink` mini slab (as the leaderboard's place badge) holding the player's mat number (6.5) in Fraunces 800, 14, `--wool`. This ties the row to the sheep in the pen |
| Avatar | 8 after it: a 28 square, `night` face, one-step pixel corners, the player's avatar picture (as on Home's profile chip) |
| Name | 8 after it: Fraunces 800, 15, `--wool`, one line, ending in "…" if too long |
| Tags | At the right, 6 apart. You: the "You" pennant from the leaderboard. Host: an `ink` tag 20 high with the crown (9.3) and "Host" in Nunito 800, 11, `--lantern-hi`. Bots: the tag they have today, in the same `ink` tag style |
| Host controls | Any control the host has today on another player's row stays, as a 28 square `night` slab with an icon, last in the row, with a tooltip saying what it does |
| Your row | A 6 wide `--lantern` bar inside the face's left edge |

- **Open places:** after the last player, one Well row, 34 high, reading "{max − n} open places" in Nunito 800, 13, `--frost`, with the empty seat icon (16) before it. Hide it when the pen is full.
- **More than five players:** the list shows five rows and scrolls inside itself (the leaderboard's scroll track and thumb).

### 6.3 Game (what we will play)
- **Header:** the gate icon (24, `--wool`; grid 9.4), 8 gap, "Game" in Fraunces 800, 17, `--wool`. If you are not the host: at the right, an `ink` tag with the padlock (the leaderboard's grid) and "Host chooses", Nunito 800, 11, `--frost`.
- **Length:** a label "Game length", Nunito 800, 12, `--frost`. 6 under it, three joined slabs (a 40 face plus a 6 side), sharing the width with 6 gaps:
  - line 1 in Fraunces 800, 15: "Quick", "Standard", "Long";
  - line 2 in Nunito 800, 11.5: each preset's estimate from the code, as "about 2 min";
  - the chosen one is `lantern` with `--ink` text; the others are `wool` with `--ink` on line 1 and `--night` on line 2.

  The separate "about 3 min" label is removed. For someone who is not the host, the slabs show their disabled look, except the chosen one, which stays `lantern`; clicking them does nothing, as today.
- **The rules, explained:** one Well, 10 under the length slabs, holding three lines separated by grooves. Each line is 46 high, with 10 padding:

| Icon (24) | Line 1: Fraunces 800, 15, `--wool` | Line 2: Nunito 700, 12, `--frost` |
|---|---|---|
| Rounds (9.5), `--frost` | "2 turns a round" | "How many turns each round has." |
| Wool ball (9.6), `--wool` and `--wool-lip` | "3 wool balls" | "Your lives. Run out of time and you lose one." |
| Twist (9.7), `--lantern` | "Twists on" (or "Twists off") | "A surprise rule each round." (Off: "No surprise rules.") |

  Check each explanation against the game's own rules and tutorial text. Where the game words it differently, use the game's wording, and keep it to one short line.
- **Change rules** (host only): a `wool` slab, the full width, a 34 face plus a 4 side, 10 under the Well. The gear icon (24, `--ink`; grid 9.8), 8 gap, "Change rules" in Fraunces 800, 14, `--ink`. It opens the rules editor as today. The editor itself is not part of this plan.

## 7. The bar, the chat card and the start button

### 7.1 Top bar
| Part | Value |
|---|---|
| Leave | A `wool` slab, a 34 face plus a 6 side, 16 from the left: the back arrow (24, `--ink`; grid 9.9), 6 gap, "Leave queue" (or "Leave lobby" in a created lobby) in Fraunces 800, 15, `--ink`. It does what it does today |
| Title | 16 after it: a `wool` slab that is not a button (as the leaderboard's title tag), with Home's Queue icon at 24 and the title of section 4 in Fraunces 800, 18, `--ink` |
| State chip | 10 after the title: an `ink` tag 26 high, pixel corners: a 6 x 6 dot (lantern or pasture, as in section 4), 6 gap, the chip text in Nunito 800, 12, `--wool`. While the state is "Finding players", the dot blinks (on 0.6 s, off 0.6 s); with reduced motion it stays on |
| Invite friends | 16 from the right: a `wool` slab, a 34 face plus a 6 side: the link icon (24, `--ink`; grid 9.10), 6 gap, "Invite friends" in Fraunces 800, 15, `--ink`. It copies the same link as today. For 2 s afterwards its label reads "Link copied" with a check mark. It is `wool`, never `lantern`: orange is kept for starting the game |

Remove the "Finding players ··· 1/10" box from the bar; the status card replaces it.

### 7.2 Chat card
| Part | Value |
|---|---|
| Header | 52 high, inside the card's top: the chat icon (24, `--wool`; grid 9.11), 8 gap, "Chat" in Fraunces 800, 17, `--wool`. At the right, 6 apart: for the host only, **Pause chat** as a `night` slab (a 28 face plus a 3 side) with the pause icon (24, `--wool`; grid 9.12) and "Pause chat" in Nunito 800, 12, `--wool`, with the tooltip "Stops everyone sending messages". When chat is paused it reads "Resume chat". Then **Fold**: a 28 square `night` slab with the chevron (grid 9.13), pointing down when open and up when folded |
| Rules strip | An Ink card strip, the full inner width: the shield icon (24, `--lantern`; grid 9.14), 8 gap, then in Nunito 800, 12, `--frost`: "Be kind: no swearing, nothing sexual, no slurs. Breaking these rules gets you suspended." Then "All the rules" as a link in `--lantern-hi`, underlined one step below the text. **Same meaning as today, in sentence case, nothing softened** |
| Messages | A Well that fills the rest of the card. Each message: the name in Fraunces 800, 13 (`--lantern-hi`; your own in `--wool`), then the text in Nunito 700, 13, `--wool`, wrapping. 8 between messages. Empty: the chat icon at 48 (4 px per art pixel) in `--night-3`, then "No messages yet. Say hi." in Nunito 800, 13, `--frost`, centred |
| Input | 10 under the Well: Home's text field (an `--ink` face, a 3 outline in `--night-3`, pixel corners), 40 high, placeholder "Be kind…" in `--frost`. Beside it, **Send**: a slab 40 high, `lantern` when there is text and the disabled slab when there is none |
| Folded | Only the header shows. An unread count appears beside "Chat" as an `ink` tag with `--lantern-hi` text. The choice to fold is remembered for the session |

The chat card has no snow cap and no icicles, so the bottom of the screen stays calm.

### 7.3 The start button: "Open the gate"
| Part | Value |
|---|---|
| Shape | A `lantern` slab with knit, 300 wide, a 56 face plus a 6 side, Home's hard shadow. **No snow on it** |
| Content | The gate icon (24, `--ink`), 10 gap, two lines: "Open the gate" in Fraunces 800, 20, `--ink`; under it, line 2 of the "under the pen" column of section 4 in Nunito 800, 12, `--ink` |
| Disabled | Home's disabled slab (face `#3A4664`, text `--frost`, a 2 side), with the same two lines. It reads "not yet", not "broken" |
| Busy | Home's busy state (three pixel dots) |
| Not the host | The button is replaced by a Well pill of the same size, 44 high, holding the "under the pen" text in Nunito 800, 13, `--frost`, centred |
| Keys | Enter starts the game when the button is enabled and no text field has focus |

## 8. The pen

### 8.1 Mats: one numbered place per player
- On the pen's floor, `max` straw mats on the pen's grid, in two rows (front and back), 0.8 m apart (0.7 m if the pen is too small).
- Each mat is 0.4 x 0.4 m, one S cell thick, in `straw`, with a one-cell `straw−1` rim.
- The mat's number (1 to `max`) is in `straw−1` cells, 0.15 m tall, on its front edge. The front row holds 1 to 5 from left to right; the back row holds 6 to 10.
- Each player stands on the mat matching their seat number (the order they joined, as the list shows). They face the camera, turned up to 10° toward the pen's centre.
- An empty mat shows a free place.
- Decorative farm sheep that are not players, if the pen has any, stand outside the mats, beside or behind the pen, so every sheep on a mat is a player.

### 8.2 Seeing the sheep
- **The pen's front side** (the side nearest the camera): posts with one rail at 0.35 m, so every face shows over it. The other three sides keep their rails. The gate sits in the middle of the front side: two halves, 1.6 m wide in all, the same height as the front rail plus a top board. Use the gate recipe if the diorama work has made one.
- **Camera:** looking down 20°. In the space between the panel and the chat card, the pen and the name plates on it fill 72% of the width. The plates' tops are at least 24 below the lowest bulb, and the gate's bottom is at least 24 above the start button. Every sheep's face on the back row shows above the front row's heads.

### 8.3 Name plates in the pen
- These replace "Brian2 host you".
- A slab that is not a button: a 26 face plus a 3 side, one step of `--ink` outline, knit, and the leaderboard plates' hard shadow.
- Yours is `lantern`; everyone else's is `wool`.
- Content: for the host, the crown (16 x 10) and a 4 gap; then the name in Fraunces 800, 13, `--ink`.
- Each plate floats 0.12 H above the top of its sheep's hat and stays centred over it.
- If two plates overlap on screen, the one further back moves up by its own height plus 4.

### 8.4 Movement
| When | What | Time |
|---|---|---|
| A player joins | Their sheep drops onto its mat from 0.6 m with a small squash on landing; its plate fades in | 350 ms |
| A player leaves | Their sheep hops up 0.3 m and fades | 300 ms |
| The gate opens (the game starts) | Both halves swing outward 100°, and every sheep turns toward the gate. This plays during the existing change of screen and **never delays it**: if the next screen is ready first, it cuts away | 500 ms, ease-out |
| Reduced motion | Sheep appear and disappear without moving; the gate does not swing | — |

## 9. Pixel art
Every grid is drawn with crisp edges. Unless stated, `X` is the colour given in sections 6 and 7, and the art pixel is 2 px, so a 12 x 12 grid shows at 24.

**9.1 Hourglass**
```
.XXXXXXXXXX.
..X......X..
..X.XXXX.X..
...X.XX.X...
....X..X....
.....XX.....
.....XX.....
....X..X....
...X....X...
..X..XX..X..
..X.XXXX.X..
.XXXXXXXXXX.
```
**9.2 Seats**, 8 x 8. Filled: `W` = `--wool`, `K` = `--ink`, `L` = `--wool-lip`. Empty: `O` = `--night-3`, `E` = `--night-deep`.
```
filled      empty
.WWWWWW.    .OOOOOO.
WWWWWWWW    OEEEEEEO
WWWWWWWW    OEEEEEEO
WWKWWKWW    OEEEEEEO
WWWWWWWW    OEEEEEEO
WWWWWWWW    OEEEEEEO
LLLLLLLL    OEEEEEEO
.LLLLLL.    .OOOOOO.
```
**9.3 Crown**, 8 x 5. `X` = `--lantern`, `L` = `--lantern-lip`.
```
X..XX..X
XX.XX.XX
XXXXXXXX
XXXXXXXX
LLLLLLLL
```
**9.4 Gate**
```
X..........X
XX........XX
XXXXXXXXXXXX
XX........XX
XX.X......XX
XX..X.....XX
XXXXXXXXXXXX
XX.....X..XX
XX......X.XX
XX.......XXX
XXXXXXXXXXXX
XX........XX
```
**9.5 Rounds**
```
....XXXXX...
..XX.....X.X
.X.......XXX
.X......XXXX
X...........
X...........
X..........X
X..........X
.X........X.
.X........X.
..XX....XX..
....XXXX....
```
**9.6 Wool ball.** `X` = `--wool`, `-` = `--wool-lip`.
```
....XXXX....
..XXXXXXXX..
.XX--XXXXXX.
.XXXX--XXXX.
XXXXXXX--XXX
XX--XXXXX-XX
XXXX--XXXXXX
XXXXXX--XXXX
.XXXXXXX--X.
.XXXXXXXXXX.
..XXXXXXXX..
....XXXX....
```
**9.7 Twist**
```
.....XX.....
.....XX.....
.X...XX...X.
..X..XX..X..
...XXXXXX...
XXXXX..XXXXX
XXXXX..XXXXX
...XXXXXX...
..X..XX..X..
.X...XX...X.
.....XX.....
.....XX.....
```
**9.8 Gear**
```
.....XX.....
..X.XXXX.X..
.XXXXXXXXXX.
..XXX..XXX..
.XXX....XXX.
XXX......XXX
XXX......XXX
.XXX....XXX.
..XXX..XXX..
.XXXXXXXXXX.
..X.XXXX.X..
.....XX.....
```
**9.9 Back arrow**
```
............
............
....X.......
...XX.......
..XXXXXXXXX.
.XXXXXXXXXX.
.XXXXXXXXXX.
..XXXXXXXXX.
...XX.......
....X.......
............
............
```
**9.10 Link**
```
............
.......XXX..
......X...X.
.....X....X.
....X.X..X..
.....X.XX...
...XX.X.....
..X..X.X....
.X....X.....
.X...X......
..XXX.......
............
```
**9.11 Chat**
```
............
.XXXXXXXXXX.
XXXXXXXXXXXX
XXXXXXXXXXXX
XX..X..X..XX
XX..X..X..XX
XXXXXXXXXXXX
.XXXXXXXXXX.
..XX........
..X.........
............
............
```
**9.12 Pause**: rows 1 to 10 are `..XXX..XXX..`; rows 0 and 11 are empty.

**9.13 Chevron**, 12 x 6.
```
X..........X
XX........XX
.XX......XX.
..XX....XX..
...XX..XX...
....XXXX....
```
**9.14 Shield**
```
.XXXXXXXXXX.
.XXXXXXXXXX.
.XXXXXXXX.X.
.XXXXXXX.XX.
.X.XXXX.XXX.
.XX.XX.XXXX.
.XXX..XXXXX.
.XXXXXXXXXX.
..XXXXXXXX..
...XXXXXX...
....XXXX....
.....XX.....
```
**9.15 Clock**, at 1 px per art pixel (12 x 12).
```
....XXXX....
..XX....XX..
.X........X.
.X...X....X.
X....X.....X
X....X.....X
X....XXX...X
X..........X
.X........X.
.X........X.
..XX....XX..
....XXXX....
```
When Brian's own icons arrive, they replace these as PNG files in `src/skin/assets/pen/`, with the same names.

## 10. Wording (before → after)

| Before | After |
|---|---|
| "← Leave queue" | The back-arrow icon and "Leave queue" ("Leave lobby" in a created lobby) |
| "Casual" with "In queue" | "Casual game" with the state chip of section 4 |
| "Finding players ··· 1/10" (bar) | Removed; the status card shows it |
| "Copy invite link" | "Invite friends", then "Link copied" for 2 s |
| "1 player" | "1 of 10" |
| "(you)", "HOST" | The "You" pennant; the crown with "Host" |
| "about 3 min" | Moved into each length button ("about 2 min" and so on) |
| "2 turns a round · 3 wool balls · Twists on" | Three explained lines (6.3) |
| "Open the gate" / "Finding players..." | "Open the gate" / "Needs 1 more player" (section 4) |
| "CHAT RULES: BREAK THEM AND YOU ARE SUSPENDED / No swearing, nothing sexual, no slurs. Keep it safe for kids." | "Be kind: no swearing, nothing sexual, no slurs. Breaking these rules gets you suspended." |
| "Pause chat for everyone" (link) | The "Pause chat" button, with its tooltip |
| "Brian2 host you" (label in the pen) | A plate: the crown, then "Brian2"; yours is orange |

New text: every line of section 4, "{n} open places", "Host chooses", the three rule explanations, "Resume chat", "start" under the seat row, and "Your lobby". Add French for each, matching in meaning, and list them in the pull request for Brian to check.

## 11. Banned on this screen
Everything `PLAN_LEADERBOARD.md` section 3 bans: wood, planks, brackets, ropes, nails, any gradient in the interface, blurred shadows or glows, rounded corners, dashed or stitched borders, Patrick Hand, and any surface larger than 40 x 40 in one flat colour. The orange `lantern` face is used only for the start button, the chosen tab or length, the "You" pennant, your plate and Send.

## 12. Checks, and what done means
1. Type check, all tests and the build pass. Tests pinned to the old screen are updated; no other test changes.
2. **The surface test** from the leaderboard, run on this screen in each state.
3. **Screenshots in the pull request**, next to the one that came with this file:
   - every state in section 4, as host and not host;
   - with 1, 2, 5 and 10 players;
   - chat empty, with 20 messages, folded, and paused;
   - each at 390 x 844, 768 x 1024, 1280 x 720, 1280 x 800 and 1920 x 1080, in English and French.

   Nothing clipped; no sideways scroll.
4. Every sheep's face in the pen is visible in every screenshot. No plate covers another plate or a face.
5. The start button's second line always matches the real rule (test it with `min` and `max` from the code).
6. The waiting time, the seat row and "{n} of {max}" agree with each other and with the pen.
7. Text contrast is at least 4.5 to 1 (`src/skin/kit/contrast.ts`). Every button is at least 44 high, or has a 44 click area.
8. No function changed: joining, leaving, inviting, starting, rules, chat and its moderation, pausing chat and host controls behave as before.
9. The gate animation never delays the start (measure the time from click to the next screen, before and after).
10. With `FESTIVE` false: no lights.
11. Frame time is no worse than before.

**Changes Brian did not ask for, to confirm in the pull request:**
- the numbered straw mats, and the lower front fence with the gate;
- the gate swinging open at the start;
- the chat card that folds;
- the "Invite friends" wording;
- the rule explanations;
- the waiting time;
- the "start" caret under the seat row.

## 13. Open choices for Brian (the defaults are used unless he says otherwise)
1. **Chat when the screen opens.** Default: open. Other: folded, showing only its header.
2. **Mats in the pen.** Default: numbered straw mats. Other: no mats, with sheep simply standing in two rows.
3. **The gate swings open at the start.** Default: yes. Other: no.
4. **Rule explanations.** Default: always shown under each rule. Other: hidden behind a small "i" on each rule.