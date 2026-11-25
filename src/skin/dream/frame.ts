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

/** The bubble's rim, and the scallops along its bottom edge: their widths in turn, each half as tall as it is wide. */
export const RIM = 6;
export const SHADE = 4;
export const SCALLOPS = { computer: [72, 48, 60, 40], phone: [48, 32, 40, 28] } as const;
const OVERLAP = 6, STEP = 3;
/** The top corners' pixel steps, outside and inside the rim. */
const CORNER = { out: 4, in: 2 } as const;

/** The tray's parts, in the plan's px (times `u`). */
export const TRAY = {
  computer: { tile: 40, side: 6, gap: 6, sizes: [40, 36, 32, 28], padX: 16, padTop: 14, padBottom: 12, band: 6, jump: 96, jumpGap: 14, meter: 8, meterGap: 8, slots: 7, bottom: 14 },
  phone: { tile: 28, side: 4, gap: 5, sizes: [28, 24, 20], padX: 10, padTop: 9, padBottom: 8, band: 5, jump: 64, jumpGap: 8, meter: 6, meterGap: 6, slots: 0, bottom: 6 },
} as const;

export interface DreamFrame {
  w: number; h: number; phone: boolean; u: number;
  /** The bed strip, and how much of its left is the bed's. */
  strip: Box; bedZone: number;
  /** The bedroom's canvas: the strip, and the wall on up behind the bumps of the bubble's bottom edge. */
  room: Box;
  /** The dream window: its outer box (its bottom the lowest points of its edge) and the dream's own box inside the rim. */
  bubble: Box; view: Box;
  /** The scallops' baseline, px down the bubble's box; the widths in turn. */
  baseline: number; scallops: readonly number[];
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
    const bubble = { x: 6, y: 6, w: w - 12, h: Math.max(120, h - 150) };
    const sc = SCALLOPS.phone[0] / 2, baseline = bubble.h - sc;
    const view = { x: bubble.x + RIM, y: bubble.y + RIM, w: bubble.w - 2 * RIM, h: bubble.h - 2 * RIM };
    const room = { x: 0, y: bubble.y + baseline, w, h: tray.y - (bubble.y + baseline) };
    return {
      w, h, phone, u, strip, bedZone: 0.46 * w, room, bubble, view, baseline, scallops: SCALLOPS.phone, tray,
      tiles: tray.w - 2 * T.padX - T.jump - T.jumpGap,
      hint: { x: bubble.x + RIM + 6, w: bubble.w - 2 * RIM - 12, bottom: h - (bubble.y + baseline) + 4 },
    };
  }
  const T = TRAY.computer;
  const bed = clamp(160, 0.24 * h, 240), bedZone = clamp(380, 0.36 * w, 590);
  const strip = { x: 0, y: h - bed, w, h: bed };
  const bubble = { x: 10, y: 10, w: w - 20, h: h - bed - 6 - 10 };
  const sc = SCALLOPS.computer[0] / 2, baseline = bubble.h - sc;
  const view = { x: bubble.x + RIM, y: bubble.y + RIM, w: bubble.w - 2 * RIM, h: bubble.h - 2 * RIM };
  const room = { x: 0, y: bubble.y + baseline, w, h: h - (bubble.y + baseline) };
  const tiles = T.slots * (T.tile + T.gap) - T.gap;
  const tw = (2 * T.padX + tiles + T.jumpGap + T.jump) * u;
  const th = (T.band + T.padTop + T.tile + T.side + T.meterGap + T.meter + T.padBottom + T.side) * u;
  const tray = { x: Math.round((bedZone + w) / 2 - tw / 2), y: Math.round(h - T.bottom * u - th), w: Math.round(tw), h: Math.round(th) };
  return { w, h, phone, u, strip, bedZone, room, bubble, view, baseline, scallops: SCALLOPS.computer, tray, tiles: tiles * u, hint: { x: tray.x, w: tray.w, bottom: h - tray.y + 8 * u } };
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

