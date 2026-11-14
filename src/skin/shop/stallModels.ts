import { Color } from 'three';
import { stamp } from '../voxel/burstProps';
import { lin } from '../voxel/palette';
import { Grid, hash3, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import type { SackId } from './sacks';
import { CRATE, DEPTH, POST_INSET } from './stallPlan';
import type { StallPlan } from './stallPlan';
import { disc, fill, GRAIN, sackGrid, SACK_VOXEL, tone3 } from './thumbModels';

/**
 * The Feed Sacks' market stall in voxels (Brian, 2026-11-13: "turn the counter into a market stall"), on the sacks' own
 * voxel size, measured by stallPlan.ts: x to the right, y up from the floor, z toward the buyer from the back wall.
 * tools/renderStall.mjs photographs these through ?preview=stall; only the baked pictures in public/shop/stall are shown.
 *
 * stallGrid is everything that stands still: the back wall and its stock, the counter and its boarded front, the posts,
 * the awning's canvas and the snow on it, the scale, the barrel and the stacked crates. valanceGrid is the awning's
 * scalloped edge, a picture of its own so it can sway. crateGrid is one sack's crate with its grain; the sack in it is
 * thumbModels' sackGrid, unchanged.
 */
export const STALL_VOXEL = SACK_VOXEL;

/** The stock behind the sacks is this much darker than what stands in front (20% as seen: the colours here are linear). */
const DIM = 0.8 ** 2.2;
const DIM_TINT: RGB = [DIM, DIM, DIM];
const hexes = (...h: string[]) => h.map(lin);
/** A colour at full strength: the stock is painted bright and then dimmed, and snow is whiter than cream canvas (`lin` takes 30% of the saturation off). */
const raw = (hex: string): RGB => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const RED = hexes('#b8493c', '#a03d32'), CREAM = hexes('#f3e3bc', '#dccb9e');
/** Snow is brighter than any paint: these go over 1, as the bombs' glints do. */
const SNOW: RGB[] = [raw('#f4f9ff').map((v) => v * 1.55) as RGB, raw('#cfdff0').map((v) => v * 1.25) as RGB];

/** Which stripe of the awning a column is in, and whether that stripe is red. Every plan's width is a whole, odd number of stripes. */
const stripeOf = (p: StallPlan, x: number) => Math.floor(x / p.stripe);
const cloth = (p: StallPlan, x: number, shade = 0) => (stripeOf(p, x) % 2 === 0 ? RED : CREAM)[shade];

/** The canvas's height at a depth: from the bar at the front up to the ridge at the back. */
const canvasY = (p: StallPlan, z: number) => p.bar + 1 + Math.round(((DEPTH.awningFront - z) / (DEPTH.awningFront - DEPTH.awningBack)) * (p.ridge - p.bar - 1));

// ---------------------------------------------------------------- the stall

export function stallGrid(p: StallPlan): Grid {
  const g = new Grid(STALL_VOXEL), W = p.w, L = POST_INSET, R = W - POST_INSET - 1;

  // The floor: boards running toward the buyer. The picture is cut off at its front edge.
  const floorTo = (p.stock ? DEPTH.floor : DEPTH.lip) + 3;
  const boards = hexes('#6f4d31', '#674729', '#75532f');
  fill(g, 0, -1, 0, W - 1, -1, floorTo, (x) => (x % 9 === 4 ? lin('#3d2816') : boards[Math.floor(hash3(Math.floor((x + 5) / 9), 0, 0, 3) * 3)]));

  // The back wall: dark upright boards, up behind the awning's edge.
  const wall = hexes('#5c4029', '#644630', '#553a25');
  fill(g, L, p.top, 0, R, p.valance + 3, 0, (x) => (x % 5 === 0 ? lin('#35241a') : wall[Math.floor(hash3(Math.floor(x / 5), 1, 0, 7) * 3)]));

  if (p.stock) {
    const s = new Grid(STALL_VOXEL);
    stock(s, p);
    stamp(g, s, 0, 0, 0, DIM_TINT);
  }
  // The chalkboard: a slate in a wooden frame, hung on the wall. The chalk is written over the picture (FeedSacks.tsx).
  if (p.sign) {
    const { x, y, w, h } = p.sign;
    fill(g, x, y, 1, x + w - 1, y + h - 1, 1, (vx, vy) => (vx === x || vx === x + w - 1 || vy === y || vy === y + h - 1 ? lin(vy === y + h - 1 ? '#8a6238' : '#6f4c2a') : lin('#22262a')));
    // Its cord, up to a nail.
    for (const vx of [x + 2, x + w - 3]) g.set(vx, y + h, 1, lin('#b8986a'));
  }

  counter(g, p);
  if (p.scale !== null) scale(g, p.scale, p.top, 11);
  awning(g, p);
  if (p.stock) {
    // A narrower stall has less floor either side of its tags: a slimmer barrel, smaller crates.
    const slim = W < 100;
    barrel(g, slim ? 5 : 6, DEPTH.front + 5, slim ? 0.7 : 1);
    closedCrate(g, W - (slim ? 9 : 11), 0, DEPTH.front + 2, slim ? 8 : 10, 6, 7, 2);
    closedCrate(g, W - (slim ? 8 : 10), 6, DEPTH.front + 2, slim ? 6 : 8, 5, 6, 5);
  }
  return g;
}

/** The counter: a boarded front with a cross brace between each pair of sacks, under a thick plank; a post at each end of the plank. */
function counter(g: Grid, p: StallPlan) {
  const W = p.w, F = DEPTH.front, panel = p.panel;
  const board = hexes('#a9743f', '#9d6a38', '#b27d48', '#a26f3b');
  // Upright boards, six voxels each, with a dark seam between.
  fill(g, 1, 0, F - 2, W - 2, panel - 1, F - 1, (x) => (x % 6 === 0 ? lin('#5e3c1f') : board[Math.floor(hash3(Math.floor(x / 6), 2, 0, 11) * 4)]));
  // A rail along the foot and one under the plank, standing a voxel proud.
  fill(g, 1, 0, F, W - 2, 1, F, (_x, y) => lin(y === 1 ? '#8f5f31' : '#7d5229'));
  fill(g, 1, panel - 2, F, W - 2, panel - 1, F, (_x, y) => lin(y === panel - 1 ? '#7d5229' : '#8f5f31'));
  // The cross braces: an X in each bay between two sacks' tags, where there is room for one, between two uprights.
  const lo = 2, hi = panel - 3, brace = hexes('#cb9a5c', '#b98548'), upright = lin('#7d5229');
  for (let k = 0; k < 2; k++) {
    const a = p.crates[k] + 11, b = p.crates[k + 1] - 11;
    if (b - a < 7) continue;
    // As many crosses as fit at about twice as wide as tall.
    const n = Math.max(1, Math.round((b - a + 1) / ((hi - lo + 1) * 2.2))), each = (b - a + 1) / n;
    for (let i = 0; i < n; i++) {
      const x0 = Math.round(a + i * each), x1 = Math.round(a + (i + 1) * each) - 1;
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0);
        for (const y of [lo + t * (hi - lo), hi - t * (hi - lo)]) g.set(x, Math.round(y), F, brace[Math.round(y) > (lo + hi) / 2 ? 0 : 1]);
      }
      fill(g, x0 - 1, 2, F, x0 - 1, panel - 3, F, upright);
      if (i === n - 1) fill(g, x1 + 1, 2, F, x1 + 1, panel - 3, F, upright);
    }
  }
  // An upright at each end of the front, and one under each sack: what the tags' nails are driven into.
  for (const x of [1, 2, W - 3, W - 2]) fill(g, x, 0, F, x, panel - 1, F, lin('#7d5229'));
  // The plank: long boards, their seams running along the counter, a lit front edge.
  const plank = hexes('#e2b57c', '#dcae74', '#e7bd86');
  fill(g, 1, panel, 1, W - 2, panel + 1, DEPTH.lip, (x, y, z) => {
    if (z === DEPTH.lip) return lin(y === panel + 1 ? '#f0d09c' : '#c2935a');
    const row = Math.floor(z / 6);
    if (z % 6 === 0 || (x + row * 37) % 53 === 0) return lin('#b98a55');
    return plank[Math.floor(hash3(Math.floor((x + row * 37) / 53), row, 0, 5) * 3)];
  });
  // The posts, standing on the plank's two ends, up to the awning's bar.
  const post = tone3('#5e3e22', '#7a5230', '#94683e', 4);
  for (const side of [0, 1]) {
    const x0 = side ? W - POST_INSET - p.post : POST_INSET, x1 = x0 + p.post - 1;
    fill(g, x0, p.top, F - p.post, x1, p.bar - 1, F - 1, (x, y, z) => (z === F - 1 ? lin(x === x0 || x === x1 ? '#6a4626' : '#8a6038') : post(x - x0 - 2, y - p.top, z - F)));
    // The foot: a wider block.
    fill(g, x0 - 1, p.top, F - p.post - 1, x1 + 1, p.top, F, lin('#6a4626'));
  }
}

