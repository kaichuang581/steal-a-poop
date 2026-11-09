import { load, save } from '../lib/storage';
import type { Mark } from './hunt';
import { ordinal } from './packs';

/** The Hunt is unlimited: every run is a fresh pack. All that's kept is the best run, for a record to beat. */
export interface HuntBest {
  defeated: number;
  damage: number;
  /** Optional, from plan v7 on (older records have none): the pack, which try it was, the date, and a walk home. */
  code?: string;
  attempt?: number;
  date?: string;
  walked?: boolean;
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
  if (better) {
    const extra: Partial<HuntBest> = {};
    if (run.code !== undefined) extra.code = run.code;
    if (run.attempt !== undefined) extra.attempt = run.attempt;
    if (run.date !== undefined) extra.date = run.date;
    if (run.walked) extra.walked = true;
    save(BEST_KEY, { defeated: run.defeated, damage: run.damage, ...extra } satisfies HuntBest);
  }
  return { best: better ? run : best, isNew: better };
}

/** One character per turn: a hit, a critical, a broken rule, a time-out, an item. */
const MARK: Record<Mark, string> = { hit: 'o', crit: '*', broke: 'x', timeout: '-', item: '+' };

/**
 * The spoiler-free result to share: the pack and which try it was, predators beaten, damage, one mark per turn, and
 * every mark the run had (a walk home, a record, an older word list), then a link to fight the same pack. Without a code
 * (a run from before pack codes) it is the old text exactly.
 */
export function huntShareText(r: {
  defeated: number; damage: number; marks: Mark[]; record?: boolean;
  code?: string; attempt?: number; stale?: boolean;
  /** The boss's name, when the sheep walked home after it. */
  walked?: string;
  /** The link to the pack; left out when there is no page (tests). */
  link?: string;
}): string {
  const rows: string[] = [];
  for (let i = 0; i < r.marks.length; i += 10) rows.push(r.marks.slice(i, i + 10).map((m) => MARK[m]).join(''));
  return [
    'Finish the Word · Hunt',
    r.code ? `Pack ${r.code} · ${ordinal(r.attempt ?? 1)} try` : '',
    `${r.defeated} predator${r.defeated === 1 ? '' : 's'} beaten · ${r.damage} damage`,
    ...rows,
    r.walked ? `Walked home after the ${r.walked}` : '',
    r.record ? 'New personal best' : '',
    r.code && r.stale ? 'Made with an older word list' : '',
    r.code && r.link ? `Fight this pack: ${r.link}` : '',
  ].filter(Boolean).join('\n');
}