/** Where each scallop's middle is along `width`, and its half width: the widths in turn, overlapping, fitted to the width. */
export function scallopRow(width: number, widths: readonly number[]): { c: number; r: number }[] {
  const out: number[] = [];
  let total = 0;
  for (let k = 0; total < width; k++) { const s = widths[k % widths.length]; out.push(s); total += s - (k ? OVERLAP : 0); }
  // Too long by a part of a scallop: close them up evenly, so the first and the last end on the corners.
  const lap = out.length > 1 ? OVERLAP + (total - width) / (out.length - 1) : 0;
  let x = 0;
  return out.map((s, k) => { const c = x + s / 2; x += s - lap; return { c: k === out.length - 1 && out.length > 1 ? width - s / 2 : c, r: s / 2 }; });
}

/** How far under the baseline the bottom edge hangs at `x`, in whole steps; `inset` draws the rim's inner edge. */
function hang(row: { c: number; r: number }[], x: number, inset: number): number {
  let d = 0;
  for (const { c, r } of row) {
    const a = r - inset, t = (x - c) / a;
    if (a > 0 && Math.abs(t) < 1) d = Math.max(d, a * Math.sqrt(1 - t * t));
  }
  return Math.round(d / STEP) * STEP;
}

/** A top corner's stair, from the side down to the top edge, `n` steps of the bubble's step. */
const stair = (n: number): [number, number][] => { const o: [number, number][] = [[0, n * STEP]]; for (let k = 1; k <= n; k++) o.push([k * STEP, (n - k + 1) * STEP], [k * STEP, (n - k) * STEP]); return o; };

/**
 * The thought bubble as two polygons in its own box (`w` wide; `baseline` is where the scallops hang from): `outer`, the
 * rim's outside, and `inner`, the dream's clip, the rim's width inside it. Pixel corners at the top; along the bottom,
 * half-ellipses side by side drawn in steps, never smooth. `depth` is how far the lowest point hangs under the baseline.
 */
export function bubbleShape(w: number, baseline: number, widths: readonly number[]): { outer: string; inner: string; depth: number } {
  const row = scallopRow(w, widths), depth = Math.max(...widths) / 2;
  const edge = (inset: number): string => {
    const n = inset ? CORNER.in : CORNER.out, x0 = inset, x1 = w - inset, y0 = inset;
    const pts: [number, number][] = [];
    for (const [x, y] of stair(n)) pts.push([x0 + x, y0 + y]);
    for (const [x, y] of stair(n).reverse()) pts.push([x1 - x, y0 + y]);
    // Along the bottom from right to left, a column a step.
    for (let x = x1; x > x0; x -= STEP) {
      const xa = Math.max(x0, x - STEP), y = baseline + hang(row, (x + xa) / 2, inset);
      pts.push([x, y], [xa, y]);
    }
    return `polygon(${pts.map(([x, y]) => `${Math.round(x * 10) / 10}px ${Math.round(y * 10) / 10}px`).join(',')})`;
  };
  return { outer: edge(0), inner: edge(RIM), depth };
}
/** The bubble's bottom edge at `x` (px along its box): how far down its box the rim's outside reaches there. */
export function bubbleBottom(f: DreamFrame, x: number): number {
  return f.baseline + hang(scallopRow(f.bubble.w, f.scallops), x, 0);
}

// ---------- the bed strip's camera ----------

/**
 * The bed, in the bedroom's frame (bedroom.ts): the outside of its head and foot posts, its near side, the mattress's
 * top. `headTop`, `headFront`: the top and the front of the near headboard post's knob, its outer edge's highest point.
 */
export const BED_BOX = { headX: -0.15, headTop: 1.35, headFront: 0.7, footX: 2.15, nearZ: 0.6, top: 0.55, midX: 1.0 } as const;
/**
 * The camera `bedSide` (docs/dream/v3/09, section 2): on the room's open side, 1.1 m above the mattress's top, the
 * strip's height its 20 degrees. `cut`: the strip's bottom edge cuts the bed's near side this high, just under its side
 * rail.
 *
 * `pitch`, how far the camera is turned down: the plan says 18 degrees; it is 0. The strip is a wide slice of what the
 * camera sees, shifted (a view offset), so turning the camera changes nothing about where it sees him from: what the
 * height gives (his face, shoulders and the quilt's top seen from above) is the same either way. Turned, every upright
 * leaned the further it stood from the camera (the window at the strip's right end leaned like a falling picture);
 * level, the walls stay square to the screen. 18 here puts the turn back.
 */
