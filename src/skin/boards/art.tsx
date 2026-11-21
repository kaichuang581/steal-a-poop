import type { CSSProperties } from 'react';
import { pixelRects } from '../components/pixels';
import { badgeArt, BADGE_W } from '../ranked/badge';
import { TIERS } from '../../lib/ranked';

/**
 * The leaderboards' pixel art (docs/leaderboards/LEADERBOARDS-PLAN.md, sections 6.4, 7.3, 7.4, 8.5 and 9.2): every grid as
 * the plan draws it, one character an art pixel. `Pix` draws a grid at `px` art pixels to the plan's pixel, times the
 * screen's scale `--u`, with crisp edges. Brian's own art replaces the four icons when it arrives
 * (src/skin/assets/leaderboard/ranked.png, wins.png, level.png, podium.png).
 */
export function Pix({ rows, colors, px = 2, className, style }: { rows: readonly string[]; colors: Record<string, string>; px?: number; className?: string; style?: CSSProperties }) {
  const w = rows[0]?.length ?? 0, h = rows.length;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false"
      style={{ width: `calc(${w * px} * var(--u))`, height: `calc(${h * px} * var(--u))`, flex: 'none', ...style }}>
      {pixelRects(rows, colors)}
    </svg>
  );
}

const INK = { X: 'var(--hm-ink)' };

/** The three tabs' icons and the title tag's podium, 12 x 12 at 2 px (24 at --u = 1). */
export const ICONS = {
  ranked: [
    '.XXXXXXXXXX.',
    '.XXXXXXXXXX.',
    '.XXXX..XXXX.',
    '.XXX.XX.XXX.',
    '.XX.XXXX.XX.',
    '.XXXX..XXXX.',
    '.XXX.XX.XXX.',
    '.XX.XXXX.XX.',
    '..XXXXXXXX..',
    '...XXXXXX...',
    '....XXXX....',
    '.....XX.....',
  ],
  wins: [
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'X.XXXXXXXX.X',
    'X.XXXXXXXX.X',
    '.XXXXXXXXXX.',
    '...XXXXXX...',
    '....XXXX....',
    '.....XX.....',
    '.....XX.....',
    '....XXXX....',
    '...XXXXXX...',
    '...XXXXXX...',
  ],
  level: [
    '.....XX.....',
    '....XXXX....',
    '...XXXXXX...',
    '..XXXXXXXX..',
    '.XXXXXXXXXX.',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
  ],
  podium: [
    '............',
    '............',
    '....XXXX....',
    '....XXXX....',
    '....XXXX....',
    'XXX.XXXX....',
    'XXX.XXXX....',
    'XXX.XXXX.XXX',
    'XXX.XXXX.XXX',
    'XXX.XXXX.XXX',
    'XXX.XXXX.XXX',
    'XXX.XXXX.XXX',
  ],
} as const;
export type IconName = keyof typeof ICONS;

/** An icon in the ink colour (or `color`), at `px` art pixels to the plan's pixel: 2 is 24, 4 is 48. */
export const Icon = ({ name, px = 2, color, className }: { name: IconName; px?: number; color?: string; className?: string }) =>
  <Pix rows={ICONS[name]} colors={color ? { X: color } : INK} px={px} className={className} />;

/** The info button's "i", in wool (section 7.3). */
export const InfoGlyph = () => <Pix rows={['.XX.', '.XX.', '....', 'XXX.', '.XX.', '.XX.', '.XX.', '.XX.', 'XXXX', 'XXXX']} colors={{ X: 'var(--hm-wool)' }} />;

/** The padlock on the info card, in lantern (section 7.3). */
export const Padlock = () => <Pix rows={['.XXXX.', '.X..X.', '.X..X.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXXXXX']} colors={{ X: 'var(--hm-lantern)' }} />;

/** The snowflake in the divider's gap (section 7.4). */
export const Snowflake = () => <Pix rows={['....X....', '.X..X..X.', '..X.X.X..', '...XXX...', 'XXXXXXXXX', '...XXX...', '..X.X.X..', '.X..X..X.', '....X....']} colors={{ X: 'var(--hm-night-3)' }} />;

/** A corner bracket of the board's inner frame, top left as drawn; the others are this one mirrored (section 4.3). */
export const Bracket = ({ className }: { className?: string }) => <Pix className={className} px={3} rows={['AAAA', 'AB..', 'A...', 'A...']} colors={{ A: 'var(--hm-night-3)', B: 'var(--hm-frost)' }} />;

/** The rosettes on the podium's name plates: gold, silver and bronze, or the plain wool of a place nobody holds. */
const ROSETTE = [
  '..OOOOOO..',
  '.OHHFFFFO.',
  'OHHFFFFFFO',
  'OHFFFFFFFO',
  'OFFFDDFFFO',
  'OFFFDDFFFO',
  'OFFFFFFFFO',
  'OFFFFFFFFO',
  '.OFFFFFFO.',
  '..OOOOOO..',
  '..RRrrRR..',
  '.RRr..rRR.',
  '.RRr..rRR.',
  'R.R....R.R',
];
const METAL = ['gold', 'silver', 'bronze'] as const;
const metal = (m: string) => m === 'gold' ? ['var(--hm-lantern)', 'var(--hm-lantern-hi)', 'var(--hm-lantern-lip)'] : [`var(--hm-${m})`, `var(--hm-${m}-hi)`, `var(--hm-${m}-lip)`];
export function Rosette({ place, open = false }: { place: 1 | 2 | 3; open?: boolean }) {
  const [f, h, lip] = open ? ['var(--hm-wool)', 'var(--hm-wool)', 'var(--hm-wool-lip)'] : metal(METAL[place - 1]);
  const [r, rd] = open ? ['var(--hm-wool-lip)', 'var(--hm-wool-lip)'] : ['var(--hm-ribbon)', 'var(--hm-ribbon-dark)'];
  return <Pix className="lb-rosette" rows={ROSETTE} colors={{ O: lip, F: f, H: h, D: lip, R: r, r: rd }} />;
}

/**
 * A rank's badge at one art pixel to the screen's pixel (a whole multiple, and the only one no taller than 24 at any
 * scale), or at `height` when the plan asks a size (the plates' 16). The badge's art is 25 rows, its last always empty:
 * it is drawn from 24, so 1x is 24 tall. Zenith's rays are left out here (they reach past the box, into the next row).
 */
export function TierIcon({ tier, height = 24, className }: { tier: number; height?: number; className?: string }) {
  const art = badgeArt(Math.max(0, Math.min(TIERS.length - 1, tier)));
  return (
    <svg className={`lb-tier ${className ?? ''}`} viewBox={`0 0 ${BADGE_W} 24`} width={Math.round((height * BADGE_W) / 24)} height={height} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {pixelRects(art.rows.slice(0, 24), art.colors)}
    </svg>
  );
}
