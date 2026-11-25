import { LADDER } from '../../voxel/paint';
import { pulse, whole } from '../beat';
import { signPost } from './common';
import type { Brush } from './common';
import { hash2, wrap } from './painter';
import type { Painter } from './painter';
import { darker, lighter, mix, STAGE_COLOURS, TOKEN } from './palette';
import { barn, bulb, bulbLit, coop, FARM, farmColours, farmhouse, HOUSE, obstacle, obstacleColours, pine, pond, silo } from './stage1';
import { BOX } from './types';
import type { SceneFence, SceneMemory, SceneState } from './types';

/**
 * Stage 2, "Dreaming": the farm lifts off (docs/dream/04-the-farm-lifts-off.md). The ground lets go: the same barn, the
 * same farmhouse and the same string of bulbs are in the air, each building on its own island, under a full moon and
 * the northern light. The lane is a floating island with icicles under its lip, over streaks of mist. `inn` is how far
 * the first gate has brought it in (0 to 1 over 900 ms, `ms` since the gate), `out` how far the second has taken it away.
 */
const S = STAGE_COLOURS[2];
const tint = (hex: string) => mix(hex, S.sky[2], 0.5);
const B = farmColours(tint, S.snow, S.shade, mix(S.shade, S.sky[3], 0.3));
const ICE = LADDER.ice[3];
const O = obstacleColours((h) => mix(h, ICE, 0.42), S.snow, mix(TOKEN.lantern, S.sky[2], 0.5));
const C = {
  isleSnow: tint(S.snow), isleSoil: tint(S.soil), isleSoil2: tint(S.soil2), isleRock: tint(S.rock),
  clod: darker(S.mid, 0.1), snow: S.snow, shade: S.shade, soil: S.soil, soil2: S.soil2, stone: mix(S.soil2, '#9A90B8', 0.35), rock: S.rock, rockTop: lighter(S.rock, 0.14),
  root: LADDER.darkWood[1], below: S.sky[1], mist: S.mist, bulbOff: mix(TOKEN.lantern, S.sky[2], 0.5), ice: ICE, iceTip: mix(ICE, S.shade, 0.5),
} as const;
const NORTHERN = S.northernLight;
const ease = (k: number) => { const u = Math.min(1, Math.max(0, k)); return u * u * (3 - 2 * u); };

/** The northern light (section 3): bars 6 wide and 2 apart across the middle 52% of the sky, waving, and only here. */
export function northernBar(x: number, t: number): { top: number; h: number } {
  return { top: 250 - 26 * Math.sin(x / 120), h: 46 + 30 * Math.sin(x / 70 + t) + 16 * Math.sin(x / 23 - 1.7 * t) };
}
function northern(p: Painter, st: SceneState, grow: number): void {
  if (grow <= 0) return;
  const pitch = st.low ? 16 : 8, t = st.reduced ? 0 : st.t / 1000, k = st.lane / 428, hit = st.reduced ? 0 : pulse(st.beats);
  const x0 = st.W * (st.phone ? 0.2 : 0.24), x1 = st.W * (st.phone ? 0.8 : 0.76);
  for (let x = x0; x < x1; x += pitch) {
    const b = northernBar(x, t), h = b.h * grow * (1 + 0.2 * hit), top = b.top * k, a = (x - x0) / (x1 - x0);
    // The colour runs along the row: green, then blue, then violet.
    const col = a < 0.5 ? mix(NORTHERN[0], NORTHERN[1], Math.round(a * 2 * 8) / 8) : mix(NORTHERN[1], NORTHERN[2], Math.round((a - 0.5) * 2 * 8) / 8);
    p.r(x, top, 6, Math.min(5, h), col, 0.8);
    if (h > 5) p.r(x, top + 5, 6, h - 5, col, 0.37);
  }
}

// ---------- the farm, in the air (speed 0.12) ----------

