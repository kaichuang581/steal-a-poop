import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { pixelRects } from '../components/pixels';
import './surfaces.css';

/**
 * The surface recipes' drawn parts (docs/leaderboards/LEADERBOARDS-PLAN.md, sections 4 and 9), moved here unchanged from
 * the leaderboard so other screens can use them (the pen: docs/pen/PEN-PLAN.md). Each takes the class prefix of the
 * screen it is on: `lb` on the leaderboard (its markup did not change), `rc` everywhere else (surfaces.css answers to both).
 */
export type Prefix = 'lb' | 'rc';

/** A pixel grid, one character an art pixel, at `px` art pixels to the plan's pixel times `--u`, with crisp edges. */
export function Pix({ rows, colors, px = 2, className, style }: { rows: readonly string[]; colors: Record<string, string>; px?: number; className?: string; style?: CSSProperties }) {
  const w = rows[0]?.length ?? 0, h = rows.length;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false"
      style={{ width: `calc(${w * px} * var(--u))`, height: `calc(${h * px} * var(--u))`, flex: 'none', ...style }}>
      {pixelRects(rows, colors)}
    </svg>
  );
}

/** The padlock, in lantern (section 7.3). */
export const Padlock = ({ color = 'var(--hm-lantern)', px = 2 }: { color?: string; px?: number }) =>
  <Pix rows={['.XXXX.', '.X..X.', '.X..X.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXXXXX']} colors={{ X: color }} px={px} />;

/** A corner bracket of a board's inner frame, top left as drawn; the others are this one mirrored (section 4.3). */
export const Bracket = ({ className }: { className?: string }) =>
  <Pix className={className} px={3} rows={['AAAA', 'AB..', 'A...', 'A...']} colors={{ A: 'var(--hm-night-3)', B: 'var(--hm-frost)' }} />;

/** A board's inner frame with its four corner brackets (section 4.3). */
export function BoardFrame({ prefix = 'rc' }: { prefix?: Prefix }) {
  return (
    <i className={`${prefix}-frame`} aria-hidden="true">
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => <Bracket key={k} className={`${prefix}-bracket ${prefix}-bracket--${k}`} />)}
    </i>
  );
}

/**
 * Snow on an edge (section 9.1): white on its top row, wool under it with a few speckles of frost, a stepped edge with a
 * row of frost under it; on a board, icicles too. One piece an edge, never two. Drawn by the stylesheet.
 */
export function SnowCap({ icicles = false, prefix = 'rc' }: { icicles?: boolean; prefix?: Prefix }) {
  return <i className={`${prefix}-snowcap ${icicles ? `${prefix}-snowcap--icicles` : ''}`} aria-hidden="true" />;
}

