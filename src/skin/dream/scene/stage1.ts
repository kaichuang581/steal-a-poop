import { LADDER } from '../../voxel/paint';
import { bpmOf, whole } from '../beat';
import { inBox, lantern, signPost } from './common';
import type { Brush } from './common';
import { hash2, wrap } from './painter';
import type { Painter } from './painter';
import { darker, lighter, mix, STAGE_COLOURS, TOKEN } from './palette';
import { BOX } from './types';
import type { SceneFence, SceneMemory, SceneState } from './types';

/**
 * Stage 1, "Dozing off": his own farm on a snowy night (docs/dream/03-stage-1-his-own-farm.md). Everything is in its
 * real place and nothing is strange yet. Back to front: far hills with the windmill, the farm on its ground, the plank
 * fence with its string of bulbs, the snowy track, and in front of it a field in shadow with a dry-stone wall. `out`
 * is how far the first gate has taken it away, 0 to 1 over the gate's 900 ms (04, section 1).
 */
const S = STAGE_COLOURS[1];
const F = (hex: string) => mix(hex, S.mid, 0.35);
const FIELD_C = mix(S.snow, S.sky[2], 0.62);
/**
 * The farm's own colours, set back into a stage's night by `tint`: stage 1 mixes each 35% toward its `mid`; stage 2,
 * whose islands carry the same buildings, 50% toward its sky.
 */
export function farmColours(tint: (hex: string) => string, snow: string, shade: string, smoke: string) {
  return {
    barn: tint(LADDER.barnRed[2]), barnDark: tint(LADDER.barnRed[0]), trim: tint(LADDER.trimWhite[3]), roofSnow: tint(snow), roofSnowShade: tint(shade),
    stone: tint(LADDER.stone[2]), stoneDark: tint(LADDER.stone[0]), pine: tint(LADDER.pine[1]), pineDark: tint(LADDER.pine[0]), trunk: tint(LADDER.darkWood[1]),
    house: tint(LADDER.houseCream[2]), houseDark: tint(LADDER.houseCream[0]), roof: tint(LADDER.roofBrown[1]), roofDark: tint(LADDER.roofBrown[0]),
    straw: tint(LADDER.straw[2]), hay: tint(LADDER.hay[2]), hayDark: tint(LADDER.hay[0]), wood: tint(LADDER.wood[1]), darkWood: tint(LADDER.darkWood[1]),
    coop: tint(LADDER.coopYellow[2]), coopDark: tint(LADDER.coopYellow[0]), ice: tint(LADDER.ice[2]), reed: tint(LADDER.reed[1]), smoke, mill: tint(LADDER.trimWhite[2]),
  };
}
export type FarmColours = ReturnType<typeof farmColours>;
const B = farmColours(F, S.snow, S.shade, mix(S.shade, S.sky[3], 0.2));
/** What an obstacle on the lane is made of: the farm's things in stage 1, the same iced over in stage 2. */
export function obstacleColours(tint: (hex: string) => string, snow: string, dim: string) {
  return {
    post: tint(LADDER.darkWood[1]), postLit: tint(LADDER.darkWood[3]), rail: tint(LADDER.wood[0]), snow, bulbOff: dim,
    brick: tint(LADDER.barnRed[1]), brickDark: tint(LADDER.barnRed[0]), mortar: tint(LADDER.trimWhite[0]), log: tint(LADDER.wood[1]), logEnd: tint(LADDER.wood[4]), logRing: tint(LADDER.wood[2]),
    bale: tint(LADDER.hay[2]), baleDark: tint(LADDER.hay[0]), twine: tint(LADDER.darkWood[2]),
  };
}
export type ObstacleColours = ReturnType<typeof obstacleColours>;
const O = obstacleColours((h) => h, S.snow, mix(TOKEN.lantern, S.sky[2], 0.5));
const C = {
  ...B, ...O, shade: S.shade,
  far: S.far, farPine: darker(S.far, 0.15), mill: mix(LADDER.trimWhite[2], S.far, 0.4),
  ground: mix(S.snow, S.mid, 0.55),
  field: FIELD_C, ridge: mix(FIELD_C, S.snow, 0.35), furrow: mix(FIELD_C, S.sky[1], 0.35),
  wallStone: mix(LADDER.stone[2], S.sky[1], 0.55), wallStoneDark: mix(LADDER.stone[0], S.sky[1], 0.6), wallSnow: mix(S.snow, S.sky[2], 0.3),
} as const;
const FESTIVE_BULBS = ['#F07A5A', '#9CCB78', '#FFD08A'] as const;
const easeIn = (k: number) => k * k;