/**
 * The awning: striped canvas sloping down from the ridge to a bar across the posts' tops, snow lying along the ridge
 * and in a few drifts. Its scalloped edge is not here (valanceGrid): only the band the edge is sewn to.
 */
function awning(g: Grid, p: StallPlan) {
  const W = p.w, A = DEPTH.awningFront, B = DEPTH.awningBack;
  // The bar: a pole across the stall, under the canvas's front edge.
  fill(g, 0, p.bar, A - 2, W - 1, p.bar, A - 1, lin('#6a4626'));
  for (let z = B; z <= A; z++) {
    const y = canvasY(p, z);
    for (let x = 0; x < W; x++) {
      // Each stripe's two edges are a shade darker, so a stripe reads as a strip of cloth.
      const edge = x % p.stripe === 0 || x % p.stripe === p.stripe - 1;
      g.set(x, y, z, cloth(p, x, edge ? 1 : 0));
      g.set(x, y - 1, z, cloth(p, x, 1));
    }
  }
  // The front band the scallops hang from: two rows down the front of the bar.
  fill(g, 0, p.bar, A, W - 1, p.bar + 1, A, (x) => cloth(p, x, 0));
  // Snow: a bank lying along the ridge, its lower edge wandering, a lump on it here and there.
  const wave = (x: number) => 3.6 + 1.8 * Math.sin(x * 0.19 + p.w) + 1.2 * Math.sin(x * 0.53 + 1) + (hash3(x, 3, 0, 22) > 0.82 ? 1 : 0);
  for (let x = 0; x < W; x++) {
    const deep = Math.max(1, Math.round(wave(x)));
    for (let z = B; z < B + deep; z++) {
      const y = canvasY(p, z);
      g.set(x, y + 1, z, SNOW[z === B + deep - 1 && deep > 1 ? 1 : 0]);
      if (deep >= 5 && z < B + 3) g.set(x, y + 2, z, SNOW[0]);
    }
  }
}

