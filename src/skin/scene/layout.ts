/**
 * World layout for the winter barn, in metres. +y is up. The fixed camera stands outside the cut-away front of the
 * barn at (0, 5.0, -10.2) and looks toward +z, so "you" sit at the far side of the heap, framed by the open back doors,
 * and the yard, hills and mountains lie beyond those doors (+z). The plan's v2 reference page is not in the repository,
 * so these positions are this file's own; every builder reads them from here.
 */
/** Plan V3.2 Part 2 and 7: a fixed camera high and far enough to hold the whole ring, the beam and both lanterns. */
export const CAMERA = {
  desktop: { fov: 32, position: [0, 6.2, -11.8] as const, target: [0, 0.9, 0.6] as const },
  phone: { fov: 46, position: [0, 6.8, -12.6] as const, target: [0, 0.9, 0.6] as const },
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
  /** Two lanterns hang from the cross beam, wide apart so both sit in the table shot. */
  lanterns: [[-4.3, 4.0, 1.0], [4.3, 4.0, 1.0]] as const,
  /** Height of the z = 1 cross beam the letter board, the icicle and the lanterns hang from. */
  beamY: 4.4,
};

/** The wool pile sits on its platform in the middle of the ring, on the camera axis. */
export const HEAP = [0, 0, 0.6] as const;

/** Seated sheep are drawn 1.3×: the nearest spans about a fifth of the frame, the far one an eighth. */
export const SHEEP_SCALE = 1.3;
export const SEAT_RING = { cx: 0, cz: 0.6, rx: 4.0, rz: 4.0 };

/**
 * Seat angles measured from the camera axis: 0 is toward the camera, 180 is the far side. "You" sit at 180, in
 * front of the open doors; the bots spread down both sides in seating order, never within 25 degrees of the camera
 * axis on the near side, so no sheep is ever cropped (plan V3.2 Part 2). Six bots use the plan's exact angles.
 */
export function seatAngles(n: number): number[] {
  const k = n - 1;
  if (k === 6) return [180, 120, 80, 40, -40, -80, -120];
  const m = Math.ceil(k / 2);
  const step = 140 / Math.max(1, m);
  const left = Array.from({ length: m }, (_, j) => 180 - (j + 1) * step);
  const right = Array.from({ length: k - m }, (_, j) => -(180 - (m - j) * step));
  return [180, ...left, ...right];
}

/** Seat index 0 is "you"; the rest follow the direction of play around the ring. Every sheep faces the pile. */
export function seatPosition(index: number, n: number): { x: number; z: number; yaw: number } {
  const a = (seatAngles(n)[index] * Math.PI) / 180;
  const x = SEAT_RING.cx + Math.sin(a) * SEAT_RING.rx;
  const z = SEAT_RING.cz - Math.cos(a) * SEAT_RING.rz;
  const yaw = Math.atan2(SEAT_RING.cx - x, SEAT_RING.cz - z); // the model's front is +z
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

/**
 * The speaker camera (plan V3.3 Part 4): for a speaker at ring angle θ the camera stands on a circle around the pile
 * at θ + 180° − 35°, so the sheep is seen three-quarter front with the pile beside it, and looks at a point 35% of
 * the way from the speaker's head toward the top of the pile. The plan's 7.6 m radius would put the camera outside
 * the barn walls (12 m wide), so the circle is 5.4 m; the height and the 35% are the plan's; the aim is lifted 0.3 m so the
 * letter board stays in frame when the camera is pulled in. A tall phone screen is narrow, so phones stand a little
 * further back with a wider lens and aim halfway to the pile.
 */
export const SPEAKER_CAMERA = { radius: 5.4, phoneRadius: 5.8, height: 3.0, fov: 25, phoneFov: 50, offsetDeg: -35, toward: 0.2, phoneToward: 0.3, headY: 0.95, pileTopY: 0.6, step: 0.35, lift: 0.25 };

export interface Shot { position: [number, number, number]; target: [number, number, number]; fov: number }

/** The wide shot of the whole ring (between turns, and for the wolf's run). */
export function homeShot(phone: boolean): Shot {
  const home = phone ? CAMERA.phone : CAMERA.desktop;
  return { position: [...home.position], target: [...home.target], fov: home.fov };
}

/** The close shot for the sheep at seat `index` of `n`: every sheep on its turn, you included, gets the zoom. */
export function speakerShot(index: number, n: number, phone: boolean): Shot {
  const c = SPEAKER_CAMERA;
  const p = seatPosition(index, n);
  const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  // The speaker stands `step` m toward the pile on its turn.
  const k = phone ? c.phoneToward : c.toward;
  const hx = p.x + (dx / len) * c.step, hz = p.z + (dz / len) * c.step, hy = c.headY * SHEEP_SCALE;
  const phi = ((seatAngles(n)[index] + 180 + c.offsetDeg) * Math.PI) / 180;
  // Keep 1.5 m clear of the side and back walls (and their posts and lanterns): pull in along the same bearing.
  const sx = Math.abs(Math.sin(phi)), back = -Math.cos(phi);
  const r = Math.min(phone ? c.phoneRadius : c.radius, (BARN.maxX - 1.5) / Math.max(sx, 1e-3), back > 0 ? (BARN.maxZ - 1.5 - SEAT_RING.cz) / back : Infinity);
  return {
    position: [SEAT_RING.cx + Math.sin(phi) * r, c.height, SEAT_RING.cz - Math.cos(phi) * r],
    target: [hx + (HEAP[0] - hx) * k, hy + (c.pileTopY - hy) * k + c.lift, hz + (HEAP[2] - hz) * k],
    fov: phone ? c.phoneFov : c.fov,
  };
}