export const ISLES = { speed: 0.12, gap: 470, kinds: ['barn', 'windmill', 'farmhouse', 'coop', 'pond'] as const, tops: { barn: 140, windmill: 150, farmhouse: 130, coop: 90, pond: 120 } } as const;
type Isle = (typeof ISLES.kinds)[number];
/** The stepped rows under an island's soil, as shares of its top's width. */
export const ISLE_ROWS = [0.86, 0.66, 0.5, 0.3, 0.14] as const;
/** How high an island's top floats over the lane (art px, at rest), by which island it is along the strip. */
export const isleLift = (n: number, lane: number): number => Math.round(lane * (0.24 + 0.2 * hash2(n, 21)));

function isle(p: Painter, st: SceneState, kind: Isle, x: number, top: number, alpha: number): void {
  const w = ISLES.tops[kind];
  const up = (s: number, ox = 0): Brush => (bx, by, bw, bh, col, a = 1) => p.r(x + ox + bx * s, top - (by + bh) * s, bw * s, bh * s, col, a * alpha);
  if (kind === 'barn') { barn(up(0.5, 8), B); silo(up(0.5, 98), 8, B); }
  else if (kind === 'farmhouse') {
    // His bedroom window still glows, and still breathes with him.
    p.disc(x + 6 + (HOUSE.window[0] + 17) * 0.55, top - (HOUSE.window[1] + 18) * 0.55, 20, TOKEN.lanternHi, (0.24 + 0.08 * st.breath) * alpha, 4);
    farmhouse(up(0.55, 6), st, B);
    pine(up(1, 100), 0, 44, B.pine, B.trunk, B.roofSnow);
  } else if (kind === 'coop') coop(up(0.72, 12), B);
  else if (kind === 'pond') {
    pond(up(0.74, 8), B);
    // Mist spills off one edge: five thin streaks falling 60 px and fading.
    for (let i = 0; i < 5; i++) { const f = wrap((st.reduced ? 0 : st.t / 1400) + i * 0.2, 1); p.r(x + w - 6 + i * 3, top + 8 + f * 60, 2, 12, C.mist, 0.5 * (1 - f) * alpha); }
  } else {
    // The windmill: its blades now turn smoothly, one turn every four beats.
    const u = up(1, 0), hx = w / 2, hy = 78, a = st.reduced ? 0.4 : (st.beats / 4) * Math.PI * 2;
    u(hx - 14, 0, 28, 70, B.mill); u(hx - 17, 70, 34, 6, B.stoneDark); u(hx - 5, 0, 10, 16, B.roofDark);
    for (let b = 0; b < 4; b++) for (let k = 6; k <= 48; k += 6) { const ang = a + (b * Math.PI) / 2; u(hx + Math.cos(ang) * k - 3, hy + Math.sin(ang) * k - 3, 6, 6, B.mill); }
  }
  // Every island is built the same way: a snow top overhanging the soil, five stepped rows, and three clods trailing.
  p.r(x - 3, top, w + 6, 8, C.isleSnow, alpha);
  p.r(x, top + 8, w, 10, C.isleSoil, alpha);
  ISLE_ROWS.forEach((share, i) => p.r(x + (w - w * share) / 2 + w * 0.06 * (i + 1), top + 18 + i * 8, w * share, 8, i < 2 ? C.isleSoil2 : C.isleRock, alpha));
  const tip = x + w / 2 + w * 0.36;
  [10, 8, 6].forEach((cw, j) => p.r(tip + 22 * (j + 1), top + 58 + 10 * (j + 1), cw, 8, C.isleRock, alpha));
}
/** Where stage 1's building that an island carries stands in the farm's strip (its left edge). */
const HOME: Partial<Record<Isle, number>> = { barn: FARM.barn, farmhouse: FARM.house, coop: FARM.coop, pond: FARM.pond };
/**
 * As the first gate opens: where the islands' strip must start so that an island rises from where its own building
 * stands on the farm, for whichever building is nearest the middle of the window.
 */
