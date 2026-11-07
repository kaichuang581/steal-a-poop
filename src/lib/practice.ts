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
