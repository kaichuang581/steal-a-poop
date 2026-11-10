import { load, save } from './storage';

const DAILY_KEY = 'sap:daily';
const STREAK_KEY = 'sap:streak';

export interface DailyRecord {
  date: string;
  status: 'started' | 'done';
  rank?: number;
  players?: number;
  banked?: number;
  longest?: number;
}
export interface Streak { count: number; last: string }

export function getDaily(date: string): DailyRecord | null {
  const rec = load<DailyRecord | null>(DAILY_KEY, null);
  return rec && rec.date === date ? rec : null;
}

/** One attempt per day: starting counts as the attempt. */
export function markStarted(date: string): void {
  save(DAILY_KEY, { date, status: 'started' } satisfies DailyRecord);
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStreak(today: string): number {
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  return s.last === today || s.last === previousDay(today) ? s.count : 0;
}

export function recordResult(rec: DailyRecord): number {
  save(DAILY_KEY, rec);
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  if (s.last === rec.date) return s.count;
  const count = s.last === previousDay(rec.date) ? s.count + 1 : 1;
  save(STREAK_KEY, { count, last: rec.date } satisfies Streak);
  return count;
}
