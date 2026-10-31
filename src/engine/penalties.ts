/**
 * Failed-steal penalty: positive scores are halved and rounded down (33 -> 16), zero stays zero,
 * and negative scores get worse by half again, rounded down (-22 -> -33, -21 -> -32).
 */
export function halveScore(score: number): number {
  if (score > 0) return Math.floor(score / 2);
  if (score === 0) return 0;
  return score + Math.floor(score / 2);
}
