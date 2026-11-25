import { Color } from 'three';
import { lin } from './palette';
import type { Tone } from './palette';
import type { Paint } from './primitives';
import { hash3 } from './primitives';

/**
 * The painted-miniature look's colours (docs/miniature/01, section 4; 03, section 1). One ladder of five steps a
 * material: index 0 is step -2, index 2 is step 0, index 4 is step +2. One part, one colour; parts that touch differ
 * by a step; nothing is chosen per cube. These are final colours: they are not desaturated as `lin()`'s are.
 * The palette of docs/depth/DEPTH-PLAN.md, section 3: warm leads, red leans coral, green leans teal, no pure white or black.
 */
export const LADDER = {
  snow:       ['#D8D2C9', '#E3DDD5', '#EEE9E1', '#F3EEE6', '#F3EEE7'],
  barnRed:    ['#A3412D', '#AD4D3A', '#B75946', '#C06653', '#CA725F'],
  trimWhite:  ['#CEC0AC', '#D9CCB8', '#E4D7C4', '#EFE3D0', '#F9EDDA'],
  slate:      ['#715961', '#7B636B', '#856D75', '#8E7780', '#99828A'],
  wood:       ['#885A33', '#926540', '#9B704C', '#A57B58', '#AF8564'],
  darkWood:   ['#5B3923', '#65432E', '#6E4D38', '#775743', '#81614E'],
  roofBrown:  ['#714B38', '#7A5542', '#84604D', '#8D6A58', '#977563'],
  stone:      ['#867B71', '#90867C', '#9A9087', '#A59B92', '#AFA69D'],
  hay:        ['#CAA153', '#D4AC62', '#DEB870', '#E8C37F', '#F3CF8E'],
  straw:      ['#D0B476', '#DBBF84', '#E5CB91', '#F0D69F', '#FBE2AD'],
  pine:       ['#306A56', '#3D7460', '#497E6A', '#568875', '#62927F'],
  /** The fir of PLAN_DEPTH_AND_LIGHT 8.4: Counting Sheep's barn wreath (docs/dream/v3). */
  fir:        ['#30684C', '#3D7257', '#487C61', '#55866C', '#619076'],
  houseCream: ['#C2AA88', '#CDB594', '#D8C0A1', '#E2CCAD', '#EDD7BA'],
  tractorRed: ['#A73F30', '#B14C3C', '#BB5949', '#C46555', '#CE7161'],
  iron:       ['#382E2A', '#413633', '#4A403C', '#544945', '#5D534F'],
  brass:      ['#DBA342', '#E5AE54', '#EFBA64', '#F9C675', '#FFD38F'],
  coopYellow: ['#C8A15E', '#D2AC6C', '#DCB87A', '#E7C388', '#F1CF96'],
  glass:      ['#2B3D4A', '#354653', '#3E505C', '#485965', '#53636F'],
  ice:        ['#98C3CE', '#A4CED9', '#B0D9E4', '#BDE4EE', '#CAF0F9'],
  reed:       ['#656B3E', '#6F754A', '#797F55', '#838961', '#8E946D'],
  scarfRed:   ['#AC473D', '#B65349', '#BF6055', '#C96C61', '#D3786D'],
  carrot:     ['#CC7228', '#D57E3B', '#DF8A4B', '#E9965B', '#F2A26A'],
  wool:       ['#D8CEBE', '#E3D9CA', '#EEE5D6', '#F6EDDF', '#F6EDE0'],
  faceDark:   ['#3B2C2A', '#433533', '#4D3F3C', '#564846', '#5F524F'],
  pink:       ['#D49A95', '#DEA6A0', '#E8B1AC', '#F3BDB8', '#FDC9C4'],
  giftGreen:  ['#2A7656', '#398060', '#478A6B', '#549476', '#619E81'],
  ink:        ['#2D2020', '#2E2221', '#362A2A', '#3F3333', '#483C3C'],
} as const;
export type Mat = keyof typeof LADDER;
type RGB = [number, number, number];

/**
 * Solid snow in front of the line z = -16 (Brian's decision 4 of the plan). False restores the painted snow texture on
 * the ground and on caps, and nothing else.
 */
export const SOLID_SNOW = true;

const linear = new Map<string, RGB>();
/** A hex colour as linear RGB, with no desaturation. */
function plain(hex: string): RGB {
  let c = linear.get(hex);
  if (!c) { const k = new Color(hex); linear.set(hex, (c = [k.r, k.g, k.b])); }
  return c;
}
const clampStep = (step: number) => Math.max(-2, Math.min(2, Math.round(step)));

/** A material's colour at a step, as linear RGB. The same array for the same arguments. */
export function solid(mat: Mat, step = 0): RGB {
  return plain(LADDER[mat][clampStep(step) + 2]);
}

