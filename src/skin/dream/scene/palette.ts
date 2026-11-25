/**
 * Counting Sheep's colours (docs/dream/data/palettes.json, copied; a test holds the two equal). `sky` runs from the top of
 * the sky to the horizon.
 */
export const STAGE_COLOURS = {
  1: { snow: "#EEF1FA", sky: ["#141D36", "#18254A", "#1F2F5E", "#2A3F78", "#3A5290"], glow: "#5B6FA8", far: "#2B3A66", mid: "#22305A", shade: "#B9C8E6", soil: "#4A4258", soil2: "#3A3348", rock: "#2A2A48", mist: "#5B6FA8", northernLight: null, moon: {"shape": "crescent", "across": 96} },
  2: { snow: "#F1EEFB", sky: ["#15173A", "#1D1F4E", "#262A66", "#37347E", "#4B3F8F"], glow: "#7B67C0", far: "#342F73", mid: "#2A2660", shade: "#C4BCEB", soil: "#4B3A5E", soil2: "#3C2E4D", rock: "#2B2450", mist: "#7B67C0", northernLight: ["#9CCB78", "#6FC7D6", "#7B67C0"], moon: {"shape": "full", "across": 128} },
  3: { snow: "#FBEFF6", sky: ["#1A1030", "#2A1646", "#3A1D5C", "#582C78", "#7A3E8F"], glow: "#C96FA8", far: "#4A2A70", mid: "#3A2060", shade: "#DDB9DD", soil: "#523355", soil2: "#41284A", rock: "#2E1A44", mist: "#C96FA8", northernLight: null, moon: {"shape": "full", "across": 190, "finaleAcross": 300} },
} as const;
export const QUILT = ["#A84A42", "#E6DCC6", "#3F6B4A", "#C99A4A", "#2B3A66"] as const;
export const MOON = {"face": "#FFE9A8", "crater": "#F2D58E"} as const;
export const YARN = { red: "#C44A3A", dark: "#933529", light: "#D97A66", needle: "#B8B0A6" } as const;
export const BEDDING = { nightshirt: "#E6DFD3", stripe: "#8F97AC", pillow: "#F4F0EA" } as const;

/** The interface's tokens the scenery shares (tokens.css `--hm-*`). */
export const TOKEN = { ink: '#090E20', wool: '#FFF4DC', woolHi: '#FFFDF4', lantern: '#F2A444', lanternHi: '#FFD98A', frost: '#BBCCF0' } as const;

const cache = new Map<string, string>();
const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** `a` mixed `t` of the way toward `b` (0 to 1), as hex. */
export function mix(a: string, b: string, t: number): string {
  const key = `${a}${b}${t}`, hit = cache.get(key);
  if (hit) return hit;
  const x = rgb(a), y = rgb(b);
  const out = `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  if (cache.size < 4000) cache.set(key, out);
  return out;
}
export const lighter = (a: string, t: number): string => mix(a, '#FFFFFF', t);
export const darker = (a: string, t: number): string => mix(a, '#000000', t);
/** A colour's brightness, 0 to 1 (Rec. 709 on the stored values, as the contrast table of the pack is worked out). */
export function luma(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
