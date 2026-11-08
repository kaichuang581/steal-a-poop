import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, Grid, hash3 } from '../voxel/primitives';
import type { V3 } from '../voxel/primitives';
import { DUEL } from './duel';
import { FARM, ORCHARD_TIPS } from './farmstead';
import { BARN, YARD } from './layout';

/**
 * The farm dressed for the Fleece Navidad update: a tree by the barn doors and a small one inside, presents, lights on
 * the beam, the gable and the yard fence, a wreath, candy canes down the path and a hat for the snowman. Nothing here
 * touches the barn or the yard: it is all laid over them, so taking it down is one line in `Farm`.
 */

const GLOW = ['#E8402E', '#3FBF5F', '#FFC24B'] as const;
export const BULB_COLORS = GLOW;
/** Twinkle groups per colour. Each bulb joins one at random, and each group keeps its own time (Festive.tsx). */
export const BULB_GROUPS = 5;
const RED = '#C8342E';
const GOLD = T.brass[0];
const STAR = ['...#...', '...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];

export interface FestiveGeometry {
  decor: BufferGeometry;
  /** One geometry per BULB_COLORS, so each colour can twinkle on its own. */
  /** BULB_GROUPS geometries per colour, colour by colour, so the lights can twinkle out of step. */
  bulbs: BufferGeometry[];
  /** Gold stars, which hold steady. */
  star: BufferGeometry;
}

class Dressing {
  readonly decor = new Grid(0.1);
  readonly glow = Array.from({ length: GLOW.length * BULB_GROUPS }, () => new Grid(0.1));
  readonly stars = new Grid(0.1);
  private n = 0;

  /** A bulb in the next colour, 0.2 m across unless it is for something the camera gets close to. */
  bulb(x: number, y: number, z: number, size = 0.2) {
    const i = this.n++ % GLOW.length, r = size / 2;
    const group = Math.floor(hash3(Math.round(x * 10), Math.round(y * 10), Math.round(z * 10), 97) * BULB_GROUPS);
    box(this.glow[i * BULB_GROUPS + group], [x - r, y - r, z - r], [x + r, y + r, z + r], () => lin(GLOW[i]));
  }

  /** A wire hung from `a` to `b`, sagging `droop` metres in the middle, with a bulb every `every` metres. */
  strand(a: V3, b: V3, droop: number, every = 0.6, bulb = 0.2) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const steps = Math.max(1, Math.round(length / 0.1));
    const bulbEvery = Math.max(1, Math.round(every / 0.1));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t - droop * 4 * t * (1 - t);
      box(this.decor, [x, y, z], [x + 0.1, y + 0.1, z + 0.1], () => lin(T.face[2]));
      if (i % bulbEvery === bulbEvery >> 1) this.bulb(x + 0.05, y - bulb / 2, z + 0.05, bulb);
    }
  }

  /** A fir in tiers, snow on each tier's shelf, a spiral of baubles and a gold star. */
  tree(x: number, z: number, height: number, topped = true, bauble = 0.2) {
    const g = this.decor;
    const trunk = height * 0.1;
    box(g, [x - 0.2, 0, z - 0.2], [x + 0.2, trunk + 0.2, z + 0.2], (a, b, c) => pick(T.trunk, hash3(a, b, c, 71)));
    const widest = height * 0.34;
    const radiusAt = (y: number) => {
      const t = (y - trunk) / (height - trunk);
      return widest * (1 - t) * (0.7 + 0.3 * (1 - ((t * 5) % 1)));
    };
    for (let y = trunk; y < height; y += 0.1) {
      const r = radiusAt(y);
      const shelf = radiusAt(y + 0.1) < r - 0.12;
      for (let dx = -r; dx <= r; dx += 0.1) {
        for (let dz = -r; dz <= r; dz += 0.1) {
          const d = Math.hypot(dx, dz);
          if (d > r || (d < r - 0.5 && r > 0.5)) continue; // a shell: nothing sees the middle
          box(g, [x + dx, y, z + dz], [x + dx + 0.1, y + 0.1, z + dz + 0.1], (a, b, c) => {
            const snowy = shelf && d > r - 0.4 && hash3(a, 0, c, 73) > 0.35;
            return snowy ? pick(T.snow, hash3(a, b, c, 75)) : pick(T.pine, hash3(a, b, c, 77));
          });
        }
      }
    }
    for (let i = 0, count = Math.round(height * 7); i < count; i++) {
      const y = trunk + 0.3 + (i / count) * (height - trunk - 0.7);
      const r = radiusAt(y) + 0.05, a = i * 2.4;
      this.bulb(x + Math.cos(a) * r, y, z + Math.sin(a) * r, bauble);
    }
    if (topped) this.star(x, height - 0.2, z);
  }

  /** A gold star, steady while the bulbs twinkle, standing on `y`. */
  star(x: number, y: number, z: number) {
    const star = this.stars;
    STAR.forEach((row, r) => [...row].forEach((cell, c) => {
      if (cell !== '#') return;
      const across = (c - 3) * 0.1, up = y + (STAR.length - r) * 0.1;
      // Two crossed faces, so it is a star from every side.
      box(star, [x + across, up, z], [x + across + 0.1, up + 0.1, z + 0.1], () => lin(GOLD));
      box(star, [x, up, z + across], [x + 0.1, up + 0.1, z + across + 0.1], () => lin(GOLD));
    }));
  }

  /** A row of lights hung in swags from `a` to `b`, one swag every `span` metres. */
  swags(a: V3, b: V3, span: number, droop: number, every?: number) {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / span));
    const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    for (let i = 0; i < n; i++) this.strand(at(i / n), at((i + 1) / n), droop, every);
  }

  /** A plain post for lights to hang from. */
  post(x: number, z: number, height: number) {
    box(this.decor, [x - 0.1, 0, z - 0.1], [x + 0.1, height, z + 0.1], (a, b, c) => pick(T.beam, hash3(a, b, c, 83)));
  }

  /** A red stocking with a white cuff, its toe pointing along x. */
  stocking(x: number, y: number, z: number, toe: number) {
    const g = this.decor;
    box(g, [x - 0.1, y, z], [x + 0.2, y + 0.5, z + 0.1], () => lin(RED));
    box(g, [x - 0.1 + toe * 0.1, y, z], [x + 0.2 + toe * 0.2, y + 0.2, z + 0.1], () => lin(RED));
    box(g, [x - 0.2, y + 0.5, z], [x + 0.3, y + 0.7, z + 0.1], () => lin(T.snow[1]));
  }

  /** A wrapped box with a ribbon each way and a knot on top. */
  present(x: number, z: number, w: number, h: number, wrap: string, ribbon: string, base = 0) {
    const g = this.decor;
    const cx = Math.round(x / 0.1), cz = Math.round(z / 0.1);
    box(g, [x - w / 2, base, z - w / 2], [x + w / 2, base + h, z + w / 2], (a, _, c) => lin(a === cx || c === cz ? ribbon : wrap));
    box(g, [x - 0.1, base + h, z - 0.1], [x + 0.2, base + h + 0.1, z + 0.2], () => lin(ribbon));
  }

  /** A candy cane stuck in the snow, its hook turned along x. */
  cane(x: number, z: number, side: number) {
    const stripe = (i: number) => lin(i % 4 < 2 ? RED : T.snow[1]);
    const g = this.decor;
    const top = 11;
    for (let i = 0; i <= top; i++) box(g, [x, i * 0.1, z], [x + 0.2, i * 0.1 + 0.1, z + 0.2], () => stripe(i));
    [[1, 1], [2, 2], [3, 2], [4, 1], [4, 0]].forEach(([dx, dy], k) => {
      const hx = x + side * dx * 0.1, hy = (top + dy) * 0.1;
      box(g, [hx, hy, z], [hx + 0.2, hy + 0.1, z + 0.2], () => stripe(top + k + 1));
    });
  }

  /** A ring of pine with berries and a red bow, facing along z. */
  wreath(x: number, y: number, z: number) {
    const g = this.decor;
    for (let dx = -0.6; dx <= 0.6; dx += 0.1) {
      for (let dy = -0.6; dy <= 0.6; dy += 0.1) {
        const d = Math.hypot(dx, dy);
        if (d < 0.3 || d > 0.6) continue;
        box(g, [x + dx, y + dy, z], [x + dx + 0.1, y + dy + 0.1, z + 0.2], (a, b, c) => (hash3(a, b, c, 79) > 0.86 ? lin(RED) : pick(T.pine, hash3(a, b, c, 81))));
      }
    }
    box(g, [x - 0.3, y - 0.7, z - 0.1], [x + 0.4, y - 0.5, z + 0.3], () => lin(RED));
    box(g, [x - 0.1, y - 0.9, z - 0.1], [x + 0.2, y - 0.7, z + 0.3], () => lin(RED));
  }

  /** The red hat with a white brim and bobble, for a head whose top is at `y`. */
  hat(x: number, y: number, z: number) {
    const g = this.decor;
    box(g, [x - 0.4, y, z - 0.4], [x + 0.4, y + 0.2, z + 0.4], () => lin(T.snow[1]));
    for (let i = 0; i < 6; i++) {
      const r = 0.32 - i * 0.05, lean = i * 0.04;
      box(g, [x + lean - r, y + 0.2 + i * 0.1, z - r], [x + lean + r, y + 0.3 + i * 0.1, z + r], () => lin(RED));
    }
    box(g, [x + 0.1, y + 0.8, z - 0.2], [x + 0.5, y + 1.1, z + 0.2], () => lin(T.snow[0]));
  }

  build(): FestiveGeometry {
    return { decor: buildGeometry(this.decor.map, 0.1), bulbs: this.glow.map((g) => buildGeometry(g.map, 0.1)), star: buildGeometry(this.stars.map, 0.1) };
  }
}

