import { useSyncExternalStore } from 'react';
import { ADMIN4_AVATAR_ID, baseAvatarId } from '../../avatars/ids';
import { DISC } from './discPose';
import { EYES, JAW, RED } from './faceTweaks';
import { AGE, ORANGE } from './orange';

/**
 * How long a tall photo's forehead is (Kaiyan's, and the third admin avatar's, each its own) and how hard it shines (Brian, 2026-11-09: "make kaiyans head adjustable in both length
 * and glare, make it extend even further and get even brighter"). Set with two sliders in the admin panel and kept on
 * this device. Both are multiples of the look as it was on 2026-11-08 (1 = that look); the defaults go past it.
 *
 * The picture (kaiyan-forehead.png, 512 x 1339) is three slices: the hair (rows 0..192), the stretched forehead band
 * (192..1041) and the face (1041..1339). Only the band grows or shrinks; the hair and face stay their own size.
 */
/** `orange` (Juan's slider) is left out while it is 0, so a look with none still reads as just length and glare. */
export interface KaiyanLook { length: number; glare: number; orange?: number; age?: number; red?: number; eyes?: number; jaw?: number }

export const LENGTH = { min: 0.1, max: 6, step: 0.1, def: 1.8 } as const;
export const GLARE = { min: 0, max: 6, step: 0.1, def: 2 } as const;
export const DEFAULT_LOOK: KaiyanLook = { length: LENGTH.def, glare: GLARE.def };

/** The fourth avatar's sliders go to 12x, and open there (Brian, 2026-11-21: "make the forehead 12x and glare 12x"). */
const LENGTH12 = { ...LENGTH, max: 12, def: 12 } as const;
const GLARE12 = { ...GLARE, max: 12, def: 12 } as const;
export type Range = { min: number; max: number; step: number; def: number };
/** The forehead and glare ranges of an avatar. */
export function rangesFor(id?: string | null): { length: Range; glare: Range } {
  return baseAvatarId(id) === ADMIN4_AVATAR_ID ? { length: LENGTH12, glare: GLARE12 } : { length: LENGTH, glare: GLARE };
}
/** The look an avatar has until its sliders are moved. */
export const defaultLookFor = (id?: string | null): KaiyanLook => { const r = rangesFor(id); return { length: r.length.def, glare: r.glare.def }; };

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

/** Each tall photo keeps its own look on this device. Kaiyan's key is the one it has always had. */
const KEYS: Record<string, string> = { kaiyan: 'sap:kaiyan-look', admin2: 'sap:admin2-look', admin3: 'sap:admin3-look', admin4: 'sap:admin4-look', admin5: 'sap:admin5-look', admin6: 'sap:admin6-look' };
const keyFor = (id?: string | null): string => {
  const base = baseAvatarId(id);
  return base && Object.hasOwn(KEYS, base) ? KEYS[base] : KEYS.kaiyan;
};
const subs = new Set<() => void>();
const clamp = (v: unknown, r: { min: number; max: number; def: number }) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.def;

const caches = new Map<string, { raw: string | null; look: KaiyanLook }>();
/** Bumped by every change, so a screen that only needs to look again (the name plates) can hear it. */
let version = 0;
export function getKaiyanLook(id?: string | null): KaiyanLook {
  const key = keyFor(id);
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* storage blocked */ }
  const cache = caches.get(key);
  if (cache && cache.raw === raw) return cache.look;
  const r = rangesFor(id);
  let look = defaultLookFor(id);
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<KaiyanLook>;
      const orange = clamp(v?.orange, ORANGE), age = clamp(v?.age, AGE), red = clamp(v?.red, RED), eyes = clamp(v?.eyes, EYES), jaw = clamp(v?.jaw, JAW);
      look = { length: clamp(v?.length, r.length), glare: clamp(v?.glare, r.glare), ...(orange > 0 ? { orange } : {}), ...(age > 0 ? { age } : {}), ...(red > 0 ? { red } : {}), ...(eyes !== 0 ? { eyes } : {}), ...(jaw !== 0 ? { jaw } : {}) };
    } catch { /* a broken value: the defaults */ }
  }
  caches.set(key, { raw, look });
  return look;
}

export function setKaiyanLook(next: Partial<KaiyanLook> | null, id?: string | null): void {
  const key = keyFor(id);
  try {
    if (next === null) localStorage.removeItem(key);
    else {
      const cur = getKaiyanLook(id);
      const r = rangesFor(id);
      const orange = clamp(next.orange ?? cur.orange ?? 0, ORANGE), age = clamp(next.age ?? cur.age ?? 0, AGE);
      const red = clamp(next.red ?? cur.red ?? 0, RED), eyes = clamp(next.eyes ?? cur.eyes ?? 0, EYES), jaw = clamp(next.jaw ?? cur.jaw ?? 0, JAW);
      localStorage.setItem(key, JSON.stringify({ length: clamp(next.length ?? cur.length, r.length), glare: clamp(next.glare ?? cur.glare, r.glare), ...(orange > 0 ? { orange } : {}), ...(age > 0 ? { age } : {}), ...(red > 0 ? { red } : {}), ...(eyes !== 0 ? { eyes } : {}), ...(jaw !== 0 ? { jaw } : {}) }));
    }
  } catch { /* storage blocked */ }
  caches.delete(key);
  version++;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/**
 * What the hook hands React: the look as last read, with no trip to storage. React asks for it on every render of the
 * table, the ice and the dream, which was two storage reads a frame (plan file 17, change 11). It is read again when
 * the sliders move it (setKaiyanLook drops the cache); `getKaiyanLook` itself still asks storage every time.
 */
export function useKaiyanLook(id?: string | null): KaiyanLook {
  const key = keyFor(id);
  return useSyncExternalStore(subscribe, () => caches.get(key)?.look ?? getKaiyanLook(id), () => DEFAULT_LOOK);
}

/** A number that changes whenever any avatar's look does: for the screens that only need to place a name plate again. */
export function useLooksVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
