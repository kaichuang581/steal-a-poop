import type { Shot } from './layout';
import { buildGeometry, packGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import type { RGB } from '../voxel/primitives';
import { detailed } from '../voxel/refine';

/**
 * The lobby is a sheep pen in a mountain meadow on a winter night: a three-rail fence with a shut gate, a hay rack and
 * a water trough along the back rail, tufts of grass showing through the straw. Round it, nothing built: pines,
 * boulders, bushes, the meadow rising to a wooded ridge, and mountains behind under the
 * moon. Everyone who has joined is inside until the host opens the gate. +y is up and the camera looks toward +z from
 * the gate side.
 *
 * Brian, 2026-11-14, twice: "make the scenery for the pen thing bigger and better ... also make it look more like an
 * actual pen", and then, of a pen with a barn and a silo behind it: "i said to make the pen better, higher quality
 * firstly no house, just make it more natural scenery everything needs to be better". So no buildings, and the camera
 * stands at a person's height, nearly level, so that the country behind the pen is in the picture and not just the
 * ground.
 */
export const PEN = {
  halfX: 5, halfZ: 3,
  /** The gate in the front rail, shut until the game starts. */
  gate: 1.8,
  /** The tall lantern post at the back-left corner, and the small lantern on the gate's right post. */
  lamp: [-5, 2.6, 3] as const,
  gateLamp: [0.9, 1.5, -3] as const,
  rack: [1.9, 0, 2.45] as const,
  trough: [-2.4, 0, 2.5] as const,
  /** Where grass shows through the snow: the animals walk up to these and graze. */
  grass: [[-3.7, -1.5], [-1.9, 0.5], [0.3, -1.9], [2.5, -0.8], [3.9, 0.8], [-3.9, 1.0], [1.1, 1.0], [-0.7, -0.5], [3.6, -2.0], [-2.5, -2.1]] as readonly (readonly [number, number])[],
};
/** The ground the animals keep to: inside the rails, clear of the rack and the trough along the back. */
export const PEN_WALK = { x: PEN.halfX - 0.75, z0: -PEN.halfZ + 0.75, z1: PEN.halfZ - 1.35 };

/** Where the i-th animal starts (ten places: five in front, five behind, filled from the middle out), facing the gate. */
export function penSpot(i: number): { x: number; z: number; yaw: number } {
  const col = [0, -1, 1, -2, 2][i % 5];
  const back = i >= 5;
  // Spread over the whole pen from the start, so a full lobby does not open on a huddle in the middle.
  const x = col * 1.9 + (back ? 0.4 : 0);
  const z = back ? 0.9 : -1.2;
  return { x, z, yaw: Math.PI - x * 0.06 + (hash3(i, 0, 0, 5) - 0.5) * 0.3 }; // the model's front is +z; the camera is at -z
}

/**
 * The shot: from a tall person's height and nearly level, far enough back that the pen takes the middle three fifths
 * of the width. The animals' backs and heads clear the front rail, and the ridge, the mountains and a strip of sky
 * stand over them. (Lower, and the fence hid the animals; higher, and there was no country in the picture.) A phone stands further back because it is narrow.
 */
export function penShot(phone: boolean): Shot {
  return phone
    ? { position: [0, 2.7, -31.4], target: [0, 2.2, 0], fov: 40 }
    : { position: [0, 2.7, -19], target: [0, 2.18, 0], fov: 31 };
}

let built: ReturnType<typeof make> | null = null;
/** The static place, built once. */
export function buildPen() {
  return (built ??= make());
}

function make() {
  const made = { ground: ground(), land: land(), ...trees(), nature: nature(), mountains: mountains(), ...fence() };
  for (const g of Object.values(made)) packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
  return made;
}

/** The meadow is level round the pen; from ten metres behind it the ground climbs, in long swells, to the ridge. */
const hill = (x: number, z: number) => (z < 10 ? 0 : (z - 10) * 0.046 + (Math.sin(x * 0.07 + 1) + Math.sin(x * 0.031 + z * 0.05)) * 0.55 * Math.min(1, (z - 10) / 14));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const STRAW = ['#D8BE7A', '#C9AD68', '#B89A58'] as const;
const EARTH = ['#8E7C68', '#7F6E5C', '#6F5F50'] as const;
const GRASS = ['#86AB62', '#6E9A52', '#5D8746'] as const;

/**
 * The ground. Inside the rails it is a pen floor: straw bedding with snow lying in it, earth showing where
 * the animals stand most (the gate, the trough, the rack). Outside, clean snow with soft drifts. Top surface at y = 0.
 */
function ground() {
  const g = new Grid(0.2);
  const near = (x: number, z: number, px: number, pz: number, r: number) => Math.hypot(x - px, z - pz) < r;
  for (let gx = -60; gx <= 60; gx++) {
    for (let gz = -40; gz <= 45; gz++) {
      const x = gx * g.size, z = gz * g.size;
      const inside = Math.abs(x) < PEN.halfX && Math.abs(z) < PEN.halfZ;
      const r = hash3(gx, 0, gz, 3);
      let c: RGB = pick(T.snow, r, [0.5, 0.85]);
      if (inside) {
        // Bedded with straw, trodden, with snow lying in it here and there: a floor a white sheep shows against.
        const patch = hash3(gx >> 2, 1, gz >> 2, 5);
        c = hash3(gx, 2, gz, 6) > 0.3 + patch * 0.35 ? mix(pick(STRAW, hash3(gx, 3, gz, 7)), lin(EARTH[1]), 0.25 + patch * 0.3) : lin(patch > 0.5 ? '#DCE4EE' : '#C6D0DE');
        // Worn to earth by hooves: at the gate, along the trough and under the rack.
        const worn = near(x, z, 0, -PEN.halfZ + 0.4, 1.3) || near(x, z, PEN.trough[0], PEN.trough[2] - 0.7, 1.3) || near(x, z, PEN.rack[0], PEN.rack[2] - 0.8, 1.5);
        if (worn && hash3(gx, 4, gz, 8) > 0.42) c = mix(pick(EARTH, hash3(gx, 5, gz, 9)), lin('#C6D0DE'), 0.25);
      }
      g.set(gx, -1, gz, c);
    }
  }
  const r = rng(7);
  for (let i = 0; i < 20; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 7;
    const w = 0.9 + r() * 1.8;
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7 + 1;
    if (Math.abs(x) < PEN.halfX + 2 && z < 6) continue; // not against the pen
    ellipsoid(g, [x, -0.1, z], [w, 0.34, w * 0.7], (px, py, pz) => pick(T.snow, hash3(px, py, pz, 9), [0.55, 0.9]), 0.15, i + 1);
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** The country beyond the near ground: snow on the swells of `hill`, out to the ridge and well to either side. */
function land() {
  const g = new Grid(1);
  for (let x = -90; x <= 90; x++) {
    for (let z = -22; z <= 96; z++) {
      if (Math.abs(x) < 12 && z > -8 && z < 9) continue; // the near ground is finer, and its own
      const top = Math.round(hill(x, z)) - 1;
      for (let y = top - 2; y <= top; y++) g.set(x, y, z, lin(hash3(x, y, z, 13) > 0.5 ? '#E6EDF6' : '#D5DFEC'));
    }
  }
  return buildGeometry(g.map, g.size);
}

type Tree = readonly [x: number, z: number, height: number];
/** A pine: a trunk, and boughs in tiers that narrow to the top, each tier's edge ragged and its top laden with snow. */
function pine(g: Grid, [x, z, h]: Tree, i: number) {
  const s = g.size, y0 = hill(x, z);
  const bare = Math.max(s * 2, h * 0.14);
  box(g, [x - s, y0, z - s], [x + s, y0 + bare + s, z + s], (a, b, c) => pick(T.trunk, hash3(a, b, c, 18 + i)));
  for (let y = bare; y < h; y += s) {
    const k = (y - bare) / (h - bare);
    // Three or four voxels to a tier: widest at its foot, drawn in under the tier above.
    const tier = ((y - bare) / s) % 4;
    const w = Math.max(s, (1 - k) * h * 0.24 * (1 - tier * 0.16));
    box(g, [x - w, y0 + y, z - w], [x + w, y0 + y + s, z + w], (a, b, c) => {
      const edge = Math.max(Math.abs(a * s - x), Math.abs(c * s - z)) > w - s * 1.5;
      if (edge && hash3(a, b, c, 19 + i) > 0.62) return null;
      return (tier === 0 || edge) && hash3(a, b, c, 20 + i) > 0.45 - k * 0.2 ? pick(T.snow, hash3(a, 0, c, 21)) : pick(T.pine, hash3(a, b, c, 23), [0.4, 0.8]);
    });
  }
}
/**
 * The trees. Close by, drawn fine: tall pines either side of the pen that frame the picture and young ones in the
 * meadow behind. Far off, drawn coarse: the wood along the ridge.
 */
function trees() {
  const near = new Grid(0.25), far = new Grid(0.5);
  const r = rng(17);
  ([[-11.5, 7, 9], [12.5, 8, 9.5], [-9.2, 4.6, 3.4], [9.8, 5.4, 3.8],
    [-5.2, 7.2, 2.6], [3.2, 11.2, 3], [-2.6, 16, 3.4], [-12, 17, 4.6], [11.5, 19, 4.4]] as Tree[]).forEach((t, i) => pine(near, t, i));
  for (let i = 0; i < 64; i++) {
    const x = (r() * 2 - 1) * 78, z = 34 + r() * 56;
    pine(far, [x, z, 3.8 + r() * 2.6], 40 + i);
  }
  return { trees: buildGeometry(near.map, near.size), wood: buildGeometry(far.map, far.size) };
}

/**
 * What lies about on the ground: boulders with snow on them, low evergreen bushes, and dead grass standing
 * through the snow of the meadow.
 */
function nature() {
  const g = new Grid(0.125);
  const snowTop = (a: number, b: number, c: number) => pick(T.snow, hash3(a, b, c, 61), [0.55, 0.9]);
  ([[-6.7, -0.9, 0.7], [-7.5, 0.2, 0.45], [6.9, 1.4, 0.8], [-9.6, 6.4, 1]] as const).forEach(([x, z, w], i) => {
    ellipsoid(g, [x, w * 0.45, z], [w, w * 0.7, w * 0.8], (a, b, c) => pick(T.stone, hash3(a >> 1, b >> 1, c >> 1, 62 + i), [0.45, 0.8]), 0.2, 3 + i);
    ellipsoid(g, [x, w * 1.02, z], [w * 0.8, w * 0.22, w * 0.62], snowTop, 0.15, 13 + i);
  });
  ([[6.7, -1.7, 0.55], [-6.5, 3.2, 0.65]] as const).forEach(([x, z, w], i) => {
    ellipsoid(g, [x, w * 0.6, z], [w, w * 0.7, w], (a, b, c) => pick(T.pine, hash3(a >> 1, b, c >> 1, 64 + i)), 0.3, 23 + i);
    ellipsoid(g, [x, w * 1.15, z], [w * 0.85, w * 0.28, w * 0.85], snowTop, 0.25, 33 + i);
  });
  // Tufts of dead grass standing through the snow of the meadow: thin blades, straw-coloured.
  const blade = (x: number, z: number, h: number, seed: number) => box(g, [x, hill(x, z), z], [x + 0.125, hill(x, z) + h, z + 0.125], (a, b, c) => pick(STRAW, hash3(a, b, c, seed)));
  for (let k = 0; k < 90; k++) {
    // Behind the pen and out to its sides only: in front of it, this close, a blade of grass is a plank.
    const cx = (hash3(k, 4, 0, 70) * 2 - 1) * 18, cz = -2 + hash3(k, 5, 0, 71) * 24;
    if (Math.abs(cx) < 6.2 && cz < 3.7) continue;
    for (let b = 0; b < 4; b++) blade(cx + (hash3(k, b, 1, 72) - 0.5) * 0.5, cz + (hash3(k, b, 2, 73) - 0.5) * 0.5, 0.15 + hash3(k, b, 3, 74) * 0.3, 75);
  }
  return buildGeometry(g.map, g.size);
}

/** The range behind everything: far, tall and blue with distance, snow from the shoulders up, a saddle for the moon. */
function mountains() {
  const g = new Grid(4);
  for (let x = -75; x <= 75; x++) {
    const wx = x * 4;
    const saddle = Math.exp(-(((wx + 70) / 46) ** 2)) * 15;
    const top = 16 + Math.abs(Math.sin(wx * 0.0125 + 0.9)) * 16 + Math.sin(wx * 0.041) * 5 + hash3(x, 0, 0, 81) * 4 - saddle;
    for (let y = 0; y * 4 < top; y++) {
      const high = y * 4 > top - 9 - hash3(x, y, 0, 82) * 5;
      g.set(x, y, 78, lin(high ? (hash3(x, y, 0, 83) > 0.5 ? '#E3EAF5' : '#C9D5E6') : hash3(x, y, 0, 84) > 0.5 ? '#6B7790' : '#5A657C'));
    }
  }
  return buildGeometry(g.map, g.size);
}

/**
 * The pen itself: posts every metre and a quarter, three rails, low enough to see the animals over; the gate shut across the
 * front, braced like a barn door; the hay rack and the water trough along the back; the tufts of grass; and two
 * lanterns, one on the tall post at the back corner and one on the gate post.
 */
function fence() {
  const g = new Grid(0.1);
  const glow = new Grid(0.1);
  const wood = (a: number, b: number, c: number) => pick(T.beam, hash3(a >> 1, b, c >> 1, 31), [0.45, 0.85]);
  const dark = (a: number, b: number, c: number) => pick(T.trunk, hash3(a >> 1, b, c >> 1, 32), [0.45, 0.85]);
  const snow = (a: number, b: number, c: number) => (hash3(a, b, c, 33) > 0.22 ? pick(T.snow, hash3(a, 0, c, 35)) : null);
  const iron = () => lin('#3B3734');
  const X = PEN.halfX, Z = PEN.halfZ, G = PEN.gate / 2;
  const RAILS = [0.2, 0.45, 0.7];
  const post = (x: number, z: number, h = 0.9) => {
    box(g, [x - 0.1, 0, z - 0.1], [x + 0.1, h, z + 0.1], dark);
    box(g, [x - 0.1, h, z - 0.1], [x + 0.1, h + 0.1, z + 0.1], (a, b, c) => pick(T.snow, hash3(a, b, c, 37)));
  };
  // Snow lies along the top rail at the back and the sides; the front rail is bare, so it does not hide the animals.
  const railX = (x0: number, x1: number, z: number, bare = false) => {
    for (const y of RAILS) box(g, [x0, y, z - 0.05], [x1, y + 0.1, z + 0.05], wood);
    if (!bare) box(g, [x0, 0.8, z - 0.05], [x1, 0.9, z + 0.05], snow);
  };
  const railZ = (z0: number, z1: number, x: number) => {
    for (const y of RAILS) box(g, [x - 0.05, y, z0], [x + 0.05, y + 0.1, z1], wood);
    box(g, [x - 0.05, 0.8, z0], [x + 0.05, 0.9, z1], snow);
  };
  railX(-X, X, Z);
  railZ(-Z, Z, -X);
  railZ(-Z, Z, X);
  railX(-X, -G, -Z, true);
  railX(G, X, -Z, true);
  for (let x = -X; x <= X + 0.01; x += 1.25) { post(x, Z); if (Math.abs(x) > G + 0.3) post(x, -Z); }
  for (let z = -Z + 1.2; z < Z - 0.3; z += 1.2) { post(-X, z); post(X, z); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * X, sz * Z, 1.1);
  // The gate: two tall posts, and between them a shut gate of three boards in a frame with a brace from corner to
  // corner.
  for (const s of [-1, 1]) post(s * G, -Z, 1.25);
  const gz = -Z - 0.05;
  box(g, [-G + 0.12, 0.12, gz - 0.05], [G - 0.12, 0.24, gz + 0.05], wood);
  box(g, [-G + 0.12, 0.76, gz - 0.05], [G - 0.12, 0.88, gz + 0.05], wood);
  for (const x of [-G + 0.12, G - 0.24]) box(g, [x, 0.12, gz - 0.05], [x + 0.12, 0.88, gz + 0.05], wood);
  box(g, [-G + 0.24, 0.45, gz - 0.02], [G - 0.24, 0.55, gz + 0.04], wood);
  for (let k = 0; k <= 14; k++) {
    const t = k / 14, x = -G + 0.24 + t * (PEN.gate - 0.6), y = 0.24 + t * 0.44;
    box(g, [x, y, gz - 0.08], [x + 0.14, y + 0.1, gz - 0.02], dark);
  }
  // Hay rack on the back rail: a slatted crib full of hay, snow on top, hay dropped under it.
  const [rx, , rz] = PEN.rack;
  for (const sx of [-1.0, 1.0]) for (const sz of [-0.25, 0.25]) box(g, [rx + sx - 0.05, 0, rz + sz - 0.05], [rx + sx + 0.05, 1.0, rz + sz + 0.05], dark);
  box(g, [rx - 1.05, 0.45, rz - 0.3], [rx + 1.05, 0.55, rz + 0.3], wood);
  for (let sx = -0.9; sx <= 0.91; sx += 0.3) box(g, [rx + sx - 0.03, 0.55, rz - 0.3], [rx + sx + 0.03, 0.95, rz - 0.24], wood);
  box(g, [rx - 1.05, 0.9, rz - 0.3], [rx + 1.05, 1.0, rz - 0.22], wood);
  box(g, [rx - 0.95, 0.55, rz - 0.24], [rx + 0.95, 0.98, rz + 0.25], (a, b, c) => pick(T.hay, hash3(a, b, c, 41), [0.4, 0.85]));
  box(g, [rx - 0.95, 0.98, rz - 0.22], [rx + 0.95, 1.08, rz + 0.25], snow);
  box(g, [rx - 0.8, 0, rz - 0.75], [rx + 0.7, 0.1, rz - 0.35], (a, b, c) => (hash3(a, b, c, 43) > 0.35 ? pick(T.hay, hash3(a, b, c, 45)) : null));
  // Water trough: a long wooden box, the water iced over.
  const [tx, , tz] = PEN.trough;
  box(g, [tx - 0.9, 0, tz - 0.3], [tx + 0.9, 0.5, tz + 0.3], wood);
  box(g, [tx - 0.8, 0.4, tz - 0.2], [tx + 0.8, 0.5, tz + 0.2], (a, b, c) => pick(T.ice, hash3(a, b, c, 49)));
  // Grass: a tuft of blades at each place, some bent, the tallest in the middle.
  PEN.grass.forEach(([px, pz], i) => {
    for (let k = 0; k < 9; k++) {
      const dx = (hash3(i, k, 0, 51) - 0.5) * 0.7, dz = (hash3(i, k, 1, 52) - 0.5) * 0.6;
      const h = 0.1 + Math.round(hash3(i, k, 2, 53) * 3 * (1 - Math.hypot(dx, dz))) * 0.1;
      box(g, [px + dx, 0, pz + dz], [px + dx + 0.1, h, pz + dz + 0.1], (a, b, c) => pick(GRASS, hash3(a, b, c, 54 + i)));
    }
  });
  // The tall lantern post at the back corner: a post, an arm, the lantern hanging from it.
  const [lx, ly, lz] = PEN.lamp;
  box(g, [lx - 0.1, 1.1, lz - 0.1], [lx + 0.1, ly + 0.5, lz + 0.1], dark);
  box(g, [lx - 0.1, ly + 0.4, lz - 0.8], [lx + 0.1, ly + 0.5, lz - 0.1], dark);
  box(g, [lx - 0.1, ly + 0.5, lz - 0.8], [lx + 0.1, ly + 0.6, lz + 0.1], snow);
  box(g, [lx - 0.05, ly + 0.2, lz - 0.7], [lx + 0.05, ly + 0.4, lz - 0.6], iron);
  box(glow, [lx - 0.15, ly - 0.15, lz - 0.8], [lx + 0.15, ly + 0.2, lz - 0.5], (a, b, c) => pick(T.lantern, hash3(a, b, c, 47)));
  // The gate lantern: sitting on the right-hand gate post.
  const [qx, qy, qz] = PEN.gateLamp;
  box(glow, [qx - 0.1, qy - 0.15, qz - 0.1], [qx + 0.1, qy + 0.1, qz + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 48)));
  const fine = detailed(g.map, g.size);
  return { fence: buildGeometry(fine.map, fine.size), glow: buildGeometry(glow.map, glow.size) };
}
