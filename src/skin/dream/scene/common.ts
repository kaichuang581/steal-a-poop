import { pulse, whole } from '../beat';
import { hash01 } from '../starWords';
import { hash2, wrap } from './painter';
import type { Painter } from './painter';
import { mix, MOON, STAGE_COLOURS, TOKEN } from './palette';
import { BOX } from './types';
import type { SceneFence, SceneState, StageN } from './types';

/**
 * What every stage's sky is made of (docs/dream/03, section 1; 04 and 05, section 2): five flat bands and a horizon
 * band, small stars in fixed places, and a moon. The colours are a stage's own, blended across a gate.
 */
export interface Sky { bands: readonly string[]; horizon: string }
export function skyOf(stage: StageN): Sky {
  const s = STAGE_COLOURS[stage];
  return { bands: s.sky, horizon: mix(s.sky[4], s.glow, 0.55) };
}
/** The sky part of the way through a gate: every colour blends from the stage being left to the one arriving. */
export function skyBetween(from: StageN, to: StageN, k: number): Sky {
  const a = skyOf(from), b = skyOf(to), t = Math.round(k * 20) / 20;
  return { bands: a.bands.map((c, i) => mix(c, b.bands[i], t)), horizon: mix(a.horizon, b.horizon, t) };
}
/** The gate's colours ease in and out over its first 600 ms. */
export const blendAt = (ms: number): number => { const u = Math.min(1, Math.max(0, ms / 600)); return u * u * (3 - 2 * u); };

/** Five flat bands of equal height from the window's top to the lane, stepped, and a sixth, 46 high, just above it. */
export function paintSky(p: Painter, st: SceneState, sky: Sky): void {
  const h = st.lane / 5;
  sky.bands.forEach((c, i) => p.r(0, i * h, st.W, h + 1, c));
  p.r(0, st.lane - 46, st.W, 46, sky.horizon);
}

interface Star { x: number; y: number; kind: 0 | 1 | 2; alpha: number }
const starCache = new Map<string, Star[]>();
/** The stars' fixed places for a night and a window: 160 on a computer, 70 on a phone; 90 and 40 in the third stage. */
export function starsOf(st: SceneState, n: number): Star[] {
  const key = `${st.seed}:${n}:${Math.round(st.W)}:${Math.round(st.lane)}`;
  let out = starCache.get(key);
  if (!out) {
    out = Array.from({ length: n }, (_, i) => {
      const k = hash01(st.seed, 300 + i * 3);
      return { x: hash01(st.seed, 301 + i * 3) * st.W, y: hash01(st.seed, 302 + i * 3) * (st.lane - 70), kind: (k < 0.5 ? 0 : k < 0.85 ? 1 : 2) as 0 | 1 | 2, alpha: [0.45, 0.65, 0.9][i % 3] };
    });
    if (starCache.size > 12) starCache.clear();
    starCache.set(key, out);
  }
  return out;
}
/**
 * The stars: squares of 2 and 3 px and 5 x 5 plus shapes in frost, at three strengths. On each beat one star in four
 * grows to 1.35 and back. `plus` false leaves the plus shapes out (the third stage has small stars only).
 */
export function paintStars(p: Painter, st: SceneState, stars: readonly Star[], plus = true, alpha = 1): void {
  const u = st.u, beat = st.reduced ? 0 : whole(st.beats), hit = st.reduced ? 0 : pulse(st.beats);
  stars.forEach((s, i) => {
    const grow = (i + beat) % 4 === 0 ? 1 + 0.35 * hit : 1;
    if (s.kind === 2 && plus) {
      const a = 5 * u * grow, t = u * grow;
      p.r(s.x - a / 2, s.y - t / 2, a, t, TOKEN.frost, s.alpha * alpha);
      p.r(s.x - t / 2, s.y - a / 2, t, a, TOKEN.frost, s.alpha * alpha);
    } else {
      const a = (s.kind === 0 ? 2 : 3) * u * grow;
      p.r(s.x - a / 2, s.y - a / 2, a, a, TOKEN.frost, s.alpha * alpha);
    }
  });
}

