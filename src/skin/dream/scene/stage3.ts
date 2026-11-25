import { LADDER } from '../../voxel/paint';
import { bpmOf, pulse, whole } from '../beat';
import { ART_GRIDS } from '../pixelArt';
import { hash01 } from '../starWords';
import { inBox, lantern, signPost } from './common';
import type { Brush, MoonAt } from './common';
import { hash2, wrap } from './painter';
import type { Painter } from './painter';
import { BEDDING, darker, lighter, mix, QUILT, STAGE_COLOURS, TOKEN, YARN } from './palette';
import { BOX } from './types';
import type { SceneFence, SceneMemory, SceneState } from './types';

/**
 * Stage 3, "Deep dream": under the quilt (docs/dream/05-stage-3-under-the-quilt.md). He is fast asleep, so the dream
 * is made of his bed: the hills are his quilt, the mountains his pillows, his red yarn sits on the hills with his
 * knitting needles, his candle is a lighthouse, and the stars are the buttons of his nightshirt, hanging on threads.
 * Every one of these things is in the bed strip below. Nothing here is cold. `ms` is the time since the second gate
 * opened (large once it is over). The finale adds one thing: the sheep you counted, crossing a swollen moon.
 */
const S = STAGE_COLOURS[3];
const [RED, CREAM, GREEN, MUSTARD, NAVY] = QUILT;
const HILL = QUILT.map((c) => mix(c, S.mid, 0.3)), HILL_TOP = HILL.map((c) => lighter(c, 0.18));
const FACE = QUILT.map((c) => mix(c, S.soil, 0.18)), FACE_TOP = FACE.map((c) => lighter(c, 0.2));
const C = {
  sheet: S.snow, fold: S.shade, stitch: TOKEN.wool, binding: mix(MUSTARD, S.soil, 0.2), tick: mix(BEDDING.nightshirt, S.rock, 0.55), tickBlue: mix(BEDDING.stripe, S.rock, 0.5), below: S.rock,
  pillow: mix(BEDDING.pillow, S.sky[3], 0.45), pillowShade: mix(BEDDING.pillow, S.sky[3], 0.6), stripe: mix(BEDDING.stripe, S.sky[3], 0.45),
  candle: mix(BEDDING.pillow, S.sky[3], 0.35), brass: mix(LADDER.brass[1], S.sky[3], 0.35), wood: LADDER.wood[1], woodDark: LADDER.darkWood[1], woodLit: LADDER.wood[3],
  needle: YARN.needle, knob: '#C9C1B6', page: CREAM, dim: mix(TOKEN.lantern, S.sky[2], 0.5),
} as const;
const BUTTON_COLOURS = [CREAM, MUSTARD, RED, TOKEN.woolHi] as const;
const ease = (k: number) => { const u = Math.min(1, Math.max(0, k)); return u * u * (3 - 2 * u); };

// ---------- button stars on threads: only here ----------

export interface Button { x: number; thread: number; grid: 0 | 1; colour: string; sway: number }
/** The buttons' fixed places for a night: 22 on a computer, 10 on a phone; threads 50 to 240 long, from the window's top. */
export function buttonsOf(st: SceneState): Button[] {
  const n = st.phone ? 10 : 22;
  return Array.from({ length: n }, (_, i) => ({
    x: (0.04 + (0.92 * (i + 0.2 + 0.6 * hash01(st.seed, 700 + i))) / n) * st.W,
    thread: (50 + hash01(st.seed, 730 + i) * 190) * Math.min(1, st.lane / 428),
    grid: (i % 2) as 0 | 1, colour: BUTTON_COLOURS[i % 4], sway: 3 + 2 * hash01(st.seed, 760 + i),
  }));
}
/**
 * A thread is shortened so that its button never hangs over the moon's disc or in the counters' row. Where the moon
 * leaves it no room at all (the finale's moon reaches the window's top) it is 0: that button is drawn up out of sight.
 */
