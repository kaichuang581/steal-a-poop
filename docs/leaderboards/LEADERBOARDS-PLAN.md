# Fleeced: Leaderboards screen refinement (version 2)

Written 21 November 2026 from four screenshots of the Leaderboards screen (phone: Ranked; desktop at 1440 x 900: Level, Wins, Ranked). Give Claude Code this file and the four pictures. One pull request. **This replaces version 1 of this file completely.**

**This is Brian's own request.** Record it in `CLAUDE.md`. Nothing about how players are ranked changes; only how the screen looks and is laid out. Brian's two rules for this version:
1. Every part is specified in full, so nothing is left to guess.
2. **Nothing may look like a flat, empty, single-coloured card.** Every surface has texture, a lit edge, a shaded edge or side, and at least one detail (section 4).

**It builds on `PLAN_HOME_UI.md`.** It uses that plan's tokens and scale `--u` (section 3), and its slab, knit texture, states and banned list (section 7). If the slab is not in the code yet, build it first in `src/skin/kit/` exactly as that plan describes, then use it here.

**Units.** Every size is in px at `--u` = 1 and is multiplied by `--u`. A **step** is `--s` (3 px at `--u` = 1), as in Home. In the pixel-art grids, each character is one **art pixel**; each grid says how many px one art pixel is. Draw every grid with `shape-rendering: crispEdges` (SVG) or `image-rendering: pixelated` (PNG), never smoothed.

## 1. Scope

| In | Out |
|---|---|
| The screen in all three tabs, on phones and desktops: top bar, title tag, tabs, close button, the side panel (desktop) and sheet (phone), header, toggle, info button and its card, the table, your own row, empty and loading states, the name plates on the crates, snow caps, festive lights | How points, wins, XP and tiers are worked out; the data fetched; how many players are listed; routes; what any button does |
| The leaderboard stage's 3D set: the ground under the crates, the props on it, the distant islands, the camera, where the sheep stand, the light on them | The sheep models and their animations; the crates' carved and gilded numbers; the end-of-game podium in the barn |

Before changing anything, find the screen's files (search for "Ranked ladder" and "Highest level") and list them in the pull request. The stage may share the timber crates of `src/skin/table/Podium.tsx`. If it does, change only the leaderboard's own set and camera, never the end-of-game podium. If diorama plan milestone D5 has already rebuilt the crates, keep its crates.

## 2. What is wrong today

| # | Problem | Seen on the screenshots |
|---|---|---|
| 1 | It still uses the old wooden style | Wood-grain plank tabs, a wooden bar and panel. Home is moving to slabs (`PLAN_HOME_UI.md`) |
| 2 | The harshest contrast on screen | A near-black table inside orange wood, under a bright blue sky. Brian dislikes harsh colour contrasts |
| 3 | Flat, empty cards | The table, the "No rank yet" card and the dark name plates are each one flat colour with nothing on them. The "No rank yet" card is mostly blank; the desktop table has an empty band about 40 px tall under its last row |
| 4 | Three fonts and four label styles | Fraunces, Nunito in capitals and Patrick Hand; the 1st plate red and stitched, the 2nd and 3rd dark and dashed, the table with grey dashes, the "No rank yet" card in another style again |
| 5 | Numbers do not line up | Old-style figures: the 4 and 9 in "1,490" drop below the line |
| 6 | Name plates spill and wander | On the phone, "owen2008" and "bigmayafan18" stick out past their crates. On desktop the three plates sit on three different lines, up to about 80 px apart. Only the 1st plate is red |
| 7 | The crates' sizes mislead | The camera is angled, so on desktop the 3rd crate (about 195 px wide) looks wider than the 1st (about 180) |
| 8 | Blocky voxel clouds under the crates | Brian heavily dislikes blocky voxel clouds |
| 9 | The 1st sheep glares; the 3rd hangs off its crate | The 1st is much brighter and blurrier than the others. The 3rd's head and front legs overhang its crate's left edge. On the phone the 1st sheep's head touches the top bar |
| 10 | Phone and desktop disagree | Phone: no scores on the podium, the list repeats places 1 to 3, tier icons without tier names, tabs without icons, no privacy line. Desktop: the list starts at 4, tier names shown, tabs with icons |
| 11 | Tier pips repeat the tier name | Three small bars under each tier icon say the same as the I, II or III of the name |
| 12 | Unfinished edges | The lights stop at about 60% of the bar's width; the panel's snow cap is two pieces with a seam |
| 13 | Smooth snow | Round blobs with drips. Brian prefers stepped, textured snow |
| 14 | The Ranked hint uses menu words | "Choose Ranked under Queue to get a place." expects a new player to know where Queue is |

