import type { BufferGeometry } from 'three';
import { buildGeometry, packGeometry } from '../voxel/mesher';
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
  /** Every decoration's voxel box, in metres, as drawn (the scale chart, plan file 04, section 4.4, measures these). */
  parts: FestivePart[];
}

export type FestiveKind = 'tree' | 'star' | 'bulb' | 'strand' | 'post' | 'stocking' | 'present' | 'cane' | 'wreath' | 'hat';
export interface FestivePart { kind: FestiveKind; min: V3; max: V3 }

/** A grid that tells its dressing which cells are set, so each decoration's box is the voxels it really drew. */
class Tracked extends Grid {
  constructor(size: number, private readonly note: (x: number, y: number, z: number) => void) { super(size); }
  override set(x: number, y: number, z: number, c: [number, number, number]) {
    super.set(x, y, z, c);
    this.note(x, y, z);
  }
}

class Dressing {
  private readonly open: { kind: FestiveKind; lo: number[]; hi: number[] }[] = [];
  private readonly note = (x: number, y: number, z: number) => {
    for (const o of this.open) [x, y, z].forEach((v, k) => { o.lo[k] = Math.min(o.lo[k], v); o.hi[k] = Math.max(o.hi[k], v); });
  };
  readonly parts: FestivePart[] = [];
  readonly decor = new Tracked(0.1, this.note);
  readonly glow = Array.from({ length: GLOW.length * BULB_GROUPS }, () => new Tracked(0.1, this.note));
  readonly stars = new Tracked(0.1, this.note);
  private n = 0;

