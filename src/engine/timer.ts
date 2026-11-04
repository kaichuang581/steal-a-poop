import { BASE_TURN_MS, MIN_TURN_MS } from './constants';
import type { RoundModifier } from './types';

/** The base turn (10s unless the settings say otherwise), minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier, baseMs: number = BASE_TURN_MS): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, baseMs - shrink - fastShrink);
}
