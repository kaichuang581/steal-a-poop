/**
 * The orange slider (requested by Brian, 2026-11-21: "a slider to make his face more progressively orange", of the second
 * admin avatar, Juan). Pure pixel maths, so the picture can be warmed on a canvas and the tests can check it.
 *
 * Only warm, mid-light pixels are touched: skin, and fair hair with it. The blue backdrop (blue above red), the dark suit
 * and hair, and the white shirt stay as they are. `amount` runs from 0 (the photo) to 1 (as orange as it goes).
 */
export const ORANGE = { min: 0, max: 1, step: 0.05, def: 0 } as const;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** How much of a pixel counts as skin, 0 to 1: warm (red over blue), and neither dark nor white. */
export function skinWeight(r: number, g: number, b: number): number {
  const warm = Math.min(1, Math.max(0, (r - b - 14) / 40));
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const light = Math.min(1, Math.max(0, (lum - 60) / 40)) * Math.min(1, Math.max(0, (250 - lum) / 25));
  const redOverGreen = r >= g - 4 ? 1 : 0;
  return warm * light * redOverGreen;
}

/** One pixel, warmed toward orange by `amount`. */
export function warmUp(r: number, g: number, b: number, amount: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, amount)) * skinWeight(r, g, b);
  if (t <= 0) return [r, g, b];
  // The target: more red, a good deal less green, nearly no blue.
  const tr = clamp255(r * 1.08 + 42), tg = clamp255(g * 0.6 + 6), tb = clamp255(b * 0.18);
  return [r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t];
}

/** Warms the colour pixels of RGBA data in place (alpha is left alone). */
export function warmData(data: Uint8ClampedArray, amount: number): void {
  if (amount <= 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = warmUp(data[i], data[i + 1], data[i + 2], amount);
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}
