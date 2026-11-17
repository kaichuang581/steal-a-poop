import { FIELD, JUMP_HEIGHT, JUMP_MS, jumpHeight, takeoffDistance } from '../../dream/dream';

/**
 * Counting Sheep's stage, V4.1 (docs/REDESIGN_PLAN_V4_1.md): the dream's logical field (src/dream/dream.ts, in pixels)
 * laid over a cloud raft in metres. +x is screen-right and the sheep runs toward it, staying at x = 0; the world
 * scrolls toward -x. The camera stands at +z and looks toward -z, so every z in the plan is mirrored here: its far
 * layers at z 50 are at z -50 (with the camera on the plan's side +x would be screen-left). The raft's near edge,
 * toward the camera, is at z = +2 and its far edge at z = -3. Everything here is pure, so it can be tested.
 */

/** Metres per logical pixel: the 20 px sheep is 0.72 m long (the real model at scale 1), the fence 0.43 x 0.58 m. */
export const PX = 0.036;
/** The world x of a logical x (a fence's near edge), measured from the sheep's nose at FIELD.sheepX. */
export const worldX = (logicalX: number): number => (logicalX - FIELD.sheepX) * PX;
/** How far the world has scrolled, in metres, after `distPx` logical pixels of running. */
export const scrollOf = (distPx: number): number => distPx * PX;

/** The raft: its snow top, from the near edge (toward the camera) to the far edge, and the flat lane along it. */
export const RAFT = { nearZ: 2.0, farZ: -3.0, laneNear: 1.0, laneFar: -1.0 } as const;

/** The raft's chunk ring: 4 m chunks, six on a 24 m ring from x = -8 to 16. */
export const CHUNK = { size: 4, count: 6, from: -8 } as const;
export interface ChunkPlacement { index: number; x: number; gen: number }
/** Where each chunk is after `scroll` metres: its x, and how many times it has gone round (its variant is its index). */
export function chunkPlacements(scroll: number): ChunkPlacement[] {
  const span = CHUNK.size * CHUNK.count;
  return Array.from({ length: CHUNK.count }, (_, index) => {
    const p = CHUNK.from + index * CHUNK.size - scroll;
    const gen = p < CHUNK.from ? Math.ceil((CHUNK.from - p) / span) : 0;
    return { index, x: p + gen * span, gen };
  });
}

/**
 * The side view (plan file 09, 4.2): one orthographic camera on every device, yaw 0 and pitch 0, looking along -z
 * straight across the lane, "like the dinosaur game". It is fixed by arithmetic from the rules' own constants: SPAN
 * logical px across the frame, the rules' box centre at A of the width, the ground line at GROUND of the height, and
 * sheep, obstacles and signs drawn ART times their rules size about the ground line. Positions, timing and hit boxes
 * stay the rules'.
 */
export const ART = 1.35;
/** The play strip, logical px under and over the ground line. */
export const STRIP = { under: 16, over: 80 } as const;
/** A phone held upright sees 240 logical px (plan file 09, 8.2: Brian's pick between 200, 220 and 240). */
export const PHONE_SPAN = 240;
/**
 * The span on a computer: W / 3.35, at most the rules' 320, and at least 300, which is what a phone on its side
 * (844 x 390) needs to see each fence as early as today's oblique camera showed it (sideOn.test.ts, the floor of 4.1).
 */
export const SPAN = { max: 320, min: 300, pxPer: 3.35 } as const;
/** The rules' box centre, logical: where the drawn sheep stands. */
export const SHEEP_CENTRE = FIELD.sheepX + FIELD.sheepW / 2;
/** Where the rules' box centre sits across the frame, and the ground line down it. */
export const A = { computer: 0.22, phone: 0.2 } as const;
export const GROUND = { computer: 0.68, phone: 0.55 } as const;
/** The camera's distance in front of the lane: today's, so the fog falls on each layer as it did. */
export const CAMERA_Z = 8.8;

