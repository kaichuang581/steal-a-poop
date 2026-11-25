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

/** How far up from its bottom the window's lower edge may dip: the room's canvas starts that far up behind the rim. */
const CORNER_H = 12;

/**
 * The dream window as a cloud (Brian, 2026-11-25: "make it so that in the dream, the bubble surrounding the gameplay is
 * actually like a dream cloud instead of a rounded square ... rn it just looks like a floating square on top of the
 * guy"; this replaces v3/08 section 2's cut corners). Big puffs of uneven size along the top and the sides, small round
 * corners (the chip and the counter sit near them), and low wide waves along the bottom that never rise more than
 * CORNER_H, where the room stands behind. Two polygons in the window's own box, `w` x `h`: `outer`, the rim's outside,
 * and `inner`, the dream's clip, the same puffs RIM smaller. The shade is `outer` again, SHADE lower, behind it.
 */
export function bubbleShape(w: number, h: number): { outer: string; inner: string } {
  const puffs = cloudPuffs(w, h);
  const poly = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
  return { outer: poly(cloudOutline(w, h, puffs, 0)), inner: poly(cloudOutline(w, h, puffs, RIM)) };
}

/** `low`: one of the bottom's wide circles, which shapes only the band along the bottom (it would flatten the sides). */
interface Puff { x: number; y: number; r: number; low?: boolean }
/** Puff sizes going round, as shares of an edge's radius: uneven, so it reads as a cloud and not as lace. */
const PUFF_SIZES = [1, 0.84, 0.95, 0.78, 0.9, 0.82, 0.98, 0.8];
/** The circles the cloud is the outline of (with the box between their centres filled in). */
export function cloudPuffs(w: number, h: number): { puffs: Puff[]; core: Box; band: number } {
  const k = Math.min(w, h);
  const c = Math.round(clamp(16, k * 0.05, 36)); // the corners
  const R = Math.round(clamp(24, k * 0.1, 70)); // the top and the sides
  // The bottom: wide circles whose centres sit well inside, so between two the edge dips at most CORNER_H.
  const B = 3 * R, sb = 2 * Math.sqrt(B * B - (B - CORNER_H) ** 2) * 0.95;
  const puffs: Puff[] = [{ x: c, y: c, r: c }, { x: w - c, y: c, r: c }, { x: c, y: h - c, r: c }, { x: w - c, y: h - c, r: c }];
  let i = 0;
  const row = (from: number, to: number, step: number, at: (t: number) => [number, number], r: (j: number) => number) => {
    const n = Math.max(1, Math.round((to - from) / step));
    for (let j = 0; j <= n; j++) { const [x, y] = at(from + ((to - from) * j) / n); puffs.push({ x, y, r: r(i++) }); }
  };
  const size = (j: number) => R * PUFF_SIZES[j % PUFF_SIZES.length];
  // Each puff's centre sits its own radius in, so the biggest touch the box's edge and the smaller ones stand back.
  row(c + R * 0.7, w - c - R * 0.7, R * 1.45, (t) => [t, 0], size);
  row(c + R * 0.7, h - c - R * 0.9, R * 1.45, (t) => [0, t], size);
  row(c + R * 0.7, h - c - R * 0.9, R * 1.45, (t) => [w, t], size);
  for (const p of puffs.slice(4)) { if (p.y === 0) p.y = p.r; else if (p.x === 0) p.x = p.r; else if (p.x === w) p.x = w - p.r; }
  const from = puffs.length;
  row(c + sb / 2, w - c - sb / 2, sb, (t) => [t, h - B], () => B);
  for (const p of puffs.slice(from)) p.low = true;
  return { puffs, core: { x: c, y: c, w: w - 2 * c, h: h - 2 * c }, band: h - c };
}

/**
 * The outline of the puffs and their core, `inset` px in (each puff that much smaller), as points going round: from
 * the middle, one ray toward every 3 px of the box's edge, out to the farthest puff or core edge it meets, never past
 * the box. The cloud is star-shaped from its middle, so the rays find all of it.
 */
function cloudOutline(w: number, h: number, { puffs, core, band }: { puffs: Puff[]; core: Box; band: number }, inset: number): [number, number][] {
  const cx = w / 2, cy = h / 2, out: [number, number][] = [];
  const edge = 2 * (w + h), n = Math.ceil(edge / 3);
  for (let i = 0; i < n; i++) {
    let d = (i / n) * edge, tx: number, ty: number;
    if (d < w) [tx, ty] = [d, 0]; else if ((d -= w) < h) [tx, ty] = [w, d]; else if ((d -= h) < w) [tx, ty] = [w - d, h]; else [tx, ty] = [0, h - (d - w)];
    const len = Math.hypot(tx - cx, ty - cy), ux = (tx - cx) / len, uy = (ty - cy) / len;
    // The core box, inset.
    const bx = ux > 0 ? (core.x + core.w - inset - cx) / ux : ux < 0 ? (core.x + inset - cx) / ux : Infinity;
    const by = uy > 0 ? (core.y + core.h - inset - cy) / uy : uy < 0 ? (core.y + inset - cy) / uy : Infinity;
    let t = Math.min(bx, by);
    for (const p of puffs) {
      const r = p.r - inset, ox = p.x - cx, oy = p.y - cy, b = ox * ux + oy * uy, q = b * b - (ox * ox + oy * oy - r * r);
      if (r <= 0 || q < 0) continue;
      const far = b + Math.sqrt(q);
      if (!p.low || cy + uy * far >= band) t = Math.max(t, far);
    }
    // Never past the box, inset.
    const lim = Math.min(ux > 0 ? (w - inset - cx) / ux : ux < 0 ? (inset - cx) / ux : Infinity, uy > 0 ? (h - inset - cy) / uy : uy < 0 ? (inset - cy) / uy : Infinity);
    t = Math.min(t, lim);
    out.push([cx + ux * t, cy + uy * t]);
  }
  return out;
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


/**
 * The bubble's tail (v3/08, section 2): three round wool puffs, 40, 26 and 16 px across (a phone's 26, 18 and 12). The
 * smallest's middle is 14 above and 6 right of the tip of his cap, the middle one's 24 above and 14 right of that, the
 * largest's 32 above and 26 right of the middle one's (a phone's steps in proportion). If the largest does not reach the
 * window's shade, all three move up together until it overlaps the shade by 4. Largest first.
 */
export const TAIL = { computer: [40, 26, 16], phone: [26, 18, 12] } as const;
export function tailPuffs(f: DreamFrame, c: StripCamera = stripCamera(f)): Box[] {
  const sizes = f.phone ? TAIL.phone : TAIL.computer, k = sizes[0] / TAIL.computer[0], [cx, cy] = stripPoint(c, CAP_TIP.x, CAP_TIP.y, CAP_TIP.z);
  // The plan's offsets run up and to the right of the cap; with his head turned toward the room (v3/09) his face is
  // there, so the puffs rise the same way on the headboard's side, clear of it.
  const small: [number, number] = [cx - 6 * k, cy - 14 * k], mid: [number, number] = [small[0] - 14 * k, small[1] - 24 * k], large: [number, number] = [mid[0] - 26 * k, mid[1] - 32 * k];
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
