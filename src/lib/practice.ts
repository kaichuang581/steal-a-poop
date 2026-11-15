import { PRACTICE_CLOCKS } from '../engine';
import type { Difficulty } from '../engine';
import { load, save } from './storage';

const KEY = 'sap:practice-best';

export interface PracticeRun {
  score: number;
  best: number;
  isNew: boolean;
}

const slot = (clock: number, difficulty: Difficulty) => `${clock}:${difficulty}`;

/** The best practice run on this device for one starting clock and bot level. */
export function getPracticeBest(clock: number, difficulty: Difficulty): number {
  return load<Record<string, number>>(KEY, {})[slot(clock, difficulty)] ?? 0;
}

/** Saves a finished run against its clock and bot level, and says whether it beat the old best. */
export function recordPracticeRun(clock: number, difficulty: Difficulty, score: number): PracticeRun {
  const all = load<Record<string, number>>(KEY, {});
  const old = all[slot(clock, difficulty)] ?? 0;
  if (score <= old) return { score, best: old, isNew: false };
  save(KEY, { ...all, [slot(clock, difficulty)]: score });
  return { score, best: score, isNew: true };
}

/** The bots a practice run can be set against, easiest first. (The clocks are the engine's PRACTICE_CLOCKS, longest first.) */
export const PRACTICE_BOTS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * How much harder a setting makes a run (Brian, 2026-11-13: "practice best could mean easy mode, medium, or hard mode, so
 * its less rewarding to those who do well in hard mode. take in account the time as well"). A run's rating is its words
 * times its bot's weight times its starting clock's: 12 words against the hard bot from 10 seconds is rated 36, more than
 * 31 words against the easy bot from 15. One step harder on either is worth half as much again, two steps twice as much.
 * These are a judgement, not a measurement: change them here and the profile follows.
 */
export const PRACTICE_WEIGHT: { bot: Record<Difficulty, number>; clock: Record<number, number> } = {
  bot: { easy: 1, medium: 1.5, hard: 2 },
  clock: { 15: 1, 10: 1.5, 5: 2 },
};
/** What a run of `words` words is rated at a starting clock and bot level. */
export function practiceRating(clock: number, difficulty: Difficulty, words: number): number {
  return Math.round(words * PRACTICE_WEIGHT.bot[difficulty] * (PRACTICE_WEIGHT.clock[clock] ?? 1));
}

/** One setting's best: the words in the best run there (0 if never played) and what that run is rated. */
export interface PracticeCell { clock: number; difficulty: Difficulty; words: number; rating: number }
/** Every setting's best, a row a bot (easiest first) and a cell a clock (longest first), and the best-rated of them all. */
export interface PracticeSheet { rows: { difficulty: Difficulty; cells: PracticeCell[] }[]; top: PracticeCell | null }

/**
 * The practice bests on this device, set out by bot and starting clock. `top` is the run with the highest rating; when
 * two are rated the same, the one against the harder bot, then the one from the shorter clock.
 */
export function getPracticeSheet(): PracticeSheet {
  const all = load<Record<string, number>>(KEY, {});
  const rows = PRACTICE_BOTS.map((difficulty) => ({
    difficulty,
    cells: PRACTICE_CLOCKS.map((clock) => {
      const kept = all[slot(clock, difficulty)], words = typeof kept === 'number' && kept > 0 ? Math.floor(kept) : 0;
      return { clock, difficulty, words, rating: practiceRating(clock, difficulty, words) };
    }),
  }));
  // Later rows are harder bots and later cells shorter clocks, so "at least as good" keeps the harder of two equals.
  let top: PracticeCell | null = null;
  for (const row of rows) for (const cell of row.cells) if (cell.words > 0 && (!top || cell.rating >= top.rating)) top = cell;
  return { rows, top };
}