  /** Draws one decoration and keeps the box of the cells it set (all grids are 0.1 m). */
  private item<R>(kind: FestiveKind, draw: () => R): R {
    const o = { kind, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
    this.open.push(o);
    try {
      return draw();
    } finally {
      this.open.pop();
      if (o.lo[0] <= o.hi[0]) this.parts.push({ kind, min: o.lo.map((v) => v * 0.1) as unknown as V3, max: o.hi.map((v) => (v + 1) * 0.1) as unknown as V3 });
    }
  }

  /** A bulb in the next colour, 0.2 m across unless it is for something the camera gets close to. */
  bulb(x: number, y: number, z: number, size = 0.2) {
    this.item('bulb', () => {
      const i = this.n++ % GLOW.length, r = size / 2;
      const group = Math.floor(hash3(Math.round(x * 10), Math.round(y * 10), Math.round(z * 10), 97) * BULB_GROUPS);
      box(this.glow[i * BULB_GROUPS + group], [x - r, y - r, z - r], [x + r, y + r, z + r], () => lin(GLOW[i]));
    });
  }

  /** A wire hung from `a` to `b`, sagging `droop` metres in the middle, with a bulb every `every` metres. */
  strand(a: V3, b: V3, droop: number, every = 0.6, bulb = 0.2) {
    this.item('strand', () => this.wire(a, b, droop, every, bulb));
  }

  private wire(a: V3, b: V3, droop: number, every: number, bulb: number) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const steps = Math.max(1, Math.round(length / 0.1));
    const bulbEvery = Math.max(1, Math.round(every / 0.1));
    // The wire steps one axis at a time from cell to cell, so it is one unbroken line: a step that moved along all
    // three at once left two cells touching at a corner only, and the sag between them hung in the air (Brian,
    // 2026-11-09: "a lot of them are floating").
    const wire = lin(T.face[2]), g = this.decor;
    const cells: V3[] = [], mine = new Set<string>(), hangs: number[] = [];
    let prev: V3 | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t - droop * 4 * t * (1 - t);
      const cell: V3 = [g.i(x), g.i(y), g.i(z)];
      if (prev) {
        const at: V3 = [...prev];
        for (const axis of [0, 2, 1] as const) while (at[axis] !== cell[axis]) { at[axis] += Math.sign(cell[axis] - at[axis]); g.set(at[0], at[1], at[2], wire); mine.add(at.join()); }
      }
      g.set(cell[0], cell[1], cell[2], wire);
      mine.add(cell.join());
      cells.push(cell);
      prev = cell;
      if (i % bulbEvery === bulbEvery >> 1) hangs.push(i);
    }
    // The bulb hangs from the wire's own cell; where the sagging wire steps down through the bulb, their faces lay on one
    // plane and flickered, so it hangs from the next cell along instead (or the one before).
    const at = (c: V3): V3 => [(c[0] + 0.5) * g.size, c[1] * g.size - bulb / 2, (c[2] + 0.5) * g.size];
    const span = (m: number) => {
      const a = Math.round((m - bulb / 2) / g.size), far = Math.round((m + bulb / 2) / g.size) - 1;
      return [a, far < a ? a + Math.round(bulb / g.size) - 1 : far];
    };
    const crosses = (c: V3) => {
      const [[x0, x1], [y0, y1], [z0, z1]] = at(c).map(span);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (mine.has(`${x},${y},${z}`)) return true;
      return false;
    };
    for (const i of hangs) {
      const c = [cells[i], cells[i + 1], cells[i - 1]].find((k) => k && !crosses(k)) ?? cells[i];
      this.bulb(...at(c), bulb);
    }
  }

  /** When set, the baubles of the trees that follow (else a tree's own `bauble` and `clear`). */
  baubles: { size: number; clear: boolean } | null = null;

  /** A fir in tiers, snow on each tier's shelf, a spiral of baubles and a gold star. */  tree(x: number, z: number, height: number, topped = true, bauble = this.baubles?.size ?? 0.2, clear = this.baubles?.clear ?? false) {
    this.item('tree', () => this.fir(x, z, height, bauble, clear));
    if (topped) this.item('star', () => this.topper(x, z));
  }

  private fir(x: number, z: number, height: number, bauble: number, clear: boolean) {
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
      const r = Math.max(0, radiusAt(y) - 0.05), a = i * 2.4; // set into the branches, not hung off their tips
      const at: V3 = [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
      // Set into the branches, a bauble's cells were the branch's own cells too, face on face with them (they flickered):
      // with `clear` the branch gives the bauble its cells.
      if (clear) {
        const [lo, hi] = [at.map((m) => Math.round((m - bauble / 2) / g.size)), at.map((m) => Math.round((m + bauble / 2) / g.size) - 1)];
        for (let u = lo[0]; u <= Math.max(lo[0], hi[0]); u++) for (let v = lo[1]; v <= Math.max(lo[1], hi[1]); v++) for (let w = lo[2]; w <= Math.max(lo[2], hi[2]); w++) g.del(u, v, w);
      }
      this.bulb(at[0], at[1], at[2], bauble);
    }
  }

  /** The star stands on the tree's own tip, on a short gold stem: placed at the drawn height it hung just over a tip
   * that tapers away below it. */
  private topper(x: number, z: number) {
    const g = this.decor;
    const cx = g.i(x), cz = g.i(z);
    let top: { x: number; y: number; z: number } | null = null;
    for (const v of g.map.values()) if (Math.abs(v.x - cx) <= 1 && Math.abs(v.z - cz) <= 1 && (!top || v.y > top.y)) top = v;
    if (top) {
      // A stem up from the tip's own cell to the star's middle row (STAR row 5 is the first with a middle cell).
      for (let k = 1; k <= 4; k++) this.stars.set(top.x, top.y + k, top.z, lin(GOLD));
      this.star(top.x * g.size, (top.y + 1) * g.size, top.z * g.size);
    }
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
    this.item('post', () => {
      box(this.decor, [x - 0.1, 0, z - 0.1], [x + 0.1, height, z + 0.1], (a, b, c) => pick(T.beam, hash3(a, b, c, 83)));
    });
  }

  /** A red stocking with a white cuff, its toe pointing along x. */
  stocking(x: number, y: number, z: number, toe: number) {
    this.item('stocking', () => {
      const g = this.decor;
      box(g, [x - 0.1, y, z], [x + 0.2, y + 0.5, z + 0.1], () => lin(RED));
      box(g, [x - 0.1 + toe * 0.1, y, z], [x + 0.2 + toe * 0.2, y + 0.2, z + 0.1], () => lin(RED));
      box(g, [x - 0.2, y + 0.5, z], [x + 0.3, y + 0.7, z + 0.1], () => lin(T.snow[1]));
    });
  }

  /** A wrapped box with a ribbon each way and a knot on top. */
  present(x: number, z: number, w: number, h: number, wrap: string, ribbon: string, base = 0) {
    this.item('present', () => {
      const g = this.decor;
      const cx = Math.round(x / 0.1), cz = Math.round(z / 0.1);
      box(g, [x - w / 2, base, z - w / 2], [x + w / 2, base + h, z + w / 2], (a, _, c) => lin(a === cx || c === cz ? ribbon : wrap));
      box(g, [x - 0.1, base + h, z - 0.1], [x + 0.2, base + h + 0.1, z + 0.2], () => lin(ribbon));
    });
  }

  /** A candy cane stuck in the snow, its hook turned along x. */
  cane(x: number, z: number, side: number) {
    this.item('cane', () => {
      const stripe = (i: number) => lin(i % 4 < 2 ? RED : T.snow[1]);
      const g = this.decor;
      const top = 11;
      for (let i = 0; i <= top; i++) box(g, [x, i * 0.1, z], [x + 0.2, i * 0.1 + 0.1, z + 0.2], () => stripe(i));
      [[1, 1], [2, 2], [3, 2], [4, 1], [4, 0]].forEach(([dx, dy], k) => {
        const hx = x + side * dx * 0.1, hy = (top + dy) * 0.1;
        box(g, [hx, hy, z], [hx + 0.2, hy + 0.1, z + 0.2], () => stripe(top + k + 1));
      });
    });
  }

  /** A ring of pine with berries and a red bow, facing along z. */
  wreath(x: number, y: number, z: number) {
    this.item('wreath', () => {
      const g = this.decor;
      // Whole cells round the centre: stepping in metres let the rounding open gaps, and the ring came apart in arcs.
      const cx = g.i(x), cy = g.i(y), cz = g.i(z);
      for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
        const d = Math.hypot(i, j) * g.size;
        if (d < 0.3 || d > 0.62) continue;
        for (const k of [0, 1]) {
          const [a, b, c] = [cx + i, cy + j, cz + k];
          g.set(a, b, c, hash3(a, b, c, 79) > 0.86 ? lin(RED) : pick(T.pine, hash3(a, b, c, 81)));
        }
      }
      box(g, [x - 0.3, y - 0.7, z - 0.1], [x + 0.4, y - 0.5, z + 0.3], () => lin(RED));
      box(g, [x - 0.1, y - 0.9, z - 0.1], [x + 0.2, y - 0.7, z + 0.3], () => lin(RED));
    });
  }

  /** The red hat with a white brim and bobble, for a head whose top is at `y`, drawn at `scale` of its first size. */
  hat(x: number, y: number, z: number, scale = 1) {
    this.item('hat', () => {
      const g = this.decor, s = (m: number) => m * scale;
      const brim = Math.max(0.1, Math.round(s(0.2) * 10) / 10), tiers = Math.round(6 * scale);
      box(g, [x - s(0.4), y, z - s(0.4)], [x + s(0.4), y + brim, z + s(0.4)], () => lin(T.snow[1]));
      for (let i = 0; i < tiers; i++) {
        const r = s(0.32) - i * s(0.3) / tiers, lean = i * s(0.24) / tiers;
        box(g, [x + lean - r, y + brim + i * 0.1, z - r], [x + lean + r, y + brim + 0.1 + i * 0.1, z + r], () => lin(RED));
      }
      const tip = y + brim + tiers * 0.1;
      box(g, [x + s(0.1), tip, z - s(0.2)], [x + s(0.5), tip + s(0.3), z + s(0.2)], () => lin(T.snow[0]));
    });
  }

  build(): FestiveGeometry {
    const made = { decor: buildGeometry(this.decor.map, 0.1), bulbs: this.glow.map((g) => buildGeometry(g.map, 0.1)), star: buildGeometry(this.stars.map, 0.1), parts: this.parts };
    for (const g of [made.decor, made.star, ...made.bulbs]) packGeometry(g); // half the bytes, the same picture (voxel/mesher.ts)
    return made;
  }
}