/** Logical px across the frame for a stage `width` CSS px wide. */
export function dreamSpan(width: number, phone: boolean): number {
  return phone ? PHONE_SPAN : Math.min(SPAN.max, Math.max(SPAN.min, width / SPAN.pxPer));
}
export interface DreamView {
  w: number; h: number; phone: boolean;
  /** Logical px across, CSS px per logical px, the logical x at the frame's left edge. */
  span: number; s: number; l0: number;
  /** The ground line, CSS px from the top; CSS px per metre (the camera's zoom); the camera's x and y in metres. */
  ground: number; zoom: number; camX: number; camY: number;
}
export function dreamView(w: number, h: number, phone: boolean): DreamView {
  const span = dreamSpan(w, phone), s = w / span, a = phone ? A.phone : A.computer;
  const l0 = SHEEP_CENTRE - a * span, ground = (phone ? GROUND.phone : GROUND.computer) * h, zoom = s / PX;
  return { w, h, phone, span, s, l0, ground, zoom, camX: worldX(l0 + span / 2), camY: (ground - h / 2) / zoom };
}
/** CSS px from the frame's left for a logical x. */
export const screenX = (v: DreamView, logicalX: number): number => (logicalX - v.l0) * v.s;
/** CSS px from the frame's top for a height above the ground line in logical px. */
export const screenY = (v: DreamView, logicalLift: number): number => v.ground - logicalLift * v.s;
/** The world x and y (metres) at a point of the frame given in percent of its width and height. */
export function frameToWorld(v: DreamView, xPct: number, yPct: number): [number, number] {
  return [v.camX + ((xPct / 100 - 0.5) * v.w) / v.zoom, (v.ground - (yPct / 100) * v.h) / v.zoom];
}
/** The frame's size in metres. */
export const frameMetres = (v: DreamView): [number, number] => [v.w / v.zoom, v.h / v.zoom];

/** The sheep model is about 1.3 m long at scale 1; the logical sheep is 20 px = 0.72 m. */
export const SHEEP_SCALE = (FIELD.sheepW * PX) / 1.3;
/**
 * The drawn sheep at art 1, logical px about the rules' box centre: its length, and its height with the hat
 * (measured from the model: it spans 70.0 to 87.2 behind today's box, 78 to 98, so it is drawn centred on it now).
 * Its height without the hat is measured from the model itself (anchorsOf, sideOn.test.ts).
 */
export const SHEEP_ART = { length: 17.2, mid: 78.6 - FIELD.sheepX, hat: 21.3 } as const;
/** The drawn lift: the rules' arc, drawn ART times taller, so the drawn sheep clears the drawn fence. */
export const drawnLift = (ms: number): number => ART * jumpHeight(ms);
/** The leap's pitch, radians nose up, `j` of the way through the jump (0 to 1). */
export const leapPitch = (j: number): number => 0.46 * Math.cos(Math.PI * j);
/** The tallest admin photo that keeps its top in the strip at the jump's apex, metres at art 1. */
export const DISC_MAX_H = Math.floor((((STRIP.over - ART * JUMP_HEIGHT) / ART) * PX) * 10) / 10;

/**
 * Seconds before take-off that a fence is on screen at `speed`: its drawn face (ART times the rules' width, about its
 * centre) crosses the right edge.
 */
export function fenceWarning(v: DreamView, speed: number): number {
  const enters = v.l0 + v.span - FIELD.fenceW / 2 + (ART * FIELD.fenceW) / 2;
  return (enters - (FIELD.sheepX + FIELD.sheepW + takeoffDistance(speed))) / speed;
}

/**
 * The smallest gap, logical px, between the drawn sheep's underside and the drawn fence's top while they overlap
 * sideways, through a jump taken at `speed`. With `pitched` the leap tilts the body (the stretch included); reduced
 * motion holds it level.
 */
export function jumpClearance(speed: number, pitched: boolean): number {
  const fx0 = FIELD.sheepX + FIELD.sheepW + takeoffDistance(speed) + FIELD.fenceW / 2;
  const fhalf = (ART * FIELD.fenceW) / 2, ftop = ART * FIELD.fenceH;
  let gap = Infinity;
  for (let ms = 0; ms <= JUMP_MS; ms += 1) {
    const j = ms / JUMP_MS, c = fx0 - (speed * ms) / 1000;
    const th = pitched ? leapPitch(j) : 0, long = pitched ? 1.03 - 0.05 * Math.abs(2 * j - 1) : 1;
    const half = ((ART * SHEEP_ART.length) / 2) * long;
    for (let u = -half; u <= half; u += 0.1) {
      const x = SHEEP_CENTRE + u * Math.cos(th), y = drawnLift(ms) + u * Math.sin(th);
      if (Math.abs(x - c) < fhalf) gap = Math.min(gap, y - ftop);
    }
  }
  return gap;
}

/**
 * Signs are drawn ART times their size like everything on the lane; a phone held upright sees fewer px per logical px,
 * so there they are drawn 2.0 times, which keeps the letters at today's 25 px (plan file 09, 4.2).
 */
export const signScale = (phone: boolean): number => (phone ? 2 : ART);

/** The bump's recoil: the sheep knocked back this far, metres, over this long (DreamStage). */
export const RECOIL = { m: 0.25, ms: 200 } as const;
/**
 * At a bump: how far the drawn nose is past the drawn fence's face, logical px, `ms` after it (0 once clear). The
 * rules register a bump with the fence at sheepX + sheepW - 3, and the run stands still from then on.
 */
