# 13 · Typography, HUD and copy rules (apply everywhere)

The old plan's type scale, 24-colour wall, "one reading zone" and "no glow" rules cannot pass against today's code and would undo Brian's floating letters. They are replaced by ratchets (numbers that only fall), one overlap test with an exact definition, and a list of the copy the season flag gates. Two real defects are fixed: the "botWORD" join and duplicate SVG ids that hollow out wool balls. Changes 1 and 2 ship in milestone 1; the rest in milestone 10.

## 1. What exists today (v0.7.4)
- Sizes: 417 literal font sizes in `src/skin`, 35 distinct values. Under 11 px: 5 (`src/skin/boards/boards.css:64` a 9 px clamp floor, `:192` 10 px, `:208` 9 px; `src/skin/styles/kit.css:217` 9 px on `.kit-stitch`; `src/skin/styles/skin.css:1135` 10 px, the phone's word-of-the-day pronunciation). The old plan's "8 to 9 px" text was read off shrunken contact sheets: scoreboard second lines are 13 px, odds 17 px, tags and the footer 11 px.
- `--t-fast`, `--t-feedback`, `--t-carry` in `src/skin/styles/tokens.css:71-73` are durations, not type sizes. The old plan's `--t-*` type tokens would collide.
- Colours: 1,201 distinct colour values in `src/skin`, of them 267 in CSS (measured by UI, Round 1). A 24- or 72-tone wall cannot hold the stall, the bedroom or the item art.
- Floating text with a glow is a chosen look: the table's and the dream's word bars (`.kit-float`, `kit.css:454-503`), the name plates and speech bubble (`.sk-plate`, `.sk-say`, `src/skin/screens/PaintedGame.tsx:407-424`), the word of the day (`.sk-wotd`, `skin.css:1111`).
- Fonts: Fraunces, Nunito and Patrick Hand come from Google at run time (`src/skin/PaintedApp.tsx:37-47`), with `DotGothic16`, which no rule uses. The hand face falls back to `'Comic Sans MS', cursive` (`tokens.css:67`).
- The scoreboard's second line: `<span>bot{lastWord !== undefined ? ' ' : ''}</span>` then the word's span (`src/skin/components/Ledger.tsx:59-60`), inside `.sk-ledger-sub { display: flex }` (`skin.css:450`). The space ends a flex item and collapses: measured gap 0 px in five rows of five. It reads "botWHEEL".
- Every wool ball repeats `id="sk-wool-shade"` and `id="sk-wool-clip"` (`src/skin/components/Lives.tsx:41`, `:46`). `ScreenAnchor` hides an off-camera plate with `display: none` (`src/skin/table/Anchors.tsx:24`). When the first plate is hidden, every other ball's `url(#sk-wool-shade)` finds a hidden definition and its centre paints the page background (measured `(32, 64, 96)` in place of cream).
- `gameName.test.ts` (`src/skin/__tests__/`) already fails if the old painted name comes back. "Steal a Poop" stays in the classic look (`GAME_TITLE`, `src/config.ts`) and in `docs/legal` on purpose.
- There is no steal window (removed 2026-11-07); the old plan's "Steal it!" copy is struck.

## 2. Decisions that bind this file
- 2026-11-07: floating letters, "chosen by Brian from five mockups"; the word bars have no box (CLAUDE.md:249-251).
- 2026-11-08: name plates and the speech bubble over the animals (CLAUDE.md:333-338); the typed word "should be additional to the typing shown" (CLAUDE.md:337-338).
- 2026-11-08, Brian: the word of the day as floating text (CLAUDE.md:430).
- 2026-11-14: "No middle dot (·) between phrases, here or in anything new" (CLAUDE.md:1317).
- 2026-11-14: "do not shrink this text" (the lobby's rules line, CLAUDE.md:1390).
- 2026-11-07, Brian: "remove the steal feature entirely" (CLAUDE.md:288).
- 2026-11-15: the classic look and the legal drafts keep "Steal a Poop" (CLAUDE.md:1687).
- Ruling C6: no palette wall and no mass token sweep. Ruling C13: fonts ship with the game (file 17). Ruling M17: one `FESTIVE` constant.

## 3. Problems (verified)
1. "botWORD": the scoreboard's second line has no gap (above).
2. Hollow wool balls from duplicate SVG ids (above).
3. Five declared sizes under 11 px; at phone sizes the word of the day's pronunciation computes to 10 px.
4. Seasonal copy is always on; no season flag exists (`useSeason` in `src/skin/hooks/useAmbient.ts:23` is never called).
5. At 390 × 844 the turn board covers the speaker's speech bubble completely; with the phone keyboard up the scoreboard strip covers the speaker's name plate (file 14 and file 06 fix the placement; this file defines the test).

## 4. Changes

### 1. The scoreboard gap
- **What:** "bot WHEEL", with a visible gap; no middle dot.
- **Where:** `src/skin/styles/skin.css:450` `.sk-ledger-sub`; `src/skin/components/Ledger.tsx:59`.
- **How:** add `gap: 5px` to `.sk-ledger-sub`; drop the trailing `' '` from the `bot` span.
- **Do not:** add a separator character, shrink the 18 px names or the 13 px line, or touch `data-seat`, `data-seat-name`, `data-seat-word`.
- **Cost:** none.
- **Check:** painted-suite test: in an offline Quick Game, the horizontal gap between the `bot` span and `.sk-ledger-word` in each row is at least 4 px.

### 2. One id per SVG definition
- **What:** every wool ball paints its fill, whatever plate is hidden.
- **Where:** `src/skin/components/Lives.tsx:41-49`.
- **How:** `const id = useId()`; the gradient and clip ids become `` `${id}-shade` `` and `` `${id}-clip` ``, and their `url(#…)` users follow.
- **Do not:** change the ball's look, size or animation classes.
- **Cost:** none.
- **Check:** `npm test`: a new test under `src/skin/components/__tests__/` renders two `Lives` and asserts their ids differ; a source test fails on a literal `id="` inside an SVG `<defs>` in `src/skin`. Painted suite: with the first seat's plate hidden, a visible ball's centre pixel is cream (each channel within 16 of `(246, 231, 203)`).

### 3. Text-size ratchet (replaces the type scale and the 11/12/13 px floors)
- **What:** small text can only get rarer.
- **Where:** `RATCHETS.json` (file 16); a static count in `npm test`; a computed sweep in the painted suite.
- **How:** (a) static: count literal `font-size` values under 11 px in `src/skin` (5 today); the count may only fall. (b) computed: on Home, the barn table, the Trading Post's four tabs, Settings, the profile and the lobby at 1280 × 800, 390 × 844 and 320 × 568, count visible text nodes whose computed size is under 11 px; the count may only fall. (c) Raise `skin.css:1135` from 10 px to 11 px (file 14).
- **Do not:** tokenise every size, shrink any text, or touch the lobby's rules line.
- **Cost:** tests only.
- **Check:** both counts in the gate's report; a rise fails the gate.

### 4. Colour ratchet (replaces the palette wall)
- **What:** raw colours in the skin's CSS can only get fewer.
- **Where:** `RATCHETS.json`; a static count in `npm test`.
- **How:** count distinct hex, `rgb()` and `rgba()` literals in `src/skin/**/*.css` at milestone 0's base (UI counted 267); the count may only fall. Rebuilt models take colours from `T` in `src/skin/voxel/palette.ts` (file 01).
- **Do not:** repaint anything to meet a number.
- **Cost:** test only.
- **Check:** the count in `npm test`.

### 5. The overlap test (replaces "one reading zone" and "no text over the centre")
- **What:** no two HUD pieces cover each other during play.
- **Where:** `e2e-painted/layout.spec.ts` (new), run by `npm run gate`.
- **How:** a scripted offline Quick Game with 4, 6 and 10 seats, plus the tutorial, sampled every 100 ms from the doors opening to the end board. The set: the round tab (`.sk-hud-tab`), the top-right pegs (the `header` peg group at `PaintedGame.tsx:456-462`), the scoreboard (`.sk-ledger` or `.sk-ledger-strip`), every name plate (`.sk-plate`), the speech bubble (`.sk-say`), the word bar (`.sk-input-bar`), an alarm (`.kit-alarm-body`), and the tour card (`.sk-tour-card`). Fail if any two visible boxes intersect by more than 4 px in both width and height. Exempt: a bubble and its own plate (same `.sk-head`); a plate with another plate (the 3D placement of seats is file 06's). Sizes: 1280 × 800, 1366 × 657 (ten seats), 390 × 844, 390 × 508 (keyboard up), 320 × 568, 844 × 390.
- **Do not:** remove the floating letters, the plates, the bubble or the bomb's digits to pass; overlap is fixed by placement (ruling C11).
- **Cost:** about 1 minute of CI.
- **Check:** the test; until files 06 and 14 land, its failures are recorded, not blocking (report-only), then it becomes required.

### 6. Fonts
Shipped with the game by file 17 (ruling C13): Fraunces, Nunito and Patrick Hand as woff2 in `public/fonts/` with their licence texts; `DotGothic16` dropped from `PaintedApp.tsx:38` and the credits (`src/skin/components/PaintedCredits.tsx:57`); the hand stack in `tokens.css:67` ends in `system-ui`, never `cursive`. This file adds nothing.

### 7. The season's copy, behind `FESTIVE`
- **What:** seasonal words show only while `FESTIVE` is true (today: true, so nothing changes now).
- **Where:** `FESTIVE` beside `UPDATE_NAME` in `src/config.ts` (ruling M17; added once by whichever milestone needs it first), mirrored to `<html data-festive>`.
- **How:** gated, with what shows when off:
  - `CHEERS` (`PaintedGame.tsx:561`): "Ho ho ho!", "Jolly good!", "Fa la la la baa!", "Merry and bright!" are seasonal; "Nice one!" stays. Off: "Nice one!", "Good word!", "Well played!".
  - "Baa humbug!" (`PaintedGame.tsx:592`, the run board's title): off, "Run over".
  - `TIPS` (`src/skin/screens/PaintedHome.tsx:83-85`): the three seasonal tips leave the rotation when off.
  - Mounts: the holly on the title (`Holly`, `src/skin/components/TitleBoard.tsx:21`); `Garland` (`src/skin/rooms/PaintedRoom.tsx:178`, `src/skin/boards/Leaderboards.tsx:272`); the knitted band (file 11). 3D decorations and hats: files 04 and 03.
  - Not gated: the update sign, which shows `UPDATE_NAME`, the version's name.
- **Do not:** add a per-player switch; edit `docs/legal` or `GAME_TITLE`; change anything while `FESTIVE` is true.
- **Cost:** a few strings.
- **Check:** `npm test` renders the game's copy with `FESTIVE` false: no rendered text in `src/skin` matches `/ho ho|jolly|merry|holly|humbug|fa la|navidad/i` except `UPDATE_NAME`.

### 8. Middle dots ratchet
- **What:** no new middle dot between phrases; existing ones only go.
- **Where:** a static count in `npm test`.
- **How:** count lines in `src/skin/**/*.{ts,tsx}` (not tests, not dev-only pages) whose string literals contain "·" (39 lines today, for example `src/skin/share/card.ts:119`, `src/skin/ranked/RatedSlip.tsx:36`); the count may only fall.
- **Do not:** rewrite them all in this milestone; each goes when its screen is next touched.
- **Cost:** test only.
- **Check:** the count.

## 5. Integrity (nothing floats, nothing breaks)
- Name plates and bubbles stay pinned by `ScreenAnchor`; file 06's DOM-anchor check (within 2 px, ruling M18) covers them.
- The tutorial's rings find `.kit-float-need` and `.sk-input-bar` (`src/skin/tour/steps.ts`); those class names stay.

## 6. Budget
No canvas, triangle or draw call. The overlap test runs with draws skipped. Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] Gap test and SVG-id tests pass.
- [ ] Size, colour and middle-dot counts recorded in `RATCHETS.json`; none has risen.
- [ ] Overlap test runs on every pull request (report-only until files 06 and 14 land, then required).
- [ ] Season-off copy test passes; with `FESTIVE` true the head-against-base pictures are unchanged.
- [ ] HUMAN: Brian reads the season-off words before the flag is ever set false.

## 8. Decisions for Brian
- The off-season words: "Run over" in place of "Baa humbug!", and "Good word!" and "Well played!" beside "Nice one!" in place of the four seasonal cheers? Recommended: yes.