/** A pine: a trunk and stepped tiers, with a snow row on each tier when `snow` is given. */
export function pine(u: Brush, x: number, h: number, col: string, trunk: string, snow?: string): void {
  const w = Math.round(h * 0.52), tiers = h > 80 ? 4 : 3, th = (h - 8) / tiers;
  u(x + w / 2 - 3, 0, 6, 9, trunk);
  for (let k = 0; k < tiers; k++) {
    const tw = w * (1 - k / (tiers + 0.7)), y = 8 + k * th, a = Math.round(th * 0.55);
    u(x + (w - tw) / 2, y, tw, a, col);
    u(x + (w - tw * 0.62) / 2, y + a, tw * 0.62, th - a + 1, col);
    if (snow) { u(x + (w - tw) / 2, y + a - 3, (tw - tw * 0.62) / 2 + 2, 3, snow); u(x + (w + tw * 0.62) / 2 - 2, y + a - 3, (tw - tw * 0.62) / 2 + 2, 3, snow); }
  }
  if (snow) u(x + w / 2 - 3, h - 3, 6, 3, snow);
}

/** The far hills (speed 0.08): columns 60 wide, a pine on each, and once every 2,400 px the farm's windmill on a hilltop. */
export function hillHeight(col: number): number {
  const x = col * 60;
  return Math.round((60 + 30 * Math.sin(x / 210) + 18 * Math.sin(x / 67)) / 12) * 12;
}
function hills(p: Painter, st: SceneState, out: number): void {
  // At the first gate the hills drop 120 px and fade into the mist.
  const off = st.scroll * 0.08, drop = 120 * easeIn(out), alpha = 1 - out, c0 = Math.floor(off / 60) - 1, c1 = Math.floor((off + st.W) / 60) + 1;
  if (alpha <= 0) return;
  for (let c = c0; c <= c1; c++) {
    const x = c * 60 - off, h = hillHeight(c), base = st.lane + drop, u: Brush = (bx, by, w, hh, col, a = 1) => p.r(x + bx, base - by - hh, w, hh, col, a * alpha);
    if (wrap(c, 40) === 9) {
      // The windmill: a tower 18 x 46 and four blades 34 long, stepping an eighth of a turn on each beat.
      u(21, h, 18, 46, C.mill);
      u(19, h + 46, 22, 5, C.farPine);
      const hx = 30, hy = h + 40, turned = !st.reduced && whole(st.beats) % 2 === 1;
      if (!turned) { u(hx - 34, hy - 2, 68, 5, C.mill); u(hx - 2, hy - 34, 5, 68, C.mill); }
      else for (let k = 4; k <= 24; k += 4) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) u(hx + sx * k - 2, hy + sy * k - 2, 5, 5, C.mill);
    } else if (!st.low) pine(u, 16 + Math.round(hash2(c, 3) * 14), h + 22 + Math.round(hash2(c, 4) * 18), C.farPine, C.farPine);
    u(0, 0, 60, h, C.far);
  }
}

// ---------- the farm (speed 0.35): one strip 2,400 long that repeats ----------

export const FARM = { period: 2400, speed: 0.35, band: 30, barn: 70, silo: 250, pines: [430, 500], house: 700, scarecrow: 990, bales: 1170, coop: 1380, pond: 1600, trees: [1870, 1940, 2010] } as const;
/** The farmhouse's own numbers: stage 2's island carries the same house, and the chimney and the window move with it. */
export const HOUSE = { w: 160, h: 92, roof: 50, chimney: [112, 16, 40], window: [28, 30, 34, 36] } as const;

