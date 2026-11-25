import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { whole } from './beat';
import { ART_GRIDS } from './pixelArt';
import { hash01, STAR_WORDS, starPlaces, wordDots } from './starWords';
import type { Place } from './starWords';

/**
 * The dream's two flat canvases (docs/dream/08-run-order-and-checks.md, section 3): one for the sky, where your words
 * hang as stars (06, section 5), and one for effects over the scene (rings, puffs). Both are drawn by `frame`, which the
 * dream's own loop calls, so they keep the dream's clock and cost no loop of their own. Drawn only: nothing here reads
 * or changes the game's timing. Coordinates are CSS px in the dream's box.
 */
export interface FxHandle {
  /** One frame: the dream's clock (ms), the beat's count, and how fast the lane runs left, px a second. */
  frame(t: number, beats: number, lane: number): void;
  /** A ring spreading from a point (a word taken). */
  ring(x: number, y: number): void;
  /** Pixel puffs at the hooves: `n` of them, fanning out behind. */
  puffs(x: number, y: number, n: number): void;
  /** A word rises from a point into its place in the sky, and stays. */
  word(text: string, x: number, y: number): void;
  /** One of the night's words, already in its place (a run picked up again). */
  reset(): void;
}

interface Props {
  w: number; h: number;
  /** The ground line, px down the box. */
  lane: number;
  /** The night: it shuffles the words' places. */
  seed: string;
  phone: boolean; reduced: boolean;
  /** What a word must not sit under: the counters, the moon. */
  keepOut: readonly { x: number; y: number; w: number; h: number }[];
  /** How many words stay in the sky: 30, a phone 10. */
  keeps: number;
}

interface Star { text: string; dots: [number, number][]; cols: number; place: Place; from: [number, number]; at: number }
interface Ring { x: number; y: number; at: number }
interface Puff { x: number; y: number; vx: number; vy: number; at: number }