export function threadFor(b: Button, moon: MoonAt, st: SceneState): number {
  const least = 64 * st.u + 20, dx = Math.abs(b.x - moon.cx), reach = moon.r + 18;
  let len = Math.max(b.thread, least);
  if (dx < reach) len = Math.min(len, moon.cy - Math.sqrt(reach * reach - dx * dx) - 12);
  return len < least ? 0 : len;
}
const GRIDS = [ART_GRIDS['button-2'].rows, ART_GRIDS['button-4'].rows] as const;
function buttons(p: Painter, st: SceneState, moon: MoonAt, ms: number): void {
  const list = buttonsOf(st), t = st.reduced ? 0 : st.t / 1000, beat = st.reduced ? -1 : whole(st.beats), since = st.reduced ? 1 : (st.beats - Math.floor(st.beats)) * (60 / bpmOf(3));
  list.forEach((b, i) => {
    // At the gate the brightest stars drop on threads, 30 ms apart: the thread draws down in 200, then the button turns in.
    const at = ms - 300 - i * 30, draw = Math.min(1, Math.max(0, at / 200));
    if (draw <= 0) return;
    const whole3 = threadFor(b, moon, st);
    if (whole3 <= 0) return;
    const len = whole3 * draw, a = st.low ? 0 : ((3 * Math.PI) / 180) * Math.sin((t / b.sway) * Math.PI * 2 + i);
    // On each beat one button in four flips (half of them in the finale): it narrows to a fifth and widens again in 160 ms.
    const flips = st.finale > 0 ? wrap(i + beat, 2) === 0 : wrap(i + beat, 4) === 0;
    const flip = beat >= 0 && flips && since < 0.16 ? 0.2 + 0.8 * Math.abs(1 - since / 0.08) : Math.min(1, Math.max(0.2, (at - 200) / 120));
    p.about(b.x, 0, a, () => {
      p.r(-0.5 * st.u, 0, 1 * st.u, len, TOKEN.wool, 0.27);
      if (at < 200) return;
      const rows = GRIDS[b.grid], cell = 2;
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') p.r((x - 3.5) * cell * flip, len + (y - 0.5) * cell, cell * flip + 0.4, cell, b.colour); }));
    });
  });
}

// ---------- the finale: the counted sheep cross the moon ----------

const SHEEP = ART_GRIDS['sheep-shadow'].rows;
function moonSheep(p: Painter, st: SceneState, moon: MoonAt): void {
  if (st.finale <= 0 || st.counted <= 0) return;
  const cell = Math.max(2, Math.round(moon.r / 75) * 2);
  const one = (s: number) => {
    // In at the moon's left edge and out at its right, along an arc that rises 0.62 of its radius: one long jump.
    if (s <= 0 || s >= 1) return;
    const x = moon.cx - moon.r * 0.92 + moon.r * 1.84 * s, y = moon.cy + moon.r * 0.3 - moon.r * 0.62 * Math.sin(Math.PI * s);
    SHEEP.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') p.r(x + (rx - 6) * cell, y + (ry - 4) * cell, cell, cell, TOKEN.ink); }));
  };
  if (st.reduced) { for (let k = 0; k < Math.min(4, st.counted); k++) one(0.2 + k * 0.2); return; }
  // Every beat one sets off, and is four beats crossing, so four or five are on the moon at a time, in a line. As he
  // goes out cold every sheep counted streams across, three to a beat.
  const rush = st.stream >= 0 && st.stream < 1500;
  if (rush) { for (let k = 0; k < st.counted; k++) one((st.stream - (k * 900) / Math.max(1, st.counted)) / 600); return; }
  for (let k = 0; k < 5; k++) one((st.beats - Math.floor(st.beats) + k) / 4);
  // Every fourth beat a shooting star: a 2 px head and a 40 px tail, half a second long.
  const b4 = Math.floor(st.beats / 4), since = (st.beats - b4 * 4) * (60 / bpmOf(3));
  if (since < 0.5) {
    const x = st.W * (0.1 + 0.7 * hash2(b4, 81)) + since * 420, y = st.lane * (0.1 + 0.3 * hash2(b4, 82)) + since * 150;
    p.r(x, y, 2 * st.u, 2 * st.u, TOKEN.woolHi);
    for (let k = 1; k <= 8; k++) p.r(x - k * 5, y - k * 1.8, 5, 1.5 * st.u, TOKEN.woolHi, 0.6 * (1 - k / 9));
  }
}

