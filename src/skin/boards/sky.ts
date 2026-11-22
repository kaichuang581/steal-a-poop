import { Color } from 'three';

/**
 * The leaderboards' party sky in numbers (Brian, 2026-11-22; drawn by PartySky.tsx): its bands down the screen, and the
 * haze on the near island. Pure, so the camera's sums (frame.ts) and the tests can read it.
 */
/** The sky's colours down the screen: (fraction from the top, colour). */
export const PARTY_SKY: [number, string][] = [
  [0, '#1E1650'], [0.28, '#43299A'], [0.52, '#9C47B8'], [0.72, '#EE6E9E'], [0.88, '#FFA77C'], [1, '#FFD48C'],
];
/** The sky's colour at a fraction down the screen (linear, as three's colours are). */
export function skyAt(f: number): Color {
  const t = Math.min(1, Math.max(0, f));
  for (let i = 1; i < PARTY_SKY.length; i++) {
    const [b, cb] = PARTY_SKY[i], [a, ca] = PARTY_SKY[i - 1];
    if (t <= b) return new Color(ca).lerp(new Color(cb), (t - a) / (b - a));
  }
  return new Color(PARTY_SKY[PARTY_SKY.length - 1][1]);
}
/** The haze on the near island, the sky's pink at its own height. */
export const PARTY_FOG = '#E7A3C6';