/** Where the moon is and how big, per stage (a share of the window across and of the sky down; art px across). */
export const MOONS = {
  1: { x: 0.82, y: 0.22, across: 96 },
  2: { x: 0.82, y: 0.24, across: 128 },
  3: { x: 0.78, y: 0.3, across: 190 },
  finale: { x: 0.44, y: 0.38, across: 300 },
} as const;
export interface MoonAt { cx: number; cy: number; r: number; crescent: number }
/** The moon for a frame: its middle and radius in art px, and how much of a crescent it still is (1 in the first stage). */
export function moonAt(st: SceneState): MoonAt {
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k, ease = (k: number) => k * k * (3 - 2 * k);
  let from: { x: number; y: number; across: number } = MOONS[st.stage], crescent = st.stage === 1 ? 1 : 0, to = from, k = 0;
  if (st.gate) { from = MOONS[st.gate.from]; to = MOONS[st.stage]; k = ease(Math.min(1, st.gate.ms / 900)); crescent = st.gate.from === 1 ? 1 - k : 0; }
  let x = lerp(from.x, to.x, k), y = lerp(from.y, to.y, k), across = lerp(from.across, to.across, k);
  if (st.finale > 0) { const f = ease(st.finale); x = lerp(x, MOONS.finale.x, f); y = lerp(y, MOONS.finale.y, f); across = lerp(across, MOONS.finale.across, f); }
  // A phone's window is small: its moon is drawn larger for its size than a computer's (04, section 12: 77 for 128).
  const big = st.phone ? 1.6 : 1, beat = st.reduced || st.stage === 1 ? 1 : 1 + 0.02 * pulse(st.beats);
  const r = (across / 2) * big * beat;
  // On a phone the counters fill the window's top: the moon keeps clear of them.
  return { cx: x * st.W, cy: st.phone && st.finale === 0 ? Math.max(y * st.lane, 66 * st.u + r) : y * st.lane, r, crescent };
}
/** The moon: a disc of pale gold. A crescent has a disc of the sky laid over it; a full one has two craters and a halo. */
export function paintMoon(p: Painter, st: SceneState, m: MoonAt, skyOver: string): void {
  const step = Math.max(2, Math.round(m.r / 16));
  if (m.crescent < 1 && m.r > 30) p.ring(m.cx, m.cy, m.r + (st.stage === 3 ? 16 : 12), st.stage === 3 ? 16 : 12, MOON.face, (st.stage === 3 ? 0.14 : 0.16) * (1 - m.crescent), step);
  p.disc(m.cx, m.cy, m.r, MOON.face, 1, step);
  if (m.crescent > 0) {
    // The dark disc over the crescent, 26 to the right and 12 up; at the first gate it slides off as the moon fills.
    const off = 1 - m.crescent;
    p.disc(m.cx + (26 + 150 * off) * (m.r / 48), m.cy - 12 * (m.r / 48), m.r * (90 / 96), skyOver, 1, step);
  } else {
    p.disc(m.cx - m.r * 0.3, m.cy - m.r * 0.22, m.r * 0.2, MOON.crater, 1, step);
    p.disc(m.cx + m.r * 0.28, m.cy + m.r * 0.3, m.r * 0.13, MOON.crater, 1, step);
  }
}

// ---------- what stands on the lane in every stage ----------

/** A lantern on an obstacle: dim until its word is taken, then lit with a glow 20 across at 24%. */
export function lantern(p: Painter, x: number, y: number, lit: boolean, dim: string): void {
  if (lit) p.disc(x + 3, y + 4, 10, TOKEN.lanternHi, 0.24, 4);
  p.r(x, y, 6, 8, lit ? TOKEN.lanternHi : dim);
  p.r(x + 1, y - 2, 4, 2, TOKEN.ink);
}
/** The sign's post: from the lane up to where the board hangs, behind its obstacle. */
export function signPost(p: Painter, st: SceneState, f: SceneFence, wood: string, shade: string): void {
  p.r(f.signX - 5, f.signTop, 10, st.lane - f.signTop, wood);
  p.r(f.signX + 2, f.signTop, 3, st.lane - f.signTop, shade);
}
/** The sheep's shadow on the lane: it shrinks as the sheep leaves the ground. */
export function sheepShadow(p: Painter, st: SceneState, color: string): void {
  const k = 1 - 0.45 * Math.min(1, st.sheep.lift / 120), w = st.sheep.w * 0.8 * k;
  p.r(st.sheep.x - w / 2, st.lane, w, 3, color, 0.55);
  p.r(st.sheep.x - w / 2 + 6, st.lane + 3, w - 12, 2, color, 0.55);
}
/**
 * An obstacle in its box: `draw` is given a brush whose origin is the box's bottom left with y going up. A bumped one
 * tips over about its far bottom corner.
 */
export type Brush = (x: number, y: number, w: number, h: number, color: string, alpha?: number) => void;
export function inBox(p: Painter, st: SceneState, f: SceneFence, draw: (u: Brush) => void): void {
  if (f.tilt > 0.001) {
    p.about(f.x + BOX.w, st.lane, f.tilt, () => draw((x, y, w, h, c, a) => p.r(x - BOX.w, -y - h, w, h, c, a)));
    return;
  }
  draw((x, y, w, h, c, a) => p.r(f.x + x, st.lane - y - h, w, h, c, a));
}
/** Thin white lines rushing past, in front of everything, in the band above the lane (drawn on the effects' canvas). */
export function paintStreaks(p: Painter, st: SceneState, n: number): void {
  if (st.low || st.reduced || !st.sheep.running) return;
  for (let i = 0; i < n; i++) {
    const len = 30 + hash2(i, 5) * 60, y = st.lane - 10 - hash2(i, 6) * 150, span = st.W + 200;
    p.r(wrap(hash2(i, 7) * span - st.scroll * 2.2, span) - 100, y, len, (hash2(i, 8) < 0.5 ? 1 : 2) * st.u, TOKEN.woolHi, 0.27);
  }
}
