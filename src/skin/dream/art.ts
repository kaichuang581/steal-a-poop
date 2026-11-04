/**
 * Pixel art for Counting Sheep, drawn once into small offscreen canvases and then blitted with smoothing off, so every
 * pixel lands crisp at any scale. Sprites are character maps with a palette; an outline is added around each shape.
 */

export const C = {
  line: '#241a33',
  // the dream
  skyTop: '#221f55', skyMid: '#3d3486', skyLow: '#8a76c4', star: '#fff6d6', moon: '#fff1b8',
  hillFar: '#4a3f8e', hillNear: '#38306f',
  grass: '#4c7a5d', grassTop: '#8cc07f', grassDark: '#36594a', flower: '#f6d3ec',
  wool: '#fbf7ee', woolShade: '#cfc5e4', face: '#2d2538', eye: '#ffffff', nose: '#e7a2b4',
  wood: '#b07a4f', woodDark: '#734a33', sign: '#f5e6c4', signOk: '#ffd66b', signBad: '#ff8a8a', ink: '#3a2a3a',
  bubble: '#f6f1ff', bubbleEdge: '#c9bdf0',
  // the bedroom
  wall: '#1c1a3c', wallLow: '#272453', floor: '#3a2b40', floorLine: '#2c2032',
  bed: '#7c4b3b', bedDark: '#55322a', sheet: '#e9e3f5', pillow: '#f3eefb', pillowShade: '#cfc6e6',
  quilt: ['#c45a6c', '#e7b14d', '#5c8fc6', '#7fb46b'],
  skin: '#f0c19b', skinShade: '#d89e7c', cheek: '#ec8f8f', tash: '#8b5a3c', capA: '#4f6fd0', capB: '#f2efe8', pom: '#fff6d6',
  clock: '#e9b949', clockFace: '#fff8e6', rug: '#6b3f6a', rugEdge: '#8d5a8a', moonlight: 'rgba(190,180,255,0.10)',
} as const;

type Pal = Record<string, string>;

/** Builds a sprite from rows of characters ('.' is empty), with a one-pixel outline in `outline` around it. */
export function sprite(rows: readonly string[], pal: Pal, outline: string | null = C.line): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w + 2;
  cv.height = h + 2;
  const g = cv.getContext('2d')!;
  const filled = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && (rows[y][x] ?? '.') !== '.';
  if (outline) {
    g.fillStyle = outline;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] ?? '.';
    if (ch === '.') continue;
    g.fillStyle = pal[ch];
    g.fillRect(x + 1, y + 1, 1, 1);
  }
  return cv;
}

// A sheep side-on, facing right: a cloud of wool, a dark face with a pink nose, and four legs.
const SHEEP_BODY = [
  '.....ss.sss.ss......',
  '...ssWWsWWWsWWs.....',
  '..sWWWWWWWWWWWWs.kk.',
  '.sWWWWWWWWWWWWWWkkkk',
  'sWWWWWWWWWWWWWWkkkek',
  'sWWWWWWWWWWWWWWkkkkk',
  'sWWWWWWWWWWWWWWskkkn',
  '.sWWWWWWWWWWWWWs.kk.',
  '..sWWWsWWWWsWWs.....',
  '...ssssssssssss.....',
];
const LEGS = {
  a: ['....kk......kk......', '....kk......kk......', '....kk......kk......'],
  b: ['....kk......kk......', '...k..k....k..k.....', '..k....k..k....k....'],
  jump: ['...kkk.....kkk......', '....................', '....................'],
  bonk: ['....kk......kk......', '....kk......kk......', '....kk......kk......'],
};
const SHEEP_PAL: Pal = { W: C.wool, s: C.woolShade, k: C.face, e: C.eye, n: C.nose, x: C.eye };

export interface Art {
  sheep: { a: HTMLCanvasElement; b: HTMLCanvasElement; jump: HTMLCanvasElement; bonk: HTMLCanvasElement };
  icon: HTMLCanvasElement;
  fence: HTMLCanvasElement;
}

let art: Art | null = null;

export function getArt(): Art {
  if (art) return art;
  const bonkBody = SHEEP_BODY.map((r, i) => (i === 4 ? r.slice(0, 16) + 'kxkx' : r));
  art = {
    sheep: {
      a: sprite([...SHEEP_BODY, ...LEGS.a], SHEEP_PAL),
      b: sprite([...SHEEP_BODY, ...LEGS.b], SHEEP_PAL),
      jump: sprite([...SHEEP_BODY, ...LEGS.jump], SHEEP_PAL),
      bonk: sprite([...bonkBody, ...LEGS.bonk], SHEEP_PAL),
    },
    icon: sprite(['.sWs.', 'sWWWkk', 'sWWWke', '.k.k..'], SHEEP_PAL),
    // A three-rail wooden fence: two posts with pointed tops, rails, and a little grain.
    fence: sprite([
      '.d........d.',
      'dPd......dPd',
      'dPdrrrrrrdPd',
      'dPRRRRRRRRPd',
      'dPrrrrrrrrPd',
      'dPd......dPd',
      'dPd......dPd',
      'dPdrrrrrrdPd',
      'dPRRRRRRRRPd',
      'dPrrrrrrrrPd',
      'dPd......dPd',
      'dPd......dPd',
      'dPd......dPd',
      'dPd......dPd',
    ], { d: C.woodDark, P: C.wood, R: '#c99064', r: C.woodDark }),
  };
  return art;
}
