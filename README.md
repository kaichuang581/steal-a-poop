# Steal a Poop

A free browser word-chain game: solo against 3–7 bots, no backend, no accounts.
The title lives in one constant: `src/config.ts` (`GAME_TITLE`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173/steal-a-poop/  (the Vite base path matches GitHub Pages)
```

```bash
npm test         # Vitest, engine unit tests
npm run build    # typecheck + production build
```

The dictionary is the ENABLE word list in `public/words.txt` (172,823 lowercase words,
one per line). It is fetched once at startup and held in a `Set`.

## Architecture

```
src/engine/   pure TypeScript, zero React imports. Deterministic given a seed.
src/state/    zustand store + GameClient seam (the thing a server replaces)
src/ui/       React components: read state, dispatch actions (incl. tour, guide, tips)
src/audio/    Web Audio synth (no audio files)
src/lib/      nickname filter, storage, share card, daily streak, copy
```

**Timing.** The engine never reads a clock. Every call takes `now` (ms):
`advance(state, ctx, now)` runs everything that became due (bot moves, bot steals,
timeouts, round intro end) in timestamp order, and `apply(state, ctx, action, now)`
applies a human action. One `requestAnimationFrame` loop in the UI passes
`performance.now()`. Remaining time is always computed from timestamps, so a throttled
or backgrounded tab catches up correctly instead of drifting.

**Determinism.** All randomness comes from a Mulberry32 state stored *inside*
`GameState`, so the same seed and the same action/timestamp sequence replays exactly.
The Daily Table seed is `daily:YYYY-MM-DD` (UTC).

**Server seam.** The UI only talks to `GameClient` (`src/state/gameClient.ts`):
`create`, `tick`, `act`. `createLocalClient` wraps the engine. A realtime server would
run `advance`/`apply` authoritatively and a networked client would implement the same
interface. Note `apply` already rejects actions from non-human seats.

### File map

| Path | Purpose |
|---|---|
| `src/config.ts` | Game title and tagline |
| `src/engine/types.ts` | `Player`, `GameState`, `Action`, `RoundModifier`, events |
| `src/engine/constants.ts` | Every tunable rule number (tokens, penalties, windows) |
| `src/engine/rng.ts` | Seeded RNG, shuffle, pick |
| `src/engine/dictionary.ts` | `Set`-backed dictionary + first-letter index for bots |
| `src/engine/rarity.ts` | **`rarityOf`: the single placeholder heuristic to replace** |
| `src/engine/scoring.ts` | Word points, letter bonuses, modifier multipliers |
| `src/engine/validation.ts` | Word validity incl. modifier rules |
| `src/engine/timer.ts` | Turn duration / pile shrink |
| `src/engine/bots.ts` | Difficulty profiles, personalities, word choice |
| `src/engine/game.ts` | `createGame`, daily setup |
| `src/engine/reducer.ts` | `advance` + `apply`: turns, bank, steal, trap, burn, rounds |
| `src/engine/standings.ts` | Ranking, tie-breaks, winners, stats |
| `src/engine/hints.ts` | `suggestWords`: practice-mode word ideas |
| `src/engine/__tests__/` | Vitest suites |
| `src/state/store.ts` | zustand store, settings, daily attempt bookkeeping |
| `src/state/gameClient.ts` | The client interface a server replaces |
| `src/ui/*` | Screens and components (Table, Seat, Pile, InputBar, panels, toasts, end screen…) |
| `src/ui/Tour.tsx`, `tourSteps.ts` | Interactive first-game tutorial (data-driven steps) |
| `src/ui/Guide.tsx`, `guideContent.ts` | How to Play hub: basics, scoring, glossary, FAQ |
| `src/ui/ScoringTable.tsx` | Scoring reference, built from the engine's own constants and functions |
| `src/ui/CoachTips.tsx`, `src/lib/tips.ts` | One-time contextual tips and the first-run flag |
| `src/ui/Settings.tsx` | Sound, replay tutorial, reset tips |
| `src/audio/sound.ts` | Synthesized sounds, unlocked on first tap, mute persisted |

## Learning modes

- **Tutorial (`mode: 'tour'`).** First Quick Game launches it once (skippable); replay it from
  Settings. It is a real game with scripted bots: they answer quickly, never bank or fumble, and
  after you bank the last bot runs into its steal window so you can try one. The game clock is
  paused on explanation steps (the store tracks an offset against `performance.now()`), and also
  while the steal prompt is up.
- **Practice (`mode: 'practice'`).** Easy bots, 25s human turns, no penalties, an invalid word is
  rejected so you can retry, and a Hint button suggests valid words. Not recorded anywhere.
- **Tips** (round modifier, pile, steal tokens, trap) show once each; "Show gameplay tips again" in
  Settings resets them. Everything is stored in this browser only.

## Rule ambiguities and how they were resolved

1. **Invalid word ends the turn.** Taken literally: an invalid submission costs −5 and
   passes the turn immediately (no retry). A typo therefore costs a whole turn.
2. **Steal is claim, then submit.** A refund ("if the active player finishes first")
   only makes sense if a steal can be pending. Pressing STEAL in the last 3s spends a
   token and arms the claim; submitting a valid word completes it. If the active player
   finishes first, pending claims are refunded. Invalid steal word: token lost, claim
   cleared, the turn continues. Typing a word and pressing STEAL/Enter does both steps.
3. **Who plays after a steal.** The victim's turn is consumed (counts toward their 5),
   the stealer's turn count is unchanged, and play continues with the seat after the victim.
4. **Trap.** A word ending in X/Z/Q/J traps whoever owns the *next turn*. The trapper
   gets +5 if that player times out or submits an invalid word. Playing, banking, or being
   stolen from clears the trap with no payout. A word played by a stealer can set a trap too.
5. **Penalties hit the banked score** and can make it negative. The pile is untouched.
6. **Rounding.** `length × rarity` is rounded to a whole number before adding letter
   bonuses; modifier multipliers apply last.
7. **Bank on an empty pile** is allowed and acts as a pass (the button just shows 0).
8. **"Double points, 2s shorter":** the 2s is subtracted before the 5s floor.
9. **"Double letter"** means two identical *adjacent* letters (ball, not banana).
10. **Rounds 2 and 3.** The chain letter simply continues; only round 1 draws a seeded
    start letter (from letters with ≥300 dictionary words). The first player rotates each
    round (seat 0, then 1, then 2). The three modifiers are drawn without repeats at game start.
11. **Timer** is fixed from the pile at the start of a turn; it does not shrink mid-turn.
12. **Tokens** reset each round; steal/word stats are game-wide.
13. **Tie-break "longest word"** is the longest single word a player played in the game.
    A complete tie shares the win.
14. **Bots steal from any player's turn**, not only the human's. Medium difficulty is
    interpolated between Easy and Hard (3–7s, 12% fail). A bot "fail" is a timeout.
15. **Bot bank thresholds** are drawn per bot in a band by personality
    (cautious 15–25, greedy 40–60, random 20–50).
16. **Daily Table:** starting it uses the day's one attempt (closing the tab mid-game
    forfeits it). Streak counts consecutive UTC days *played*, win or lose. Lineup size
    (4–8 seats), bots, letter and modifiers all derive from the date seed; difficulty is Medium.
18. **Dead rounds.** A round could open on a letter with no legal word (letter E under "No E",
    since the chain letter carries over). The first round never starts on one, and when a later
    round opens on one the chain letter is re-drawn (seeded) and announced.
19. **Practice rules.** No −5 for timeouts or invalid words, invalid words and bad steal words
    are rejected (claim kept) instead of ending the turn, and the human timer is 25s.
17. **Dictionary.** Words are used as-is from ENABLE; the 3-letter minimum filters its
    2-letter words at validation time.

## Known limitations

- Rarity is a letter-frequency heuristic, not real word frequency (replace `rarityOf`).
- Sounds are synthesized and unit-untested; they were verified to run without errors,
  not by ear.
- Mobile layout was checked in Chromium device emulation, not on a physical phone with a
  real on-screen keyboard.
- No UI unit tests; the engine is the tested layer.