export function bumpOverlap(ms: number): number {
  const face = FIELD.sheepX + FIELD.sheepW - 3 + FIELD.fenceW / 2 - (ART * FIELD.fenceW) / 2;
  const nose = SHEEP_CENTRE + (ART * SHEEP_ART.length) / 2 - (RECOIL.m / PX) * Math.min(1, ms / RECOIL.ms);
  return Math.max(0, nose - face);
}

/** The fog and the sky's horizon (V4.1 Part 4.3). One density everywhere: every device's camera now stands CAMERA_Z in
 *  front of the lane, where the computer's stood. */
export const DREAM_FOG = { color: '#A99BDD', density: 0.012 } as const;
/** The moon's place in the frame. On a phone it drops below the board. */
export const moonFrame = (aspect: number): readonly [number, number] => (aspect < 1 ? [86, 14] : [88, 10]);
/**
 * The sky, by frame height: a share of the way down from the frame's top to the ground line, and its colour. These are
 * where today's elevations landed in the computer's frame (the horizon 34.7% down a frame whose lane was at 68%), so a
 * computer sees the same bands, and a phone, whose ground line is higher, the same bands pressed toward the top.
 */
export const SKY_STOPS: readonly [number, string][] = [[0, '#3F3480'], [0.049, '#3F3480'], [0.134, '#5B4C9F'], [0.293, '#7E6FC4'], [0.51, '#A99BDD'], [0.53, '#B8ADE6'], [1.5, '#B8ADE6']];
/** The far ranges' tones (V4.1 Part 4.2), before the light and the fog. */
export const FAR = { hillSide: '#4A3D85', hillCap: '#9A91CC', mountain: '#5A5090', mountainCap: '#A59DCC' } as const;
/** The raft's tones (V4.1 Parts 4.2 and 5). */
export const RAFT_TONES = {
  snow: '#F3F0FA', lane: '#E7E2F4', pit: '#CFC8EA', lip: '#DCD5F3', ridge: '#FAF8FE', ridgeSide: '#F1EDFB', sea: '#E0D9F5', seaSide: '#C9C0EC',
  grass: '#5E7A5A', flowerA: '#E9B4C8', flowerB: '#FFF1B8', rock: '#B9B0DC', rockSide: '#9C92C8',
} as const;
/** An island's tones (V4.1 Part 4.2). */
export const ISLAND_TONES = { snow: '#F3F0FA', cloud: '#D8D0F2', crease: '#BCB1E6', wisp: '#E6E0F8' } as const;

/**
 * The three islands (V4.1 Part 6), placed by the on-screen boxes the plan gives them. Its metres (3.6 m across at z 11)
 * overflow its own boxes and its limit of 16% of the frame's width, so the boxes win, as they did in v4.
 */
export type IslandKind = 'pine-lantern' | 'windmill' | 'bench';
export type Box = [number, number, number, number];
export interface Island { id: 'A' | 'B' | 'C'; kind: IslandKind; box: Box; phoneBox: Box; z: number; factor: number; bob: number }
export const ISLANDS: readonly Island[] = [
  { id: 'A', kind: 'pine-lantern', box: [12, 26, 17, 28], phoneBox: [6, 38, 13, 21], z: -11, factor: 0.12, bob: 8 },
  { id: 'B', kind: 'windmill', box: [62, 76, 13, 22], phoneBox: [50, 78, 17, 23], z: -14, factor: 0.08, bob: 11 },
  { id: 'C', kind: 'bench', box: [40, 50, 25, 33], phoneBox: [14, 38, 25, 31], z: -12, factor: 0.12, bob: 9.5 },
];
/** The frames the islands' boxes were laid out on, for callers with no stage of their own (src/skin/scene/placed.ts). */
const LAID_OUT = { computer: [1920, 1080], phone: [390, 844] } as const;
const laidOut = (phone: boolean) => { const [w, h] = phone ? LAID_OUT.phone : LAID_OUT.computer; return dreamView(w, h, phone); };
/** Where an island's snow top sits and how big it is, in the side view `view`. */
export function islandPlace(it: Island, phone = false, view: DreamView = laidOut(phone)) {
  const [x0, x1, y0, y1] = phone ? it.phoneBox : it.box;
  const a = frameToWorld(view, x0, y0), b = frameToWorld(view, x1, y1);
  return { x: (a[0] + b[0]) / 2, y: a[1], across: b[0] - a[0], tall: a[1] - b[1] };
}
/** An island leaves past the left of the frame and comes back on the right a frame's width later, at the same height. */
export function islandX(it: Island, scroll: number, x: number, across: number, view: DreamView = laidOut(false)): number {
  const width = frameMetres(view)[0];
  const left = view.camX - width / 2 - across, span = width + across * 2 + width * 0.5;
  return ((((x - scroll * it.factor - left) % span) + span) % span) + left;
}
/** The wisps: thin lobes high in the sky, at a share of the frame. */
export const WISPS = [{ frame: [40, 14] as const, z: -7, factor: 0.06 }, { frame: [84, 21] as const, z: -8, factor: 0.06 }];