export function alignIsles(st: SceneState): number {
  const period = ISLES.gap * ISLES.kinds.length, farmOff = st.scroll * FARM.speed;
  let best = { d: Infinity, phase: 0 };
  ISLES.kinds.forEach((kind, i) => {
    const home = HOME[kind];
    if (home === undefined) return;
    const sx = wrap(home - farmOff, FARM.period), d = Math.abs(sx - st.W / 2);
    if (sx < st.W && d < best.d) best = { d, phase: sx - (i * ISLES.gap - st.scroll * ISLES.speed) };
  });
  return wrap(best.phase, period);
}
function isles(p: Painter, st: SceneState, m: SceneMemory, ms: number, out: number): void {
  const period = ISLES.gap * ISLES.kinds.length, off = st.scroll * ISLES.speed - (m.isles ?? 0), t = st.reduced ? 0 : st.t / 1000;
  const first = Math.floor((off - 200) / ISLES.gap), last = Math.floor((off + st.W) / ISLES.gap), beat = st.reduced ? 0 : whole(st.beats), hit = st.reduced ? 0 : pulse(st.beats);
  void period;
  for (let n = first; n <= last; n++) {
    const kind = ISLES.kinds[wrap(n, ISLES.kinds.length)], x = n * ISLES.gap - off;
    // It rises from the farm's ground to its floating height, one island after another; then it drifts 3 px by
    // itself, and dips 4 px on its own beats. At the second gate it sinks 40 px and fades into a pillow.
    const rise = ease((ms - wrap(n, 3) * 80) / 900), rest = st.lane - isleLift(n, st.lane);
    const drift = 3 * Math.sin((t / (7 + 3 * hash2(n, 22))) * Math.PI * 2 + n) + (wrap(n + beat, 2) === 0 ? 4 * hit : 0);
    const top = Math.max(70 + 100, st.lane - FARM.band + (rest - (st.lane - FARM.band)) * rise) + drift * rise + 40 * ease(out / 0.6);
    isle(p, st, kind, x, top, Math.min(1, ms / 300) * (1 - ease(out / 0.6)));
  }
}

// ---------- fence pieces and pines on clods (speed 0.4), and the string of bulbs, floating free (speed 0.8) ----------

function clods(p: Painter, st: SceneState, inn: number, out: number): void {
  const off = st.scroll * 0.4, alpha = inn, drop = 500 * out * out, t = st.reduced ? 0 : st.t / 1000;
  for (let n = Math.floor(off / 150) - 1; n <= Math.floor((off + st.W) / 150) + 1; n++) {
    const x = n * 150 + hash2(n, 31) * 60 - off, y = st.lane - 60 - hash2(n, 32) * 60 + drop;
    const draw = (u: Brush) => {
      u(-22, -8, 44, 8, C.clod); u(-13, -16, 26, 8, C.clod);
      if (wrap(n, 2)) { u(-16, 0, 5, 22, C.clod); u(11, 0, 5, 22, C.clod); u(-18, 12, 36, 5, C.clod); }
      else pine(u, -10, 40, C.clod, C.clod);
    };
    // Each tilts 3 degrees each way, over 5 to 8 s.
    const tilt = st.low ? 0 : ((3 * Math.PI) / 180) * Math.sin((t / (5 + 3 * hash2(n, 33))) * Math.PI * 2 + n);
    if (tilt) p.about(x, y, tilt, () => draw((bx, by, w, h, col, a = 1) => p.r(bx, -by - h, w, h, col, a * alpha)));
    else draw((bx, by, w, h, col, a = 1) => p.r(x + bx, y - by - h, w, h, col, a * alpha));
  }
}
/** The string's height over the lane at `x` along it: a slow wave travelling along, `amp` high. */
export const stringY = (x: number, t: number, amp: number): number => -46 + amp * Math.sin(x / 90 - 1.2 * t);
function bulbString(p: Painter, st: SceneState, inn: number, out: number): void {
  // Its wave grows from nothing at the first gate; at the second it drifts up out of the window.
  const off = st.scroll * 0.8, t = st.reduced ? 0 : st.t / 1000, amp = 14 * inn, lift = out > 0 ? (st.lane + 80) * ease(out / 0.4) : 0;
  if (lift >= st.lane + 60) return;
  for (let i = Math.floor(off / 16) - 1; i <= Math.floor((off + st.W) / 16) + 1; i++) {
    const wx = i * 16, x = wx - off, y = st.lane + stringY(wx, t, amp) - lift, y2 = st.lane + stringY(wx + 16, t, amp) - lift;
    p.r(x, y, 8, 1.5, TOKEN.ink); p.r(x + 8, (y + y2) / 2, 8, 1.5, TOKEN.ink);
    bulb(p, x - 2, y + 1, i, st.reduced ? wrap(i, 4) === 0 : bulbLit(i, st.beats), st.festive, C.bulbOff);
  }
}