/** The awning's edge: the band's front and a rounded scallop under each stripe. Drawn by itself so it can sway. */
export function valanceGrid(p: StallPlan): Grid {
  const g = new Grid(STALL_VOXEL), A = DEPTH.awningFront;
  for (let x = 0; x < p.w; x++) {
    const at = x % p.stripe, corner = at === 0 || at === p.stripe - 1;
    for (let y = p.valance; y <= p.bar + 1; y++) {
      if (y === p.valance && corner) continue;
      g.set(x, y, A, cloth(p, x, y <= p.valance + 1 ? 1 : 0));
    }
  }
  return g;
}

// ---------------------------------------------------------------- the stock on the back wall

type Maker = (g: Grid, x: number, y: number, n: number) => number;
const BURLAP = [['#b89a5e', '#dcc48c', '#f2e2b4'], ['#a8956a', '#cdbb92', '#e8dcb8'], ['#b88a3e', '#e0b866', '#f4d894']];
const JAR = ['#f0a020', '#d8284a', '#8fc03a', '#f4e6b0', '#e86a1e'];
const TIN = ['#2fa39a', '#d8483a', '#f0e2c0', '#3f6fb8', '#f0b428'];
/** Things on a shelf, each standing on y at x and returning how wide it is. All are three voxels deep, against the wall. */
const GOODS: Maker[] = [
  // A small sealed sack: a full body, a cinched neck with a tie, a frill of burlap over it.
  (g, x, y, n) => {
    const t = BURLAP[n % 3].map(raw);
    fill(g, x, y, 1, x + 4, y + 2, 3, (vx, vy) => t[vx === x ? 2 : vx === x + 4 ? 0 : vy === y ? 0 : 1]);
    fill(g, x + 1, y + 3, 1, x + 3, y + 3, 3, t[1]);
    fill(g, x + 2, y + 4, 2, x + 2, y + 4, 2, raw('#7a4a22'));
    fill(g, x + 1, y + 5, 2, x + 3, y + 5, 2, t[2]);
    return 5;
  },
  // A jar: a glass body with what is in it showing, a narrow neck, a lid.
  (g, x, y, n) => {
    const c = raw(JAR[n % JAR.length]), glass = raw('#d6efe6');
    fill(g, x, y, 1, x + 3, y + 3, 3, (vx, vy) => (vy === y + 3 ? glass : vx === x && vy === y + 2 ? raw('#fffbe8') : c));
    fill(g, x + 1, y + 4, 2, x + 2, y + 4, 2, glass);
    fill(g, x + 1, y + 5, 2, x + 2, y + 5, 2, raw(n % 2 ? '#c8a23a' : '#b8433a'));
    return 4;
  },
  // A tin: a paper band round it, a rim and a lid.
  (g, x, y, n) => {
    const c = raw(TIN[n % TIN.length]);
    fill(g, x, y, 1, x + 2, y + 3, 3, (_vx, vy) => (vy === y + 3 ? raw('#b9c0c6') : vy === y + 1 || vy === y + 2 ? raw('#fff4d8') : c));
    g.set(x + 1, y + 2, 3, c);
    return 3;
  },
  // Two flat tins, one on the other.
  (g, x, y, n) => {
    const a = raw(TIN[(n + 2) % TIN.length]), b = raw(TIN[(n + 4) % TIN.length]);
    fill(g, x, y, 1, x + 3, y + 1, 3, (_vx, vy) => (vy === y + 1 ? raw('#b9c0c6') : a));
    fill(g, x, y + 2, 1, x + 3, y + 3, 3, (_vx, vy) => (vy === y + 3 ? raw('#b9c0c6') : b));
    return 4;
  },
  // A tall jar with a cloth tied over it.
  (g, x, y, n) => {
    const c = raw(JAR[(n + 2) % JAR.length]), glass = raw('#d6efe6');
    fill(g, x, y, 1, x + 2, y + 4, 3, (vx, vy) => (vy === y + 4 ? glass : vx === x && vy >= y + 2 ? raw('#fffbe8') : c));
    fill(g, x, y + 5, 1, x + 2, y + 5, 3, raw('#f4e6c8'));
    g.set(x + 1, y + 6, 2, raw('#f4e6c8'));
    return 3;
  },
];

