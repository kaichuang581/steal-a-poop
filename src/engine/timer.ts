import { BASE_TURN_MS, LAST_ROUND_TURN_MS, MIN_TURN_MS, TURN_MS_BY_ROUND } from './constants';
import type { RoundModifier } from './types';

/**
 * The base turn for a round. The game runs until one sheep is left, so there is no last round: turns follow
 * TURN_MS_BY_ROUND (15, 10, 5 s) and stay at the last value for as long as the game goes on.
 */
export function roundTurnMs(round: number): number {
  return TURN_MS_BY_ROUND[Math.min(TURN_MS_BY_ROUND.length, Math.max(round, 1)) - 1] ?? LAST_ROUND_TURN_MS;
}

/** The base turn (the round's, see roundTurnMs), minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier, baseMs: number = BASE_TURN_MS): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, baseMs - shrink - fastShrink);
}
