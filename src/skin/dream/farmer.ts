import type { BufferGeometry } from 'three';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { shade } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import { FARMER_BOXES } from './farmerBoxes';
import type { FarmerBox } from './farmerBoxes';

/**
 * The farmer (docs/dream/01-farmer.md): Brian's reference sheet, one to one. A slim older man with a short grey beard,
 * an off-white nightcap with one thin red band, and a long cream nightshirt with thin blue stripes. The model is the
 * plan's 106 boxes (farmerBoxes.ts) drawn as voxels of one unit, 0.02 m: a box is the cells it covers, and a box
 * thinner than a unit (a stripe, a button, an eye) is paint on the cell under it, so nothing is thinner than a voxel
 * and nothing flickers against the cloth. Every width is an odd number of units: column 0 is his centre line.
 *
 * The frame is the sheet's: x is across him and + is HIS left, y is up from the floor, z is front to back and + is his
 * front. He is built standing; the bed lays him down (`LYING`).
 *
 * This file is pure: the voxels, the joints, the poses and how a pose places each piece. FarmerFigure.tsx draws it.
 */
export const UNIT = 0.02;

/** The pieces that move by themselves. The plan's twelve parts, three of them cut in two at a joint (see `PIECE_OF`). */
export type Piece =
  | 'lap' | 'torso' | 'head' | 'cap' | 'capTail'
  | 'armL' | 'armR' | 'foreL' | 'foreR' | 'handL' | 'handR'
  | 'legL' | 'legR' | 'slipperL' | 'slipperR';
export const PIECES: readonly Piece[] = ['lap', 'torso', 'head', 'cap', 'capTail', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR', 'legL', 'legR', 'slipperL', 'slipperR'];

/** The waist: the nightshirt's skirt ends and its chest begins. He sits up from here. */
const WAIST = 25;
/** The elbow: the upper sleeve ends and the flared lower sleeve begins. */
const ELBOW = 42;
/**
 * Which piece a box's cell belongs to. The plan's `body` is `lap` (the skirt, below the waist) and `torso` (the chest);
 * its `armL` / `armR` are the upper sleeve and `foreL` / `foreR` (below the elbow). The rest keep the plan's names.
 */
function pieceOf(part: FarmerBox[0], y: number): Piece {
  if (part === 'body') return y < WAIST ? 'lap' : 'torso';
  if (part === 'armL') return y < ELBOW ? 'foreL' : 'armL';
  if (part === 'armR') return y < ELBOW ? 'foreR' : 'armR';
  return part;
}

/** Where each piece turns, in units, in the standing frame. */
export const PIVOT: Record<Piece, readonly [number, number, number]> = {
  lap: [0, 0, 0],
  torso: [0, WAIST, -6.5], // the small of his back
  head: [0, 57, 0], // the base of his neck
  cap: [0, 74, 0],
  capTail: [11, 78, -10], // where the tail leaves the cap, on his left toward the back
  armL: [13.5, 53, -0.5], armR: [-13.5, 53, -0.5],
  foreL: [15.5, ELBOW, 0], foreR: [-15.5, ELBOW, 0],
  handL: [15.5, 30.5, 0], handR: [-15.5, 30.5, 0],
  legL: [6.5, 9, -0.5], legR: [-6.5, 9, -0.5],
  slipperL: [6.5, 5, 0], slipperR: [-6.5, 5, 0],
};
/** What each piece is carried by. */
export const PARENT: Record<Piece, Piece | null> = {
  lap: null, torso: 'lap', head: 'torso', cap: 'head', capTail: 'cap',
  armL: 'torso', armR: 'torso', foreL: 'armL', foreR: 'armR', handL: 'foreL', handR: 'foreR',
  legL: 'lap', legR: 'lap', slipperL: 'legL', slipperR: 'legR',
};

// The face's own colours, as the boxes give them: these boxes are drawn by the face's states, not baked into the head.
const EYE = '#3D2818', BROW = '#7A6C5C', MOUTH = '#6A5142';
export type Eyes = 'closed' | 'open' | 'wide';
export type Mouth = 'closed' | 'open';

/** The cells a box covers along x or z (cells are centred on whole units), or the one cell a thin box is painted on. */
function span(a: number, b: number): [number, number] {
  if (b - a < 1 - 1e-6) {
    const m = (a + b) / 2, k = Math.floor(Math.abs(m) - 0.5 + 1e-6);
    return [m < 0 ? -k : k, m < 0 ? -k : k];
  }
  const snap = (v: number) => Math.round(v - 0.5) + 0.5;
  return [Math.round(snap(a) + 0.5), Math.round(snap(b) - 0.5)];
}

type Cells = Map<Piece, Grid>;
let cellCache: Cells | null = null;
/** Every piece's voxels, in the standing frame (cell x covers x - 0.5 to x + 0.5, cell y covers y to y + 1). */
export function farmerCells(): Cells {
  if (cellCache) return cellCache;
  const cells: Cells = new Map(PIECES.map((p) => [p, new Grid(UNIT)]));
  for (const [part, colour, x0, x1, y0, y1, z0, z1] of FARMER_BOXES) {
    if (part === 'head' && (colour === EYE || colour === BROW || colour === MOUTH)) continue;
    const [xa, xb] = span(x0, x1), [za, zb] = span(z0, z1), c = shade(colour);
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      const g = cells.get(pieceOf(part, y))!;
      for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) g.set(x, y, z, c);
    }
  }
  return (cellCache = cells);
}