// ---------- pillow mountains and the candle (speed 0.1) ----------

export const PILLOWS = { speed: 0.1, gap: 520, tiers: 6, tier: 18 } as const;
function pillow(p: Painter, x: number, base: number, w: number, alpha: number): void {
  // Six stepped tiers, each 15% narrower than the one below; at its left end the pillowcase's four stripes.
  for (let i = 0, tw = w; i < PILLOWS.tiers; i++, tw *= 0.85) p.r(x + (w - tw) / 2, base - (i + 1) * PILLOWS.tier, tw, PILLOWS.tier, i === 0 ? C.pillowShade : C.pillow, alpha);
  for (let k = 0; k < 4; k++) p.r(x + 14 + k * 12, base - 30, 3, 30, C.stripe, alpha);
}
function pillows(p: Painter, st: SceneState, ms: number): void {
  const off = st.scroll * PILLOWS.speed, alpha = ease(ms / 600), base = st.lane, hit = st.reduced ? 0 : pulse(st.beats);
  for (let n = Math.floor((off - 400) / PILLOWS.gap); n <= Math.floor((off + st.W) / PILLOWS.gap); n++) {
    const x = n * PILLOWS.gap + hash2(n, 71) * 120 - off, w = (280 + hash2(n, 72) * 80) * (st.phone ? 1.25 : 1);
    if (wrap(n, 5) === 2) {
      // His candle, as a lighthouse: cream on a brass dish, a stepped teardrop of a flame, and a glow 80 across.
      const cx = x + w + 70, s = 1 + 0.15 * hit;
      p.disc(cx, base - 176, 40, TOKEN.lanternHi, (0.24 + 0.08 * hit) * alpha, 5);
      p.r(cx - 22, base - 8, 44, 8, C.brass, alpha);
      p.r(cx - 12, base - 160, 24, 152, C.candle, alpha);
      p.r(cx - 12, base - 160, 6, 152, C.pillow, alpha);
      for (const [w2, y, h] of [[10, 0, 8], [14, 8, 12], [10, 20, 8], [5, 28, 4]]) p.r(cx - (w2 * s) / 2, base - 162 - (y + h) * s, w2 * s, h * s, TOKEN.lanternHi, alpha);
    }
    pillow(p, x, base, w, alpha);
  }
}

// ---------- quilt hills, his yarn, his needles and a spool (speed 0.4) ----------

