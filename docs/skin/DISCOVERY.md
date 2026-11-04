# Painted skin: discovery map

Part 2 of `docs/REDESIGN_PLAN.md`. Written 3 November 2026 from the repository at commit `6397523` plus the uncommitted
working-tree changes described under "Read this first". No skin code has been written.

## Read this first: where the plan and the repository disagree

The plan was written for "an existing React / Next.js repository". This repository is not Next.js. Several plan items
cannot be applied as written; each needs Brian's decision before Milestone 1 (guardrail "two instructions conflict").

| # | Plan says | Repository has | Suggested resolution |
|---|---|---|---|
| C1 | Next.js, `next/font/google` in `fonts.ts` | Vite 8 single-page app, no Next.js | Load Fraunces, Nunito and Patrick Hand with a Google Fonts `<link>` in `index.html` (or self-host the files under `src/skin/assets/fonts/`). Needs approval: it edits `index.html`, which is outside `src/skin/`. |
| C2 | Flag reads `process.env.NEXT_PUBLIC_SKIN` | Vite exposes only `VITE_*` variables via `import.meta.env` | Use `import.meta.env.VITE_SKIN === 'painted'`; keep the `?skin=painted` / `?skin=classic` query override. |
| C3 | "Mount font class names at the layout level" | No layout file; `src/main.tsx` renders `src/ui/App.tsx` | Set `data-skin` and the font class on `<html>` from `App.tsx`, the same way it already toggles `reduce-motion` and `large-text`. |
| C4 | Tokens define `--font-display` | `src/index.css` already defines `--font-display` in the Tailwind `@theme` block (used by the whole classic UI) | Name the painted font variables `--skin-font-display`, `--skin-font-body`, `--skin-font-hand` so the classic skin is not affected. |
| C5 | Game title "Finish the Word" | `GAME_TITLE = 'Steal a Poop'` in `src/config.ts` | Decision 10 says "Finish the Word" until Brian says otherwise. Changing `src/config.ts` would change the classic skin too, so the painted skin should hard-code its own title in `src/skin/`. Confirm. |
| C6 | Phases `setup / turn / roundEnd / gameEnd` | Engine phases are `intro / playing / gameOver`; there is no round-end phase. A round ends inside `advance()` and the next round's `intro` (2.5 s) starts immediately, with a `burn` event if the pile was not banked. | Map `intro` (round > 1) to `roundEnd` then `turn`; see State below. The plan's "TallyBoard between rounds, Continue skips" needs a pause the engine does not have: the tally can only show during the 2.5 s intro. See Gaps G4. |
| C7 | Dependencies: framer-motion only | Already installed this session, uncommitted: `three`, `@react-three/fiber`, `@react-three/drei` (the 3D table) | The painted skin will not use them. Decide whether the 3D classic table stays. |
| C8 | Keyboard: "keep the existing input element semantics (same id, aria attributes)" | The input has no `id`; it is labelled by `aria-label` starting "Type a word" (e2e tests select it with `getByLabel(/^Type a word/)`) | Keep the same `aria-label`. |

Uncommitted working-tree changes made earlier this session (not part of the plan): the tutorial no longer auto-starts and
has a homepage button (`App.tsx`, `StartScreen.tsx`, `e2e/game.spec.ts`, `README.md`), and the classic table became a
three.js scene (`Table.tsx`, `Seat.tsx`, `Flights.tsx`, `Countdown.tsx`, `geometry.ts`, `index.css`, `Pile.tsx` deleted,
`e2e/rooms.spec.ts`, `src/ui/__tests__/seat.test.tsx`, `package.json`, `package-lock.json`). They should be committed or
discarded before Milestone 1 so milestone diffs stay clean.

## 1. Stack