export function barn(u: Brush, C: FarmColours = B): void {
  u(0, 0, 180, 120, C.barn);
  for (let x = 0; x < 180; x += 30) u(x, 0, 3, 120, C.barnDark, 0.35);
  // A snow roof 56 high, stepped; its eave overhangs.
  for (let i = 0; i < 7; i++) u(-10 + i * 14, 120 + i * 8, 200 - i * 28, 8, i === 0 ? C.roofSnowShade : C.roofSnow);
  // The white X doors, 52 x 62.
  u(64, 0, 52, 62, C.trim);
  u(68, 4, 44, 54, C.barnDark);
  for (let k = 0; k < 11; k++) { u(68 + k * 4, 4 + k * 4.9, 5, 6, C.trim); u(108 - k * 4, 4 + k * 4.9, 5, 6, C.trim); }
  u(88, 4, 4, 54, C.trim);
}
export function silo(u: Brush, lean = 0, C: FarmColours = B): void {
  for (let y = 0; y < 150; y += 10) u(lean * (y / 150), y, 50, 10, y % 30 === 20 ? C.stoneDark : C.stone);
  // A round snow cap, stepped.
  u(lean - 2, 150, 54, 8, C.roofSnow); u(lean + 5, 158, 40, 8, C.roofSnow); u(lean + 14, 166, 22, 6, C.roofSnow);
}
export function farmhouse(u: Brush, st: SceneState, C: FarmColours = B): void {
  const H = HOUSE;
  u(0, 0, H.w, H.h, C.house);
  u(0, 0, H.w, 6, C.houseDark);
  // A chimney, and every second beat a puff from it, rising 60 px over 1.6 s as it grows from 14 to 22 across.
  u(H.chimney[0], H.h + 14, H.chimney[1], H.chimney[2], C.roofDark);
  if (!st.reduced) {
    const perBeat = 60 / bpmOf(st.stage), even = Math.floor(st.beats / 2) * 2;
    for (const b of [even, even - 2]) {
      const age = (st.beats - b) * perBeat;
      if (b < 0 || age > 1.6) continue;
      const k = age / 1.6, s = 14 + 8 * k;
      const x = H.chimney[0] + 8 - s / 2 + 6 * k, y = H.h + 54 + 60 * k, a = 0.7 * (1 - k);
      u(x + 4, y, s - 8, s, C.smoke, a); u(x, y + 4, s, s - 8, C.smoke, a);
    }
  }
  // A gable roof 50 high, snow on its left slope.
  for (let i = 0; i < 5; i++) {
    const w = H.w + 16 - i * 34, x = -8 + i * 17;
    u(x, H.h + i * 10, w, 10, C.roof);
    u(x, H.h + i * 10, w / 2 - 4, 10, C.roofSnow);
  }
  // His bedroom window: the only lit window on the farm. Its glow rises and falls with his breath.
  const [wx, wy, ww, wh] = H.window;
  u(wx - 3, wy - 3, ww + 6, wh + 6, C.houseDark);
  u(wx, wy, ww, wh, TOKEN.lanternHi);
  u(wx + ww / 2 - 2, wy, 4, wh, C.houseDark);
  u(wx, wy + wh / 2 - 2, ww, 4, C.houseDark);
  // A door.
  u(104, 0, 26, 50, C.roofDark);
}
function scarecrow(u: Brush): void {
  u(22, 0, 6, 62, C.darkWood);
  u(0, 40, 50, 6, C.darkWood);
  u(8, 26, 34, 20, C.coopDark);
  u(14, 48, 22, 20, C.straw);
  u(10, 64, 30, 5, C.roofDark); u(17, 69, 16, 8, C.roofDark);
}
function bales(u: Brush): void {
  for (const [x, y] of [[0, 0], [42, 0], [21, 26]]) {
    u(x, y, 40, 26, C.hay);
    u(x, y, 40, 4, C.hayDark);
    u(x + 12, y, 3, 26, C.hayDark); u(x + 26, y, 3, 26, C.hayDark);
  }
  u(21, 52, 40, 5, C.roofSnow);
}
export function coop(u: Brush, C: FarmColours = B): void {
  u(8, 0, 6, 12, C.darkWood); u(76, 0, 6, 12, C.darkWood);
  u(0, 12, 90, 42, C.coop);
  u(0, 12, 90, 5, C.coopDark);
  u(36, 18, 18, 22, C.roofDark);
  for (let i = 0; i < 3; i++) u(-6 + i * 14, 54 + i * 7, 102 - i * 28, 7, i === 0 ? C.roofSnowShade : C.roofSnow);
}
export function pond(u: Brush, C: FarmColours = B): void {
  u(0, 0, 140, 5, C.stoneDark);
  u(6, 3, 128, 6, C.ice);
  u(20, 6, 40, 2, lighter(C.ice, 0.25)); u(84, 5, 26, 2, lighter(C.ice, 0.25));
  for (const [x, h] of [[112, 26], [120, 34], [127, 22]]) { u(x, 5, 3, h, C.reed); u(x - 1, 5 + h, 5, 6, C.roofDark); }
}

