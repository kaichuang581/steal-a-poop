import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * The one flat canvas left over the dream (docs/dream/v3/02, section 7: the scenery, the stars and the puffs are the
 * voxel scene's now): the rings, a ring of 2 px squares spreading from a sign as its word is taken, and the one bright
 * ring across the window as the sheep runs through the farm gate. Drawn by `frame`, which the dream's own loop calls.
 */
export interface FxHandle {
  /** One frame, on the dream's clock (ms). */
  frame(t: number): void;
  /** A ring spreading from a point (a word taken), or across the whole window (`wide`: the farm gate). */
  ring(x: number, y: number, wide?: boolean): void;
  reset(): void;
}

interface Props {
  w: number; h: number;
  reduced: boolean;
  /** What goes under the canvas: the dream's own. */
  children?: ReactNode;
}

interface Ring { x: number; y: number; at: number; to: number; ms: number; alpha: number }
const RING = { to: 240, ms: 400, alpha: 0.5 } as const;
const LANTERN_HI = [255, 217, 138];
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export const Fx = forwardRef<FxHandle, Props>(function Fx({ w, h, reduced, children }, ref) {
  const over = useRef<HTMLCanvasElement>(null);
  const S = useMemo(() => ({ rings: [] as Ring[], t: 0 }), []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  useImperativeHandle(ref, () => ({
    ring(x, y, wide) {
      if (reduced) return;
      S.rings.push(wide ? { x, y, at: S.t, to: w * 1.8, ms: 500, alpha: 0.6 } : { x, y, at: S.t, ...RING });
    },
    reset() { S.rings = []; },
    frame(t) {
      S.t = t;
      const o = over.current?.getContext('2d');
      if (!o) return;
      S.rings = S.rings.filter((r) => t - r.at < r.ms);
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, o.canvas.width, o.canvas.height);
      if (!S.rings.length) return;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const r of S.rings) {
        // A ring of 2 px squares, never a smooth line: from nothing to its size, fading.
        const k = (t - r.at) / r.ms, rad = (r.to / 2) * easeOut(k), n = Math.max(12, Math.round((rad * 2 * Math.PI) / 5));
        o.fillStyle = `rgba(${LANTERN_HI.join(',')},${r.alpha * (1 - k)})`;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.fillRect(Math.round((r.x + Math.cos(a) * rad) / 2) * 2, Math.round((r.y + Math.sin(a) * rad) / 2) * 2, 2, 2); }
      }
    },
  }), [S, reduced, dpr, w]);
  return (
    <>
      {children}
      <canvas ref={over} className="dr-fx dr-fx--over" aria-hidden="true" width={Math.round(w * dpr)} height={Math.round(h * dpr)} style={{ width: w, height: h }} />
    </>
  );
});
