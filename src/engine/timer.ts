import { BASE_TURN_MS, MIN_TURN_MS } from './constants';
import type { RoundModifier } from './types';

/** 10s, minus 1s per 10 pile points, minus 2s under double_points_fast, floor 5s. */
export function turnDurationMs(pile: number, modifier: RoundModifier): number {
  const shrink = Math.floor(pile / 10) * 1000;
  const fastShrink = modifier === 'double_points_fast' ? 2000 : 0;
  return Math.max(MIN_TURN_MS, BASE_TURN_MS - shrink - fastShrink);
}