export const HILLS3 = { speed: 0.4, col: 48, patch: 22, period: 2400 } as const;
export function quiltHeight(col: number, phoneCol: number = HILLS3.col): number {
  const x = col * phoneCol;
  return Math.round((54 + 22 * Math.sin(x / 190 + 1) + 14 * Math.sin(x / 61)) / 12) * 12;
}
/** The colour of the patch in column `c`, row `r`: the five in turn, running in diagonals like a real quilt. */
export const patchOf = (c: number, r: number): number => wrap(c + 2 * r, QUILT.length);
function yarn(p: Painter, st: SceneState, cx: number, cy: number, across: number, k: number): void {
  // Wrap lines one way in the dark red and the other way in the light; on each beat it turns 30 degrees.
  const r = across / 2, turn = st.reduced ? 0 : (whole(st.beats) * Math.PI) / 6;
  p.disc(cx, cy, r, YARN.red, k, 4);
  for (let i = -2; i <= 2; i++) for (let s = -r * 0.8; s <= r * 0.8; s += 6) {
    const a = turn + 0.5, x = s * Math.cos(a) - i * 10 * Math.sin(a), y = s * Math.sin(a) + i * 10 * Math.cos(a);
    if (x * x + y * y < (r - 5) * (r - 5)) p.r(cx + x - 2, cy + y - 2, 5, 4, YARN.dark, k);
  }
  for (let i = -1; i <= 1; i++) for (let s = -r * 0.7; s <= r * 0.7; s += 7) {
    const a = turn - 0.9, x = s * Math.cos(a) - i * 14 * Math.sin(a), y = s * Math.sin(a) + i * 14 * Math.cos(a);
    if (x * x + y * y < (r - 6) * (r - 6)) p.r(cx + x - 2, cy + y - 1.5, 5, 3, YARN.light, k);
  }
}
function hills(p: Painter, st: SceneState, ms: number): void {
  const col = st.phone ? 36 : HILLS3.col, off = st.scroll * HILLS3.speed, c0 = Math.floor(off / col) - 1, c1 = Math.floor((off + st.W) / col) + 1;
  const top = (c: number) => quiltHeight(c, col);
  // Each column comes up 80 px from under the lane's line, 40 ms after the one to its left.
  const sink = (c: number) => 80 * (1 - ease((ms - (c - c0) * 40) / 500));
  const beat = st.reduced ? 0 : whole(st.beats), roll = st.low || st.reduced ? 0 : 4 * (beat % 6);
  for (let c = c0; c <= c1; c++) {
    const x = c * col - off, h = top(c), dy = sink(c);
    if (dy >= h + 20) continue;
    for (let r = 0; r * HILLS3.patch < h; r++) {
      const k = patchOf(c, r), ph = Math.min(HILLS3.patch, h - r * HILLS3.patch), y = st.lane - r * HILLS3.patch - ph + dy;
      if (y >= st.lane) continue;
      const hh = Math.min(ph - 2, st.lane - y);
      p.r(x + 1, y + 2, col - 2, hh, HILL[k]);
      p.r(x + 1, y, col - 2, Math.min(2, hh + 2), HILL_TOP[k]);
    }
    // On the hills, once in every 2,400 px: a large yarn ball trailing its strand, a small one, the needles, a spool.
    const at = wrap(c * col, HILLS3.period), yTop = st.lane - h + dy;
    if (ms < 700 || yTop > st.lane - 20) continue;
    if (at === 0) {
      for (let s = 12; s <= 150; s += 6) p.r(x + col / 2 - s - roll, st.lane - top(Math.floor((c * col + col / 2 - s) / col)) - 3, 6, 3, YARN.red);
      yarn(p, st, x + col / 2 + roll, yTop - 30, 68, 1);
    } else if (at === col * 12) yarn(p, st, x + col / 2 + roll, yTop - 23, 52, 1);
    else if (at === col * 25) {
      // Two needles stuck in a hill, crossed like an X; on every second beat the pair clicks, 6 degrees and back.
      const since = st.reduced ? 1 : (st.beats - Math.floor(st.beats / 2) * 2) * (60 / bpmOf(3)), click = since < 0.1 ? 6 * (1 - Math.abs(1 - since / 0.05)) : 0;
      for (const side of [-1, 1]) p.about(x + col / 2, yTop + 6, (side * (20 + click) * Math.PI) / 180, () => { p.r(-2.5, -160, 5, 160, C.needle); p.r(-6, -172, 12, 12, C.knob); });
    } else if (at === col * 38) {
      // A thread spool standing on end: two wooden ends, a body of quilt navy, four lighter thread lines across it.
      p.r(x + 4, yTop - 8, 40, 8, C.wood); p.r(x + 4, yTop - 60, 40, 8, C.wood);
      p.r(x + 9, yTop - 52, 30, 44, mix(NAVY, S.mid, 0.2));
      for (let k = 0; k < 4; k++) p.r(x + 9, yTop - 46 + k * 11, 30, 2, lighter(NAVY, 0.3));
    }
  }
}

