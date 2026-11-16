# 14 · Phones, short windows and safe areas

The phone layout mostly works upright. It fails in four places: a phone held sideways gets the computer layout with its word bar below the screen; a short computer window with many seats pushes the round tab and pegs off the top; on a small phone the Home header and the menu panel overlap; and nothing keeps the top bars clear of a notch. This file fixes those with layout, not redesign. Changes 1 to 3 are the short-window and sideways-phone defects of ruling C14 and ship in milestone 1; changes 4 and 5 ship in milestone 11.

## 1. What exists today (v0.7.4)
- The phone layout is chosen by `useIsMobile()` = `(max-width: 639px)` (`src/ui/hooks.ts:51`), used by `src/skin/screens/PaintedGame.tsx:103`, `:636`, `src/skin/screens/PaintedHome.tsx:131`, `src/skin/rooms/PaintedRoom.tsx:121`, `src/skin/dream/DreamScreen.tsx:78`, `src/skin/boards/BoardStage.tsx:61`. The skin also has `useDevice()` (`src/skin/device.ts`), which already calls a phone on its side a phone, but the layout does not read it.
- The keyboard is handled: `useViewport()` (`src/ui/hooks.ts:18`) sets `--vvh`, and the app box follows it (`src/ui/App.tsx:38`). With the keyboard up at 390 × 508 the word bar stays whole.
- On a computer the scoreboard sits in the flow above the word bar: `.sk-ledger { position: relative; margin: 70px 10px 0 auto }` (`src/skin/styles/skin.css:442`). The game root is `overflow-hidden` (`PaintedGame.tsx:376`); focusing the input scrolls it.
- On a phone, Home stacks the title and word of the day at `top-16` and the menu in a panel pinned to the bottom with `max-h-[64%]` (`PaintedHome.tsx:435-448`); the two are positioned independently.
- The in-game sheets cap their paper at `min(64vh, 560px)` (`skin.css:526`), measured on the layout viewport, not `--vvh`.
- `index.html:5` sets `viewport-fit=cover`. Safe-area insets are used only at the bottom (`src/skin/components/InputStrip.tsx:59`, `DreamScreen.tsx:385`) and on the right of "Show the scoreboard" (`skin.css:1095`). No top bar uses one.
- The old plan was wrong on: a collapsed word-of-the-day card, the update sign behind a "New" tag, a portrait row with tap-to-expand, bottom sheets with drag handles, and the stall as a header. All are dropped.

## 2. Decisions that bind this file
- 2026-11-08, Brian: the word of the day is floating text, no card, no clicks (CLAUDE.md:430-434).
- 2026-11-13: the tutorial's phone card docks under the row of names and rings `[data-tour="me"]` (CLAUDE.md:1139-1141; `src/skin/components/Ledger.tsx:81`).
- 2026-11-14: Home's menu is eight rows; a phone's menu scrolls in its own panel (CLAUDE.md:1564-1567).
- 2026-11-14: the lobby on a phone scrolls as one page; nothing moves when something is pressed (CLAUDE.md:1323-1334).
- 2026-11-12: the stall's `narrow` form is specified (CLAUDE.md:925-928).
- A new interaction is ask-first (CLAUDE.md:24): no bottom sheets, no drag handles, no tap-to-expand.
- Ruling M15: the dream's phone layout and its SPAN are file 09's.

## 3. Problems (verified, Chromium emulation)
1. 844 × 390 (phone on its side): computer layout. Table: scoreboard bottom at 408 px, prompt at 448, word bar at 482 to 622: all below the screen, and the root cannot scroll. Home: rows from Counting Sheep down start at 387 to 492 px; the footer covers Create lobby by 20 × 26 px and a click on it timed out.
2. 1366 × 657 with ten seats: the root scrolls when the input takes focus; the round tab, all four pegs and the first scoreboard row are above the window. By arithmetic (43 px a seat) seven seats already overflow.
3. 320 × 568 Home: the name plate overlaps the update sign and the word of the day.
4. 390 × 508 (keyboard up): the How to play sheet's top 116 px are above the window.
5. 390 × 844: the word of the day's pronunciation is 10 px (`skin.css:1135`).
6. No top, left or right safe-area inset on any top bar: on a notched phone in landscape or standalone the bars run under the cut-out [inferred; not tested on a real phone].

## 4. Changes

### 1. Phone layout for short touch screens
- **What:** a phone held sideways gets the phone layout.
- **Where:** `src/skin/device.ts`: a new export `usePhoneLayout()` matching `(max-width: 639px), (max-height: 500px) and (pointer: coarse)`; it replaces `useIsMobile()` in `PaintedGame.tsx` and `PaintedHome.tsx`.
- **How:** a `matchMedia` hook as `useMediaQuery` in `src/ui/hooks.ts`; nothing in `src/ui` changes. `PaintedRoom.tsx`, `BoardStage.tsx` and `DreamScreen.tsx` keep `useIsMobile()` until their own widths scripts (CLAUDE.md:1396-1402, 1521) are run at 844 × 390 and show a failure.
- **Do not:** edit `src/ui/hooks.ts`; change what a computer or an upright phone sees; change `useDevice()`.
- **Cost:** about 0.2 kB. Home's farm on a sideways phone uses the phone's resolution cap (`maxDpr` 1.5, `src/skin/table/FarmBackdrop.tsx`), which only lowers cost.
- **Check:** painted-suite test at 844 × 390 (touch): table top bar, word bar and Enter key wholly on screen; Home's eight menu rows reachable inside the panel; the footer overlaps no row.