/** A piece's mesh, about its own pivot, in metres. */
function meshOf(g: Grid, pivot: readonly [number, number, number]): BufferGeometry {
  const geo = buildGeometry(g.map, UNIT);
  // A cell's x and z are its centre, the mesher's are its corner: half a unit back, then about the pivot.
  geo.translate((-0.5 - pivot[0]) * UNIT, -pivot[1] * UNIT, (-0.5 - pivot[2]) * UNIT);
  return geo;
}

/** The face's moving parts. Eyes and mouth are paint a fifth of a unit proud of the face; brows are a unit proud. */
export interface FaceGeo {
  eyes: Record<Eyes, BufferGeometry>;
  mouth: Record<Mouth, BufferGeometry>;
  /** `level` brows, and the grumpy pair whose inner ends sit a unit lower. */
  brows: { level: BufferGeometry; grumpy: BufferGeometry };
}
export interface FarmerGeo { pieces: Record<Piece, BufferGeometry>; face: FaceGeo }

/** The head's front face and the beard's, in units: where the eyes and the mouth are painted. */
const FACE_Z = 8.5, BEARD_Z = 10.5;
/** Paint on a surface: a one-cell slab, squashed to `PAINT` of a unit by the figure, standing on z = `z`. */
export const PAINT = 0.2;
function paint(cells: [number, number][], colour: string, z: number): BufferGeometry {
  const g = new Grid(UNIT), c = shade(colour);
  for (const [x, y] of cells) g.set(x, y, 0, c);
  const geo = buildGeometry(g.map, UNIT, { ao: false });
  const head = PIVOT.head;
  geo.scale(1, 1, PAINT);
  geo.translate((-0.5 - head[0]) * UNIT, -head[1] * UNIT, (z - head[2]) * UNIT);
  return geo;
}
const both = (cells: [number, number][]): [number, number][] => [...cells, ...cells.map(([x, y]) => [-x, y] as [number, number])];

let geoCache: FarmerGeo | null = null;
export function farmerGeometry(): FarmerGeo {
  if (geoCache) return geoCache;
  const cells = farmerCells();
  const pieces = Object.fromEntries(PIECES.map((p) => [p, meshOf(cells.get(p)!, PIVOT[p])])) as Record<Piece, BufferGeometry>;
  const brow = (inner: number) => {
    const g = new Grid(UNIT), c = shade(BROW);
    for (const s of [1, -1]) for (let x = 3; x <= 6; x++) g.set(s * x, x === 3 ? 71 + inner : 71, 9, c);
    return meshOf(g, PIVOT.head);
  };
  const face: FaceGeo = {
    eyes: {
      // Open: 2 x 2, as on the sheet. Shut: a line three wide. Wide: 2 x 3.
      open: paint(both([[4, 68], [5, 68], [4, 69], [5, 69]]), EYE, FACE_Z),
      closed: paint(both([[4, 68], [5, 68], [6, 68]]), BROW, FACE_Z),
      wide: paint(both([[4, 68], [5, 68], [4, 69], [5, 69], [4, 70], [5, 70]]), EYE, FACE_Z),
    },
    mouth: {
      closed: paint([[-1, 61], [0, 61], [1, 61]], MOUTH, BEARD_Z),
      open: paint([-1, 0, 1].flatMap((x) => [59, 60, 61].map((y) => [x, y] as [number, number])), MOUTH, BEARD_Z),
    },
    brows: { level: brow(0), grumpy: brow(-1) },
  };
  return (geoCache = { pieces, face });
}

