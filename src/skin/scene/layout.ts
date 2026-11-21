import { PerspectiveCamera, Vector3 } from 'three';
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

/**
 * The game Home shows going on in the barn (table/BarnGame.tsx): each seat's degrees round the pile from the barn's
 * open front (0) to its doors (180), as the table's are, and how far out it is. The place in front of the doors is the
 * player's own and stands empty: their animal is in the doorway. None sits within 50 degrees of the open front, where
 * the shot from inside the barn has its camera (scene/homePov.ts, shot 3), and the two by the doors sit a little
 * further out, so that shot holds them whole.
 */
export const HOME_GAME = { angles: [150, 100, 50, -50, -100, -150], ring: [3.3, 2.9, 2.9, 2.9, 2.9, 3.3] } as const;
export function homeGameSeat(seat: number): { x: number; z: number; yaw: number } {
  const a = (HOME_GAME.angles[seat] * Math.PI) / 180, x = HEAP[0] + Math.sin(a) * HOME_GAME.ring[seat], z = HEAP[2] - Math.cos(a) * HOME_GAME.ring[seat];
  return { x, z, yaw: Math.atan2(HEAP[0] - x, HEAP[2] - z) };
}

/**
 * The yard and the far layers, all beyond the back wall. The farm is laid out as a farmstead is (Brian, 2026-11-19:
 * "naturalize the layout of the farm ... a lot of stuff feels out of place"; the rules are in CLAUDE.md, the diorama
 * scenery): one cluster round one court, which the barn's doors, the hens' gate and the farmhouse's porch all face; the
 * lane runs in from the road past the house and ends in the court; every fence starts and ends at a building's corner or
 * a gatepost and encloses a named thing; the pond lies out in the pasture; the pines stand as a windbreak on the west,
 * the side the winter wind comes from (-x), and in loose groups, never dotted about.
 */
