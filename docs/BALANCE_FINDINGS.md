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

## Word-frequency rarity (F3)

Run on 2026-11-01 with `npm run simulate -- 200` (200 games per row, 2,400 games). `rarityOf` now reads
`public/word-frequency.txt`, a Google Books Ngram frequency list filtered to the ENABLE dictionary. Words
the list does not cover keep the old letter-frequency estimate, as specified.

### Data and tiers

- **Coverage:** 88,400 of the 172,727 playable ENABLE words are in the list (51.2%); 84,327 fall back.
- **Thresholds:** source ranks 1–10,000 are common, 10,001–30,000 uncommon, above 30,000 rare. The top
  10,000 words cover 94.3% of the source corpus's word occurrences; the top 30,000 cover 98.7%.
- **All playable words:** 30.7% common, 31.5% uncommon, 37.8% rare (previously 51.2% / 44.9% / 3.9%).
- **Words in the list:** 9,079 common, 16,532 uncommon, 62,789 rare.
- **Words outside the list:** 43,980 common, 37,823 uncommon, 2,524 rare. The fallback still calls 97.0%
  of these obscure words common or uncommon, which is why the shift is smaller than the covered-word
  numbers alone suggest.

### Generated table

| Seats | Bots | Steals/game | Failed steals/game | Timeouts/game | Avg bank | Winner score | Last place | Players ending < 0 | Game length (min) | Seat-0 win % |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | easy | 5.0 | 1.3 | 17.4 | 29.6 | 113 | -9 | 0.9 | 6.3 | 21% |
| 4 | medium | 6.5 | 0.9 | 7.8 | 36.3 | 283 | 54 | 0.2 | 4.9 | 22% |
| 4 | hard | 6.3 | 0.3 | 2.6 | 38.7 | 353 | 79 | 0.1 | 4.0 | 37% |
| 6 | easy | 11.2 | 2.7 | 21.9 | 28.0 | 145 | -5 | 0.8 | 9.4 | 10% |
| 6 | medium | 13.8 | 1.9 | 10.4 | 34.5 | 339 | 51 | 0.1 | 7.3 | 15% |
| 6 | hard | 12.9 | 0.6 | 3.4 | 35.8 | 397 | 65 | 0.1 | 5.9 | 17% |
| 8 | easy | 19.0 | 4.7 | 26.9 | 27.7 | 161 | -5 | 0.8 | 12.5 | 12% |
| 8 | medium | 22.2 | 3.2 | 12.1 | 33.0 | 382 | 42 | 0.2 | 9.6 | 12% |
| 8 | hard | 20.1 | 1.1 | 4.5 | 34.4 | 433 | 64 | 0.1 | 7.7 | 14% |
| 10 | easy | 28.2 | 7.0 | 30.5 | 27.2 | 179 | -3 | 0.8 | 15.5 | 10% |
| 10 | medium | 30.5 | 4.0 | 13.6 | 32.2 | 394 | 45 | 0.1 | 11.9 | 9% |
| 10 | hard | 26.9 | 1.5 | 5.1 | 34.0 | 445 | 58 | 0.1 | 9.6 | 11% |

### What changed

- **Winner scores rose by 3–50 points** (roughly 3–15%). Easy moved least (+3 to +14), medium +15 to +50,
  hard +30 to +43. Hard bots deliberately seek rare words, and rare words are now 37.8% of the dictionary
  instead of 3.9%, so the multiplier change lands hardest there.
- **Game length did not move** (at most 0.1 minutes in any row), and timeouts moved by at most 0.5/game.
  Rarity changes points, not timers.
- **Steals rose slightly** (0.0 to 2.1/game), consistent with more turns producing bankable piles, not with
  a rules change.
- **Fewer medium-table players finish below zero** (for example 4 medium: 0.3 to 0.2 per game), because the
  same play now scores more.
- **Seat-0 win share is still within noise** at 200 games per row; the 4-hard row moved from 33% to 37%,
  which is about one standard error and should not be read as a first-seat effect.

### Decision needed

The data makes medium and hard scores about 10% higher. I did not change `RARITY_MULTIPLIER` or the rank
thresholds in this PR; that is a balance decision. Accepting the new numbers is reasonable, since the tiers
now reflect real usage. The alternative is to raise the thresholds (making fewer words rare) or lower the
uncommon/rare multipliers. Separately, 97% of the words outside the list are still called common or
uncommon by the fallback; treating "not in the list" as rare would use real frequency more aggressively,
but it would no longer be the old letter-frequency fallback the task specified.
