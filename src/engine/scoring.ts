import { LETTER_BONUS, VOWELS } from './constants';
import { RARITY_MULTIPLIER, rarityOf } from './rarity';
import type { RoundModifier } from './types';

export function letterBonus(word: string): number {
  let sum = 0;
  for (const ch of word) sum += LETTER_BONUS[ch] ?? 0;
  return sum;
}

/** Length x rarity multiplier (rounded to whole points) + letter bonuses. */
export function basePoints(word: string): number {
  return Math.round(word.length * RARITY_MULTIPLIER[rarityOf(word)]) + letterBonus(word);
}

/** Points for a played word under the current round modifier. */
export function scoreWord(word: string, modifier: RoundModifier): number {
  const base = basePoints(word);
  if (modifier === 'double_points_fast') return base * 2;
  if (modifier === 'vowel_double' && VOWELS.has(word[0])) return base * 2;
  return base;
}
