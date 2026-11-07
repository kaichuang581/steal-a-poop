type V3 = readonly [number, number, number];

/**
 * One scene of the start screen's tour. `push` is how far the camera travels during its hold. The door lights are set
 * for one view and burn out others, so `spill` scales them (default 1) and `bounce` moves the fill light to the side of
 * the avatar this camera sees.
 */
export interface PovShot { position: V3; target: V3; fov: number; push: V3; spill?: number; bounce?: V3 }

/** Seconds on each angle, and how long the dip to dark takes on either side of a cut. */
export const POV_HOLD = 5;
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

/** The diorama shot (plan V3.1 Part 2.2 and 2.4): a long lens from the yard, the open doorway on the right third. */
export const HOME_CAMERA = {
  desktop: { fov: 26, position: [-12.5, 7.0, 23.0] as const, target: [0.6, 1.6, 4.5] as const },
  // Phones: the hero has to sit between the title and the tickets, so the lens aims lower, at the sheep's feet.
  // A tall viewport makes the horizontal view narrow, so the phone lens is wider and aims below the hero's feet.
  phone: { fov: 46, position: [-6.5, 4.6, 21] as const, target: [0, -0.9, 8.2] as const },
};

/**
 * The start screen's tour of the farm, turn and turn about between the avatar and the rest of the place. Every scene
 * travels. On desktop the menu covers the left of the frame, so each one keeps its subject right of centre.
 */
export const POV_SHOTS: { desktop: PovShot[]; phone: PovShot[] } = {
  desktop: [
    // The diorama: the avatar in the doorway.
    { ...HOME_CAMERA.desktop, push: [1.8, -0.4, -1.4], spill: 0.55 },
    // The whole farm from over the orchard.
    { position: [-40, 21, 40], target: [-8, 1, 1], fov: 38, push: [6, -1, -2], spill: 0.4 },
    // Along the paddock fence, the animals with the silo behind them.
    { position: [21.2, 2.3, 6.2], target: [12.5, 0.9, -2.5], fov: 38, push: [-1.8, -0.2, 0.5], spill: 0.4 },
    // Over the avatar's shoulder from inside the barn, out at the yard.
    { position: [0.2, 1.1, 2.6], target: [1.5, 1.7, 8.2], fov: 44, push: [0, 0.1, 1], spill: 0.5 },
    // The hens' run.
    { position: [-6.2, 2.9, 12.2], target: [-15.4, 0.7, 3.2], fov: 30, push: [-1.6, -0.2, -0.4], spill: 0.4 },
    // The tractor, parked up by the barn.
    { position: [6, 1.2, 14.4], target: [7.4, 1.7, 7.4], fov: 36, push: [1.3, 0.1, -0.3], spill: 0.4 },
    // Down the path to the avatar, a little off its nose.
    { position: [-1.6, 0.95, 15], target: [-1.5, 1.25, 8.2], fov: 26, push: [0.3, 0.05, -1.1], spill: 0.45 },
    // Across the frozen pond, back toward the barn and the silo.
    { position: [14.8, 3.4, 31], target: [3.6, 2.2, 10], fov: 36, push: [-1.8, -0.2, -0.4], spill: 0.4 },
  ],
  // On a phone the only clear strip is under the title, so these stand back and aim low to land the subject in it.
  phone: [
    { ...HOME_CAMERA.phone, push: [0.8, -0.2, -0.8], spill: 0.55 },
    { position: [-38, 26, 42], target: [-4, -9, 9], fov: 46, push: [3, -0.6, -1], spill: 0.4 },
    { position: [21.2, 3.4, 7.8], target: [15, -3, -1.5], fov: 52, push: [-1, -0.1, 0.3], spill: 0.4 },
    { position: [0.2, 1.6, -3.2], target: [0, -1.1, 8.2], fov: 50, push: [0, 0, 0.6], spill: 0.5, bounce: [0.4, 1.9, 5.8] },
    { position: [-6.5, 4.2, 13], target: [-12.2, -2.6, 3.8], fov: 50, push: [-0.8, -0.1, -0.2], spill: 0.4 },
    { position: [0.3, 1.1, 22], target: [0, -1, 8.2], fov: 40, push: [0, 0, -0.8], spill: 0.45 },
  ],
};
