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
 * travels. On desktop the menu covers the left of the frame, so each one keeps its subject right of centre. Each lens
 * keeps 1.0 m clear of every voxel in view over its push and drift, and each computer subject sits inside the frame's
 * clear part (plan file 04, section 4.3; scene/__tests__/homePov.test.ts). Exceptions, listed in that test: computer 2
 * (the wendigo's shot, frozen) and 3 (kept by the plan) look past nearer scenery, and no phone subject fits the strip
 * the title and name plate leave free (a question for Brian). Index 2 of either list, the wendigo's shot, never moves.
 */
export const POV_SHOTS: { desktop: PovShot[]; phone: PovShot[] } = {
  desktop: [
    // The diorama: the avatar in the doorway.
    { ...HOME_CAMERA.desktop, push: [1.8, -0.4, -1.4], spill: 0.55 },
    // The whole farmstead from the south, as a diorama: the lane running in past the farmhouse to the court's gate, the
    // hens' run, the barn and its silo, the windbreak and the forest behind; easing down toward it. Aimed to the left
    // of the barn, as each of these is of its subject: the menu has the frame's left half.
    { position: [12, 22, 52], target: [-10, 0.5, 8], fov: 36, push: [-1.2, -0.8, -2.6], spill: 0.4 },
    // Along the paddock fence, the animals with the silo behind them.
    { position: [21.2, 2.3, 6.2], target: [12.5, 0.9, -2.5], fov: 38, push: [-1.8, -0.2, 0.5], spill: 0.4 },
    // Out through the barn at the avatar in its doorway and the yard beyond, from over the pile: far enough back that
    // neither sheep fills the frame (2026-11-19: from 5 m the avatar's back and the doorway sheep's flank were most of it).
    { position: [-0.9, 2.3, -1.2], target: [1.2, 0.9, 8.2], fov: 44, push: [0, 0.05, 0.8], spill: 0.5 },
    // The hens on their straw, over the run's fence from the court.
    { position: [-5, 3.6, 12.2], target: [-14.6, 0.2, 13.6], fov: 34, push: [-0.6, -0.1, 0.1], spill: 0.4 },
    // The farmhouse from the lane: its porch and lit windows, the smoke from its chimney (Brian, 2026-11-19, of the
    // tractor this stop used to show: "seeing a tractor isnt very pretty").
    { position: [0, 2.4, 31], target: [-25, 3.4, 22], fov: 40, push: [0.3, 0.04, 0.5], spill: 0.4 },
    // Down the path to the avatar, from just inside the gate, through a wide lens: the avatar a third of the frame's
    // height with the doors and the yard round it (Brian, 2026-11-19, of the old long lens at 6 m: "why did u zoom so
    // much in on the sheep ... its a little unsettling").
    // 6 cm east of where it stood: unsmoothed (docs/miniature/03, section 4), the gate post's snow cap keeps its corner,
    // which came 0.976 m from the lens.
    { position: [-0.54, 1.9, 14.2], target: [-1.3, 1.1, 8.2], fov: 48, push: [0.2, 0.05, -0.4], spill: 0.45 },
    // Low over the frozen pond from its far bank: the ice in front, the flock by the pasture's trough, the court's
    // fence, the barn and the silo against the mountains; sliding out over the ice.
    { position: [20.5, 1.8, 35.2], target: [2, 2.6, 12], fov: 40, push: [-0.5, 0.1, -1.1], spill: 0.4 },
  ],
  // On a phone the only clear strip is under the title, so these stand back and aim low to land the subject in it.
  phone: [
    { ...HOME_CAMERA.phone, push: [0.8, -0.2, -0.8], spill: 0.55 },
    { position: [-38, 26, 42], target: [-4, -9, 9], fov: 46, push: [3, -0.6, -1], spill: 0.4 },
    { position: [21.2, 3.4, 7.8], target: [15, -3, -1.5], fov: 52, push: [-1, -0.1, 0.3], spill: 0.4 },
    { position: [0.2, 1.6, -2.95], target: [0, -1.1, 8.2], fov: 50, push: [0, 0, 0.6], spill: 0.5, bounce: [0.4, 1.9, 5.8] },
    { position: [-5.2, 4, 11.6], target: [-13.4, -1, 11.8], fov: 50, push: [-0.6, -0.1, 0], spill: 0.4 },
    { position: [0.3, 1.1, 22], target: [0, -1, 8.2], fov: 40, push: [0, 0, -0.8], spill: 0.45 },
  ],
};
