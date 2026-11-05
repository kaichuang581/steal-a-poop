import { BASE_TURN_MS, FIRST_ROUND_TURN_MS, LAST_ROUND_TURN_MS, MIN_TURN_MS, TURN_MS_STEP } from './constants';
import type { RoundModifier } from './types';

/**
 * The base turn for a round. The game runs until one sheep is left, so there is no last round: turns start at 16 s
 * and lose 2 s each round (16, 14, 12, 10, 8, 6) down to 5 s, and stay there.
 */
export function roundTurnMs(round: number): number {
  return Math.max(LAST_ROUND_TURN_MS, FIRST_ROUND_TURN_MS - (Math.max(round, 1) - 1) * TURN_MS_STEP);
}

/** The base turn (the round's, see roundTurnMs), minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier, baseMs: number = BASE_TURN_MS): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, baseMs - shrink - fastShrink);
}
