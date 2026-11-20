import { Color } from 'three';

/** Three tones per material: light, mid, dark (plan V3 Part 4.3). No pure black anywhere. */
export type Tone = readonly [string, string, string];

export const T = {
  wool: ['#FAF6EC', '#F0E9D8', '#DDD3BE'],
  face: ['#4A4444', '#3F3A3A', '#2E2929'],
  pink: ['#F6C6C0', '#F2B6B0', '#D99B95'],
  barn: ['#B5503F', '#A6453A', '#8E3A31'],
  beam: ['#9A6B47', '#8B5E3C', '#6F4A2E'],
  hay: ['#E6C46A', '#D9B45C', '#C59E45'],
  snow: ['#FFFFFF', '#F7F9FC', '#DCE6F2'],
  path: ['#DCE6F2', '#CFD9E6', '#C3CEDC'],
  ice: ['#D9EEF8', '#BFE3F5', '#9ED2EE'],
  pine: ['#3A6E4A', '#2F5E3E', '#27503A'],
  trunk: ['#6A4A30', '#5A3C25', '#4A311E'],
  stone: ['#9A9DA6', '#8C8F99', '#737682'],
  wolf: ['#7E7B85', '#6E6B75', '#4E4B55'],
  lantern: ['#FFD56E', '#FFC24B', '#E8A92F'],
  house: ['#D2C4AE', '#C7B8A1', '#B5A58C'],
  /** White-painted barn trim, and the shingles and tractor of the start screen's farm. */
  trim: ['#F4EFE3', '#E8E1D2', '#CFC7B6'],
  shingle: ['#5E6470', '#525764', '#454A55'],
  tractor: ['#C8402F', '#B23528', '#8E2A20'],
  roof: ['#7C5D45', '#6B4F3A', '#5C4332'],
  collar: ['#C24E45', '#B5443C', '#9C3A33'],
  brass: ['#F0C45C', '#E7B64A', '#C99A38'],
  skin: ['#F3DCCB', '#EBCDB9', '#D9B9A3'],
  hoof: ['#3A3434', '#332E2E', '#2A2626'],
  /** The dream's clouds (V4 Part 5.3): the third tone only in the creases between lobes. */
  cloud: ['#F4F1FC', '#DCD5F3', '#BBB0E6'],
  /** The farmer's bedroom (V4 Part 5.1): headboard, bedside table, floorboards. */
  bedwood: ['#6B4A32', '#5A3C25', '#4A311E'],
  linen: ['#F3EAD6', '#E6DCC4', '#CFC3A8'],
} as const satisfies Record<string, Tone>;

export const WHITE = '#FBFBF8';
export const IRIS = '#3B2E2A';
export const PUPIL = '#1E1B1B';
export const WOLF_EYE = '#FFE066';
export const FROST = '#CFE3F5';
/** The comic cracks on a frozen sheep's ice block. */
export const ICE_CRACK = '#6A98C2';
export const SCARF = '#C24E45';

const cache = new Map<string, [number, number, number]>();
const hsl = { h: 0, s: 0, l: 0 };
/** Saturation is taken down 30% from the table (plan V3.1 Part 1.3): shadows go cool and highlights warm from the light, not the paint. */
const DESATURATE = 0.7;
/** Hex to linear RGB, desaturated (three converts sRGB hex to linear with colour management on). */
export function lin(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const k = new Color(hex);
    k.getHSL(hsl);
    k.setHSL(hsl.h, hsl.s * DESATURATE, hsl.l);
    c = [k.r, k.g, k.b];
    cache.set(hex, c);
  }
  return c;
}

/**
 * The tone a surface is painted: the one of the three its weights favour (light, mid or dark), flat, one colour for the
 * whole surface (Brian, 2026-11-18: "remove all glitchy/static textures"; docs/diorama/PLAN.md 3.2). `r` is no longer
 * read: every voxel of a surface takes the same tone, so nothing speckles. Weights still choose which tone.
 */
export function pick(tone: Tone, r: number, w: readonly [number, number] = [0.6, 0.9]): [number, number, number] {
  if (asIs) return pickBy(tone, r, w);
  const light = w[0], mid = w[1] - w[0], dark = 1 - w[1];
  return lin(light >= mid && light >= dark ? tone[0] : mid >= dark ? tone[1] : tone[2]);
}

let asIs = 0;
/**
 * Paints as the game painted before 2026-11-18 while `fn` runs: `pick` chooses per voxel as `pickBy` does and snow takes
 * its texture (voxel/snow.ts). Only for the wendigo's zone, whose every voxel is pinned (tools/scenes/wendigo.pins.json).
 */
export function asBefore<V>(fn: () => V): V {
  asIs++;
  try { return fn(); } finally { asIs--; }
}
export const paintingAsBefore = () => asIs > 0;

/**
 * A seeded pick among the three tones: 60% light, 30% mid, 10% dark unless weights say otherwise. Only for a choice made
 * once per board, plank, bale or tree (a value step between whole parts), and for what may not change: the wendigo's
 * zone (scene/countryside.ts, pinned voxel by voxel) and the characters (voxel/characters.ts). Never per voxel.
 */
export function pickBy(tone: Tone, r: number, w: readonly [number, number] = [0.6, 0.9]): [number, number, number] {
  return lin(r < w[0] ? tone[0] : r < w[1] ? tone[1] : tone[2]);
}