// ---------- the lane: a floating island ----------

export const LANE2 = { top: 12, lip: 4, soil: 24, soil2: 22 } as const;
/** How deep the rock hangs under the soil at `x` along the lane: one stepped profile, in 8 px steps, never under 8. */
export const rockDepth = (x: number): number => Math.max(8, Math.floor((34 + 22 * Math.sin(x / 150) + 14 * Math.sin(x / 47 + 1.3) + 8 * Math.sin(x / 19)) / 8) * 8);
const ICICLES = [[8, 9], [30, 15], [52, 6], [74, 12]] as const;
function lane(p: Painter, st: SceneState, inn: number, ms: number, out: number): void {
  const L = st.lane, W = st.W, off = st.scroll;
  // The mist: streaks only, never cloud shapes, drifting slowly, down to the window's bottom.
  p.r(0, L + LANE2.top, W, st.H - L, C.below, inn);
  for (let i = 0; i < (st.low ? 24 : 46); i++) {
    const len = 60 + hash2(i, 41) * 220, y = L + 70 + hash2(i, 42) * (st.H - L - 80), span = W + 320;
    p.r(wrap(hash2(i, 43) * span - st.scroll * 0.2, span) - 300, y, len, (hash2(i, 44) < 0.5 ? 2 : 3), C.mist, (0.27 + 0.23 * hash2(i, 45)) * inn * (1 - out));
  }
  // Under the track the soil and the rock grow downward as the island forms; the icicles grow last.
  const depth = inn, ice = Math.min(1, Math.max(0, (ms - 700) / 200)) * (1 - ease(out / 0.5));
  const s1 = LANE2.soil * depth, s2 = LANE2.soil2 * depth, y1 = L + LANE2.top + LANE2.lip;
  for (let x = -wrap(off, 8); x < W; x += 8) {
    const d = rockDepth(x + off) * depth;
    p.r(x, y1 + s1 + s2, 8, d, C.rock, 1 - out);
    p.r(x, y1 + s1 + s2, 8, Math.min(4, d), C.rockTop, 1 - out);
  }
  p.r(0, y1, W, s1, C.soil, 1 - out);
  p.r(0, y1 + s1, W, s2, C.soil2, 1 - out);
  if (depth > 0.5) for (let k = Math.floor(off / 96) - 1; k <= Math.floor((off + W) / 96) + 1; k++) {
    // A stone in the lower soil every 96, each second one 6 lower; a root every 260.
    p.r(k * 96 + 40 - off, y1 + s1 + 4 + (wrap(k, 2) ? 6 : 0), 14, 10, C.stone, 1 - out);
  }
  if (depth >= 1 && out === 0) for (let k = Math.floor(off / 260) - 1; k <= Math.floor((off + W) / 260) + 1; k++) {
    const x = k * 260 + 120 - off, y = y1 + s1 + s2;
    p.r(x, y, 4, 30, C.root); p.r(x + 3, y + 30, 4, 26, C.root);
  }
  // The snow top the sheep runs on, and its lip, overhanging the soil.
  p.r(0, L, W, LANE2.top, C.snow);
  p.r(0, L + LANE2.top, W, LANE2.lip, C.shade);
  if (ice > 0) for (let k = Math.floor(off / 96) - 1; k <= Math.floor((off + W) / 96) + 1; k++) for (const [at, long] of ICICLES) {
    // Icicles under the lip, tapering in thirds, snow with a shaded tip.
    const x = k * 96 + at - off, h = long * ice, y = y1;
    p.r(x, y, 5, h / 3, C.snow); p.r(x + 1, y + h / 3, 3, h / 3, C.snow); p.r(x + 2, y + (2 * h) / 3, 1.5, h / 3, C.shade);
  }
}

