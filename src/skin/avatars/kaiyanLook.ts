import { useSyncExternalStore } from 'react';
import { DISC } from './discPose';

/**
 * How long Kaiyan's forehead is and how hard it shines (Brian, 2026-11-09: "make kaiyans head adjustable in both length
 * and glare, make it extend even further and get even brighter"). Set with two sliders in the admin panel and kept on
 * this device. Both are multiples of the look as it was on 2026-11-08 (1 = that look); the defaults go past it.
 *
 * The picture (kaiyan-forehead.png, 512 x 1339) is three slices: the hair (rows 0..192), the stretched forehead band
 * (192..1041) and the face (1041..1339). Only the band grows or shrinks; the hair and face stay their own size.
 */
export interface KaiyanLook { length: number; glare: number }

export const LENGTH = { min: 0.1, max: 6, step: 0.1, def: 1.8 } as const;
export const GLARE = { min: 0, max: 6, step: 0.1, def: 2 } as const;
export const DEFAULT_LOOK: KaiyanLook = { length: LENGTH.def, glare: GLARE.def };

/** The picture's slices, as fractions of its height from the top. */
export const SLICE = { bandTop: 192 / 1339, bandBottom: 1041 / 1339 } as const;
const W = DISC.radius * 2;
const H1 = W * DISC.tall; // the picture's height at length 1
/** Each slice's height in metres at a given length. */
export function sliceHeights(length: number) {
  return { hair: H1 * SLICE.bandTop, band: H1 * (SLICE.bandBottom - SLICE.bandTop) * length, face: H1 * (1 - SLICE.bandBottom) };
}
/** The whole picture's height in metres. */
export function pictureHeight(length: number): number {
  const s = sliceHeights(length);
  return s.hair + s.band + s.face;
}

const KEY = 'sap:kaiyan-look';
const subs = new Set<() => void>();
const clamp = (v: unknown, r: { min: number; max: number; def: number }) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.def;

let cache: { raw: string | null; look: KaiyanLook } | null = null;
export function getKaiyanLook(): KaiyanLook {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (cache && cache.raw === raw) return cache.look;
  let look = DEFAULT_LOOK;
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<KaiyanLook>;
      look = { length: clamp(v?.length, LENGTH), glare: clamp(v?.glare, GLARE) };
    } catch { /* a broken value: the defaults */ }
  }
  cache = { raw, look };
  return look;
}

export function setKaiyanLook(next: Partial<KaiyanLook> | null): void {
  try {
    if (next === null) localStorage.removeItem(KEY);
    else {
      const cur = getKaiyanLook();
      localStorage.setItem(KEY, JSON.stringify({ length: clamp(next.length ?? cur.length, LENGTH), glare: clamp(next.glare ?? cur.glare, GLARE) }));
    }
  } catch { /* storage blocked */ }
  cache = null;
  subs.forEach((f) => f());
}

export function useKaiyanLook(): KaiyanLook {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getKaiyanLook, () => DEFAULT_LOOK);
}
