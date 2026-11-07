type V3 = readonly [number, number, number];

/**
 * One scene of the start screen's tour. `push` is how far the camera travels during its hold. The door lights are set
 * for one view and burn out others, so `spill` scales them (default 1) and `bounce` moves the fill light to the side of
 * the avatar this camera sees.
 */
export interface PovShot { position: V3; target: V3; fov: number; push: V3; spill?: number; bounce?: V3 }

/** Seconds on each angle, and how long the dip to dark takes on either side of a cut. */
export const POV_HOLD = 7;
export const POV_DIP = 0.4;

/** Which angle is showing at `elapsed` seconds, how far through its hold (0..1), and how dark the dip is (0..1). */
export function povAt(elapsed: number, count: number): { index: number; progress: number; veil: number } {
  const local = elapsed % POV_HOLD;
  const into = elapsed < POV_HOLD ? 1 : local / POV_DIP; // nothing to fade up from when the screen first opens
  const left = (POV_HOLD - local) / POV_DIP;
  return {
    index: Math.floor(elapsed / POV_HOLD) % count,
    progress: local / POV_HOLD,
    veil: 1 - Math.min(1, into, left),
  };
}

/** `?pov=2` holds one angle, for screenshots, the way `?hour=` pins the time of day. */
export function pinnedPov(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get('pov');
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < count ? n : null;
}