let farm: FestiveGeometry | null = null;
/** The farm's decorations, seen both from the table and from the start screen. */
export function buildFestive(): FestiveGeometry {
  if (farm) return farm;
  const d = new Dressing();
  // The big tree by the doors, with the presents heaped under it.
  d.tree(-4.2, BARN.maxZ + 2.2, 5);
  d.present(-3.1, BARN.maxZ + 3.2, 0.7, 0.5, T.collar[1], GOLD);
  d.present(-4.4, BARN.maxZ + 3.8, 0.9, 0.7, T.pine[1], T.snow[1]);
  d.present(-5.5, BARN.maxZ + 3.2, 0.6, 0.6, GOLD, T.collar[1]);
  // A small one in the corner of the barn for the table to see, clear of every seat.
  d.tree(4.5, BARN.maxZ - 1.6, 2.6);
  d.present(3.5, BARN.maxZ - 1.2, 0.5, 0.4, T.collar[1], GOLD);
  d.present(4.3, BARN.maxZ - 0.7, 0.6, 0.5, T.pine[1], T.snow[1]);
  // Lights: along the cross beam over the table, up the gable over the doors, and along the yard fence.
  d.strand([BARN.minX + 0.4, BARN.beamY - 0.1, 1.0], [-1.2, BARN.beamY - 0.1, 1.0], 0.45);
  d.strand([1.2, BARN.beamY - 0.1, 1.0], [BARN.maxX - 0.4, BARN.beamY - 0.1, 1.0], 0.45);
  const gableZ = BARN.maxZ + 0.5;
  d.strand([BARN.minX, BARN.wallHeight, gableZ], [0, BARN.ridgeHeight - 0.2, gableZ], 0.12, 0.5);
  d.strand([0, BARN.ridgeHeight - 0.2, gableZ], [BARN.maxX, BARN.wallHeight, gableZ], 0.12, 0.5);
  const { minX, maxX, gateHalfWidth, z: fenceZ } = YARD.fence;
  for (let x = minX; x < -gateHalfWidth; x += 3.6) d.strand([x, 1.45, fenceZ], [Math.min(x + 3.6, -gateHalfWidth), 1.45, fenceZ], 0.3);
  for (let x = gateHalfWidth; x < maxX; x += 3.6) d.strand([x, 1.45, fenceZ], [Math.min(x + 3.6, maxX), 1.45, fenceZ], 0.3);
  // A wreath over the doors, on the yard side and the table side.
  d.wreath(0, BARN.backDoor.height + 1.55, BARN.maxZ + 0.6); // on the hayloft door
  d.wreath(0, BARN.backDoor.height + 0.75, BARN.maxZ - 0.3);
  // Candy canes down both sides of the path.
  for (let z = BARN.maxZ + 3; z < YARD.fence.z - 1; z += 2.4) {
    d.cane(-YARD.path.halfWidth - 1.4, z, 1); // set back: the tour's path shot looks straight down this side
    d.cane(YARD.path.halfWidth + 0.3, z, -1);
  }
  d.hat(YARD.snowman.x, 2.92, YARD.snowman.z); // on the head's crown (the ball tops out at 2.96)
  // Round the barn walls, for the table's camera: swags down both sides and stockings either side of the doors.
  for (const side of [-1, 1]) {
    d.swags([side * (BARN.maxX - 0.25), 3.6, -3.4], [side * (BARN.maxX - 0.25), 3.6, BARN.maxZ - 0.6], 3.2, 0.4);
    for (const x of [2.7, 3.5]) d.stocking(side * x, 2.5, BARN.maxZ - 0.2, side);
  }
  // Out in the yard: the sled loaded, the farmhouse lit up, and lights round the pond. There is one Christmas tree on
  // this farm, by the barn doors, and one in the barn. The pines are just pines; more trees would only be noise.
  d.present(2.3, 13.5, 0.5, 0.4, T.collar[1], GOLD, 0.4);
  d.present(2.3, 14.1, 0.4, 0.3, T.pine[1], T.snow[1], 0.4);
  const { x: hx, z: hz } = YARD.farmhouse;
  d.swags([hx - 4, 3.05, hz - 3.5], [hx + 4, 3.05, hz - 3.5], 2.7, 0.22);
  d.wreath(hx, 2.1, hz - 3.3);
  const ring = 10;
  const { x: px, z: pz, rx, rz } = YARD.pond;
  const spot = (i: number): [number, number] => [px + Math.cos((i / ring) * Math.PI * 2) * (rx + 1.2), pz + Math.sin((i / ring) * Math.PI * 2) * (rz + 1)];
  for (let i = 0; i < ring; i++) {
    const [ax, az] = spot(i), [bx, bz] = spot(i + 1);
    d.post(ax, az, 1.6);
    d.strand([ax, 1.5, az], [bx, 1.5, bz], 0.28, 0.5);
  }
  return (farm = d.build());
}

