/**
 * Home's panel, in numbers (docs/home-ui/HOME-UI-PLAN.md section 4). home.css draws it from the same formulas; the farm's
 * camera reads `sceneShift` so each tour shot is centred in the part of the screen the panel leaves open.
 */

/** One scale for everything: 1 at 1280 x 720, from 0.8 to 1.5. */
export const homeScale = (w: number, h: number) => Math.min(1.5, Math.max(0.8, Math.min(w / 1280, h / 720)));

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The panel's width at mid-height, its lean each way, and its top and bottom widths, in CSS pixels. */
export function homePanel(w: number, h: number) {
  const u = homeScale(w, h);
  // Under 960 px wide the panel takes at least 46% (home.css), so the menu's labels keep their words.
  const mid = Math.max(clamp(380 * u, 0.36 * w, 560 * u), w <= 960 ? 0.46 * w : 0);
  const ph = h - 36 * u;
  const lean = Math.min(ph * 0.097, 0.08 * w);
  return { u, mid, lean, top: mid + lean, bottom: mid - lean };
}

/**
 * How far to slide the farm's picture to the right so a shot's subject sits in the middle of the uncovered part. The
 * shots were aimed with their subject about 62% across the frame; the uncovered part's middle is (mid + width) / 2.
 */
export function sceneShift(w: number, h: number): number {
  const { mid } = homePanel(w, h);
  return Math.max(0, Math.round((mid + w) / 2 - 0.62 * w));
}