// ---------- poses ----------

/** A joint's turn, in radians, about the piece's own x, y and z (applied z first, then y, then x). */
export type Turn = readonly [number, number, number];
/**
 * A pose, from `stand` (all zero). Angles are radians. Arms: `near` is his right (the side the bed's camera sees),
 * `far` his left; a shoulder's z spreads the arm out from his side, its x swings it forward (-) or back (+).
 */
export interface Pose {
  /** The chest raised about the small of his back: 0 in line with his legs, 1.4 sitting up. */
  torso: number;
  /** In bed: how far he has shuffled up toward the headboard from where he sleeps, in metres (he sits up against the pillow). */
  scoot: number;
  /** In bed: his whole body turned about its long line, onto his far side (+), radians (`bedTurn`). */
  roll: number;
  /** His head: turned toward his right (the bed's camera), chin toward his chest (+) or rolled back (-), tipped to a shoulder. */
  headTurn: number; headPitch: number; headTilt: number;
  /** His head lifted off the line of his back, onto the pillow, in units. */
  headLift: number;
  /** The cap slipped down toward his brows (units), and leaning to one side. */
  capSlip: number; capLean: number;
  /**
   * The cap's tail. Null: it hangs as on the sheet, swung out by `tailSwing`. Else the way it lies, as a direction in
   * the standing frame (the bed turns that into "along the pillow").
   */
  tailTo: readonly [number, number, number] | null;
  tailSwing: number;
  shoulderNear: Turn; elbowNear: Turn; wristNear: Turn;
  shoulderFar: Turn; elbowFar: Turn; wristFar: Turn;
  eyes: Eyes; mouth: Mouth;
  /** The brows moved up (+) or down (-), in units, and whether their inner ends drop (grumpy). */
  brows: number; grumpy: boolean;
  /** His slippers are on his feet (standing) or on the floor by the bed. */
  slippers: boolean;
  /** Breathing: one breath every this many seconds, the chest rising this share, a hitch at the top (a snore). */
  breath: { every: number; rise: number; hitch: number };
}

const NONE: Turn = [0, 0, 0];
const deg = (d: number) => (d * Math.PI) / 180;
const STAND: Pose = {
  torso: 0, scoot: 0, roll: 0, headTurn: 0, headPitch: 0, headTilt: 0, headLift: 0, capSlip: 0, capLean: 0, tailTo: null, tailSwing: 0,
  shoulderNear: NONE, elbowNear: NONE, wristNear: NONE, shoulderFar: NONE, elbowFar: NONE, wristFar: NONE,
  eyes: 'open', mouth: 'closed', brows: 0, grumpy: false, slippers: true, breath: { every: 3.2, rise: 0, hitch: 0 },
};
/**
 * On his back in bed, the base of every lying pose (docs/dream/v3/09, section 2): his head turned 35 degrees toward the
 * room, his chin lifted 10, the back of his head on the middle of the pillow; his neck, collar and both shoulders out of
 * the quilt, whose edge lies at his armpits; the near arm on the quilt, bent: the upper arm along his side, the forearm
 * across his body at 80 degrees to it, the hand resting on his chest.
 */
const HEAD_TURN = 35, CHIN_UP = -10;
const NEAR_ARM: { shoulder: Turn; elbow: Turn; wrist: Turn } = { shoulder: [deg(-36), deg(6), deg(-17)], elbow: [deg(-49), deg(-25), deg(53)], wrist: [deg(84.5), deg(-24.4), deg(76.9)] };
const LIE: Pose = {
  ...STAND,
  torso: deg(6), headTurn: deg(HEAD_TURN), headPitch: deg(CHIN_UP), headLift: 10,
  // The tail lies on the pillow, toward the headboard and away from the camera.
  tailTo: [0.85, 0.45, -0.28],
  shoulderNear: NEAR_ARM.shoulder, elbowNear: NEAR_ARM.elbow, wristNear: NEAR_ARM.wrist,
  eyes: 'closed', slippers: false, breath: { every: 3.2, rise: 0.04, hitch: 0 },
};