export const BED_SIDE = { lift: 1.1, pitch: 0, fov: 20, cut: 0.18 } as const;
/**
 * His face as he lies asleep (`bedSleep`): the tip of his nose, where his z's leave from; and the tip of his cap, the
 * top of its crown, which the bubble's puffs are placed from. In the bedroom's frame; bedroom.test.ts holds them to the
 * model as it lies.
 */
export const NOSE = { x: 0.56, y: 1.1, z: 0.22 } as const;
export const CAP_TIP = { x: 0.22, y: 0.91, z: 0.1 } as const;

export interface StripCamera {
  /** The camera's place; it looks along -z, turned down by `pitch` (radians), with no turn to either side. */
  position: [number, number, number];
  pitch: number;
  /** Px on screen per metre at the bed's near side (the mattress's top, halfway along), and the focal length in px. */
  scale: number; focal: number;
  /** Where the camera's own axis meets the screen, CSS px. */
  axis: [number, number];
}

const DEG = Math.PI / 180;
/** The slope a phone's strip camera looks down at his face with: the computer's, from 1.1 m up at its distance. */
const PHONE_LOOK = 0.2;
/** How far in front of the camera a point is, along its axis (`camera` stands at `c`, turned down `pitch`). */
const depthAt = (c: readonly number[], pitch: number, y: number, z: number) => -(y - c[1]) * Math.sin(pitch) - (z - c[2]) * Math.cos(pitch);

/**
 * The strip's camera for a frame. On a computer it stands halfway along the bed, `lift` over the mattress, turned
 * down `pitch`, as far from the bed as the strip's camera always has (the bed's length from 24 px to 70 px short of
 * the bed zone), with the headboard's outer edge 24 px from the strip's left; the strip's bottom edge cuts the bed's
 * near side at `cut`. The nightstand, the basket and the books stand past the bed zone, left of the tray. A phone
 * moves in to his head and shoulders across the left 46%.
 */
export function stripCamera(f: DreamFrame): StripCamera {
  const pitch = BED_SIDE.pitch * DEG, focal = f.strip.h / (2 * Math.tan((BED_SIDE.fov * DEG) / 2));
  const H = BED_BOX, bottom = f.strip.y + f.strip.h, HEADBOARD = [H.headX, H.headTop, H.headFront], CUT = [H.midX, BED_SIDE.cut, H.nearZ];
  // Stood at `pos`: `pin` lands `left` px from the strip's left, and `cut` at `cutY` px down the screen.
  const build = (pos: [number, number, number], pin: readonly number[], left: number, cut: readonly number[], cutY: number): StripCamera => {
    const ax = left - (focal * (pin[0] - pos[0])) / depthAt(pos, pitch, pin[1], pin[2]);
    const up = (cut[1] - pos[1]) * Math.cos(pitch) - (cut[2] - pos[2]) * Math.sin(pitch);
    const ay = cutY + (focal * up) / depthAt(pos, pitch, cut[1], cut[2]);
    return { position: pos, pitch, focal, scale: focal / depthAt(pos, pitch, H.top, H.nearZ), axis: [ax, ay] };
  };
  if (f.phone) {
    // His head and shoulders across the bed zone, never so close that his head is taller than the strip: the tip of his
    // cap 36 px in (so close, the headboard's knob, half a metre nearer the camera, would throw everything right), his
    // head in the strip's middle. So close, 1.1 m over the mattress would look straight down on him: the camera is
    // raised only as far as sees his face from the angle the computer's strip does.
    const scale = Math.min(f.bedZone / 1.6, f.strip.h / 0.6), head = [0.5, 0.92, 0.1] as const, d = focal / scale;
    return build([0.5, head[1] + d * PHONE_LOOK, head[2] + d], [CAP_TIP.x, CAP_TIP.y, CAP_TIP.z], 36, head, f.strip.y + f.strip.h / 2);
  }
  // As far from the bed as before (the bed's length from 24 px to 70 px short of the bed zone), so he stays as big.
  const scale = (f.bedZone - 24 - 70) / (H.footX - H.headX);
  return build([H.midX, H.top + BED_SIDE.lift, H.nearZ + focal / scale], HEADBOARD, 24, CUT, bottom);
}
/** Where a point of the bedroom lands on screen through the strip's camera, CSS px. */
export function stripPoint(c: StripCamera, x: number, y: number, z: number): [number, number] {
  const k = c.focal / depthAt(c.position, c.pitch, y, z), up = (y - c.position[1]) * Math.cos(c.pitch) - (z - c.position[2]) * Math.sin(c.pitch);
  return [c.axis[0] + (x - c.position[0]) * k, c.axis[1] - up * k];
}
/** The bedroom x that lands at screen `px` at height `y` on the plane z = `z` (the back wall, say). */
export const stripX = (c: StripCamera, px: number, z: number, y = 0): number => c.position[0] + ((px - c.axis[0]) * depthAt(c.position, c.pitch, y, z)) / c.focal;