const BULBS = ['#F07A5A', '#9CCB78', '#FFD08A'];
/** `hex` mixed toward the ink by `k` (0 to 1): a bulb's darker side, and a bulb that is off. */
function toInk(hex: string, k: number): string {
  const a = parseInt(hex.slice(1), 16), ink = [0x0e, 0x15, 0x28];
  const ch = [(a >> 16) & 255, (a >> 8) & 255, a & 255].map((v, i) => Math.round(v + (ink[i] - v) * k));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const BULB_ART = ['.cc.', '.BB.', 'BhBB', 'BhBB', 'BBBs', 'BBss', '.ss.'];
/** Today's twinkle, bulb by bulb (skin.css, `.sk-garland-wire i`): each on its own time, so the string never pulses. */
const TWINKLE = [[2, 0], [2.9, -0.7], [1.7, -1.9], [3.4, -0.3], [2.3, -2.4]] as const;
const sag = (x: number, L: number) => Math.round((8 * (1 - (2 * x / L - 1) ** 2)) / 2) * 2;

/**
 * The season's lights (section 9.2): hooks every 120 under a bar's bottom edge, a wire two thick hanging between them
 * in two-pixel steps, a bulb every 30, red, green and gold in turn. A bulb that is off is its own colour darkened toward
 * the ink, never a glow. Drawn in the plan's pixels (times `u`) across the element's whole width.
 */
export function Lights({ u, reduced, prefix = 'rc' }: { u: number; reduced: boolean; prefix?: Prefix }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(el.getBoundingClientRect().width / u);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [u]);
  const n = Math.max(1, Math.round(w / 120)), L = w / n;
  const hooks: ReactNode[] = [], wire: ReactNode[] = [], bulbs: ReactNode[] = [];
  if (w > 0) {
    for (let k = 0; k <= n; k++) {
      const x = Math.min(w - 6, Math.max(0, k * L - 3));
      hooks.push(<g key={k}><rect x={x} y={0} width={6} height={6} fill="var(--hm-night-3)" /><rect x={x} y={0} width={6} height={3} fill="var(--hm-frost)" /></g>);
    }
    for (let k = 0; k < n; k++) {
      // The wire, as runs of two-pixel steps at one drop.
      for (let x = 0; x < L; ) {
        const d = sag(x, L);
        let e = x + 2;
        while (e < L && sag(e, L) === d) e += 2;
        wire.push(<rect key={`${k}:${x}`} x={k * L + x} y={4 + d} width={Math.min(e, L) - x} height={2} fill="var(--hm-ink)" />);
        x = e;
      }
      for (let j = 0; j < 4; j++) {
        const i = k * 4 + j, x = ((2 * j + 1) * L) / 8, B = BULBS[i % 3], [dur, delay] = TWINKLE[i % 5];
        const on = { B, h: 'rgba(255,255,255,0.55)', s: toInk(B, 0.3), c: 'var(--hm-night-3)' };
        const off = { B: toInk(B, 0.45), h: toInk(B, 0.45), s: toInk(toInk(B, 0.3), 0.45), c: 'var(--hm-night-3)' };
        const at = `translate(${Math.round(k * L + x - 4)} ${4 + sag(x, L) + 2}) scale(2)`;
        bulbs.push(
          <g key={i} transform={at}>
            <g>{pixel(BULB_ART, off)}</g>
            <g className={`${prefix}-bulb-on`} style={reduced ? undefined : { animationDuration: `${dur}s`, animationDelay: `${delay}s`, animationDirection: k % 2 ? 'reverse' : 'normal' }}>{pixel(BULB_ART, on)}</g>
          </g>,
        );
      }
    }
  }
  return (
    <div className={`${prefix}-lights`} ref={ref} aria-hidden="true">
      {w > 0 && (
        <svg viewBox={`0 0 ${w} 32`} preserveAspectRatio="none" shapeRendering="crispEdges">
          {wire}{hooks}{bulbs}
        </svg>
      )}
    </div>
  );
}
/** A pixel grid as rects, for drawing inside another SVG (Pix draws a whole one). */
function pixel(rows: readonly string[], colors: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) out.push(<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={colors[ch]} />); }));
  return out;
}

/**
 * A list that scrolls inside itself with the leaderboard's scroll bar (section 4: a sunk track, a thumb with a lit and a
 * shaded row): dragging the thumb scrolls, a press on the track pages. The native bar is hidden. `inner` is the
 * scrolling element (for a log that keeps to its newest line).
 */
export function ScrollBox({ className = '', inner, reduced, children, ...rest }: { className?: string; inner?: RefObject<HTMLDivElement | null>; reduced: boolean; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const own = useRef<HTMLDivElement>(null);
  const list = inner ?? own;
  const thumb = useRef<HTMLElement>(null);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const sync = () => {
      const o = el.scrollHeight > el.clientHeight + 1;
      setOver(o);
      if (o && thumb.current) {
        const track = el.clientHeight, h = Math.max(24, (track * el.clientHeight) / el.scrollHeight);
        thumb.current.style.height = `${h}px`;
        thumb.current.style.transform = `translateY(${((track - h) * el.scrollTop) / Math.max(1, el.scrollHeight - el.clientHeight)}px)`;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const k of el.children) ro.observe(k);
    const mo = new MutationObserver(() => { for (const k of el.children) ro.observe(k); sync(); });
    mo.observe(el, { childList: true });
    el.addEventListener('scroll', sync, { passive: true });
    return () => { ro.disconnect(); mo.disconnect(); el.removeEventListener('scroll', sync); };
  }, [list, over]);
  const drag = (e: ReactPointerEvent<HTMLElement>) => {
    const el = list.current;
    if (!el) return;
    e.preventDefault();
    const y0 = e.clientY, s0 = el.scrollTop, k = el.scrollHeight / el.clientHeight;
    const move = (m: PointerEvent) => { el.scrollTop = s0 + (m.clientY - y0) * k; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const page = (e: ReactPointerEvent<HTMLElement>) => {
    const el = list.current;
    if (!el || e.target !== e.currentTarget) return;
    const t = thumb.current?.getBoundingClientRect();
    el.scrollBy({ top: (t && e.clientY < t.top ? -1 : 1) * el.clientHeight * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  };
  return (
    <div className={`rc-scrollbox ${className}`} data-over={over || undefined}>
      <div ref={list} className="rc-scrollbox-in" {...rest}>{children}</div>
      {over && <div className="rc-scroll rc-well" onPointerDown={page} aria-hidden="true"><i ref={thumb} className="rc-thumb" onPointerDown={drag} /></div>}
    </div>
  );
}