export type PoseName = 'stand' | 'bedSleep' | 'bedDeep' | 'bedStir' | 'bedJolt' | 'bedUpright' | 'bedTurn';
/** The poses of docs/dream/data/farmer.poses.json, as numbers for this rig, with docs/dream/v3/09's changes. */
export const POSES: Record<PoseName, Pose> = {
  stand: STAND,
  // Asleep on his back, breathing every 3.2 s.
  bedSleep: LIE,
  // From 30 sheep on and the "drifted off" results: mouth open, head rolled back 8 degrees more, the cap slipped 3
  // units over his brows, the near arm hanging off the side of the bed 70 degrees down, a snore's hitch every 4 s.
  bedDeep: {
    ...LIE, headPitch: deg(CHIN_UP - 8), headLift: 12, capSlip: 3, mouth: 'open',
    shoulderNear: [0, 0, deg(-86)], elbowNear: [deg(70), 0, 0], wristNear: [0, deg(-20), 0],
    breath: { every: 4, rise: 0.05, hitch: 0.2 },
  },
  // The fence is close: brows down a unit, the head 10 degrees further round, the near hand gripping the quilt, quick breaths.
  bedStir: {
    ...LIE, headTurn: deg(HEAD_TURN + 10), brows: -1,
    wristNear: [NEAR_ARM.wrist[0], NEAR_ARM.wrist[1], NEAR_ARM.wrist[2] + deg(10)],
    breath: { every: 1.6, rise: 0.04, hitch: 0 },
  },
  // A bump: up 25 degrees off the pillow, eyes wide, brows up 2, mouth open, the cap's tail swung up 40 degrees.
  bedJolt: {
    ...LIE, torso: deg(25), headPitch: deg(4), headLift: 0, headTurn: deg(HEAD_TURN - 12), tailTo: null, tailSwing: deg(40),
    shoulderNear: [deg(-22), 0, deg(-14)], elbowNear: [deg(-30), 0, 0], wristNear: NONE,
    shoulderFar: [deg(-22), 0, deg(14)], elbowFar: [deg(-30), 0, 0],
    eyes: 'wide', mouth: 'open', brows: 2, breath: { every: 3.2, rise: 0, hitch: 0 },
  },
  // The "woke up" results: sitting up straight, a hand flat on the quilt each side, eyes open, grumpy brows, the cap
  // leaning 12 degrees. Neither arm ever crosses his face or his beard.
  bedUpright: {
    ...STAND, torso: deg(80), scoot: 0.52, headTurn: deg(24), headPitch: deg(6), capLean: deg(12), tailSwing: deg(6),
    shoulderNear: [deg(8), 0, deg(-10)], elbowNear: [deg(-48), 0, 0], wristNear: [deg(-30), 0, 0],
    shoulderFar: [deg(8), 0, deg(10)], elbowFar: [deg(-48), 0, 0], wristFar: [deg(-30), 0, 0],
    eyes: 'open', grumpy: true, slippers: false, breath: { every: 3.6, rise: 0.02, hitch: 0 },
  },
  // Gate 3 (docs/dream/v3/07, section 3.3): the top of his turn, rolled 40 degrees onto his far side about his long
  // line, the near arm slid down to his side (the quilt rides over it as he turns: bedroom.ts `quiltCells`), eyes
  // shut. `turnPose` takes him there and back.
  bedTurn: { ...LIE, roll: deg(40), shoulderNear: [deg(-4), 0, deg(-2)], elbowNear: [deg(2), 0, 0], wristNear: NONE },
};
/** How long he takes to reach a pose and to leave it again, in ms (the plan's blend times; 400 where it names none). */
export const BLEND_MS: Record<PoseName, { in: number; out: number }> = {
  stand: { in: 0, out: 0 }, bedSleep: { in: 400, out: 400 }, bedDeep: { in: 900, out: 600 },
  bedStir: { in: 250, out: 400 }, bedJolt: { in: 120, out: 500 }, bedUpright: { in: 700, out: 400 }, bedTurn: { in: 450, out: 450 },
};
/** The turn at gate 3 takes this long, there and back (docs/dream/v3/09, section 2). */
export const TURN_MS = 900;
/**
 * The turn at gate 3, `ms` into it: from `from` (his pose as it starts) over to `bedTurn` and back, eased so it leaves
 * and lands at rest. His mouth, cap and head's tilt stay his own (deep asleep, his mouth stays open). Outside 0 to
 * `TURN_MS` it is `from`.
 */
