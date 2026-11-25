import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { Pix } from '../kit/surfaces';
import { meterSegments, pixelDisc, tileFit, TRAY } from './frame';
import type { Box, DreamFrame } from './frame';
import { ART_GRIDS } from './pixelArt';
import type { ArtName } from './pixelArt';

/**
 * Counting Sheep's interface (docs/dream/v3/08-interface.md): the tray of letter tiles, the hint strip, the top bar
 * inside the dream window (the chip, the counter with its best tab, the close button), the announcement cards, the
 * ready board, and over the farmer the bubble's tail, his snores and his marks. All of it is the game's navy kit
 * (slabs, boards, wells, ink cards) with this mode's one trim, the quilt band. Sizes are the plan's px times `--u`; a
 * phone's are its own.
 */

const ART_COLORS: Partial<Record<ArtName, Record<string, string>>> = {
  bang: { X: 'var(--hm-lantern-hi)' }, question: { X: 'var(--hm-lantern-hi)' }, 'bump-star': { X: 'var(--hm-lantern-hi)' }, candle: { X: 'var(--hm-lantern-hi)' },
  'moon-small': { X: 'var(--hm-lantern-hi)' }, 'moon-full': { X: 'var(--hm-lantern-hi)', o: 'var(--hm-lantern)' },
  'return-key': { X: 'var(--hm-ink)' }, check: { X: 'var(--hm-ink)' }, 'star-plus': { X: 'var(--hm-frost)' }, 'arrow-right': { X: 'var(--hm-frost)' },
  island: { X: 'var(--hm-wool)' }, 'yarn-ball': { X: '#BF6055', '-': '#AC473D' }, 'sheep-shadow': { X: 'var(--hm-ink)' },
  'sheep-head': { X: 'var(--hm-wool)', p: '#E8B1AC', o: 'var(--hm-ink)' }, 'sheep-side': { X: 'var(--hm-wool)' }, fence: { X: 'var(--hm-lantern)' }, cross: { X: 'var(--hm-wool)' },
};
/** One of the pack's pixel grids, at `px` of the plan's pixels an art pixel (its own size when not given). */
export function Art({ name, px, color, className, style }: { name: ArtName; px?: number; color?: string; className?: string; style?: CSSProperties }) {
  const a = ART_GRIDS[name];
  return <Pix rows={a.rows} colors={color ? { X: color } : ART_COLORS[name] ?? { X: 'var(--hm-wool-hi)' }} px={px ?? a.px} className={className} style={style} />;
}

/**
 * This mode's trim (v3/08, section 11): whole squares along a board's top edge, inside its outline, in the quilt's order
 * (red, cream, mustard, cream, green, cream, mauve, cream). As many as the board's width over 26, rounded, each an equal
 * share of the width, so the band begins and ends on a square's edge.
 */
