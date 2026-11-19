import { lin, paintingAsBefore } from './palette';
import { hash3 } from './primitives';
import { banded, patches } from './texture';
import type { Paint, RGB } from './primitives';

/**
 * Snow with a little life in it (Brian, 2026-11-08: "the snow looks super flat and untexturized ... not overtexturized
 * like the barn floor, just slight more detail"). The big snow surfaces used to pick between two near-white tones in
 * square patches, which read as one flat colour; the darker tone drew squares. This varies the colour smoothly instead,
 * in metres so every grid gets the same marks at the same size:
 * - soft drifts about 2 m across and finer undulation about 0.7 m across, a few percent brighter or dimmer;
 * - faint wind ripples running at a slant;
 * - a hint of cool blue in the hollows, a fine grain voxel to voxel, and now and then a sparkle.
 * Every change is small (the darkest snow is about 17% under the brightest), so it reads as texture, never as pattern.
 */
const WHITE = lin('#FFFFFF');
const COOL = lin('#D3E0F0');
/** A glint: a touch brighter than white, so it catches the light. */
const SPARKLE: RGB = [1.12, 1.12, 1.15];

const smooth = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, z: number, seed: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = smooth(x - xi), w = smooth(z - zi);
  const h = (a: number, b: number) => hash3(a, 0, b, seed);
  const top = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * u;
  const bottom = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * u;
  return top + (bottom - top) * w;
}

/**
 * Snow: three near-whites laid in broad, soft drifts a few metres across (Brian, 2026-11-19: flat is not what he
 * wants either: "everything is without texture"; 2026-11-18: no static). No grain, no ripples, no sparkles: the drifts'
 * edges step with the voxels, and the land's own steps and the light do the rest. In metres, so every grid gets the
 * same drifts at the same size. The textured snow of 2026-11-08 below is kept, under its own name, only for the
 * wendigo's zone (`asBefore` in palette.ts), whose every voxel is pinned.
 */
export const SNOW = lin('#F3F4F1');
const SNOW_TONES = [lin('#E7ECF1'), SNOW, lin('#FBFBF9')] as const; // the hollows a little cool, the crests a little bright
export function snowAt(x: number, y: number, z: number, cell: number, seed = 0): RGB {
  if (paintingAsBefore()) return snowAtTextured(x, y, z, cell, seed);
  return banded(SNOW_TONES, patches(x * cell, z * cell, 3.4, seed + 40), [0.4, 0.62]);
}
export const snowPaint = (cell: number, seed = 0): Paint => (x, y, z) => snowAt(x, y, z, cell, seed);

/** The snow's textured colour at a voxel of a grid with `cell`-metre voxels (the wendigo's zone only). */
export function snowAtTextured(x: number, y: number, z: number, cell: number, seed = 0): RGB {
  if (hash3(x, y, z, seed + 9) > 0.99) return SPARKLE; // a glint
  const mx = x * cell, mz = z * cell;
  // On a coarse grid (the far land is 1 m voxels) the marks are stretched wider and softened, or each big voxel would
  // step against the next and the land would show squares.
  const coarse = Math.max(1, cell / 0.25), soft = Math.min(1, 1.3 / Math.sqrt(coarse));
  const drift = vnoise(mx / (2.2 * coarse), mz / (2.2 * coarse), seed), fine = vnoise(mx / (0.7 * coarse), mz / (0.7 * coarse), seed + 1);
  const n = drift * 0.65 + fine * 0.35;
  const ripple = Math.sin(((mx * 0.85 + mz * 0.4) / (1.15 * coarse)) * Math.PI * 2 + drift * 4);
  const k = 1 - (0.13 - n * 0.13 + Math.max(0, ripple - 0.5) * 0.09 + hash3(x, y, z, seed + 7) * 0.045) * soft;
  const cool = Math.min(0.38, Math.max(0, (0.52 - n) * 0.95)) * soft;
  return [(WHITE[0] + (COOL[0] - WHITE[0]) * cool) * k, (WHITE[1] + (COOL[1] - WHITE[1]) * cool) * k, (WHITE[2] + (COOL[2] - WHITE[2]) * cool) * k];
}

/** A paint for textured snow on a grid of `cell`-metre voxels (the wendigo's zone only). */
export const snowPaintTextured = (cell: number, seed = 0): Paint => (x, y, z) => snowAtTextured(x, y, z, cell, seed);

/**
 * A roof's blanket of snow, as snow lies (Brian, 2026-11-19: "make the natural elements more sensical, the snow on the
 * roof for example"): one even layer `thick` cells deep on every part of the roof flat enough to hold it, none where
 * the roof drops two cells or more to the next (a gambrel's lower slope sheds it), and a lip that curls one cell out
 * and one down over every edge it reaches. `thick` may vary across the roof (by x: the windward slope carries less
 * than the lee). `tops` are the roof's top cells; `put` sets a cell of snow.
 */
export function blanket(tops: readonly (readonly [number, number, number])[], put: (x: number, y: number, z: number) => void, thick: number | ((x: number) => number) = 2): void {
  const at = new Map(tops.map(([x, y, z]) => [`${x},${z}`, y]));
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const drop = (x: number, y: number, z: number) => Math.max(...SIDES.map(([dx, dz]) => y - (at.get(`${x + dx},${z + dz}`) ?? y)));
  for (const [x, y, z] of tops) {
    if (drop(x, y, z) >= 2) continue;
    const deep = typeof thick === 'number' ? thick : thick(x);
    for (let k = 1; k <= deep; k++) put(x, y + k, z);
    for (const [dx, dz] of SIDES) {
      const n = at.get(`${x + dx},${z + dz}`);
      if (n === undefined || (n < y && drop(x + dx, n, z + dz) >= 2)) for (let k = 0; k < deep; k++) put(x + dx, y + k, z + dz);
    }
  }
}