// ---------- the lane: the turned-down sheet ----------

export const LANE3 = { sheet: 12, fold: 3, stitch: 6, face: 47, binding: 6, mattress: 32, patch: 96 } as const;
/**
 * The lane, wherever the quilt has rolled out: `front` is how far it has reached each way from where the gate stood
 * (art px; Infinity once it is over). Behind the front the top is the sheet, and each patch of the quilt's face flips
 * in from its top edge in 120 ms.
 */
function lane(p: Painter, st: SceneState, m: SceneMemory, ms: number): void {
  const L = st.lane, off = st.scroll, origin = m.front === null ? 0 : m.front - off, reach = m.front === null || ms > 1500 ? Infinity : (st.reduced ? Infinity : 1.6 * ms);
  const x0 = Math.max(0, origin - reach), x1 = Math.min(st.W, origin + reach);
  if (x1 <= x0) return;
  const w = x1 - x0, hit = st.reduced ? 0 : pulse(st.beats), y1 = L + LANE3.sheet + LANE3.fold;
  // Below: the mattress's ticking, and under it only the dark, with feathers falling through it.
  p.r(x0, y1 + LANE3.face + LANE3.binding + LANE3.mattress, w, st.H - y1, C.below);
  p.r(x0, y1 + LANE3.face + LANE3.binding, w, LANE3.mattress, C.tick);
  for (let x = Math.floor((x0 + off) / 14) * 14 - off; x < x1; x += 14) p.r(Math.max(x0, x + 11), y1 + LANE3.face + LANE3.binding, Math.min(3, x1 - x - 11), LANE3.mattress, C.tickBlue);
  p.r(x0, y1 + LANE3.face, w, LANE3.binding, C.binding);
  // The quilt's face: patches 96 wide with 2 px seams. The patch under the sheep is pressed in 3 px, the ones beside it 2.
  const under = Math.floor((off + st.sheep.x) / LANE3.patch);
  p.r(x0, y1, w, LANE3.face, TOKEN.ink, 0.5);
  for (let i = Math.floor((x0 + off) / LANE3.patch); i * LANE3.patch - off < x1; i++) {
    const x = i * LANE3.patch - off, k = wrap(i, QUILT.length), a = Math.max(x0, x + 1), b = Math.min(x1, x + LANE3.patch - 1);
    if (b <= a) continue;
    // Flipping in from its top edge as the front passes it.
    const since = reach === Infinity ? 1 : (reach - Math.abs(x + LANE3.patch / 2 - origin)) / 1.6 / 120, open = Math.min(1, Math.max(0, since));
    const press = st.sheep.lift > 0 || st.reduced ? 0 : i === under ? 3 : Math.abs(i - under) === 1 ? 2 : 0, h = (LANE3.face - press) * open;
    if (h <= 0) continue;
    p.r(a, y1 + press, b - a, h, FACE[k]);
    p.r(a, y1 + press, b - a, Math.min(2, h), FACE_TOP[k]);
  }
  // The sheet the sheep runs on, its fold, and the blanket stitch hanging from the fold: ticks every 12, nudged by the beat.
  p.r(x0, L, w, LANE3.sheet, C.sheet);
  p.r(x0, L + LANE3.sheet, w, LANE3.fold, C.fold);
  for (let x = Math.floor((x0 + off) / 12) * 12 - off; x < x1; x += 12) if (x >= x0) p.r(x, y1 + hit, 2, LANE3.stitch, C.stitch);
}