export function turnPose(ms: number, from: Pose = POSES.bedSleep): Pose {
  if (!(ms > 0 && ms < TURN_MS)) return from;
  const to: Pose = { ...POSES.bedTurn, mouth: from.mouth, capSlip: from.capSlip, headPitch: from.headPitch, headLift: from.headLift, breath: from.breath };
  return blendPose(from, to, 0.5 - 0.5 * Math.cos((ms / TURN_MS) * Math.PI * 2));
}
/** A bump holds the jolt this long before the waking goes on. */
export const JOLT_HOLD_MS = 300;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: Turn, b: Turn, t: number): Turn => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
/** Part-way from one pose to another. What cannot be part-way (eyes, mouth, the tail's lie) changes at the half. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const late = t >= 0.5 ? b : a;
  return {
    torso: mix(a.torso, b.torso, t), scoot: mix(a.scoot, b.scoot, t), roll: mix(a.roll, b.roll, t), headTurn: mix(a.headTurn, b.headTurn, t), headPitch: mix(a.headPitch, b.headPitch, t),
    headTilt: mix(a.headTilt, b.headTilt, t), headLift: mix(a.headLift, b.headLift, t),
    capSlip: mix(a.capSlip, b.capSlip, t), capLean: mix(a.capLean, b.capLean, t),
    tailTo: a.tailTo && b.tailTo ? [mix(a.tailTo[0], b.tailTo[0], t), mix(a.tailTo[1], b.tailTo[1], t), mix(a.tailTo[2], b.tailTo[2], t)] : late.tailTo,
    tailSwing: mix(a.tailSwing, b.tailSwing, t),
    shoulderNear: mix3(a.shoulderNear, b.shoulderNear, t), elbowNear: mix3(a.elbowNear, b.elbowNear, t), wristNear: mix3(a.wristNear, b.wristNear, t),
    shoulderFar: mix3(a.shoulderFar, b.shoulderFar, t), elbowFar: mix3(a.elbowFar, b.elbowFar, t), wristFar: mix3(a.wristFar, b.wristFar, t),
    eyes: late.eyes, mouth: late.mouth, brows: mix(a.brows, b.brows, t), grumpy: late.grumpy, slippers: late.slippers,
    breath: { every: mix(a.breath.every, b.breath.every, t), rise: mix(a.breath.rise, b.breath.rise, t), hitch: mix(a.breath.hitch, b.breath.hitch, t) },
  };
}

/**
 * How far into a breath he is, 0 (out) to 1 (in), `t` seconds on. With a hitch, he holds the top of the breath for
 * that long and lets it go quicker: a snore.
 */
export function breathAt(t: number, b: Pose['breath']): number {
  if (b.rise === 0 || b.every <= 0) return 0;
  const u = ((t % b.every) + b.every) % b.every;
  if (b.hitch <= 0) return 0.5 - 0.5 * Math.cos((u / b.every) * Math.PI * 2);
  const up = (b.every - b.hitch) * 0.58, down = b.every - b.hitch - up;
  if (u < up) return 0.5 - 0.5 * Math.cos((u / up) * Math.PI);
  if (u < up + b.hitch) return 1;
  return 0.5 + 0.5 * Math.cos(((u - up - b.hitch) / down) * Math.PI);
}

/** A piece's place under the piece that carries it: where its pivot sits (metres) and how it is turned. */
export interface Placed { position: Vector3; quaternion: Quaternion; scale: Vector3 }
const euler = new Euler(), DOWN = new Vector3(0, -1, 0);
const turned = (t: Turn) => new Quaternion().setFromEuler(euler.set(t[0], t[1], t[2], 'XYZ'));
const restAt = (p: Piece): Vector3 => {
  const a = PIVOT[p], parent = PARENT[p], b = parent ? PIVOT[parent] : ([0, 0, 0] as const);
  return new Vector3((a[0] - b[0]) * UNIT, (a[1] - b[1]) * UNIT, (a[2] - b[2]) * UNIT);
};
/**
 * Where a pose puts every piece, each under its parent. `breath` is 0 to 1 (see `breathAt`): the chest deepens by the
 * pose's rise and the head, with its beard, rides half a unit up on it.
 */
