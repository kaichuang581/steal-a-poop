#!/usr/bin/env node
// Prints the five-step ladder (steps -2, -1, 0, +1, +2) for a step-0 colour.
// Usage: node tools/miniature/ladder.mjs '#B8473A' ['#96683F' ...]
// Method (docs/miniature/01, section 4): lightness moves 0.035 per step in the OKLab colour space,
// and the colour strength is scaled by 1 - 0.04 * step, so darker steps are a touch richer and lighter ones paler.
const STEP = 0.035, TOP = 0.985;
const toLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c) => { c = Math.max(0, Math.min(1, c)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255); };
function toOklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function toHex(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => toSrgb(c).toString(16).padStart(2, '0').toUpperCase()).join('');
}
export function ladder(hex) {
  const [L, a, b] = toOklab(hex);
  return [-2, -1, 0, 1, 2].map((k) => { const sc = 1 - 0.04 * k; return toHex(Math.min(TOP, L + k * STEP), a * sc, b * sc); });
}
const args = process.argv.slice(2);
if (!args.length) { console.error("usage: node ladder.mjs '#RRGGBB' ..."); process.exit(1); }
for (const hex of args) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { console.error(`not a colour: ${hex}`); process.exit(1); }
  console.log(hex.toUpperCase(), '->', ladder(hex).join(' '));
}