const QUILT = ['#BF6055', '#E4D7C4', '#DCB87A', '#E4D7C4', '#478A6B', '#E4D7C4', '#856D75', '#E4D7C4'] as const;
export const quiltSquares = (width: number): number => Math.max(1, Math.round(width / 26));
export function QuiltBand({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [n, setN] = useState(12);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setN(quiltSquares(el.clientWidth));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <i ref={ref} className={`dr-quilt-bar ${className}`} aria-hidden="true">{Array.from({ length: n }, (_, i) => <b key={i} style={{ '--q': QUILT[i % QUILT.length] } as CSSProperties} />)}</i>;
}

/** A round wool puff drawn in 2 px steps, its shade of wool's lip 4 px under it (v3/08, section 2). */
export function Puff({ d, i, className, style }: { d: number; i?: number; className?: string; style?: CSSProperties }) {
  return <i className={`dr-puff ${className ?? ''}`} data-i={i} style={{ width: d, height: d, ...style }}><b style={{ clipPath: pixelDisc(d) }} /></i>;
}

// ---------- the tray ----------

/**
 * What the tray shows for a sign and what has been typed. The sign's letters are already in place, so the caret
 * stands after them: letters typed that are those letters fall into their tiles, and anything else is the rest of the
 * word. A player may type the whole word or only what follows the sign; `word` is the word either way.
 */
export function trayWord(sign: readonly string[], typed: string): { rest: string; word: string } {
  const s = sign.join('').toLowerCase(), t = typed.toLowerCase();
  if (!s || t.startsWith(s)) return { rest: t.slice(s.length), word: t };
  if (s.startsWith(t)) return { rest: '', word: t };
  return { rest: t, word: s + t };
}

/**
 * The one message of a moment (v3/08, section 6), in its rank: a refusal, else a hint, else nothing in the strip over
 * the tray; and "Type ahead…" in the meter's row only when no fence is coming and the strip is empty.
 */
export function trayMessage(refusal: string, hint: boolean, fenceComing: boolean): { strip: 'no' | 'hint' | null; typeAhead: boolean } {
  const strip = refusal ? 'no' : hint ? 'hint' : null;
  return { strip, typeAhead: !strip && !fenceComing };
}

interface TrayProps {
  frame: DreamFrame;
  /** The sign's letters when a fence is coming; none while typing ahead. */
  sign: readonly string[];
  typed: string;
  wrong: boolean;
  /** How much of the meter is left, 0 to 1; null with no fence coming. */
  left: number | null;
  /** "Type ahead…" under the tiles: only when nothing shows in the strip over the tray. */
  typeAhead: boolean;
  /** The night has ended: the tray drops away. */
  over: boolean;
  canJump: boolean;
  onJump: () => void;
  /** The hidden field the keys go to (it brings a phone's keyboard up). */
  children?: ReactNode;
}

/**
 * The tray: a small board with the quilt band along its top. The sign's letters stand in it as lantern tiles, yours
 * arrive as wool tiles, the next place has the orange ring and a caret, and the meter under them runs down as the
 * fence nears the sheep.
 */
export function Tray({ frame, sign, typed, wrong, left, typeAhead, over, canJump, onJump, children }: TrayProps) {
  const { phone, u } = frame, T = phone ? TRAY.phone : TRAY.computer;
  const { rest } = trayWord(sign, typed);
  // At rest there are always three places after the sign's letters: the next one and two more.
  const places = 1 + Math.max(0, 2 - rest.length), slots = sign.length + rest.length + places;
  const { size, fit } = tileFit(slots, frame.tiles, phone, u);
  // Too long even at the smallest size: the typed tiles slide left under a "more" tile after the sign's letters.
  const hidden = slots > fit ? slots - fit + 1 : 0, shown = rest.slice(hidden);
  const n = meterSegments(frame.tiles, phone, u), lit = left === null ? 0 : Math.ceil(left * n - 1e-6);
  const box: Box = frame.tray;
  return (
    <div className="dr-tray rc-board" data-over={over || undefined} data-wrong={wrong || undefined}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, '--t': `calc(${size} * var(--u))`, '--d': `calc(${size >= 36 ? T.side : T.side - 1} * var(--u))` } as CSSProperties}>
      <QuiltBand />
      <div className="dr-tray-row">
        <div className="dr-tray-tiles" aria-hidden="true">
          {sign.map((ch, i) => <span key={`s${i}`} className="dr-tile dr-tile--lantern">{ch.toUpperCase()}</span>)}
          {hidden > 0 && <span className="dr-slot dr-more"><i /><i /><i /></span>}
          {[...shown].map((ch, i) => <span key={`t${hidden + i}`} className="dr-tile dr-tile--typed">{ch.toUpperCase()}</span>)}
          <span className="dr-slot dr-slot--next"><b className="dr-caret" /></span>
          {Array.from({ length: places - 1 }, (_, i) => <span key={`e${i}`} className="dr-slot" />)}
        </div>
        <button type="button" className="dr-jump hm-slab hm-knit hm-slab--lantern" title="Enter" aria-label="Jump" disabled={!canJump}
          onMouseDown={(e) => e.preventDefault()} onClick={onJump}>
          <Art name="return-key" /><span>Jump</span>
        </button>
      </div>
      <div className="dr-meter" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => <i key={i} data-on={i < lit || undefined} data-low={lit <= 3 || undefined} />)}
        {typeAhead && <span>Type ahead…</span>}
      </div>
      {children}
    </div>
  );
}