/** How fast each layer scrolls against the lane. */
export const LAYER = { hills: 0.02, mountains: 0.01 } as const;
/** The wake-up timeline (V4.1 Part 7.4), in ms from the bump. */
/** The wake-up, in ms from the bump: the farmer stirs, the dream pops and the clouds roll in (WakeClouds, covered
 *  CLOUD_MS.covered later), the dream is hidden once they cover it, the results come up under them, and `reveal` after
 *  that they part. */
export const WAKE = { stir: 350, pop: 600, popMs: 500, dark: 1650, finish: 1700, reveal: 450, reducedFinish: 600, shakeMs: 300, shake: 0.03 } as const;
/**
 * The HTML laid over the side view, CSS px (plan file 09, 4.6): the play strip; the drawn sheep's box; the farmer's
 * bubble, kept clear of the strip (on a phone below it, above the word bar, or in the sky over it when the keyboard
 * leaves no room, and hidden only when neither fits); the thought trail from the bubble to the near ridge under the
 * sheep, clear of the sheep; and the point the dream pops toward, the last puff.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface DreamLayout { stripTop: number; stripBottom: number; sheep: Rect; bubble: Rect & { shown: boolean }; puffs: Rect[]; pop: [number, number] }
/** The phone's word bar and keyboard leave this much under the bubble; the HUD's header takes this much at the top. */
const PHONE_BAR = 150, HEADER = 56, GAP = 8;
export function dreamLayout(v: DreamView): DreamLayout {
  const { w, h, s, ground } = v;
  const stripTop = ground - STRIP.over * s, stripBottom = ground + STRIP.under * s;
  const sw = ART * SHEEP_ART.length * s, sh = ART * SHEEP_ART.hat * s;
  const sheep = { x: screenX(v, SHEEP_CENTRE) - sw / 2, y: ground - sh, w: sw, h: sh };
  let bw: number, bh: number, by: number, below = true;
  if (v.phone) {
    bw = Math.min(0.42 * w, 240);
    bh = Math.min(bw / 1.5, h - PHONE_BAR - stripBottom - GAP);
    by = h - PHONE_BAR - bh;
    if (bh < 60) { below = false; bh = Math.min(bw / 1.5, stripTop - HEADER - GAP); by = HEADER; }
  } else {
    bw = Math.min(0.26 * w, 420);
    bh = Math.min(bw / 1.5, 0.98 * h - stripBottom - GAP);
    by = 0.98 * h - bh;
  }
  bh = Math.max(0, bh);
  const bubble = { x: 0.02 * w, y: by, w: bh * 1.5, h: bh, shown: bh >= 40 };
  // The trail: from the bubble's shoulder to the near ridge under the sheep's tail, its last puff inside the strip's
  // lower band; or, from a bubble in the sky, to just over the strip.
  const sizes = [0.03, 0.045, 0.06].map((k) => Math.min(k * w, ((stripBottom - ground - 4) * 3) / 2));
  const from: [number, number] = below ? [bubble.x + bubble.w * 0.9, bubble.y + bubble.h * 0.12] : [bubble.x + bubble.w * 0.9, bubble.y + bubble.h * 0.85];
  const last = sizes[2];
  const to: [number, number] = below ? [sheep.x + sw * 0.1, ground + 4 + last / 3] : [sheep.x + sw * 0.1, stripTop - last / 3 - 2];
  const puffs = [0.3, 0.62, 1].map((f, i) => {
    const cx = from[0] + (to[0] - from[0]) * f, cy = from[1] + (to[1] - from[1]) * f;
    return { x: cx - sizes[i] / 2, y: cy - sizes[i] / 3, w: sizes[i], h: (sizes[i] * 2) / 3 };
  });
  return { stripTop, stripBottom, sheep, bubble, puffs, pop: to };
}
/** The drift-off (V4 Part 15), in ms from the last fence: when the clouds roll in, and when the results come up under them. */
export const DRIFT = { clouds: 900, finish: 2650, reducedFinish: 600 } as const; // clouds: gentle ones, covered 1,700 ms later
/** Where the first fence waits before the first key, in logical pixels ahead of the sheep's nose. */
export const FIRST_FENCE_AHEAD = 560; // about 5 s before the first jump (Brian: "you get barely any time")