/** Two shelves of sealed sacks, jars and tins along the back wall, and what hangs from the rail under the awning. */
function stock(g: Grid, p: StallPlan) {
  const L = POST_INSET + 1, R = p.w - POST_INSET - 2, D = DEPTH.shelf;
  const rand = rng(p.w * 7 + 3);
  const sign = p.sign;
  [p.top + 5, p.top + 12].forEach((y, shelf) => {
    // The upper shelf stops either side of the chalkboard.
    const clear = (x: number) => !(shelf === 1 && sign && x >= sign.x - 2 && x <= sign.x + sign.w + 1);
    // Nothing stands on the lower shelf behind the scale: brass against jars is a muddle.
    const open = (x: number) => clear(x) && !(shelf === 0 && p.scale !== null && x <= p.scale + 9);
    for (let x = L; x <= R; x++) {
      if (!clear(x)) continue;
      fill(g, x, y, 1, x, y, D, (_x, _y, z) => raw(z === D ? '#e8bc7e' : '#b98248'));
      if (x % 14 === 7 && clear(x - 1) && clear(x + 1)) { g.set(x, y - 1, 1, raw('#7a5230')); g.set(x, y - 1, 2, raw('#7a5230')); g.set(x, y - 2, 1, raw('#7a5230')); }
    }
    let x = L + 1 + Math.floor(rand() * 2), n = shelf * 3;
    while (x < R - 5) {
      // Under the chalkboard only tins fit.
      const low = shelf === 0 && sign && x >= sign.x - 5 && x <= sign.x + sign.w;
      const make = low ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * GOODS.length);
      const probe = new Grid(STALL_VOXEL), w = GOODS[make](probe, x, y + 1, n);
      let fits = true;
      for (let i = -1; i <= w; i++) if (!open(x + i)) fits = false;
      if (fits) stamp(g, probe);
      x += w + 1 + (rand() > 0.7 ? 1 : 0);
      n++;
    }
  });

  // The rail under the awning, and what hangs from it in the gap between the second and third sacks: dried corn, a coil of rope.
  const railY = p.top + 21, z = 8;
  fill(g, L, railY, z, R, railY, z, raw('#7a5230'));
  const gapFrom = p.crates[1] + 12, coilX = p.crates[2] - 13;
  rope(g, coilX, p.top + 13, z);
  for (let y = p.top + 17; y < railY; y++) g.set(coilX, y, z, raw('#a87a44'));
  if (coilX - 5 - gapFrom >= 8) corn(g, Math.round((gapFrom + coilX - 5) / 2) - 1, p.top + 11, z, railY);
  // A string of onions down the right end, where there is room past the last sack.
  const endX = p.crates[2] + 13;
  if (endX + 2 <= R) onions(g, endX, p.top + 9, z, railY);
}

