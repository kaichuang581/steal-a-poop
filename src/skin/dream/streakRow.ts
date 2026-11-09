import type { DayStatus } from '../../dream/daily';

/** A box in the streak row: a night of the run, tonight still to play ('today'), or a night still to come. */
export type StreakSlot = DayStatus | 'empty';

/**
 * The seven boxes under a night streak, filled from the left (Brian, 2026-11-09: "the first box isnt filling in, if
 * its a streak the box should be filling in after each day"). They used to be the last seven calendar nights with
 * tonight on the right, so a one-night streak lit only the last box. Now the run's nights fill boxes 1, 2, 3...; an
 * eighth night starts the row again (the count beside it says how long the run really is). A run night keeps its own
 * status (a Warm Blanket or a repair shows as one). Tonight, not yet played, is ringed in the next box; the rest wait
 * empty.
 *
 * `days` is `dreamStreakDays(today)` (oldest first, tonight last), `streak` the current run, tonight included once
 * it is played.
 */
export function streakRow(days: readonly DayStatus[], streak: number): StreakSlot[] {
  const playedTonight = days[days.length - 1] !== 'today';
  const k = streak > 0 ? ((streak - 1) % 7) + 1 : 0;
  const row: StreakSlot[] = [];
  for (let j = 0; j < k; j++) {
    // Nights back from tonight: the run ends tonight if it is played, else last night.
    const back = (playedTonight ? 0 : 1) + (k - 1 - j);
    const st = days[days.length - 1 - back];
    row.push(st === 'blanket' || st === 'repair' ? st : 'played');
  }
  if (!playedTonight && row.length < 7) row.push('today');
  while (row.length < 7) row.push('empty');
  return row;
}
