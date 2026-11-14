import { Color } from 'three';
import type { BufferGeometry } from 'three';
import { auraOf } from '../shop/bombAura';
import { BOMB_SHELL } from '../shop/shells';
import { bombChunk, bombModel, ICE_SHELL, shellGrid } from './bomb';
import type { BombShell } from './bomb';
import { buildGeometry } from './mesher';
import { lin } from './palette';
import { Grid, hash3 } from './primitives';
import type { RGB } from './primitives';

/**
 * The Trading Post's bomb skins as their own models (Brian, 2026-11-13: "diamond just looks like the default snowy bomb
 * ... everything needs to be differentiated, perhaps even remodel them slightly"). A skin used to be the ice bomb, voxel
 * for voxel, in other colours. Now each is its own thing on the ice bomb's grid: a cracked coal, a striped peppermint
 * in its wrapper, a plum with its leaf, a strapped and crowned gold orb, a cut diamond, a brass bell, a ball of night
 * sky. The ice bomb itself is untouched (voxel/bomb.ts).
 *
 * What every skin keeps, so the table can treat them all as the bomb: it stands on the floor (its lowest voxels are
 * row -5), it is about as wide as the ice bomb (5.5 voxels from its middle, a rim or a leaf a little more), and its
 * top is a neck whose middle voxel is on row 6, where the fuse stands. `glow` holds the voxels that shine by
 * themselves (a coal's cracks, a gem's edges, an aurora's bands): they are drawn as a second mesh with their own light.
 */
const S = 0.04;

export interface BombLook {
  body: BufferGeometry;
  /** The parts that shine by themselves, or null. */
  glow: BufferGeometry | null;
  /** Grows upward from the origin; scale y by the fuse left. */
  fuse: BufferGeometry;
  spark: BufferGeometry;
  /** One piece of its shell, for the burst. */
  chunk: BufferGeometry;
  /** What it leaves on the floor under it: flat, centred on the origin at floor level. */
  ground: BufferGeometry;
}
interface Built { body: Grid; glow: Grid | null }
interface Tones { deep: RGB; mid: RGB; pale: RGB; shine: RGB; frost: RGB; vein: RGB; neck: [RGB, RGB] }

/** A colour at full strength, for the parts that glow (`lin` takes 30% of the saturation off). */
const raw = (hex: string): RGB => { const c = new Color(hex); return [c.r, c.g, c.b]; };
const tones = (s: BombShell): Tones => ({
  deep: lin(s.deep), mid: lin(s.mid), pale: lin(s.pale), shine: lin(s.shine), frost: lin(s.frost), vein: lin(s.vein),
  neck: [lin((s.neck ?? ICE_SHELL.neck!)[0]), lin((s.neck ?? ICE_SHELL.neck!)[1])],
});
/** Light from the upper left front, about -1 to 1 across the bomb: the ice bomb's own rule. */
const lit = (x: number, y: number, z: number) => (-x * 0.5 + y * 0.6 + z * 0.6) / 5;
const shade = (t: Tones, x: number, y: number, z: number): RGB => { const l = lit(x, y, z); return l > 0.7 ? t.shine : l > 0.35 ? t.pale : l > -0.05 ? t.mid : t.deep; };
/** The ice bomb's own ball: cells -5 to 4 each way. */
const ball = (x: number, y: number, z: number, r = 5) => ((x + 0.5) / r) ** 2 + ((y + 0.5) / 5) ** 2 + ((z + 0.5) / r) ** 2 <= 1;
/** Runs `f` over every cell of a shape, rows -5 to 4. */
function each(inside: (x: number, y: number, z: number) => boolean, f: (x: number, y: number, z: number) => void) {
  for (let y = -5; y <= 4; y++) for (let x = -7; x <= 6; x++) for (let z = -7; z <= 6; z++) if (inside(x, y, z)) f(x, y, z);
}
/** The neck: a three by three block two rows high on the crown, chequered in two colours, with a collar round its foot. */
function neck(g: Grid, a: RGB, b: RGB, collar: RGB | null, to: Grid = g) {
  for (let y = 5; y <= 6; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) g.set(x, y, z, (x + z + y) % 2 ? a : b);
  if (collar) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((Math.abs(x) === 2 || Math.abs(z) === 2) && !(Math.abs(x) === 2 && Math.abs(z) === 2)) to.set(x, 5, z, collar);
}
/** How far round a cell is from +x, in radians. */
const around = (x: number, z: number) => Math.atan2(z + 0.5, x + 0.5);

