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

// ---------------------------------------------------------------- colour steps for a thing that is one colour

const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** `a` moved `k` of the way to `b`. */
export const mix = (a: string, b: string, k: number): string => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
/** One colour as a lit thing: its lit edge, itself, its shaded edge. */
const lit3 = (c: string) => ({ h: mix(c, '#FFFFFF', 0.55), B: c, s: mix(c, INK, 0.34) });

// ---------------------------------------------------------------- round things: discs, seals, capsules

/** A pixel disc `d` across: how far each row stands in from the square's side. */
const round = (d: number): number[] => Array.from({ length: d }, (_, y) => { const r = d / 2, dy = y + 0.5 - r; return Math.round(r - Math.sqrt(r * r - dy * dy)); });
/** Lights a filled shape from above: the top pixel of each column lit, the bottom one shaded. */
function litFromAbove(g: Grid, base: string, hi: string, lo: string): void {
  for (let x = 0; x < g[0].length; x++) {
    const ys = g.map((row, y) => (row[x] === base ? y : -1)).filter((y) => y >= 0);
    if (ys.length > 1) { g[ys[0]][x] = hi; g[ys[ys.length - 1]][x] = lo; }
  }
}
/**
 * A seal: a disc `d` across in a tone with a picture set in its middle. It is the left end of every button (what the
 * button does, as a picture) and the medal on a ribbon.
 */
export function seal(d: number, t: Tone, art?: Grid): Grid {
  const g = grid(d, d), ins = round(d);
  for (let y = 0; y < d; y++) rect(g, ins[y], y, d - 2 * ins[y], 1, t.base);
  litFromAbove(g, t.base, t.hi, t.lo);
  if (art) { const ox = Math.floor((d - art[0].length) / 2), oy = Math.floor((d - art.length) / 2); art.forEach((row, j) => row.forEach((c, i) => { if (c && g[oy + j]?.[ox + i] !== undefined) g[oy + j][ox + i] = c; })); }
  return outlined(g);
}
/**
 * A button: a capsule whose face is `face` pixels high, standing `depth` thick, to be cut in three across (its round
 * ends keep their size, its middle stretches). Things that are pressed are capsules; things that are read are boards.
 */
export function capsule(face: number, t: Tone, depth = 3): Grid {
  const ins = round(face), w = Math.ceil(face / 2) * 2 + 2, g = grid(w, face + depth);
  for (let y = 0; y < face; y++) rect(g, ins[y], y + depth, w - 2 * ins[y], 1, t.side);
  for (let y = 0; y < face; y++) rect(g, ins[y], y, w - 2 * ins[y], 1, t.base);
  for (let x = 0; x < w; x++) {
    const ys = ins.map((n, y) => (n <= Math.min(x, w - 1 - x) ? y : -1)).filter((y) => y >= 0);
    g[ys[0]][x] = t.hi; g[ys[ys.length - 1]][x] = t.lo;
  }
  return outlined(g);
}
/** How much of a capsule's width each round end takes (the cut of its border-image). */
export const capsuleEnd = (face: number): number => Math.ceil(face / 2) + 1;

/** A ribbon, to be cut in three across: a strip eleven pixels high with a notch cut into each end. It says what a thing is or what state it is in. */
export function ribbon(t: Tone): Grid {
  const h = 11, w = 12, g = grid(w, h);
  for (let y = 0; y < h; y++) { const n = Math.max(0, 3 - Math.abs(y - 5)); rect(g, n, y, w - 2 * n, 1, y === 0 ? t.hi : y === h - 1 ? t.lo : t.base); }
  return outlined(g);
}
export const RIBBON_END = 5;

/** A tab that stands on the top of a book or a board: its top corners cut, to be cut in nine. */
export function tab(t: Tone): Grid {
  const w = 10, h = 8, g = grid(w, h);
  rect(g, 0, 0, w, h, t.base); rect(g, 0, 0, w, 1, t.hi); rect(g, 0, 1, 1, h - 1, t.hi); rect(g, w - 1, 1, 1, h - 1, t.lo);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) { g[y][x] = null; g[y][w - 1 - x] = null; }
  g[1][1] = t.hi; g[1][w - 2] = t.lo;
  return outlined(g);
}

/** The seat a tag's gem is set in: a low round rise on the tag's top edge. Its last two rows lie over the tag's own outline and lit edge. */
export function crest(t: Tone): Grid {
  const g = grid(13, 7);
  draw(g, 0, 0, ['....KKKKK....', '..KKhhhhhKK..', '.KhhBBBBBBBK.', 'KhBBBBBBBBBBK', 'KhBBBBBBBBBBK', 'KBBBBBBBBBBBK', '.BBBBBBBBBBB.'], { K: INK, h: t.hi, B: t.base });
  return g;
}
/** The point on a card's left side that says which thing the card is about. Its right column lies over the card's outline. */
export function pointer(t: Tone): Grid {
  const g = grid(5, 9);
  draw(g, 0, 0, ['....K', '...Kh', '..KhB', '.KhBB', 'KhBBB', '.KBBB', '..KBB', '...KB', '....K'], { K: INK, h: t.hi, B: t.base });
  return g;
}
/** A thin chalk line round a slate, to be cut in nine. */
export function chalkLine(c: string): Grid {
  const g = grid(6, 6);
  rect(g, 1, 0, 4, 1, c); rect(g, 1, 5, 4, 1, c); rect(g, 0, 1, 1, 4, c); rect(g, 5, 1, 1, 4, c);
  return g;
}

// ---------------------------------------------------------------- gems: how rare a thing is, or where it comes from

