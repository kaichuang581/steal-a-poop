import { TIERS } from '../../lib/ranked';

/**
 * The badge of each rank, as pixel art: a rosette that grows with the rank, painted in the rank's own material, and no
 * two are the same badge in another paint. Wood is the bare rosette; Stone has short ribbon tails; Iron long ones; Gold
 * grows two flared points at the top; Crystal has a star in the middle instead; Titan adds metal wings either side;
 * Eclipse is a dark disc with a burning gold rim of second tails; Zenith wears a crown over all of it, radiant, with pulsing
 * pixel rays round it (RankBadge.tsx, `.sk-zenith-rays` in ranked.css). Drawn as rows of characters, like every other pixel icon (components/pixels.tsx).
 */
export const BADGE_W = 23;
export const BADGE_H = 25;
const CX = 11, CY = 10;

interface Look { tails: number; star: boolean; wings: boolean; crown: boolean; horns?: boolean; double?: boolean; colors: Record<string, string> }
const INK = '#3B2A1E';
const paint = (ring: string, shade: string, centre: string, shine: string, tail: string, tailShade: string, extra: Record<string, string> = {}) =>
  ({ K: INK, R: ring, r: shade, C: centre, c: shine, T: tail, t: tailShade, S: '#FFF6D0', L: '#7FA65A', l: '#4F7A3A', ...extra });

const LOOKS: Look[] = [
  // Wood: warm brown timber.
  { tails: 0, star: false, wings: false, crown: false, colors: paint('#B9814D', '#8A5A2F', '#EBCB9C', '#F7E3C1', '#8A5A2F', '#633F1E') },
  // Stone: grey.
  { tails: 6, star: false, wings: false, crown: false, colors: paint('#A9ABAF', '#7D8085', '#DCDDDF', '#F2F2F2', '#7D8085', '#5B5E63') },
  // Iron: blue-grey steel.
  { tails: 9, star: false, wings: false, crown: false, colors: paint('#7F97AB', '#566E82', '#CAD6DF', '#EEF3F7', '#566E82', '#3C5062') },
  // Gold.
  { tails: 9, star: false, wings: false, crown: false, horns: true, colors: paint('#EBC45A', '#C4962A', '#FFF0BF', '#FFFFFF', '#C4962A', '#97711A', { H: '#FFE38A', h: '#C4962A' }) },
  // Crystal: cyan, a white star in a deep teal middle.
  { tails: 9, star: true, wings: false, crown: false, colors: paint('#7FE1EE', '#3BB4CB', '#1F8098', '#2F9AB3', '#3BB4CB', '#25869C', { S: '#F2FDFF' }) },
  // Titan: crimson with gunmetal wings.
  { tails: 9, star: true, wings: true, crown: false, colors: paint('#C9503C', '#93321F', '#3B2626', '#553A36', '#93321F', '#6B2416', { S: '#FFD7A8', L: '#A3ACB6', l: '#6C747E' }) },
  // Eclipse: a near-black violet disc, its gold corona behind, violet light at the edges.
  { tails: 10, star: true, wings: true, crown: false, double: true, colors: paint('#4A3970', '#2D2147', '#130E1E', '#241B36', '#2D2147', '#1B1430', { S: '#F7C65E', L: '#B89DFF', l: '#7B61CB', G: '#F7C65E', g: '#C98F2E' }) },
  // Zenith: radiant white gold, crowned.
  { tails: 10, star: true, wings: true, crown: true, double: true, colors: paint('#FFF1B8', '#F2C94C', '#F2B829', '#FFDB6E', '#F2C94C', '#C9952A', { S: '#FFFFFF', L: '#FFF1B8', l: '#E2B33C', G: '#FFFFFF', g: '#F2C94C' }) },
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
  // Gold's two flared points, curling out from the top of the rosette on each side.
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
