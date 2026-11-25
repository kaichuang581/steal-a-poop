import { load, save } from '../../lib/storage';

/**
 * Practice's own best (`bestPractice`, docs/dream/v3/01, section 4), on this device only. A practice run saves here and
 * never into the night's best (src/dream/daily.ts `getDreamBest`, which only a night's record raises now).
 */
const KEY = 'sap:dream-practice-best';
export const getPracticeBest = (): number => load<number>(KEY, 0);
export function recordPracticeBest(count: number): number {
  const best = Math.max(getPracticeBest(), count);
  save(KEY, best);
  return best;
}
