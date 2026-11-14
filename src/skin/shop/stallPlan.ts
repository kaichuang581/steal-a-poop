/**
 * The Feed Sacks' market stall, measured (Brian, 2026-11-13: "turn the counter into a market stall"). The stall is one
 * voxel model (stallModels.ts) photographed from the front by tools/renderStall.mjs; the crates, the tags, the lantern
 * and the chalk on the sign are laid over that picture by FeedSacks.tsx. Both read these numbers, so a tag's nail is on
 * the board the picture drew and a crate stands on the plank it drew. No imports: the page must not pull in three.
 *
 * Everything is in voxels: x to the right from the stall's left edge, y up from the floor, z toward the buyer from the
 * back wall. The camera looks down by STALL_PITCH, so a thing nearer the buyer is lower in the picture.
 */
export const STALL_PITCH = 0.2;
/** How far each crate leans toward the buyer, on a chock under its back. */
export const CRATE_TILT = 0.2;
const COS = Math.cos(STALL_PITCH), SIN = Math.sin(STALL_PITCH);
/** How high in the picture a point of the stall is, in voxel rows. */
export const rise = (y: number, z: number) => y * COS - z * SIN;

export type StallSize = 'wide' | 'low' | 'mid' | 'narrow';
export const STALL_SIZES: readonly StallSize[] = ['wide', 'low', 'mid', 'narrow'];

/** Depths, back to front. */
export const DEPTH = {
  /** The shelves stand out from the wall this far. */
  shelf: 4,
  /** Where a crate's front is when it rests, and when it is picked (8 px nearer at the size the stall is drawn). */
  crateRest: 18, cratePicked: 23,
  /** The counter's boarded front, and its plank's lip. */
  front: 23, lip: 24,
  /** The awning's canvas, back edge to front bar. */
  awningBack: 15, awningFront: 25,
  /** How far the barrel and the stacked crates stand out on the floor. */
  floor: 32,
} as const;
/** A crate: wide enough for a sack and a little grain each side, its front board low so the grain shows. */
export const CRATE = { w: 20, d: 16, back: 7, front: 4 } as const;
/** A sack is this tall (thumbModels.ts sackGrid). */
export const SACK_ROWS = 16;

export interface StallPlan {
  size: StallSize;
  /** Voxels across. */
  w: number;
  /** How tall the boarded front is, floor to plank: tall enough for a tag to hang on it. */
  panel: number;
  /** The plank's top, where the crates stand. */
  top: number;
  /** The middle of each crate. */
  crates: readonly [number, number, number];
  /** Which shoulder of each sack the lantern hangs over: -1 its left, 1 its right. */
  lantern: readonly [number, number, number];
  /** How thick the posts are, and how wide one stripe of the awning is. */
  post: number; stripe: number;
  /** The back shelves, the hanging goods, the barrel, the stacked crates: all but the narrowest stall. */
  stock: boolean;
  /** The brass scale's middle on the counter's left end, where there is room for one. */
  scale: number | null;
  /** The chalkboard on the back wall: its left, bottom, width and height on the wall, and how many lines the chalk takes. */
  sign: { x: number; y: number; w: number; h: number; lines: 1 | 2 } | null;
  /** The bottom of the awning's scalloped edge, the bar it hangs from, and the canvas's back edge. */
  valance: number; bar: number; ridge: number;
}

/** How far in from the stall's edge a post stands. */
export const POST_INSET = 2;
interface Opts { post?: number; stripe?: number; scale?: boolean; stock?: boolean; sign?: { w: number; h: number; lines: 1 | 2 }; lantern: [number, number, number] }
function plan(size: StallSize, w: number, panel: number, o: Opts): StallPlan {
  const post = o.post ?? 4, top = panel + 2;
  const from = POST_INSET + post + (o.scale ? 16 : 0), to = w - POST_INSET - post;
  const third = (to - from) / 3;
  const crates = [0, 1, 2].map((i) => Math.round(from + third * (i + 0.5))) as [number, number, number];
  // The sign hangs between the first two sacks' necks, its top just under the awning's edge.
  const sign = o.sign ? { x: Math.round((crates[0] + crates[1]) / 2 - o.sign.w / 2), y: top + 16 - o.sign.h, ...o.sign } : null;
  return {
    size, w, panel, top, crates, lantern: o.lantern, post, stripe: o.stripe ?? 6, stock: o.stock ?? true,
    scale: o.scale ? POST_INSET + post + 9 : null, sign, valance: top + 22, bar: top + 25, ridge: top + 27,
  };
}

/**
 * Four stalls, one per shape of window. `wide` is the desktop's; `low` is drawn smaller and wider for a short window
 * (a laptop), so the cards under it stay in view; `mid` is a tablet's; `narrow` is a phone's: the awning, the counter's
 * front, the crates and the tags, and nothing else. Each front panel is as tall as that window's tag needs, and each
 * width is a whole, odd number of awning stripes, so the awning starts and ends on red.
 */
export const STALLS: Record<StallSize, StallPlan> = {
  wide: plan('wide', 133, 11, { stripe: 7, scale: true, sign: { w: 22, h: 5, lines: 1 }, lantern: [-1, 1, 1] }),
  low: plan('low', 162, 14, { scale: true, sign: { w: 27, h: 6, lines: 1 }, lantern: [-1, 1, 1] }),
  mid: plan('mid', 90, 14, { sign: { w: 12, h: 8, lines: 2 }, lantern: [-1, 1, 1] }),
  narrow: plan('narrow', 72, 17, { post: 3, stripe: 8, stock: false, lantern: [1, 1, -1] }),
};

/** The picture's edges in rows: from the floor in front of the barrel to the snow on the awning's ridge. */
export function frame(p: StallPlan): { w: number; h: number; bottom: number; top: number } {
  const bottom = Math.round(rise(0, p.stock ? DEPTH.floor + 1 : DEPTH.lip + 2) * 2) / 2;
  const top = Math.ceil(rise(p.ridge + 2, DEPTH.awningBack) * 2) / 2;
  return { w: p.w, h: top - bottom, bottom, top };
}

/**
 * The crate's own picture: a box round a crate at rest and the sack in it, the same for all three. `w` voxels wide about
 * the crate's middle, `h` rows tall, starting `below` rows under the crate's front foot.
 */
export const CRATE_BOX = { w: 28, h: 24, below: 2 } as const;
/** The lantern's picture, with the glow round it: the lantern hangs from the picture's middle, its ring `above` rows under the top edge. */
export const LANTERN_BOX = { w: 16, h: 16, above: 3.4 } as const;
/** The strip of the awning that sways (the band's front and the scallops under it): where its picture starts, and how many rows it is. */
export const valanceBox = (p: StallPlan) => ({ bottom: rise(p.valance, DEPTH.awningFront + 1) - 0.4, h: 5 });

/** A place on the picture as CSS: `left` and `bottom` in percent of the stall's box. */
export function place(p: StallPlan, x: number, y: number, z: number): { left: number; bottom: number } {
  const f = frame(p);
  return { left: (x / f.w) * 100, bottom: ((rise(y, z) - f.bottom) / f.h) * 100 };
}