/** The barn tree's baubles, in metres (Brian's to choose at the milestone 7 pairs; it was 0.2). */
export const BARN_BAUBLE = 0.1;

let farm: FestiveGeometry | null = null;
/** The farm's decorations, seen both from the table and from the start screen. */
export function buildFestive(): FestiveGeometry {
  if (farm) return farm;
  const d = new Dressing();
  // The big tree by the doors, with the presents heaped under it. To the game's scale (plan file 04, section 4.4): its
  // boughs top out at 4.2 m (they were 4.8, under a 1.5 m hero), the star above them, and no present over 0.6 m with
  // its knot.
  // Its baubles take their cells from the boughs (`clear`), as the barn tree's do: set into them they lay face on face.
  d.tree(-4.2, BARN.maxZ + 2.2, 4.4, true, 0.2, true);
  d.present(-3.1, BARN.maxZ + 3.2, 0.7, 0.5, T.collar[1], GOLD);
  d.present(-4.4, BARN.maxZ + 3.8, 0.8, 0.5, T.pine[1], T.snow[1]);
  d.present(-5.5, BARN.maxZ + 3.2, 0.6, 0.4, GOLD, T.collar[1]);
  // A small one in the corner of the barn for the table to see, clear of every seat. Its baubles are BARN_BAUBLE across
  // (plan file 06, section 4.6): at 0.2 m they read as blocks at the table's distance.
  // (The call's own line is pinned by the checker, src/skin/scene/placed.ts, so the baubles are set around it.)
  d.baubles = { size: BARN_BAUBLE, clear: true };
  d.tree(4.5, BARN.maxZ - 1.6, 2.6);
  d.baubles = null;
  // The presents stand clear of the wheelbarrow and of the tree's lowest boughs, against the barrow's wheel and in front
  // of it (they stood in the barrow's tray and under the tree, plan file 18, section 4.7; behind the tree there is no
  // room between the back wall's post and the bales).
  d.present(3.36, BARN.maxZ - 1.7, 0.5, 0.4, T.collar[1], GOLD);
  d.present(2.9, BARN.maxZ - 2.25, 0.6, 0.5, T.pine[1], T.snow[1]);
  // Lights: along the cross beam over the table, up the gable over the doors, and along the yard fence.
  // The beam's wire runs against the beam's back face (z 1.2), behind the lanterns: at z 1.0 it ran inside the beam and
  // through both lanterns, its faces on theirs. The fence's wire runs inside the posts (z 15.1), a cell clear of the
  // posts' front plane (15.0), where its faces lay on the posts' and on their snow.
  const beamZ = 1.2;
  d.strand([BARN.minX + 0.4, BARN.beamY - 0.1, beamZ], [-1.2, BARN.beamY - 0.1, beamZ], 0.45);
  d.strand([1.2, BARN.beamY - 0.1, beamZ], [BARN.maxX - 0.4, BARN.beamY - 0.1, beamZ], 0.45);
  const { minX, maxX, gateHalfWidth } = YARD.fence;
  const fenceZ = YARD.fence.z + 0.1;
  for (let x = minX; x < -gateHalfWidth; x += 3.6) d.strand([x, 1.45, fenceZ], [Math.min(x + 3.6, -gateHalfWidth), 1.45, fenceZ], 0.3);
  for (let x = gateHalfWidth; x < maxX; x += 3.6) d.strand([x, 1.45, fenceZ], [Math.min(x + 3.6, maxX), 1.45, fenceZ], 0.3);
  // A wreath over the doors, on the yard side and the table side.
  d.wreath(0, BARN.backDoor.height + 0.75, BARN.maxZ - 0.2); // on its inside face
  // Candy canes down both sides of the path.
  for (let z = BARN.maxZ + 3; z < YARD.fence.z - 1; z += 2.4) {
    d.cane(-YARD.path.halfWidth - 1.4, z, 1); // set back: the tour's path shot looks straight down this side
    d.cane(YARD.path.halfWidth + 0.3, z, -1);
  }
  // On the head's crown, which tops out at 2.96 m x scale; the hat shrinks with the snowman (plan file 04, section 4.4).
  d.hat(YARD.snowman.x, 2.92 * YARD.snowman.scale, YARD.snowman.z, YARD.snowman.scale);
  // Round the barn walls, for the table's camera: swags down both sides and stockings either side of the doors.
  for (const side of [-1, 1]) {
    d.swags([side * (BARN.maxX - 0.25), 3.6, -3.4], [side * (BARN.maxX - 0.25), 3.6, BARN.maxZ - 0.6], 3.2, 0.4);
    for (const x of [2.7, 3.5]) d.stocking(side * x, 2.5, BARN.maxZ - 0.1, side); // against the inside face
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
  // Up the gable over the doors and a wreath on the loft door. They hang on this farm's outside of the barn (farmstead.ts:
  // its boards' face is at z 7.3, the loft door's cross at 7.4), which only the start screen has; the table never sees
  // that side. At 7.5 they hung in the air in front of it.
  const gableZ = BARN.maxZ + 0.3;
  d.strand([BARN.minX, BARN.wallHeight, gableZ], [0, BARN.ridgeHeight - 0.2, gableZ], 0.12, 0.5);
  d.strand([0, BARN.ridgeHeight - 0.2, gableZ], [BARN.maxX, BARN.wallHeight, gableZ], 0.12, 0.5);
  d.wreath(0, BARN.backDoor.height + 1.55, BARN.maxZ + 0.4);
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
  // The far side's lights (x = P.maxX) hang on the outer face of its rails, a cell clear of the posts' planes (inside
  // the posts their bulbs' faces lay on the posts' and rails' faces). The other two sides stay as they were: the paddock
  // camera (tour shot 2) sees the near rail at x = P.minX, and the shadow of the lights along z = P.maxZ, and nothing
  // that shot shows may change.
  const out = 0.2;
  d.swags([P.minX, rail, P.minZ], [P.minX, rail, P.maxZ], 3, 0.25);
  d.swags([P.minX, rail, P.maxZ], [15.4, rail, P.maxZ], 3, 0.25);
  d.swags([18.2, rail, P.maxZ], [P.maxX, rail, P.maxZ], 3, 0.25);
  d.swags([P.maxX + out, rail, P.minZ], [P.maxX + out, rail, P.maxZ], 3, 0.25);
  d.strand([15, 1.6, -3], [18.2, 1.6, -3], 0.15, 0.4);
  // Up against the shed roof's underside, a cell in from its bevelled edge (at 2.6 it hung 0.1 m under the roof).
  d.swags([12.8, 2.7, -10.0], [20.6, 2.7, -10.0], 2.6, 0.18);
  // The coop: lights along both eaves.
  // Under the eaves' own cells (2.0 to 2.2 m up, z -0.2 to 0 and 3.0 to 3.2): they hung past the eaves' ends in the air.
  for (const z of [coop.z + 1.52, coop.z - 1.62]) d.strand([coop.x - 2.2, 1.9, z], [coop.x + 2.2, 1.9, z], 0.16, 0.4);
  // The tractor: lights down both sides of the hood, and presents waiting to be loaded, stacked behind its back wheels and out past the edge of its shot:
  // in front of it they stood between the tractor's shot (tour shot 5) and the tractor (plan file 04, section 4.4).
  for (const side of [-0.5, 0.5]) d.strand([tractor.x - 1.9, 1.5, tractor.z + side], [tractor.x + 0.6, 1.5, tractor.z + side], 0.02, 0.3, 0.1);
  d.present(tractor.x + 3.65, tractor.z + 0.4, 0.6, 0.5, T.collar[1], GOLD);
  d.present(tractor.x + 3.70, tractor.z + 1.15, 0.5, 0.4, T.pine[1], T.snow[1]);
  d.present(tractor.x + 4.40, tractor.z + 0.75, 0.6, 0.5, GOLD, T.collar[1]);
  // The orchard: the odd bauble left hanging on a branch.
  // Each hangs from its tip's own cell (the orchard's 0.2 m grid), overlapping the cell's lower half: hung 0.2 m under
  // the tip's point, a bauble often missed the branch and floated.
  const cell = 0.2, at = (m: number) => Math.round(m / cell) * cell;
  ORCHARD_TIPS.forEach(([x, y, z], i) => { if (i % 5 === 0) d.bulb(at(x) + cell / 2, at(y), at(z) + cell / 2); });
  return (farmstead = d.build());
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

/** The ice's strand of lights: its wire is the row of cells z 1.3 to 1.4, one cell back from the lanterns' middle row. */
const DUEL_STRAND_Z = 1.3;

let duel: FestiveGeometry | null = null;
/** The ice gets a little of it too: lights between the lanterns and a tree at the far end. */
export function buildDuelFestive(): FestiveGeometry {
  if (duel) return duel;
  const d = new Dressing();
  const [left, right] = DUEL.lamps;
  // The wire runs one cell behind the lanterns and their posts (z 1.1 to 1.3), against their back faces: through them, its
  // faces lay on theirs and flickered (plan file 08, section 4.5). The tree's baubles keep clear of its branches.
  const behind = DUEL_STRAND_Z;
  d.strand([left[0], left[1] - 0.3, behind], [right[0], right[1] - 0.3, behind], 0.5, 0.7);
  d.tree(right[0] + 0.9, 0.4, 2.8, true, 0.2, true);
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
