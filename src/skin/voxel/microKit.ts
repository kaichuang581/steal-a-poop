/**
 * The micro kit (docs/miniature/04, section 6): nineteen kinds of small object, cube by cube, each part one solid
 * colour from the ladders of paint.ts. Sizes are in cubes of 0.05 m. Objects are pure: the same options give the same
 * cubes. The kit is closed: nothing is added here without asking Brian.
 *
 * Where an object goes against a wall, the wall is on its z = 0 side unless its note says otherwise.
 */
import { MICRO } from './micro';
import type { MicroObject } from './micro';
import { solid } from './paint';
import type { Mat } from './paint';
import { Grid } from './primitives';

type Opt = Record<string, unknown>;
const grid = () => new Grid(MICRO);
/** An inclusive box of cubes in one colour. */
function box(g: Grid, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: Mat, step = 0) {
  const c = solid(mat, step);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) g.set(x, y, z, c);
}
/** A cube's distance from an upright centre line at (cx, cz), in cubes. */
const from = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
/** A row of cubes round a centre line: every cube `inner` < distance <= `outer`. */
function disc(g: Grid, w: number, y: number, outer: number, mat: Mat, step = 0, inner = -1) {
  const c = solid(mat, step);
  for (let x = 0; x < w; x++) for (let z = 0; z < w; z++) { const d = from(x, z, w / 2, w / 2); if (d <= outer && d > inner) g.set(x, y, z, c); }
}
const made = (name: string, size: [number, number, number], cubes: Grid, lit?: Grid): MicroObject => ({ name, size, cubes, ...(lit ? { lit } : {}) });

/** K1. A slatted crate, lidded (option `snow`) or open with `contents` 'apples' or 'carrots'. */
function crateOf(open: boolean, o: Opt): MicroObject {
  const g = grid();
  box(g, 1, 8, 0, 7, 1, 8, 'darkWood', -1); // the dark inside, seen through the two gaps
  for (const y of [0, 1, 3, 4, 6, 7]) {
    for (let x = 1; x <= 8; x++) for (const z of [0, 9]) g.set(x, y, z, solid('wood', 0));
    for (let z = 1; z <= 8; z++) for (const x of [0, 9]) g.set(x, y, z, solid('wood', 1));
  }
  for (const x of [0, 9]) for (const z of [0, 9]) box(g, x, x, 0, 7, z, z, 'wood', -1);
  if (!open) {
    box(g, 0, 9, 8, 8, 0, 9, 'wood', 1);
    if (o.snow) box(g, 0, 9, 9, 9, 0, 9, 'snow', 1);
    return made('crate', [10, o.snow ? 10 : 9, 10], g);
  }
  for (let x = 1; x <= 8; x++) for (let z = 1; z <= 8; z++)
    g.set(x, 7, z, o.contents === 'carrots' ? solid('carrot', z % 2 ? -1 : 0) : solid('scarfRed', (x + z) % 2 ? 1 : 0));
  return made('crateOpen', [10, 8, 10], g);
}

/** K2. A barrel of sixteen staves under two iron hoops, its lid set in (option `snow` fills the recess). */
function barrel(o: Opt): MicroObject {
  const g = grid();
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) {
    const d = from(x, z, 5, 5);
    if (d > 5) continue;
    const stave = Math.floor(((Math.atan2(z + 0.5 - 5, x + 0.5 - 5) + Math.PI) / (2 * Math.PI)) * 16) % 2;
    for (let y = 0; y <= 13; y++) {
      if (y === 13 && d <= 4) { if (o.snow) g.set(x, y, z, solid('snow', 1)); continue; }
      g.set(x, y, z, y === 12 && d <= 4 ? solid('wood', -1) : (y === 2 || y === 11) && d > 4 ? solid('iron', 0) : solid('wood', stave ? -1 : 0));
    }
  }
  return made('barrel', [10, 14, 10], g);
}

/** K3. A milk can: body, shoulder, neck, lid, and a handle on each side at the shoulder. */
function milkCan(): MicroObject {
  const g = grid();
  for (let y = 0; y <= 8; y++) disc(g, 6, y, 3.0, 'stone', 1);
  for (const y of [9, 10]) disc(g, 6, y, 2.2, 'stone', 0);
  disc(g, 6, 11, 1.6, 'stone', -1);
  disc(g, 6, 12, 2.2, 'stone', 1);
  for (const x of [0, 5]) box(g, x, x, 9, 10, 2, 3, 'iron', 0); // beside the shoulder, standing on the body's top row
  return made('milkCan', [6, 13, 6], g);
}

