import {
  BASE_TURN_MS, CARRY_HARD_LETTERS, CARRY_MAX_SHIFT_MS, CARRY_MAX_TURN_MS, CARRY_MS_PER_POINT, LAST_ROUND_TURN_MS, MIN_TURN_MS, PRACTICE_WORDS_PER_STEP,
  TURN_MS_BY_ROUND,
} from './constants';
import type { RoundModifier } from './types';

/**
 * The base turn for a round. The game runs until one sheep is left, so there is no last round: turns follow
 * TURN_MS_BY_ROUND (15, 10, 5 s) and stay at the last value for as long as the game goes on.
 */
export function roundTurnMs(round: number): number {
  return TURN_MS_BY_ROUND[Math.min(TURN_MS_BY_ROUND.length, Math.max(round, 1)) - 1] ?? LAST_ROUND_TURN_MS;
}

/** A practice run's turn: the starting clock, a second less every PRACTICE_WORDS_PER_STEP words you have played, floor 5 s. */
export function practiceTurnMs(clockSeconds: number, wordsPlayed: number): number {
  return Math.max(MIN_TURN_MS, (clockSeconds - Math.floor(wordsPlayed / PRACTICE_WORDS_PER_STEP)) * 1000);
}

/** The base turn (the round's, see roundTurnMs), minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier, baseMs: number = BASE_TURN_MS): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, baseMs - shrink - fastShrink);
}

/** How good a word is for time carry: letters past four, plus two for each hard letter (x, z, q, j). */
export function wordQuality(word: string): number {
  let hard = 0;
  for (const ch of word) if (CARRY_HARD_LETTERS.has(ch)) hard += 1;
  return Math.max(0, word.length - 4) + 2 * hard;
}

/** The time a word moves the next turn by, always positive; the setting says whether it is added or taken away. */
export function wordShiftMs(word: string): number {
  return Math.min(CARRY_MAX_SHIFT_MS, wordQuality(word) * CARRY_MS_PER_POINT);
}

/** A turn's length after the carried shift: more adds, less takes away; never under the floor or over the cap. */
export function carriedTurnMs(baseMs: number, carryMs: number): number {
  return Math.min(CARRY_MAX_TURN_MS, Math.max(MIN_TURN_MS, baseMs + carryMs));
}
