# 05 · Home screen and first visit

Home keeps the look Brian has art-directed over six passes. This file fixes two real defects (the update sign covering the title, footer tips cut off for good) and adds a contrast check. The menu replaying its entry animation when a panel opens is fixed in file 15. Change 1 ships in milestone 1 (real defects); changes 2 and 3 in milestone 10.

## 1. What exists today (v0.7.4)
- The title is `TitleBoard` (`src/skin/components/TitleBoard.tsx`): a plank for the lead words, hanging tiles for the last word, the tagline, and the update sign (`<p className="sk-update">`, "The Fleece Navidad update", from `UPDATE_NAME` in `src/config.ts`).
- The update sign is placed by `.sk-update { position: absolute; top: 8px; left: 342px; … transform: rotate(4deg) }` (`src/skin/styles/skin.css:156-159`). On a phone `.sk-title-compact .sk-update` (`skin.css:160`) puts it in the flow, tilted -1.5°.
- The menu is eight rows with no card; only the row in focus gets the felt patch (`skin.css`, the "sixth pass" block from line 640; "No amber marker" at line 655).
- The word of the day is floating text that takes no clicks (`.sk-wotd`, `skin.css:1111-1139`; `src/skin/wotd/WordOfDay.tsx`).
- The footer is `text-[11px]` (`src/skin/screens/PaintedHome.tsx:398`); the rotating tip is one truncated line (`PaintedHome.tsx:469`, eight `TIPS` at `:77-85`).
- The developer lines ("Real people need the game server…", `NO_SERVER` at `PaintedHome.tsx:75`) show only in a build with no game server, never on the live site. The tour was run on such a build. No change.
- Onboarding (`src/skin/onboarding/Onboarding.tsx`) uses two native `<select>` controls (`:219`, `:226`); the kit has no dropdown (`src/skin/kit/index.tsx`).
- The old plan was wrong on: the paper word-of-the-day card, the plank menu board with an amber arrow, the paper tags on strings, the "offline" tag, a rebuilt set of loading doors, and the lock moved into Settings. All are dropped (section 2).

## 2. Decisions that bind this file
- 2026-11-08: the update plate "no longer shows the version and tilts (4° on a computer, -1.5° on a phone)" (CLAUDE.md:438). 2026-11-13: the tilted update plate was left alone on purpose (CLAUDE.md:1066-1067).
- 2026-11-08, Brian: "not a whole piece of paper, just make the text floating"; "It takes no clicks" (CLAUDE.md:430-434).
- 2026-11-13: "Don't redesign the loading screen again unless he asks" (CLAUDE.md:1098).
- 2026-11-13: "do not add new fake fasteners or fake wear to flat interface panels" (CLAUDE.md:1052).
- Home's menu is eight rows; 38 px rows (35 px at 740 px tall and under) so the caption clears the bottom bar at 1280 × 720 (CLAUDE.md:1564-1567). Do not add a ninth row without asking.
- 2026-11-14: the profile is the name box in the top left (CLAUDE.md:1233-1241, 257).
- 2026-11-14: Kai's first-visit form (country, age, a parent's click) is Kai's (CLAUDE.md:1535-1549).

## 3. Problems (verified)
1. The update sign covers the last title tile. Measured: D 43 to 47% covered at 1280 × 800, 1280 × 720, 1024 × 768 and 844 × 390; C 13%, E 32%, D 23% at 1440 × 900 and wider. Cause: `left: 342px` (`skin.css:157`) suited the two-line "Finish the Word"; the renames of 2026-11-15 made one row of seven tiles.
2. With a one-word title the lead plank renders empty, a 68 × 14 px stub above the tiles (`TitleBoard.tsx:19-24`). It carries the holly sprig. Left for Brian (section 8).
3. Six of the eight footer tips do not fit the 364 px slot at 1280 px wide and end in an ellipsis that can never be read (text widths 376 to 660 px).
4. At 844 × 390 (a phone on its side) four of the eight menu rows are below the window and the footer covers the Create lobby row. That is file 14's.

