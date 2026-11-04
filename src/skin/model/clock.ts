import type { Hour, Season } from './types';

export function hourFor(date = new Date()): Hour {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export function seasonFor(date = new Date(), northern = true): Season {
  const m = date.getMonth(); // 0..11
  const n: Season = m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
  if (northern) return n;
  return ({ winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' } as const)[n];
}