export const YARD = {
  /** Snow ground covers this rectangle; the barn floor sits on top of it. */
  minX: -40, maxX: 40, minZ: -14, maxZ: 46,
  /** The lane: straight out from the barn's doors, through the court's gate and on south to the road. */
  path: { fromZ: 7, toZ: 46, halfWidth: 1.5 },
  /**
   * The court's fence: from the hens' run (FARM.run in scene/farmstead.ts) across the lane, with the gate in it, to
   * `maxX`, and back from there to the paddock's corner (`sideTo`). The lane's own fence runs south from the gate along
   * the pasture's side, as far as `laneTo`.
   */
  fence: { z: 15, minX: -9.8, maxX: 12, gateHalfWidth: 1.6, sideTo: 7.2, laneTo: 37 },
  /** The farmhouse's middle. Its ridge runs along z; the porch is on its east side, toward the lane and the court. */
  farmhouse: { x: -18.2, z: 21.2, halfX: 3.2, halfZ: 4.6, porch: 1.6 },
  /** Out in the pasture, clear of the court's runoff. Its shore is not an ellipse: see `pondD` in scene/yard.ts. */
  pond: { x: 18, z: 29, rx: 6, rz: 4.2 },
  /** `scale` sizes the snowman against the 1.5 m hero (plan file 04, section 4.4): its head tops out at 2.96 m x scale. */
  snowman: { x: 4.5, z: 11, scale: 0.72 },
  /** Pines, each [x, z, height in metres], in loose groups: by the house, at the lane's end, on the pond's far bank. */
  pines: [
    [-19.6, 29.6, 9.2], [-23.4, 27.4, 6.4], // by the farmhouse
    [-4.8, 40.6, 7.8], [-8.2, 43.2, 6], [5.4, 42.4, 8.4], // either side of the lane where it leaves, as the barn's doors frame it
    [25.6, 27.2, 8.4], [28.2, 30.8, 6.6], [24.4, 33.6, 7.2], // the pond's far bank
  ] as const,
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
 * at θ + 180° − 22°, so the sheep is seen nearly face on (the plan's 35° showed too much of its flank) with the pile
 * beside it, and looks at a point a little way from the speaker's head toward the top of the pile, so the speaker
 * holds the middle of the frame. The plan's 7.6 m radius would put the camera outside
 * the barn walls (12 m wide), so the circle is 5.4 m; the height and the 35% are the plan's; the aim is lifted 0.3 m so the
 * letter board stays in frame when the camera is pulled in. A tall phone screen is narrow, so phones stand a little
 * further back with a wider lens and aim halfway to the pile.
 */
/** The speaker camera as it stood before milestone 7 (the framings below start from it). */
export const TODAY_CAMERA = { radius: 5.4, phoneRadius: 5.8, height: 3.0, fov: 27, phoneFov: 50, offsetDeg: -22, toward: 0.3, phoneToward: 0.3, headY: 0.95, pileTopY: 0.6, step: 0.35, lift: 0.25 };
export type SpeakerCamera = typeof TODAY_CAMERA;

/**
 * The table's three framings (plan file 06, 4.2), Brian's to pick from at the milestone 7 stop:
 * - `crop`: today's picture, the top-left part of every shot magnified by `SWOOP_CROP` (see `swoopCrop`);
 * - `composed`: the offset removed, so the shot is drawn as composed (the animals about a quarter smaller);
 * - `resolved`: no offset, and the speaker shot pulled in so the speaker stands about as tall as in today's crop.
 * Each one's speaker camera was solved by search inside the plan's bounds only (the lens within 4 degrees of today's,
 * `lift`, `toward`, `phoneToward` and `phoneRadius`; `resolved` also `radius`, which is what re-solving the shot means),
 * and the letter board's hang is searched per turn (`boardHang`). src/skin/scene/__tests__/tableFrame.test.ts holds the
 * conditions.
 */
export type TableFraming = 'crop' | 'composed' | 'resolved';
export interface Framing { crop: number | null; camera: SpeakerCamera }
export const FRAMINGS: Record<TableFraming, Framing> = {
  // 1.275 is SWOOP_CROP (declared below).
  crop: { crop: 1.275, camera: { ...TODAY_CAMERA, fov: 30.84, lift: 0.25, toward: 0.17, phoneFov: 52.54, phoneToward: 0.75, phoneRadius: 4.87 } },
  composed: { crop: null, camera: { ...TODAY_CAMERA, fov: 27, lift: 0.5, toward: 0.08, phoneFov: 53.69, phoneToward: 0.74, phoneRadius: 5.65 } },
  resolved: { crop: null, camera: { ...TODAY_CAMERA, fov: 23.48, lift: 0.76, toward: 0.21, radius: 5.41, phoneFov: 51.42, phoneToward: 0.76, phoneRadius: 6.19 } },
};
/** `?framing=composed` (or `crop`, `resolved`) shows another framing on one page, for the pairs Brian looks at. */
const askedFraming = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('framing');
/** Brian's pick. The plan's default until he answers: today's crop. */
export const TABLE_FRAMING: TableFraming = askedFraming === 'composed' || askedFraming === 'resolved' || askedFraming === 'crop' ? askedFraming : 'crop';
export const FRAMING: Framing = FRAMINGS[TABLE_FRAMING];
export const SPEAKER_CAMERA = FRAMING.camera;

/** A box on the screen, in pixels from the top-left corner. */
export interface ScreenBox { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: ScreenBox, b: ScreenBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** By how many pixels two boxes overlap (the shallower way), 0 if they do not. */
const overlapBy = (a: ScreenBox, b: ScreenBox) => (overlaps(a, b) ? Math.min(a.x1 - b.x0, b.x1 - a.x0, a.y1 - b.y0, b.y1 - a.y0) : 0);

/** What the board search needs to know of the speaker: its animal's measured box and plate point (model units), its scale at the table, and its height against the sheep's. */
export interface SpeakerBody { min: readonly number[]; max: readonly number[]; plate: readonly number[]; scale: number; ratio: number }
/** The screens the board is solved for (plan file 06, 4.2). */
export const TABLE_SCREENS = { desktop: { W: 1280, H: 800 }, phone: { W: 390, H: 844 } } as const;
/** The name plate with the speech bubble over it, as a box standing on the plate's anchor (plan file 06, 4.2). */
export const PLATE_BUBBLE = { w: 240, h: 120 };
/** Snow allowed for on the board's top (the plan measures the board "with its snow"). */
export const BOARD_SNOW = 0.1;
/** How far the board's hook may slide along the cross beam, and the board drop below today's height. */
export const BOARD_SLIDE = 1.5, BOARD_DROP = 0.45;
/** The letter board's hook (its height and z are today's) and how far below today's height the board hangs. */
export interface BoardHang { at: [number, number, number]; drop: number }
const HOOK: [number, number, number] = [HEAP[0], BARN.beamY - 0.15, 1.0];
/** The board's size, from voxel/table.ts `BOARD` (copied so this file imports no voxels). */
const BOARD_BOX = { width: 0.9, height: 0.6, thick: 0.08, bottom: 2.6 };

export interface TableFrame { board: ScreenBox; speaker: ScreenBox; plate: ScreenBox; feet: { x: number; y: number }; head: { x: number; y: number } }

/** The picture of the turn at seat `index` of `n` for framing `f` on a W x H screen, with the board hung as `hang`. */
export function tableFrame(f: Framing, index: number, n: number, phone: boolean, W: number, H: number, body: SpeakerBody, hang: BoardHang): TableFrame {
  const shot = speakerShot(index, n, phone, f.camera.headY * body.ratio, f.camera);
  const cam = shotCamera(shot, W, H, f.crop);
  const v = new Vector3();
  const box = (pts: (readonly number[])[]): ScreenBox => {
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of pts) {
      v.set(p[0], p[1], p[2]).project(cam);
      const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    }
    return b;
  };
  // The board hangs from its hook and turns to face the camera (`LetterBoard`).
  const [hx, , hz] = hang.at;
  const yaw = Math.atan2(-(shot.position[0] - hx), -(shot.position[2] - hz)), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const bottom = BOARD_BOX.bottom - hang.drop, top = bottom + BOARD_BOX.height + BOARD_SNOW;
  const boardPts: number[][] = [];
  for (const x of [-BOARD_BOX.width / 2, BOARD_BOX.width / 2]) for (const y of [bottom, top]) for (const z of [-0.06, 0.06]) boardPts.push([hx + x * cy + z * sy, y, hz - x * sy + z * cy]);
  // The speaker, stepped in as SeatGroup steps it, turned to the pile, at its scale.
  const p = seatPosition(index, n), dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  const ox = p.x + (dx / len) * f.camera.step, oz = p.z + (dz / len) * f.camera.step, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const world = (q: readonly number[]) => [ox + body.scale * (q[0] * c + q[2] * s), body.scale * q[1], oz + body.scale * (-q[0] * s + q[2] * c)];
  const sp: number[][] = [];
  for (const x of [body.min[0], body.max[0]]) for (const y of [body.min[1], body.max[1]]) for (const z of [body.min[2], body.max[2]]) sp.push(world([x, y, z]));
  // The plate and bubble: centred on the anchor and standing on it, kept inside the sides and 64 px under the top, as
  // `ScreenAnchor ... above` keeps them.
  const anchor = box([world(body.plate)]);
  const half = PLATE_BUBBLE.w / 2 + 4;
  const px = Math.min(Math.max(anchor.x0, half), Math.max(half, W - half)), py = Math.max(PLATE_BUBBLE.h + 64, anchor.y0);
  const feet = box([world([0, 0, 0])]), head = box([world([body.plate[0], body.max[1], body.plate[2]])]);
  return {
    board: box(boardPts), speaker: box(sp),
    plate: { x0: px - PLATE_BUBBLE.w / 2, x1: px + PLATE_BUBBLE.w / 2, y0: py - PLATE_BUBBLE.h, y1: py },
    feet: { x: feet.x0, y: feet.y0 }, head: { x: head.x0, y: head.y0 },
  };
}

/**
 * The plan's conditions on a table shot (file 06, 4.2), each with by how many pixels it is missed: the board's top with
 * its snow at least 8% from the top and its sides inside 2 to 98%; the header band (top 6%) clear of the board and the
 * plate and bubble; the plate and bubble, the board and the speaker apart; the speaker's feet and head in frame.
 * `frame` is the ones that keep the board and the speaker on screen; `apart` the overlaps.
 */
export function frameFaults(fr: TableFrame, W: number, H: number): { name: string; by: number; kind: 'frame' | 'apart' }[] {
  const out: { name: string; by: number; kind: 'frame' | 'apart' }[] = [];
  const miss = (name: string, by: number, kind: 'frame' | 'apart' = 'frame') => { if (by > 0) out.push({ name, by, kind }); };
  miss('board top above 8%', 0.08 * H - fr.board.y0);
  miss('board side outside 2..98%', Math.max(0.02 * W - fr.board.x0, fr.board.x1 - 0.98 * W));
  miss('plate in the header band', 0.06 * H - fr.plate.y0);
  miss('board over the plate and bubble', overlapBy(fr.board, fr.plate), 'apart');
  miss('board over the speaker', overlapBy(fr.board, fr.speaker), 'apart');
  for (const [name, q] of [['feet', fr.feet], ['head', fr.head]] as const) miss(`${name} out of frame`, Math.max(-q.x, q.x - W, -q.y, q.y - H));
  return out;
}

const hangs = new Map<string, BoardHang>();
/**
 * Where the letter board hangs for the turn at seat `index` of `n` (null: between turns, over the pile, as today): the
 * hook slides along the cross beam (at most `BOARD_SLIDE`, away from the speaker where that clears) and the board drops (at most
 * `BOARD_DROP`), the least of both that meets every condition of `frameFaults` on the framing's screen; where none
 * does, the one that keeps the board and the speaker in frame and misses the rest by the fewest pixels.
 */
export function boardHang(index: number | null, n: number, phone: boolean, body: SpeakerBody, f: Framing = FRAMING): BoardHang {
  if (index === null) return { at: [...HOOK], drop: 0 };
  const key = `${index}/${n}/${phone}/${body.scale}/${body.ratio}/${body.max[1]}/${body.plate.join(',')}/${f.crop}/${JSON.stringify(f.camera)}`;
  const hit = hangs.get(key);
  if (hit) return hit;
  const { W, H } = phone ? TABLE_SCREENS.phone : TABLE_SCREENS.desktop;
  // Away from the speaker first; the other way along the beam only where that is the one that clears (on a side seat the
  // beam runs nearly along the camera's line of sight, and the board must come nearer the speaker to leave the bubble).
  const away = -Math.sign(seatPosition(index, n).x) || 1;
  const xs = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5].flatMap((x) => (x ? [x * away, -x * away] : [0]));
  const candidates: BoardHang[] = [];
  for (let k = 0; k <= 9; k++) for (const x of xs) candidates.push({ at: [HOOK[0] + x, HOOK[1], HOOK[2]], drop: (k * BOARD_DROP) / 9 });
  // The least change first, away from the speaker before toward it (the sort is stable).
  candidates.sort((a, b) => Math.abs(a.at[0] - HOOK[0]) + a.drop - (Math.abs(b.at[0] - HOOK[0]) + b.drop));
  let best = candidates[0], score = Infinity;
  for (const c of candidates) {
    const faults = frameFaults(tableFrame(f, index, n, phone, W, H, body, c), W, H);
    const s = faults.reduce((t, q) => t + q.by * (q.kind === 'frame' ? 1000 : 1), 0);
    if (s < score) { best = c; score = s; }
    if (s === 0) break;
  }
  hangs.set(key, best);
  return best;
}

export interface Shot { position: [number, number, number]; target: [number, number, number]; fov: number }

/** The wide shot of the whole ring (between turns, and for the wolf's run). */
export function homeShot(phone: boolean): Shot {
  const home = phone ? CAMERA.phone : CAMERA.desktop;
  return { position: [...home.position], target: [...home.target], fov: home.fov };
}

/**
 * The close shot for the sheep at seat `index` of `n`: every sheep on its turn, you included, gets the zoom. `headY` is
 * the speaker's head height in model units (the sheep's by default; a hen's is lower, a horse's higher).
 */
export function speakerShot(index: number, n: number, phone: boolean, headY = SPEAKER_CAMERA.headY, c: SpeakerCamera = SPEAKER_CAMERA): Shot {
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
    // The aim height is the sheep's, scaled by how tall the speaker's animal is, so a hen fills the frame as a sheep does.
    target: [hx + (HEAP[0] - hx) * k, (hy + (c.pileTopY - hy) * k + c.lift) * (headY / c.headY), hz + (HEAP[2] - hz) * k],
    fov: phone ? c.phoneFov : c.fov,
  };
}

