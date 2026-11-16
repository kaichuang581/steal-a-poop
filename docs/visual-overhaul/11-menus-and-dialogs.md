# 11 · Menus, dialogs, settings, profile and legal pages

The dialogs, the profile and Settings are as Brian art-directed them. This file fixes one real defect (a disabled peg looks alive, which is why the tour thought Hint was broken), gives a new player's profile kinder empty wording inside the six slips, and turns the legal pages into a checklist for Brian and Kai. Change 1 ships in milestone 1; the rest in milestone 10.

## 1. What exists today (v0.7.4)
- Dialogs are kit frames (`src/skin/kit/index.tsx`, `Clipboard` at `:130`); the knitted fair-isle band is the top border of every kit panel (`src/skin/styles/kit.css:393-397`, `--kit-fairisle` at `:387`).
- Toggles are `Switch` (`src/skin/kit/index.tsx:157`); the lever is gone. The Trading Post and How to Play tabs are wooden boards.
- `.kit-peg` (`kit.css:261-272`) has no `:disabled` rule; `.kit-btn:disabled` (`kit.css:229`) and `button.kit-sign:disabled` (`kit.css:84`) do. A disabled peg still brightens on hover (`kit.css:266`).
- Hint is a tutorial-only button: `hints` is passed only when `input.learning` (`src/skin/screens/PaintedGame.tsx:516`), and it is `disabled={!myTurn}` (`src/skin/components/InputStrip.tsx:113`). On the play step it works (three ideas, a click types one). The tour hit it on a step with nothing to type.
- "Hide the scoreboard" works by click and by Enter (`PaintedGame.tsx:670-675`). The old plan's report was wrong.
- The leave dialog (`PaintedGame.tsx:532-541`): Stay is `WoodButton` (cranberry, focused), Leave is `Brass barn` (gold).
- The profile (`src/skin/profile/Profile.tsx`) always shows six slips (`:107-115`); a new player sees 0 and "–" with notes such as "played at the table".
- The developer lines ("needs the game server", `Profile.tsx:103`; "Ranks need the game server, which is not set up here.", `:289`) show only in a build with no game server. No change.
- The legal pages show a DRAFT banner while `LEGAL_REVIEWED` is false (`src/config.ts`); `e2e/legal.spec.ts:3` asserts they are marked draft. Their bodies (`docs/legal/*.md`) still say "Steal a Poop" on purpose.
- Esc closes every Home dialog and the Trading Post, but not the in-game sheets (`Sheet`, `PaintedGame.tsx:546`) or the leave dialog.

## 2. Decisions that bind this file
- 2026-11-13, Brian: "those stupid papers held up by pins"; "do not add new fake fasteners or fake wear to flat interface panels" (CLAUDE.md:1049-1052). No nails on dialogs.
- 2026-11-13: "`Lever` is `Switch`" (CLAUDE.md:1063).
- 2026-11-12, Brian: "the tabs look horrendous ... dont use the basic pin thing" (CLAUDE.md:769).
- 2026-11-13: the profile's numbers are "always six slips ... so no row has a hole" (CLAUDE.md:1006-1008).
- 2026-11-14: "No middle dot (·) between phrases, here or in anything new" (CLAUDE.md:1317).
- 2026-11-15: the legal documents in `docs/legal` are drafts for a lawyer and keep "Steal a Poop" (CLAUDE.md:1681, 1687).
- A new keyboard shortcut is ask-first (CLAUDE.md:24).
- Rejected: "a Play panel with settings before the lobby" (CLAUDE.md:649-650). The setup panels are not rebuilt as clipboards.

## 3. Problems (verified)
1. A disabled peg looks and hovers like an enabled one (`kit.css:261-272`). Measured on the tutorial: Hint at `[550, 746, 36, 36]`, `disabled`, brightening on hover.
2. A new player's profile is six slips of zeros with notes that read as records, not invitations.
3. The Night streak note joins two phrases with a middle dot: `` `nights in a row · best ${bestStreak}` `` (`Profile.tsx:113`).

## 4. Changes

