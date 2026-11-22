import { Color } from 'three';

/**
 * The leaderboards' festival night in numbers (Brian, 2026-11-22: "go more for the vibe of like those anime festivals
 * while still being somewhat cohesive"; drawn by FestivalSky.tsx): its bands down the screen, and the haze on the near
 * island. Pure, so the camera's sums (frame.ts) and the tests can read it.
 */
/** The sky's colours down the screen, (fraction from the top, colour): night blue, indigo, plum, and the warm glow of
 * the festival below the island. */
export const PARTY_SKY: [number, string][] = [
  [0, '#0B1235'], [0.24, '#16205A'], [0.45, '#2B2670'], [0.62, '#55307C'], [0.76, '#8E3B78'], [0.88, '#D0636A'], [0.96, '#F29A63'], [1, '#FFBF78'],
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
/** The haze on the near island: the night's plum. */
export const PARTY_FOG = '#4A3478';
/** Where the moon stands, as a fraction of the window (across, down), and how much of its width it spans. */
export const MOON = { fx: 0.795, fy: 0.17, size: 0.085 } as const;

