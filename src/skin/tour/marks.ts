/**
 * Where the tutorial's 3D things are on screen. The letter board and the bomb are voxels in the scene, not elements in
 * the page, so the guide cannot measure them the way it measures the word bar. The scene writes their rectangles here
 * every frame (TourMarks.tsx) and the guide reads them when it draws its ring (PaintedTour.tsx). Plain numbers, no
 * React state: nothing re-renders for a camera that is moving.
 */
export interface MarkRect { x: number; y: number; width: number; height: number }

const marks = new Map<string, MarkRect>();

export function setMark(name: string, rect: MarkRect | null) {
  if (rect) marks.set(name, rect);
  else marks.delete(name);
}

export const markRect = (name: string): MarkRect | null => marks.get(name) ?? null;

export const clearMarks = () => marks.clear();

/** A point in clip space, as three's `Vector3.project(camera)` leaves it: x and y from -1 to 1, z over 1 behind the far plane. */
export interface Clip { x: number; y: number; z: number }

/**
 * The rectangle, in page pixels, round a set of projected points inside a canvas at `box`. Null when any of them is
 * behind the camera or the whole thing is off the canvas: a ring is never drawn round something that cannot be seen.
 */
export function rectAround(points: readonly Clip[], box: { left: number; top: number; width: number; height: number }): MarkRect | null {
  if (!points.length || points.some((p) => p.z > 1 || p.z < -1)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) {
    const x = box.left + ((p.x + 1) / 2) * box.width, y = box.top + ((1 - p.y) / 2) * box.height;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < box.left || x0 > box.left + box.width || y1 < box.top || y0 > box.top + box.height) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export const RING_PAD = 6;
const EDGE = 3; // a ring never runs off the screen: the round tab sits in the corner, and a close camera makes the board huge

/** The ring round `r`: a little clear of it, and cut back to the screen where the thing itself runs off it. */
export function ringFor(r: MarkRect, vw: number, vh: number): MarkRect {
  const x0 = Math.max(EDGE, r.x - RING_PAD), y0 = Math.max(EDGE, r.y - RING_PAD);
  const x1 = Math.min(vw - EDGE, r.x + r.width + RING_PAD), y1 = Math.min(vh - EDGE, r.y + r.height + RING_PAD);
  return { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
}

/** The share of `r` that `card` lies over, 0 to 1. */
export function covered(card: MarkRect, r: MarkRect): number {
  const w = Math.min(card.x + card.width, r.x + r.width) - Math.max(card.x, r.x);
  const h = Math.min(card.y + card.height, r.y + r.height) - Math.max(card.y, r.y);
  return w > 0 && h > 0 && r.width > 0 && r.height > 0 ? (w * h) / (r.width * r.height) : 0;
}