// ---- the ladder's own arithmetic (tools/miniature/ladder.mjs): lightness moves 0.035 a step in OKLab, and the colour's
// strength is scaled by 1 - 0.04 x step, so darker steps are a touch richer and lighter ones paler.
const STEP = 0.035, TOP = 0.95, FLOOR = 0.26;
const toLinear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c: number) => { c = Math.max(0, Math.min(1, c)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255); };
function toOklab(hex: string): RGB {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function toHex(L: number, a: number, b: number): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => toSrgb(c).toString(16).padStart(2, '0').toUpperCase()).join('');
}
/** A colour's OKLCH: lightness 0 to 1, colour strength, hue in degrees (docs/depth/DEPTH-PLAN.md, section 2). */
export function oklch(hex: string): RGB {
  const [L, a, b] = toOklab(hex), h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), h < 0 ? h + 360 : h];
}
/** The hex a colour takes at a step, by the ladders' own method. */
export function shadeHex(hex: string, step = 0): string {
  const k = clampStep(step);
  if (k === 0) return hex.toUpperCase();
  const [L, a, b] = toOklab(hex), sc = 1 - 0.04 * k;
  return toHex(Math.max(FLOOR, Math.min(TOP, L + k * STEP)), a * sc, b * sc);
}
/** Brings a colour from a sheet into the palette (docs/depth/DEPTH-PLAN.md, section 3.1, rules R3 to R6). */
export function harmonize(hex: string): string {
  const [L0, a0, b0] = toOklab(hex);
  const L = Math.min(0.93, Math.max(0.28, L0));
  let C = Math.hypot(a0, b0), h = (Math.atan2(b0, a0) * 180) / Math.PI;
  if (h < 0) h += 360;
  if (C < 0.025) { h = 55; C = Math.max(C, 0.012); } // R6: no dead greys
  else if (h >= 115 && h <= 165) { h += (168 - h) * 0.6; C = Math.min(C, 0.085); } // R5: greens toward teal
  else if (h >= 200 && h <= 320) C = Math.min(C, 0.1); // blues and purples
  else C = Math.min(C, 0.13); // R4: warm accents
  const r = (h * Math.PI) / 180;
  return toHex(L, C * Math.cos(r), C * Math.sin(r));
}

const shades = new Map<string, RGB>(), raws = new Map<string, RGB>();
/**
 * Any colour at a step, by the same arithmetic as the ladders, first brought into the palette by `harmonize()`. No
 * desaturation. For colours that are not in the table: animals, garments, worn things.
 */
export function shade(hex: string, step = 0): RGB {
  const key = `${hex}|${clampStep(step)}`;
  let c = shades.get(key);
  if (!c) shades.set(key, (c = plain(shadeHex(harmonize(hex), step))));
  return c;
}
/** `shade()` without `harmonize()`: bombs, their skins, fuses and sparks, the trophy and anything that glows keep their strength. */
export function shadeRaw(hex: string, step = 0): RGB {
  const key = `${hex}|${clampStep(step)}`;
  let c = raws.get(key);
  if (!c) raws.set(key, (c = plain(shadeHex(hex, step))));
  return c;
}

/** A material's colour at a step with its colour strength scaled by `k`: the barn's inside faces (docs/depth section 3.3). */
export function muted(mat: Mat, step: number, k: number): RGB {
  const [L, a, b] = toOklab(LADDER[mat][clampStep(step) + 2]);
  return plain(toHex(L, a * k, b * k));
}

/** The average colour of the old random three-tone pick, with its desaturation: the same overall colour, no speckle. */
export function meanTone(tone: Tone, w: readonly [number, number] = [0.6, 0.9]): RGB {
  const [a, b, c] = [lin(tone[0]), lin(tone[1]), lin(tone[2])], k = [w[0], w[1] - w[0], 1 - w[1]];
  return [0, 1, 2].map((i) => a[i] * k[0] + b[i] * k[1] + c[i] * k[2]) as RGB;
}

/**
 * The average of some colours (linear RGB): what a part looks like from far off when its cubes were tinted one by one,
 * so the part can be that one colour with no speckle (docs/miniature/07, treatment B).
 */
export const average = (colours: readonly RGB[]): RGB => [0, 1, 2].map((k) => colours.reduce((n, c) => n + c[k], 0) / colours.length) as RGB;
/** The average of hex colours as the small scenes paint them (through `lin`, with its desaturation), each as often as it is listed. */
export const meanOf = (hexes: readonly string[]): RGB => average(hexes.map(lin));

/** A paint that gives every cube the same colour (rule R1). */
export const paint = (mat: Mat, step = 0): Paint => { const c = solid(mat, step); return () => c; };

/** A paint whose step depends on which part a cube belongs to. `part` gives the part's number for a cube. */
export const byPart = (mat: Mat, steps: readonly number[], part: (x: number, y: number, z: number) => number): Paint =>
  (x, y, z) => solid(mat, steps[((part(x, y, z) % steps.length) + steps.length) % steps.length]);

/** A paint whose step is chosen a part from -1, 0, +1 with weights 25%, 50%, 25%, seeded. */
export const seededPart = (mat: Mat, seed: number, part: (x: number, y: number, z: number) => number): Paint =>
  (x, y, z) => { const r = hash3(part(x, y, z), seed, 0, 97); return solid(mat, r < 0.25 ? -1 : r < 0.75 ? 0 : 1); };
