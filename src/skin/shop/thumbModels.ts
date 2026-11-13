import { Color } from 'three';
import { lin } from '../voxel/palette';
import { Grid, hash3, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { balloonGrid, campfireGrid, cloudGrid, haystackGrid, heatherGrid, lanternGrid, starGrid, stamp, sunGrid } from '../voxel/burstProps';
import type { BurstPalette } from '../voxel/burstProps';
import { BLAST_PALETTE, BURST_SHAPE } from './catalog';
import type { BurstShape } from './catalog';
import { SACKS } from './sacks';
import type { SackId } from './sacks';

/**
 * Voxel models for the Trading Post's thumbnails (docs/PLAN_TRADING_POST_REFINE.md Part 7): what tools/renderThumbs.mjs
 * photographs through ?preview=thumb. Bombs are not here: their thumbnail is the game's own bomb (voxel/bomb.ts) in each
 * skin's tint. A burst is the thing it puts where the bomb was, in its real palette; every fuse sound is the thing it is named after; the
 * sacks are burlap with their grain stencilled on (they are photographed standing in their crates on the market stall:
 * stallModels.ts, tools/renderStall.mjs). Never shown live: only the baked pictures in public/shop are.
 */
export const THUMB_VOXEL = 0.04;
/** The same size as the bomb's voxels. */
export const SACK_VOXEL = 0.04;

/** A colour at full strength (bursts glow; `lin` would take 30% of their saturation off). */
const raw = (hex: string): RGB => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** A filled box in voxel coordinates, both corners included. */
export function fill(g: Grid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB | ((x: number, y: number, z: number) => RGB)) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
}
/** A filled ellipsoid in voxel coordinates. */
export function ball(g: Grid, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: RGB | ((x: number, y: number, z: number) => RGB)) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
}
/** A flat disc of radius r at height y. */
export function disc(g: Grid, y: number, r: number, c: RGB | ((x: number, y: number, z: number) => RGB), cx = 0, cz = 0) {
  for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
    if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) g.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  }
}
/** The voxel nearest the viewer (largest z) in a column, or null. */
function front(g: Grid, x: number, y: number): number | null {
  for (let z = 40; z >= -40; z--) if (g.has(x, y, z)) return z;
  return null;
}

// ---------------------------------------------------------------- bursts

/** A direction evenly spread over the sphere, from two random numbers. */
const dir = (u: number, v: number): [number, number, number] => {
  const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
  return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
};
type Flame = RGB[];
/** A small four-pointed star or snowflake: a middle and `arm` voxels each way, flat to the viewer. */
function twinkle(g: Grid, x: number, y: number, z: number, arm: number, c: RGB, mid: RGB = c) {
  for (let i = -arm; i <= arm; i++) { g.set(x + i, y, z, c); g.set(x, y + i, z, c); }
  g.set(x, y, z, mid);
}
/**
 * One picture per burst (catalog.ts BURST_SHAPE), so a burst reads as what it is in the game and not as a colour: the
 * frost ball, and for the rest the very thing the burst puts where the bomb was (voxel/burstProps.ts), doing what it does.
 */