const RING = { to: 240, ms: 400, alpha: 0.5 } as const;
const PUFF_MS = 300;
/** The most particles alive at once, of every kind together (plan file 08, section 3). */
export const MOST_PARTICLES = 60;
const FROST = [187, 204, 240], LANTERN_HI = [255, 217, 138];
const PUFFS = [ART_GRIDS['puff-1'].rows, ART_GRIDS['puff-2'].rows, ART_GRIDS['puff-3'].rows];
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export const Fx = forwardRef<FxHandle, Props>(function Fx({ w, h, lane, seed, phone, reduced, keepOut, keeps }, ref) {
  const sky = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null);
  const places = useMemo(() => starPlaces(w, lane, seed, keepOut), [w, lane, seed, keepOut]);
  const S = useMemo(() => ({ stars: [] as Star[], rings: [] as Ring[], puffs: [] as Puff[], t: 0, n: 0, drawn: '', busy: false, last: 0 }), []);
  // The backing store: the screen's own pixels, at most twice the box (section 3's limit).
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  useEffect(() => { S.drawn = ''; }, [S, w, h, places, dpr]);
  // A resize moves the places: every word goes to its place in the new frame.
  useEffect(() => { S.stars.forEach((s, i) => { s.place = places[(S.n - S.stars.length + i) % Math.max(1, places.length)] ?? s.place; }); }, [S, places]);

  useImperativeHandle(ref, () => ({
    ring(x, y) { if (!reduced) S.rings.push({ x, y, at: S.t }); },
    puffs(x, y, n) {
      if (reduced) return;
      for (let i = 0; i < n && S.puffs.length < MOST_PARTICLES; i++) {
        // A fan behind the hooves: back and a little up, each its own way.
        const a = Math.PI * (0.62 + (0.5 * i) / Math.max(1, n - 1));
        S.puffs.push({ x: x - 4 * i, y, vx: Math.cos(a) * (50 + 22 * (i % 3)), vy: -Math.abs(Math.sin(a)) * (30 + 14 * (i % 2)), at: S.t });
      }
    },
    word(text, x, y) {
      if (!places.length) return;
      const { dots, cols } = wordDots(text);
      S.stars.push({ text, dots, cols, place: places[S.n % places.length], from: [x, y], at: reduced ? S.t - STAR_WORDS.rise : S.t });
      S.n++;
      // Only the newest stay (a phone keeps 10); an older one in the same place gives way.
      while (S.stars.length > Math.min(keeps, places.length)) S.stars.shift();
    },
    reset() { S.stars = []; S.rings = []; S.puffs = []; S.n = 0; S.drawn = ''; },
    frame(t, beats, laneSpeed) {
      const dt = Math.min(0.05, Math.max(0, (t - S.t) / 1000));
      S.t = t;
      const pitch = phone ? STAR_WORDS.pitch.phone : STAR_WORDS.pitch.computer;
      // ---- the sky: redrawn while a word is rising or cooling, and once a beat for the twinkle
      const c = sky.current?.getContext('2d');
      const newest = S.stars[S.stars.length - 1];
      const moving = !!newest && t - newest.at < STAR_WORDS.rise + STAR_WORDS.newFor + 500;
      const key = `${S.stars.length}:${S.n}:${reduced ? 0 : whole(beats)}`;
      if (c && (moving || key !== S.drawn)) {
        S.drawn = key;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        const beat = reduced ? 0 : whole(beats);
        S.stars.forEach((s, si) => {
          const age = t - s.at, k = easeOut(age / STAR_WORDS.rise);
          const width = s.cols * pitch, x0 = s.place.x - width / 2, y0 = s.place.y;
          // The newest word is lantern for two seconds, then cools to frost.
          const warm = s === newest ? 1 - Math.min(1, Math.max(0, (age - STAR_WORDS.rise - STAR_WORDS.newFor) / 500)) : 0;
          const col = FROST.map((f, i) => Math.round(f + (LANTERN_HI[i] - f) * warm));
          s.dots.forEach(([dx, dy], di) => {
            // On the way up the dots start as wide apart as the plank's tiles were, and close to their own spacing.
            const sp = pitch + (6 - pitch) * (1 - k), size = STAR_WORDS.dot + 6 * (1 - k);
            const tx = x0 + dx * pitch, ty = y0 + dy * pitch;
            const fx = s.from[0] + (dx - s.cols / 2) * sp * 0.5, fy = s.from[1] + (dy - 2) * sp * 0.5;
            const dim = hash01(s.text, beat * 31 + di + si * 7) < 1 / 6 ? 0.6 : 1;
            c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(warm > 0 ? 1 : 0.85) * dim})`;
            c.fillRect(Math.round(fx + (tx - fx) * k), Math.round(fy + (ty - fy) * k), Math.round(size), Math.round(size));
          });
        });
      }
      // ---- the effects: rings and puffs, cleared once when the last one has gone
      const o = over.current?.getContext('2d');
      if (!o) return;
      S.rings = S.rings.filter((r) => t - r.at < RING.ms);
      S.puffs = S.puffs.filter((p) => t - p.at < PUFF_MS);
      const busy = S.rings.length + S.puffs.length > 0;
      if (!busy && !S.busy) return;
      S.busy = busy;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.clearRect(0, 0, w, h);
      for (const r of S.rings) {
        // A ring of 2 px squares, never a smooth line: from nothing to 240 across, fading from 50%.
        const k = (t - r.at) / RING.ms, rad = (RING.to / 2) * easeOut(k), n = Math.max(12, Math.round((rad * 2 * Math.PI) / 5));
        o.fillStyle = `rgba(${LANTERN_HI.join(',')},${RING.alpha * (1 - k)})`;
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; o.fillRect(Math.round((r.x + Math.cos(a) * rad) / 2) * 2, Math.round((r.y + Math.sin(a) * rad) / 2) * 2, 2, 2); }
      }
      o.fillStyle = 'rgba(255,253,244,0.9)';
      for (const p of S.puffs) {
        // Left behind: it goes back with the lane as it spreads, through the pack's three frames.
        p.x += (p.vx - laneSpeed) * dt; p.y += p.vy * dt; p.vy += 60 * dt;
        const rows = PUFFS[Math.min(2, Math.floor(((t - p.at) / PUFF_MS) * 3))];
        rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') o.fillRect(Math.round(p.x) + (x - 4) * 2, Math.round(p.y) + (y - 4) * 2, 2, 2); }));
      }
    },
  }), [S, places, reduced, phone, keeps, w, h, dpr]);

  const size = { width: Math.round(w * dpr), height: Math.round(h * dpr), style: { width: w, height: h } };
  return (
    <>
      <canvas ref={sky} className="dr-fx dr-fx--sky" aria-hidden="true" {...size} />
      <canvas ref={over} className="dr-fx dr-fx--over" aria-hidden="true" {...size} />
    </>
  );
});
