import { Pix } from '../kit/surfaces';

/**
 * The profile's pixel art (Brian's profile plan of 2026-11-23, section 9.1), drawn exactly as the plan writes the grids,
 * one character an art pixel, at 2 px an art pixel (8 x 8 shows at 16, 12 x 12 at 24). When Brian's own icons arrive
 * they replace these as PNGs in src/skin/assets/profile/, with the same names.
 */
const GRIDS = {
  pencil: ['......EE', '.....XEE', '....XXX.', '...XXX..', '..XXX...', '.TXX....', 'TTT.....', 'K.......'],
  letter: ['.XXXXXXXXXX.', 'XXXXX..XXXXX', 'XXXX....XXXX', 'XXX..XX..XXX', 'XXX..XX..XXX', 'XX........XX', 'XX..XXXX..XX', 'XX..XXXX..XX', 'XXXXXXXXXXXX', 'LLLLLLLLLLLL', '.LLLLLLLLLL.', '............'],
  length: ['............', '............', '............', '............', '.X........X.', 'XX........XX', 'XXXXXXXXXXXX', 'XX........XX', '.X........X.', '............', '............', '............'],
  moon: ['....XXXX....', '..XXXX......', '.XXXX.......', '.XXX........', 'XXXX........', 'XXXX........', 'XXXX........', 'XXXXX.......', '.XXXXX....X.', '.XXXXXXXXXX.', '..XXXXXXXX..', '....XXXX....'],
  copy: ['..XXXXXX', '..X....X', 'XXXXXX.X', 'X....X.X', 'X....X.X', 'X....XXX', 'X....X..', 'XXXXXX..'],
  plusMinus: ['..XX........', '..XX........', 'XXXXXX......', 'XXXXXX......', '..XX........', '..XX........', '............', '............', '......XXXXXX', '......XXXXXX', '............', '............'],
  bars: ['............', '.........XX.', '.........XX.', '.....XX..XX.', '.....XX..XX.', '.....XX..XX.', '.XX..XX..XX.', '.XX..XX..XX.', '.XX..XX..XX.', '.XX..XX..XX.', 'XXXXXXXXXXXX', '............'],
  swap: ['..X......X..', '.XX......XX.', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', '.XX......XX.', '..X......X..'],
  pineTall: ['....X....', '...XXX...', '..XXXXX..', '...XXX...', '..XXXXX..', '.XXXXXXX.', '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', '....X....', '....X....'],
  pineMid: ['...X...', '..XXX..', '.XXXXX.', '..XXX..', '.XXXXX.', 'XXXXXXX', '...X...', '...X...'],
  pineSmall: ['..X..', '.XXX.', 'XXXXX', '.XXX.', 'XXXXX', '..X..'],
  shield: ['HHHHHHHH', 'XXXXXXXL', 'XXXXXKXL', 'XKXXKXXL', 'XXKKXXXL', '.XXXXXL.', '..XXXL..', '...XL...'],
} as const;

export const PencilArt = () => <Pix rows={GRIDS.pencil} colors={{ X: 'var(--hm-lantern)', E: 'var(--pf-nose)', T: 'var(--hm-wool-lip)', K: 'var(--hm-ink)' }} />;
export const LetterArt = () => <Pix rows={GRIDS.letter} colors={{ X: 'var(--hm-wool)', L: 'var(--hm-wool-lip)' }} />;
export const LengthArt = () => <Pix rows={GRIDS.length} colors={{ X: 'var(--hm-wool)' }} />;
export const MoonArt = () => <Pix rows={GRIDS.moon} colors={{ X: 'var(--hm-lantern-hi)' }} />;
export const CopyArt = () => <Pix rows={GRIDS.copy} colors={{ X: 'var(--hm-ink)' }} />;
export const PlusMinusArt = () => <Pix rows={GRIDS.plusMinus} colors={{ X: 'var(--hm-lantern-hi)' }} />;
/** The small shield: in lantern by default; `quiet` draws it all in frost (the footer note). */
export const ShieldArt = ({ quiet = false }: { quiet?: boolean }) =>
  <Pix rows={GRIDS.shield} colors={quiet ? { H: 'var(--hm-frost)', X: 'var(--hm-frost)', L: 'var(--hm-frost)', K: 'var(--hm-night)' } : { H: 'var(--hm-lantern-hi)', X: 'var(--hm-lantern)', L: 'var(--hm-lantern-lip)', K: 'var(--hm-ink)' }} />;
/** The bar chart (v2, 9.1): Your numbers. */
export const BarsArt = () => <Pix rows={GRIDS.bars} colors={{ X: 'var(--hm-wool)' }} />;
/** The two-way arrow (v2, 9.3) between the two sheep of the empty friends list. */
export const SwapArt = () => <Pix rows={GRIDS.swap} colors={{ X: 'var(--hm-night-3)' }} />;
/** The night band's pines (v2, 9.2), at 3 px an art pixel. */
export const PineArt = ({ size }: { size: 'tall' | 'mid' | 'small' }) =>
  <Pix rows={size === 'tall' ? GRIDS.pineTall : size === 'mid' ? GRIDS.pineMid : GRIDS.pineSmall} colors={{ X: 'var(--hm-night)' }} px={3} />;
