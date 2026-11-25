/**
 * Counting Sheep's screen (docs/dream/02-layout-and-interface.md, section 3; 01-farmer.md, section 4): the farmer's bed
 * strip along the bottom, the dream window rising from it as one thought bubble, the tray over the strip. Everything
 * here is CSS px from the screen's size, and pure, so it can be tested. The bedroom's own numbers (the bed's ends, the
 * mattress) are written out rather than imported: bedroom.ts builds meshes, and this file must stay light.
 */
export interface Box { x: number; y: number; w: number; h: number }

/** The kit's unit (home.css `--u`): interface sizes are the plan's px times this. A phone's are its own px. */
export const unitOf = (w: number, h: number, phone: boolean): number => (phone ? 1 : Math.min(1.5, Math.max(0.8, Math.min(w / 1280, h / 720))));
/** The plan's computer layout: 900 wide or more and 600 high or more. Anything else is the phone's. */
export const isPhoneLayout = (w: number, h: number): boolean => !(w >= 900 && h >= 600);

const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The dream window's rim of wool, and the shade of wool's lip under it (docs/dream/v3/08, section 2). */
export const RIM = 6;
export const SHADE = 4;
/** Each corner is cut in three steps: 4 px each outside the rim, 2 px inside it (so the rim stays 6 thick round it). */
const CORNER = { steps: 3, out: 4, in: 2 } as const;

/** The tray's parts, in the plan's px (times `u`). */
export const TRAY = {
  computer: { tile: 40, side: 6, gap: 6, sizes: [40, 36, 32, 28], padX: 16, padTop: 14, padBottom: 12, band: 8, jump: 96, jumpGap: 14, meter: 8, meterGap: 8, slots: 7, bottom: 14 },
  phone: { tile: 28, side: 4, gap: 5, sizes: [28, 24, 20], padX: 10, padTop: 9, padBottom: 8, band: 8, jump: 76, jumpGap: 8, meter: 6, meterGap: 6, slots: 0, bottom: 6 },
} as const;

export interface DreamFrame {
  w: number; h: number; phone: boolean; u: number;
  /** The bed strip, and how much of its left is the bed's. */
  strip: Box; bedZone: number;
  /** The bedroom's canvas: the strip, and the wall on up behind the window's cut bottom corners. */
  room: Box;
  /** The dream window: its outer box (the rim's outside; its shade hangs SHADE under it) and the dream's own box inside the rim. */
  bubble: Box; view: Box;
  tray: Box;
  /** Where the tiles go in the tray: how wide, and how many fit at each size. */
  tiles: number;
  /** The hint strip: over the tray on a computer, along the dream's bottom edge on a phone. */
  hint: { x: number; w: number; bottom: number };
}

/** The whole screen, `w` x `h` (on a phone, the part visible above the keyboard). */
export function dreamFrame(w: number, h: number): DreamFrame {
  const phone = isPhoneLayout(w, h), u = unitOf(w, h, phone);
  if (phone) {
    const T = TRAY.phone;
    const tray = { x: 6, y: h - T.bottom - 84, w: w - 12, h: 84 };
    const strip = { x: 0, y: tray.y - 56, w, h: 56 };
    // The window's straight lower edge meets the strip; its shade lies on the strip's wall.
    const bubble = { x: 6, y: 6, w: w - 12, h: Math.max(120, strip.y - 6) };
    const view = { x: bubble.x + RIM, y: bubble.y + RIM, w: bubble.w - 2 * RIM, h: bubble.h - 2 * RIM };
    const room = { x: 0, y: bubble.y + bubble.h - CORNER_H, w, h: tray.y - (bubble.y + bubble.h - CORNER_H) };
    return {
      w, h, phone, u, strip, bedZone: 0.46 * w, room, bubble, view, tray,
      tiles: tray.w - 2 * T.padX - T.jump - T.jumpGap,
      hint: { x: bubble.x + RIM + 6, w: bubble.w - 2 * RIM - 12, bottom: h - (bubble.y + bubble.h - RIM) + 4 },
    };
  }
  const T = TRAY.computer;
  const bed = clamp(160, 0.24 * h, 240), bedZone = clamp(380, 0.36 * w, 590);
  const strip = { x: 0, y: h - bed, w, h: bed };
  const bubble = { x: 10, y: 10, w: w - 20, h: h - bed - 6 - 10 };
  const view = { x: bubble.x + RIM, y: bubble.y + RIM, w: bubble.w - 2 * RIM, h: bubble.h - 2 * RIM };
  const room = { x: 0, y: bubble.y + bubble.h - CORNER_H, w, h: h - (bubble.y + bubble.h - CORNER_H) };
  const tiles = T.slots * (T.tile + T.gap) - T.gap;
  const tw = (2 * T.padX + tiles + T.jumpGap + T.jump) * u;
  const th = (T.band + T.padTop + T.tile + T.side + T.meterGap + T.meter + T.padBottom + T.side) * u;
  const tray = { x: Math.round((bedZone + w) / 2 - tw / 2), y: Math.round(h - T.bottom * u - th), w: Math.round(tw), h: Math.round(th) };
  return { w, h, phone, u, strip, bedZone, room, bubble, view, tray, tiles: tiles * u, hint: { x: tray.x, w: tray.w, bottom: h - tray.y + 8 * u } };
}