const BURSTS: Record<BurstShape, (g: Grid, p: BurstPalette, f: Flame, sp: RGB[], rand: () => number) => void> = {
  // A ball of frost: thick and white at the heart, thinning and cooling outward.
  ball: (g, _p, f, sp, rand) => {
    for (let i = 0; i < 1100; i++) {
      const [x, y, z] = dir(rand(), rand()), r = 13 * rand() ** 0.75;
      g.set(Math.round(x * r), Math.round(y * r), Math.round(z * r), f[Math.min(4, Math.floor((r / 13) * 5))]);
    }
    ball(g, 0, 0, 0, 3.4, 3.4, 3.4, f[0]);
    for (let i = 0; i < 16; i++) { const [x, y, z] = dir(rand(), rand()); g.set(Math.round(x * 15), Math.round(y * 15), Math.round(z * 15), sp[i % sp.length]); }
  },
  // A haystack, a forkful of straw in the air over it.
  haystack: (g, p, _f, sp, rand) => {
    stamp(g, haystackGrid(p), 0, -10, 0);
    for (let i = 0; i < 30; i++) {
      const a = rand() * Math.PI * 2, r = 1 + rand() * 9;
      g.set(Math.round(Math.cos(a) * r), Math.round(6 + rand() * 8 - r * 0.7), Math.round(Math.sin(a) * r * 0.6), sp[i % sp.length]);
    }
  },
  // A snow cloud, snowing.
  snowcloud: (g, p, f, sp, rand) => {
    stamp(g, cloudGrid(p), 0, 7, 0);
    for (let i = 0; i < 30; i++) g.set(Math.round((rand() - 0.5) * 24), Math.round(-14 + rand() * 15), Math.round((rand() - 0.5) * 8), sp[i % sp.length]);
    for (let i = 0; i < 6; i++) twinkle(g, Math.round(-10 + i * 4 + rand() * 2), Math.round(-12 + rand() * 11), Math.round((rand() - 0.5) * 6), 1, f[1], f[0]);
  },
  // Three balloons on their strings, and a little confetti.
  balloons: (g, p, f, sp, rand) => {
    const white = balloonGrid();
    stamp(g, white, -7, -4, 1, raw(p.flame[2]));
    stamp(g, white, 7, -1, -1, raw(p.flame[4]));
    stamp(g, white, 0, 5, 3, raw(p.flame[1]));
    const all = [...sp, f[1], f[2], f[3], f[4]];
    for (let i = 0; i < 18; i++) g.set(Math.round((rand() - 0.5) * 26), Math.round(-12 + rand() * 12), Math.round((rand() - 0.5) * 6), all[i % all.length]);
  },
  // A campfire: the logs and stones, a flame climbing off them, sparks above.
  campfire: (g, p, f, sp, rand) => {
    stamp(g, campfireGrid(p), 0, -10, 0);
    for (let y = -6; y <= 9; y++) {
      const t = (y + 6) / 15, r = t < 0.3 ? 2.4 + t * 9 : 5.1 * (1 - (t - 0.3) / 0.7) ** 0.75 + 0.5;
      disc(g, y, r, (x, _y, z) => f[Math.min(4, Math.floor((Math.hypot(x, z) / r) * 2.2 + t * 2.6))], Math.sin(y * 0.7) * 0.8);
    }
    for (let i = 0; i < 16; i++) g.set(Math.round((rand() - 0.5) * 12), Math.round(8 + rand() * 7), Math.round((rand() - 0.5) * 10), sp[i % sp.length]);
  },
  // A patch of heather, petals coming off it.
  heather: (g, p, f, _sp, rand) => {
    const bush = heatherGrid(p);
    for (const [x, z] of [[0, 0], [-8, 3], [8, 2], [-4, -7], [5, -7]]) stamp(g, bush, x, -9, z);
    for (let i = 0; i < 16; i++) g.set(Math.round((rand() - 0.5) * 24), Math.round(4 + rand() * 9), Math.round((rand() - 0.5) * 14), f[1 + (i % 3)]);
  },
  // An aurora: three ribbons standing and waving, green at the foot and violet at the top, a few stars round them.
  aurora: (g, _p, f, sp, rand) => {
    for (let k = 0; k < 3; k++) {
      for (let x = -12; x <= 12; x++) {
        const z = (k - 1) * 4 + Math.round(2 * Math.sin(x * 0.45 + k * 2)), h = Math.round(13 + 5 * Math.sin(x * 0.33 + k * 1.7));
        for (let y = 0; y < h; y++) g.set(x, y - 10, z, f[Math.min(4, 1 + Math.floor((y / h) * 4))]);
      }
    }
    for (let i = 0; i < 14; i++) g.set(Math.round((rand() - 0.5) * 24), Math.round(4 + rand() * 8), Math.round((rand() - 0.5) * 10), sp[i % sp.length]);
  },
  // A little sun, with its rays.
  sun: (g, p, _f, sp) => {
    stamp(g, sunGrid(p));
    sp.forEach((c, i) => twinkle(g, [12, -12, 11][i % 3], [11, 10, -12][i % 3], 2, 1, c));
  },
  // Three paper lanterns at different heights, on their way up.
  lanterns: (g, p, _f, sp) => {
    const one = lanternGrid(p);
    ([[-8, -14, 2], [0, -6, -3], [8, 2, 1]] as [number, number, number][]).forEach(([x, y, z], n) => {
      stamp(g, one, x, y, z);
      g.set(x, y - 2, z, sp[n % sp.length]);
      g.set(x + 1, y - 4, z, sp[(n + 1) % sp.length]);
    });
  },
  // Stars out: a big one, small ones round it.
  stars: (g, p, f, sp, rand) => {
    stamp(g, starGrid(p), -3, -1, 0);
    ([[8, 8, 2], [9, -7, 1], [-10, 9, 1], [4, -11, 2], [-11, -8, 1]] as [number, number, number][]).forEach(([x, y, arm], n) => twinkle(g, x, y, -2, arm, n % 2 ? sp[n % sp.length] : f[2], f[0]));
    for (let i = 0; i < 14; i++) g.set(Math.round((rand() - 0.5) * 26), Math.round((rand() - 0.5) * 26), -3, f[3]);
  },
};