| Item | Value |
|---|---|
| Framework | Vite 8.3.5 + React 19.3 single-page app (`index.html` → `src/main.tsx` → `src/ui/App.tsx`). No router. |
| Base path | `/steal-a-poop/` (matches GitHub Pages). Dev URL `http://localhost:5173/steal-a-poop/` |
| TypeScript | 7.0, `tsconfig.json`: strict, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`, `jsx: react-jsx`, includes `src`, `server`, `vite.config.ts` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), theme tokens in `src/index.css` `@theme`; utility classes inline in components; a few global classes in `src/index.css` |
| Fonts | None loaded. `--font-display: 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif` |
| Animation | framer-motion 14.9 (installed). CSS keyframes in `src/index.css` (`shake`, etc.) |
| State | zustand 5 |
| Audio | Web Audio synth in `src/audio/sound.ts`, no audio files |
| Unit tests | Vitest 5 |
| E2E tests | Playwright 1.64 (`playwright.config.ts`, specs in `e2e/`); uses `@axe-core/playwright` for accessibility. No screenshot tests yet. No Storybook. |
| Build | `npm run build` (= `tsc -b && vite build`) |
| Type check | `npx tsc -b` |
| Lint | None configured (no ESLint, no lint script) |
| Test | `npm test` (= `vitest run`); E2E `npm run e2e` (set `PW_CHROMIUM` to use an installed Chromium) |

## 2. State

Store: `src/state/store.ts`, `useStore` (zustand). Game state is `useStore(s => s.game)`, type `GameState` in
`src/engine/types.ts`. Room games use the same `game` field, filled from the server by `src/state/roomStore.ts` through
`src/state/bridge.ts`. Clock: `useStore(s => s.now)` (engine time, ms).

### TableView field map

| TableView field | Source | Notes |
|---|---|---|
| `mode` | `s.mode`: `'quick' \| 'daily' \| 'practice' \| 'tour' \| 'room'` | Map `tour` → `tutorial`, `room` → `rooms`. |
| `phase` | `s.game` null → `setup`; `game.phase` `'intro' \| 'playing' \| 'gameOver'` | `playing` → `turn`; `gameOver` → `gameEnd`; `intro` with `game.round > 1` → `roundEnd`; `intro` with round 1 → `setup`. See C6. |
| `round` | `game.round` | `1 \| 2 \| 3` |
| `turn` | `game.players[game.turn.seat].turnsTaken + 1` | `turnsTaken` counts turns used this round. |
| `twist` | `game.modifier` | Map `no_e`→`noE`, `six_plus`→`sixPlus`, `double_letter`→`doubleLetter`, `vowel_double`→`vowelDouble`, `double_points_fast`→`doublePointsShort`. Never null in the engine. |
| `pile` | `game.pile` | |
| `letter` | `game.chainLetter` | Always set. |
| `isTrapLetter` | derived: `TRAP_LETTERS.has(game.chainLetter)` (`src/engine/constants.ts`) | Also `game.trap` (`{ trapperSeat, victimSeat, letter }`) holds the live trap. |
| `players[].id` | `player.id` (number seat index) | TableView wants `string`; use `String(id)`. |
| `players[].name` | `player.name` | |
| `players[].isYou` | `player.id === s.mySeat` | |
| `players[].isBot` | `!player.isHuman` | |
| `players[].difficulty` | `player.difficulty` (null for humans) | |
| `players[].creature` | not in store; skin assigns from `player.id` | As the plan intends. |
| `players[].banked` | `player.banked` | |
| `players[].dimmed` | not exposed | Derive from events (`steal` victim, `stealFail`) until the next turn starts. |
| `currentPlayerId` | `game.turn?.seat` | Null during `intro` and `gameOver`. |
| `youId` | `s.mySeat` | |
| `secondsLeft` | `(game.turn.endsAt - s.now) / 1000`, floored at 0 | Same formula as `SecondsLeft` in `src/ui/Countdown.tsx`. |
| `turnSeconds` | `game.turn.durationMs / 1000` | 5..10, or 25 for the human in practice/tour. |
| `stealOpen` | `inStealWindow(game, s.now)` from `src/engine` | Plan wants it false on your own turn; `InputBar` computes `canSteal = stealOpen && !myTurn`. |
| `typed` | **not exposed**: `useState` inside `src/ui/InputBar.tsx` | See Gaps G1. |
| `message` | **not exposed**: `hint` and `fix` are `useState` inside `InputBar` | Built from `ActionResult.reason` via `rejectMessage()` in `src/lib/messages.ts` and `ActionResult.suggestion`. See G1. |
| `longestWord` | derived: longest `player.longestWord` across players | Tie-break input in `src/engine/standings.ts`. |
| `winnerIds` | `game.winners` (seat numbers) | Set at game over. |
| `streakDays` | not in store; read-only from `getDaily(dateKey)` in `src/lib/daily.ts` for the last 7 UTC days | Store has `s.streak` (count) only after a daily game ends; `getStreak(today)` gives the count. |
| `dailyPlayedToday` | `getDaily(utcDateKey(new Date())) !== null` | `utcDateKey` from `src/engine`. |

### VisualEvent sources

The engine emits events: `game.events` (array of `GameEvent`, each `{ id, at, kind, seat, text, amount, word? }`),
with `game.eventSeq` as the latest id. They are written by `emit()` in `src/engine/reducer.ts`. The existing hook
`useNewEvents(handler)` (`src/ui/useNewEvents.ts`) subscribes and calls the handler once per new event. The skin should
subscribe the same way (read-only), not derive from diffs.

| VisualEvent | Engine event | Notes |
|---|---|---|
| `accepted` | `play` (`seat`, `word`, `amount` = points) | |
| `banked` | `bank` (`seat`, `amount`) | |
| `stole` | `steal` (`seat` = stealer, `word`, `amount` = gain) | `fromId` is not on the event: it is the `game.turn.seat` from the state before the event. |
| `stealFailed` | `stealFail` (`seat`, `amount` = negative delta) | |
| `timedOut` | `timeout` (`seat`, `amount` = −5 or 0 in practice) | `trapperId` comes from a `trapSprung` event emitted just before it (`seat` = victim, `amount` = 5); the trapper is `game.trap.trapperSeat` in the previous state. |
| `trapSet` | not emitted | Derive: `game.trap` changes from null to set (letter = `trap.letter`). |
| `stealWindowOpened` | not emitted | Derive: `inStealWindow` false → true. |
| `roundStart` | `roundStart` | Emitted when each round's intro begins. |
| `roundEnd` | not emitted | Derive: `roundStart` with `round > 1` (a `burn` event, if any, comes just before it). |
| `gameEnd` | `gameOver` | Winners in `game.winners`. |

Also emitted, no VisualEvent yet: `invalid`, `burn` (unbanked pile lost at round end), `chainReset` (chain letter
re-drawn when no legal word exists), `seatBot` (a room player left and a bot took the seat).

## 3. Screens

There is no router; `src/ui/App.tsx` chooses the screen from state.

| Screen | Component | How it is reached |
|---|---|---|
| Home | `src/ui/StartScreen.tsx` | `App.tsx`: no game, no room, lobby closed |
| Quick Game setup | inside `StartScreen.tsx` (name, player count, difficulty, Quick Game button) | Same screen as Home |
| Table | `src/ui/GameScreen.tsx` (uses `TopBar`, `Table`, `InputBar`, `Panels`, `RoundBanner`, `Toasts`, `Tour`/`CoachTips`, `EndScreen`) | `App.tsx` when `s.game !== null` |
| Round transition | `src/ui/RoundBanner.tsx` (inside `GameScreen`) | Shown during `phase === 'intro'` |
| Results | `src/ui/EndScreen.tsx` (overlay inside `GameScreen`) | `game.phase === 'gameOver'` |
| Daily Table | Same `GameScreen`, `mode === 'daily'`; entry button and share button in `StartScreen.tsx` | |
| Practice | Same `GameScreen`, `mode === 'practice'`; hint chips in `InputBar.tsx` | |
| Tutorial | Same `GameScreen`, `mode === 'tour'`, with `src/ui/Tour.tsx` + `src/ui/tourSteps.ts` | |
| Rooms lobby | `src/ui/Lobby.tsx` (lobby) and `src/ui/RoomScreen.tsx` (waiting room) | `useRoomStore` `open` / `room`; only offered when built with `VITE_SERVER_URL` |
| Settings | `src/ui/Settings.tsx` (dialog) | Opened from `StartScreen.tsx` (⚙️) |
| How to Play | `src/ui/Guide.tsx` (dialog) | Opened from `StartScreen.tsx` |

## 4. Switch points

| Switch point | What it switches |
|---|---|
| `src/ui/App.tsx` | The single top-level switch: `inGame ? <GameScreen/> : inRoom ? <RoomScreen/> : lobbyOpen ? <Lobby/> : <StartScreen/>`. Every painted screen (Home, Table, Rooms) can be mounted here behind the flag, and this is also where `<html data-skin>` and the font class go (C3). |
| `src/ui/GameScreen.tsx` | Only if the painted table should reuse the classic overlays (Tour, EndScreen, panels) instead of replacing the whole screen. Prefer swapping at `App.tsx`. |
| `index.html` | Only for C1 (font loading), if approved. |

## 5. Engine files (do not touch)

Rules, timers, scoring, bots, word list, typo detection:
- `src/engine/*.ts` (`bots.ts`, `constants.ts`, `dictionary.ts`, `game.ts`, `hints.ts`, `index.ts`, `penalties.ts`, `rarity.ts`, `reducer.ts`, `rng.ts`, `scoring.ts`, `standings.ts`, `timer.ts`, `types.ts`, `typos.ts`, `validation.ts`)
- `src/engine/__tests__/*`
- `public/words.txt`

State, networking, persistence:
- `src/state/store.ts`, `src/state/gameClient.ts`, `src/state/bridge.ts`, `src/state/roomStore.ts`, `src/state/socialStore.ts`
- `src/net/*` (`client.ts`, `config.ts`, `protocol.ts`)
- `src/lib/daily.ts`, `src/lib/storage.ts`, `src/lib/tips.ts`, `src/lib/nickname.ts`, `src/lib/messages.ts`, `src/lib/modifiers.ts`, `src/lib/share.ts`
- `src/auth/*` and its tests
- `server/**` (game server, auth, economy, moderation, database) and its tests
- `db/migrations/*`, `scripts/*`

All existing tests: `src/**/__tests__/*`, `server/**/*.test.ts`, `e2e/*.spec.ts`.

## 6. Existing callbacks

All on `useStore` unless noted.

| Plan name | Existing function | Signature |
|---|---|---|
| play | `act` | `act({ type: 'play', seat: mySeat, word }) => ActionResult \| null \| Promise<ActionResult \| null>` |
| bank | `act` | `act({ type: 'bank', seat: mySeat })` |
| steal | `act` | `act({ type: 'steal', seat: mySeat, word })` |
| setTyped | none in the store | Local `setValue` in `InputBar.tsx`; see G1. |
| chooseBots | `setSettings` | `setSettings({ playerCount: n })`; `n` is total seats (4..8 shown in UI = 3..7 bots) |
| chooseDifficulty | `setSettings` | `setSettings({ difficulty: 'easy' \| 'medium' \| 'hard' })` |
| start | `start` | `start(mode: 'quick' \| 'daily' \| 'practice' \| 'tour' \| 'room') => boolean`; also `startTour(after: 'menu' \| 'quick')` |
| continue | none | Rounds advance on their own after the 2.5 s intro; see G4. |
| openSettings | none in the store | `StartScreen` holds local `useState` for the Settings dialog. |
| Other | `rematch()`, `quit()`, `suggest(count) => string[]` (practice hints), `pause()`, `resume()`, `endTour(next)`, `toggleMute()`, `setVolume(v)`, `setReduceMotion(on)`, `setLargeText(on)`, `retryDictionary()`, `loadDictionary()` | |

The nickname is also a setting: `setSettings({ name })`, checked by `checkNickname()` in `src/lib/nickname.ts`.

## 7. Timer

- One `requestAnimationFrame` loop (`useGameLoop` in `src/ui/hooks.ts`) calls `useStore.getState().frame(performance.now())`
  every frame. In solo games `frame` runs `client.tick` (engine `advance`); in room games the server is authoritative and
  `frame` only updates `now` to server time (`Date.now() + bridge.skew()`).
- The turn is `game.turn = { seat, startedAt, endsAt, durationMs, botActAt, stealPlans }`, all in engine ms.
- `secondsLeft` is not stored; compute `(turn.endsAt - now) / 1000`.
- The steal window is the last `STEAL_WINDOW_MS = 3000` ms of a turn. It is exposed as a function, not a boolean:
  `inStealWindow(game, now)` from `src/engine`.
- The tutorial pauses the clock (`paused`, `timeOffset` in the store); `now` freezes while paused.

## 8. Gaps

| # | Gap | Smallest read-only way to get it |
|---|---|---|
| G1 | `typed` and `message` live in `InputBar`'s local state, not the store | The painted `InputStrip` keeps its own local state and calls `act()` exactly as `InputBar` does (`rejectMessage()` for reasons, `suggestion` for the typo fix). No store change. This duplicates about 30 lines of `InputBar` logic in `src/skin/`. |
| G2 | `dimmed` is not tracked | Derive in the skin from `steal` (victim) and `stealFail` events, cleared when `game.turn.seat` changes. |
| G3 | `stole.fromId` and `timedOut.trapperId` are not on the events | Keep the previous `game` snapshot in the event hook and read `turn.seat` / `trap.trapperSeat` from it. |
| G4 | No round-end pause and no `continue` action; the next round starts after a fixed 2.5 s intro | The tally can only show during the intro. A "Continue" button cannot exist without an engine change. Ask Brian. |
| G5 | `streakDays` (last 7 days) is not in the store | Read `getDaily()` for each of the last 7 UTC date keys in the skin (read-only `localStorage` access through the existing function). |
| G6 | Practice hint | `suggest(count)` in the store returns word ideas; the classic UI shows them as chips. The painted "book" can call the same function. |
| G7 | Reduce-motion setting exists | `s.reduceMotion` in the store, plus `useReduceMotion()` in `src/ui/useReduceMotion.ts`, which already combines it with the media query. `useMotionLevel()` should use it. |
| G8 | Fonts and env flag | See C1–C4. |

## Questions for Brian before Milestone 1

1. Fonts: may `index.html` get a Google Fonts `<link>` (C1), or should the fonts be self-hosted under `src/skin/`?
2. Flag: OK to use `VITE_SKIN` instead of `NEXT_PUBLIC_SKIN` (C2)?
3. Title: should the painted skin say "Finish the Word" while the classic skin keeps "Steal a Poop" (C5)?
4. Round transitions: accept a tally that shows only during the 2.5 s intro with no Continue button, or approve an engine change (G4)?
5. The uncommitted 3D table and tutorial changes: commit them first, or discard them (C7)?

## Decisions taken (Brian: "do everything, don't stop for review")

1. Fonts: Google Fonts `<link>` in `index.html` (Fraunces, Nunito, Patrick Hand).
2. Flag: `VITE_SKIN=painted` or `?skin=painted`; `?skin=classic` forces the old look. Default stays classic.
3. Title: the painted skin says "Finish the Word"; the classic skin keeps "Steal a Poop".
4. Round transitions: the tally shows during the engine's 2.5 s intro; no Continue button (no engine change).
5. The 3D table is the core of the design and stays: the painted skin draws its own 3D table (painted colours,
   round creatures, a lantern for the pile, the same turn-following camera) over the procedural painted Scene.
6. Rooms lobby and waiting room keep the classic screens until the server is live (plan Milestone 7).
7. Guide (How to Play), the tutorial cards, community Hub and sign-in dialogs are reused unchanged; the cheat sheet,
   chain history and chat open in a painted frame around the existing content.