/**
 * How big the tray's tiles are for `slots` places in `width` px: the largest of the sizes that fits them all, and, when
 * even the smallest does not, how many of the smallest fit (the typed tiles then slide left under a "more" tile).
 */
export function tileFit(slots: number, width: number, phone: boolean, u = 1): { size: number; fit: number } {
  const T = phone ? TRAY.phone : TRAY.computer;
  for (const size of T.sizes) if (slots * (size + T.gap) * u - T.gap * u <= width + 0.5) return { size, fit: slots };
  const size = T.sizes[T.sizes.length - 1];
  return { size, fit: Math.max(1, Math.floor((width + T.gap * u + 0.5) / ((size + T.gap) * u))) };
}

/** How many of the meter's segments fit under `width` px of tiles: 22 wide and 5 apart (16 and 4 on a phone). */
export const meterSegments = (width: number, phone: boolean, u = 1): number => Math.max(4, Math.floor((width + (phone ? 4 : 5) * u) / ((phone ? 20 : 27) * u)));

// ---------- the bubble ----------

/** How far up from its bottom the window's cut corners reach: the room's canvas starts that far up behind the rim. */
const CORNER_H = CORNER.steps * CORNER.out;

/**
 * The dream window as two polygons in its own box, `w` x `h`: `outer`, the rim's outside, and `inner`, the dream's clip,
 * the rim's width inside it. Every corner is cut in three pixel steps and the lower edge is straight (v3/08, section 2:
 * the old scalloped edge read as lace). The shade is `outer` again, SHADE lower, behind it.
 */
export function bubbleShape(w: number, h: number): { outer: string; inner: string } {
  return { outer: corners(w, h, 0, CORNER.out), inner: corners(w, h, RIM, CORNER.in) };
}
/** A box `inset` in from a w x h box, each corner cut in CORNER.steps stair steps of `step` px, as a clip polygon. */
function corners(w: number, h: number, inset: number, step: number): string {
  // The top left corner's stair, clockwise from the left side to the top edge; the other three are it mirrored.
  const stair: [number, number][] = [];
  for (let k = 0; k < CORNER.steps; k++) stair.push([k * step, (CORNER.steps - k) * step], [(k + 1) * step, (CORNER.steps - k) * step]);
  stair.push([CORNER.steps * step, 0]);
  const back = stair.slice().reverse(), a = inset, b = w - inset, c = inset, d = h - inset;
  const pts = [
    ...stair.map(([x, y]) => [a + x, c + y]), ...back.map(([x, y]) => [b - x, c + y]),
    ...stair.map(([x, y]) => [b - x, d - y]), ...back.map(([x, y]) => [a + x, d - y]),
  ];
  return `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(',')})`;
}

// ---------- the bed strip's camera ----------