## 3. Tokens and type

**Colours.** Home's tokens, plus these. Use no other colour in the interface.

| Token | Value | Use |
|---|---|---|
| `--night-deep` | `#141D36` | Sides under dark surfaces, the shaded edge of boards, the floor of wells |
| `--ink-hi` / `--ink-side` | `#1D2947` / `#05080F` | Lit edge and side of `ink` pieces (Home's `ink` slab values) |
| `--gold` / `--gold-hi` / `--gold-lip` | `--lantern` / `--lantern-hi` / `--lantern-lip` | 1st place's rosette |
| `--silver` / `--silver-hi` / `--silver-lip` | `#D9E0EA` / `#F4F7FB` / `#8E9BB2` | 2nd place's rosette (matches the crate's white "2") |
| `--bronze` / `--bronze-hi` / `--bronze-lip` | `#D9925E` / `#F2B98C` / `#9A5B32` | 3rd place's rosette (matches the crate's copper "3") |
| `--ribbon` / `--ribbon-dark` | `--barn` / `#7E2B24` | The rosettes' tails |
| `--lantern-fold` | `#8A5216` | The fold under the title ribbon's overhang |
| Bulbs | `#F07A5A`, `#9CCB78`, `#FFD08A` | Festive lights (`PLAN_DEPTH_AND_LIGHT.md` section 3.3) |

Snow uses `--wool-hi` (face), white `#FFFFFF` (top row) and `--frost` (shade and speckles).

**Fonts.** Two only. Fraunces 800: titles, names, scores, tab labels, place numbers. Nunito 800 (700 where stated): all small text. No Patrick Hand on this screen.

**Numbers.** `font-variant-numeric: lining-nums tabular-nums` on every number, grouped with `Intl.NumberFormat` in the game's language (French gets its own separator).

**Case.** Sentence case everywhere, column headings included ("Player", "Points").