function farm(p: Painter, st: SceneState, out: number): void {
  const off = st.scroll * FARM.speed, base = st.lane - FARM.band, fade = 1 - Math.min(1, out / 0.33);
  if (fade <= 0) return;
  // The ground band the farm stands on, 30 high.
  p.r(0, base, st.W, FARM.band, C.ground, fade);
  const first = Math.floor((off - 300) / FARM.period), last = Math.floor((off + st.W) / FARM.period);
  for (let n = first; n <= last; n++) {
    const x0 = n * FARM.period - off;
    const at = (x: number): Brush => (bx, by, w, h, col, a = 1) => p.r(x0 + x + bx, base - by - h, w, h, col, a * fade);
    const seen = (x: number, w: number) => x0 + x + w > -40 && x0 + x < st.W + 40;
    if (seen(FARM.barn, 240)) { barn(at(FARM.barn)); silo(at(FARM.silo)); }
    FARM.pines.forEach((x, i) => { if (seen(x, 70)) pine(at(x), 0, i ? 110 : 70, C.pine, C.trunk, C.roofSnow); });
    if (seen(FARM.house, HOUSE.w)) {
      // The window's glow, 70 across: 24% at rest, 32% at the top of his breath.
      p.disc(x0 + FARM.house + HOUSE.window[0] + 17, base - HOUSE.window[1] - 18, 35, TOKEN.lanternHi, (0.24 + 0.08 * st.breath) * fade, 5);
      farmhouse(at(FARM.house), st);
    }
    if (seen(FARM.scarecrow, 50)) scarecrow(at(FARM.scarecrow));
    if (seen(FARM.bales, 82)) bales(at(FARM.bales));
    if (seen(FARM.coop, 100)) coop(at(FARM.coop));
    if (seen(FARM.pond, 140)) pond(at(FARM.pond));
    FARM.trees.forEach((x, i) => { if (seen(x, 60)) pine(at(x), 0, [60, 100, 78][i], C.pine, C.trunk, C.roofSnow); });
  }
}

// ---------- the farm fence and its string of bulbs (speed 0.8) ----------

