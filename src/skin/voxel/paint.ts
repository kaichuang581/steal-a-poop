import { Color } from 'three';
import { lin } from './palette';
import type { Tone } from './palette';
import type { Paint } from './primitives';
import { hash3 } from './primitives';

/**
 * The painted-miniature look's colours (docs/miniature/01, section 4; 03, section 1). One ladder of five steps a
 * material: index 0 is step -2, index 2 is step 0, index 4 is step +2. One part, one colour; parts that touch differ
 * by a step; nothing is chosen per cube. These are final colours: they are not desaturated as `lin()`'s are.
 */
export const LADDER = {
  snow:       ['#D9D6D0', '#E7E5E0', '#F4F2EE', '#FBFAF7', '#FBFAF7'],
  barnRed:    ['#A52A1F', '#AE392D', '#B8473A', '#C25447', '#CB6153'],
  trimWhite:  ['#D8D1C0', '#E4DCCC', '#EFE8D8', '#FAF4E4', '#FFFAEB'],
  slate:      ['#474C56', '#50555F', '#5A5F69', '#646973', '#6E737D'],
  wood:       ['#835325', '#8C5D32', '#96683F', '#A0734C', '#A97E58'],
  darkWood:   ['#4F3013', '#58391E', '#614329', '#6A4D34', '#74573F'],
  roofBrown:  ['#644329', '#6E4D34', '#77573F', '#81614A', '#8A6C55'],
  stone:      ['#7E7973', '#89837D', '#938E88', '#9E9993', '#A8A39E'],
  hay:        ['#C99F35', '#D3AA49', '#DDB65A', '#E7C26B', '#F2CD7B'],
  straw:      ['#D1B569', '#DBC178', '#E6CC86', '#F1D894', '#FBE3A3'],
  pine:       ['#2F5D37', '#3B6641', '#46704C', '#517A57', '#5D8462'],
  houseCream: ['#C4B28E', '#CEBD9B', '#D9C8A7', '#E4D3B3', '#EFDFC0'],
  tractorRed: ['#AF180C', '#B82D20', '#C23E2F', '#CB4D3D', '#D55B4B'],
  iron:       ['#2B2726', '#34302F', '#3D3938', '#464241', '#4F4C4B'],
  brass:      ['#DBA306', '#E5AF30', '#EFBB48', '#F9C75C', '#FFD36E'],
  coopYellow: ['#C9A24D', '#D3AE5D', '#DDB96C', '#E7C57B', '#F2D08A'],
  glass:      ['#1F2A39', '#283341', '#313C4A', '#3A4553', '#444F5C'],
  ice:        ['#A7C6D2', '#B3D1DD', '#BFDCE8', '#CBE7F3', '#D8F3FE'],
  reed:       ['#5E6A36', '#687442', '#727E4E', '#7C885A', '#879366'],
  scarfRed:   ['#AF312C', '#B84038', '#C24E45', '#CC5B51', '#D5685E'],
  carrot:     ['#D36E04', '#DC7B27', '#E6873C', '#F0934E', '#F9A05E'],
  wool:       ['#DBD4C4', '#E7DFD0', '#F2EBDC', '#FDF7E8', '#FFFAEC'],
  faceDark:   ['#312B2A', '#3A3433', '#433D3C', '#4C4645', '#56504F'],
  pink:       ['#D99B91', '#E3A69D', '#EDB2A9', '#F7BEB5', '#FFCAC1'],
  giftGreen:  ['#1F763E', '#30804A', '#3F8A55', '#4D9461', '#5B9E6C'],
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
const STEP = 0.035, TOP = 0.985;
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
/** The hex a colour takes at a step, by the ladders' own method. */
export function shadeHex(hex: string, step = 0): string {
  const k = clampStep(step);
  if (k === 0) return hex.toUpperCase();
  const [L, a, b] = toOklab(hex), sc = 1 - 0.04 * k;
  return toHex(Math.min(TOP, L + k * STEP), a * sc, b * sc);
}
const shades = new Map<string, RGB>();
/**
 * Any colour at a step, by the same arithmetic as the ladders. No desaturation. For colours that are not in the table:
 * animals, garments, skins. `shade('#B8473A', 1)` is `solid('barnRed', 1)`.
 */
export function shade(hex: string, step = 0): RGB {
  const key = `${hex}|${clampStep(step)}`;
  let c = shades.get(key);
  if (!c) shades.set(key, (c = plain(shadeHex(hex, step))));
  return c;
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