### 1. A disabled look for pegs
- **What:** a peg that cannot be pressed looks it: faded, no hover glow, a not-allowed cursor.
- **Where:** `src/skin/styles/kit.css` after line 272.
- **How:** `.kit-peg:disabled, .sk-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }` (0.45 as `.kit-btn:disabled`), and the hover and active rules at `:266-267` gain `:not(:disabled)`.
- **Do not:** add a Hint button outside the tutorial, enable Hint off-turn, or change any peg's size or icon.
- **Cost:** under 0.1 kB CSS.
- **Check:** `npm test` (`src/skin/__tests__/uiAudit.test.ts`, `src/skin/kit/__tests__/kitContrast.test.ts` stay green); painted-suite test on the tutorial: the disabled Hint peg's computed opacity is 0.45 and its `filter` on hover is `none`.

### 2. Kinder empty wording on the profile, six slips kept
- **What:** a new player still sees six slips; zero slips invite rather than record, and one line above them says the numbers fill in as you play.
- **Where:** `src/skin/profile/Profile.tsx:107-115` (the `stats` array) and the "Your numbers" heading block (`:162`).
- **How:** when a local value is 0, its note becomes an invitation: Different words "play a game to start"; Wins "win a Quick Game"; Counting Sheep best "count sheep tonight"; Night streak "come back tomorrow night". When all five local values are 0, one line in the hand face sits under the heading: "Play a game and these fill in." The Night streak note with a value becomes "nights in a row, best N" (no middle dot).
- **Do not:** hide a slip, change the count (six), the grid (three across, two on a phone), the Online wins slip, or any stored number.
- **Cost:** a few strings.
- **Check:** a unit test under `src/skin/profile/__tests__/` (new file) renders the profile with an empty record: six slips, the four invitation notes, the line present; with one win the line is absent; no rendered text contains "·".

### 3. The fair-isle band follows the season
- **What:** while `FESTIVE` is on (today) nothing changes. When Brian turns the season off, kit panels lose the knitted band.
- **Where:** `kit.css:393-397`; `<html data-festive>` mirrored from `FESTIVE` in `src/config.ts` (ruling M17; the constant is added once, by whichever milestone needs it first; file 13 lists everything it gates).
- **How:** the `--kit-fairisle` layer applies only under `:root[data-festive]`; without it the 30 px top border shows the panel's plain wool.
- **Do not:** add nails, a wood edge or any new frame; do not change the band while the season is on.
- **Cost:** CSS only.
- **Check:** with `FESTIVE` on, the head-against-base pictures (file 16) are unchanged; HUMAN: Brian sees the season-off pair before the flag is ever set false.

### The legal pages: a checklist for Brian and Kai, not for the coder
The coder never edits `docs/legal/*`, `LEGAL_REVIEWED` or `e2e/legal.spec.ts`. The checklist, for Brian and Kai to work through with a lawyer or a legal clinic:
1. The service's name: "Steal a Poop" becomes "Fleeced" in every body.
2. The operator's legal name, address and contact email in place of each bracketed field.
3. What the site stores and counts: the visit counter and per-tab code (CLAUDE.md:1643-1645), the first-visit age answers, and that fonts are no longer fetched from Google once file 17's C13 ships.
4. The parent's on-screen agreement, which a lawyer has not checked (CLAUDE.md:1542, 1548-1549).
5. Then set `LEGAL_REVIEWED = true` in `src/config.ts`, which removes the DRAFT banner.

## 5. Integrity (nothing floats, nothing breaks)
- No `aria-label`, `data-*` hook or focus order changes. Stay keeps `autoFocus`.
- The profile's slip grid must not reflow at 1440 × 900, 820 × 1180, 390 × 844 or 320 × 568 when the extra line appears (no slip moves between rows).

## 6. Budget
No canvas, triangle or draw call. Profile: 31 endless CSS animations today (with Home's nine under it), may only fall (file 15). Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] Peg test and profile unit test pass; `npm test` green.
- [ ] Head-against-base pictures unchanged with `FESTIVE` on.
- [ ] No file under `docs/legal` changed (fence in `npm test`, file 16).
- [ ] HUMAN: Brian sees a new player's profile, before and after.

## 8. Decisions for Brian
- The leave dialog: today "Stay" is the red wooden button and "Leave" is gold. Make Stay the green cloth button (still focused) and Leave the red wooden button, so red marks the step you cannot undo? Recommended: yes, this dialog only; the kit's red and green elsewhere stay as they are.
- Esc in a game: should Esc close the How to play sheet, the chain sheet and the leave dialog, as it closes every Home dialog? It is a new keyboard shortcut, so it waits for you. Recommended: yes; default until you answer: no change.
- Before the season ends: may kit panels show plain wool in place of the knitted band when `FESTIVE` is off? Recommended: yes, after you see the pair.