**Banned on this screen:** everything Home bans (wood grain, planks, ropes, nails, parchment, any gradient in the interface, any blurred shadow or glow, any rounded corner; the kit's `Board`, `WoodButton`, `Peg`, `Brass`, `Nails` and `Ropes`), plus dashed or stitched CSS borders, plus any surface larger than 40 x 40 drawn in one flat colour (section 4).

## 4. Surfaces: nothing flat

### 4.1 The rule

Every surface larger than 40 x 40 has all four of:
1. **Texture:** knit on light, small faces; felt on dark faces (4.2). Brian found a knitted texture across a whole screen "too messy", so large dark surfaces get the quieter felt, never knit.
2. **A lit edge:** a one-step row of a lighter colour along its top (and its left, on boards).
3. **A shaded edge or a side:** a one-step row of a darker colour along its bottom and right, or a visible side under it, as on Home's slabs.
4. **At least one detail:** an icon, a badge, a rosette, an inner frame with corner brackets, a ribbon or a snow cap. Section 4.4 says which, for every surface.

### 4.2 Textures

**Knit** (wool and lantern faces, and `ink` badges): Home's 16 x 12 tile, unchanged (black at 7%). On `ink` faces use the same tile in white at 4%.

**Felt** (every dark board, row, well and card): a 48 x 48 tile of one-step squares in fixed places, so it reads as pressed wool with no visible pattern. Draw it as an inline SVG, URL-encoded as Home's knit tile is, with `background-size: calc(48px * var(--u)) calc(48px * var(--u))`:

```svg
<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' shape-rendering='crispEdges'>
  <g fill='#fff' fill-opacity='.05'>
    <rect x='3' y='6' width='3' height='3'/><rect x='18' y='3' width='3' height='3'/>
    <rect x='33' y='9' width='3' height='3'/><rect x='42' y='24' width='3' height='3'/>
    <rect x='27' y='18' width='3' height='3'/><rect x='9' y='21' width='3' height='3'/>
    <rect x='15' y='36' width='3' height='3'/><rect x='36' y='39' width='3' height='3'/>
    <rect x='24' y='30' width='3' height='3'/><rect x='6' y='42' width='3' height='3'/>
    <rect x='45' y='12' width='3' height='3'/><rect x='30' y='45' width='3' height='3'/>
  </g>
  <g fill='#000' fill-opacity='.12'>
    <rect x='12' y='12' width='3' height='3'/><rect x='39' y='30' width='3' height='3'/>
    <rect x='21' y='42' width='3' height='3'/><rect x='30' y='0' width='3' height='3'/>
    <rect x='0' y='30' width='3' height='3'/><rect x='42' y='45' width='3' height='3'/>
  </g>
</svg>
```

**Snow speckle** (snow caps only): a 24 x 9 tile with two one-step squares of `--frost` at 45%, at (3, 3) and (15, 0).

### 4.3 Recipes

All recipes use Home's `.px` pixel corners and its three stacked layers (outline, side, face) where they have a side.

| Recipe | Outline | Face | Texture | Lit edge | Shaded edge / side | Extra |
|---|---|---|---|---|---|---|
| **Slab** | Home's | Home's variants | Knit | Home's | Home's side | Home's seven states on buttons; pieces that are not buttons (title tag, plates, your row) take no states and no pointer cursor |
| **Board** (panel, sheet) | One step of `--ink` | `--night` | Felt | One step of `--night-3` along the top, one step of `--night-2` down the left | One step of `--night-deep` along the bottom and down the right; a 6 side of `--night-deep` below; hard shadow `filter: drop-shadow(0 4px 0 rgba(14, 21, 40, 0.38))` | An inner frame and four corner brackets (below); a snow cap (section 9) |
| **Bar** (top bar) | None | `--night` | Felt | One step of `--night-3` along the top, under the snow cap | One step of `--ink`, then 3 of `--lantern`, along the bottom | Snow cap; light hooks |
| **Tile** (table rows) | None | `--night-2` | Felt | One step of `--night-3` along the top | A 3 side of `--night-deep` below | One-step pixel corners; a place badge |
| **Well** (column headings, toggle track, scroll track, empty state) | None | `--night-deep` | Felt | One step of `--night-2` along the **bottom** (a well is sunk, so its light is at the bottom) | One step of `--ink` along the **top** | One-step pixel corners |
| **Ink card** (the info card) | One step of `--night-3` | `--ink` | Felt | 3 of `--lantern` along the top, then one step of `--ink-hi` | A 3 side of `--ink-side` | A pointer and a padlock icon (section 7.3) |

Bevels are hard rows, written as stacked `inset` box-shadows with no blur, for example for the Board's face:

```css
box-shadow:
  inset 0 var(--s) 0 var(--night-3),
  inset var(--s) 0 0 var(--night-2),
  inset 0 calc(-1 * var(--s)) 0 var(--night-deep),
  inset calc(-1 * var(--s)) 0 0 var(--night-deep);
```

**The Board's inner frame.** One step of `--night-2`, drawn 3 steps inside the face's edge, all the way round, with `.px` corners. Where the title ribbon crosses it, the ribbon lies on top.

**Corner brackets.** At each of the frame's four corners, on top of the frame. Art pixel = one step (3 px). Top-left shown; mirror it for the other corners. `A` = `--night-3`, `B` = `--frost`.

```
AAAA
AB..
A...
A...
```

### 4.4 Every surface

| Surface | Recipe | Detail that stops it looking empty |
|---|---|---|
| Top bar | Bar | Snow cap; on desktop the title tag; festive lights and hooks |
| Title tag (desktop) | Slab `wool`, not a button | Podium icon |
| Tabs | Slab `lantern` (chosen) or `wool` | Tab icon |
| Close | Slab `wool` | Home's pixel cross |
| Panel / sheet | Board | Inner frame, corner brackets, snow cap with icicles, title ribbon |
| Title ribbon | Slab-like (section 7.2) | Tab icon, folded end, notched end |
| Divider | Groove | Snowflake |
| Toggle track | Well | Two slabs in it |
| Toggle buttons | Slab `lantern` (chosen) or `night` | Their labels |
| Info button | Slab `night` | Pixel "i" |
| Info card | Ink card | Pointer, padlock |
| Column headings | Well | Their labels |
| Rows | Tile | Place badge; tier icon on Ranked |
| Place badge | Mini slab `ink` | The number |
| Your row | Slab `wool`, not a button | Lantern bar, place badge, your avatar, "You" pennant |
| Scroll track and thumb | Well; thumb in `--night-3` | Thumb's lit and shaded rows |
| Empty list | Well | The tab's icon at 4× |
| Loading rows | Tile | Placeholder bars |
| Name plates on the crates | Slab `wool`, not a button | Rosette; the 1st plate's `--lantern` band |

## 5. Layout

**Desktop (when the part of the stage left uncovered is at least 360 wide)**

| Thing | Value |
|---|---|
| Top bar | Full width, 64 high, Bar recipe. The title tag 20 from the left, centred in the bar's height; the tabs 16 after it; close 20 from the right |
| Panel | Board recipe; width `clamp(400, 34vw, 480)`; 20 from the right; its top 20 under the lowest bulb (or under the bar when there are no lights); 20 from the bottom at most, shorter when its rows need less (6.5) |
| Stage | Behind everything. The crates are centred in the uncovered part, whose middle is at `(100vw − panel − 40) / 2`. Shift the picture the way Home does (a camera view offset), not by moving the set |

**Phone (otherwise)**

| Thing | Value |
|---|---|
| Top bar | 60 high, Bar recipe; the three tabs share the width less the close button, 8 apart, 12 from each side; no title tag |
| Stage | From under the bar (or the lowest bulb) to the sheet: 40% of the screen's height |
| Sheet | The rest, full width; Board recipe with pixel corners on top only and no side; the list scrolls inside it; your row pinned to its bottom |

## 6. Top bar

### 6.1 Title tag (desktop only)
A `wool` slab, not a button: 38 face plus a 4 side (42 in all); 12 padding each side. Inside: the podium icon at 24 (6.4), 8 gap, "Leaderboards" in Fraunces 800, 19, `--ink`.

### 6.2 Tabs
| Thing | Value |
|---|---|
| Size | 38 face plus a 6 side (44 in all); 132 wide on desktop; equal shares on phones |
| Chosen | `lantern` slab with knit |
| Not chosen | `wool` slab with knit |
| Content | Icon at 24 (6.4), 8 gap, label in Fraunces 800, 17, `--ink`. Narrower than 360: no icon |
| Behaviour | All of Home's slab states. A `role="tablist"`; Left and Right move between tabs |

### 6.3 Close
Home's 44 `wool` square with its pixel cross. Keep whatever closes the screen today (the button, Escape).

### 6.4 Icons
Art pixel = 2 px, so each 12 x 12 grid shows at 24. `X` = `--ink`. Draw them in code; when Brian's art arrives it replaces them as `ranked.png`, `wins.png`, `level.png` and `podium.png` in `src/skin/assets/leaderboard/`.

Ranked (a shield with two chevrons):
```
.XXXXXXXXXX.
.XXXXXXXXXX.
.XXXX..XXXX.
.XXX.XX.XXX.
.XX.XXXX.XX.
.XXXX..XXXX.
.XXX.XX.XXX.
.XX.XXXX.XX.
..XXXXXXXX..
...XXXXXX...
....XXXX....
.....XX.....
```
Wins (a cup):
```
.XXXXXXXXXX.
XXXXXXXXXXXX
X.XXXXXXXX.X
X.XXXXXXXX.X
.XXXXXXXXXX.
...XXXXXX...
....XXXX....
.....XX.....
.....XX.....
....XXXX....
...XXXXXX...
...XXXXXX...
```
Level (an arrow pointing up):
```
.....XX.....
....XXXX....
...XXXXXX...
..XXXXXXXX..
.XXXXXXXXXX.
....XXXX....
....XXXX....
....XXXX....
....XXXX....
....XXXX....
....XXXX....
....XXXX....
```
Podium (title tag):
```
............
............
....XXXX....
....XXXX....
....XXXX....
XXX.XXXX....
XXX.XXXX....
XXX.XXXX.XXX
XXX.XXXX.XXX
XXX.XXXX.XXX
XXX.XXXX.XXX
XXX.XXXX.XXX
```

### 6.5 Light hooks
Every 120 along the bar's bottom edge: a 6 x 6 square of `--night-3` with a one-step `--frost` top row. The wire hangs from these (section 9.2). With `FESTIVE` false there are no hooks.

## 7. The panel (desktop) and sheet (phone)

Inner padding: 16 at the sides and bottom; 24 at the top (room for the icicles). On phones: 12 at the sides.

### 7.1 Header layout
- **Desktop:** the ribbon at the left; at the right, on the ribbon's line, the toggle (Wins only) then the info button, 8 apart. The subtitle (if any) 8 under the ribbon.
- **Phone:** the ribbon at the left and the info button at the right on one line; the subtitle under them; on Wins, the toggle on its own line under that, the full inner width, its two halves equal.

### 7.2 Title ribbon
| Part | Value |
|---|---|
| Body | 40 high: one step of `--ink` outline; face `--lantern` with knit; one step of `--lantern-hi` along the top; one step of `--lantern-lip` along the bottom |
| Content | The tab's icon at 24 in `--ink`, 8 gap, the title in Fraunces 800, 20, `--ink`: "Ranked ladder", "Most wins", "Highest level". The title may shrink to 16 before it ends in "…" (French is up to 40% longer) |
| Left end (desktop) | Reaches 3 steps (9) past the panel's outer left edge. Under that overhang, a fold: a stepped right triangle 3 x 3 steps in `--lantern-fold`, its square corner against the panel's edge, as if the ribbon wraps round the panel |
| Left end (phone) | Starts 12 inside the sheet; cut into a V two steps deep, as the right end |
| Right end | Cut into a V two steps deep, in stepped edges: the outline follows the cut |
| Width | Content plus 16 on the left and 24 on the right (the V sits in the right padding) |

**Subtitle**, as today: Nunito 800, 12.5, `--frost`: "By ranked points" (Ranked), "By XP from games" (Level). Wins has none.

### 7.3 Toggle and info
**Toggle (Wins only).** A Well track, 38 high, 3 padding. In it, two slabs joined 3 apart, each 26 face plus a 3 side, labels in Nunito 800, 13: "This week" and "All time". Chosen: `lantern` with `--ink` text; other: `night` with `--wool` text. Each has a 44 tall click area. All of Home's slab states.

**Info button.** A `night` slab, 32 x 32 (26 face plus a 6 side), 44 click area. A pixel "i" in `--wool`, art pixel = 2 px:
```
.XX.
.XX.
....
XXX.
.XX.
.XX.
.XX.
.XX.
XXXX
XXXX
```

**Info card.** Opens under the button on a tap or hover, right-aligned to it; at most 240 wide. Ink card recipe. A pointer on its top edge, under the button's centre: a stepped triangle 4 steps wide and 2 tall in the card's outline and top-band colours. Inside, 12 padding: a padlock in `--lantern` (art pixel = 2 px), 8 gap, then "Only names are shown here, nothing else about a player." in Nunito 700, 13, `--frost`. It closes on a second tap, Escape or a tap elsewhere.
```
.XXXX.
.X..X.
.X..X.
XXXXXX
XX..XX
XX..XX
XXXXXX
XXXXXX
```

### 7.4 Divider
12 under the header, across the inner width: a groove of one step of `--ink` over one step of `--night-3`. At its centre, a gap of 30 holding a snowflake in `--night-3`, art pixel = 2 px (18 x 18):
```
....X....
.X..X..X.
..X.X.X..
...XXX...
XXXXXXXXX
...XXX...
..X.X.X..
.X..X..X.
....X....
```

### 7.5 Column headings
12 under the divider. A Well, 30 high. Labels in Nunito 800, 11.5, `--frost`, each centred on its column below: "#", "Player", then "Rank" / "Games" / "Level", then "Points" / "Wins" / "XP" aligned right.

### 7.6 Rows
6 under the headings. Each row is a Tile: on desktop a 34 face, a 3 side and a 3 gap (40 from row to row); on phones a 46 face, a 3 side and a 3 gap (52).

**Desktop columns**, left to right:

| Column | Width | Content |
|---|---|---|
| Padding | 6 | — |
| Place badge | 28 x 28 | A mini slab: face `--ink` with white knit at 4%; one step of `--ink-hi` along the top; a 3 side of `--ink-side`; one-step pixel corners. The place in Fraunces 800, 14, `--wool`, centred |
| Gap | 10 | — |
| Player | the rest | Fraunces 800, 16, `--wool`, one line, ending in "…" if too long |
| Gap | 8 | — |
| Third | 104 | Ranked: the tier icon at a whole multiple of its pixel size, no taller than 24, then 6 gap, then the tier name ("Titan II"). Wins: "323 games". Level: "Level 39". Nunito 800, 13, `--frost` |
| Gap | 8 | — |
| Score | 64, aligned right | Fraunces 800, 17, `--wool` |
| Padding | 12 | — |

**Phone columns:** padding 6; place badge 28; gap 8; on Ranked only, the tier icon (24) and an 8 gap; then two lines, the name (Fraunces 800, 16, `--wool`) over the third column's text (Nunito 800, 12, `--frost`); gap 8; score 64 (Fraunces 800, 17, `--wool`); padding 10.

**Rules for the list.**
- It starts at place 4 on every screen. Places 1 to 3 appear only on the podium, with their scores (8.5).
- Remove the three pips under every tier icon.
- The panel grows with its rows and stops at its bottom margin; past that, the rows scroll inside it. No empty space under the last row.
- If you are in the visible list, your row there gets a 6 wide `--lantern` bar at its left edge, inside the face.

### 7.7 Scrolling
Only when the rows overflow. A Well track 9 wide, 6 from the panel's right inner edge. The thumb: 9 wide, face `--night-3`, one step of `--frost` along its top, one step of `--night-2` along its bottom, one-step pixel corners. The rows' area narrows by 15 to make room.

### 7.8 Your row
Pinned under the list, 10 under the last visible row. A `wool` slab, not a button: on desktop a 46 face plus a 6 side; on phones a 52 face plus a 6 side; it grows if its text wraps.

| Part | Value |
|---|---|
| Lantern bar | At the face's left: 6 wide, `--lantern`, with a one-step `--lantern-hi` column at its left |
| Place badge | As in 7.6, 6 after the bar. Your place, or "–" if you have none |
| Avatar | 8 after the badge: a 32 square, `night` face, one-step pixel corners, holding the same avatar picture as Home's profile chip |
| Text block | 8 after the avatar, two lines. Line 1: a "You" pennant, then 6 gap, then your name in Fraunces 800, 16, `--ink`. Line 2: the third column's text in Nunito 800, 13, `--night` |
| "You" pennant | 20 high: face `--lantern` with knit, a 2 side of `--lantern-lip`, no outline; "You" in Nunito 800, 11, `--ink`, 6 padding on the left; its right end cut into a V one step deep |
| Score | 64 wide, aligned right, 12 from the right: Fraunces 800, 17, `--ink` |

**With no place**, line 2 holds a hint in Nunito 800, 13, `--night`, and the score column joins the text block:
- Ranked: "Play a ranked game to get a place." (new wording);
- Wins: "Win a game from the queue or in a lobby." (as today);
- Level: the score shows "0" and line 2 reads "Level 1 · Finish a game to get a place."

Update the French strings to match in meaning, and list them in the pull request for Brian to check.

### 7.9 Empty and loading states
- **No one listed:** a Well, 120 high, in place of the rows. Centred inside: the tab's icon at 48 (art pixel = 4 px) in `--night-3`, then 10 gap, then "No one has a place yet." in Nunito 800, 14, `--frost`.
- **Loading:** six Tiles in place of the rows. In each: the place badge with no number; a bar of `--night-3` 12 high and 40% of the name column wide where the name goes; a bar 12 high and 40 wide at the score. Bars have one-step pixel corners. Nothing moves. The real rows replace them when the data arrives.

## 8. The stage

### 8.1 The ground: one snowy island, no clouds
Remove every cloud. Under the crates, build one connected diorama piece:
- **Top:** stepped, textured snow in two tones from the scenery palette, steps one small voxel high, in a repeating pattern, never random.
- **Below:** two soil layers, then a stepped underside narrowing to a point (as the dream islands in `PLAN_DIORAMA_SCENERY.md` 6.7).
- **Size:** width 1.6 times the three crates' total width; depth 2.5 times a crate's depth.
- **Props on it** (the diorama recipes where they exist, today's models where not), all standing exactly on the snow, none hiding a crate's face from the camera:
  - two tiered pines at the back corners, about 1.8 m (left) and 1.4 m (right) tall;
  - one lantern post at the front right corner, its light inside its lantern;
  - a short fence behind the crates on the left: three posts and two rails, about 1.6 m long;
  - two hay bales with snow caps at the back right, one stacked half on the other;
  - a low snow mound (two or three small voxels high) against the foot of each crate, so the crates sit in the snow rather than on it.

**Distance.** Far behind, two smaller islands: one up and to the left, about 35% of the main island's size; one lower and to the right, about 25%. Both about three times as far away as the main island. Each is a snow top, a stepped underside and one small pine, in two flat pale tones (the sky's colour mixed 60% toward snow), so they read as far off. Keep today's sky.

### 8.2 The crates
The same width, the same depth and the same distance from the camera; 2nd left, 1st centre, 3rd right; gaps of 0.25 of a crate's width on desktop and 0.15 on phones; heights as today.

### 8.3 The camera
Straight on (no turn left or right), looking down 10°, vertical field of view 28°: a long lens, so the three crates appear the same width (within 2%). Framing: the crates and sheep fill 70% of the uncovered width on desktop and 92% of the width on phones. The 1st sheep at the top of its jump, trophy included, stays 24 below the bar (or the lowest bulb).

### 8.4 The sheep
Same models and animations.
- **1st:** no bloom or glow on the sheep (the trophy may keep its shine); its brightest wool on screen no brighter than the 2nd sheep's; no blur. If the depth plan's tilt-shift or any depth of field reaches this stage, turn it off here.
- **3rd:** keep the sleeping pose and its "z"s, but move it so its whole body lies on its crate's top. Nothing overhangs.
- The standing rule holds: no sheep is ever shown shorn.

### 8.5 Name plates
One design for all three: a `wool` slab, not a button, with knit: a 44 face plus a 4 side; one step of `--ink` outline; hard shadow `filter: drop-shadow(0 3px 0 rgba(14, 21, 40, 0.38))`. The 1st plate also has 3 of `--lantern` along the top, inside the outline.

| Part | Value |
|---|---|
| Rosette (desktop) | 8 from the left: art pixel = 2 px (20 x 28); gold for 1st, silver for 2nd, bronze for 3rd (grid below) |
| Text | 8 after the rosette, two lines: the name in Fraunces 800, 15, `--ink`; the score in Nunito 800, 12.5, `--night`: Ranked "2,240" after the tier icon at 16; Wins "212 wins"; Level "96,000 XP" |
| Padding | 10 on the right |
| Place | Centred on each crate's front face, its bottom 10 above the crate's front bottom edge, so all three share one line |
| Width | Content plus padding; at least 112 on desktop; at most the crate's width on screen less 8 |
| Phones | No rosette (the crate's number marks the place); 8 padding each side; width exactly the crate's width on screen less 8 |
| Long names | Shrink from 15 to 12, then end in "…". A plate never passes its crate's edges or comes within 12 of the screen's edge |
| When to place them | On resize and on camera change only, not every frame |
| Fewer than three players | The empty crate has no sheep; its plate reads "No one yet" in Nunito 800, 12.5, `--night`, and its rosette is drawn in `--wool-lip` and `--wool` only |

Rosette. `O` = the metal's `-lip`, `F` = the metal, `H` = the metal's `-hi`, `D` = the metal's `-lip`, `R` = `--ribbon`, `r` = `--ribbon-dark`:
```
..OOOOOO..
.OHHFFFFO.
OHHFFFFFFO
OHFFFFFFFO
OFFFDDFFFO
OFFFDDFFFO
OFFFFFFFFO
OFFFFFFFFO
.OFFFFFFO.
..OOOOOO..
..RRrrRR..
.RRr..rRR.
.RRr..rRR.
R.R....R.R
```

## 9. Snow and lights

### 9.1 Snow caps
Always on (they belong to winter, not to the festive season). One piece per edge, never two.

| Part | Value |
|---|---|
| Face | `--wool-hi` with the snow speckle (4.2); one step of white `#FFFFFF` along the very top |
| Bottom edge | Stepped, in a pattern repeating every 24: the face's height in steps, column by column (each column one step wide), is 3, 3, 2, 2, 3, 3, 3, 2. Under every column, one step of `--frost` as its shade |
| Top bar | Along its top edge; no icicles |
| Panel and sheet | Along their top edge, over the outline; plus icicles hanging into the top padding |
| Icicles | A pattern repeating every 96: icicles at 8, 30, 52 and 74 from the pattern's start, 9, 15, 6 and 12 long; each 6 wide at the top, narrowing by one step every 3 down; `--wool-hi` with a one-step `--frost` column on the right |
| Never | Round blobs, drips, a seam |

### 9.2 Festive lights
Only when `FESTIVE` is true; on both layouts; in front of the stage and behind the panel.

- **Wire:** 2 thick, `--ink`, across the full width of the top bar's bottom edge, hanging from the hooks (6.5). Between two hooks it sags 8 at the middle, drawn as 2 px steps (no smooth curve): at a distance x from the left hook, the drop is `8 × (1 − (2x / 120 − 1)²)`, rounded to 2.
- **Bulbs:** every 30 along the wire, in turn `#F07A5A`, `#9CCB78`, `#FFD08A`. Art pixel = 2 px (8 x 14). `c` = `--night-3`, `B` = the bulb's colour, `h` = white at 55%, `s` = the bulb's colour mixed 30% toward `--ink`:
```
.cc.
.BB.
BhBB
BhBB
BBBs
BBss
.ss.
```
- **Twinkle:** keep today's timing. A bulb that is "off" uses its colour mixed 45% toward `--ink`, never a glow. With `prefers-reduced-motion`, no twinkle.

## 10. Motion

| When | What | Time |
|---|---|---|
| Changing tab, or This week / All time | Rows fade in and rise 6, one after another | 140 ms each, 25 ms apart |
| | The panel's height eases to its new height | 160 ms |
| | The plates' text cross-fades | 120 ms |
| | If the top three change, the avatars change as they do today | — |
| The info card opens or closes | Fades | 100 ms |

Nothing else moves except the sheep's own animations and the lights' twinkle. Changing tab must not rebuild the 3D scene. With `prefers-reduced-motion`: no fade, rise or twinkle.

## 11. Checks, and what done means

1. Type check, all tests and the build pass. Tests pinned to the old screen are updated; no other test is changed.
2. **The surface test** (new, next to the screen's other tests): render the screen in each tab with sample data, and fail if any element larger than 40 x 40 has a background colour but none of the recipe classes (`slab`, `board`, `bar`, `tile`, `well`, `inkcard`, `snowcap`, `ribbon`).
3. Screenshots in the pull request of every tab, plus the empty and loading states, at 360 x 740, 390 x 844, 768 x 1024, 1280 x 720, 1440 x 900 and 1920 x 1080, in English and in French, next to the four pictures that came with this file. Nothing clipped; no sideways scroll.
4. A close-up screenshot at 2x of the ribbon, one row, your row, a plate and a snow cap, so Brian can see the texture, edges and details of section 4.4.
5. None of the banned items in section 3 is left on this screen.
6. The three plates lie on one line (within 2) and inside their crates.
7. The three crates appear the same width (within 2%).
8. No cloud on the stage; the island is one connected piece (zero loose pieces in the scene check, if it covers this stage).
9. Text contrast at least 4.5 to 1 everywhere, checked with `src/skin/kit/contrast.ts`. Tabs and buttons at least 44 high, or with a 44 click area.
10. Scores line up digit under digit.
11. With `FESTIVE` false: no lights, no hooks.
12. Frame time no worse than before.

**Changes Brian did not ask for, to confirm in the pull request:**
- the new Ranked hint, the "You" pennant, "No one yet" and "No one has a place yet.";
- the privacy line behind the info button on both layouts (it now appears on phones too);
- lists start at place 4 on phones; scores on the podium plates on phones;
- tier pips removed; tab icons added on phones;
- the decorations of section 4.4: the title ribbon with its fold, the snowflake on the divider, the corner brackets, the rosettes, the place badges, your avatar in your row;
- the props on the island (8.1).

## 12. Open choices for Brian (the defaults are used unless he says otherwise)

1. **The 3rd-place sheep.** Default: keeps sleeping, fully on its crate. Other: stands like the 2nd.
2. **Where the podium stands.** Default: the floating snowy island of 8.1. Other: inside the barn stage, the same set as the end-of-game podium.
3. **The Ranked hint.** Default: text only, as in 7.8. Other: a `lantern` "Play ranked" button in your row that opens Queue with Ranked chosen (this adds a function).
4. **Avatars on every row.** Default: no, because the info card promises that only names are shown. Other: each row shows the player's avatar in a 24 square after the place badge, and the info card's wording changes to match.