/** A coil of rope hung on a hook: a thick ring, darker round its outside, a twist marked on it here and there. */
function rope(g: Grid, cx: number, cy: number, z: number) {
  const tan = raw('#e0b878'), dark = raw('#a8763e'), pale = raw('#f6dfae');
  for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
    const d = Math.hypot(x, y);
    if (d > 4.3 || d < 1.5) continue;
    const twist = Math.floor(((Math.atan2(y, x) + Math.PI) * 6) / Math.PI) % 4 === 0;
    g.set(cx + x, cy + y, z, dark);
    g.set(cx + x, cy + y, z + 1, d > 3.4 ? dark : twist ? tan : pale);
  }
}
/** Three cobs of dried corn hung by their husks, a gap between each and the next. */
function corn(g: Grid, cx: number, y: number, z: number, railY: number) {
  const kernel = ['#ffc81e', '#f0a010', '#ffe060'].map(raw), husk = ['#f4ecc0', '#d8c88e'].map(raw);
  [[-3, 1], [0, -1], [3, 0]].forEach(([dx, dy], i) => {
    const x = cx + dx, y0 = y + dy;
    fill(g, x, y0 + 1, z, x + 1, y0 + 4, z + 1, (vx, vy) => kernel[(vx + vy + i) % 2 ? 0 : (vy + i) % 3 === 0 ? 2 : 1]);
    g.set(x + (i % 2), y0, z, kernel[1]);
    fill(g, x, y0 + 5, z, x + 1, y0 + 5, z + 1, husk[0]);
    g.set(x + (dx < 0 ? 1 : 0), y0 + 6, z, husk[1]);
    if (dx) g.set(x + (dx < 0 ? 2 : -1), y0 + 7, z, husk[1]);
  });
  for (let vy = y + 6; vy < railY; vy++) g.set(cx, vy, z, husk[1]);
}
/** A string of onions: a braid, an onion each side of it by turns. */
function onions(g: Grid, cx: number, y: number, z: number, railY: number) {
  const skin = ['#a85a1c', '#d98a30', '#f4b860'].map(raw);
  for (let vy = y; vy < railY; vy++) g.set(cx, vy, z, raw('#d8c89a'));
  for (let i = 0; i < 4; i++) {
    const x0 = i % 2 ? cx + 1 : cx - 2, y0 = y + i * 3;
    fill(g, x0, y0, z, x0 + 1, y0 + 1, z + 1, (vx, vy) => skin[vy === y0 + 1 && vx === x0 ? 2 : vy === y0 ? 0 : 1]);
    g.set(x0 + (i % 2 ? 0 : 1), y0 + 2, z, raw('#f4e0b0'));
  }
}

// ---------------------------------------------------------------- on the counter and the floor

/**
 * A shop balance: a wooden foot, a brass post and beam, two deep pans on chains, oats in the lower one. Stands on y, its
 * middle at x: 14 voxels tall, most of a sack's height.
 */
