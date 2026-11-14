import { pixelRects } from '../components/pixels';
import type { Item } from './catalog';

/**
 * The Trading Post's pictures. Items are voxel thumbnails baked from the game's own models by
 * tools/renderThumbs.mjs into public/shop (docs/PLAN_TRADING_POST_REFINE.md Part 7): what a player collects is the thing
 * the table draws. The few small marks here (the two currencies, the tab icons, the padlock) are pixel art on one grid,
 * written as rows of characters, a character a pixel.
 */
const thumb = (name: string) => `${import.meta.env.BASE_URL}shop/${name}.webp`;

/** An item's thumbnail. */
export function ItemArt({ item, size = 96 }: { item: Item; size?: number }) {
  return <img className="sk-thumb" src={thumb(item.id)} width={size} height={size} alt="" draggable={false} />;
}
/** One of the market stall's baked pictures (tools/renderStall.mjs): a stall's backdrop, its awning's edge, a crate, a sack in its crate, the lantern. */
export const stallArt = (name: string) => `${import.meta.env.BASE_URL}shop/stall/${name}.webp`;

/** Pixel art from rows of characters (components/pixels.tsx), as a picture of its own. */
export function Pix({ rows, colors, size, className }: { rows: readonly string[]; colors: Record<string, string>; size: number; className?: string }) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  return <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" aria-hidden="true" className={className}>{pixelRects(rows, colors)}</svg>;
}

/** A Wool Coin: gold, stamped with a ball of wool. Drawn on the same 10 x 10 grid as the bell, shown at the same size. */
export function CoinArt({ size = 20 }: { size?: number }) {
  return (
    <Pix size={size} className="sk-cur" colors={{ d: '#a8741a', G: '#f2c040', h: '#fff0a8', w: '#fff8e0' }} rows={[
      '...dddd...',
      '.ddGGGGdd.',
      '.dGhwwwGd.',
      'dGhwGGGwGd',
      'dGGwGwwwGd',
      'dGGwGwGwGd',
      'dGGGwwGwGd',
      '.dGGGGwGd.',
      '.ddGGGGdd.',
      '...dddd...',
    ]} />
  );
}
/** A Golden Bell: brass, with its clapper. */
export function BellArt({ size = 20 }: { size?: number }) {
  return (
    <Pix size={size} className="sk-cur" colors={{ k: '#7a5418', b: '#e0b13a', h: '#fff3c2', d: '#a87a1f', c: '#7a5418' }} rows={[
      '....kk....',
      '...bbbb...',
      '..bhbbbb..',
      '..bhbbbb..',
      '..bhbbbb..',
      '.bbhbbbbb.',
      '.bbbbbbbb.',
      'dddddddddd',
      '....cc....',
      '....cc....',
    ]} />
  );
}

const INK = { k: '#5b3a1e', b: '#c9a66b', r: '#8a5a2e', p: '#fff8e8' };
const TAB_ICONS = {
  sacks: ['....kkkk....', '...kbbbbk...', '....krrk....', '...kbbbbk...', '..kbbbbbbk..', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kbbbbbbk..', '...kkkkkk...'],
  bells: ['.....kk.....', '....kbbk....', '...kbbbbk...', '...kbbbbk...', '...kbbbbk...', '..kbbbbbbk..', '..kbbbbbbk..', '.kkkkkkkkkk.', '.....kk.....', '.....kk.....', '............'],
  missions: ['............', '..kkkkkkkk..', '.kppppppppk.', '.kpkkkkkkpk.', '.kppppppppk.', '.kpkkkkkppk.', '.kppppppppk.', '.kpkkkkkkpk.', '.kppppppppk.', '..kkkkkkkk..', '............'],
  collection: ['............', '.kkkk..kkkk.', 'kppppkkppppk', 'kpkkppppkkpk', 'kppppppppppk', 'kpkkppppkkpk', 'kppppppppppk', 'kpkkppppkkpk', 'kppppkkppppk', '.kkkk..kkkk.', '............'],
} as const;
/** The four tabs' icons: a sack, a bell, a scroll, a book. */
export function TabIcon({ tab, size = 18 }: { tab: keyof typeof TAB_ICONS; size?: number }) {
  return <Pix size={size} colors={INK} rows={TAB_ICONS[tab]} />;
}

/** A small padlock, on an item not found yet. */
export function PadlockArt({ size = 16 }: { size?: number }) {
  return (
    <Pix size={size} className="sk-padlock" colors={{ k: '#3a2618', y: '#f2c94a', s: '#d8d0c0' }} rows={[
      '..ssss..',
      '.s....s.',
      '.s....s.',
      'kkkkkkkk',
      'kyyyyyyk',
      'kyykkyyk',
      'kyykkyyk',
      'kyyyyyyk',
      'kkkkkkkk',
    ]} />
  );
}
/** A small speaker, on a sound that plays when it is tapped. */
export function SpeakerMark({ size = 14 }: { size?: number }) {
  return <Pix size={size} colors={{ w: '#fff4dc' }} rows={['...w...', '..ww.w.', 'wwww..w', 'wwww..w', '..ww.w.', '...w...']} />;
}

/** The machine's lever knob: a red ball with a shine. */
export function KnobArt({ size = 28 }: { size?: number }) {
  return (
    <Pix size={size} colors={{ r: '#d9412b', d: '#9a2a18', w: '#ffd0c0' }} rows={[
      '..rrrr..',
      '.rwwrrr.',
      'rrwrrrrr',
      'rrrrrrrd',
      'rrrrrrdd',
      'rrrrrddd',
      '.rrrddd.',
      '..dddd..',
    ]} />
  );
}

/** Rays behind a prize: twelve wedges round the middle, in the current colour, turned slowly by CSS. */
export function Rays({ className }: { className?: string }) {
  const wedge = (i: number) => {
    const a = (i * 30 * Math.PI) / 180, h = (8 * Math.PI) / 180, r = 80;
    const p = (t: number) => `${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`;
    return <polygon key={i} points={`50,50 ${p(a - h)} ${p(a + h)}`} />;
  };
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice" fill="currentColor">{Array.from({ length: 12 }, (_, i) => wedge(i))}</svg>;
}