let farmstead: FestiveGeometry | null = null;
/** The rest of the start screen's farm, so every stop on the tour has something of the season. Call after buildFarmstead. */
export function buildFarmFestive(): FestiveGeometry {
  if (farmstead) return farmstead;
  const d = new Dressing();
  // The barn's long sides, under the eaves.
  for (const side of [-1, 1]) d.swags([side * 6.7, 4.0, BARN.minZ + 0.4], [side * 6.7, 4.0, BARN.maxZ], 2.8, 0.2, 0.5);
  // The silo: lights wound round it from bottom to top.
  const { silo, coop, tractor, paddock: P } = FARM;
  const turns = 5, steps = turns * 12;
  const wound = (i: number): V3 => {
    const a = (i / 12) * Math.PI * 2;
    return [silo.x + Math.cos(a) * (silo.r + 0.3), 0.8 + (i / steps) * (silo.h - 1), silo.z + Math.sin(a) * (silo.r + 0.3)];
  };
  for (let i = 0; i < steps; i++) d.strand(wound(i), wound(i + 1), 0, 0.5);
  // The paddock: lights along its rails, on the hay rack and under the shed's eave.
  const rail = 1.25;
  d.swags([P.minX, rail, P.minZ], [P.minX, rail, P.maxZ], 3, 0.25);
  d.swags([P.minX, rail, P.maxZ], [15.4, rail, P.maxZ], 3, 0.25);
  d.swags([18.2, rail, P.maxZ], [P.maxX, rail, P.maxZ], 3, 0.25);
  d.swags([P.maxX, rail, P.minZ], [P.maxX, rail, P.maxZ], 3, 0.25);
  d.strand([15, 1.6, -3], [18.2, 1.6, -3], 0.15, 0.4);
  d.swags([12.8, 2.6, -9.9], [20.6, 2.6, -9.9], 2.6, 0.18);
  // The coop: lights along both eaves.
  for (const z of [coop.z + 1.75, coop.z - 1.85]) d.strand([coop.x - 2.2, 2.25, z], [coop.x + 2.2, 2.25, z], 0.16, 0.4);
  // The tractor: lights down both sides of the hood, and presents waiting to be loaded.
  for (const side of [-0.5, 0.5]) d.strand([tractor.x - 1.9, 1.5, tractor.z + side], [tractor.x + 0.6, 1.5, tractor.z + side], 0.02, 0.3, 0.1);
  d.present(tractor.x - 1.2, tractor.z + 2.1, 0.7, 0.6, T.collar[1], GOLD);
  d.present(tractor.x - 0.2, tractor.z + 2.4, 0.5, 0.4, T.pine[1], T.snow[1]);
  d.present(tractor.x + 0.6, tractor.z + 2.1, 0.6, 0.7, GOLD, T.collar[1]);
  // The orchard: the odd bauble left hanging on a branch.
  ORCHARD_TIPS.forEach(([x, y, z], i) => { if (i % 5 === 0) d.bulb(x, y - 0.2, z); });
  return (farmstead = d.build());
}