// ---------- the hint and the messages ----------

/** One ink strip: a hint with the candle and a lantern bar, or a refusal with an ember bar. */
export function Hint({ kind, style, children }: { kind: 'hint' | 'no'; style?: CSSProperties; children: ReactNode }) {
  return (
    <p className="dr-hint dr-inkcard" data-kind={kind} style={style} role={kind === 'no' ? 'alert' : undefined}>
      {kind === 'hint' && <Art name="candle" />}
      <span>{children}</span>
    </p>
  );
}

// ---------- the top bar ----------

/** Top left: which dream this is (v3/08, section 3). */
export function ModeChip({ children }: { children: ReactNode }) {
  return <span className="dr-chip"><Art name="moon-small" /><span>{children}</span></span>;
}

/**
 * The best tab under the counter (v3/01, section 4): hidden while the best is 0, "Best 32" otherwise, and "New best"
 * from the first count above a best over 0, for the rest of the night.
 */
export function bestTab(count: number, best: number): { text: string; beaten: boolean } | null {
  if (best <= 0) return null;
  return count > best ? { text: 'New best', beaten: true } : { text: `Best ${best}`, beaten: false };
}

/**
 * Top right (v3/08, section 3): the counter (the sheep's head, the count) with the best tab hung under it, and the quiet
 * close button. Nothing in the middle.
 */
export function Counter({ count, best, phone, onClose }: { count: number; best: number; phone: boolean; onClose: () => void }) {
  const tab = bestTab(count, best);
  return (
    <div className="dr-corner">
      <div className="dr-counter-at">
        <div className="dr-counter hm-slab hm-slab--night" aria-live="polite" aria-label={`${count} sheep counted`}>
          <Art name="sheep-head" px={phone ? 2 : 3} />
          <b key={count} className="dr-counter-n">{count}</b>
        </div>
        {tab && <span className="dr-best" data-beaten={tab.beaten || undefined}>{tab.text}</span>}
      </div>
      <button type="button" className="dr-close hm-slab hm-slab--night" onClick={onClose} aria-label="Leave the dream" title="Leave the dream (Esc)"><Art name="cross" /></button>
    </div>
  );
}

// ---------- cards ----------

export type CardKind = 'stage2' | 'stage3' | 'lift' | 'quilt' | 'turn' | 'bump' | 'deep' | 'slept';
const CARDS: Record<CardKind, { tone: 'lantern' | 'ember'; art: ArtName; px: number; title: string; sub: string }> = {
  stage2: { tone: 'lantern', art: 'island', px: 2, title: 'Dreaming…', sub: 'Two letters now' },
  stage3: { tone: 'lantern', art: 'yarn-ball', px: 2, title: 'Deep dream', sub: 'Three letters now' },
  // After the first lap (v3/07, section 3.4): the letters no longer change at a gate, so the card says where he is.
  lift: { tone: 'lantern', art: 'island', px: 2, title: 'Dreaming…', sub: 'The farm lifts off' },
  quilt: { tone: 'lantern', art: 'yarn-ball', px: 2, title: 'Deep dream', sub: 'Under the quilt' },
  turn: { tone: 'lantern', art: 'z', px: 4, title: 'He turns over', sub: 'Back to the farm' },
  bump: { tone: 'ember', art: 'bump-star', px: 2, title: 'Bump!', sub: 'The farmer stirs…' },
  deep: { tone: 'lantern', art: 'z', px: 4, title: 'Zzz…', sub: 'He’s out cold. Keep counting!' },
  slept: { tone: 'lantern', art: 'z', px: 4, title: 'Zzz…', sub: 'He slept right through it' },
};
/** One announcement: an ink card with a bar, an icon in a 24 box, a title and a second line. */
export function DreamCard({ kind }: { kind: CardKind }) {
  const c = CARDS[kind];
  return (
    <div className="dr-card dr-inkcard" data-tone={c.tone} role="status">
      <span className="dr-card-icon"><Art name={c.art} px={c.px} /></span>
      <span className="dr-card-text"><b>{c.title}</b><span>{c.sub}</span></span>
    </div>
  );
}

