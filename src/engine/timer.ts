import { BASE_TURN_MS, FIRST_ROUND_TURN_MS, LAST_ROUND_TURN_MS, MIN_TURN_MS } from './constants';
import type { RoundModifier } from './types';

/**
 * The base turn for a round: 16 s in the first round, sliding evenly to 5 s in the last, to the nearest second
 * (3 rounds: 16, 11, 5 s; 5 rounds: 16, 13, 11, 8, 5 s). A one-round game plays the whole round at 16 s.
 */
export function roundTurnMs(round: number, rounds: number): number {
  if (rounds <= 1) return FIRST_ROUND_TURN_MS;
  const t = (Math.min(Math.max(round, 1), rounds) - 1) / (rounds - 1);
  return Math.round((FIRST_ROUND_TURN_MS - (FIRST_ROUND_TURN_MS - LAST_ROUND_TURN_MS) * t) / 1000) * 1000;
}

/** The base turn (the round's, see roundTurnMs), minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier, baseMs: number = BASE_TURN_MS): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, baseMs - shrink - fastShrink);
}
