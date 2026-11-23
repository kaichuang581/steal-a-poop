import { Pix } from '../kit/surfaces';

/**
 * The pen screen's pixel art (docs/pen/PEN-PLAN.md, section 9), each grid as the plan writes it, one character an art
 * pixel. `X` takes the colour the plan gives where the icon is used; the art pixel is 2 px, so a 12 x 12 grid shows at
 * 24. When Brian's own icons arrive they replace these as PNGs in src/skin/assets/pen/, with the same names.
 */
export const PEN_ART = {
  hourglass: ['.XXXXXXXXXX.', '..X......X..', '..X.XXXX.X..', '...X.XX.X...', '....X..X....', '.....XX.....', '.....XX.....', '....X..X....', '...X....X...', '..X..XX..X..', '..X.XXXX.X..', '.XXXXXXXXXX.'],
  seatFilled: ['.WWWWWW.', 'WWWWWWWW', 'WWWWWWWW', 'WWKWWKWW', 'WWWWWWWW', 'WWWWWWWW', 'LLLLLLLL', '.LLLLLL.'],
  seatEmpty: ['.OOOOOO.', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', '.OOOOOO.'],
  crown: ['X..XX..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'LLLLLLLL'],
  gate: ['X..........X', 'XX........XX', 'XXXXXXXXXXXX', 'XX........XX', 'XX.X......XX', 'XX..X.....XX', 'XXXXXXXXXXXX', 'XX.....X..XX', 'XX......X.XX', 'XX.......XXX', 'XXXXXXXXXXXX', 'XX........XX'],
  rounds: ['....XXXXX...', '..XX.....X.X', '.X.......XXX', '.X......XXXX', 'X...........', 'X...........', 'X..........X', 'X..........X', '.X........X.', '.X........X.', '..XX....XX..', '....XXXX....'],
  woolBall: ['....XXXX....', '..XXXXXXXX..', '.XX--XXXXXX.', '.XXXX--XXXX.', 'XXXXXXX--XXX', 'XX--XXXXX-XX', 'XXXX--XXXXXX', 'XXXXXX--XXXX', '.XXXXXXX--X.', '.XXXXXXXXXX.', '..XXXXXXXX..', '....XXXX....'],
  twist: ['.....XX.....', '.....XX.....', '.X...XX...X.', '..X..XX..X..', '...XXXXXX...', 'XXXXX..XXXXX', 'XXXXX..XXXXX', '...XXXXXX...', '..X..XX..X..', '.X...XX...X.', '.....XX.....', '.....XX.....'],
  gear: ['.....XX.....', '..X.XXXX.X..', '.XXXXXXXXXX.', '..XXX..XXX..', '.XXX....XXX.', 'XXX......XXX', 'XXX......XXX', '.XXX....XXX.', '..XXX..XXX..', '.XXXXXXXXXX.', '..X.XXXX.X..', '.....XX.....'],
  back: ['............', '............', '....X.......', '...XX.......', '..XXXXXXXXX.', '.XXXXXXXXXX.', '.XXXXXXXXXX.', '..XXXXXXXXX.', '...XX.......', '....X.......', '............', '............'],
  link: ['............', '.......XXX..', '......X...X.', '.....X....X.', '....X.X..X..', '.....X.XX...', '...XX.X.....', '..X..X.X....', '.X....X.....', '.X...X......', '..XXX.......', '............'],
  chat: ['............', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XX..X..X..XX', 'XX..X..X..XX', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XX........', '..X.........', '............', '............'],
  pause: ['............', ...Array<string>(10).fill('..XXX..XXX..'), '............'],
  chevron: ['X..........X', 'XX........XX', '.XX......XX.', '..XX....XX..', '...XX..XX...', '....XXXX....'],
  shield: ['.XXXXXXXXXX.', '.XXXXXXXXXX.', '.XXXXXXXX.X.', '.XXXXXXX.XX.', '.X.XXXX.XXX.', '.XX.XX.XXXX.', '.XXX..XXXXX.', '.XXXXXXXXXX.', '..XXXXXXXX..', '...XXXXXX...', '....XXXX....', '.....XX.....'],
  clock: ['....XXXX....', '..XX....XX..', '.X........X.', '.X...X....X.', 'X....X.....X', 'X....X.....X', 'X....XXX...X', 'X..........X', '.X........X.', '.X........X.', '..XX....XX..', '....XXXX....'],
  // Not in the plan's list; drawn the same way for the controls this screen keeps (section 6.2's host controls and
  // 7.1's "Link copied").
  mute: ['............', '............', '....X.......', '...XX.......', 'XXXXX..X..X.', 'XXXXX...XX..', 'XXXXX...XX..', 'XXXXX..X..X.', '...XX.......', '....X.......', '............', '............'],
  unmute: ['............', '............', '....X...X...', '...XX....X..', 'XXXXX..X..X.', 'XXXXX...X.X.', 'XXXXX...X.X.', 'XXXXX..X..X.', '...XX....X..', '....X...X...', '............', '............'],
  kick: ['............', '.XX......XX.', '.XXX....XXX.', '..XXX..XXX..', '...XXXXXX...', '....XXXX....', '....XXXX....', '...XXXXXX...', '..XXX..XXX..', '.XXX....XXX.', '.XX......XX.', '............'],
  check: ['............', '............', '..........XX', '.........XX.', '........XX..', '.XX....XX...', '..XX..XX....', '...XXXX.....', '....XX......', '............', '............', '............'],
} as const;
export type PenArt = keyof typeof PEN_ART;

/** One of the grids in `color` (its `X`), at `px` art pixels to the plan's pixel (2: a 12 x 12 grid at 24). */
export const PenIcon = ({ name, color = 'var(--hm-ink)', px = 2, className }: { name: PenArt; color?: string; px?: number; className?: string }) =>
  <Pix rows={PEN_ART[name]} colors={{ X: color }} px={px} className={className} />;

/** The wool ball: wool with its lip-coloured strands (9.6). */
export const WoolBall = ({ px = 2 }: { px?: number }) => <Pix rows={PEN_ART.woolBall} colors={{ X: 'var(--hm-wool)', '-': 'var(--hm-wool-lip)' }} px={px} />;

/** The crown, lantern with its lip (9.3), 8 x 5 at 2: 16 x 10. */
export const Crown = ({ px = 2 }: { px?: number }) => <Pix rows={PEN_ART.crown} colors={{ X: 'var(--hm-lantern)', L: 'var(--hm-lantern-lip)' }} px={px} />;

/** A seat in the status card's row (9.2), filled or empty; 8 x 8 at 2 is 16, at 1.5 is 12. */
export const Seat = ({ filled, px = 2 }: { filled: boolean; px?: number }) => filled
  ? <Pix rows={PEN_ART.seatFilled} colors={{ W: 'var(--hm-wool)', K: 'var(--hm-ink)', L: 'var(--hm-wool-lip)' }} px={px} />
  : <Pix rows={PEN_ART.seatEmpty} colors={{ O: 'var(--hm-night-3)', E: 'var(--hm-night-deep)' }} px={px} />;
