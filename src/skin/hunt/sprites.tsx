import type { ReactElement } from 'react';
import type { PredatorKind } from '../../hunt/hunt';

/**
 * Pixel-art sprites for the Daily Hunt, drawn as grids of letters and rendered as crisp SVG rectangles. Every predator
 * is the same canine portrait in a different coat (the easiest way to a whole cast); the boss adds a scar and a crown
 * of icicles.
 *
 * Grid legend: O outline, M fur, D dark fur, L light fur, E eye, P pupil, N nose, T teeth, R mouth, X scar, C crown.
 */
const PREDATOR = [
  '..OO................OO..',
  '.ODMO..............OMDO.',
  '.ODDMO............OMDDO.',
  '.ODDMMO..........OMMDDO.',
  '.ODDMMMOOOOOOOOOOMMMDDO.',
  '.OMDMMMMMMMMMMMMMMMMDMO.',
  'OMMMMMMMMMMMMMMMMMMMMMMO',
  'OMMMMMMMMMMMMMMMMMMMMMMO',
  'OMMMDDDMMMMMMMMMMDDDMMMO',
  'OMMMMDEEMMMMMMMMEEDMMMMO',
  'OMMMMEPEMMMMMMMMEPEMMMMO',
  'OMMMMMEEMMMLLMMMEEMMMMMO',
  '.OMMMMMMMMLLLLMMMMMMMMO.',
  '.OMLLMMMMLLLLLLMMMMLLMO.',
  '..OLLLMMLLLNNLLLMMLLLO..',
  '..OLLLLLLLLNNLLLLLLLLO..',
  '...OLLLLLLLLLLLLLLLLO...',
  '...OLLLORRRRRRRROLLLO...',
  '....OLLOTRTRRTRTOLLO....',
  '.....OLLORRRRRROLLO.....',
  '......OOLLLLLLLLOO......',
  '........OOOOOOOO........',
];
const SCAR: [number, number][] = [[17, 7], [18, 8], [19, 9], [18, 10]];
// Sits between the ears, on the top of the head (rows 2 and 3).
const CROWN = [
  '........C.C..C.C........',
  '.......CCCCCCCCCC.......',
];
const CROWN_Y = 2;

type Coat = { M: string; D: string; L: string; E: string };
export const COATS: Record<PredatorKind, Coat> = {
  wolf: { M: '#8A8794', D: '#5E5B68', L: '#D9D6E0', E: '#FFE066' },
  fox: { M: '#D9772B', D: '#9E4F1B', L: '#FBEEDC', E: '#FFE066' },
  arctic: { M: '#E8EEF4', D: '#AFC1D3', L: '#FFFFFF', E: '#7FC8F0' },
  coyote: { M: '#B8946A', D: '#7E6243', L: '#EADBC4', E: '#FFD24A' },
  shadow: { M: '#3E3A4A', D: '#25222E', L: '#7E7890', E: '#FF5A4E' },
};
const FIXED: Record<string, string> = { O: '#2A2026', P: '#1B1418', N: '#2A2026', T: '#FFFFFF', R: '#9C2F3A', X: '#C9C3D6', C: '#BFE3F5' };

function rects(rows: string[], color: (c: string) => string | undefined, dy = 0) {
  const out: ReactElement[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    const fill = color(c);
    if (fill) out.push(<rect key={`${x},${y + dy}`} x={x} y={y + dy} width={1} height={1} fill={fill} />);
  }));
  return out;
}

/** A predator's portrait. `size` is the rendered width in CSS pixels. */
export function PredatorSprite({ kind, boss = false, size = 192 }: { kind: PredatorKind; boss?: boolean; size?: number }) {
  const coat = COATS[kind];
  const top = 0;
  const w = 24, h = PREDATOR.length;
  const color = (c: string) => (c in coat ? coat[c as keyof Coat] : FIXED[c]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" aria-hidden="true">
      {rects(PREDATOR, color, top)}
      {boss && rects(CROWN, (c) => FIXED[c], CROWN_Y)}
      {boss && SCAR.map(([x, y]) => <rect key={`s${x},${y}`} x={x} y={y + top} width={1} height={1} fill={FIXED.X} />)}
    </svg>
  );
}

/**
 * The sheep, seen from behind and a little to the side, the way a battle shows the player's own creature.
 * Legend: O outline, W wool, w wool shade, F face and ears, H hooves, B bell.
 */
const SHEEP_BACK = [
  '........OOOOOO........',
  '.......OFFFFFFO.......',
  '..OOOOOFFFFFFFFOOOOO..',
  '.OFFFFOFFFFFFFFOFFFFO.',
  '..OOOOWWWWWWWWWWOOOO..',
  '...OWWWWWWWWWWWWWWO...',
  '..OWWWWWWWWWWWWWWWWO..',
  '.OWWWWWWWWWWWWWWWWWWO.',
  'OWWWWWWWWWWWWWWWWWWWWO',
  'OWWWWWWWWWWWWWWWWWWWWO',
  'OwWWWWWWWWWWWWWWWWWWwO',
  'OwWWWWWWWWWWWWWWWWWWwO',
  'OwwWWWWWWWWWWWWWWWWwwO',
  '.OwwwWWWWWWWWWWWWwwwO.',
  '..OOwwwwwwwwwwwwwwOO..',
  '...OFFO.OFFOOFFO.OFFO.',
  '...OFFO.OFFOOFFO.OFFO.',
  '...OHHO.OHHOOHHO.OHHO.',
];
const SHEEP: Record<string, string> = { O: '#3B3028', W: '#FAF6EC', w: '#DDD3BE', F: '#3F3A3A', H: '#2A2626', B: '#E7B64A' };

export function SheepBackSprite({ size = 176, frozen = false }: { size?: number; frozen?: boolean }) {
  const w = 22, h = SHEEP_BACK.length;
  const ice = (c: string) => (frozen && c !== 'O' ? (c === 'F' || c === 'H' ? '#7FA9C9' : '#CFE3F5') : SHEEP[c]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" aria-hidden="true">
      {rects(SHEEP_BACK, ice)}
    </svg>
  );
}