// ---------- the ready board ----------

/** Before the first key (v3/08, section 10): what to do, in three pictures, over the sky so the track shows under it. */
export function ReadyBoard({ practice, touch }: { practice: boolean; touch: boolean }) {
  return (
    <div className="dr-ready dr-inkcard">
      <QuiltBand />
      <h2>{practice ? 'How far can you run?' : 'Count sheep to keep the farmer asleep'}</h2>
      <div className="dr-ready-steps">
        <figure>
          <div className="dr-ready-pic rc-well"><span className="dr-ready-sign"><span className="dr-tile dr-tile--lantern">S</span><i /><i /><i /></span></div>
          <figcaption>Read the sign</figcaption>
        </figure>
        <Art name="arrow-right" className="dr-ready-arrow" />
        <figure>
          <div className="dr-ready-pic rc-well"><span className="dr-ready-word">{[...'SHEEP'].map((ch, i) => <span key={i} className={`dr-tile ${i ? '' : 'dr-tile--lantern'}`}>{ch}</span>)}</span></div>
          <figcaption>Type a word that starts with it</figcaption>
        </figure>
        <Art name="arrow-right" className="dr-ready-arrow" />
        <figure>
          <div className="dr-ready-pic rc-well"><span className="dr-ready-leap"><Art name="sheep-side" /><Art name="fence" /></span></div>
          <figcaption>Press Enter to jump</figcaption>
        </figure>
      </div>
      <p className="dr-ready-foot">{touch ? 'Tap to start' : 'Press any key to start'}</p>
    </div>
  );
}

// ---------- over the farmer: the bubble's tail, his snores, his marks ----------

/**
 * Over the farmer (v3/08, sections 2 and 7): the tail's three wool puffs; his three snores to the right of his head,
 * their top left corners 56, 74 and 98 px right of the tip of his cap (the first level with it, the second 20 above,
 * the third 46 above), shown in turn small to large over 1.8 s, then a 0.6 s rest, a size larger in his deep sleep; and
 * the "?" of a wrong word or the "!" of a bump, 18 px above his cap.
 */
export function Tail({ puffs, cap, deep, mark, asleep, u }: { puffs: readonly Box[]; cap: readonly [number, number]; deep: boolean; mark: 'bang' | 'question' | null; asleep: boolean; u: number }) {
  const at = [[56, 0], [74, -20], [98, -46]] as const, base = deep ? 3 : 2;
  return (
    <div className="dr-tail" aria-hidden="true">
      {puffs.map((p, i) => <Puff key={i} i={i} d={p.w} className="dr-tail-puff" style={{ left: p.x, top: p.y, '--i': i } as CSSProperties} />)}
      {asleep && !mark && at.map(([dx, dy], i) => (
        <span key={`${deep}:${i}`} className="dr-z dr-outlined" data-i={i} style={{ left: Math.round(cap[0] + dx * u), top: Math.round(cap[1] + dy * u) }}>
          <Art name="z" px={base + i} />
        </span>
      ))}
      {mark && <span key={mark} className="dr-mark dr-outlined" style={{ left: Math.round(cap[0]), top: Math.round(cap[1] - 18 * u) }}><Art name={mark} px={4} /></span>}
    </div>
  );
}

/** The hidden field's ref, typed for the tray's callers. */
export type GhostRef = RefObject<HTMLInputElement | null>;
