import type { BufferGeometry } from 'three';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, helix, taperedBox } from '../voxel/primitives';
import type { Paint, RGB } from '../voxel/primitives';
import { CHAR } from '../voxel/sheep';
import { letterGeometry } from '../voxel/table';

/**
 * The farmer's bedroom (V4 Part 5.1) and the farmer (Part 5.2), the real world under the dream. Everything uses
 * the bedroom palette only: dark wood, cream linen, the quilt's four patches, navy night; the one lavender here is
 * the quilt's, which is cloth, not light. The bed and its furniture are 0.10 m voxels; the farmer, the clock, the
 * candle and its smoke 0.04 m. All geometry is built in the bedroom group's own frame: the bed runs along +x with the
 * headboard at the -x end, the floor at y = 0.
 */
export const BED = {
  quilt: ['#8E7CC3', '#F3E9D2', '#D99B95', '#5E8F8A'] as const,
  night: ['#1E1A33', '#14112A'] as const,
  wallLight: '#2A2550',
  cap: ['#C24E45', '#F3EAD6'] as const,
  moon: '#CFD8FF',
  mattress: { w: 1.1, h: 0.3, l: 2.0, top: 0.55 },
  pillowTop: 0.69,
};
const B = 0.1;
const woodTone: Paint = (x, y, z) => pick(T.bedwood, hash3(x, y >> 1, z, 31), [0.6, 0.92]);
/** Linen lit by the moon: faces toward +x and +y get the light tone, the rest the shadow tone, baked into the paint. */
const linenTone = (xMax: number, yMax: number): Paint => (x, y, z) => lin(x >= xMax - 1 || y >= yMax - 1 ? T.linen[0] : hash3(x, y, z, 3) < 0.15 ? T.linen[2] : T.linen[1]);

export interface BedroomGeo {
  floor: BufferGeometry; rug: BufferGeometry; slippers: BufferGeometry; bed: BufferGeometry; pillow: BufferGeometry;
  quiltFlat: BufferGeometry; quiltBump: BufferGeometry; table: BufferGeometry; clock: BufferGeometry; candle: BufferGeometry; smoke: BufferGeometry;
}