/** Points spread evenly over a ball: the middles of a coal's plates. */
const PLATES = Array.from({ length: 12 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 12, r = Math.sqrt(1 - y * y), th = i * 2.39996;
  return [Math.cos(th) * r, y, Math.sin(th) * r] as const;
});

const SKINS: Record<string, (t: Tones) => Built> = {
  // A hot coal: a lumpy black crust broken into plates, the cracks between them glowing, ash on its crown.
  'bomb-ember': (t) => {
    const body = new Grid(S), glow = new Grid(S), hot = [raw('#ffb04a'), raw('#ff7a22'), raw('#f04a14')];
    each((x, y, z) => ((x + 0.5) / 5) ** 2 + ((y + 0.5) / 5) ** 2 + ((z + 0.5) / 5) ** 2 <= 1 + (hash3(x >> 1, y >> 1, z >> 1, 5) - 0.5) * 0.16, (x, y, z) => {
      const len = Math.hypot(x + 0.5, y + 0.5, z + 0.5) || 1;
      // A crack runs where two plates meet: where the two nearest plate middles are nearly as near as each other.
      let d1 = 9, d2 = 9;
      for (const [px, py, pz] of PLATES) { const d = 1 - ((x + 0.5) * px + (y + 0.5) * py + (z + 0.5) * pz) / len; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      if (d2 - d1 < 0.065) { const h = hash3(x, y, z, 9); glow.set(x, y, z, hot[h < 0.25 ? 0 : h < 0.7 ? 1 : 2]); return; }
      const l = lit(x, y, z);
      body.set(x, y, z, y >= 3 && hash3(x, y, z, 7) < 0.3 ? t.frost : l > 0.35 ? t.pale : l > -0.05 ? t.mid : t.deep);
    });
    neck(body, t.neck[0], t.neck[1], raw('#ff7a22'), glow);
    return { body, glow };
  },
  // A peppermint: white, with two broad green stripes winding round it, in a wrapper's ruff, on a candy-cane neck.
  'bomb-mint': (t) => {
    const body = new Grid(S), white = lin('#ffffff');
    each(ball, (x, y, z) => {
      const turn = (around(x, z) * 2) / Math.PI + (y + 0.5) * 0.3, s = ((turn % 2) + 2) % 2, l = lit(x, y, z);
      body.set(x, y, z, s < 0.95 ? (l > 0.35 ? t.pale : l > -0.05 ? t.mid : t.deep) : l > -0.05 ? white : t.frost);
    });
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d = Math.hypot(x, z); if (d <= 3.3 && d > 1.5) body.set(x, 5, z, (x + z) % 2 ? white : t.frost); }
    neck(body, t.neck[0], t.neck[1], null);
    return { body, glow: null };
  },
  // A plum: fuller below than above, a cleft down its front, a dusty bloom where the light falls, a stem and a leaf.
  'bomb-plum': (t) => {
    const body = new Grid(S);
    each((x, y, z) => { const r = 4.95 - 0.45 * ((y + 0.5) / 5); return ((x + 0.5) / r) ** 2 + ((z + 0.5) / r) ** 2 + ((y + 0.5) / 5) ** 2 <= 1; }, (x, y, z) => {
      body.set(x, y, z, lit(x, y, z) > 0.5 && hash3(x, y, z, 7) < 0.55 ? t.frost : shade(t, x, y, z));
    });
    for (let y = -4; y <= 4; y++) {
      let z = 6;
      while (z > 0 && !body.has(0, y, z)) z--;
      if (z > 0) { body.del(0, y, z); if (body.has(0, y, z - 1)) body.set(0, y, z - 1, t.deep); }
    }
    const leaf = lin('#4c8a3a'), rib = lin('#7ab85a'), calyx = lin('#3f6a34');
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) body.set(x, 5, z, calyx);
    for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) body.set(x, 6, z, (x + z) % 2 ? t.neck[0] : t.neck[1]);
    for (const [x, z] of [[-2, 0], [-3, -1], [-3, 0], [-3, 1], [-4, -1], [-4, 0], [-4, 1], [-5, 0]]) body.set(x, 6, z, z === 0 ? rib : leaf);
    body.set(-5, 5, 0, leaf);
    return { body, glow: null };
  },
  // Gold: a polished orb in two raised straps, one round its middle and one over its top, studded where they
  // meet the light, with a little crown round the fuse.
  'bomb-gold': (t) => {
    const body = new Grid(S), glow = new Grid(S), stud = raw('#ffe07a');
    const belt = (x: number, y: number, z: number) => (y === -1 || y === 0) && (x + 0.5) ** 2 + (z + 0.5) ** 2 <= 5.9 ** 2;
    const strap = (x: number, y: number, z: number) => (x === -1 || x === 0) && ((y + 0.5) / 5) ** 2 + ((z + 0.5) / 5.9) ** 2 <= 1;
    each((x, y, z) => ball(x, y, z) || belt(x, y, z) || strap(x, y, z), (x, y, z) => {
      const on = belt(x, y, z) || strap(x, y, z);
      // A stud every eighth of the way round the belt, on its raised edge.
      if (y === 0 && belt(x, y, z) && !ball(x, y, z)) { const a = around(x, z) / (Math.PI / 4); if (Math.abs(a - Math.round(a)) < 0.14) { glow.set(x, y, z, stud); return; } }
      body.set(x, y, z, on ? (lit(x, y, z) > 0.35 ? t.vein : t.deep) : shade(t, x, y, z));
    });
    neck(body, t.neck[0], t.neck[1], t.pale);
    for (const [x, z] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { body.set(x, 6, z, t.pale); glow.set(x, 7, z, stud); }
    return { body, glow };
  },
  // A cut diamond: eight-sided, a flat table on top, widest at the girdle, tapering to a point. Each facet has its own
  // tone, a few of them a faint colour; the girdle and the crown's ridges are what shines.
  'bomb-diamond': (t) => {
    const body = new Grid(S), glow = new Grid(S), R = [0.9, 1.7, 2.5, 3.3, 4.1, 4.9, 5.5, 5, 3.9, 2.8];
    const inside = (x: number, y: number, z: number) => { const r = R[y + 5]; return Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) <= r && Math.abs(x + 0.5) + Math.abs(z + 0.5) <= r * 1.42; };
    const crown = ['#e6f4ff', '#a8d8f6', '#cfeaff', '#f2d2ea', '#e6f4ff', '#98cef2', '#c4e4fc', '#b8eed8'].map(lin);
    const pavilion = ['#7cc2ee', '#b4def8', '#4fa6e2', '#98d0f4', '#ecd896', '#6ab8ea', '#bfe4fa', '#58aee6'].map(lin);
    const edge = raw('#ffffff'), dim = (c: RGB): RGB => [c[0] * 0.84, c[1] * 0.86, c[2] * 0.9];
    each(inside, (x, y, z) => {
      const a = around(x, z) / (Math.PI / 4), facet = ((Math.round(a) % 8) + 8) % 8, ridge = Math.abs(a - Math.round(a)) > 0.38;
      if (y === 4) { body.set(x, y, z, Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) < 1.2 ? t.mid : t.pale); return; }
      if (y === 1 && hash3(x, y, z, 3) < 0.5) { glow.set(x, y, z, edge); return; }
      if (y >= 2 && ridge) { glow.set(x, y, z, edge); return; }
      const c = y >= 1 ? crown[facet] : ridge ? t.deep : pavilion[facet];
      body.set(x, y, z, lit(x, y, z) < -0.2 ? dim(c) : c);
    });
    neck(body, t.neck[0], t.neck[1], lin('#d8dee6'));
    return { body, glow };
  },
  // The barn bell: a dome that waists and flares to a bright lip it stands on, two engraved bands, knobs on its shoulders.
  'bomb-brass': (t) => {
    const body = new Grid(S), R = [5.6, 5, 4.4, 4.1, 3.9, 3.8, 3.6, 3.2, 2.6, 1.8];
    each((x, y, z) => (x + 0.5) ** 2 + (z + 0.5) ** 2 <= R[y + 5] ** 2, (x, y, z) => {
      body.set(x, y, z, y === -5 ? (lit(x, y, z) > -0.3 ? t.frost : t.pale) : y === -3 || y === 2 ? t.vein : shade(t, x, y, z));
    });
    neck(body, t.neck[0], t.neck[1], null);
    for (const [x, z] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) body.set(x, 5, z, t.pale);
    return { body, glow: null };
  },
  // A ball of night sky: deep blue with stars in it, and two bands of aurora winding round it, green over violet.
  // The green one stands a voxel proud of the ball, and six rays of light rise off it like a curtain's top.
  'bomb-aurora': (t) => {
    const body = new Grid(S), glow = new Grid(S), star = lin('#ffffff');
    const green = [raw('#2fe08a'), raw('#22b8a8')], violet = [raw('#9a6af0'), raw('#6a5ae0')];
    const wave = (a: number) => 1.6 + 1.3 * Math.sin(a * 2 + 0.6);
    const ribbon = (x: number, y: number, z: number) => Math.abs(y + 0.5 - wave(around(x, z))) < 0.62;
    const proud = (x: number, y: number, z: number) => ((x + 0.5) / 5.9) ** 2 + ((y + 0.5) / 5.9) ** 2 + ((z + 0.5) / 5.9) ** 2 <= 1;
    each((x, y, z) => ball(x, y, z) || (proud(x, y, z) && ribbon(x, y, z)), (x, y, z) => {
      const a = around(x, z), h = hash3(x, y, z, 5) < 0.5 ? 0 : 1;
      if (ribbon(x, y, z)) { glow.set(x, y, z, green[h]); return; }
      if (Math.abs(y + 0.5 - (-1.7 + 1.0 * Math.sin(a * 3 + 2))) < 0.55) { glow.set(x, y, z, violet[h]); return; }
      const l = lit(x, y, z);
      body.set(x, y, z, hash3(x, y, z, 13) < 0.04 ? star : l > 0.6 ? t.pale : l > -0.05 ? t.mid : t.deep);
    });
    for (let k = 0; k < 6; k++) {
      // A ray stands on the ribbon's outermost voxel on that bearing, two or three voxels tall, green to violet.
      const a = (k / 6) * Math.PI * 2 + 0.4, y0 = Math.floor(wave(a));
      let d = 6.5, x = 0, z = 0;
      do { d -= 0.25; x = Math.floor(Math.cos(a) * d); z = Math.floor(Math.sin(a) * d); } while (d > 3 && !glow.has(x, y0, z));
      if (glow.has(x, y0, z)) for (let up = 1; up <= 2 + (k % 2); up++) glow.set(x, y0 + up, z, up === 1 ? green[k % 2] : violet[k % 2]);
    }
    neck(body, t.neck[0], t.neck[1], lin('#c8fff0'));
    return { body, glow };
  },
};

