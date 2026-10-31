export type Rarity = 'common' | 'uncommon' | 'rare';

export const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.5,
  rare: 2.0,
};

/** Approximate English letter frequency, in percent. Placeholder heuristic. */
const LETTER_FREQ: Record<string, number> = {
  e: 12.7, t: 9.1, a: 8.2, o: 7.5, i: 7.0, n: 6.7, s: 6.3, h: 6.1, r: 6.0,
  d: 4.3, l: 4.0, c: 2.8, u: 2.8, m: 2.4, w: 2.4, f: 2.2, g: 2.0, y: 2.0,
  p: 1.9, b: 1.5, v: 1.0, k: 0.8, j: 0.15, x: 0.15, q: 0.1, z: 0.07,
};

/**
 * THE rarity function. Placeholder: average letter frequency, with long words
 * nudged toward rare. Replace the body with a real word-frequency lookup later;
 * nothing else in the engine needs to change.
 */
export function rarityOf(word: string): Rarity {
  let total = 0;
  for (const ch of word) total += LETTER_FREQ[ch] ?? 0;
  const avg = total / word.length;
  const score = avg - (word.length >= 8 ? 1 : 0);
  if (score >= 5.5) return 'common';
  if (score >= 3.8) return 'uncommon';
  return 'rare';
}
