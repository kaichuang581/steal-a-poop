# Finish the Word: painted redesign plan for Claude Code

Version 1.0, 3 November 2026. Written for an AI coding agent (Claude Code) working in the existing React / Next.js (TypeScript) repository. The human-readable version of this plan, with sources and background, is the Google Doc "Finish the Word: visual redesign plan". The visual reference is the artifact "Finish the Word Style Board".

---

## 0. For Brian: how to hand this file to Claude Code

1. Save this file in the repository as `docs/REDESIGN_PLAN.md` and commit it.
2. Create or open `CLAUDE.md` at the repository root (run `/init` inside Claude Code if there is none) and paste the block in Part 1 below. Keep it short; it loads in every session.
3. In the repository folder run `claude`. Start the first session with:

   ```
   Read @docs/REDESIGN_PLAN.md. Do Part 2 (discovery) only. Write docs/skin/DISCOVERY.md and stop so I can review it.
   ```

4. After you have reviewed `DISCOVERY.md`, run one milestone per session:

   ```
   Read @docs/REDESIGN_PLAN.md and @docs/skin/DISCOVERY.md. Do Milestone 1 exactly as specified, then run the verification steps and report.
   ```

5. Use plan mode when you want to see the approach before any file changes (see "Plan before editing" in the Claude Code docs: https://code.claude.com/docs/en/common-workflows). Review every diff; the guardrails in Part 1 are instructions, not enforcement. If you want hard enforcement of the "never touch the engine" rule, add a PreToolUse hook (https://code.claude.com/docs/en/hooks-guide).

Reference: how CLAUDE.md and `@path` imports work: https://code.claude.com/docs/en/memory

---

## 1. Guardrails (paste into CLAUDE.md)

```markdown
## Painted redesign (visual layer only)

The redesign plan is docs/REDESIGN_PLAN.md. The discovery map is docs/skin/DISCOVERY.md.

### Hard rules
- This is a VISUAL redesign. Never change game behaviour: rules, timers, scoring, the pile, banking, stealing,
  penalties, traps, round twists, bots, difficulty, the word list, typo detection, networking, or persistence.
- Write new code only under src/skin/ (components, hooks, styles, assets). The only files outside src/skin/
  you may edit are the page-level switch files listed in DISCOVERY.md under "Switch points", and only to
  mount the new components behind the feature flag.
- Never edit, delete or rename any file listed in DISCOVERY.md under "Engine files (do not touch)".
- Never change the props, callbacks or return values of existing components or hooks. The skin adapts to them.
- Never modify existing tests. Add new tests under src/skin/ only.
- The old look must keep working. All new UI mounts only when NEXT_PUBLIC_SKIN=painted (or ?skin=painted).
- The words "Ghibli", "Miyazaki", "Totoro" and any Studio Ghibli film title must not appear anywhere:
  code, comments, asset names, commit messages, or image prompts. Describe the style as "painted" or "storybook".
- No new dependencies except: framer-motion. Ask before adding anything else.
- Before each milestone: read the milestone's acceptance criteria. After: run `npm run build`, the type check,
  and the test command from DISCOVERY.md, and report results. Do not report a milestone done if any fails.

### Ask first (stop and ask Brian) when
- A visual needs a game-state field that the store does not expose.
- Any change outside src/skin/ seems necessary beyond the switch points.
- A design item would require a feature change (for example a new keyboard shortcut or a new setting).
- Two instructions in this plan conflict.
```

---

## 2. Discovery (first session; produces `docs/skin/DISCOVERY.md`)

Do not write any skin code in this session. Map the repository and write `docs/skin/DISCOVERY.md` with these sections:

1. **Stack**: Next.js version, App Router or Pages Router, React version, TypeScript config, styling system in use (CSS Modules, Tailwind, styled-components, plain CSS), existing fonts, existing animation libraries, test runner and the exact commands for build, type check, lint and test.
2. **State**: the state library (Zustand, Redux, React Context, XState, custom) and the file(s) holding game state. For each field in the `TableView` type in Part 4.1, the exact store path or selector that provides it, or "not exposed". For each `VisualEvent` in Part 4.2, whether the engine emits an event (name and file) or whether it must be derived from state diffs.
3. **Screens**: for each screen (Home, Quick Game setup, Table, Round transition, Results, Daily Table, Practice, Tutorial, Rooms lobby, Settings), the component file that renders it and the route.
4. **Switch points**: the smallest set of files (ideally one per screen, or one layout file) where the new skin can be mounted behind the feature flag.
5. **Engine files (do not touch)**: every file implementing rules, timers, scoring, bots, word list, typo detection, networking, persistence, and their tests.
6. **Existing callbacks**: the functions the current UI calls to play a word, bank, steal, change the typed text, choose bots and difficulty, start a game, continue after a round, and open settings, with their signatures.
7. **Timer**: how the turn clock runs (interval, requestAnimationFrame, server), how `secondsLeft` and the 3-second steal window are represented, and whether the window is exposed as a boolean.
8. **Gaps**: anything the skin needs that is not available (see Part 4) and the smallest read-only way to obtain it.

Stop after writing the file. Do not proceed to Milestone 1 in the same session.

---

## 3. The game (reference for deriving visuals)

Everything below already exists and must not change. It is listed so the skin can represent it.

- Chain: each word starts with the last letter of the previous word. Words need 3+ letters and must be in the built-in list.
- Structure: 3 rounds, 5 turns per player per round.
- Turn clock: 10 seconds, minus 1 second per 10 points in the pile, minimum 5 seconds.
- Pile: valid words add points to a shared pile. Banking takes the whole pile into the banker's score and resets the pile.
- Steal: in the last 3 seconds of another player's turn, anyone may submit a word and steal. Success: the whole pile plus the word's points plus a 5-point bonus; the victim loses the turn. Failure (a word that is invalid and not an obvious typo): the stealer's banked score is halved.
- Penalties: time out with no play or bank: −5. Invalid word: no penalty, the reason is shown, retyping continues on the clock. One-typo-away words get a suggested fix; submitting again confirms it.
- Trap: a word ending in X, Z, Q or J traps the next player; if they time out, the trapper gets +5.
- Scoring: longer and rarer words score more; X, Z, Q, J give +3 each; Y, K, V, W give +1 each.
- Round twists (one per round, random): no letter E; words 6+ letters; words need a double letter; vowel-start words score double; double points with turns 2 seconds shorter.
- Winning: highest banked score after 3 rounds; tie goes to the longest single word; a complete tie is shared.
- Modes: Quick Game (3 to 7 bots; Easy, Medium, Hard); Daily Table (one attempt a day, same letters, bots and rules for everyone, streak); Practice (easy bots, 25-second turns, no penalties, Hint button); Tutorial (guided game with scripted bots); Rooms (4 to 10 real people; requires the game server, not live yet).

---

## 4. Contracts the skin is built on

### 4.1 View model (read-only)

```ts
// src/skin/model/types.ts
export type Hour = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Place = 'meadow' | 'pier' | 'porch' | 'kitchen' | 'teahouse';
export type Mode = 'quick' | 'daily' | 'practice' | 'tutorial' | 'rooms';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type TwistId = 'noE' | 'sixPlus' | 'doubleLetter' | 'vowelDouble' | 'doublePointsShort';
export type CreatureId = 'moss' | 'pip' | 'willow' | 'bramble' | 'fern' | 'quill' | 'juniper';

export interface PlayerView {
  id: string;
  name: string;
  isYou: boolean;
  isBot: boolean;
  difficulty?: Difficulty;
  creature?: CreatureId;      // assigned by the skin, stable per player id
  banked: number;
  dimmed: boolean;            // lost turn or failed steal, until the next turn starts
}

export interface MessageView {
  kind: 'invalid' | 'typo' | 'timeout' | 'penalty' | 'info' | 'thinking';
  text: string;
  fix?: string;               // for kind === 'typo'
}

export interface TableView {
  mode: Mode;
  phase: 'setup' | 'turn' | 'roundEnd' | 'gameEnd';
  round: 1 | 2 | 3;
  turn: number;               // 1..5 within the round for the current player
  twist: TwistId | null;
  pile: number;
  letter: string | null;      // the required starting letter
  isTrapLetter: boolean;      // letter is X, Z, Q or J
  players: PlayerView[];
  currentPlayerId: string;
  youId: string;
  secondsLeft: number;        // fractional allowed
  turnSeconds: number;        // 5..10, or 25 in Practice
  stealOpen: boolean;         // last 3 seconds of another player's turn
  typed: string;              // the current input text
  message: MessageView | null;
  longestWord?: { word: string; playerId: string };
  winnerIds?: string[];
  streakDays?: boolean[];     // Daily: last 7 days, true = played
  dailyPlayedToday?: boolean;
}
```

`useTableView()` (file `src/skin/model/useTableView.ts`) is the only file that knows the store's shape. It maps the store to `TableView` using the paths recorded in DISCOVERY.md. It performs no writes.

### 4.2 Visual events

```ts
// src/skin/model/events.ts
export type VisualEvent =
  | { type: 'accepted'; playerId: string; word: string; points: number }
  | { type: 'banked'; playerId: string; amount: number }
  | { type: 'stole'; byId: string; fromId: string; amount: number; word: string }
  | { type: 'stealFailed'; playerId: string; lost: number }
  | { type: 'timedOut'; playerId: string; trapperId?: string }
  | { type: 'trapSet'; letter: string }
  | { type: 'stealWindowOpened'; playerId: string }
  | { type: 'roundStart'; round: number; twist: TwistId | null }
  | { type: 'roundEnd'; round: number }
  | { type: 'gameEnd'; winnerIds: string[] };
```

`useVisualEvents(view)` returns a queue of events. If DISCOVERY.md shows the engine emits events, subscribe to those. Otherwise derive from consecutive `TableView` snapshots:

- `pile` increased and `currentPlayerId` unchanged: `accepted` (points = difference, word = the last submitted text).
- `pile` became 0 and the current player's `banked` rose by the old pile: `banked`.
- `pile` became 0 and a non-current player's `banked` rose by more than the old pile: `stole` (fromId = the old current player).
- A player's `banked` roughly halved outside a bank or steal: `stealFailed`.
- `secondsLeft` reached 0 with no accepted word or bank, and that player's `banked` fell by 5: `timedOut` (trapperId = the player whose `banked` rose by 5 at the same time, if any).
- `letter` changed to X, Z, Q or J: `trapSet`.
- `stealOpen` changed from false to true: `stealWindowOpened`.
- `round` increased or `phase` became `turn` after `setup`: `roundStart`. `phase` became `roundEnd` or `gameEnd`: those events.

Derivation is a fallback. Never add event emission to engine files to make this easier; ask Brian instead.

### 4.3 Callbacks

The skin calls only the existing functions recorded in DISCOVERY.md under "Existing callbacks": play, bank, steal, setTyped, chooseBots, chooseDifficulty, start, continue, openSettings. It never adds new ones. If a screen needs an action that does not exist, the control is omitted and noted in the milestone report.

### 4.4 Feature flag

```ts
// src/skin/flag.ts
export function isPaintedSkin(searchParams?: URLSearchParams): boolean {
  if (searchParams?.get('skin') === 'painted') return true;
  if (searchParams?.get('skin') === 'classic') return false;
  return process.env.NEXT_PUBLIC_SKIN === 'painted';
}
```

Each switch point renders `<PaintedX {...props} />` when the flag is on and the existing component otherwise. The existing component is not modified.

---

## 5. Design tokens and type (code)

### 5.1 `src/skin/styles/tokens.css`

```css
/* Painted skin tokens. Interface colours are constant at every hour. */
:root[data-skin="painted"] {
  --paper: #FBF4E4;
  --paper-edge: #E7D9B8;
  --ink: #3B3028;        /* 11.7:1 on paper */
  --ink-soft: #7A6A58;   /* 4.7:1 on paper */
  --tile: #E3B780;
  --wood: #B57F4A;       /* table; lit top edge of wooden buttons */
  --wood-dark: #8C5A2E;  /* button bodies, sign backs; #FFF4DC text = 5.3:1 */
  --wood-ink: #5B3A1E;   /* letters on tiles, numbers on the lantern */
  --amber: #F2A444;      /* lantern, timer ring, focus rings, streak */
  --glow: #FFD98A;
  --cloth: #6BA372;      /* lit edge of Bank */
  --cloth-dark: #3F6A49; /* Bank body; #FFF4DC text = 5.7:1 */
  --coral: #E7705E;      /* lit edge of Steal; steal-window ring */
  --coral-dark: #B8432F; /* Steal body; penalty text; #FFF4DC text = 4.9:1 */
  --bramble: #4E3C2F;    /* trap tiles */
  --mist: #9FB7D6;       /* rain, mist, disabled */
  --button-text: #FFF4DC;

  --shadow-warm: 0 6px 18px rgba(80, 50, 20, 0.18);
  --radius-paper: 14px 18px 12px 20px / 18px 12px 20px 14px; /* uneven corners */
  --radius-button: 12px;
  --radius-tile: 16px;

  --ease-out: cubic-bezier(0.2, 0.9, 0.3, 1);
  --ease-spring: cubic-bezier(0.2, 0.9, 0.3, 1.2); /* lantern growth only */
  --t-fast: 300ms;
  --t-feedback: 500ms;
  --t-carry: 1100ms;
}

/* Sky palettes by hour; consumed by the Scene component. */
:root[data-skin="painted"][data-hour="dawn"]  { --sky-hi:#9FB7D6; --sky-lo:#F3C9B5; --horizon:#FBE3C2; --far:#B9C4D2; --mid:#8DA98A; --near:#6E9765; --grass:#9BBC6A; --sun:#FFD9A0; }
:root[data-skin="painted"][data-hour="day"]   { --sky-hi:#78B4E6; --sky-lo:#BFE1F3; --horizon:#F1EBD3; --far:#A9C6C0; --mid:#79AE78; --near:#5C9B58; --grass:#A3D074; --sun:#FFF1C2; }
:root[data-skin="painted"][data-hour="dusk"]  { --sky-hi:#5E5A94; --sky-lo:#D08AA2; --horizon:#F7C08F; --far:#8E7FA3; --mid:#6E7F7A; --near:#4E6B55; --grass:#7A9A5E; --sun:#FFB36B; }
:root[data-skin="painted"][data-hour="night"] { --sky-hi:#101B3A; --sky-lo:#273B66; --horizon:#4A5F8A; --far:#3B4A6B; --mid:#2F4A4A; --near:#263F38; --grass:#3A6148; --sun:#F4ECCF; }

@media (prefers-reduced-motion: reduce) {
  :root[data-skin="painted"] { --t-fast: 0ms; --t-feedback: 0ms; --t-carry: 0ms; }
}
```

Rules: no `#000000` anywhere in the skin; no colour literals in components, only tokens; `--coral*` only for the steal window, failed steals and penalties.

### 5.2 `src/skin/styles/fonts.ts`

```ts
import { Fraunces, Nunito, Patrick_Hand } from 'next/font/google';

export const fraunces = Fraunces({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display', display: 'swap' });
export const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'], variable: '--font-body', display: 'swap' });
export const patrickHand = Patrick_Hand({ subsets: ['latin'], weight: '400', variable: '--font-hand', display: 'swap' });

export const fontClassNames = `${fraunces.variable} ${nunito.variable} ${patrickHand.variable}`;
```

Usage: display and big numbers in `var(--font-display)` 700/800 with `font-variant-numeric: tabular-nums`; body and interface in `var(--font-body)`; tiles in `var(--font-body)` 900 at 42px; signs, hints and the two labels under the lantern and tile in `var(--font-hand)`. Nothing else in `--font-hand`.

### 5.3 Hour and season helpers

```ts
// src/skin/model/clock.ts
export function hourFor(date = new Date()): Hour {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
export function seasonFor(date = new Date(), northern = true): Season {
  const m = date.getMonth(); // 0..11
  const n: Season = m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  if (northern) return n;
  return ({ winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' } as const)[n];
}
```

Hour changes crossfade over at least 2 seconds; never a cut. Re-evaluate the hour once a minute.

---

## 6. Components (all under `src/skin/components/`)

Each component is pure presentation: plain props in, existing callbacks out. No component imports the store or engine.

| Component | Props | Notes |
|---|---|---|
| `Scene` | `place: Place; hour: Hour; season: Season; wind: 0..1; frozen: boolean; weather?: 'none'|'mist'|'rain'|'leaves'|'snow'` | Draws layered painted art behind the interface. Until painted assets exist, uses the procedural canvas in Appendix A. `frozen` stops ambient motion (steal window). Pauses when the tab is hidden. DPR capped at 2. |
| `Lantern` | `points: number; state: 'unlit'|'lit'; sizeCap?: number` | Width 72 + min(80, points) × 1.1 px; glow scales with points; `breathe` animation; growth uses `--ease-spring`. Flame flicker speed rises at each 10-point step. |
| `Keeper` | `mood: 'asleep'|'idle'|'happy'|'startled'|'proud'|'sleepy'|'explaining'; size: number; facing?: 'left'|'right'` | SVG with CSS animations. Reacts within 200 ms of `banked`/`stole`. Never renders text during `phase === 'turn'`. |
| `LetterTile` | `letter: string; isTrap: boolean; isVowel: boolean; fraction: number (0..1 time left); stealOpen: boolean; secondsLeft: number` | Wooden tile with an SVG ring that drains clockwise; ring is `--amber`, `--coral` when `stealOpen`. Trap tiles use `--bramble` frame and thorn dots. |
| `PlayerCard` | `player: PlayerView; isTurn: boolean; compact: boolean` | Paper card; amber ring when `isTurn`; dimmed state; difficulty badge (seedling/leaf/acorn); creature avatar from `CreatureId`. |
| `TwistSign` | `twist: TwistId|null; state: 'lowering'|'hung'|'raised'` | Wooden sign on two ropes, hand lettering, slow swing. Text per twist: "No letter E" / "Words of 6 letters or more" / "Words need a double letter" / "Vowel starts score double" / "Double points, 2 seconds shorter". |
| `InputStrip` | `letter: string; typed: string; disabled: boolean; onChange; onPlay; onBank; pile: number; bankDisabled: boolean` | Paper field with the pre-printed starting letter, slow caret, Play (wood) and Bank (cloth, label "Bank {pile}"). Keeps the existing input element semantics (same `id`, aria attributes, keyboard handling). |
| `StealButton` | `visible: boolean; word: string; onSteal` | Coral button with pulsing halo; label "STEAL" or "STEAL with {WORD}". Only rendered when `stealOpen`. |
| `MessageSlip` | `message: MessageView|null` | Paper slip above the input. Reuses the existing `aria-live` region (wrap it, do not replace it). The typo fix is underlined in `--cloth`. |
| `PileArea` | `pile; keeperMood; letterProps` | Lays out Lantern, Keeper and LetterTile centred on the table. |
| `TallyBoard` | `players; round; isGameEnd; winnerIds?; longestWord?; onContinue; onPlayAgain?; onHome?` | Wooden board; rows light one by one; winner glows; tie shows a longest-word banner. |
| `StreakString` | `days: boolean[]` | Seven small lanterns; today ringed in `--cloth`. |
| `Ticket` | `title; line; icon; disabled?; onSelect` | Paper mode ticket for Home. |
| `PaperPanel`, `WoodButton`, `ClothButton`, `CoralButton`, `Chip` | standard | Materials. Buttons sink 1 px when pressed; focus ring `--amber`. |
| `Fox` | `from: 'left'|'right'; running: boolean` | SVG fox for the steal dash (1.3 s). |
| `Particles` | `kind: 'petals'|'leaf'|'fireflies'|'rain'|'snow'; origin?` | Small CSS/canvas particle bursts. |

Hooks (`src/skin/hooks/`): `useTableView`, `useVisualEvents`, `useMotionLevel()` (returns `'full' | 'reduced'` from `prefers-reduced-motion` and the Settings toggle, if one exists; if none exists, from the media query only), `useHour()`, `useSeason()`.

Layout rules: phone-first. Under 720 px: twist sign at the very top, round chip below it, player cards as one row of compact cards, pile area centred lower, input strip pinned to the bottom with buttons below it; the lantern, tile and input must all be visible at 667 px tall with the keyboard open. 960 px and wider: round chip top left, sign top centre, player cards in a column top right, pile area centred on the table, input strip at the bottom.

---

## 7. Motion rules (enforced in code review)

- Ambient motion (clouds, grass, lantern breathing, sign swing, fireflies) is small and never overlaps the word, the clock or a button.
- Feedback motion is 300 to 600 ms and maps one-to-one to a `VisualEvent`. No decorative animation without an event.
- `stealOpen === true`: `Scene.frozen = true`; the only moving things are the ring and `StealButton`.
- Easing `--ease-out` everywhere except lantern growth (`--ease-spring`).
- `useMotionLevel() === 'reduced'`: ambient layers render one static frame; feedback becomes a fade or an instant change; the fox and petals do not render.

| Event | Visual | Length |
|---|---|---|
| `accepted` | Tiles of the word pop in (80 ms stagger), petals from the lantern, lantern grows, "+N" chip rises | 500 ms |
| invalid / typo message | Slip rises; text stays in the field | 350 ms |
| `banked` | Lantern floats to the banker's card, banked number counts up, new small lantern fades in, Keeper `happy` | 1,100 ms |
| `stealWindowOpened` | Ring turns coral, StealButton appears with halo, Scene frozen | instant |
| `stole` | Fox dashes from the stealer's side, lantern shakes, Keeper `startled`, fox carries the lantern to the stealer's card, victim card dimmed | 1,300 ms |
| `stealFailed` | Stealer's card dims; banked counts down to half | 800 ms |
| `timedOut` | Lantern flickers, leaf lands on the card with "−5"; trapper's card shows "+5" | 700 ms |
| `trapSet` | Next tile grows thorns | 400 ms |
| `roundStart` | Sign lowers and settles; round chip updates | 900 ms |
| `roundEnd` / `gameEnd` | TallyBoard unrolls; rows light one by one; winner glows | 1,500 ms |

Sound is not part of any milestone until Brian approves it (Part 10).

---

## 8. Milestones (one per session; each ends with verification)

Verification for every milestone: `npm run build` passes; the type check passes; the existing test suite passes unchanged; new Storybook stories or Playwright screenshots (if the repo has them) are added for the new parts; a short report lists every file created or changed and confirms no file outside `src/skin/` and the switch points was touched.

### Milestone 1: tokens, fonts, materials
Tasks: add `tokens.css`, `fonts.ts`, `flag.ts`, `clock.ts`, `types.ts`; build `PaperPanel`, `WoodButton`, `ClothButton`, `CoralButton`, `Chip`, `LetterTile` (static, no ring), `MessageSlip`; add `data-skin="painted"` on the root element only when the flag is on; mount the font class names at the layout level behind the flag.
Acceptance: with the flag off, nothing changes (screenshot comparison). With it on, the existing screens render with the new fonts and tokens applied through the materials where mounted; no `#000000` in skin CSS; contrast of button text verified by a unit test that computes WCAG ratios for the token pairs in Part 5.1 (expected: ink 11.7, ink-soft 4.7, wood-dark 5.3, cloth-dark 5.7, coral-dark 4.9, tolerance 0.1).

### Milestone 2: the table
Tasks: `useTableView`, `useVisualEvents` (engine events if present, derivation otherwise), `Lantern`, `Keeper` (idle only), `LetterTile` with the timer ring, `PlayerCard`, `InputStrip`, `StealButton`, `PileArea`, `Fox`, `Particles`; a `PaintedTable` screen mounted at the table switch point; feedback moments for `accepted`, `banked`, `stole`, `stealFailed`, `timedOut`, `trapSet`, `stealWindowOpened`. Background is a flat `--sky-lo` to `--near` gradient and the wooden table (no Scene yet).
Acceptance: a full Quick Game against bots can be played with the flag on, using only existing callbacks; every event in Part 7 shows its visual; the ring drains in sync with `secondsLeft`; during the steal window nothing but the ring and StealButton moves; phone layout passes the 667 px keyboard-open check; the existing tests pass unchanged.

### Milestone 3: the meadow scene, Home, setup
Tasks: `Scene` with the procedural renderer from Appendix A (adapted to React: one canvas, static layers baked per hour, visibility pause, DPR cap, `frozen`, `wind`), `useHour`, `useSeason`, the 2-second crossfade; `Ticket`, `PaintedHome`, `PaintedQuickSetup` at their switch points; `StreakString` on Home when streak data exists.
Acceptance: the ambient loop costs under 2 ms per frame on a mid-range phone (measure with the Performance panel and report); the scene changes hour with the device clock; Home shows four tickets plus a disabled Rooms ticket when Rooms is unavailable; setup uses only the existing chooseBots/chooseDifficulty/start callbacks.

### Milestone 4: twists, tally, results
Tasks: `TwistSign` with the five texts and icons, round transition sequence (sign raised → TallyBoard → next sign lowered; Continue skips), `TallyBoard` for round end and game end, the Keeper's `proud`, `startled`, `sleepy` moods, `PaintedResults` at its switch point.
Acceptance: a full 3-round game shows the correct sign each round; the tally shows banked totals matching the store; tie-break display matches the engine's winner; "Play again" and "Back to the meadow" call existing callbacks only.

### Milestone 5: the other places
Tasks: `pier` (Daily Table: streak lanterns along the pier; `dailyPlayedToday` state with the Keeper asleep and the next-table time in local time), `porch` (Practice: rain weather, 25-second ring, Hint rendered as a book that opens; the hint text is whatever the existing hint callback returns), `kitchen` (Tutorial: the existing tutorial text shown on the Keeper's hand-lettered cards, scripted bots as Moss and Pip), `PaintedSettings` showing the existing settings in a paper panel (no new settings unless Brian approves the reduce-motion and season toggles).
Acceptance: each mode plays end to end with the flag on; nothing in Practice shows a penalty visual; the Daily Table shows the same bots and letters as the classic skin on the same day.

### Milestone 6: seasons, weather, polish, tests
Tasks: seasonal tree variants in the procedural scene (blossom, green, amber, bare + snow); light weather (`mist` at dawn, occasional `rain`, autumn `leaves`), never during the first 3 seconds of a turn or a steal window; reduced-motion pass over every component; performance pass (first paint of the table under 2.5 s on simulated 4G, report numbers); Playwright screenshot tests at 400, 768 and 1280 px in day and night.
Acceptance: all checklist items in Part 9 pass and are reported one by one.

### Milestone 7: tea house and skin ids (after the server is live)
Tasks: `PaintedRoomsLobby` (chalkboard room code, paper cards as people join, Start for the host) and the `teahouse` place at night; add `skinIds` (`table`, `lantern`, `keeperOutfit`) with one default each, read from a single config, no store, no gating.
Acceptance: Rooms works with the flag on using existing networking callbacks only.

---

## 9. Checklist before any milestone is reported done

Look and feel
1. No `#000000` anywhere in `src/skin/`; darkest ink is `--ink`.
2. Components use tokens only; no colour literals.
3. Far layers take at least a third of the horizon colour; no crisp ridge on the far hills.
4. No hard outlines on scenery or interface parts.
5. One loud colour per screen (the lantern); coral only during steal window, failed steal, penalty.
6. At least one idle motion per screen; none overlaps the word, the clock or a button.
7. During the last 3 seconds of a turn only the ring and StealButton move.
8. The Keeper reacts within 200 ms of `banked`/`stole` and renders no text during a turn.
9. Hour crossfade ≥ 2 s; season assets swap without layout shift.
10. No studio, director or film names in code or assets: `grep -ri "ghibli\|miyazaki\|totoro" src public` returns nothing (docs and CLAUDE.md are excluded on purpose).

Technical
1. Text contrast ≥ 4.5:1; large numbers ≥ 3:1 (unit test from Milestone 1).
2. `prefers-reduced-motion` respected on every screen.
3. Ambient loop < 2 ms per frame; loop paused when hidden.
4. Table first paint < 2.5 s on simulated 4G; no layout shift when fonts load.
5. Screenshot tests at 400, 768, 1280 px pass.
6. 667 px tall phone, keyboard open, every mode: lantern, tile and input visible.
7. Existing tests pass unchanged; `git diff --stat` shows no file outside `src/skin/` and the switch points.

---

## 10. Decisions and defaults

| Decision | Default until Brian says otherwise |
|---|---|
| Game name on the sign and title | "Finish the Word" |
| The Keeper's design | As on the style board (cream, round, sprout, dot eyes, blush) |
| Sound | Not implemented; do not add audio files or an audio context |
| Desktop keyboard shortcuts for Bank and Steal | Keep whatever exists; add none |
| Reduce-motion and season toggles in Settings | Not added; use the media query and the calendar only |
| Hemisphere | Northern |
| Painted image assets | None yet; the procedural Scene is the placeholder. When assets arrive they go in `public/skin/scenes/{place}/{layer}_{hour}.webp` with sizes 1920, 1280, 768, and `Scene` swaps to `ImageLayers` without changing its props |

---

## 11. Asset conventions (for when the team supplies painted art)

- Path: `public/skin/scenes/{place}/{layer}_{hour}.webp`, layers in back-to-front order: `sky`, `far`, `mid`, `near`, `grass`, `table`. Seasonal variants: `near_{hour}_{season}.webp`. Widths 1920, 1280, 768; keep a lossless master outside the repo.
- Characters and interface art are SVG under `src/skin/assets/` (Keeper, seven creatures, fox, icons, particles). They are hand-drawn; the agent does not generate them.
- Budget: first paint of one scene under 600 KB on desktop, under 350 KB on phones.
- The style bible the humans use for generation lives in `docs/skin/STYLE_BIBLE.md` (Brian writes it). It must not name any studio, film or artist; it describes a painted, soft-edged, poster-colour look with the Part 5 palette.

---

## 12. Prompts Brian can paste into Claude Code

Discovery:
```
Read @docs/REDESIGN_PLAN.md. Do Part 2 (discovery) only. Write docs/skin/DISCOVERY.md and stop so I can review it.
```

Milestone N:
```
Read @docs/REDESIGN_PLAN.md and @docs/skin/DISCOVERY.md. Do Milestone N exactly as specified. Follow the guardrails in CLAUDE.md. When done, run the verification steps, go through Part 9, and report file by file.
```

When something is missing from the store:
```
The visual needs <field>. Do not change the engine. Show me the smallest read-only way to get it, or tell me what to add myself.
```

Review before edits:
```
Switch to plan mode and show me the approach for Milestone N before touching any file.
```

---

## Appendix A: procedural scene, reference implementation

This is the renderer used on the style board. Port it into `Scene` as a React component (`useEffect` for setup and teardown, a `requestAnimationFrame` loop, cancel on unmount, pause on `document.hidden`, respect `frozen` and reduced motion). Replace the palette object with the CSS tokens by reading them from `getComputedStyle(document.documentElement)` or by passing the hour's values as props. Keep the structure: static layers baked once per hour to an offscreen canvas; clouds, tree sway, grass, fireflies, leaves drawn each frame.

```js
// Palette per hour (sunPos is [x, y] as a fraction of the canvas; fog, flies, stars are 0..1).
const PAL = {
  dawn:{ skyTop:'#9FB7D6', skyMid:'#F3C9B5', horizon:'#FBE3C2', sun:'#FFD9A0', sunPos:[0.52,0.5], sunR:0.09,
         far:'#B9C4D2', mid:'#8DA98A', near:'#6E9765', ground:'#5E8A55', grass:['#7FA85C','#9BBC6A','#6B9550'],
         cloud:'rgba(255,241,230,0.92)', cloudShade:'rgba(214,190,200,0.55)', leaf:['#7AA35B','#95B86A','#5F8A49'],
         fog:0.38, flies:0.25, stars:0 },
  day:{  skyTop:'#78B4E6', skyMid:'#BFE1F3', horizon:'#F1EBD3', sun:'#FFF1C2', sunPos:[0.44,0.15], sunR:0.075,
         far:'#A9C6C0', mid:'#79AE78', near:'#5C9B58', ground:'#4F8A4C', grass:['#86C063','#A3D074','#6EAA52'],
         cloud:'rgba(255,255,255,0.95)', cloudShade:'rgba(205,220,235,0.65)', leaf:['#6FA84F','#8BC46A','#55903F'],
         fog:0.18, flies:0, stars:0 },
  dusk:{ skyTop:'#5E5A94', skyMid:'#D08AA2', horizon:'#F7C08F', sun:'#FFB36B', sunPos:[0.32,0.55], sunR:0.1,
         far:'#8E7FA3', mid:'#6E7F7A', near:'#4E6B55', ground:'#3F5C47', grass:['#5E8352','#7A9A5E','#4B6E45'],
         cloud:'rgba(255,205,190,0.9)', cloudShade:'rgba(150,110,150,0.55)', leaf:['#6B8A4E','#8A9B5A','#4D6E42'],
         fog:0.26, flies:0.7, stars:0.35 },
  night:{skyTop:'#101B3A', skyMid:'#273B66', horizon:'#4A5F8A', sun:'#F4ECCF', sunPos:[0.56,0.16], sunR:0.045,
         far:'#3B4A6B', mid:'#2F4A4A', near:'#263F38', ground:'#1F3630', grass:['#2F5240','#3A6148','#25443A'],
         cloud:'rgba(120,135,175,0.45)', cloudShade:'rgba(60,70,110,0.45)', leaf:['#2F5240','#3A6148','#25443A'],
         fog:0.22, flies:1, stars:1 }
};

function rng(seed){ let s = seed>>>0 || 1; return function(){ s = (s*1664525 + 1013904223)>>>0; return s/4294967296; }; }
function hex2rgb(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function tint(h,k){ const [r,g,b]=hex2rgb(h); const f=x=>Math.max(0,Math.min(255,Math.round(x))); return `rgb(${f(r+k)},${f(g+k)},${f(b+k)})`; }
function rgba(h,a){ const [r,g,b]=hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }

// Paper grain pattern, 160x160, drawn at 7% alpha over the static layers.
const grain = (function(){ const c=document.createElement('canvas'); c.width=c.height=160; const g=c.getContext('2d');
  const id=g.createImageData(160,160); const r=rng(7);
  for(let i=0;i<id.data.length;i+=4){ const v=180+Math.floor(r()*75); id.data[i]=v; id.data[i+1]=v; id.data[i+2]=v; id.data[i+3]=Math.floor(r()*40); }
  g.putImageData(id,0,0); return c; })();

function Scene(canvas, opts){
  const ctx = canvas.getContext('2d');
  const o = Object.assign({ time:'day', wind:1, animate:true, detail:1, seed:11 }, opts||{});
  let W=0,H=0,DPR=1, stat=null, clouds=[], blades=[], flies=[], stars=[], leaves=[], tree=null, t0=performance.now(), raf=0, running=false, hillFns=null;

  // A hill is a sum of three sines; base is the ridge height, amp the relief.
  function hillFn(base, amp, freq, phase){ return x => base + amp*(Math.sin(x*freq+phase)*0.6 + Math.sin(x*freq*2.3+phase*1.7)*0.22 + Math.sin(x*freq*0.47+phase*0.3)*0.4); }

  function resize(){
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio||1);
    W = Math.max(240, Math.round(r.width)); H = Math.max(140, Math.round(r.height));
    canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    hillFns = { far: hillFn(H*0.56, H*0.045, 0.006, 1.2), mid: hillFn(H*0.64, H*0.05, 0.0085, 2.6), near: hillFn(H*0.715, H*0.035, 0.011, 0.4) };
    seed(); bake(); draw(0);
  }

  // Fill a hill, then overlay translucent "dabs" clipped to it for a gouache texture, then a pale rim along the ridge.
  function fillHill(g, fn, color, texSeed, w, h){
    g.save();
    g.beginPath(); g.moveTo(0,h); for(let x=0;x<=w;x+=6){ g.lineTo(x, fn(x)); } g.lineTo(w,h); g.closePath();
    g.fillStyle = color; g.fill(); g.clip();
    const r = rng(texSeed); const n = Math.round(w*0.9*o.detail);
    for(let i=0;i<n;i++){
      const x = r()*w; const top = fn(x); const y = top + r()*(h-top)*0.55;
      g.globalAlpha = 0.08 + r()*0.08; g.fillStyle = tint(color, (r()-0.5)*26);
      g.beginPath(); g.ellipse(x, y, 8+r()*26, 4+r()*10, (r()-0.5)*0.8, 0, Math.PI*2); g.fill();
    }
    g.globalAlpha = 0.35; g.strokeStyle = tint(color, 34); g.lineWidth = 3;
    g.beginPath(); for(let x=0;x<=w;x+=6){ const y=fn(x)+1.5; if(x===0) g.moveTo(x,y); else g.lineTo(x,y); } g.stroke();
    g.restore();
  }

  // Static layers: sky, sun or moon glow, three hills with fog between far and mid, the ground, grain.
  function bake(){
    const p = PAL[o.time];
    stat = document.createElement('canvas'); stat.width = Math.round(W*DPR); stat.height = Math.round(H*DPR);
    const g = stat.getContext('2d'); g.setTransform(DPR,0,0,DPR,0,0);
    const sky = g.createLinearGradient(0,0,0,H*0.68); sky.addColorStop(0,p.skyTop); sky.addColorStop(0.55,p.skyMid); sky.addColorStop(1,p.horizon);
    g.fillStyle = sky; g.fillRect(0,0,W,H);
    const sx = W*p.sunPos[0], sy = H*p.sunPos[1], sr = Math.min(W,H)*p.sunR;
    const glow = g.createRadialGradient(sx,sy,0,sx,sy,sr*6); glow.addColorStop(0, rgba(p.sun,0.55)); glow.addColorStop(0.35, rgba(p.sun,0.18)); glow.addColorStop(1, rgba(p.sun,0));
    g.fillStyle = glow; g.fillRect(0,0,W,H);
    g.fillStyle = p.sun; g.beginPath(); g.arc(sx,sy,sr,0,Math.PI*2); g.fill();
    if(o.time==='night'){ g.fillStyle = p.skyTop; g.globalAlpha=0.9; g.beginPath(); g.arc(sx+sr*0.45, sy-sr*0.2, sr*0.82, 0, Math.PI*2); g.fill(); g.globalAlpha=1; }
    fillHill(g, hillFns.far, p.far, 31, W, H);
    g.save(); const fog = g.createLinearGradient(0,H*0.5,0,H*0.68); fog.addColorStop(0, rgba(p.horizon,0)); fog.addColorStop(1, rgba(p.horizon,p.fog)); g.fillStyle=fog; g.fillRect(0,H*0.48,W,H*0.22); g.restore();
    fillHill(g, hillFns.mid, p.mid, 52, W, H);
    fillHill(g, hillFns.near, p.near, 73, W, H);
    const gr = g.createLinearGradient(0,H*0.74,0,H); gr.addColorStop(0, p.near); gr.addColorStop(1, p.ground);
    g.fillStyle = gr; g.fillRect(0,H*0.745,W,H*0.26);
    g.save(); g.globalAlpha = 0.07; g.fillStyle = g.createPattern(grain,'repeat'); g.fillRect(0,0,W,H); g.restore();
  }

  // Moving things are seeded deterministically so screenshots are stable.
  function seed(){
    const r = rng(o.seed);
    clouds = []; const nc = Math.max(3, Math.round(W/230));
    for(let i=0;i<nc;i++){
      const puffs=[]; const np = 5+Math.floor(r()*3);
      for(let j=0;j<np;j++) puffs.push({dx:(j-np/2)*22+(r()-0.5)*12, dy:(r()-0.5)*14 - Math.abs(j-np/2)*3, rx:22+r()*22, ry:14+r()*10});
      clouds.push({x:r()*W, y:H*(0.07+r()*0.3), s:0.55+r()*0.9, v:5+r()*9, puffs});
    }
    blades = []; const nb = Math.round(W/4.2);
    for(let i=0;i<nb;i++){ const x = r()*W; const base = hillFns.near(x) + 2 + r()*H*0.07;
      blades.push({x, y:base, len:14+r()*30, lean:(r()-0.5)*10, ph:r()*6.28, sp:0.8+r()*0.8, c:Math.floor(r()*3)}); }
    stars = []; for(let i=0;i<90;i++) stars.push({x:r()*W, y:r()*H*0.5, r:0.6+r()*1.3, ph:r()*6.28});
    flies = []; for(let i=0;i<34;i++) flies.push({x:r()*W, y:H*(0.45+r()*0.4), vx:(r()-0.5)*8, vy:(r()-0.5)*5, ph:r()*6.28, sp:1+r()*2});
    leaves = [];
    const tx = W*0.16; const ty = hillFns.near(tx)-2;
    const blobs=[]; for(let i=0;i<9;i++) blobs.push({dx:(r()-0.5)*110, dy:-70-(r())*80, rx:34+r()*30, ry:26+r()*22, c:Math.floor(r()*3)});
    tree = {x:tx, y:ty, blobs};
  }

  function drawClouds(g, t, p){
    for(const c of clouds){
      const x = ((c.x + t*c.v*o.wind) % (W+300)) - 150;
      g.save(); g.translate(x, c.y); g.scale(c.s, c.s);
      g.fillStyle = p.cloudShade; for(const q of c.puffs){ g.beginPath(); g.ellipse(q.dx, q.dy+8, q.rx, q.ry, 0, 0, Math.PI*2); g.fill(); }
      g.fillStyle = p.cloud; for(const q of c.puffs){ g.beginPath(); g.ellipse(q.dx, q.dy, q.rx, q.ry, 0, 0, Math.PI*2); g.fill(); }
      g.restore();
    }
  }
  function drawTree(g, t, p){
    const sway = Math.sin(t*0.6)*2.2*o.wind;
    g.save(); g.translate(tree.x, tree.y);
    g.fillStyle = tint(p.near,-60); g.beginPath(); g.moveTo(-9,0); g.lineTo(-6,-75); g.lineTo(6,-75); g.lineTo(11,0); g.closePath(); g.fill();
    g.strokeStyle = tint(p.near,-60); g.lineWidth=5; g.lineCap='round';
    g.beginPath(); g.moveTo(-3,-70); g.lineTo(-30,-105); g.moveTo(3,-72); g.lineTo(28,-110); g.stroke();
    g.translate(sway, 0); g.rotate(sway*0.004);
    for(const b of tree.blobs){ g.fillStyle = p.leaf[b.c]; g.globalAlpha=0.95; g.beginPath(); g.ellipse(b.dx, b.dy, b.rx, b.ry, 0, 0, Math.PI*2); g.fill(); }
    g.globalAlpha=0.5; g.fillStyle = tint(p.leaf[1], 28);
    for(const b of tree.blobs){ g.beginPath(); g.ellipse(b.dx-b.rx*0.25, b.dy-b.ry*0.3, b.rx*0.45, b.ry*0.4, -0.5, 0, Math.PI*2); g.fill(); }
    g.restore();
  }
  function drawGrass(g, t, p){
    g.lineCap='round';
    for(const b of blades){
      const sway = Math.sin(t*b.sp + b.ph)*6*o.wind + Math.sin(t*0.4+b.x*0.01)*4*o.wind;
      g.strokeStyle = p.grass[b.c]; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x + sway*0.4, b.y - b.len*0.55, b.x + b.lean + sway, b.y - b.len); g.stroke();
    }
  }
  function drawFlies(g, t, p){
    if(!p.flies) return;
    for(let i=0;i<flies.length*p.flies;i++){
      const f = flies[i]; const x = f.x + Math.sin(t*0.3+f.ph)*30 + t*f.vx*0.4; const y = f.y + Math.cos(t*0.25+f.ph)*18;
      const a = 0.35 + 0.65*Math.max(0, Math.sin(t*f.sp+f.ph));
      const xx = ((x % (W+40)) + (W+40)) % (W+40) - 20;
      const gl = g.createRadialGradient(xx,y,0,xx,y,9); gl.addColorStop(0,`rgba(247,226,122,${a})`); gl.addColorStop(1,'rgba(247,226,122,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(xx,y,9,0,Math.PI*2); g.fill();
      g.fillStyle = `rgba(255,245,190,${a})`; g.beginPath(); g.arc(xx,y,1.6,0,Math.PI*2); g.fill();
    }
  }
  function drawStars(g, t, p){
    if(!p.stars) return;
    for(const s of stars){ const a = p.stars*(0.5+0.5*Math.sin(t*1.3+s.ph)); g.fillStyle=`rgba(255,250,230,${a*0.9})`; g.beginPath(); g.arc(s.x,s.y,s.r,0,Math.PI*2); g.fill(); }
  }
  function drawLeaves(g, t, p){
    if(o.time==='night') return;
    if(leaves.length<6 && Math.random()<0.02*o.wind){ leaves.push({x:tree.x+(Math.random()-0.5)*100, y:tree.y-110+Math.random()*40, vx:8+Math.random()*10, vy:14+Math.random()*10, ph:Math.random()*6.28, c:Math.floor(Math.random()*3)}); }
    for(let i=leaves.length-1;i>=0;i--){ const l=leaves[i]; l.x += (l.vx*o.wind + Math.sin(t*2+l.ph)*12)/60; l.y += l.vy/60;
      if(l.y>H*0.78 || l.x>W+20) leaves.splice(i,1);
      else { g.save(); g.translate(l.x,l.y); g.rotate(Math.sin(t*3+l.ph)); g.fillStyle=p.leaf[l.c]; g.globalAlpha=0.9; g.beginPath(); g.ellipse(0,0,5,3,0,0,Math.PI*2); g.fill(); g.restore(); } }
  }
  function draw(t){
    const p = PAL[o.time];
    ctx.clearRect(0,0,W,H); ctx.drawImage(stat,0,0,W,H);
    drawStars(ctx,t,p); drawClouds(ctx,t,p); drawTree(ctx,t,p); drawLeaves(ctx,t,p); drawGrass(ctx,t,p); drawFlies(ctx,t,p);
  }
  function loop(now){ if(!running) return; draw((now-t0)/1000); raf = requestAnimationFrame(loop); }
  function start(){ if(running || !o.animate) return; running=true; t0=performance.now(); raf=requestAnimationFrame(loop); }
  function stop(){ running=false; cancelAnimationFrame(raf); }
  function setTime(tm){ o.time = tm; bake(); draw(running ? (performance.now()-t0)/1000 : 0); }
  function setWind(w){ o.wind = w; }

  resize();
  let rt=0; window.addEventListener('resize', ()=>{ clearTimeout(rt); rt=setTimeout(resize,120); });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stop(); else start(); });
  start();
  return { setTime, setWind, draw, start, stop };
}
```

Porting notes: `frozen` should call `stop()` and leave the last frame; the hour crossfade can be done by baking the new hour to a second static canvas and drawing both with changing alpha for 2 seconds; the tree position (`W*0.16`) assumes the player cards sit on the right; on phones halve `blades` and `flies` and cap clouds at three.

---

## Appendix B: the Keeper and the fox (starting SVG)

The Keeper (viewBox 0 0 100 100): drop shadow ellipse at (50, 92); body ellipse at (50, 56) radius 36 × 34 in `#F7E8C8`; belly ellipse at (50, 66) radius 24 × 18 in `#FBF2DF`; eyes at (36, 50) and (64, 50) radius 3.6 in `--ink` with a 1.1 highlight; blush ellipses at (27, 59) and (73, 59) radius 5 × 3 in `#F2B6A0` at 80% opacity; a sprout from (50, 14) curving to the upper left in `#5F8A49` with a leaf ellipse at (34, 6). Mouth paths: idle `M44 60 q6 5 12 0`; happy `M40 58 q10 10 20 0`; startled a small circle at (50, 60) radius 4. Animations: `bob` (3.2 s, translateY −3 px at the midpoint), `happy` (rotate ±8°, 0.8 s, twice), `startle` (translateY −14 px and scale 1.06 for 0.6 s).

The fox (viewBox 0 0 150 80): body ellipse at (78, 48) radius 40 × 18 in `#D97C2B`; tail from (30, 42) sweeping left with a cream tip; head circle at (116, 38) radius 15; two ear triangles; a cream muzzle ellipse at (126, 44); eyes; four legs as 5 px round strokes in `#B8651F`. Dash animation: 1.3 s from −16% to 104% of the table width with a small hop at 45%.