let bedroomCache: BedroomGeo | null = null;
export function bedroomGeometry(): BedroomGeo {
  if (bedroomCache) return bedroomCache;
  const m = BED.mattress;
  // Floor: boards 0.12 m wide running along the bed, 2.4 x 2.4 m, 2% tone noise.
  const floor = new Grid(B);
  for (let xi = -8; xi < 16; xi++) for (let zi = -12; zi < 12; zi++) floor.set(xi, -1, zi, lin(T.bedwood[Math.floor(((zi + 12) / 1.2)) % 3 === 0 ? 1 : hash3(xi, 0, zi, 2) < 0.02 ? 2 : 0]));
  // Rag rug beside the bed (toward the camera, +z), rings of the quilt tones; two slippers on it.
  const rug = new Grid(B);
  for (let xi = 2; xi < 11; xi++) for (let zi = 7; zi < 13; zi++) {
    const d = Math.max(Math.abs(xi - 6.5) / 4.5, Math.abs(zi - 10) / 3);
    if (d <= 1) rug.set(xi, 0, zi, lin(BED.quilt[Math.floor(d * 4) % 4]));
  }
  const slippers = new Grid(B);
  for (const zi of [8, 11]) { box(slippers, [0.5, 0.1, zi * B], [0.72, 0.2, zi * B + 0.1], () => lin(BED.cap[0])); slippers.set(7, 1, zi, lin(BED.cap[1])); }
  // Bed: headboard at the -x end, two posts, mattress, sheet on top.
  const bed = new Grid(B);
  box(bed, [-0.08, 0, -m.w / 2], [0, 0.8 + 0.25, m.w / 2], woodTone);
  for (const sz of [-1, 1]) box(bed, [-0.1, 0, sz * m.w / 2 - (sz > 0 ? 0.1 : 0)], [0, 1.15, sz * m.w / 2 + (sz > 0 ? 0 : 0.1)], woodTone);
  box(bed, [0, 0.25, -m.w / 2], [m.l, m.top, m.w / 2], (x, y, z) => (y === Math.round(m.top / B) - 1 ? linenTone(99, 99)(x, y, z) : woodTone(x, y, z)));
  // Pillow 0.64 x 0.14 x 0.44, chamfered.
  const pillow = new Grid(B);
  box(pillow, [0.05, m.top, -0.22], [0.69, m.top + 0.14, 0.22], linenTone(7, Math.round((m.top + 0.14) / B)), 1);
  // Quilt: patchwork of 0.30 m squares from 0.45 m below the headboard to the foot, cream stitch lines between.
  const quiltPaint: Paint = (x, _y, z) => {
    const px = Math.floor((x * B) / 0.3), pz = Math.floor(((z + 6) * B) / 0.3);
    const stitch = ((x * B) % 0.3) < B * 0.5 || (((z + 6) * B) % 0.3) < B * 0.5;
    return lin(stitch ? BED.quilt[1] : BED.quilt[(px * 3 + pz * 5 + 1) % 4]);
  };
  const quiltFlat = new Grid(B);
  box(quiltFlat, [0.95, m.top, -m.w / 2 - 0.05], [m.l + 0.05, m.top + 0.1, m.w / 2 + 0.05], quiltPaint);
  for (const sz of [-1, 1]) box(quiltFlat, [0.45, m.top - 0.2, sz * (m.w / 2) + (sz > 0 ? 0 : -0.05)], [m.l + 0.05, m.top, sz * (m.w / 2) + (sz > 0 ? 0.05 : 0)], quiltPaint);
  // The body under the quilt: a bump 0.46 wide, 0.22 tall, 1.3 long from the chest, quilt over it (breathes as one).
  const quiltBump = new Grid(B);
  ellipsoid(quiltBump, [1.0, m.top, 0], [0.65, 0.14, 0.26], (x, y, z) => (y * B < m.top ? null : quiltPaint(x, y, z)), 0, 4);
  box(quiltBump, [0.45, m.top, -m.w / 2 - 0.05], [0.95, m.top + 0.1, m.w / 2 + 0.05], quiltPaint);
  // Bedside table at the headboard's +z side, a drawer line and a brass knob.
  const table = new Grid(B);
  box(table, [0.1, 0, -m.w / 2 - 0.55], [0.5, 0.6, -m.w / 2 - 0.15], woodTone);
  for (let xi = 1; xi < 5; xi++) table.set(xi, 3, Math.round((-m.w / 2 - 0.15) / B) - 1, lin(T.bedwood[2]));
  table.set(3, 3, Math.round((-m.w / 2 - 0.15) / B), lin(T.brass[0]));
  // Alarm clock: a 0.16 m drum, two bells, a cream face with dark hands at ten past two.
  const clock = new Grid(CHAR);
  const cx = 0.3, cz = -m.w / 2 - 0.35, cy = 0.6;
  ellipsoid(clock, [cx, cy + 0.08, cz], [0.08, 0.08, 0.05], () => lin(T.brass[1]));
  for (const dx of [-0.05, 0.05]) ellipsoid(clock, [cx + dx, cy + 0.17, cz], [0.03, 0.025, 0.03], () => lin(T.brass[0]));
  for (let yi = 0; yi < 3; yi++) for (let xi = -2; xi <= 2; xi++) if (Math.abs(xi) + Math.abs(yi - 1) <= 2) clock.set(Math.round(cx / CHAR) + xi, Math.round((cy + 0.08) / CHAR) + yi - 1, Math.round(cz / CHAR) + 2, lin(T.linen[0]));
  clock.set(Math.round(cx / CHAR), Math.round((cy + 0.08) / CHAR), Math.round(cz / CHAR) + 3, lin(T.hoof[1]));
  clock.set(Math.round(cx / CHAR) + 1, Math.round((cy + 0.08) / CHAR) + 1, Math.round(cz / CHAR) + 3, lin(T.hoof[1]));
  // Candle stub with a dark wick.
  const candle = new Grid(CHAR);
  box(candle, [0.12, 0.6, cz - 0.15], [0.2, 0.7, cz - 0.07], () => lin(T.linen[0]));
  candle.set(4, Math.round(0.7 / CHAR), Math.round((cz - 0.11) / CHAR), lin(T.hoof[1]));
  // A curl of smoke above the wick: a helix, the bedroom's one transparent object.
  const smoke = new Grid(CHAR);
  helix(smoke, [0.16, 0.72, cz - 0.11], [0.15, 1, 0], () => lin(T.linen[0]), 0.03, 0.05, 1.5);
  bedroomCache = {
    floor: buildGeometry(floor.map, B), rug: buildGeometry(rug.map, B), slippers: buildGeometry(slippers.map, B), bed: buildGeometry(bed.map, B),
    pillow: buildGeometry(pillow.map, B), quiltFlat: buildGeometry(quiltFlat.map, B), quiltBump: buildGeometry(quiltBump.map, B), table: buildGeometry(table.map, B),
    clock: buildGeometry(clock.map, CHAR), candle: buildGeometry(candle.map, CHAR), smoke: buildGeometry(smoke.map, CHAR),
  };
  return bedroomCache;
}

export interface FarmerGeo { asleep: BufferGeometry; awake: BufferGeometry; cap: BufferGeometry; body: BufferGeometry; bang: BufferGeometry; zs: BufferGeometry[] }
let farmerCache: FarmerGeo | null = null;
/**
 * The farmer, built standing (face toward +z, crown at +y) about the base of his neck; the stage lays him down on
 * the pillow. Two heads (asleep, awake) swap on the bump; the cap and the body are shared.
 */