/** The back wall's z, and how far along it the strip's low window is wide, and its middle's height (bedroom.ts). */
const BACK_Z = -1.3, WINDOW_W = 0.8, WINDOW_Y = 1.15;
/**
 * How far along the wall the strip sees (at the floor, where it sees furthest), and where its window goes: its right
 * side 44 px in from the screen's right, on screens 1200 wide or more.
 */
export function stripExtent(f: DreamFrame, c: StripCamera = stripCamera(f)): { x1: number; windowX: number | null } {
  const x1 = Math.ceil(stripX(c, f.w, BACK_Z, 0) * 2) / 2 + 0.5;
  const windowX = !f.phone && f.w >= 1200 ? Math.round((stripX(c, f.w - 44, BACK_Z, WINDOW_Y) - WINDOW_W) * 20) / 20 : null;
  return { x1, windowX };
}

/** The bubble's tail: three puffs stepping down and left from the window's bottom edge to just over his nose. */
export const TAIL = { computer: [42, 26, 16], phone: [26, 18, 12] } as const;
export function tailPuffs(f: DreamFrame, c: StripCamera = stripCamera(f)): Box[] {
  const sizes = f.phone ? TAIL.phone : TAIL.computer, [nx, ny] = stripPoint(c, NOSE.x, NOSE.y, NOSE.z);
  // The smallest sits 12 above him; each one up overlaps the one under it by a third and steps right.
  const out: Box[] = [];
  let x = nx + sizes[2] * 0.4, bottom = ny - (f.phone ? 10 : 24);
  for (let k = 2; k >= 0; k--) {
    const s = sizes[k];
    out.unshift({ x: Math.round(x - s / 2), y: Math.round(bottom - s), w: s, h: s });
    bottom -= s * 0.72;
    x += s * 0.5 + (k ? sizes[k - 1] * 0.32 : 0);
  }
  return out;
}

// ---------- the sign ----------

/** The sign's board, in the plan's px (times `u`): what `signHang` and the stylesheet both lay out. */
export const SIGN_BOARD = {
  computer: { tile: 42, side: 6, gap: 8, pad: 8, plank: 18, plankGap: 6, bar: 5, chain: 12, dots: 38 },
  phone: { tile: 30, side: 4, gap: 5, pad: 5, plank: 14, plankGap: 4, bar: 4, chain: 8, dots: 30 },
} as const;
/** The board's height, hanger and chains included; `plank` false on a window too short for the word plank. */
export function signHeight(phone: boolean, u: number, plank = true): number {
  const S = phone ? SIGN_BOARD.phone : SIGN_BOARD.computer;
  return (S.bar + S.chain + 2 * S.pad + S.tile + S.side + (plank ? S.plankGap + S.plank : 0)) * u;
}
/** The board's width for `n` letters. */
export function signWidth(n: number, phone: boolean, u: number): number {
  const S = phone ? SIGN_BOARD.phone : SIGN_BOARD.computer;
  return (2 * S.pad + n * S.tile + (n - 1) * S.gap + S.gap + S.dots) * u;
}
