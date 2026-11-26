/**
 * The market's sign art (Brian, 2026-11-25: the signs read as "a bunch of squares on top of each other", then as
 * "vibecoded and low effort" when they were restyled with CSS boxes). Every sign, awning, lantern and token is now
 * drawn here on ONE pixel grid, lit from the top left in three tones, and given one ink outline by `outlined`, the way
 * a sprite is drawn. One art pixel is `--p` on screen (2 px at 1440 x 900); nothing in a sign is sized in any other
 * unit, so no part of a sign has finer or coarser pixels than the part beside it.
 *
 * No three, no React: a grid is rows of colours, and `svg` writes it as crisp runs.
 */
export type Grid = (string | null)[][];

export const INK = '#0B1024';
export const SNOW = '#FFFDF4';
export const SNOW_SHADE = '#D5E0F5';

/** A material in three tones and the colour of its thickness. */
export interface Tone { hi: string; base: string; lo: string; side: string; text: string; soft: string }
export const TONE = {
  cream: { hi: '#FFFDF4', base: '#FFF4DC', lo: '#E7D6AF', side: '#C4AE82', text: '#1B1426', soft: '#5B4B3F' },
  night: { hi: '#3A4F86', base: '#1B2A52', lo: '#131D3B', side: '#0E152C', text: '#FFF4DC', soft: '#BBCCF0' },
  lantern: { hi: '#FFE2A6', base: '#F2A444', lo: '#D98A2B', side: '#A8621A', text: '#1B1426', soft: '#4A2E0C' },
  red: { hi: '#DB7A6C', base: '#B8473A', lo: '#9A372D', side: '#6E231D', text: '#FFF4DC', soft: '#FFE1D4' },
  green: { hi: '#6DB383', base: '#3F8A55', lo: '#317044', side: '#1F4D2E', text: '#FFF4DC', soft: '#DDF2DF' },
  violet: { hi: '#7C85DE', base: '#4A54B8', lo: '#3B449C', side: '#2A3175', text: '#FFF4DC', soft: '#DDE1FF' },
  amber: { hi: '#F7C777', base: '#D98A2B', lo: '#B56F1C', side: '#874F10', text: '#1B1426', soft: '#4A2E0C' },
  pale: { hi: '#EFE6D0', base: '#DDD1B6', lo: '#C7B896', side: '#A6967A', text: '#6B5B4B', soft: '#6B5B4B' },
} satisfies Record<string, Tone>;
export type ToneName = keyof typeof TONE;

export const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string | null>(w).fill(null));
export function rect(g: Grid, x: number, y: number, w: number, h: number, c: string | null): void {
  for (let j = Math.max(0, y); j < Math.min(g.length, y + h); j++) for (let i = Math.max(0, x); i < Math.min(g[j].length, x + w); i++) g[j][i] = c;
}
/** Rows of letters, one a pixel; a letter the palette does not name leaves the pixel as it was. */
export function draw(g: Grid, x: number, y: number, art: readonly string[], pal: Record<string, string | null>): void {
  art.forEach((row, j) => [...row].forEach((ch, i) => { if (ch in pal && g[y + j] && x + i >= 0 && x + i < g[y + j].length) g[y + j][x + i] = pal[ch]; }));
}
/** One ink pixel round everything drawn, on the four sides only, so a cut corner stays a round corner. The grid grows by a pixel each way. */
export function outlined(g: Grid, c = INK): Grid {
  const h = g.length, w = g[0].length, o = grid(w + 2, h + 2);
  const at = (i: number, j: number) => g[j - 1]?.[i - 1] ?? null;
  for (let j = 0; j < h + 2; j++) for (let i = 0; i < w + 2; i++) o[j][i] = at(i, j) ?? (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1) ? c : null);
  return o;
}
export function mirror(g: Grid): Grid { return g.map((r) => [...r].reverse()); }