/** A burst's picture, in its real palette. */
export function burstGrid(id: string): Grid {
  const p = BLAST_PALETTE[id] ?? BLAST_PALETTE['blast-frost'];
  const g = new Grid(THUMB_VOXEL);
  BURSTS[BURST_SHAPE[id] ?? 'ball'](g, p, p.flame.map(raw), p.spark.map(raw), rng(11));
  return g;
}

// ---------------------------------------------------------------- fuse sounds

/** Light from the upper left front, as a number from about -1 to 1, for painting a lit and a shaded side. */
const lit = (x: number, y: number, z: number, r: number) => (-x * 0.5 + y * 0.6 + z * 0.6) / r;
export const tone3 = (dark: string, mid: string, light: string, r: number) => (x: number, y: number, z: number): RGB => {
  const l = lit(x, y, z, r);
  return lin(l > 0.45 ? light : l > -0.15 ? mid : dark);
};

const SOUNDS: Record<string, () => Grid> = {
  // Ice chime: a hand bell of blue ice.
  'tick-chime': () => {
    const g = new Grid(THUMB_VOXEL), ice = tone3('#2a6fa8', '#5fb8f5', '#cfeeff', 7);
    [6.6, 6, 5.6, 5.2, 5, 4.8, 4.4, 3.8, 3, 2].forEach((r, y) => disc(g, y, r, y === 0 ? () => lin('#e4f4ff') : ice));
    fill(g, -1, 10, -1, 0, 13, 0, lin('#94cfee'));
    fill(g, -2, 14, -2, 1, 15, 1, lin('#cfeeff'));
    ball(g, -0.5, -1.5, -0.5, 1.6, 1.6, 1.6, lin('#bfe6ff'));
    return g;
  },
  // Tin toy: a wind-up tin robot.
  'tick-8bit': () => {
    const g = new Grid(THUMB_VOXEL), tin = tone3('#6f9a1f', '#a3e635', '#d2f58a', 7), dark = lin('#2b3a1a');
    fill(g, -4, 3, -3, 4, 10, 3, tin);
    fill(g, -3, -4, -2, 3, 2, 2, tone3('#557818', '#86c02a', '#b8e060', 6));
    for (const x of [-3, 2]) { fill(g, x, 7, 4, x + 1, 8, 4, lin('#ffffff')); g.set(x + (x < 0 ? 1 : 0), 7, 4, dark); }
    for (const x of [-2, 0, 2]) g.set(x, 5, 4, dark);
    fill(g, -4, 4, 4, 4, 4, 4, lin('#6f9a1f'));
    fill(g, 0, 11, 0, 0, 12, 0, dark);
    fill(g, -1, 13, -1, 1, 14, 1, lin('#ff5a3a'));
    fill(g, 5, -1, 0, 6, -1, 0, lin('#f2c94a'));
    fill(g, 7, -3, 0, 7, 1, 0, lin('#f2c94a'));
    fill(g, 8, -3, 0, 8, -3, 0, lin('#f2c94a')); fill(g, 8, 1, 0, 8, 1, 0, lin('#f2c94a'));
    for (const x of [-3, 2]) fill(g, x, -6, -2, x + 1, -5, 3, dark);
    fill(g, -5, -2, -1, -4, 0, 1, lin('#557818')); fill(g, 4, -2, -1, 4, 0, 1, lin('#557818'));
    return g;
  },
  // Wood block: a block with a sounding slot, and its mallet.
  'tick-wood': () => {
    const g = new Grid(THUMB_VOXEL);
    fill(g, -8, 0, -4, 8, 5, 4, (_x, y, z) => lin(y === 5 ? '#e6b884' : z === 4 ? '#c08a52' : '#a87440'));
    fill(g, -6, 2, 4, 6, 3, 4, lin('#4a2e14'));
    for (let i = 0; i < 7; i++) fill(g, 2 + i, 6 + i, 0, 2 + i, 6 + i, 1, lin('#e6d2a4'));
    ball(g, 10, 14, 0.5, 2.6, 2.6, 2.6, tone3('#9a2a18', '#d9542b', '#ff8a5a', 3));
    return g;
  },
  // Cowbell: off the dairy cow's collar.
  'tick-cowbell': () => {
    const g = new Grid(THUMB_VOXEL), brass = tone3('#8a6a3a', '#c9a66b', '#f0dcae', 8);
    for (let y = 0; y <= 10; y++) {
      const hx = Math.round(6.5 - y * 0.28), hz = Math.round(4.4 - y * 0.16);
      fill(g, -hx, y, -hz, hx, y, hz, y === 0 ? () => lin('#7a5a30') : brass);
    }
    fill(g, -2, 11, 0, -2, 13, 0, lin('#6b4a2a')); fill(g, 2, 11, 0, 2, 13, 0, lin('#6b4a2a')); fill(g, -2, 14, 0, 2, 14, 0, lin('#6b4a2a'));
    ball(g, 0, -1.6, 0, 1.6, 1.6, 1.6, lin('#5a4a3a'));
    return g;
  },
  // Sleigh bells: three on a leather strap.
  'tick-sleigh': () => {
    const g = new Grid(THUMB_VOXEL), gold = tone3('#a87a1f', '#e0b13a', '#ffe08a', 7);
    fill(g, -11, 7, -1, 11, 8, 1, (_x, y) => lin(y === 8 ? '#a86a3a' : '#7a4a2a'));
    for (const cx of [-7, 0, 7]) {
      fill(g, cx, 5, 0, cx, 6, 0, lin('#6b4a2a'));
      ball(g, cx, 1.5, 0, 3.3, 3.3, 3.3, gold);
      const z = front(g, cx, 0) ?? 3;
      for (const x of [cx - 1, cx, cx + 1]) g.set(x, 0, z, lin('#5a3f12'));
    }
    return g;
  },
  // Barn owl: a round owl with its pale heart of a face.
  'tick-owl': () => {
    const g = new Grid(THUMB_VOXEL), tan = tone3('#9a7a4e', '#c9a678', '#e6cfa6', 8);
    ball(g, 0, 0, 0, 5.6, 7, 5, (x, y, z) => (hash3(x, y, z, 5) < 0.12 ? lin('#8a6a3e') : tan(x, y, z)));
    for (let x = -4; x <= 4; x++) for (let y = -1; y <= 5; y++) {
      const heart = Math.abs(x) <= 4 - Math.max(0, 1 - y) && !(y === 5 && x === 0);
      const z = front(g, x, y);
      if (heart && z !== null && z >= 2) g.set(x, y, z, lin('#fff6e6'));
    }
    for (const x of [-2, 2]) for (const y of [2, 3]) { const z = front(g, x, y); if (z !== null) g.set(x, y, z, lin('#2b2420')); }
    for (const y of [0, 1]) { const z = front(g, 0, y); if (z !== null) { g.set(0, y, z, lin('#e08a2a')); if (y === 1) g.set(0, y, z + 1, lin('#e08a2a')); } }
    for (const x of [-2, 2]) fill(g, x - 1, -8, 1, x, -8, 3, lin('#e08a2a'));
    return g;
  },
  // Music box: the farmer's, lid open, with its crank.
  'tick-musicbox': () => {
    const g = new Grid(THUMB_VOXEL), wood = tone3('#6a3c1c', '#8a5228', '#b8763a', 9), gold = lin('#f2c94a');
    fill(g, -7, 0, -4, 7, 5, 4, wood);
    fill(g, -6, 5, -3, 6, 5, 3, lin('#b02a44'));
    fill(g, -7, 6, -5, 7, 13, -5, tone3('#8a5228', '#b8763a', '#d99a5a', 9));
    fill(g, -6, 7, -4, 6, 12, -4, lin('#c8324a'));
    for (const x of [-7, 7]) for (const z of [-4, 4]) fill(g, x, 0, z, x, 5, z, gold);
    fill(g, -3, 2, 5, 3, 3, 5, gold); g.set(0, 2, 5, lin('#6a3c1c'));
    fill(g, -4, 6, -1, 4, 6, 0, gold);
    for (const x of [-3, -1, 1, 3]) g.set(x, 7, 0, lin('#fff3c2'));
    fill(g, 8, 2, 0, 9, 2, 0, lin('#d8d8d8')); fill(g, 9, 3, 0, 9, 5, 0, lin('#d8d8d8')); fill(g, 10, 5, 0, 11, 5, 0, lin('#ff7a8a'));
    return g;
  },
  // Lullaby: a sleepy crescent moon and two stars.
  'tick-lullaby': () => {
    const g = new Grid(THUMB_VOXEL);
    for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
      if (Math.hypot(x, y) <= 8 && Math.hypot(x - 3.6, y - 1.4) > 6.3) for (let z = -1; z <= 1; z++) g.set(x, y, z, lin(z === 1 ? (Math.hypot(x, y) > 6.9 ? '#ffd76a' : '#ffe9a3') : '#e0b13a'));
    }
    const star = (x: number, y: number, c: string) => { g.set(x, y, 0, lin(c)); g.set(x + 1, y, 0, lin(c)); g.set(x - 1, y, 0, lin(c)); g.set(x, y + 1, 0, lin(c)); g.set(x, y - 1, 0, lin(c)); };
    star(5, 4, '#ffffff');
    star(8, -3, '#d9c8ff');
    return g;
  },
};
export function soundGrid(id: string): Grid {
  return (SOUNDS[id] ?? SOUNDS['tick-chime'])();
}