### 2. The scoreboard out of the flow
- **What:** in a short window the round tab and pegs stay on screen; a long scoreboard scrolls inside itself.
- **Where:** `src/skin/styles/skin.css:442` `.sk-ledger`.
- **How:** `position: absolute; top: 70px; right: 10px; max-height: calc(100% - 70px - 190px); overflow-y: auto` (190 px = the word bar's 161 px plus the prompt's 29 px at 1280 × 800). Rows keep their 43 px.
- **Do not:** shrink the 18 px names, drop rows, or touch `data-seat`, `data-seat-name`, `data-seat-word`, `data-tour`.
- **Cost:** CSS only.
- **Check:** at 1366 × 657 with ten seats and at 1280 × 720 with ten seats, after the input takes focus: the game root's `scrollTop` is 0; `.sk-hud-tab`, the peg group, `.sk-input-bar` and the Enter key are wholly inside the window; the overlap test of file 13 holds.

### 3. Home on small phones: one column
- **What:** the title, word of the day and menu panel never overlap.
- **Where:** `src/skin/screens/PaintedHome.tsx:435-448`.
- **How:** one flex column under the top bar: the title block, then the panel with `flex: 1; min-height: 0; overflow-y: auto`, in place of two independently placed boxes (`top-16` and `bottom-2 max-h-[64%]`).
- **Do not:** change the title, the word of the day's look, the menu's rows or the footer's content.
- **Cost:** markup and classes only.
- **Check:** at 320 × 568, 390 × 844 and 844 × 390: `.sk-update`, `.sk-wotd`, the name box and the menu panel have no pairwise overlap; all eight rows reachable by scrolling the panel.

### 4. Sheets inside the visible screen
- **What:** with the keyboard up, the in-game sheets fit what the player can see.
- **Where:** `skin.css:526` `.sk-table-sheet .kit-clipboard-sheet`.
- **How:** `max-height: min(64vh, 560px, calc(var(--vvh, 100dvh) - 120px))`, 120 px being the clipboard's frame and title.
- **Do not:** turn sheets into bottom sheets or add a handle.
- **Cost:** CSS only.
- **Check:** at 390 × 508 the How to play and chain sheets are wholly inside the window.

### 5. Safe areas and the 10 px line
- **What:** top bars clear a notch; the smallest Home text is 11 px.
- **Where:** the game header (`PaintedGame.tsx:440`), Home's top row (`PaintedHome.tsx`, the icon-button row before line 435), the lobby beam (`.rm-bar`, `src/skin/rooms/PaintedRoom.tsx:152`), the leaderboards beam (`.sk-lb-bar`, `src/skin/boards/Leaderboards.tsx:257`); `skin.css:1135`.
- **How:** padding `max(<today's padding>, env(safe-area-inset-top))` on top, and the same with `-left` and `-right` on the sides. `.sk-wotd--compact .sk-wotd-say` from 10 px to 11 px.
- **Do not:** move anything on a screen with no inset (all insets are 0 on a computer).
- **Cost:** CSS only.
- **Check:** the head-against-base pictures (file 16) unchanged on computer sizes; HUMAN: one notched phone in landscape (the friends' check, file 16).

### Out of this file
- The speaker's name plate under the scoreboard strip with the keyboard up (390 × 508), and the turn board over the speech bubble at 390 × 844, are placement: the camera and plate framing are file 06's (rulings C11, M16). File 13's overlap test is the shared check.
- The table's canvas drawn 1.21 to 1.35 times too large (the swoop-in) is fixed in milestone 1 by files 06 and 17. Every phone picture here is judged after that fix.

## 5. Integrity (nothing floats, nothing breaks)
- The strip keeps `data-seat` and `data-tour="me"`; the tutorial's phone card still docks under it (`src/skin/tour/steps.ts:94`).
- No element may be reachable only by a horizontal page scroll at any tested size.

## 6. Budget
No new canvas or draw call. Sideways phones move to the phone resolution cap, which lowers pixels. Bundle: net-zero (ruling M4).

## 7. Acceptance
Test sizes for every check above: 390 × 844, 390 × 508 (keyboard up), 320 × 568, 844 × 390 (touch), 1366 × 657 and 1280 × 720 with ten seats, plus 1280 × 800 as the control.
- [ ] Top bar, word bar and Enter key wholly on screen at every size.
- [ ] File 13's overlap test passes at every size (after file 06's placement lands).
- [ ] Home: no overlap among title, word of the day, name box and menu; eight rows reachable.
- [ ] Sheets inside the visible screen at 390 × 508.
- [ ] Computer-size pictures unchanged except where change 2 moves the scoreboard (none at 1280 × 800 with six seats).
- [ ] HUMAN: the friends' check on a real phone, upright and sideways.

## 8. Decisions for Brian
None.
