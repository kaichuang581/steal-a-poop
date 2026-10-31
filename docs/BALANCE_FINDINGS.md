# Balance findings

From `docs/BALANCE.md` (2,400 bot-only games: 4, 6, 8 and 10 seats at each difficulty). Re-run with
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

1. Consider fewer turns per player per round at 8 to 10 seats (for example 3 instead of 5) to bring
   game length under about 8 minutes. This is a rules change and needs a decision.
2. Playtest steal frequency with real people at 6+ seats.