export function farmerGeometry(): FarmerGeo {
  if (farmerCache) return farmerCache;
  const s = CHAR;
  const skin: Paint = (x, y, z) => pick(T.skin, hash3(x >> 1, y >> 1, z >> 1, 5), [0.6, 0.95]);
  const grey = lin('#8C8C8C'), lid = lin('#2B2626');
  const head = (awake: boolean) => {
    const g = new Grid(s);
    box(g, [-0.15, 0, -0.13], [0.15, 0.28, 0.13], skin, 2);
    for (const sx of [-1, 1]) box(g, [sx * 0.16 - 0.02, 0.1, -0.03], [sx * 0.16 + 0.02, 0.16, 0.03], skin); // ears
    box(g, [-0.05, 0.1, 0.13], [0.07, 0.22, 0.16], skin); // nose 3 x 3 x 3 (rounded by the box) — below the eyes
    const zf = Math.round(0.13 / s); // the face plane
    const eyeY = Math.round(0.28 * 0.58 / s);
    for (const sx of [-1, 1]) {
      const ex = sx * 3;
      if (awake) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.set(ex + dx, eyeY + dy, zf, lin(dx === 0 && dy === 0 ? '#2B2522' : '#FBFBF8'));
        for (let dx = -1; dx <= 1; dx++) g.set(ex + dx, eyeY + 3, zf, grey); // brows raised
      } else {
        for (let dx = -2; dx <= 1; dx++) g.set(ex + dx, eyeY, zf, lid);
        for (let dx = -1; dx <= 0; dx++) g.set(ex + dx, eyeY + 2, zf, grey);
      }
      for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 3; dy++) g.set(sx * 4 + dx - 2, eyeY - 4 + dy, zf, lin(T.pink[1])); // cheeks
      for (let dy = 0; dy < 3; dy++) g.set(sx * 7, eyeY - 1 + dy, zf - 1, grey); // hair tufts at the temples
    }
    // Moustache 11 x 3 x 2 under the nose, ends drooping; the mouth under it.
    for (let dx = -5; dx <= 5; dx++) for (let dy = 0; dy < 3; dy++) { const droop = Math.abs(dx) === 5 ? -1 : 0; for (const dz of [0, 1]) g.set(dx, 2 + dy + droop, zf + dz, grey); }
    if (awake) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy < 2; dy++) g.set(dx, dy, zf + 1, lin('#5A2E2E'));
    return buildGeometry(g.map, s);
  };
  // Nightcap: tapered from the crown, bent so the tip falls to +x, striped, a cream pom.
  const cap = new Grid(s);
  const stripe: Paint = (_x, y) => lin(BED.cap[Math.floor(y / 3) % 2]);
  taperedBox(cap, [0, 0.27, 0], [0.32, 0.2, 0.32], 0.45, stripe);
  // The tip bends over to the +x side and rests on the pillow, a cream pom at its end.
  for (let k = 0; k < 3; k++) ellipsoid(cap, [0.08 + k * 0.07, 0.46 - k * 0.05, 0], [0.06 - k * 0.01, 0.05, 0.06 - k * 0.01], stripe, 0, 3);
  ellipsoid(cap, [0.3, 0.33, 0], [0.055, 0.055, 0.055], () => lin(BED.cap[1]), 0.1, 8);
  // Shoulders as two linen bumps under the sheet line, one hand on the quilt.
  const body = new Grid(s);
  for (const sx of [-1, 1]) ellipsoid(body, [sx * 0.2, -0.1, 0], [0.14, 0.08, 0.1], () => lin(T.linen[1]), 0.05, 2);
  box(body, [0.14, -0.22, 0.06], [0.26, -0.18, 0.16], skin);
  // The "!" above his head when he wakes.
  const bang = new Grid(s);
  for (let y = 2; y < 9; y++) bang.set(0, y, 0, lin(T.lantern[0]));
  bang.set(0, 0, 0, lin(T.lantern[0]));
  const zs = [0.06, 0.08, 0.1].map((cell) => letterGeometry('Z', cell, T.linen[0]));
  farmerCache = { asleep: head(false), awake: head(true), cap: buildGeometry(cap.map, s), body: buildGeometry(body.map, s), bang: buildGeometry(bang.map, s), zs };
  return farmerCache;
}

/** A trail puff: 4 to 6 overlapping cloud lobes of radius `r`, about its centre. On the 0.05 m grid: at 0.10 m, this close to the camera, the lobes read as cubes. */
export function trailPuff(r: number, seed: number): BufferGeometry {
  const g = new Grid(0.05);
  const tone: Paint = (x, y, z) => pick(T.cloud, hash3(x, y, z, seed), [0.65, 0.95]);
  const n = 4 + (seed % 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    ellipsoid(g, [Math.cos(a) * r * 0.5, Math.sin(a * 2) * r * 0.2, Math.sin(a) * r * 0.4], [r * 0.7, r * 0.6, r * 0.65], tone, 0.1, seed + k);
  }
  return buildGeometry(g.map, 0.05);
}

export type { RGB };
