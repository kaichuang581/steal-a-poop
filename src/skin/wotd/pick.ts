import { WOTD } from './words';
import type { WotdEntry } from './words';

/** The first day of the list. Days before it count backwards through the same cycle. */
export const WOTD_START = '2026-01-01';

/** Level by weekday (0 = Sunday): Monday and Tuesday 1, Wednesday to Friday 2, the weekend 3. */
const LEVEL_OF_WEEKDAY = [3, 1, 1, 2, 2, 2, 3] as const;
const PER_WEEK = { 1: 2, 2: 3, 3: 2 } as const;
const BY_LEVEL = { 1: WOTD.filter((w) => w.level === 1), 2: WOTD.filter((w) => w.level === 2), 3: WOTD.filter((w) => w.level === 3) };

/** Whole days since 1970-01-01 for a YYYY-MM-DD key. Calendar arithmetic only: no time zone can shift it. */
function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

const weekdayOf = (day: number) => (((day + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday

export function levelFor(dateKey: string): 1 | 2 | 3 {
  return LEVEL_OF_WEEKDAY[weekdayOf(dayNumber(dateKey))];
}

/**
 * The word for a local date key (useToday / localDateKey). Pure and the same for everyone: the date picks the level from
 * its weekday, and the word is the next one in that level's list, counting the earlier days since WOTD_START that used
 * the same level. (Plain days mod the list's length would only ever reach a seventh of each list, because the weekdays
 * repeat every seven days.)
 */
export function wordOfDay(dateKey: string): WotdEntry {
  const day = dayNumber(dateKey);
  const level = levelFor(dateKey);
  const diff = day - dayNumber(WOTD_START);
  const weeks = Math.floor(diff / 7);
  let earlier = weeks * PER_WEEK[level];
  const startWeekday = weekdayOf(dayNumber(WOTD_START));
  for (let i = 0; i < diff - weeks * 7; i++) if (LEVEL_OF_WEEKDAY[(startWeekday + i) % 7] === level) earlier += 1;
  const list = BY_LEVEL[level];
  return list[((earlier % list.length) + list.length) % list.length];
}