/**
 * How much of the table's picture the frame shows when the game swooped in. The table's canvas used to be measured
 * while the swoop still had it scaled up, 1.21 to 1.35 times its box each way, so the screen showed the top-left part of
 * every shot, magnified. The canvas now fits its box, and this (the middle of that range) keeps the same picture. It is
 * the `crop` framing's; the other two framings draw the whole shot.
 */
export const SWOOP_CROP = 1.275;

/**
 * Makes a camera draw the framing's picture into a canvas of `width` by `height`: for the `crop` framing the top-left
 * corner of a view `SWOOP_CROP` times as big each way. With `ran` false (reduced motion: no swoop, so the canvas was
 * always right), or a framing with no crop, the whole shot is drawn. No camera moves and no lens changes.
 */
export function swoopCrop(camera: { setViewOffset(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number): void; clearViewOffset(): void }, width: number, height: number, ran: boolean, crop: number | null = FRAMING.crop): void {
  if (ran && crop && width > 0 && height > 0) camera.setViewOffset(crop * width, crop * height, 0, 0, width, height);
  else camera.clearViewOffset();
}

/** A camera standing at `shot` for a canvas of `width` by `height`, cropped as the framing crops the table (`crop` null: the whole shot). */
export function shotCamera(shot: Shot, width: number, height: number, crop: number | null = FRAMING.crop): PerspectiveCamera {
  const cam = new PerspectiveCamera(shot.fov, width / height, 0.1, 900);
  cam.position.set(...shot.position);
  cam.lookAt(...shot.target);
  swoopCrop(cam, width, height, true, crop);
  cam.updateMatrixWorld();
  return cam;
}