/** K4. A pail: `contents` 'ice' (frozen water), 'hay' (feed) or 'empty'. */
function pail(o: Opt): MicroObject {
  const g = grid();
  for (const y of [0, 1]) disc(g, 6, y, 2.2, 'stone', 0);
  for (let y = 2; y <= 5; y++) disc(g, 6, y, 3.0, 'stone', y === 5 ? 1 : 0);
  if (o.contents === 'empty') {
    for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) if (from(x, z, 3, 3) <= 2) g.del(x, 5, z);
    disc(g, 6, 4, 2.0, 'stone', -2);
  } else disc(g, 6, 5, 2.0, o.contents === 'hay' ? 'hay' : 'ice', 0);
  return made('pail', [6, 6, 6], g);
}

/** K5. A feed sack lying down, a red stripe round its middle, its neck tied. */
function sack(): MicroObject {
  const g = grid();
  for (let x = 0; x <= 7; x++) for (let y = 0; y <= 4; y++) for (let z = 0; z <= 4; z++) {
    if (y === 4 && (z === 0 || z === 4)) continue;
    g.set(x, y, z, x === 3 || x === 4 ? solid('scarfRed', 0) : solid('straw', -1));
  }
  box(g, 6, 7, 5, 5, 2, 2, 'straw', -2);
  return made('sack', [8, 6, 5], g);
}

/** Where a leaning handle stands at height `y`: its foot four cubes (0.2 m) out from the wall, a cube nearer every seven up. */
const lean = (y: number) => Math.max(0, 4 - Math.floor(y / 7));

/** K6. A pitchfork leaning on a wall: handle, cross bar, three tines. */
function pitchfork(): MicroObject {
  const g = grid();
  for (let y = 0; y < 28; y++) g.set(2, y, lean(y), solid('wood', 1));
  box(g, 0, 4, 28, 28, 0, 0, 'iron', 1);
  for (const x of [0, 2, 4]) box(g, x, x, 29, 32, 0, 0, 'iron', 1);
  return made('pitchfork', [5, 33, 5], g);
}

/** K7. A shovel leaning on a wall, blade down. */
function shovel(): MicroObject {
  const g = grid();
  box(g, 0, 3, 0, 4, 4, 4, 'stone', -1);
  for (let y = 5; y < 29; y++) g.set(1, y, lean(y), solid('wood', 1));
  box(g, 0, 2, 29, 29, 0, 0, 'wood', 0);
  return made('shovel', [4, 30, 5], g);
}

/** K8. A broom leaning on a wall, head down. */
function broom(): MicroObject {
  const g = grid();
  box(g, 0, 4, 0, 3, 3, 4, 'straw', -1);
  box(g, 0, 4, 4, 4, 3, 4, 'scarfRed', 0);
  for (let y = 5; y < 29; y++) g.set(2, y, lean(y), solid('wood', 1));
  return made('broom', [5, 29, 5], g);
}

/** K9. A lantern on an iron arm out of a wall, hanging a cube clear of it. Its glass is drawn glowing (`lit`); it casts no light. */
function wallLantern(): MicroObject {
  const g = grid(), lit = grid();
  box(g, 1, 1, 5, 5, 0, 3, 'iron', 0); // the arm
  box(g, 0, 2, 4, 4, 1, 3, 'iron', 0);
  box(g, 0, 2, 0, 0, 1, 3, 'iron', 0);
  for (let x = 0; x <= 2; x++) for (let z = 1; z <= 3; z++) for (let y = 1; y <= 3; y++)
    (x !== 1 && z !== 2 ? g : lit).set(x, y, z, x !== 1 && z !== 2 ? solid('iron', 0) : solid('brass', 2));
  return made('wallLantern', [3, 6, 4], g, lit);
}

/** K10. A square bale: two end faces, two twine bands, snow on top if asked. */
function squareBale(o: Opt): MicroObject {
  const g = grid();
  for (let x = 0; x < 18; x++) for (let y = 0; y < 9; y++) for (let z = 0; z < 9; z++) {
    const surface = y === 0 || y === 8 || z === 0 || z === 8;
    g.set(x, y, z, solid('hay', x === 0 || x === 17 ? -1 : surface && (x === 5 || x === 12) ? -2 : 0));
  }
  if (o.snow) box(g, 0, 17, 9, 9, 0, 8, 'snow', 1);
  return made('squareBale', [18, o.snow ? 10 : 9, 9], g);
}

