import { Pix } from '../kit/surfaces';

/**
 * The pen screen's pixel art: docs/pen/PEN-PLAN-V3.md section 11 where it gives a grid (it replaces the matching grids
 * of docs/pen/PEN-PLAN.md section 9), and PEN-PLAN.md's own grids for the rest (the hourglass, the wool ball, the twist,
 * the back arrow, the chat bubble). One character is one art pixel; `X` takes the colour the plan gives where the icon
 * is used. Every grid is drawn at a whole number of pixels per art pixel (Pix): 2 by default, so 12 x 12 shows at 24
 * and 8 x 8 at 16. When Brian's own icons arrive they replace these as PNGs in src/skin/assets/pen/, with the same names.
 */
export const PEN_ART = {
  hourglass: ['.XXXXXXXXXX.', '..X......X..', '..X.XXXX.X..', '...X.XX.X...', '....X..X....', '.....XX.....', '.....XX.....', '....X..X....', '...X....X...', '..X..XX..X..', '..X.XXXX.X..', '.XXXXXXXXXX.'],
  // 11.3, empty seat: `O` night-3, `E` night-deep.
  seatEmpty: ['.OOOOOO.', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', 'OEEEEEEO', '.OOOOOO.'],
  // 11.4, crown: `X` lantern, `L` lantern-lip; every row drawn.
  crown: ['X..XX..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'LLLLLLLL'],
  // 11.5, gate, with a clean two-pixel brace.
  gate: ['XX........XX', 'XX........XX', 'XXXXXXXXXXXX', 'XX......XXXX', 'XX.....XX.XX', 'XX....XX..XX', 'XXXXXXXXXXXX', 'XX..XX....XX', 'XX.XX.....XX', 'XXXX......XX', 'XXXXXXXXXXXX', 'XX........XX'],
  // 11.6, shield with a check: `H` lantern-hi, `X` lantern, `L` lantern-lip, `K` ink. The check is two art pixels thick.
  shield: ['HHHHHHHHHHHH', 'XXXXXXXXXXXL', 'XXXXXXXXXKKL', 'XXXXXXXXKKXL', 'XKKXXXXKKXXL', 'XXKKXXKKXXXL', 'XXXKKKKXXXXL', 'XXXXKKXXXXXL', '.XXXXXXXXXL.', '..XXXXXXXL..', '...XXXXXL...', '....XXXL....'],
  // 11.8, chevron pointing down (16 x 8); flipped to point up.
  chevron: ['X......X', 'XX....XX', '.XX..XX.', '..XXXX..'],
  // 11.9, clock (16).
  clock: ['..XXXX..', '.X....X.', 'X..X...X', 'X..X...X', 'X..XXX.X', 'X......X', '.X....X.', '..XXXX..'],
  // 11.10, link: two linked rings, each two art pixels thick.
  link: ['.....XXXXXX.', '....XXXXXXXX', '....XX....XX', '....XX....XX', '.XXXXXX...XX', 'XXXXXXXX..XX', 'XX..XXXXXXXX', 'XX...XXXXXX.', 'XX....XX....', 'XX....XX....', 'XXXXXXXX....', '.XXXXXX.....'],
  // 11.11, rounds: two arrows chasing each other.
  rounds: ['.......X....', '.XXXXXXXX...', 'XXXXXXXXXX..', 'XX......X...', 'XX.....X....', 'XX..........', '..........XX', '....X.....XX', '...X......XX', '..XXXXXXXXXX', '...XXXXXXXX.', '....X.......'],
  woolBall: ['....XXXX....', '..XXXXXXXX..', '.XX--XXXXXX.', '.XXXX--XXXX.', 'XXXXXXX--XXX', 'XX--XXXXX-XX', 'XXXX--XXXXXX', 'XXXXXX--XXXX', '.XXXXXXX--X.', '.XXXXXXXXXX.', '..XXXXXXXX..', '....XXXX....'],
  twist: ['.....XX.....', '.....XX.....', '.X...XX...X.', '..X..XX..X..', '...XXXXXX...', 'XXXXX..XXXXX', 'XXXXX..XXXXX', '...XXXXXX...', '..X..XX..X..', '.X...XX...X.', '.....XX.....', '.....XX.....'],
  // 11.13, room: a lobby's own pen-house, in ink.
  room: ['.....XX.....', '....XXXX....', '...XXXXXX...', '..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '.XX......XX.', '.XX.XXXX.XX.', '.XX.X..X.XX.', '.XX.X..X.XX.', '.XX.X..X.XX.', '.XXXXXXXXXX.'],
  // 11.14, die: the Game section's icon.
  die: ['.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XX..XXXX..XX', 'XX..XXXX..XX', 'XXXXXXXXXXXX', 'XXXXX..XXXXX', 'XXXXX..XXXXX', 'XXXXXXXXXXXX', 'XX..XXXX..XX', 'XX..XXXX..XX', 'XXXXXXXXXXXX', '.XXXXXXXXXX.'],
  // 11.15, small gear: a ring with teeth (16).
  gear: ['...XX...', '.XXXXXX.', '.XX..XX.', 'XX....XX', 'XX....XX', '.XX..XX.', '.XXXXXX.', '...XX...'],
  back: ['............', '............', '....X.......', '...XX.......', '..XXXXXXXXX.', '.XXXXXXXXXX.', '.XXXXXXXXXX.', '..XXXXXXXXX.', '...XX.......', '....X.......', '............', '............'],
  chat: ['............', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XX..X..X..XX', 'XX..X..X..XX', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XX........', '..X.........', '............', '............'],
  // 11.17, small pause (16).
  pause: Array<string>(8).fill('.XX..XX.'),
  // 11.16, check (16): "Link copied".
  check: ['.......X', '......XX', '.....XX.', 'X...XX..', 'XX.XX...', '.XXX....', '..X.....', '........'],
  // Not in the plans: the host's controls on another player's row, drawn the same way at 8 x 8 (16).
  mute: ['...X....', '..XX....', 'XXXX.X.X', 'XXXX..X.', 'XXXX.X.X', '..XX....', '...X....', '........'],
  unmute: ['...X..X.', '..XX...X', 'XXXX.X.X', 'XXXX.X.X', 'XXXX.X.X', '..XX...X', '...X..X.', '........'],
  kick: ['XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX'],
} as const;
export type PenArt = keyof typeof PEN_ART;

/** One of the grids in `color` (its `X`), at `px` of the plan's pixels to an art pixel (2: a 12 x 12 grid at 24). */
export const PenIcon = ({ name, color = 'var(--hm-ink)', px = 2, className }: { name: PenArt; color?: string; px?: number; className?: string }) =>
  <Pix rows={PEN_ART[name]} colors={{ X: color }} px={px} className={className} />;

/** The wool ball: wool with its lip-coloured strands. */
export const WoolBall = ({ px = 2 }: { px?: number }) => <Pix rows={PEN_ART.woolBall} colors={{ X: 'var(--hm-wool)', '-': 'var(--hm-wool-lip)' }} px={px} />;

/**
 * The crown (11.4), lantern with its lip, 8 x 5 at 2: 16 x 10. On a lantern face (your own plate in the pen) it is ink:
 * lantern on lantern left only its lip row showing, a line (I8).
 */
export const Crown = ({ px = 2, onLantern = false }: { px?: number; onLantern?: boolean }) =>
  <Pix rows={PEN_ART.crown} colors={onLantern ? { X: 'var(--hm-ink)', L: 'var(--hm-ink)' } : { X: 'var(--hm-lantern)', L: 'var(--hm-lantern-lip)' }} px={px} />;

/** The shield with its check (11.6), for the chat rules strip. */
export const Shield = ({ px = 2 }: { px?: number }) =>
  <Pix rows={PEN_ART.shield} colors={{ H: 'var(--hm-lantern-hi)', X: 'var(--hm-lantern)', L: 'var(--hm-lantern-lip)', K: 'var(--hm-ink)' }} px={px} />;

/** 11.2, the sheep head: wool, face, its lip, ink eyes and a nose. The seat row's filled seat and the Players icon (at 3). */
export const SHEEP_HEAD = ['..WWWW..', '.WWWWWW.', 'EWFFFFWE', 'EFKFFKFE', '.FFFFFF.', '.FFNNFF.', '..FFFF..', '........'] as const;
export const SheepHead = ({ px = 2 }: { px?: number }) =>
  <Pix rows={SHEEP_HEAD} colors={{ W: 'var(--hm-wool)', E: 'var(--pn-face-lip)', F: 'var(--pn-face)', K: 'var(--hm-ink)', N: 'var(--pn-nose)' }} px={px} />;

/** A seat in the status card's row: the sheep head (filled) or the empty slot (11.3), 8 x 8 at 2: 16. */
export const Seat = ({ filled, px = 2 }: { filled: boolean; px?: number }) => filled
  ? <SheepHead px={px} />
  : <Pix rows={PEN_ART.seatEmpty} colors={{ O: 'var(--hm-night-3)', E: 'var(--hm-night-deep)' }} px={px} />;
