import { load, save } from '../lib/storage';
import type { Mark } from './hunt';

/** The Hunt is unlimited: every run is a fresh pack. All that's kept is the best run, for a record to beat. */
export interface HuntBest {
  defeated: number;
  damage: number;
}

const BEST_KEY = 'sap:hunt-best';

export function getHuntBest(): HuntBest | null {
  return load<HuntBest | null>(BEST_KEY, null);
}

/** Saves the run if it beats the record (more predators, then more damage). Returns the record and whether it is new. */
export function recordHuntBest(run: HuntBest): { best: HuntBest | null; isNew: boolean } {
  const best = getHuntBest();
  // A run that did nothing at all is not a record.
  const better = run.damage > 0 && (!best || run.defeated > best.defeated || (run.defeated === best.defeated && run.damage > best.damage));
  if (better) save(BEST_KEY, { defeated: run.defeated, damage: run.damage } satisfies HuntBest);
  return { best: better ? run : best, isNew: better };
}

/** One character per turn: a hit, a critical, a broken rule, a time-out, an item. */
const MARK: Record<Mark, string> = { hit: 'o', crit: '*', broke: 'x', timeout: '-', item: '+' };

/** The spoiler-free result to share: predators beaten, damage, and one square per turn. */
export function huntShareText(r: { defeated: number; damage: number; marks: Mark[]; record?: boolean }): string {
  const rows: string[] = [];
  for (let i = 0; i < r.marks.length; i += 10) rows.push(r.marks.slice(i, i + 10).map((m) => MARK[m]).join(''));
  return [
    'Finish the Word · Hunt',
    `${r.defeated} predator${r.defeated === 1 ? '' : 's'} beaten · ${r.damage} damage`,
    ...rows,
    r.record ? 'New personal best' : '',
  ].filter(Boolean).join('\n');
}
