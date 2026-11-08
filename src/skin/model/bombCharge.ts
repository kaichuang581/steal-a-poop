import type { ChainEntry } from '../../engine';

/** Words played since the last time-out, oldest first. Pass skipLast to ignore a time-out that has just happened. */
export function wordsSinceBoom(history: readonly ChainEntry[], skipLast = false): string[] {
  const end = skipLast && history.length && history[history.length - 1].kind === 'timeout' ? history.length - 1 : history.length;
  let start = 0;
  for (let i = end - 1; i >= 0; i--) if (history[i].kind === 'timeout') { start = i + 1; break; }
  const out: string[] = [];
  for (let i = start; i < end; i++) {
    const h = history[i];
    if (h.kind === 'play' && h.word) out.push(h.word);
  }
  return out;
}

/** How much one word swells the bomb: a little for any word, more for a long one. */
export const wordCharge = (word: string) => 0.05 + 0.035 * Math.max(0, word.length - 3);

/** The bomb's size, 1 (fresh) up to 3.2: every word since the last explosion adds to it. */
export function bombSize(words: readonly string[]): number {
  return 1 + Math.min(2.2, words.reduce((sum, w) => sum + wordCharge(w), 0));
}
