import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Pix } from '../../shop/art';
import type { Item } from '../../shop/catalog';
import { MISSIONS } from '../../shop/economy';
import { RARITY_COLOR, RARITY_LABEL } from '../../shop/rarity';
import { SACKS } from '../../shop/sacks';
import { useSampleOf } from '../../shop/sample';
import { LADDER } from '../../voxel/paint';
import { SKIN_OF } from '../bomb';
import { project } from '../camera';
import type { ShiftView } from '../camera';
import { PIXEL_ART, SKINS } from '../models.gen';

/**
 * The Trading Post's shared interface pieces, for every stop: the pack's pixel icons, the rarity square and word, the
 * Listen tile, and `At`, which lays anything over a projected scene point or box. The signs themselves (boards, awnings,
 * lanterns, meters) are signs.tsx; market.css makes `tp-tag`, `tp-btn`, `tp-note` and the rest out of its boards.
 */

const INK = '#2B2230';
function artColour(c: string): string {
  if (c === 'ink') return INK;
  if (c === 'lantern') return '#F2A93B';
  if (c === 'lanternHi') return '#FFD38F';
  const m = /^([a-zA-Z]+) ([+-]?\d)$/.exec(c);
  if (m && m[1] in LADDER) return LADDER[m[1] as keyof typeof LADDER][Number(m[2]) + 2];
  return c;
}
export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const a = PIXEL_ART[name];
  if (!a) return null;
  return <Pix rows={a.rows} colors={Object.fromEntries(Object.entries(a.colours).map(([k, v]) => [k, artColour(v)]))} size={size} className="tp-icon" />;
}
export const rarityOf = (i: Item): { word: string; colour: string } => i.rarity
  ? { word: RARITY_LABEL[i.rarity], colour: RARITY_COLOR[i.rarity] }
  : i.source === 'bells' ? { word: 'Bell Shelf', colour: '#C98A1E' } : i.source === 'mission' ? { word: 'Mission', colour: '#C8643C' } : { word: 'Starter', colour: '#8E8A84' };
export function Rarity({ item, tick }: { item: Item; tick?: boolean }) {
  const r = rarityOf(item);
  return <span className="tp-rarity"><i style={{ background: r.colour }} />{r.word}{tick && <Icon name="tick" size={14} />}</span>;
}
/** Where a not-found item comes from, from the catalogue's own fields. */
export const sourceLine = (i: Item): string => i.source === 'sack' ? `In the ${SACKS[i.kind].name}` : i.source === 'bells' ? `${i.price} Bells, Bell Shelf` : i.source === 'mission' ? `Mission: ${MISSIONS.find((m) => m.id === i.mission)?.label.replace(/^Count sheep (\d+) nights in a row$/, '$1 dream nights') ?? 'a mission'}` : 'Starter';
/** The one line under a bomb's name (T2), or the catalogue's blurb. */
export const lineOf = (i: Item): string => (i.kind === 'bomb' ? SKINS[SKIN_OF[i.id]]?.line : undefined) ?? i.blurb;
export function useCountTo(n: number): number {
  const [shown, set] = useState(n);
  const from = useRef(n);
  useEffect(() => {
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 400); const v = Math.round(a + (n - a) * k); set(v); from.current = v; if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return shown;
}

// ---------------------------------------------------------------- the camera and anchors

export const EASE = (() => {
  // cubic-bezier(.3, 0, .2, 1) (T1 section 2).
  const [x1, y1, x2, y2] = [0.3, 0, 0.2, 1];
  const b = (t: number, a: number, c: number) => 3 * a * t * (1 - t) ** 2 + 3 * c * t * t * (1 - t) + t ** 3;
  return (x: number) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (b(m, x1, x2) < x) lo = m; else hi = m; } return b((lo + hi) / 2, y1, y2); };
})();

export type Tick = (v: ShiftView) => void;
export const Anchors = createContext<{ add(t: Tick): () => void; view(): ShiftView } | null>(null);

/** Something laid over the scene at a projected point, or over a projected box (`box`: x0, y0, x1, y1, z). */
export function At({ p, box, className, style, children, as = 'div', ...rest }: { p?: [number, number, number]; box?: [number, number, number, number, number]; className?: string; style?: CSSProperties; children?: ReactNode; as?: 'div' | 'button'; [k: string]: unknown }) {
  const ctx = useContext(Anchors)!;
  const ref = useRef<HTMLElement>(null);
  const key = JSON.stringify(p ?? box);
  useLayoutEffect(() => {
    const put = (v: ShiftView) => {
      const el = ref.current;
      if (!el) return;
      if (box) {
        const [a, b] = project(v, box[0], box[3], box[4]), [c, d] = project(v, box[2], box[1], box[4]);
        el.style.transform = `translate(${a}px, ${b}px)`;
        el.style.width = `${c - a}px`; el.style.height = `${d - b}px`;
        el.style.setProperty('--fit', String((c - a) / 100));
      } else if (p) {
        const [x, y] = project(v, p[0], p[1], p[2]);
        el.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    put(ctx.view());
    return ctx.add(put);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const Tag = as as 'div';
  return <Tag ref={ref as React.RefObject<HTMLDivElement>} className={`tp-at ${className ?? ''}`} style={style} {...rest}>{children}</Tag>;
}

export function ListenTile({ item, onListen, small }: { item: Item; onListen: (i: Item) => void; small?: boolean }) {
  const on = useSampleOf(item.id);
  return <button type="button" className={`tp-listen ${small ? 'tp-listen--small' : ''}`} data-on={on || undefined} onClick={(e) => { e.stopPropagation(); onListen(item); }} aria-label={`Listen to ${item.name}`}><Icon name="speaker" size={small ? 12 : 16} />{!small && (on ? 'Playing' : 'Listen')}</button>;
}


/** The colour behind the scene while it loads: the sky at the horizon. Every other colour of the screen is a sign's tone (signs.tsx). */
export const TP_COLOURS = { '--horizon': '#E3A482' } as const;
