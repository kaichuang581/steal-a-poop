# 15 · Motion and feel

Most of the motion the old plan asked for already exists, and some of what it asked to remove Brian asked for. This file keeps the motion and makes it behave: the computer's own "reduce motion" setting gets the same treatment as the game's switch, endless CSS animations animate only `transform` and `opacity`, Home's endless animations pause under full pages, and the Home menu stops replaying its entry when a panel opens. Ships in milestone 11.

## 1. What exists today (v0.7.4)
- Reduced motion, global: `src/index.css:39-45` (`@media (prefers-reduced-motion: reduce)`) and `:56-60` (`html.reduce-motion`) cut every animation and transition to 0.001 ms. `tokens.css:82-85` zeroes the skin's duration tokens for both.
- The class `reduce-motion` is set from the game's switch alone (`src/ui/App.tsx:28`); `useReduceMotion` (`src/ui/useReduceMotion.ts`) joins the OS setting and the switch for JavaScript only. So 15 skin rules keyed only on the class (`src/skin/styles/skin.css:252, 300, 331, 335, 412, 502, 524, 679, 680, 693, 916, 1106`; `src/skin/dream/dream.css:156, 162`; `src/skin/styles/kit.css:364`) never apply for a player who set it on the computer, and two media rules (`skin.css:390`, the garland; `kit.css:378`) never apply for the switch. Measured: with the OS setting only, Home and the Trading Post run 0 animations, the barn table 1 (`sk-turn-call`, not endless), but `<html>` has no `reduce-motion` class.
- Endless animations: 45 `infinite` declarations; six animate something other than `transform` or `opacity`: `kit-alarm-throb` (box-shadow, `kit.css:346`, `:362`), `sk-halo` (box-shadow, `skin.css:73`, `:44`), `sk-caret` (border-color, `skin.css:115`, `:45`), `sk-title-glow` (filter, `skin.css:145`, `:167`; one tile on Home at all times), `sk-garland-blink` (opacity and filter, `skin.css:377`, `:389`), `sk-speaker` (box-shadow, `skin.css:1223-1224`).
- Counts of endless animations running: Home 9 (seven `sk-title-sway`, one `sk-title-glow`, one `sk-wotd-sway`), the profile 31, the Trading Post 35 to 39, the machine 66, the barn table 3. Home's nine keep running under the Trading Post, the leaderboards and the profile, which cover it.
- Opening any setup panel re-renders the menu inside a new `inert` wrapper (`src/skin/screens/PaintedHome.tsx:456`), so React remounts it and `sk-menu-in` (420 ms, `skin.css:171`) plays again.
- Already built: idle blinks, ear twitches and chews (`src/skin/table/Sheep.tsx:464-466`); board swing-in (`kit-swing-in` 300 ms, `kit.css:48-50`); the word burst; the finale (`FINALE = { bang: AFTERMATH_MS, winner: 2400 }`, `src/skin/screens/PaintedGame.tsx:72`).
- Hint is tutorial-only and disabled off-turn by design; Hide the scoreboard works. The disabled look is file 11's change 1.

## 2. Decisions that bind this file
- 2026-11-13, Brian on the finale: "rn its too abrupt" (CLAUDE.md:838); the beat after a bomb, "make some sort of a pause" (CLAUDE.md:824-826): both run 2.4 s.
- 2026-11-07, Brian: "remove the steal feature entirely" (CLAUDE.md:288): no steal whoosh.
- 2026-11-08: "The ledger and the round tab no longer hang on ropes" (CLAUDE.md:338); 2026-11-14: "Nothing moves when something is pressed" in the lobby and leaderboards (CLAUDE.md:1323, 1436).
- 2026-11-08 and 2026-11-13, Brian: "why is there static noise"; "Tones only, no noise" (CLAUDE.md:340, 945-946): no new sounds in this file.
- 2026-11-08: the word of the day sways like the title's tiles and is still under reduced motion (CLAUDE.md:436-438).
- Ruling M9: idle animal life is never what keeps a scene drawing; pacing is file 17's.

## 3. Problems (verified)
1. A player whose computer asks for reduced motion still gets the 15 class-only rules' motion where the global cut does not reach (for example `sk-turn-call` runs).
2. Six endless animations repaint (box-shadow, filter, border-color) every frame they run.
3. Home's nine endless animations run under full pages that hide them.
4. The menu replays its entry when a setup panel opens.
5. Three declared transitions are longer than 400 ms (longest 700 ms).

## 4. Changes

