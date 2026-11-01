# Balance findings

From `docs/BALANCE.md`: two runs of 2,400 bot-only games each (4, 6, 8 and 10 seats at each
difficulty), one with the shipped rules and one with 3 turns at 8 to 10 seats. Re-run with
`npm run simulate`; the generated tables are overwritten each run, so notes live here.

## What the data supports

- **No seat-position bias among bots.** Win shares for seats 1 and up sit around 1/n with the spread
  expected from 200 games (for 10 seats, roughly 8–14%). Seat 0 is excluded from this reading: in the
  simulation it uses a fixed "random" personality with a bank threshold of 30, unlike the other seats,
  so its win rate (for example 33% at 4 seats, hard) reflects that setting and says nothing about
  going first.
- **Game length grows fast with seats.** A game averages 4.0 minutes at 4 seats (hard) but 9.7 at 10
  seats, and 12.0 (medium) to 15.6 (easy) at 10 seats, because every player takes 5 turns per round.
  Easy and Medium 10-seat games are long for a casual session.
- **Steals are frequent at big tables.** About 25–28 steals per 10-seat game, out of 150 turns, so
  roughly one turn in six is stolen. That is by design with unlimited steals, but it is the first
  thing to check with real players.
- **Easy bots lose points to themselves.** Easy bots average 17–31 timeouts per game and 1–7 failed
  steals (each halves the bot's banked score), and finish below zero in about 0.8 of games. Easy is
  therefore weak in absolute terms: its winner scores 110–165 against 268–403 at Medium and Hard.
- **Winner scores rise with table size** (Hard: 316 at 4 seats, 402 at 10), as expected from more
  turns and more pile to bank.

## What the data cannot say

- Whether Medium *feels* right against a person. Bots here play only against bots; human typing speed,
  word knowledge and risk-taking are not modelled.
- Whether failed-steal halving is too harsh. It only appears here through bot failure rates.

## Decision on bot tuning (item 27)

No change to the bot profiles. Nothing in the data shows a bot difficulty out of range relative to
the others, and the questions that matter (is Medium fair to a person, is halving too harsh) need
human playtests. Revisit after the 10-player playtest.

## Open recommendations

1. Fewer turns per player per round at 8 to 10 seats would cut game length by about 40% (measured
   below); 3 turns brings 8- and 10-seat Medium under 8 minutes. Still a rules change, and still
   needs a decision plus a human playtest.
2. Playtest steal frequency with real people at 6+ seats.

## Turn-count experiment at 8 to 10 seats

`TURNS_BY_SEATS` in `src/engine/constants.ts` lets a table size use its own turns per round. It ships
with no overrides, so the game is unchanged; this run measures what pulling that lever would do. Both
runs are 200 games per row on the same seeds, so rows compare directly. Full tables in
`docs/BALANCE.md`.

| Seats | Bots | Length, 5 turns | Length, 3 turns | Change | Winner score, 5 → 3 |
|---|---|---|---|---|---|
| 8 | easy | 12.5 min | 7.5 min | −40% | 155 → 107 |
| 8 | medium | 9.6 min | 5.9 min | −39% | 339 → 220 |
| 8 | hard | 7.8 min | 4.7 min | −40% | 403 → 263 |
| 10 | easy | 15.6 min | 9.4 min | −40% | 165 → 119 |
| 10 | medium | 12.0 min | 7.3 min | −39% | 344 → 237 |
| 10 | hard | 9.7 min | 5.8 min | −40% | 402 → 267 |

What the numbers say:

- **Game length drops about 40%**, close to the 2-in-5 you would predict from removing two of five
turns per round. 8-seat Medium lands at 5.9 minutes and 10-seat Medium at 7.3, both under the
8-minute target in recommendation 1. Only 10-seat Easy (9.4 min) stays above it.
- **Winner scores drop 28–35%**, about the same proportion. Nothing in the spread suggests scoring
breaks down; the gap between first and last stays wide.
- **Last place gets worse and more games end in the red.** At 10 seats Medium, last place falls from
32 to 4 and players finishing below zero rise from 0.2 to 0.6 per game. Fewer turns to recover from
one bad round.
- **Steals fall proportionally** (10 seats Medium: 28.5 → 17.0 per game) because there are fewer
turns to steal from, not because the steal rate changed.
- **The 4- and 6-seat rows are identical in both runs**, which is the check that the override is
scoped to 8 seats and up and nothing else moved.

Not modelled: whether a three-turn game feels *too* short to a person. Bot games are not human games,
and human turns (typing, hints, hesitation) are the slow ones.

**The default is unchanged.** No override ships, so the live game still plays 5 turns at every table
size. This is a measured lever, not a rules change.