const GEM = {
  /** Common: a round bead. */
  bead: ['..hhB..', '.hhBBB.', 'hhBBBBs', 'hBBBBBs', 'BBBBBss', '.BBBss.', '..sss..'],
  /** Uncommon: a square-cut stone. */
  cut: ['.hhhhh.', 'hBBBBBs', 'hBhhBBs', 'hBhBBBs', 'hBBBBBs', 'hBBBBBs', '.sssss.'],
  /** Rare: a diamond. */
  diamond: ['...h...', '..hBB..', '.hBhBB.', 'hBhBBBs', '.BBBBs.', '..BBs..', '...s...'],
  /** Legendary: a star. */
  star: ['...h...', '..hBs..', 'hhBBBBs', '.hBBBs.', '.hBBBs.', '.BB.Bs.', '.B...s.'],
  /** From the Bell Shelf. */
  bell: ['...B...', '..hBs..', '.hBBBs.', '.hBBBs.', '.hBBBs.', 'hBBBBBs', '...s...'],
  /** Earned by a mission: a medal on its ribbon. */
  medal: ['.r...r.', '.rr.rr.', '..hBs..', '.hBBBs.', '.hBhBs.', '.hBBBs.', '..sss..'],
} as const;
export type GemShape = keyof typeof GEM;
/** A gem in its colour, or (`on` false) the empty socket it will sit in. */
export function gem(shape: GemShape, colour: string, on = true): Grid {
  const g = grid(7, 7);
  draw(g, 0, 0, GEM[shape], on ? { ...lit3(colour), r: TONE.red.base } : { h: '#C2AE82', B: '#D9C8A0', s: '#E9DDBC', r: '#D9C8A0' });
  return outlined(g);
}

// ---------------------------------------------------------------- what a thing is: a bomb skin, a burst, a fuse sound

const KIND = {
  bomb: ['.........y.', '........yoy', '.......f.y.', '......ff...', '...NNNNN...', '..NhhNNNN..', '.NhNNNNNNN.', '.NNNNNNNNd.', '.NNNNNNNdd.', '..NNNNNdd..', '...ddddd...'],
  blast: ['.....o.....', '.o...o...o.', '.oo.ooo.oo.', '..ooooooo..', '..ooYYYoo..', 'ooooYYYoooo', '..ooYYYoo..', '..ooooooo..', '.oo.ooo.oo.', '.o...o...o.', '.....o.....'],
  tick: ['....VVVVVV.', '....VvvvvV.', '....V....V.', '....V....V.', '....V....V.', '....V....V.', '..VVV..VVV.', '.VvVV.VvVV.', '.VVVV.VVVV.', '..VV...VV..'],
} as const;
export type KindName = keyof typeof KIND;
const KIND_PAL = { N: '#3A3042', h: '#7A6C8A', d: '#241C2B', f: '#8A5F16', y: '#FFE2A6', o: '#F2A444', Y: '#FFF3CC', V: '#4A54B8', v: '#8C95EA' };
/** A kind's picture, bare (to set in a seal) or outlined (to stand on a board). */
export function kindIcon(kind: KindName, bare = false): Grid {
  const g = grid(11, KIND[kind].length);
  draw(g, 0, 0, KIND[kind], KIND_PAL);
  return bare ? g : outlined(g);
}

// ---------------------------------------------------------------- what a button does, as a picture for its seal

const MARK = {
  play: ['X.....', 'XXX...', 'XXXXX.', 'XXXXXX', 'XXXXX.', 'XXX...', 'X.....'],
  back: ['...X....', '..XX....', '.XXXXXXX', 'XXXXXXXX', '.XXXXXXX', '..XX....', '...X....'],
  speaker: ['...X..s.', '..XX...s', 'XXXX.s.s', 'XXXX.s.s', 'XXXX.s.s', '..XX...s', '...X..s.'],
  flame: ['...o...', '..oo...', '..ooo..', '.oooo..', '.oyyoo.', 'ooyyyoo', 'ooyYyoo', '.oyYyo.', '..ooo..'],
  star: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '.XXXXX.', '.XX.XX.', '.X...X.'],
  bell: ['...k...', '..hGs..', '.hGGGs.', '.hGGGs.', '.hGGGs.', 'hGGGGGs', '...k...'],
  tick: ['......XX', '.....XXX', 'XX..XXX.', 'XXXXXX..', '.XXXX...', '..XX....'],
  smallTick: ['....X', '...XX', 'X.XX.', 'XXX..', '.X...'],
  lock: ['.XXXX.', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXsXXX', 'XXsXXX', 'XXXXXX'],
  page: ['XXXXX..', 'XhhhXX.', 'XhhhhhX', 'XhsshhX', 'XhhhhhX', 'XhsshhX', 'XhhhhhX', 'XXXXXXX'],
} as const;
export type MarkName = keyof typeof MARK;
/** A button's picture, bare: `c` is its colour, `shade` its second colour where it has one. */
export function mark(name: MarkName, c: string, shade = c): Grid {
  const g = grid(MARK[name][0].length, MARK[name].length);
  draw(g, 0, 0, MARK[name], { X: c, s: shade, h: '#FFFDF4', o: '#F2A444', y: '#FFD98A', Y: '#FFF3CC', G: '#F2C040', k: '#8A5F16' });
  return g;
}
/** A stall's picture, bare, to set in a seal. */
export function stallArt(stop: 'sacks' | 'bells' | 'missions' | 'book'): Grid {
  const o = stallIcon(stop);
  return o.slice(1, -1).map((row) => row.slice(1, -1).map((c) => (c === INK ? null : c)));
}