/**
 * What each skin leaves on the floor under it, one voxel thin and up to 12 voxels out, centred on the origin: the ice
 * bomb's is its frost; the others are their own thing, not that frost in another colour (Brian, 2026-11-13: "all the
 * bombs have like an ice thing on the ground which doesnt make sense for stuff like fire"). Painted in full; the
 * table only fades it in and out.
 */
const GROUNDS: Record<string, (g: Grid, d: (x: number, z: number) => number) => void> = {
  // A scorch: a ragged black burn with long tongues, ash in it, and embers still glowing at its edge.
  'bomb-ember': (g, d) => {
    const char = [lin('#17100d'), lin('#241a16'), lin('#33261f')], ash = lin('#7a6f68'), hot = [raw('#ff7a22'), raw('#ffb04a')];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
      const r = d(x, z), a = Math.atan2(z, x), reach = 0.5 + 0.4 * Math.abs(Math.sin(a * 3.5 + 1)) + (hash3(x, 0, z, 3) - 0.5) * 0.2;
      if (r > reach) continue;
      const h = hash3(x, 1, z, 5);
      g.set(x, 0, z, r > reach - 0.22 && h < 0.2 ? hot[h < 0.08 ? 1 : 0] : h > 0.93 ? ash : char[r < 0.3 ? 0 : h < 0.55 ? 1 : 2]);
    }
  },
  // Sugar: a scatter of white crystals with the odd green and red one, thinning outward. No disc at all.
  'bomb-mint': (g, d) => {
    const bits = [lin('#ffffff'), lin('#ffffff'), lin('#eafff6'), lin('#6fd3a8'), lin('#e8475a')];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
      const r = d(x, z);
      if (r <= 1 && hash3(x, 0, z, 3) < 0.3 * (1 - r * 0.75)) g.set(x, 0, z, bits[Math.floor(hash3(x, 1, z, 7) * bits.length)]);
    }
  },
  // A small pool of juice, and three leaves that came down with it.
  'bomb-plum': (g, d) => {
    const juice = [lin('#2e1250'), lin('#4a2478'), lin('#7a48b8')], leaf = lin('#4c8a3a'), rib = lin('#7ab85a');
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
      const r = d(x, z), a = Math.atan2(z, x);
      if (r <= 0.5 + 0.09 * Math.sin(a * 3 + 0.5)) g.set(x, 0, z, juice[r < 0.2 ? 0 : -x + z > 3 && r > 0.3 ? 2 : 1]);
    }
    for (const [cx, cz, turn] of [[8, 5, 0], [-9, 2, 1], [1, -10, 0]]) for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
      if (Math.abs(i) === 2 && j !== 0) continue;
      g.set(cx + (turn ? j : i), 0, cz + (turn ? i : j), j === 0 ? rib : leaf);
    }
  },
  // Coins: a few gold pieces lying where they rolled, in a dusting of gold.
  'bomb-gold': (g, d) => {
    const gold = lin('#f0c84a'), face = lin('#fff0b0'), rim = lin('#c9981f'), dust = lin('#f8dc7a');
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) { const r = d(x, z); if (r <= 1 && hash3(x, 0, z, 3) < 0.1 * (1 - r * 0.6)) g.set(x, 0, z, dust); }
    for (const [cx, cz] of [[7, 3], [-6, 6], [-8, -3], [2, -9], [9, -5], [-1, 9], [5, 9]]) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      g.set(cx + i, 0, cz + j, i === 0 && j === 0 ? face : Math.abs(i) + Math.abs(j) === 2 ? rim : gold);
    }
  },
  // Light thrown through a gem: eight thin rays in the palest colours, each ending in a bright fleck.
  'bomb-diamond': (g, d) => {
    const tints = ['#ffffff', '#ffd6f0', '#d6f0ff', '#fff6c8', '#d6ffe8', '#e0d6ff', '#ffffff', '#cfeeff'].map(lin);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, long = k % 2 ? 9 : 12;
      for (let i = 4; i <= long; i++) g.set(Math.round(Math.cos(a) * i), 0, Math.round(Math.sin(a) * i), i >= long - 1 ? lin('#ffffff') : tints[k]);
    }
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) { const r = d(x, z); if (r > 0.3 && r <= 1 && hash3(x, 0, z, 3) < 0.035) g.set(x, 0, z, tints[Math.floor(hash3(x, 1, z, 7) * tints.length)]); }
  },
  // A bell's note: two thin rings on the floor round it, like the rings in a pond.
  'bomb-brass': (g, d) => {
    const brass = [lin('#dcae40'), lin('#b08428')];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
      const r = d(x, z);
      if ((Math.abs(r - 0.56) < 0.045 || Math.abs(r - 0.92) < 0.04) && hash3(x, 0, z, 3) > 0.1) g.set(x, 0, z, brass[hash3(x, 1, z, 5) < 0.5 ? 0 : 1]);
    }
  },
  // A pool of the aurora's light: arms of green and violet winding out of the middle, lacy at the rim.
  'bomb-aurora': (g, d) => {
    const green = [raw('#2fe08a'), raw('#22b8a8')], violet = [raw('#9a6af0'), raw('#6a5ae0')];
    for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
      const r = d(x, z), a = Math.atan2(z, x);
      if (r > 0.95 || hash3(x, 0, z, 3) < r * r * 0.7) continue;
      const arm = (((a / Math.PI) * 1.5 + r * 2.4) % 2 + 2) % 2, h = hash3(x, 1, z, 5) < 0.5 ? 0 : 1;
      g.set(x, 0, z, arm < 1 ? green[h] : violet[h]);
    }
  },
};
/** A skin's ground mark as voxels (the ice bomb's is built in voxel/bomb.ts). For the tests. */
export function groundGrid(id: string): Grid | null {
  const make = GROUNDS[id];
  if (!make) return null;
  const g = new Grid(S);
  make(g, (x, z) => Math.hypot(x, z) / 12);
  return g;
}

