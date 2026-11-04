import { load, save } from '../lib/storage';

/** One dream a night, like a daily puzzle: starting counts as the attempt. */
export interface DreamRecord {
  date: string;
  status: 'started' | 'done';
  count?: number;
  lucid?: number;
}
interface Streak { count: number; last: string }

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

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getDreamStreak(today: string): number {
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  return s.last === today || s.last === previousDay(today) ? s.count : 0;
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

/** Saves the finished dream and returns the streak of consecutive nights dreamt. */
export function recordDream(rec: DreamRecord): number {
  save(DREAM_KEY, rec);
  recordBest(rec.count ?? 0);
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  if (s.last === rec.date) return s.count;
  const count = s.last === previousDay(rec.date) ? s.count + 1 : 1;
  save(STREAK_KEY, { count, last: rec.date } satisfies Streak);
  return count;
}

/** The last seven days, oldest first: true when the dream was played (the streak run, plus today once started). */
export function dreamStreakDays(today: string): boolean[] {
  const rec = getDream(today);
  const count = getDreamStreak(today);
  const runEnd = rec?.status === 'done' ? 0 : 1;
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    if (back === 0) return rec !== null;
    return back >= runEnd && back < runEnd + count;
  });
}
