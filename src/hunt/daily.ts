import { load, save } from '../lib/storage';
import type { Mark } from './hunt';

/** One Daily Hunt per day, like a daily puzzle: starting counts as the attempt. */
export interface HuntRecord {
  date: string;
  status: 'started' | 'done';
  defeated?: number;
  damage?: number;
  marks?: Mark[];
  best?: { word: string; damage: number } | null;
}
interface Streak { count: number; last: string }

const HUNT_KEY = 'sap:hunt';
const STREAK_KEY = 'sap:hunt-streak';

export function getHunt(date: string): HuntRecord | null {
  const rec = load<HuntRecord | null>(HUNT_KEY, null);
  return rec && rec.date === date ? rec : null;
}

export function markHuntStarted(date: string): void {
  save(HUNT_KEY, { date, status: 'started' } satisfies HuntRecord);
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getHuntStreak(today: string): number {
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  return s.last === today || s.last === previousDay(today) ? s.count : 0;
}

/** Saves the finished run and returns the streak of consecutive days hunted. */
export function recordHunt(rec: HuntRecord): number {
  save(HUNT_KEY, rec);
  const s = load<Streak>(STREAK_KEY, { count: 0, last: '' });
  if (s.last === rec.date) return s.count;
  const count = s.last === previousDay(rec.date) ? s.count + 1 : 1;
  save(STREAK_KEY, { count, last: rec.date } satisfies Streak);
  return count;
}

/** The last seven days, oldest first: true when the hunt was played (the streak run, plus today once started). */
export function huntStreakDays(today: string): boolean[] {
  const rec = getHunt(today);
  const count = getHuntStreak(today);
  const runEnd = rec?.status === 'done' ? 0 : 1;
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    if (back === 0) return rec !== null;
    return back >= runEnd && back < runEnd + count;
  });
}

const MARK: Record<Mark, string> = { hit: '🟩', crit: '🟨', broke: '🟥', timeout: '⬛', item: '🎒' };

/** The spoiler-free result to share: predators beaten, damage, and one square per turn. */
export function huntShareText(r: { date: string; defeated: number; damage: number; marks: Mark[]; streak: number }): string {
  const rows: string[] = [];
  for (let i = 0; i < r.marks.length; i += 10) rows.push(r.marks.slice(i, i + 10).map((m) => MARK[m]).join(''));
  return [
    `Finish the Word · Daily Hunt ${r.date}`,
    `🐺 ${r.defeated} predator${r.defeated === 1 ? '' : 's'} beaten · 💥 ${r.damage} damage`,
    ...rows,
    r.streak > 1 ? `🔥 ${r.streak}-day streak` : '',
  ].filter(Boolean).join('\n');
}