/** K10. A heap of loose hay in four layers. The top layer is two cubes deep: the plan's inset of five would leave none of a depth of ten. */
function hayHeap(): MicroObject {
  const g = grid();
  ([[0, 0], [1, 1], [3, 3], [5, 4]] as const).forEach(([ix, iz], y) => box(g, ix, 13 - ix, y, y, iz, 9 - iz, 'hay', y ? 1 : 0));
  return made('hayHeap', [14, 4, 10], g);
}

/** K11. A chopping block with an axe sunk in its top. */
function choppingBlock(): MicroObject {
  const g = grid();
  for (let y = 0; y <= 5; y++) { disc(g, 8, y, 4.0, 'darkWood', 0, 3.0); disc(g, 8, y, 3.0, 'wood', 2); }
  box(g, 3, 4, 5, 5, 3, 4, 'wood', 0); // the heart of the log
  box(g, 3, 5, 5, 7, 4, 4, 'stone', -1); // the head, its lowest row in the wood
  for (let i = 0; i < 9; i++) g.set(4 + Math.floor(i / 3), 8 + i, 4, solid('wood', 1));
  return made('choppingBlock', [8, 17, 8], g);
}

/** K12. Split logs: three side by side and one on top, their cut ends pale. */
function splitLogs(): MicroObject {
  const g = grid();
  const log = (y0: number, z0: number, step: number) => {
    for (let x = 0; x < 12; x++) for (let y = y0; y < y0 + 3; y++) for (let z = z0; z < z0 + 3; z++) g.set(x, y, z, x === 0 || x === 11 ? solid('wood', 2) : solid('darkWood', step));
  };
  log(0, 0, 0), log(0, 3, -1), log(0, 6, 0), log(3, 2, -1);
  return made('splitLogs', [12, 6, 9], g);
}

/**
 * K13. A hand pump: slab, body, cap, a spout out of its front (+z) and a handle rising out of its back. Twelve cubes
 * deep, not the plan's nine: a spout of three and a handle of six do not fit a depth of nine round a body of three.
 */
function handPump(): MicroObject {
  const g = grid();
  box(g, 0, 4, 0, 0, 5, 9, 'stone', -1);
  box(g, 1, 3, 1, 14, 6, 8, 'pine', -1);
  box(g, 1, 3, 15, 15, 6, 8, 'pine', 0);
  box(g, 2, 2, 10, 11, 9, 11, 'pine', -1);
  g.set(2, 9, 11, solid('pine', -1));
  for (let i = 0; i < 6; i++) g.set(2, 15 + Math.floor(i / 2), 5 - i, solid('iron', 0));
  g.set(2, 18, 0, solid('iron', 0)); // the grip, with the handle's last cube under it
  return made('handPump', [5, 19, 12], g);
}

/** K14. A cart wheel standing upright against a wall, two cubes thick: rim, eight spokes, an iron hub. */
function cartWheel(): MicroObject {
  const g = grid();
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
    // The level and upright spokes are the two rows either side of the middle (sixteen cubes have no middle row).
    const spoke = x === y || x + y === 15 || x === 7 || x === 8 || y === 7 || y === 8;
    const c = d <= 1.6 ? solid('iron', 0) : d > 7 && d <= 8 ? solid('wood', -1) : d <= 7 && spoke ? solid('wood', 1) : null;
    if (c) for (const z of [0, 1]) g.set(x, y, z, c);
  }
  return made('cartWheel', [16, 16, 2], g);
}

/** K15. A bench, its back at z = 6: two end frames, three seat boards, two back rails; snow on the two rear boards if asked. */
function bench(o: Opt): MicroObject {
  const g = grid();
  for (let x = 0; x < 20; x++) {
    box(g, x, x, 8, 8, 0, 1, 'wood', 0), box(g, x, x, 8, 8, 2, 4, 'wood', 1), box(g, x, x, 8, 8, 5, 6, 'wood', 0);
    box(g, x, x, 10, 11, 6, 6, 'wood', 0), box(g, x, x, 13, 13, 6, 6, 'wood', 1);
    if (o.snow) box(g, x, x, 9, 9, 2, 5, 'snow', 1);
  }
  for (const x of [1, 18]) {
    box(g, x, x, 0, 7, 0, 0, 'wood', -1);
    box(g, x, x, 0, 13, 6, 6, 'wood', -1);
    box(g, x, x, 3, 3, 1, 5, 'wood', -1);
  }
  return made('bench', [20, 14, 7], g);
}