function scale(g: Grid, cx: number, y: number, z: number) {
  const brass = tone3('#9a6a0c', '#e0a820', '#ffe07a', 7), wood = tone3('#5a3a22', '#7a5230', '#9a6e44', 5), chain = lin('#b08a1e');
  fill(g, cx - 4, y, z - 3, cx + 3, y, z + 2, (vx, _vy, vz) => wood(vx - cx, 0, vz - z));
  fill(g, cx - 3, y + 1, z - 2, cx + 2, y + 1, z + 1, (vx, _vy, vz) => brass(vx - cx, 0, vz - z));
  fill(g, cx - 1, y + 2, z - 1, cx, y + 12, z, (vx, vy) => brass(vx - cx, vy - y - 7, 2));
  fill(g, cx - 6, y + 11, z - 1, cx + 5, y + 12, z, (vx, vy) => brass(vx - cx, vy - y - 10, 3));
  fill(g, cx - 1, y + 13, z - 1, cx, y + 13, z, lin('#ffe07a'));
  for (const [px, drop] of [[cx - 6, 7], [cx + 5, 4]] as [number, number][]) {
    for (let vy = y + 11 - drop; vy < y + 11; vy++) { g.set(px - 1, vy, z, chain); g.set(px + 1, vy, z, chain); }
    // A pan: a rim, and a smaller bowl under it.
    fill(g, px - 2, y + 10 - drop, z - 2, px + 2, y + 10 - drop, z + 1, (vx) => brass(vx - px, 1, 2));
    fill(g, px - 1, y + 9 - drop, z - 1, px + 1, y + 9 - drop, z, (vx) => brass(vx - px, -3, 1));
  }
  fill(g, cx - 7, y + 4, z - 1, cx - 5, y + 4, z, (vx, _vy, vz) => lin(GRAIN.bomb[(vx + vz + 20) % 2]));
  g.set(cx - 6, y + 5, z, lin(GRAIN.bomb[0]));
}

/** A barrel: bulging staves (by `bulge` voxels at its middle), two iron hoops, a lid set in its rim. Stands on the floor, its middle at x and z. */
function barrel(g: Grid, cx: number, cz: number, bulge = 1) {
  const stave = hexes('#a9743f', '#96652f', '#b78248'), hoop = lin('#34363c'), H = 12;
  for (let y = 0; y <= H; y++) {
    const r = 3.7 + bulge * Math.sin((y / H) * Math.PI);
    for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      const d = Math.hypot(x, z);
      if (d > r) continue;
      const band = y === 2 || y === H - 2;
      const lid = y === H && d < r - 1;
      const a = Math.floor(((Math.atan2(z, x) + Math.PI) * 7) / Math.PI);
      if (lid) continue;
      g.set(cx + x, y, cz + z, band ? hoop : y === H ? lin('#7d5229') : stave[a % 3]);
    }
  }
  // The lid, a voxel down inside the rim.
  disc(g, H - 1, 3.2, (x) => lin(Math.abs(x - cx) % 3 === 1 ? '#8f5f31' : '#c49a64'), cx, cz);
}

/** A closed crate: slats with dark gaps between, battens at its corners, a lid of boards. */
function closedCrate(g: Grid, x0: number, y0: number, z0: number, w: number, h: number, d: number, seed: number) {
  const slat = hexes('#c79a62', '#b98a55', '#d2a770');
  fill(g, x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y, z) => {
    const corner = (x === x0 || x === x0 + w - 1) && (z === z0 || z === z0 + d - 1);
    if (y === y0 + h - 1) return (x - x0) % 3 === 2 ? lin('#8f6a3e') : slat[Math.floor(hash3(Math.floor((x - x0) / 3), y, seed, 9) * 3)];
    if (corner || x === x0 || x === x0 + w - 1) return lin('#8f6a3e');
    return (y - y0) % 2 === 1 && y < y0 + h - 2 ? lin('#6e4c28') : slat[Math.floor(hash3(x >> 2, y, seed, 4) * 3)];
  });
}

// ---------------------------------------------------------------- a sack's crate

/** Where the sack stands in its crate: on a bed of its grain, toward the back. */
export const SACK_IN_CRATE = { x: 0, y: 4, z: 7 } as const;

/**
 * An open crate with one sack's grain heaped in it: a floor, a tall back board, sides slanting down to a low front
 * board, a batten at each corner. x runs -10..9 across it, z from 0 at its back to 15 at its front, y from 0 at its foot.
 * The grain is level with the front board and mounded against the sack; the oats' crate has a tin scoop stuck in it.
 */
