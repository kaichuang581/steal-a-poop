import { load, save } from '../lib/storage';

/** One dream a night, like a daily puzzle: starting counts as the attempt. */
export interface DreamRecord {
  date: string;
  status: 'started' | 'done';
  count?: number;
  longest?: number;
  /** A missed night dreamt the day after (V4 Part 12.2 rule 4). */
  repaired?: boolean;
}
/** The streak (V4 Part 12.1): consecutive nights, the longest ever, and the Warm Blankets held. */
export interface Streak {
  count: number;
  /** The last night counted (a blanket-covered night counts). */
  last: string;
  best: number;
  blankets: number;
  /** The count at which the last blanket was earned. */
  earnedAt: number;
  /** Set by `settle` the day a blanket covered a night, cleared when read (`takeCoverNotice`). */
  covered?: boolean;
}
export const MAX_BLANKETS = 2;
export const BLANKET_EVERY = 7;

const DREAM_KEY = 'sap:dream';
const STREAK_KEY = 'sap:dream-streak';
const BEST_KEY = 'sap:dream-best';

export function getDream(date: string): DreamRecord | null {
  const rec = load<DreamRecord | null>(DREAM_KEY, null);
  return rec && rec.date === date ? rec : null;
}

export function markDreamStarted(date: string): void {
  save(DREAM_KEY, { date, status: 'started' } satisfies DreamRecord);
}

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function previousDay(date: string): string { return shiftDay(date, -1); }
/** Whole days from `a` to `b` (positive when b is later). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Loads the streak, migrating the old `{ count, last }` shape (best = count, no blankets). */
export function loadStreak(): Streak {
  const raw = load<Partial<Streak>>(STREAK_KEY, { count: 0, last: '' });
  return { count: raw.count ?? 0, last: raw.last ?? '', best: raw.best ?? raw.count ?? 0, blankets: raw.blankets ?? 0, earnedAt: raw.earnedAt ?? 0, covered: raw.covered };
}
function saveStreak(s: Streak): void { save(STREAK_KEY, s); }

/**
 * Covers missed nights with Warm Blankets (Part 12.2 rule 3): while the last night counted is older than yesterday
 * and the gap is at most the blankets held, each missed night is covered, one blanket each; a gap larger than the
 * blankets spends nothing. Runs the first time the app looks at the streak after a miss.
 */
export function settle(today: string): Streak {
  const s = loadStreak();
  if (!s.last) return s;
  const gap = daysBetween(s.last, today) - 1; // nights missed between the last counted night and today
  if (gap <= 0 || gap > s.blankets) return s;
  const covered = load<string[]>(COVERED_KEY, []);
  for (let k = 1; k <= gap; k++) covered.push(shiftDay(s.last, k));
  save(COVERED_KEY, covered.slice(-14));
  s.last = shiftDay(s.last, gap);
  s.blankets -= gap;
  s.covered = true;
  saveStreak(s);
  return s;
}

/** The streak as of today: counts if the last night counted is today or yesterday. */
export function getDreamStreak(today: string): number {
  const s = settle(today);
  return s.last === today || s.last === previousDay(today) ? s.count : 0;
}

/** Whether a blanket covered a night since the streak was last looked at; reading it clears the notice. */
export function takeCoverNotice(): boolean {
  const s = loadStreak();
  if (!s.covered) return false;
  s.covered = false;
  saveStreak(s);
  return true;
}

/**
 * A repair (Part 12.2 rule 4): when the blankets could not cover the gap, the gap is exactly one night and that
 * night's dream was never played, last night's dream can still be dreamt today to restore the chain.
 */
export function repairAvailable(today: string): string | null {
  const s = settle(today);
  if (!s.last || s.last !== shiftDay(today, -2)) return null;
  const missed = previousDay(today);
  return getDream(missed) ? null : missed;
}

/** The most sheep ever counted, daily or practice. */
export function getDreamBest(): number {
  return load<number>(BEST_KEY, 0);
}

export function recordBest(count: number): number {
  const best = Math.max(getDreamBest(), count);
  save(BEST_KEY, best);
  return best;
}

/**
 * Saves the finished dream and returns the streak of consecutive nights dreamt (Part 12.2 rules 1 and 2): yesterday
 * counted makes count + 1, otherwise the streak starts again; `best` follows; every seven nights earn a blanket, two
 * at most. A repair (`rec.repaired`, dated the missed night) rejoins the chain without earning a blanket by itself.
 */
export function recordDream(rec: DreamRecord): number {
  const played = load<DreamRecord | null>(DREAM_KEY, null);
  // A repair's record must not hide today's own record; keep whichever is today's.
  if (!rec.repaired || !played || played.date < rec.date) save(DREAM_KEY, rec);
  if (rec.repaired) save(REPAIRED_KEY, rec.date);
  recordBest(rec.count ?? 0);
  const s = rec.repaired ? loadStreak() : settle(rec.date);
  if (s.last === rec.date) return s.count;
  s.count = s.last === previousDay(rec.date) ? s.count + 1 : 1;
  s.last = rec.date;
  s.best = Math.max(s.best, s.count);
  if (!rec.repaired && s.count >= BLANKET_EVERY && s.count - s.earnedAt >= BLANKET_EVERY && s.blankets < MAX_BLANKETS) { s.blankets += 1; s.earnedAt = s.count; }
  saveStreak(s);
  return s.count;
}
const REPAIRED_KEY = 'sap:dream-repaired';

export type DayStatus = 'played' | 'blanket' | 'repair' | 'missed' | 'today';
/** The last seven nights, oldest first, today last (Part 12.2 rule 6). */
export function dreamStreakDays(today: string): DayStatus[] {
  const rec = getDream(today);
  const s = settle(today);
  const count = s.last === today || s.last === previousDay(today) ? s.count : 0;
  const repaired = load<string>(REPAIRED_KEY, '');
  const coveredNights = new Set<string>();
  // The nights a blanket covered are the ones in the run with no record of their own: we only know the most recent cover.
  const runEnd = s.last === today ? 0 : 1;
  const blanketed = load<string[]>(COVERED_KEY, []);
  for (const d of blanketed) coveredNights.add(d);
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    const date = shiftDay(today, -back);
    if (back === 0) return rec?.status === 'done' ? 'played' : 'today';
    if (date === repaired) return 'repair';
    if (coveredNights.has(date)) return 'blanket';
    return back >= runEnd && back < runEnd + count ? 'played' : 'missed';
  });
}
const COVERED_KEY = 'sap:dream-covered';
