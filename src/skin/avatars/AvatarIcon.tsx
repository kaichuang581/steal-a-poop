import { byId } from './catalog';
import type { Animal, Worn } from './catalog';

/** 12x12 pixel portrait. Drawn from rects so it stays crisp at any size. */
const EARS: Record<Animal, [number, number][]> = {
  sheep: [[1, 4], [10, 4]],
  pig: [[2, 2], [9, 2]],
  cow: [[1, 3], [10, 3]],
  goat: [[3, 0], [8, 0]],
  horse: [[3, 0], [8, 0]],
};

function wornRects(w: Worn, col: string): [number, number, number, number, string][] {
  switch (w) {
    case 'scarf': return [[2, 9, 8, 2, col]];
    case 'collar': return [[2, 9, 8, 1, col]];
    case 'strawHat': return [[1, 2, 10, 1, col], [3, 1, 6, 1, col]];
    case 'flowerCrown': return [[3, 1, 1, 1, col], [5, 1, 1, 1, '#f08fb0'], [7, 1, 1, 1, col], [9, 1, 1, 1, '#f08fb0']];
    case 'cap': return [[3, 1, 6, 1, col], [8, 2, 3, 1, col]];
    case 'nightCap': return [[3, 1, 6, 1, col], [8, 0, 2, 1, col]];
    case 'sunHat': return [[1, 2, 10, 1, col], [3, 1, 6, 1, col]];
    case 'chefHat': return [[3, 0, 6, 2, col]];
    case 'topHat': return [[3, 0, 6, 2, col], [2, 2, 8, 1, col]];
    case 'helmet': return [[3, 1, 6, 2, col]];
    case 'goggles': return [[3, 4, 2, 1, col], [7, 4, 2, 1, col], [5, 4, 2, 1, '#555']];
    case 'hood': return [[2, 1, 8, 1, col], [2, 2, 1, 5, col], [9, 2, 1, 5, col]];
    case 'stripe': return [[5, 1, 2, 5, col]];
    case 'bow': return [[8, 1, 3, 2, col]];
    default: return [];
  }
}

export function AvatarIcon({ id, size = 30, label }: { id: string; size?: number; label?: string }) {
  const c = byId(id);
  if (!c) return null;
  const k = c.colors;
  const R = (x: number, y: number, w: number, h: number, fill: string, key: string) => <rect key={key} x={x} y={y} width={w} height={h} fill={fill} />;
  const parts = [
    ...EARS[c.animal].map(([x, y], i) => R(x, y, 1, c.animal === 'pig' ? 2 : 3, k.shade, `e${i}`)),
    R(2, 2, 8, 8, k.body, 'head'),
    R(2, 9, 8, 1, k.shade, 'chin'),
    R(3, 5, 1, 1, k.accent, 'eyeL'), R(8, 5, 1, 1, k.accent, 'eyeR'),
    R(4, 7, 4, 2, k.nose, 'snout'),
    R(5, 8, 1, 1, k.accent, 'nL'), R(6, 8, 1, 1, k.accent, 'nR'),
  ];
  if (c.animal === 'goat') parts.push(R(5, 10, 2, 1, k.mane, 'beard'));
  if (c.animal === 'horse') parts.push(R(2, 2, 1, 5, k.mane, 'mane'));
  if (c.animal === 'cow') parts.push(R(2, 3, 2, 2, k.shade, 'spot'));
  wornRects(c.worn, c.wornColor).forEach(([x, y, w, h, f], i) => parts.push(R(x, y, w, h, f, `w${i}`)));
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" role="img" aria-label={label ?? `${c.name} the ${c.animal}`}>
      {parts}
    </svg>
  );
}