/** In front: feathers falling under the lane, and bedpost knobs along the window's bottom edge. */
function front(p: Painter, st: SceneState, ms: number): void {
  const a = Math.min(1, Math.max(0, (ms - 600) / 400)), n = st.low ? 16 : 34, top = st.lane + 112, t = st.reduced ? 0 : st.t / 1000, rows = ART_GRIDS.feather.rows;
  for (let i = 0; i < n && a > 0; i++) {
    const v = 12 + hash2(i, 91) * 12, span = Math.max(40, st.H - top), y = top + wrap(hash2(i, 92) * span + t * v, span);
    const x = wrap(hash2(i, 93) * st.W - st.scroll * 0.3, st.W) + 6 * Math.sin((t / (2 + hash2(i, 94))) * Math.PI * 2 + i), alpha = (i % 2 ? 0.47 : 0.31) * a;
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') p.r(x + rx * 2, y + ry * 2, 2, 2, TOKEN.woolHi, alpha); }));
  }
  if (st.low) return;
  // Bedpost knobs: a turned post with a round knob on top, one about every 900 px.
  const off = st.scroll * 1.5;
  for (let k = Math.floor(off / 900) - 1; k <= Math.floor((off + st.W) / 900) + 1; k++) {
    const x = k * 900 + hash2(k, 95) * 300 - off;
    p.r(x - 15, st.H - 22, 30, 24, TOKEN.ink, 0.7 * a);
    p.r(x - 19, st.H - 26, 38, 5, TOKEN.ink, 0.7 * a);
    p.disc(x, st.H - 44, 22, TOKEN.ink, 0.7 * a, 4);
  }
}

// ---------- obstacles: things from his bedroom ----------

function book(u: Brush, x: number, y: number, w: number, h: number, spine: string): void {
  u(x, y, w, h, spine);
  u(x + w - 7, y + 3, 7, h - 6, C.page);
  u(x + 8, y, 4, h, lighter(spine, 0.3));
  u(x, y, w, 2, darker(spine, 0.25));
}
export function paintObstacle3(p: Painter, st: SceneState, f: SceneFence): void {
  const W = BOX.w, H = BOX.h;
  signPost(p, st, f, C.woodDark, C.woodLit);
  inBox(p, st, f, (u) => {
    if (f.look === 'rail') {
      // A knitted fence: two short needles standing upright, five rows of knitting between them, red and cream.
      for (let r = 0; r < 5; r++) {
        const y = 6 + r * 15, col = r % 2 ? CREAM : RED;
        u(6, y, W - 12, 15, col);
        for (let x = 8; x < W - 10; x += 8) u(x, y + 3, 3, 9, darker(col, 0.18));
      }
      for (const x of [1, W - 6]) { u(x, 0, 5, H - 10, C.needle); u(x - 3, H - 12, 11, 11, C.knob); }
    } else if (f.look === 'picket') {
      // A stack of three books from his shelf: spines in quilt red, mustard and green, cream page edges.
      const bh = H / 3;
      book(u, 2, 0, W - 4, bh - 1, GREEN); book(u, 0, bh, W - 2, bh - 1, MUSTARD); book(u, 3, 2 * bh, W - 6, bh - 1, RED);
    } else if (f.look === 'wall') {
      // His alarm clock, standing on two books.
      book(u, 0, 0, W, 15, NAVY); book(u, 3, 16, W - 6, 15, RED);
      const cx = W / 2, cy = 31 + 30;
      for (const [dy, w] of [[-26, 34], [-20, 46], [-12, 54], [0, 58], [12, 54], [20, 46], [26, 34]]) u(cx - w / 2, cy + dy - (dy < 0 ? 8 : dy > 0 ? 0 : 6), w, dy === 0 ? 12 : 8, LADDER.tractorRed[1]);
      for (const [dy, w] of [[-16, 26], [-8, 36], [0, 40], [8, 36], [14, 26]]) u(cx - w / 2, cy + dy - 4, w, 8, CREAM);
      u(cx - 2, cy - 2, 4, 16, TOKEN.ink); u(cx - 2, cy - 2, 12, 4, TOKEN.ink);
      u(cx - 26, cy + 26, 16, 10, LADDER.brass[1]); u(cx + 10, cy + 26, 16, 10, LADDER.brass[1]); u(cx - 2, cy + 30, 4, 8, LADDER.brass[0]);
    } else if (f.look === 'log') {
      // Four thread spools on their sides, in four quilt colours.
      const sw = W / 2, sh = H / 2;
      [RED, MUSTARD, GREEN, NAVY].forEach((col, i) => {
        const x = (i % 2) * sw, y = Math.floor(i / 2) * sh;
        u(x + 1, y + 2, 7, sh - 4, C.wood); u(x + sw - 8, y + 2, 7, sh - 4, C.wood);
        u(x + 8, y + 7, sw - 16, sh - 14, col);
        for (let k = 0; k < 3; k++) u(x + 8, y + 12 + k * 9, sw - 16, 2, lighter(col, 0.3));
      });
    } else {
      // Cushions lying flat, one on another, in a striped pillowcase.
      const ch = H / 3;
      for (let r = 0; r < 3; r++) {
        const x = r === 1 ? 4 : 0, w = W - 4;
        u(x + 4, r * ch, w - 8, ch - 2, BEDDING.pillow); u(x, r * ch + 4, w, ch - 10, BEDDING.pillow);
        for (let k = 0; k < 4; k++) u(x + 12 + k * 14, r * ch, 3, ch - 2, BEDDING.stripe);
        u(x + 4, r * ch, w - 8, 3, mix(BEDDING.pillow, S.rock, 0.3));
      }
    }
  });
  if (f.tilt <= 0.001) { lantern(p, f.x - 2, st.lane - H - 12, f.lit, C.dim); lantern(p, f.x + W - 4, st.lane - H - 12, f.lit, C.dim); }
}

