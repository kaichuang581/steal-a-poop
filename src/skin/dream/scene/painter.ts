/**
 * The dream's pixel art is drawn straight onto a flat canvas (docs/dream/03 to 05): every shape is rectangles, stepped,
 * never smooth. Sizes are the plan's "on-screen px at 1440 x 900" (art px here); `K` is the device's pixels to one of
 * them, and every edge is snapped to a whole device pixel, so no seam is ever blurred.
 */
export class Painter {
  /** An origin, in device px, for a piece drawn about a pivot (a fence knocked over). */
  ox = 0; oy = 0;
  /** Everything drawn is this much there, 0 to 1: one whole world faded over another (a gate under reduced motion). */
  mul = 1;
  private alpha = 1;
  private fill = '';
  constructor(readonly c: CanvasRenderingContext2D, readonly K: number) { this.c.globalAlpha = 1; }
  /** A rectangle in art px, from its top left. */
  r(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const K = this.K, x0 = Math.round(x * K), y0 = Math.round(y * K), x1 = Math.round((x + w) * K), y1 = Math.round((y + h) * K);
    alpha *= this.mul;
    if (x1 <= x0 || y1 <= y0 || alpha <= 0) return;
    if (alpha !== this.alpha) { this.alpha = alpha; this.c.globalAlpha = alpha; }
    if (color !== this.fill) { this.fill = color; this.c.fillStyle = color; }
    this.c.fillRect(x0 + this.ox, y0 + this.oy, x1 - x0, y1 - y0);
  }
  /** A disc, in rows `step` art px tall: stepped, like everything else. */
  disc(cx: number, cy: number, rad: number, color: string, alpha = 1, step = 3): void {
    for (let y = -rad; y < rad; y += step) {
      const m = y + step / 2, half = Math.sqrt(Math.max(0, rad * rad - m * m));
      if (half > 0.5) this.r(cx - Math.round(half / step) * step, cy + y, Math.round(half / step) * step * 2, step, color, alpha);
    }
  }
  /** A ring, the same way: a disc's rim `thick` art px wide. */
  ring(cx: number, cy: number, rad: number, thick: number, color: string, alpha = 1, step = 3): void {
    for (let y = -rad; y < rad; y += step) {
      const m = y + step / 2, out = Math.sqrt(Math.max(0, rad * rad - m * m)), inn = Math.sqrt(Math.max(0, (rad - thick) ** 2 - m * m));
      if (out <= 0.5) continue;
      const o = Math.round(out / step) * step, i = Math.abs(m) >= rad - thick ? 0 : Math.round(inn / step) * step;
      if (i <= 0) this.r(cx - o, cy + y, o * 2, step, color, alpha);
      else { this.r(cx - o, cy + y, o - i, step, color, alpha); this.r(cx + i, cy + y, o - i, step, color, alpha); }
    }
  }
  /** Draws about a pivot (art px) turned by `angle` radians; back to the frame's own origin afterwards. */
  about(px: number, py: number, angle: number, draw: () => void): void {
    const c = this.c, K = this.K;
    c.save();
    c.translate(Math.round(px * K), Math.round(py * K));
    c.rotate(angle);
    draw();
    c.restore();
    this.alpha = 1; this.fill = '';
    c.globalAlpha = 1;
  }
  /** Puts the alpha back to 1 once a frame's drawing is done. */
  done(): void { if (this.alpha !== 1) { this.alpha = 1; this.c.globalAlpha = 1; } }
}

/** A small stable number from two whole numbers, 0 to 1: where a thing stands, how tall it is. Never changes. */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** `v` wrapped into 0 to `n`. */
export const wrap = (v: number, n: number): number => ((v % n) + n) % n;