### 1. The OS setting mirrors the switch (CSS only)
- **What:** "reduce motion" on the computer and the game's switch give the same result.
- **Where:** the 15 class-only rules listed in section 1; `skin.css:390`; `kit.css:378`.
- **How:** each class-only selector gains a twin inside an `@media (prefers-reduced-motion: reduce)` block in the same file, with the same declarations; the two media-only rules gain a `:root.reduce-motion` twin.
- **Do not:** edit `src/ui/App.tsx` or `src/index.css`; change what plays with both settings off; stop the word of the day's tilt.
- **Cost:** about 1 kB of CSS before gzip.
- **Check:** painted-suite test, emulating `prefers-reduced-motion: reduce` with the switch off, and again with the switch on and the OS setting off: on Home, the Trading Post, the barn table and the profile, 0 running animations with an infinite iteration count, and the same computed `animation-name` on every element under both runs.

### 2. Endless animations: transform and opacity only
- **What:** the six animations look the same but stop repainting.
- **Where:** `kit.css:346`, `:362`; `skin.css:44-45`, `:73`, `:115`, `:145`, `:167`, `:377`, `:389`, `:1223-1224`.
- **How:** each glow or outline moves to a `::after` layer that holds the keyframes' peak style (the same box-shadow, outline or brightened copy), and the keyframes animate that layer's `opacity` between the old start and peak. `sk-caret` animates `opacity` of the caret itself (`steps(1)` kept). `sk-garland-blink` keeps its opacity and drops `filter`.
- **Do not:** remove the garland, the title's lit tile glow, the alarm's throb, the speaker's ring or the caret; change their timing.
- **Cost:** CSS only.
- **Check:** `npm test`: a source test parses `@keyframes` used with `infinite` in `src/skin/**/*.css` and fails if any property other than `transform`, `opacity`, `rotate`, `translate` or `scale` is animated. HUMAN: Brian sees Home's title and an alarm before and after.

### 3. Home pauses under full pages
- **What:** Home's sway and glow stop while the Trading Post, the leaderboards or the profile cover it.
- **Where:** `PaintedHome.tsx:409` (`<main className="sk-home">`); `skin.css`.
- **How:** `data-covered` on `<main>` when `bazaar || boards || profile`; `.sk-home[data-covered] :is(.sk-title, .sk-wotd) :is(*, *::before, *::after), .sk-home[data-covered] :is(.sk-title, .sk-wotd) { animation-play-state: paused; }`.
- **Do not:** pause anything inside the covering page; change the farm's own pause (`paused={bazaar || boards}`, `PaintedHome.tsx:410`, file 17).
- **Cost:** CSS and one attribute.
- **Check:** with each page open, `document.getAnimations()` filtered to Home's title and word of the day: every one `playState === 'paused'`; after closing, `running`.

### 4. The menu stays mounted
- **What:** opening a setup panel dims the menu without replaying its entry.
- **Where:** `PaintedHome.tsx:456`.
- **How:** always render `{tables}` inside one wrapper; toggle `inert` and the `pointer-events-none opacity-40` classes on that wrapper by `step`.
- **Do not:** change the menu's rows, order, focus rules or its 420 ms entry on first show.
- **Cost:** none.
- **Check:** painted-suite test: open and close the setup panel; the menu's first row is the same DOM node before and after, and no `sk-menu-in` animation starts.

### 5. Long transitions only fall
- **What:** no new UI transition or entry over 400 ms; today's three stay.
- **Where:** `RATCHETS.json` (file 16).
- **How:** count declared transitions and one-shot entry animations over 400 ms in `src/skin` (3 today); the count may only fall. Exempt by name: the finale (`FINALE`), the beat after a bomb, alarms, the barn doors.
- **Do not:** shorten the finale, the beat or the alarms.
- **Cost:** test only.
- **Check:** the count in `npm test`.

## 5. Integrity (nothing floats, nothing breaks)
- A `::after` glow layer must sit exactly on its element (inset 0, same border radius); the head-against-base pictures with motion reduced (file 16) must not change.
- No change to `ScreenAnchor` or any element it positions.

## 6. Budget
Endless animations running, per screen: Home 9, profile 31, Trading Post 35 to 39, machine 66, barn table 3. These may only fall and are recorded in `RATCHETS.json`. Under either reduced-motion setting: 0 endless on every screen. No canvas, triangle or draw call. Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] Both reduced-motion runs give 0 endless animations and identical computed animation names.
- [ ] Keyframes source test passes.
- [ ] Home's animations paused under the three pages.
- [ ] Menu node kept across a panel.
- [ ] Long-transition count has not risen.
- [ ] HUMAN: Brian sees Home's title and an alarm before and after change 2.

## 8. Decisions for Brian
None in this file. Esc closing in-game sheets is asked in file 11.