export const FENCE = { speed: 0.8, post: 64, tall: 44 } as const;
/** How far the wire hangs under the posts' tops at `x` along a span, in 2 px steps. */
export const sag = (x: number): number => Math.round((8 * (1 - (2 * x / FENCE.post - 1) ** 2)) / 2) * 2;
/** Whether bulb `i` is lit on this beat: the lit bulbs walk along the fence, one in four. */
export const bulbLit = (i: number, beats: number): boolean => wrap(i + whole(beats), 4) === 0;
/** A bulb, 4 x 6, lit (with a glow 20 across at 24%) or not. With the season on, the three festive colours in turn. */
export function bulb(p: Painter, x: number, y: number, i: number, lit: boolean, festive: boolean, off: string, alpha = 1): void {
  const own = festive ? FESTIVE_BULBS[wrap(i, 3)] : TOKEN.lanternHi;
  if (lit) p.disc(x + 2, y + 3, 10, own, 0.24 * alpha, 4);
  p.r(x, y, 4, 6, lit ? own : festive ? mix(own, S.sky[2], 0.5) : off, alpha);
}
function fence(p: Painter, st: SceneState, out: number): void {
  const off = st.scroll * FENCE.speed, n0 = Math.floor(off / FENCE.post) - 1, n1 = Math.floor((off + st.W) / FENCE.post) + 1, L = st.lane;
  // At the gate each post and rail drops away, one after another; the string stays (stage 2 has it from then on).
  const fall = (n: number) => { const k = Math.min(1, Math.max(0, (out * 900 - wrap(n, 12) * 30) / 500)); return k * k; };
  if (out <= 0) { p.r(0, L - 30 - 5, st.W, 5, C.rail); p.r(0, L - 14 - 5, st.W, 5, C.rail); }
  for (let n = n0; n <= n1; n++) {
    const x = n * FENCE.post - off, f = fall(n);
    if (f >= 1) continue;
    const dy = 300 * f, a = 1 - f;
    if (out > 0) { p.r(x, L - 35 + dy, FENCE.post, 5, C.rail, a); p.r(x, L - 19 + dy, FENCE.post, 5, C.rail, a); }
    p.r(x - 4, L - FENCE.tall + dy, 8, FENCE.tall, C.post, a);
    p.r(x - 5, L - FENCE.tall - 4 + dy, 10, 4, C.snow, a);
  }
  if (out > 0) return;
  for (let n = n0; n <= n1; n++) {
    const x = n * FENCE.post - off;
    // The wire from post to post, in runs at one drop, and three bulbs under it.
    for (let s = 0; s < FENCE.post; ) { const d = sag(s + 1); let e = s + 2; while (e < FENCE.post && sag(e + 1) === d) e += 2; p.r(x + s, L - FENCE.tall + 2 + d, e - s, 1.5, TOKEN.ink); s = e; }
    for (let j = 0; j < 3; j++) { const bx = 16 * (j + 1), i = n * 3 + j; bulb(p, x + bx - 2, L - FENCE.tall + 4 + sag(bx), i, st.reduced ? wrap(i, 4) === 0 : bulbLit(i, st.beats), st.festive, C.bulbOff); }
  }
}

// ---------- the lane, and what is in front of it ----------

export const LANE1 = { track: 14, bank: 10, row: 26, ridge: 120 } as const;
function lane(p: Painter, st: SceneState, m: SceneMemory): void {
  const L = st.lane;
  // The track: the brightest band in the dream. Two wheel ruts along it; the bank under it.
  p.r(0, L, st.W, LANE1.track, C.snow);
  p.r(0, L + 4, st.W, 2, C.shade); p.r(0, L + 9, st.W, 2, C.shade);
  p.r(0, L + LANE1.track, st.W, LANE1.bank, C.shade);
  // Hoofprints: a dent where each hoof came down, fading after 2 s.
  for (const h of m.prints) { const age = st.t - h.t; if (age < 2000) p.r(h.wx - st.scroll, L + 1, 6, 3, C.shade, age < 1400 ? 1 : 1 - (age - 1400) / 600); }
}
function field(p: Painter, st: SceneState, out: number): void {
  // At the first gate the field and the wall fall 260 px and are gone; the mist shows behind them.
  if (out >= 1) return;
  const top = st.lane + LANE1.track + LANE1.bank + 260 * easeIn(out), off = st.scroll * 1.3;
  p.r(0, top, st.W, st.H - top + 2, C.field);
  // Crop rows under snow: ridges 84 long with a furrow's shadow under each, every 120, each row 18 further right.
  for (let r = 0, y = top + 12; y < st.H - 30; r++, y += LANE1.row * (st.low ? 2 : 1)) {
    for (let x = -wrap(off - r * 18, LANE1.ridge); x < st.W; x += LANE1.ridge) { p.r(x, y, 84, 3, C.ridge); p.r(x, y + 3, 84, 5, C.furrow); }
  }
  // The dry-stone wall along the window's bottom edge: four stones, then a gap of 12.
  const woff = st.scroll * 1.6, drop = 260 * easeIn(out), tall = st.phone ? 0.72 : 1;
  for (let k = Math.floor(woff / 180) - 1; k <= Math.floor((woff + st.W) / 180) + 1; k++) for (let j = 0; j < 4; j++) {
    const i = k * 4 + j, x = k * 180 + j * 42 - woff, h = (46 + Math.round(hash2(i, 2) * 10) - (wrap(i, 2) ? 6 : 0)) * tall, y = st.H - h + drop;
    p.r(x, y, 42, h + 4, C.wallStone);
    p.r(x, y, 42, 5, C.wallSnow);
    p.r(x + 40, y + 5, 2, h, C.wallStoneDark);
    p.r(x, y + 5 + Math.round(h * 0.45), 40, 2, C.wallStoneDark);
  }
}