/** In front of the lane: snow drifting upward, and dark rocks floating along the window's bottom edge. */
function front(p: Painter, st: SceneState, inn: number, ms: number, out: number): void {
  // Rising snow: 40 flakes, each with a 4 px tail under it, from the moment the falling snow has turned round.
  const a = Math.min(1, Math.max(0, (ms - 450) / 300)) * (1 - Math.min(1, out / 0.3)), n = st.low ? 18 : 40;
  for (let i = 0; i < n && a > 0; i++) {
    const v = 20 + hash2(i, 51) * 20, y = st.H - wrap(hash2(i, 52) * st.H + (st.reduced ? 0 : (st.t / 1000) * v), st.H), x = wrap(hash2(i, 53) * st.W - st.scroll * 0.15, st.W);
    p.r(x, y, 2 * st.u, 2 * st.u, TOKEN.woolHi, 0.75 * a);
    p.r(x, y + 2 * st.u, 2 * st.u, 4 * st.u, TOKEN.woolHi, 0.24 * a);
  }
  if (st.low) return;
  // Floating rocks, one about every 700 px, each turning slowly, 4 degrees each way over 6 s.
  const off = st.scroll * 1.5, t = st.reduced ? 0 : st.t / 1000;
  for (let k = Math.floor(off / 700) - 1; k <= Math.floor((off + st.W) / 700) + 1; k++) {
    const x = k * 700 + hash2(k, 61) * 300 - off, tall = 34 + hash2(k, 62) * 26;
    p.about(x, st.H, ((4 * Math.PI) / 180) * Math.sin((t / 6) * Math.PI * 2 + k), () => {
      p.r(-40, -tall * 0.5, 80, tall * 0.5 + 6, TOKEN.ink, 0.7 * inn * (1 - out));
      p.r(-26, -tall * 0.8, 52, tall * 0.3, TOKEN.ink, 0.7 * inn * (1 - out));
      p.r(-12, -tall, 26, tall * 0.2, TOKEN.ink, 0.7 * inn * (1 - out));
    });
  }
}

/** One of stage 2's obstacles: the farm's thing, iced over, with icicles under it. It stands on the lane; it does not float. */
export function paintObstacle2(p: Painter, st: SceneState, f: SceneFence): void {
  signPost(p, st, f, O.post, O.postLit);
  obstacle(p, st, f, O, false, (u) => {
    // A crust of ice on top, and a row of icicles hanging from it.
    u(-2, BOX.h - 3, BOX.w + 4, 5, C.ice);
    for (let i = 0; i < 5; i++) { const x = 4 + i * ((BOX.w - 12) / 4), long = [9, 15, 6, 12, 8][i]; u(x, BOX.h - 3 - long * 0.6, 4, long * 0.6, C.ice); u(x + 1, BOX.h - 3 - long, 2, long * 0.4, C.iceTip); }
  });
}
/** Three white lines behind the sheep's body (stages 2 and 3): wool streaks. */
export function woolStreaks(p: Painter, st: SceneState): void {
  if (st.reduced || !st.sheep.running) return;
  const x = st.sheep.x - st.sheep.w * 0.5, y = st.lane - st.sheep.lift - 78;
  p.r(x - 44, y, 44, 3, TOKEN.woolHi, 0.43); p.r(x - 60, y + 22, 52, 3, TOKEN.woolHi, 0.31); p.r(x - 42, y + 44, 40, 3, TOKEN.woolHi, 0.24);
}

/** Stage 2's sky things, behind everything of the world: the northern light. `ms` since the first gate. */
export function paintSky2(p: Painter, st: SceneState, ms: number, out: number): void {
  northern(p, st, Math.min(1, Math.max(0, (ms - 600) / 600)) * (1 - Math.min(1, out / 0.4)));
}
/** Everything of stage 2 behind the sheep. `ms` is the time since the first gate opened (large once it is over). */
export function paintStage2(p: Painter, st: SceneState, m: SceneMemory, ms = 1e6, out = 0): void {
  const inn = ease(ms / 900);
  isles(p, st, m, ms, out);
  clods(p, st, inn, out);
  bulbString(p, st, inn, out);
  lane(p, st, inn, ms, out);
  front(p, st, inn, ms, out);
}
export const STAGE2 = { shadow: mix(S.snow, S.sky[2], 0.45), C } as const;
