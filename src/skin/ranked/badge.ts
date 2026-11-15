import { TIERS } from '../../lib/ranked';

/**
 * The badge of each rank, as pixel art: a fair-day rosette that grows with the rank, and no two are the same badge in
 * another paint. Lamb is the bare rosette; Yearling has short ribbon tails; Shearling long ones; Ram grows a pair of
 * horns; Bellwether has a star in the middle instead; Shepherd adds laurel leaves either side; Blue Ribbon a second
 * pair of tails in gold behind the first; Golden Fleece wears a crown over all of it. Drawn as rows of characters, like every other pixel icon (components/pixels.tsx).
 */
export const BADGE_W = 23;
export const BADGE_H = 25;
const CX = 11, CY = 10;

interface Look { tails: number; star: boolean; wings: boolean; crown: boolean; horns?: boolean; double?: boolean; colors: Record<string, string> }
const INK = '#3B2A1E';
const paint = (ring: string, shade: string, centre: string, shine: string, tail: string, tailShade: string, extra: Record<string, string> = {}) =>
  ({ K: INK, R: ring, r: shade, C: centre, c: shine, T: tail, t: tailShade, S: '#FFF6D0', L: '#7FA65A', l: '#4F7A3A', ...extra });

const LOOKS: Look[] = [
  { tails: 0, star: false, wings: false, crown: false, colors: paint('#F4ECDD', '#D8CBB3', '#FFFDF6', '#FFFFFF', '#D8CBB3', '#BFAF93') },
  { tails: 6, star: false, wings: false, crown: false, colors: paint('#9BCB7C', '#6FA354', '#F4ECDD', '#FFFFFF', '#6FA354', '#4F7F3A') },
  { tails: 9, star: false, wings: false, crown: false, colors: paint('#8FD3E8', '#5AA9C7', '#F2FBFF', '#FFFFFF', '#5AA9C7', '#3D86A3') },
  { tails: 9, star: false, wings: false, crown: false, horns: true, colors: paint('#D08A4C', '#A5622B', '#F6D7A8', '#FFEFD2', '#A5622B', '#7E461A', { H: '#F3E2C0', h: '#C9B08A' }) },
  { tails: 9, star: true, wings: false, crown: false, colors: paint('#E9C46A', '#C49A2E', '#8A5A1F', '#A8742C', '#C49A2E', '#9A7418', { S: '#FFF1C2' }) },
  { tails: 9, star: true, wings: true, crown: false, colors: paint('#B58BD6', '#8559AD', '#4A2F6B', '#62408A', '#8559AD', '#643F88', { S: '#F5E9FF' }) },
  { tails: 10, star: true, wings: true, crown: false, double: true, colors: paint('#4F7FD9', '#2F54A8', '#F2C14E', '#FFE08A', '#2F54A8', '#1F3A7A', { S: '#1F3A7A', L: '#C9A227', l: '#96741A', G: '#F2C14E', g: '#C9952A' }) },
  { tails: 10, star: true, wings: true, crown: true, double: true, colors: paint('#FFD766', '#E0A82E', '#B8362E', '#D4524A', '#B8362E', '#8C231D', { S: '#FFF6D0', L: '#FFD766', l: '#C9952A', G: '#FFD766', g: '#C9952A' }) },
];

const STAR = ['..S..', '.SSS.', 'SSSSS', '.SSS.', '..S..'];
const CROWN = ['S..S..S', 'SS.S.SS', 'SSSSSSS'];

function build(look: Look): string[] {
  const g: string[][] = Array.from({ length: BADGE_H }, () => Array<string>(BADGE_W).fill('.'));
  const put = (x: number, y: number, ch: string) => { if (x >= 0 && x < BADGE_W && y >= 0 && y < BADGE_H) g[y][x] = ch; };
  // A second, shorter pair of tails behind the first, splayed wider: the mark of the two highest ranks.
  if (look.double) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const y = 13 + i, lean = Math.floor(i / 2);
        for (let w = 0; w < 3; w++) put(CX + side * (5 + lean + w), y, w === 0 ? 'g' : 'G');
      }
    }
  }
  // The ribbon tails, behind the rosette: two bands leaning outwards, each ending in a notch.
  if (look.tails > 0) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < look.tails; i++) {
        const y = 13 + i, lean = Math.floor(i / 4);
        for (let w = 0; w < 4; w++) {
          const x = CX + side * (2 + lean + w);
          const notch = i === look.tails - 1 && (w === 1 || w === 2);
          if (!notch) put(x, y, w === 0 ? 't' : 'T');
        }
      }
    }
  }
  // Laurel leaves up each side: three small leaves hugging the rosette, each a lit tip on a darker stem.
  if (look.wings) {
    for (const side of [-1, 1]) {
      for (const [out, y] of [[9, 14], [10, 10], [9, 6]] as const) {
        const x = CX + side * out;
        put(x, y, 'l'); put(x + side, y - 1, 'L'); put(x + side, y - 2, 'L'); put(x, y - 1, 'L');
      }
    }
  }
  // The rosette: a scalloped ring round a plain middle, lit from the upper left.
  for (let y = 0; y < BADGE_H; y++) for (let x = 0; x < BADGE_W; x++) {
    const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (r > 7.1 + 0.75 * Math.cos(10 * a)) continue;
    if (r <= 4.3) put(x, y, dx + dy < -3 ? 'c' : 'C');
    else put(x, y, dx + dy > 3 ? 'r' : 'R');
  }
  // A ram's horns, curling out from the top of the rosette on each side.
  if (look.horns) {
    for (const side of [-1, 1]) {
      for (const [dx, dy, ch] of [[6, -7, 'H'], [7, -7, 'H'], [8, -6, 'H'], [9, -5, 'H'], [9, -4, 'h'], [8, -3, 'h'], [8, -6, 'H'], [7, -6, 'h']] as const) put(CX + side * dx, CY + dy, ch);
    }
  }
  if (look.star) STAR.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'S') put(CX - 2 + i, CY - 2 + j, 'S'); }));
  if (look.crown) CROWN.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'S') put(CX - 3 + i, j, 'S'); }));
  // An ink line round the whole thing, so it reads on wood, paper and slate alike.
  const filled = (x: number, y: number) => x >= 0 && x < BADGE_W && y >= 0 && y < BADGE_H && g[y][x] !== '.' && g[y][x] !== 'K';
  for (let y = 0; y < BADGE_H; y++) for (let x = 0; x < BADGE_W; x++) {
    if (g[y][x] === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y][x] = 'K';
  }
  return g.map((row) => row.join(''));
}

const made = LOOKS.map(build);

/** The badge for a rank (0 to 7): its rows and what each character is painted. */
export function badgeArt(tier: number): { rows: readonly string[]; colors: Record<string, string> } {
  const t = Math.max(0, Math.min(TIERS.length - 1, Math.round(tier)));
  return { rows: made[t], colors: LOOKS[t].colors };
}

/** The rank's main colour, for a number or an edge that should match its badge. */
export const tierColor = (tier: number) => LOOKS[Math.max(0, Math.min(TIERS.length - 1, Math.round(tier)))].colors.R;