/** A skin's voxels: its lit shell and the parts that glow. The ice bomb's are the ice bomb. For the tests and the tools. */
export function bombSkinGrids(id: string): Built {
  const shell = BOMB_SHELL[id] ?? ICE_SHELL, make = SKINS[id];
  return make ? make(tones(shell)) : { body: shellGrid(shell), glow: null };
}

const looks = new Map<string, BombLook>();
/** A skin's meshes, built once: its shell, its glowing parts, its fuse and spark in its own colours, a piece of it for the burst. */
export function bombLook(id: string): BombLook {
  let look = looks.get(id);
  if (!look) {
    const { body, glow } = bombSkinGrids(id), aura = auraOf(id);
    const f = new Grid(S);
    for (let i = 0; i < 10; i++) f.set(i > 6 ? 1 : 0, i, 0, lin(aura.fuse[i % 2 ? 1 : 0]));
    const sp = new Grid(S);
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) sp.set(x, y, z, lin(aura.spark[x + y + z === 1 ? 1 : 0]));
    look = {
      body: buildGeometry(body.map, S).translate(-S / 2, -S / 2, -S / 2),
      glow: glow && glow.count ? buildGeometry(glow.map, S).translate(-S / 2, -S / 2, -S / 2) : null,
      fuse: buildGeometry(f.map, S).translate(-S / 2, 0, -S / 2),
      spark: buildGeometry(sp.map, S).translate(-S, -S, -S),
      chunk: bombChunk(id, BOMB_SHELL[id] ?? ICE_SHELL),
      ground: ((gr) => (gr ? buildGeometry(gr.map, S, { ao: false }).translate(-S / 2, 0, -S / 2) : bombModel().frost))(groundGrid(id)),
    };
    looks.set(id, look);
  }
  return look;
}

let glint: BufferGeometry | null = null;
/** A glint: a small four-pointed star, flat, to be turned to the camera. Half a voxel fine, so it reads as light, not as a thing. */
export function glintGeometry(): BufferGeometry {
  if (!glint) {
    const g = new Grid(0.012), white: RGB = [1, 1, 1];
    for (let i = -4; i <= 4; i++) { g.set(i, 0, 0, white); g.set(0, i, 0, white); }
    for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.set(x, y, 0, white);
    glint = buildGeometry(g.map, 0.012, { ao: false }).translate(-0.006, -0.006, -0.006);
  }
  return glint;
}