/** The bed, in the bedroom's frame (bedroom.ts): the outside of its head and foot posts, its near side, the mattress's top. */
export const BED_BOX = { headX: -0.15, footX: 2.15, nearZ: 0.6, top: 0.55, midX: 1.0 } as const;
/** The camera `bedSide`: on the room's open side, this far above the mattress, looking straight at the bed's long side. */
export const BED_SIDE = { lift: 0.35, fov: 20, cut: 0.18 } as const;
/** His face as he lies asleep: the tip of his nose, where his z's leave from and the bubble's tail comes down to. */
export const NOSE = { x: 0.5, y: 1.0, z: 0.34 } as const;

export interface StripCamera {
  /** The camera's place; it looks along -z with no turn. */
  position: [number, number, number];
  /** Px on screen per metre at the bed's near side, and the focal length in px (px per unit of slope). */
  scale: number; focal: number;
  /** Where the camera's own axis meets the screen, CSS px. */
  axis: [number, number];
}

/**
 * The strip's camera for a frame. On a computer the headboard's outside is 24 px from the strip's left and the foot of
 * the bed ends 70 px before the bed zone's right edge; the strip's height is the camera's 20 degrees; its bottom edge
 * cuts the bed just under its side rail, which is what leaves his face room for the bubble's tail above it. A phone
 * moves in to his head and shoulders across the left 46%.
 */
export function stripCamera(f: DreamFrame): StripCamera {
  const k = 2 * Math.tan((BED_SIDE.fov * Math.PI) / 360), camY = BED_BOX.top + BED_SIDE.lift;
  if (f.phone) {
    // His head and shoulders across the bed zone, and never so close that his head is taller than the strip.
    const scale = Math.min(f.bedZone / 1.3, f.strip.h / 0.42), d = f.strip.h / scale / k, camX = 0.5;
    return { position: [camX, camY, BED_BOX.nearZ + d], scale, focal: scale * d, axis: [6 + (camX - BED_BOX.headX) * scale, f.strip.y + f.strip.h - (camY - 0.7) * scale] };
  }
  const scale = (f.bedZone - 24 - 70) / (BED_BOX.footX - BED_BOX.headX), d = f.strip.h / scale / k;
  return {
    position: [BED_BOX.midX, camY, BED_BOX.nearZ + d], scale, focal: scale * d,
    axis: [24 + (BED_BOX.midX - BED_BOX.headX) * scale, f.strip.y + f.strip.h - (camY - BED_SIDE.cut) * scale],
  };
}
/** Where a point of the bedroom lands on screen through the strip's camera, CSS px. */
export function stripPoint(c: StripCamera, x: number, y: number, z: number): [number, number] {
  const k = c.focal / (c.position[2] - z);
  return [c.axis[0] + (x - c.position[0]) * k, c.axis[1] - (y - c.position[1]) * k];
}
/** The bedroom x that lands at screen `px` on the back wall (z = `z`). */
export const stripX = (c: StripCamera, px: number, z: number): number => c.position[0] + ((px - c.axis[0]) * (c.position[2] - z)) / c.focal;

/** The back wall's z, and how far along it the strip's low window is wide (bedroom.ts). */
const BACK_Z = -1.3, WINDOW_W = 0.8;
/**
 * How far along the wall the strip sees, and where its window goes: its right side 44 px in from the screen's right, on
 * screens 1200 wide or more.
 */
export function stripExtent(f: DreamFrame, c: StripCamera = stripCamera(f)): { x1: number; windowX: number | null } {
  const x1 = Math.ceil(stripX(c, f.w, BACK_Z) * 2) / 2 + 0.5;
  const windowX = !f.phone && f.w >= 1200 ? Math.round((stripX(c, f.w - 44, BACK_Z) - WINDOW_W) * 20) / 20 : null;
  return { x1, windowX };
}

/**
 * The tip of his cap as he lies asleep (`bedSleep`), measured from the model (farmer.ts `worldOf`, the cap's top at its
 * front edge): the tail's puffs, his snores and the "?" and "!" are placed from it (v3/08, sections 2 and 7). Always put
 * through `stripPoint`, so it follows the strip's camera wherever that goes.
 */
