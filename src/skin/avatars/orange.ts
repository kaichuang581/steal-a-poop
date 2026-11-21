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

/**
 * The age slider (requested by Brian, 2026-11-21, of the fourth admin avatar: "progressively darker and wrinkly, 0-12x"):
 * skin goes darker and browner, and fine dark creases cross it, more of both the higher it goes. Only skin is touched (the
 * same `skinWeight` as the orange), so the backdrop, suit, shirt and dark hair stay. 0 is the photo, 12 the most.
 */
export const AGE = { min: 0, max: 12, step: 0.5, def: 0 } as const;

/** How much of a crease passes through (x, y), 0 to 1: wavering horizontal lines, about a tenth of the rows. */
export function creaseAt(x: number, y: number): number {
  const v = Math.sin(y * 0.55 + 7 * Math.sin(x * 0.045 + y * 0.004) + 3 * Math.sin(x * 0.11));
  return Math.min(1, Math.max(0, (v - 0.8) / 0.2));
}

/** One skin pixel, aged by `amount` (0 to 12) at (x, y). */
export function ageUp(r: number, g: number, b: number, amount: number, x: number, y: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, amount / AGE.max)) * skinWeight(r, g, b);
  if (k <= 0) return [r, g, b];
  const dark = 1 - 0.62 * k - 0.7 * k * creaseAt(x, y); // darker overall, much darker in a crease
  return [r * dark, g * dark * (1 - 0.08 * k), b * dark * (1 - 0.18 * k)];
}

/** Ages the colour pixels of RGBA data (`width` pixels a row) in place. */
export function ageData(data: Uint8ClampedArray, width: number, amount: number): void {
  if (amount <= 0) return;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const [r, g, b] = ageUp(data[i], data[i + 1], data[i + 2], amount, p % width, Math.floor(p / width));
    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}