/** The grid as SVG rects, each run of one colour in a row as one rect. */
export function runs(g: Grid): string {
  let out = '';
  g.forEach((row, y) => { for (let x = 0; x < row.length;) { const c = row[x]; let n = 1; while (x + n < row.length && row[x + n] === c) n++; if (c) out += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${c}"/>`; x += n; } });
  return out;
}
export const svgOf = (g: Grid): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${g[0].length}" height="${g.length}" viewBox="0 0 ${g[0].length} ${g.length}" shape-rendering="crispEdges">${runs(g)}</svg>`;
export const uriOf = (g: Grid): string => `url("data:image/svg+xml,${encodeURIComponent(svgOf(g))}")`;

// ---------------------------------------------------------------- the board every sign is cut from

/**
 * A sign board, to be cut in nine: a round-cornered face lit along its top and left, shaded along its right and
 * bottom, standing `depth` pixels thick. `FRAME` says where to cut it (a border-image's slice, top right bottom left).
 */
export function board(t: Tone, depth = 3): Grid {
  const w = 8, h = 6 + depth, g = grid(w, h);
  rect(g, 0, 0, w, h, t.base);
  rect(g, 0, 0, w, 1, t.hi); rect(g, 0, 1, 1, 4, t.hi);
  rect(g, w - 1, 1, 1, 4, t.lo); rect(g, 1, 5, w - 1, 1, t.lo);
  rect(g, 0, 6, w, depth, t.side);
  g[0][0] = g[0][w - 1] = g[h - 1][0] = g[h - 1][w - 1] = null;
  return outlined(g);
}
export const frameSlice = (depth = 3): [number, number, number, number] => [3, 3, 2 + depth, 3];

/** A sunk well (a meter's track, a picture's niche): dark inside, shaded at the top, a lit lip at the bottom. */
export function well(dark: string, shade: string, lip: string): Grid {
  const g = grid(6, 6);
  rect(g, 0, 0, 6, 6, dark); rect(g, 0, 0, 6, 1, shade); rect(g, 0, 5, 6, 1, lip);
  return outlined(g);
}

// ---------------------------------------------------------------- awnings

/** How high the snow lies on each column of an awning, a pattern that never repeats inside one tab. */
const DRIFT = [1, 2, 2, 3, 3, 3, 2, 2, 1, 1, 2, 3, 3, 2, 2, 2, 3, 3, 2, 1, 2, 2, 3, 2, 1, 1, 2, 2, 3, 3, 3, 2];
/**
 * A stall's awning: `n` stripes of six pixels, the stall's colour and cream by turns, each with its fold shaded and a
 * round scallop hanging under it, and snow lying along the top.
 */
export function awning(n: number, colour: Tone, snow = true, from = 0): Grid {
  const top = snow ? 3 : 0, w = n * 6, g = grid(w, top + 10);
  for (let k = 0; k < n; k++) {
    const t = k % 2 ? TONE.cream : colour, x = k * 6, y = top;
    rect(g, x, y, 6, 7, t.base); rect(g, x, y, 6, 1, t.hi); rect(g, x + 5, y + 1, 1, 6, t.lo); rect(g, x, y + 6, 5, 1, t.lo);
    rect(g, x, y + 7, 6, 1, t.base); rect(g, x + 5, y + 7, 1, 1, t.lo);
    rect(g, x + 1, y + 8, 4, 1, t.base); rect(g, x + 4, y + 8, 1, 1, t.lo);
    rect(g, x + 2, y + 9, 2, 1, t.lo);
  }
  if (snow) for (let x = 1; x < w - 1; x++) {
    const d = DRIFT[(x + from) % DRIFT.length], next = DRIFT[(x + 1 + from) % DRIFT.length];
    rect(g, x, 3 - d, 1, d, SNOW);
    if (next < d) g[3 - d][x] = SNOW_SHADE;
    if (d === 3 && x % 4 === 0) g[2][x] = SNOW_SHADE;
  }
  return outlined(g);
}
/** A drift of snow to lie along the top of a board: `w` pixels long, three high. */
export function drift(w: number, from = 0): Grid {
  const g = grid(w, 3);
  for (let x = 0; x < w; x++) {
    const edge = Math.min(x, w - 1 - x), d = Math.min(DRIFT[(x + from) % DRIFT.length], edge + 1), next = Math.min(DRIFT[(x + 1 + from) % DRIFT.length], Math.min(x + 1, w - 2 - x) + 1);
    rect(g, x, 3 - d, 1, d, SNOW);
    if (next < d) g[3 - d][x] = SNOW_SHADE;
  }
  return outlined(g);
}

// ---------------------------------------------------------------- the banner

const BANNER = [
  '.....HHHHHHHHHHHHHH.....',
  '.....HFFFFFFFFFFFFL.....',
  '.....HFFFFFFFFFFFFL.....',
  '.....HFFFFFFFFFFFFL.....',
  'tttttHFFFFFFFFFFFFLttttt',
  'TTTTTHFFFFFFFFFFFFLTTTTT',
  'TTTTTHFFFFFFFFFFFFLTTTTT',
  '.TTTTHFFFFFFFFFFFFLTTTT.',
  '..TTTHFFFFFFFFFFFFLTTT..',
  '...TTHFFFFFFFFFFFFLTT...',
  '...TTHFFFFFFFFFFFFLTT...',
  '..TTTHFFFFFFFFFFFFLTTT..',
  '.TTTTFLLLLLLLLLLLLLTTTT.',
  'TTTTDD............DDTTTT',
  'TTTTD..............DTTTT',
  'TTTT................TTTT',
] as const;
/** The title's cloth banner, to be cut in three across: a face with a swallow tail folded back behind each end. */
export function banner(t: Tone): Grid {
  const g = grid(24, BANNER.length);
  draw(g, 0, 0, BANNER, { H: t.hi, F: t.base, L: t.lo, T: t.lo, t: t.base, D: t.side });
  return outlined(g);
}
/** Where to cut the banner: its ends keep their size, its face stretches. */
export const BANNER_ENDS = 10;

/** A faint weave for a board's face: two tones a hair apart, so a face is never one flat fill. */
export function weave(base: string, fleck: string): Grid {
  const g = grid(8, 6);
  rect(g, 0, 0, 8, 6, base);
  for (const [x, y] of [[1, 1], [2, 2], [3, 1], [5, 4], [6, 5], [7, 4]]) g[y][x] = fleck;
  return g;
}

// ---------------------------------------------------------------- lanterns, moons, small marks

const LANTERN = [
  '.....k.....',
  '....kkk....',
  '...KKKKK...',
  '..hLLLLLl..',
  '.hLLLLLLLl.',
  'hLLLLLLLLLl',
  'rrrrrrrrrrr',
  'hLLLLLLLLLl',
  'hLLLLLLLLLl',
  'rrrrrrrrrrr',
  'hLLLLLLLLLl',
  '.hLLLLLLLl.',
  '..hLLLLLl..',
  '...KKKKK...',
  '....k.k....',
  '....k.k....',
] as const;
const LIT = { L: '#FFD98A', h: '#FFF3CC', l: '#F2A444', r: '#E59B38', K: '#5A3A1C', k: '#3A2414' };
const DARK = { L: '#42578F', h: '#5B71AB', l: '#30447A', r: '#30447A', K: '#0E152C', k: '#0E152C' };
/** A paper lantern, lit from the bottom up as far as `fill` (0 to 1): its body is rows 3 to 12. */
export function lantern(fill: number): Grid {
  const g = grid(11, LANTERN.length), from = 13 - Math.round(Math.max(0, Math.min(1, fill)) * 10);
  LANTERN.forEach((row, j) => draw(g, 0, j, [row], j >= from ? LIT : { ...DARK, K: fill > 0 ? LIT.K : DARK.K, k: fill > 0 ? LIT.k : DARK.k }));
  return outlined(g);
}
/** The small lantern that hangs from a stall's awning: lit at the open stall. */
export function bulb(lit: boolean): Grid {
  const g = grid(5, 8), p = lit ? LIT : DARK;
  draw(g, 0, 0, ['..k..', '.KKK.', 'hLLLl', 'hLLLl', 'rrrrr', 'hLLLl', '.KKK.', '..k..'], p);
  return outlined(g);
}
const MOON = [
  '..XXXXX..',
  '.XXXXXXX.',
  'XXXccXXXX',
  'XXccXXXXX',
  'XXccXXXXX',
  'XXccXXXXX',
  'XXXccXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
] as const;
/** A night counted (a lit token with the moon on it) or still to come. */
export function moon(on: boolean): Grid {
  const g = grid(9, 9);
  draw(g, 0, 0, MOON, on ? { X: '#F2A444', c: '#3A2414' } : { X: '#D9C8A0', c: '#C2AE82' });
  if (on) { rect(g, 2, 0, 5, 1, '#FFE2A6'); g[1][1] = '#FFE2A6'; rect(g, 2, 8, 5, 1, '#D98A2B'); } else rect(g, 2, 0, 5, 1, '#E9DDBC');
  return outlined(g);
}
/** A cross for the close button, a tick for what is done, a padlock for what is not found yet. */
export function glyph(name: 'cross' | 'tick' | 'lock', c: string, shade?: string): Grid {
  const art = name === 'cross' ? ['XX...XX', 'XXX.XXX', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXX.XXX', 'XX...XX']
    : name === 'tick' ? ['......XX', '.....XXX', 'XX..XXX.', 'XXXXXX..', '.XXXX...', '..XX....']
      : ['.XXXX.', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXsXXX', 'XXsXXX', 'XXXXXX'];
  const g = grid(art[0].length, art.length);
  draw(g, 0, 0, art, { X: c, s: shade ?? c });
  return g;
}

// ---------------------------------------------------------------- the four stalls' pictures

const SACK = ['.....TTT.....', '....sBBBs....', '.....ttt.....', '....hBBBs....', '...hBBBBBs...', '..hBBBBBBBs..', '..hBBwwwBBs..', '.hBBBwBwBBBs.', '.hBBBwwwBBBs.', '.hBBBBBBBBBs.', '.hBBBBBBBBBs.', '..sssssssss..'] as const;
const BELL = ['......k......', '.....kkk.....', '....hGGGs....', '...hGGGGGs...', '...hGGGGGs...', '..hGGGGGGGs..', '..hGGGGGGGs..', '..hGGGGGGGs..', '.hGGGGGGGGGs.', '.sssssssssss.', '.....ccc.....', '......c......'] as const;
const MEDAL = ['..RRR...RRR..', '..RRr...RRr..', '...RRr.RRr...', '....hGGGs....', '...hGGGGGs...', '..hGGwwwGGs..', '..hGGwGwGGs..', '..hGGwwwGGs..', '..hGGGwGGGs..', '...hGGGGGs...', '....sssss....'] as const;
const BOOK = ['.............', '.RRRRRrRRRRR.', 'RPPPPPrPPPPPr', 'RPllllrllllPr', 'RPPPPPrPPPPPr', 'RPllllrllllPr', 'RPPPPPrPPPPPr', 'RPllllrlllPPr', 'RPPPPPrPPPPPr', 'RRRRRRrRRRRRr', '.rrrrrrrrrrr.'] as const;
/** A stall's own picture for its tab and its plaques, drawn at the signs' pixel size. */
export function stallIcon(stop: 'sacks' | 'bells' | 'missions' | 'book'): Grid {
  const g = grid(13, 12);
  if (stop === 'sacks') draw(g, 0, 0, SACK, { B: '#DDB872', h: '#F2DCA4', s: '#B58C48', T: '#B58C48', t: '#B8473A', w: '#7A5A2C' });
  else if (stop === 'bells') draw(g, 0, 0, BELL, { G: '#F2C040', h: '#FFE9A8', s: '#C98A1E', k: '#8A5F16', c: '#8A5F16' });
  else if (stop === 'missions') draw(g, 0, 0, MEDAL, { G: '#F2C040', h: '#FFE9A8', s: '#C98A1E', w: '#FFF4DC', R: '#B8473A', r: '#8E2F28' });
  else draw(g, 0, 1, BOOK, { R: '#B8473A', r: '#8E2F28', P: '#FFF4DC', l: '#C4AE82' });
  return outlined(g);
}