export const CAP_TIP = { x: 0.19, y: 0.96, z: 0.29 } as const;

/**
 * The bubble's tail (v3/08, section 2): three round wool puffs, 40, 26 and 16 px across (a phone's 26, 18 and 12). The
 * smallest's middle is 14 above and 6 right of the tip of his cap, the middle one's 24 above and 14 right of that, the
 * largest's 32 above and 26 right of the middle one's (a phone's steps in proportion). If the largest does not reach the
 * window's shade, all three move up together until it overlaps the shade by 4. Largest first.
 */
export const TAIL = { computer: [40, 26, 16], phone: [26, 18, 12] } as const;
export function tailPuffs(f: DreamFrame, c: StripCamera = stripCamera(f)): Box[] {
  const sizes = f.phone ? TAIL.phone : TAIL.computer, k = sizes[0] / TAIL.computer[0], [cx, cy] = stripPoint(c, CAP_TIP.x, CAP_TIP.y, CAP_TIP.z);
  const small: [number, number] = [cx + 6 * k, cy - 14 * k], mid: [number, number] = [small[0] + 14 * k, small[1] - 24 * k], large: [number, number] = [mid[0] + 26 * k, mid[1] - 32 * k];
  const shade = f.bubble.y + f.bubble.h + SHADE, lift = Math.max(0, large[1] - sizes[0] / 2 - (shade - 4));
  return [large, mid, small].map(([x, y], i) => ({ x: Math.round(x - sizes[i] / 2), y: Math.round(y - lift - sizes[i] / 2), w: sizes[i], h: sizes[i] }));
}

/**
 * A round pixel disc `d` px across drawn in 2 px steps, as a clip polygon in its own d x d box: the tail's puffs and the
 * pop's (v3/08, section 2).
 */
export function pixelDisc(d: number): string {
  const r = d / 2, right: [number, number][] = [];
  for (let y = 0; y < d; y += 2) {
    // The widest point of this 2 px row, rounded to whole 2 px steps.
    const dy = y <= r && r <= y + 2 ? 0 : Math.min(Math.abs(y - r), Math.abs(y + 2 - r)), half = Math.min(r, Math.max(2, Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) / 2) * 2));
    right.push([r + half, y], [r + half, Math.min(d, y + 2)]);
  }
  const left = right.map(([x, y]) => [d - x, y] as [number, number]).reverse();
  return `polygon(${[...right, ...left].map(([x, y]) => `${x}px ${y}px`).join(',')})`;
}

// ---------- the sign ----------

/**
 * The sign's board (v3/08, section 5), in the plan's px (times `u`): what `signHeight` and the stylesheet both lay out.
 * Its top is where the post's chains end: no bar or chains of its own. `dot`, `dgap`: the three sunk squares.
 */
export const SIGN_BOARD = {
  computer: { tile: 42, side: 6, gap: 8, padTop: 12, padX: 20, padBottom: 10, plank: 20, plankGap: 8, dot: 10, dgap: 4, depth: 6, min: 150 },
  phone: { tile: 30, side: 4, gap: 5, padTop: 8, padX: 12, padBottom: 8, plank: 16, plankGap: 6, dot: 8, dgap: 3, depth: 4, min: 150 },
} as const;
/** The board's height, its side included; `plank` false on a window too short for the word plank. */
export function signHeight(phone: boolean, u: number, plank = true): number {
  const S = phone ? SIGN_BOARD.phone : SIGN_BOARD.computer;
  return (S.padTop + S.tile + S.side + (plank ? S.plankGap + S.plank : 0) + S.padBottom + S.depth) * u;
}
/** The board's width for `n` letters: what they and the sunk squares need, and never under 150. */
export function signWidth(n: number, phone: boolean, u: number): number {
  const S = phone ? SIGN_BOARD.phone : SIGN_BOARD.computer;
  return Math.max(S.min, 2 * S.padX + n * S.tile + n * S.gap + 3 * S.dot + 2 * S.dgap) * u;
}
