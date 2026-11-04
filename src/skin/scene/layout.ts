/**
 * World layout for the winter barn, in metres. +y is up. The fixed camera stands outside the cut-away front of the
 * barn at (0, 5.0, -10.2) and looks toward +z, so "you" sit at the far side of the heap, framed by the open back doors,
 * and the yard, hills and mountains lie beyond those doors (+z). The plan's v2 reference page is not in the repository,
 * so these positions are this file's own; every builder reads them from here.
 */
export const CAMERA = {
  desktop: { fov: 44, position: [0, 5.0, -11.7] as const, target: [0, 0.9, 2.0] as const },
  phone: { fov: 58, position: [0, 5.6, -12.7] as const, target: [0, 1.0, 2.0] as const },
};

export const BARN = {
  /** Inside floor area. The front (z = minZ) has no wall: it is the cut-away the camera looks through. */
  minX: -6, maxX: 6, minZ: -4, maxZ: 7,
  wallHeight: 4.2,
  ridgeHeight: 6.4,
  /** Back doors, open, centred on x = 0 in the back wall (z = maxZ). */
  backDoor: { minX: -1.8, maxX: 1.8, height: 3.4 },
  /** The wolf's side door in the left wall (x = minX), covered by a torn tarp. */
  sideDoor: { z: 2.4, width: 1.4, height: 2.4 },
  /** Two lanterns hang from the cross beam at this height. */
  lanterns: [[-2.6, 3.3, 2.0], [2.6, 3.3, 2.0]] as const,
  /** Height of the cross beam the icicles and the round sign hang from. */
  beamY: 3.9,
};

/** The wool heap sits in the middle of the trampled ring. */
export const HEAP = [0, 0, 2.0] as const;

/** Seated sheep are drawn 1.6× so they read at the fixed camera's distance; the ring is sized for that. */
export const SHEEP_SCALE = 1.6;
export const SEAT_RING = { cx: 0, cz: 2.0, rx: 3.6, rz: 2.9 };

/** Seats on an ellipse around the heap; seat index 0 is "you" at the far side (toward the back doors). */
export function seatPosition(index: number, n: number): { x: number; z: number; yaw: number } {
  const a = Math.PI / 2 + (index * 2 * Math.PI) / n; // index 0 at +z (far side), then counterclockwise seen from above
  const x = SEAT_RING.cx + Math.cos(a) * SEAT_RING.rx * -1;
  const z = SEAT_RING.cz + Math.sin(a) * SEAT_RING.rz;
  // Face the heap: the sheep model's front is +z.
  const yaw = Math.atan2(SEAT_RING.cx - x, SEAT_RING.cz - z);
  return { x, z, yaw };
}

/** The yard and the far layers, all beyond the back wall. */
export const YARD = {
  /** Snow ground covers this rectangle; the barn floor sits on top of it. */
  minX: -40, maxX: 40, minZ: -14, maxZ: 46,
  path: { fromZ: 7, toZ: 34, halfWidth: 1.2 },
  fence: { z: 15, minX: -16, maxX: 16, gateHalfWidth: 1.6 },
  farmhouse: { x: -9, z: 30 },
  pond: { x: 10, z: 24, rx: 4.5, rz: 3 },
  snowman: { x: 4.5, z: 11 },
  pines: [[-14, 20], [-17, 26], [13, 33], [17, 19], [-6, 40], [7, 42], [-22, 34], [22, 30], [-9.8, 12.7], [-10.9, 16.8]] as const,
};

export const DISTANCE = {
  hills: { fromZ: 50, toZ: 140 },
  village: { x: -25, z: 95 },
  windmill: { x: 30, z: 85 },
  mountains: { fromZ: 160, toZ: 260 },
  skyRadius: 420,
};