export function placePose(pose: Pose, breath = 0): Record<Piece, Placed> {
  const one = () => new Vector3(1, 1, 1);
  const at = (p: Piece, q = new Quaternion(), scale = one()): Placed => ({ position: restAt(p), quaternion: q, scale });
  const lapQ = turned([0, pose.roll, 0]), torsoQ = turned([pose.torso, 0, 0]);
  // His head: turned about his neck, then nodded and tipped.
  const headQ = turned([pose.headPitch, -pose.headTurn, pose.headTilt]);
  const capQ = turned([0, 0, pose.capLean]);
  let tailQ: Quaternion;
  if (pose.tailTo) {
    // The tail lies along a direction given in the standing frame: undo what carries it (the bed does not turn it).
    const carried = lapQ.clone().multiply(torsoQ).multiply(headQ).multiply(capQ).invert();
    tailQ = new Quaternion().setFromUnitVectors(DOWN, new Vector3(...pose.tailTo).normalize().applyQuaternion(carried));
  } else tailQ = turned([0, 0, pose.tailSwing]);
  const mirror = (t: Turn): Turn => [t[0], -t[1], -t[2]];
  const placed: Record<Piece, Placed> = {
    lap: at('lap', lapQ),
    torso: at('torso', torsoQ, new Vector3(1, 1, 1 + pose.breath.rise * breath)),
    head: at('head', headQ), cap: at('cap', capQ), capTail: at('capTail', tailQ),
    // The pose names the near (his right) arm's turns as they are; the far arm's are the same pose mirrored.
    armR: at('armR', turned(pose.shoulderNear)), foreR: at('foreR', turned(pose.elbowNear)), handR: at('handR', turned(pose.wristNear)),
    armL: at('armL', turned(mirror(pose.shoulderFar))), foreL: at('foreL', turned(mirror(pose.elbowFar))), handL: at('handL', turned(mirror(pose.wristFar))),
    legL: at('legL'), legR: at('legR'), slipperL: at('slipperL'), slipperR: at('slipperR'),
  };
  // Rolled about his middle, his far side would go down into the mattress: he rises by half of that (the mattress
  // gives the rest) as the far edge of his back takes his weight.
  const r = Math.abs(pose.roll);
  placed.lap.position.z += 0.5 * (10.5 * Math.sin(r) + 6.5 * (Math.cos(r) - 1)) * UNIT;
  placed.head.position.z += (pose.headLift + 0.5 * breath * (pose.breath.rise > 0 ? 1 : 0)) * UNIT;
  placed.cap.position.y -= pose.capSlip * UNIT;
  // A slipped cap also comes forward a little, over his brows.
  placed.cap.position.z += pose.capSlip * 0.34 * UNIT;
  return placed;
}

/** Every piece's place in the figure's own frame (metres), for tests and for anything that must know where a hand is. */
export function worldOf(pose: Pose, breath = 0): Record<Piece, Matrix4> {
  const placed = placePose(pose, breath), out = {} as Record<Piece, Matrix4>;
  const solve = (p: Piece): Matrix4 => {
    if (out[p]) return out[p];
    const local = new Matrix4().compose(placed[p].position, placed[p].quaternion, placed[p].scale), parent = PARENT[p];
    return (out[p] = parent ? solve(parent).clone().multiply(local) : local);
  };
  for (const p of PIECES) solve(p);
  return out;
}

// ---------- in bed ----------

/** Where he lies: the base of his neck this far down the bed from the headboard, and this far toward the room's side (his head on the middle of the pillow). */
export const IN_BED = { neckX: 0.72, z: 0.1 } as const;
/**
 * Lying on his back with his head at the headboard: the standing frame's up runs toward the headboard (-x in the
 * room), his front faces the ceiling, and so his right side faces the room, where the bed's camera is. Returns the
 * figure's place in the room for a mattress top at `top`.
 */
export function lyingAt(top: number): { position: [number, number, number]; quaternion: Quaternion } {
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0)));
  return { position: [IN_BED.neckX + PIVOT.head[1] * UNIT, top + 6.5 * UNIT, IN_BED.z], quaternion: q };
}
