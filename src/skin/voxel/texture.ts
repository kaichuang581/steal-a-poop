/**
 * Texture without static (Brian, 2026-11-19: "everything is without texture. im not saying that i want u to start
 * making everything messy, but rn the ground of the barn is literally just... a flat yellow rectangle"; and the day
 * before: "remove all glitchy/static textures"). A surface gets its texture from the thing it is made of, in shapes far
 * larger than a voxel: boards and planks a value step apart, courses of stone, drifts of snow and patches of straw with
 * soft, stepped edges. Never a choice made voxel by voxel.
 */
import { hash3 } from './primitives';
import type { RGB } from './primitives';

const smooth = (t: number) => t * t * (3 - 2 * t);
/** Smooth value noise over the ground, 0 to 1, one cell of it `1` across. */
export function soft(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = smooth(x - xi), w = smooth(z - zi);
  const h = (a: number, b: number) => hash3(a, 0, b, seed);
  const top = h(xi, zi) + (h(xi + 1, zi) - h(xi, zi)) * u;
  const bottom = h(xi, zi + 1) + (h(xi + 1, zi + 1) - h(xi, zi + 1)) * u;
  return top + (bottom - top) * w;
}

/**
 * Broad, soft-edged patches: 0 to 1 at a point in metres, from two sizes of smooth noise, the larger `scale` metres
 * across. Cut it at a level or two to lay tones in drifts and patches.
 */
export function patches(mx: number, mz: number, scale: number, seed: number): number {
  return soft(mx / scale, mz / scale, seed) * 0.65 + soft(mx / (scale * 0.42), mz / (scale * 0.42), seed + 1) * 0.35;
}

/** The tone for a level: `tones[i]` where `cuts[i - 1] <= v < cuts[i]` (one more tone than cuts). */
export function banded(tones: readonly RGB[], v: number, cuts: readonly number[]): RGB {
  let i = 0;
  while (i < cuts.length && v >= cuts[i]) i++;
  return tones[Math.min(i, tones.length - 1)];
}

/** A colour a value step lighter (positive) or darker (negative): 6% a step, as the diorama's palette steps. */
export function stepped(c: RGB, steps: number): RGB {
  const k = 1 + 0.06 * steps;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/**
 * Courses: which of `n` tones a cell of a wall, a roof or a paving takes, in blocks `w` cells long and `h` cells tall,
 * each course set off half a block from the one under it (masonry, shingles, tiles). `u` runs along the course, `v` up.
 */
export function course(u: number, v: number, w: number, h: number, n: number, seed: number): number {
  const row = Math.floor(v / h), col = Math.floor((u + (row & 1 ? w / 2 : 0)) / w);
  return Math.floor(hash3(col, row, 0, seed) * n) % n;
}