// ---------- obstacles: farm things, each filling its box ----------

export function obstacle(p: Painter, st: SceneState, f: SceneFence, C: ObstacleColours = O, drift = true, after?: (u: Brush) => void): void {
  const W = BOX.w, H = BOX.h;
  inBox(p, st, f, (u) => {
    if (f.look === 'rail') {
      // A five-bar gate with a diagonal brace.
      for (let i = 0; i < 5; i++) u(4, 10 + i * 17, W - 8, 6, C.log);
      for (let k = 0; k < 14; k++) u(8 + k * ((W - 22) / 14), 10 + k * 5.3, 7, 7, C.logRing);
      u(0, 0, 8, H, C.post); u(W - 8, 0, 8, H, C.post);
      u(-1, H, 10, 4, C.snow); u(W - 9, H, 10, 4, C.snow);
    } else if (f.look === 'picket') {
      // A plank fence section with two rails.
      u(0, 22, W, 7, C.rail); u(0, 62, W, 7, C.rail);
      for (let i = 0; i < 5; i++) { const x = 2 + i * ((W - 4) / 5); u(x, 0, 11, H - 6, C.log); u(x + 2, H - 6, 7, 6, C.log); u(x, H - 8, 11, 3, C.snow); }
    } else if (f.look === 'wall') {
      // A brick gatepost with a snow cap.
      u(6, 0, W - 12, H - 12, C.brick);
      for (let r = 0; r * 10 < H - 12; r++) { u(6, r * 10, W - 12, 2, C.mortar); for (let x = r % 2 ? 6 : 18; x < W - 12; x += 24) u(x, r * 10, 2, 10, C.mortar); }
      u(6, 0, 4, H - 12, C.brickDark, 0.5);
      u(0, H - 12, W, 8, C.mortar);
      u(2, H - 4, W - 4, 4, C.snow);
    } else if (f.look === 'log') {
      // A log pile, round ends showing: three under two, twice over, snow on top.
      const d = W / 3;
      for (let row = 0; row < 4; row++) for (let i = 0; i < (row % 2 ? 2 : 3); i++) {
        const cx = (row % 2 ? d : d / 2) + i * d, cy = d / 2 + row * (H - d) / 3;
        u(cx - d / 2 + 2, cy - d / 2 + 5, d - 4, d - 10, C.log); u(cx - d / 2 + 5, cy - d / 2 + 2, d - 10, d - 4, C.log);
        u(cx - d / 4, cy - d / 4, d / 2, d / 2, C.logEnd); u(cx - 3, cy - 3, 6, 6, C.logRing);
      }
      u(d / 2 - 2, H - 3, W - d + 4, 4, C.snow);
    } else {
      // Hay bales, two by two, snow on the top ones.
      const bw = W / 2, bh = H / 3;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 2; i++) {
        u(i * bw, row * bh, bw - 1, bh - 1, C.bale); u(i * bw, row * bh, bw - 1, 4, C.baleDark);
        u(i * bw + bw * 0.3, row * bh, 3, bh - 1, C.twine); u(i * bw + bw * 0.7, row * bh, 3, bh - 1, C.twine);
      }
      u(0, H - 4, W, 5, C.snow);
    }
    // A stepped drift, two cells high, against its foot.
    if (drift) { u(-10, 0, 12, 4, C.snow); u(-5, 4, 7, 4, C.snow); u(W - 2, 0, 12, 4, C.snow); u(W - 2, 4, 7, 4, C.snow); }
    after?.(u);
  });
  if (f.tilt <= 0.001) { lantern(p, f.x - 2, st.lane - BOX.h - 12, f.lit, C.bulbOff); lantern(p, f.x + W - 4, st.lane - BOX.h - 12, f.lit, C.bulbOff); }
}