// ---------------------------------------------------------------- sacks

/** What is printed on each sack's label (5 x 5): a bomb, a burst, a note. */
const SACK_MARK: Record<SackId, string[]> = {
  bomb: ['...#.', '..#..', '.###.', '#####', '.###.'],
  blast: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  tick: ['..##.', '..#.#', '..#..', '.##..', '.##..'],
};

/**
 * A tied burlap sack on the bomb's own voxel size (the first ones were built twice as fine and looked like another
 * game beside the bombs): plain burlap lit from the upper left, a rope at the neck, and a paper label printed with
 * what is inside. 0.64 m tall.
 */
export function sackGrid(sack: SackId): Grid {
  const { burlap, shade, print } = SACKS[sack];
  const g = new Grid(SACK_VOXEL);
  const base = lin(burlap), dark = lin(shade), light = mix(lin(burlap), lin('#fff4dc'), 0.5);
  for (let y = 0; y <= 15; y++) {
    let rx: number;
    if (y <= 11) rx = 7 * Math.sqrt(Math.max(0.15, 1 - ((y - 4.5) / 8) ** 2));
    else if (y === 12) rx = 2.5;
    else rx = 3 + (y - 13) * 0.6;
    if (y === 0) rx *= 0.86;
    const rz = rx * 0.78;
    for (let x = -8; x <= 8; x++) for (let z = -7; z <= 7; z++) {
      // A squarer section than an ellipse, so the front is flat enough for the label.
      if (Math.abs((x + 0.5) / rx) ** 2.6 + Math.abs((z + 0.5) / rz) ** 2.6 > 1) continue;
      const l = lit(x, y - 6, z, 8);
      g.set(x, y, z, y === 12 ? lin('#6b4a2a') : l > 0.5 ? light : l > -0.25 ? base : dark);
    }
  }
  // The knot and its loose end.
  fill(g, 2, 12, 2, 3, 13, 2, lin('#8a6238'));
  g.set(3, 11, 2, lin('#8a6238'));
  // The label, and its mark.
  const paper = lin('#f6ecd4'), ink = lin(print);
  for (let x = -4; x <= 2; x++) for (let y = 2; y <= 8; y++) { const z = front(g, x, y); if (z !== null) g.set(x, y, z, paper); }
  SACK_MARK[sack].forEach((row, r) => [...row].forEach((px, c) => {
    const x = -3 + c, y = 7 - r, z = front(g, x, y);
    if (px === '#' && z !== null) g.set(x, y, z, ink);
  }));
  return g;
}

/** Each sack's grain, pale to dark: oats, corn, barley. The crates in the stall are heaped with it (stallModels.ts). */
export const GRAIN: Record<SackId, [string, string, string]> = { bomb: ['#f6ebc6', '#e6d39a', '#cdb878'], blast: ['#ffe066', '#f5bd2a', '#d99a1a'], tick: ['#c79a58', '#a47636', '#7d5626'] };