## 4. Changes

### 1. The update sign in the flow
- **What:** the sign sits under the tagline, at its present size and 4° tilt, and covers no tile at any width.
- **Where:** `src/skin/styles/skin.css` `.sk-update` (lines 156-159).
- **How:** `position: static; display: block; width: 150px; margin: 6px 0 0 <the tagline's left padding>` with `transform: rotate(4deg)` kept; font, padding, snow cap and nails unchanged. The phone rule `.sk-title-compact .sk-update` stays as it is.
- **Do not:** halve the sign, change its tilt, make it a button, or open update notes (the old plan's "click to open" is a new feature).
- **Cost:** CSS only, under 0.1 kB.
- **Check:** browser test in the painted suite (file 16, `e2e-painted/`, new): at 1280 × 720, 1280 × 800, 1024 × 768, 1440 × 900, 1920 × 1080 and 820 × 1180 the sign's bounding box meets no `.sk-title-tile` box (0 px overlap), and at 1280 × 720 the menu caption still clears the bottom bar.

### 2. The footer tip readable in full
- **What:** every tip can be read: it wraps to a second line instead of ending in "…".
- **Where:** `PaintedHome.tsx:469` (the `sk-tip` paragraph and its inner `truncate` span); `PaintedHome.tsx:398` footer `text-[11px]` raised to `text-[12px]`.
- **How:** replace `truncate` with `line-clamp-2`; the tip row grows to two lines only when the tip needs them.
- **Do not:** change the tips' words (the festive ones move under `FESTIVE`, file 13), the rotation interval (7 s, `:186`) or the links.
- **Cost:** none measurable.
- **Check:** at 1280 × 800 and 1024 × 768, for each of the eight tips: `scrollHeight <= clientHeight` on the tip element (nothing hidden), and the footer stays inside the window.

### 3. Menu contrast, measured
- **What:** a test proves the cream menu text reads on every farm shot. Nothing visible changes unless the test fails.
- **Where:** a browser test in `e2e-painted/` (new); `?pov=N` (`src/skin/scene/homePov.ts:28`) and `?hour=` (`src/skin/hooks/useAmbient.ts:13`) pin the shot and hour.
- **How:** for every shot and the four hours, sample the brightest 5% of pixels behind each menu label's box; the label's colour against that must give at least 4.5:1.
- **Do not:** bring back a card, board or amber marker behind the menu. If a shot fails, the fix (a stronger text shadow on that label) is shown to Brian as a before and after pair first.
- **Cost:** test only.
- **Check:** the test itself; its result goes in the milestone report.

### Onboarding
No change by the coder. The native selects stay (accessible, and Kai's form). Styling only the closed control is Kai's call (section 8).

## 5. Integrity (nothing floats, nothing breaks)
- The sign must not overlap the word of the day or the name plate at any tested size (file 14 holds the phone sizes 390 × 844 and 320 × 568).
- No `data-*` hook, `aria-*` label or the `sr-only` `<h1>` in `TitleBoard` changes.

## 6. Budget
This file adds no canvas, triangle or draw call. Home's 3D budgets are file 17's (High 2.5 M triangles one-second mean, 3.6 M peak; Medium 1.7 / 2.4; Low 1.4 / 2.1). Endless CSS animations on Home: 9 today, may only fall (file 15). Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] Sign test passes at six sizes; caption clears the bottom bar at 1280 × 720.
- [ ] Footer tip test passes for all eight tips.
- [ ] Menu contrast test recorded for every shot and hour.
- [ ] `npm test` green (includes `src/skin/__tests__/titleScreen.test.tsx`, `uiAudit.test.ts`).
- [ ] HUMAN: Brian sees the title at 1280 × 800 before and after.

## 8. Decisions for Brian
- The empty lead plank above the one-word title: remove it and keep the holly on the first tile's corner, or keep it as it is? Recommended: remove it.
- Kai: style the closed country and age selects to match the kit (native list kept), or leave them? Recommended: leave until Kai asks.
