# Spec: time carried between turns (draft for Brian)

Status: **draft, nothing built.** This is an engine change (turn timer), so under `CLAUDE.md` it needs Brian's approval first, its own commit and new tests. Default behaviour must stay exactly as today.

## The idea
The game opens with a 10 second turn. After that, how good the previous word was changes the next player's clock. The bomb timer (visual only, separate) shows that clock.

## Today's rules this touches
- Turn length follows `TURN_MS_BY_ROUND` (16, 12, 9, 7, then 5 s), floor `MIN_TURN_MS` (5 s). See `src/engine/timer.ts` and `constants.ts`.
- A timeout costs one wool ball; none left freezes the sheep.
- About 30% of turns are steal turns (`STEAL_TURN_CHANCE`), with a red steal window at the end of the turn.
- Bots' answer times scale with the round's turn length.
- There is no pile and no points any more, so quality must be measured from the word itself.

## Word quality (proposal, untuned)
The word list (`public/words.txt`, 172,823 plain words) has no frequency data, so rarity cannot be used without adding data. Use only what the engine already knows:
- length points: `max(0, length - 4)`
- hard-letter points: 2 for each of x, z, q, j in the word (the `LETTER_BONUS` letters worth 3)
- `quality = length points + hard-letter points`
- `shift seconds = min(CAP, 0.5 * quality)`, with CAP = 4 s

## Two versions to compare
- **A, more time (your original idea):** the next turn gets `base + shift`. Good words give the next player relief.
- **B, less time (hot-potato pressure):** the next turn gets `base - shift`, never below the 5 s floor. Good words raise the pressure.
- **Control:** today's rules.

## Rules to fix before building
1. The very first turn of the game is 10 s (today round 1 is 16 s). Only that opening turn is special; later turns use the round's base plus or minus the carried shift. This is my reading; confirm it.
2. The shift applies to the next turn only; it does not accumulate.
3. A timeout gives a shift of 0.
4. A steal counts: the stealer's word sets the shift for the following turn.
5. Maximum turn length is 20 s, so A cannot stall the game.
6. It ships as a setting (`timeCarry: 'off' | 'more' | 'less'`, default `'off'`), so the default reproduces today's game exactly.
7. Online rooms use the same engine on the server, so every player sees the same clock.

## How to decide A or B (not yet run)
No simulation has been run. The engine always has a human at seat 0, so a test harness is needed that lets the bot decision play that seat (the engine already has `previewBotTurn`). Then, for each of control, A and B, play 200 seeded games with the same seeds and record:
- average game length in minutes (compare with `estimateMinutes`)
- timeouts per turn
- how many games end by round 3
- steal success rate

Suggested pass marks, to be agreed with Brian after the control run gives the baseline: game length within 25% of control, and timeouts per turn within 25% of control. If A fails on length or timeouts, B is the better fit.

## Open questions for Brian
- A or B?
- Should bots get the same shift, or a fixed turn?
- Is a per-game setting the right home for this, or should it be a round twist?

## Not in this spec
The bomb timer is a visual change (src/skin only) and does not depend on any of this. It can be built whenever.