let bedroom: FestiveGeometry | null = null;
/** The farmer's bedroom, in the room's own coordinates: a small string of lights on the headboard and presents beside it. */
export function buildBedroomFestive(): FestiveGeometry {
  if (bedroom) return bedroom;
  const d = new Dressing();
  d.strand([-0.1, 1.2, -0.75], [-0.1, 1.2, 0.75], 0.12, 0.2, 0.1);
  d.present(-0.5, -0.3, 0.3, 0.2, T.collar[1], GOLD);
  d.present(-0.55, 0.15, 0.3, 0.3, T.pine[1], T.snow[1]);
  return (bedroom = d.build());
}

let bubble: FestiveGeometry | null = null;
/** The farmer's bubble (dream v4.1): lights along the headboard, presents by the foot of the bed where its camera sees them. */
export function buildBubbleFestive(): FestiveGeometry {
  if (bubble) return bubble;
  const d = new Dressing();
  d.strand([-0.1, 1.2, -0.75], [-0.1, 1.2, 0.75], 0.12, 0.2, 0.1);
  d.present(1.55, 0.95, 0.24, 0.2, T.collar[1], GOLD);
  d.present(1.25, 1.1, 0.2, 0.26, T.pine[1], T.snow[1]);
  return (bubble = d.build());
}