export function crateGrid(sack: SackId): Grid {
  const g = new Grid(STALL_VOXEL), { w, d, back, front } = CRATE, x0 = -w / 2, x1 = w / 2 - 1, z1 = d - 1;
  const slat = hexes('#c79a62', '#d6ac74', '#bb8c56'), batten = lin('#8f6a3e');
  const wood = (a: number, b: number) => slat[Math.floor(hash3(a, b, 0, 13) * 3)];
  fill(g, x0, 0, 0, x1, 0, z1, lin('#9a7446'));
  const side = (z: number) => front + Math.round(((back - front) * (z1 - z)) / z1);
  for (let z = 0; z <= z1; z++) for (const x of [x0, x1]) for (let y = 1; y <= side(z); y++) g.set(x, y, z, y === side(z) ? lin('#d6ac74') : wood(z >> 2, y >> 1));
  for (let x = x0; x <= x1; x++) {
    for (let y = 1; y <= back; y++) g.set(x, y, 0, wood(x >> 2, (y >> 1) + 5));
    // The front board: two slats, a dark line between them.
    for (let y = 1; y <= front; y++) g.set(x, y, z1, y === 2 ? lin('#9c7444') : y === front ? lin('#dcb47c') : wood((x - x0) >> 3, y + 9));
  }
  for (const x of [x0, x1]) { fill(g, x, 1, z1, x, front + 1, z1, batten); fill(g, x, 1, 0, x, back + 1, 0, batten); }

  // The grain: level with the front board, mounded toward the sack and at the two front corners.
  const c = GRAIN[sack].map(lin), seed = sack === 'bomb' ? 3 : sack === 'blast' ? 8 : 15;
  for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = 1; z <= z1 - 1; z++) {
    const h = hash3(x, 0, z, seed), away = Math.abs(x + 0.5) > 4;
    const top = front + (z <= 12 && away && h > 0.35 ? 1 : 0) + (z <= 11 && away && h > 0.75 ? 1 : 0);
    for (let y = 1; y <= top; y++) g.set(x, y, z, c[y === top ? (h < 0.5 ? 0 : 1) : 2]);
  }
  if (sack === 'bomb') {
    // A tin scoop lying in the oats at the front, full, its wooden handle sticking up over the crate's side.
    const tin = hexes('#7f8891', '#b9c2ca', '#eef2f5');
    fill(g, 3, front + 1, z1 - 4, 7, front + 2, z1 - 1, (x, y, z) => (y === front + 2 && x > 3 && x < 7 && z > z1 - 4 && z < z1 - 1 ? c[0] : tin[x === 3 || y === front + 2 ? 2 : z === z1 - 1 ? 1 : 0]));
    g.set(5, front + 3, z1 - 3, c[1]);
    fill(g, 8, front + 2, z1 - 3, 8, front + 3, z1 - 2, lin('#9a6a3c'));
    fill(g, 9, front + 3, z1 - 3, 10, front + 4, z1 - 2, (x) => lin(x === 10 ? '#7a5230' : '#b07c44'));
  }
  return g;
}

/** The sack as it stands in its crate (thumbModels' sack, moved to its place). */
export function sackInCrate(sack: SackId): Grid {
  const g = new Grid(STALL_VOXEL);
  stamp(g, sackGrid(sack), SACK_IN_CRATE.x, SACK_IN_CRATE.y, SACK_IN_CRATE.z);
  return g;
}

/**
 * The stall's lantern: an iron cap and foot, and between them the lit glass, narrower than both. Hangs from y = 0 at
 * its ring, down. Drawn unlit: it is alight.
 */
export function stallLanternGrid(): Grid {
  const g = new Grid(STALL_VOXEL), iron = raw('#3a312a'), dark = raw('#2a221c'), pane = ['#fff6c8', '#ffd24a', '#f59a1c'].map(raw);
  g.set(0, -1, 0, iron);
  fill(g, -1, -2, -1, 1, -2, 1, iron);
  fill(g, -2, -3, -2, 2, -3, 2, (_x, _y, z) => (z === 2 ? iron : dark));
  fill(g, -1, -7, -1, 1, -4, 1, (x, y) => pane[x === 0 && (y === -5 || y === -6) ? 0 : y === -7 || x !== 0 ? (y === -4 ? 1 : y === -7 ? 2 : 1) : 1]);
  fill(g, -2, -8, -2, 2, -8, 2, (_x, _y, z) => (z === 2 ? iron : dark));
  return g;
}