/** K16. A basket of five eggs. */
function eggBasket(): MicroObject {
  const g = grid();
  disc(g, 6, 0, 3.0, 'straw', -2);
  for (const y of [1, 2]) disc(g, 6, y, 3.0, 'straw', -2, 2.0);
  disc(g, 6, 2, 2.0, 'straw', -1);
  for (const [x, z] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]) g.set(x, 2, z, solid('trimWhite', 1));
  for (const x of [0, 5]) box(g, x, x, 3, 5, 2, 2, 'straw', -2);
  box(g, 0, 5, 6, 6, 2, 2, 'straw', -2);
  return made('eggBasket', [6, 7, 6], g);
}

/** K17. A pair of skates, the second a quarter turn from the first (eight cubes wide for it, not the plan's six). */
function skates(): MicroObject {
  const g = grid();
  box(g, 0, 0, 0, 0, 0, 4, 'stone', 2);
  box(g, 0, 1, 1, 2, 0, 3, 'trimWhite', -1), box(g, 0, 1, 3, 3, 0, 3, 'scarfRed', 0);
  box(g, 3, 7, 0, 0, 1, 1, 'stone', 2);
  box(g, 3, 6, 1, 2, 0, 1, 'trimWhite', -1), box(g, 3, 6, 3, 3, 0, 1, 'scarfRed', 0);
  return made('skates', [8, 4, 5], g);
}

/** K18. A shutter `h` cubes tall (as tall as its window's frame): boards, and two battens a cube proud of them. */
function shutter(o: Opt): MicroObject {
  const h = Math.max(8, Math.round(Number(o.h ?? 36))), g = grid();
  box(g, 0, 5, 0, h - 1, 0, 0, 'pine', -1);
  for (const y of [Math.round(h / 4), Math.round((h * 3) / 4)]) box(g, 0, 5, y, y, 1, 1, 'pine', 0);
  return made('shutter', [6, h, 2], g);
}

// K19. Fittings.
function strapHinge(): MicroObject { const g = grid(); box(g, 0, 5, 0, 1, 0, 0, 'iron', 0); return made('strapHinge', [6, 2, 1], g); }
function latch(): MicroObject { const g = grid(); box(g, 0, 3, 0, 0, 0, 0, 'iron', 0); g.set(3, 0, 1, solid('brass', 0)); return made('latch', [4, 1, 2], g); }
function knob(): MicroObject { const g = grid(); box(g, 0, 1, 0, 1, 0, 1, 'brass', 0); return made('knob', [2, 2, 2], g); }
function horseshoe(): MicroObject {
  const g = grid();
  box(g, 1, 3, 0, 0, 0, 0, 'iron', 1);
  for (const x of [0, 4]) box(g, x, x, 1, 4, 0, 0, 'iron', 1);
  return made('horseshoe', [5, 5, 1], g);
}
/** A coil of rope hanging on a peg out of the wall: the peg under the top of the ring's hole. */
function ropeCoil(): MicroObject {
  const g = grid();
  for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) { const d = Math.hypot(x + 0.5 - 3, y + 0.5 - 3); if (d > 1.6 && d <= 3) g.set(x, y, 1, solid('straw', -2)); }
  box(g, 3, 3, 4, 4, 0, 1, 'iron', 0);
  return made('ropeCoil', [6, 6, 2], g);
}
/** The hoist's rope, sixteen cubes, with a hook of three at its end. */
function hoistRope(): MicroObject {
  const g = grid();
  box(g, 0, 0, 3, 18, 0, 0, 'straw', -2);
  box(g, 0, 0, 1, 2, 0, 0, 'iron', 0), g.set(1, 1, 0, solid('iron', 0));
  return made('hoistRope', [2, 19, 1], g);
}
function cleat(o: Opt): MicroObject { const w = Math.max(2, Math.round(Number(o.w ?? 6))), g = grid(); box(g, 0, w - 1, 0, 0, 0, 0, 'wood', 1); return made('cleat', [w, 1, 1], g); }

/** Every kind in the kit, by name. */
export const KIT: Record<string, (options?: Opt) => MicroObject> = {
  crate: (o = {}) => crateOf(false, o), crateOpen: (o = {}) => crateOf(true, o), barrel: (o = {}) => barrel(o), milkCan, pail: (o = {}) => pail(o), sack,
  pitchfork, shovel, broom, wallLantern, squareBale: (o = {}) => squareBale(o), hayHeap, choppingBlock, splitLogs, handPump, cartWheel,
  bench: (o = {}) => bench(o), eggBasket, skates, shutter: (o = {}) => shutter(o),
  strapHinge, latch, knob, horseshoe, ropeCoil, hoistRope, cleat: (o = {}) => cleat(o),
};
