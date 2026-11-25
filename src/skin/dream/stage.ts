import { FIELD, JUMP_HEIGHT, JUMP_MS, jumpHeight, takeoffDistance } from '../../dream/dream';

/**
 * Counting Sheep's side view (plan file 09, 4.2; docs/dream/02): the dream's logical field (src/dream/dream.ts, in
 * pixels) laid across the dream window. +x is screen-right and the sheep runs toward it, staying where it is; the world
 * scrolls toward -x. The sheep is a voxel model in metres, seen through an orthographic camera at +z looking toward -z;
 * the world behind it is flat pixel art (scene/). Everything here is pure, so it can be tested.
 */

/** Metres per logical pixel: the 20 px sheep is 0.72 m long (the real model at scale 1), the fence 0.43 x 0.58 m. */
export const PX = 0.036;
/** The world x of a logical x (a fence's near edge), measured from the sheep's nose at FIELD.sheepX. */
export const worldX = (logicalX: number): number => (logicalX - FIELD.sheepX) * PX;
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
/**
 * Where the rules' box centre sits across the frame, and the ground line down it: the lane's top is at 66% of the dream
 * window's height, 70% on a phone (docs/dream/02-layout-and-interface.md, section 3). The whole play strip moved up
 * with it, as one piece, from 68% and 55% of the screen.
 */
export const A = { computer: 0.22, phone: 0.2 } as const;
export const GROUND = { computer: 0.66, phone: 0.7 } as const;
/** The camera's distance in front of the sheep. */
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
/** The sheep model is about 1.3 m long at scale 1; the logical sheep is 20 px = 0.72 m. */
export const SHEEP_SCALE = (FIELD.sheepW * PX) / 1.3;
/**
 * The drawn sheep at art 1, logical px about the rules' box centre: its length, and its height with the hat
 * (measured from the model: Brian's sheet sheep of 2026-11-19, at its normal coat, is 19.0 long, from 8.1 behind its
 * origin to 10.9 ahead of it). It is longer than the sheep the plan measured (17.2), so it is not drawn centred: its
 * nose stays where that sheep's was, `nose` ahead of the box's centre, so a bump still meets the rail and the
 * knock-back still clears it; the extra length is all tail (`tail` behind the centre). `mid` is the model's point
 * that stands on the centre. Its height without the hat is measured from the model itself (anchorsOf,
 * sideOn.test.ts); with the hat it stands 19.5, under the 21.3 the plan's table allows it.
 */
export const SHEEP_ART = { length: 19.0, nose: 8.6, tail: 10.4, mid: 10.86 - 8.6, hat: 21.3 } as const;
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
    const aft = ART * SHEEP_ART.tail * long, fore = ART * SHEEP_ART.nose * long;
    for (let u = -aft; u <= fore; u += 0.1) {
      const x = SHEEP_CENTRE + u * Math.cos(th), y = drawnLift(ms) + u * Math.sin(th);
      if (Math.abs(x - c) < fhalf) gap = Math.min(gap, y - ftop);
    }
  }
  return gap;
}

/** The bump's recoil: the sheep knocked back this far, metres, over this long (DreamStage). */
export const RECOIL = { m: 0.25, ms: 200 } as const;
/**
 * At a bump: how far the drawn nose is past the drawn fence's face, logical px, `ms` after it (0 once clear). The
 * rules register a bump with the fence at sheepX + sheepW - 3, and the run stands still from then on.
 */
export function bumpOverlap(ms: number): number {
  const face = FIELD.sheepX + FIELD.sheepW - 3 + FIELD.fenceW / 2 - (ART * FIELD.fenceW) / 2;
  const nose = SHEEP_CENTRE + ART * SHEEP_ART.nose - (RECOIL.m / PX) * Math.min(1, ms / RECOIL.ms);
  return Math.max(0, nose - face);
}

/**
 * The woken ending (docs/dream/07, section 3.2), ms from the bump: the farmer starts up and the bonk stars come out
 * (`stir`), the dream pops (`pop`, over `popMs`), the bedroom opens to the whole screen and its camera goes to the
 * results view (`room`), and the results board slides in (`board`). Under reduced motion there is no pop: the room
 * and the board come at once.
 */
export const WAKE = { stir: 350, pop: 350, popMs: 380, room: 730, board: 1400, reducedRoom: 300, reducedBoard: 600 } as const;
/**
 * The out-cold ending (07, section 3.1), ms from the bump he sleeps through: the dream sinks into his head (`sink`,
 * over `sinkMs`), then the room and the board.
 */
export const DRIFT = { sink: 900, sinkMs: 500, room: 1400, board: 1600, reducedRoom: 300, reducedBoard: 600 } as const;
/** The opening (07, section 2), ms from the dream coming up: the tail's puffs pop up, the window grows, the ready board. */
export const OPENING = { puffs: 200, puffGap: 80, grow: 440, grown: 860 } as const;
/** Where the first fence waits before the first key, in logical pixels ahead of the sheep's nose. */
export const FIRST_FENCE_AHEAD = 560; // about 5 s before the first jump (Brian: "you get barely any time")