/** The second gate (05, section 1): the footboard of his bed, grown huge. Two turned posts with knobs, a rail, a banner. */
export function paintGate2(p: Painter, st: SceneState, x: number, lit: boolean): void {
  const tall = st.sheep.w * 0.62 * 3.2, L = st.lane, w = 170;
  for (const side of [-1, 1]) {
    const px = x + (side * w) / 2;
    p.r(px - 9, L - tall, 18, tall, C.woodDark); p.r(px + 3, L - tall, 4, tall, C.wood);
    p.r(px - 12, L - tall * 0.5, 24, 10, C.wood); p.r(px - 12, L - 14, 24, 14, C.woodDark);
    // The knobs light as the sheep goes under.
    if (lit) p.disc(px, L - tall - 12, 24, TOKEN.lanternHi, 0.24, 4);
    p.disc(px, L - tall - 12, 15, lit ? C.woodLit : C.wood, 1, 3);
  }
  p.r(x - w / 2, L - tall + 12, w, 16, C.wood); p.r(x - w / 2, L - tall + 12, w, 4, C.woodLit);
  // The banner: an ink tag with his yarn on it.
  p.r(x - 30, L - tall + 34, 60, 30, TOKEN.ink);
  p.disc(x, L - tall + 49, 10, YARN.red, 1, 2); p.r(x - 6, L - tall + 46, 12, 2, YARN.dark); p.r(x - 4, L - tall + 52, 9, 2, YARN.dark);
}

/** Stage 3's sky things: the buttons on their threads, and in the finale the sheep crossing the moon (drawn over it). */
export function paintButtons3(p: Painter, st: SceneState, moon: MoonAt, ms: number): void { buttons(p, st, moon, ms); }
export function paintMoonSheep(p: Painter, st: SceneState, moon: MoonAt): void { moonSheep(p, st, moon); }
/** What of stage 3 stands behind the lane: the pillow mountains with the candle, then the quilt hills. */
export function paintBack3(p: Painter, st: SceneState, ms = 1e6): void { pillows(p, st, ms); hills(p, st, ms); }
/** The lane and what is in front of it. */
export function paintLane3(p: Painter, st: SceneState, m: SceneMemory, ms = 1e6): void { lane(p, st, m, ms); front(p, st, ms); }
export const STAGE3 = { shadow: mix(S.snow, S.soil, 0.4), C, HILL, FACE } as const;