/**
 * Everything of stage 1 behind the sheep. `part` splits it for the gate: `back` is what stands behind the lane, `front`
 * the field and the wall, which fall away in front of stage 2's island as it grows.
 */
export function paintStage1(p: Painter, st: SceneState, m: SceneMemory, out = 0, part: 'all' | 'back' | 'front' = 'all'): void {
  if (part === 'front') { if (out < 1) field(p, st, out); return; }
  // Snow falls: 46 flakes, each at its own pace, drifting left at a fifth of the lane's speed. It stops at the gate.
  if (!st.reduced || out === 0) {
    const n = st.low ? 20 : 46, a = 0.78 * (1 - Math.min(1, out / 0.5));
    for (let i = 0; i < n && a > 0; i++) {
      const v = 30 + hash2(i, 11) * 30, y = wrap(hash2(i, 12) * st.lane + (st.reduced ? 0 : (st.t / 1000) * v), st.lane);
      p.r(wrap(hash2(i, 13) * st.W - st.scroll * 0.2, st.W), y, 2 * st.u, 2 * st.u, TOKEN.woolHi, a);
    }
  }
  hills(p, st, out);
  farm(p, st, out);
  fence(p, st, out);
  if (part === 'all' && out < 1) field(p, st, out);
  if (out === 0) lane(p, st, m);
}
/** One of stage 1's obstacles and its sign's post, on the lane. */
export function paintObstacle1(p: Painter, st: SceneState, f: SceneFence): void {
  signPost(p, st, f, C.post, C.postLit);
  obstacle(p, st, f);
}
/** The first gate (04, section 1): the farm's boundary gate, two plank posts 3.2 sheep high and a beam with nine lanterns. */
export function paintGate1(p: Painter, st: SceneState, x: number, lit: number): void {
  const tall = st.sheep.w * 0.62 * 3.2, L = st.lane, w = 150;
  p.r(x - w / 2 - 7, L - tall, 14, tall, C.post); p.r(x + w / 2 - 7, L - tall, 14, tall, C.post);
  p.r(x - w / 2 + 3, L - tall, 4, tall, C.postLit); p.r(x + w / 2 + 3, L - tall, 4, tall, C.postLit);
  p.r(x - w / 2 - 16, L - tall - 12, w + 32, 12, C.rail);
  p.r(x - w / 2 - 16, L - tall - 16, w + 32, 4, C.snow);
  // Nine lanterns along the beam, lit one after another as the sheep goes under.
  for (let i = 0; i < 9; i++) lantern(p, x - w / 2 + 6 + i * ((w - 18) / 8), L - tall + 4, i < lit, C.bulbOff);
  // The banner: an ink tag hung from the beam, with the island that is coming on it.
  p.r(x - 34, L - tall + 18, 68, 26, TOKEN.ink);
  p.r(x - 12, L - tall + 28, 24, 4, TOKEN.wool); p.r(x - 9, L - tall + 32, 18, 4, TOKEN.wool); p.r(x - 5, L - tall + 36, 10, 3, TOKEN.wool); p.r(x - 4, L - tall + 23, 3, 5, TOKEN.wool);
}
export const STAGE1 = { shadow: mix(S.snow, S.sky[2], 0.45), puff: TOKEN.woolHi, C } as const;