let duel: FestiveGeometry | null = null;
/** The ice gets a little of it too: lights between the lanterns and a tree at the far end. */
export function buildDuelFestive(): FestiveGeometry {
  if (duel) return duel;
  const d = new Dressing();
  const [left, right] = DUEL.lamps;
  d.strand([left[0], left[1] - 0.3, left[2]], [right[0], right[1] - 0.3, right[2]], 0.5, 0.7);
  d.tree(right[0] + 0.9, 0.4, 2.8);
  d.present(right[0] + 0.5, -0.8, 0.6, 0.5, T.collar[1], GOLD);
  return (duel = d.build());
}

let santa: BufferGeometry | null = null;
/** A sheep's hat on the sheep's own 0.04 m grid, brim at y = 0, drooping toward -z and to the side. */
export function santaHat(): BufferGeometry {
  if (santa) return santa;
  const g = new Grid(0.04);
  const red = (x: number, y: number, z: number) => pick(T.collar, hash3(x, y, z, 91));
  const white = (x: number, y: number, z: number) => pick(T.snow, hash3(x, y, z, 93));
  box(g, [-0.2, 0, -0.2], [0.2, 0.08, 0.2], white);
  for (let i = 0; i < 6; i++) {
    const r = 0.16 - i * 0.024, off = -i * 0.024, y = 0.08 + i * 0.04;
    box(g, [-r, y, off - r], [r, y + 0.04, off + r], red);
  }
  box(g, [-0.08, 0.28, -0.24], [0.08, 0.4, -0.12], white);
  return (santa = buildGeometry(g.map, 0.04));
}
