import type { CSSProperties, ReactNode, RefObject } from 'react';
import { SheepHead } from '../avatars/AvatarIcon';
import { CloseIcon } from '../components/Icons';
import { IconSlab } from '../kit/modern';
import { Pix } from '../kit/surfaces';
import { meterSegments, tileFit, TRAY } from './frame';
import type { Box, DreamFrame } from './frame';
import { ART_GRIDS } from './pixelArt';
import type { ArtName } from './pixelArt';

/**
 * Counting Sheep's interface (docs/dream/02-layout-and-interface.md): the tray of letter tiles, the hint strip, the
 * counters inside the top of the dream window, the announcement cards and the ready board. All of it is the game's
 * navy kit (slabs, boards, wells, ink cards) with this mode's one trim, the quilt band. Sizes are the plan's px times
 * `--u`; a phone's are its own.
 */

const ART_COLOR: Partial<Record<ArtName, string>> = {
  bang: 'var(--hm-lantern-hi)', question: 'var(--hm-lantern-hi)', 'bump-star': 'var(--hm-lantern-hi)', candle: 'var(--hm-lantern-hi)', 'moon-small': 'var(--hm-lantern-hi)',
  'return-key': 'var(--hm-ink)', 'star-plus': 'var(--hm-frost)', 'arrow-right': 'var(--hm-frost)', island: 'var(--hm-wool)', 'yarn-ball': '#C44A3A', 'sheep-shadow': 'var(--hm-ink)',
};
/** One of the pack's pixel grids, at `px` of the plan's pixels an art pixel (its own size when not given). */
export function Art({ name, px, color, className, style }: { name: ArtName; px?: number; color?: string; className?: string; style?: CSSProperties }) {
  const a = ART_GRIDS[name];
  return <Pix rows={a.rows} colors={{ X: color ?? ART_COLOR[name] ?? 'var(--hm-wool-hi)', '-': '#933529' }} px={px ?? a.px} className={className} style={style} />;
}

/** This mode's trim: a strip of patches in the quilt's five colours along a board's top (section 2). */
export const QuiltBand = ({ className = '' }: { className?: string }) => <i className={`dr-quilt-bar ${className}`} aria-hidden="true" />;

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

interface TrayProps {
  frame: DreamFrame;
  /** The sign's letters when a fence is coming; none while typing ahead. */
  sign: readonly string[];
  typed: string;
  wrong: boolean;
  /** How much of the meter is left, 0 to 1; null with no fence coming. */
  left: number | null;
  /** The night has ended: the tray drops away. */
  over: boolean;
  canJump: boolean;
  onJump: () => void;
  /** The hidden field the keys go to (it brings a phone's keyboard up). */
  children?: ReactNode;
}

/**
 * The tray (section 4): a small board with the quilt band along its top. The sign's letters stand in it as lantern
 * tiles, yours arrive as wool tiles, the next place has the orange ring and a caret, and the meter under them runs
 * down as the fence nears the sheep.
 */
export function Tray({ frame, sign, typed, wrong, left, over, canJump, onJump, children }: TrayProps) {
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
        {left === null && <span>Type ahead…</span>}
      </div>
      {children}
    </div>
  );
}

// ---------- the hint and the messages ----------

/** One ink strip (section 5): a hint with the candle and a lantern bar, or a refusal with an ember bar. */
export function Hint({ kind, style, children }: { kind: 'hint' | 'no'; style?: CSSProperties; children: ReactNode }) {
  return (
    <p className="dr-hint dr-inkcard" data-kind={kind} style={style} role={kind === 'no' ? 'alert' : undefined}>
      {kind === 'hint' && <Art name="candle" />}
      <span>{children}</span>
    </p>
  );
}

// ---------- the counters ----------

/** Top left: which dream this is. */
export function ModeChip({ children }: { children: ReactNode }) {
  return <span className="dr-chip"><Art name="moon-small" /><span>{children}</span></span>;
}

/**
 * The night track (section 7): one pip a fence, in groups split where the sign's letter count changes, each group's
 * count on a small tag before it. Cleared pips are lit, the fence being met blinks, and the fence that ended the night
 * is ember.
 */
export function NightTrack({ groups, reached, ended }: { groups: readonly { letters: number; count: number }[]; reached: number; ended: number | null }) {
  let at = 0;
  return (
    <div className="dr-track" aria-hidden="true">
      {groups.map((g) => (
        <span key={g.letters} className="dr-track-group">
          <b>{g.letters}</b>
          {Array.from({ length: g.count }, () => {
            const i = at++;
            return <i key={i} data-s={i === ended ? 'end' : i < reached ? 'done' : i === reached && ended === null ? 'now' : undefined} />;
          })}
        </span>
      ))}
    </div>
  );
}

/** Top right: sheep counted, and how far into the night. */
export function Counter({ count, of, note, onClose }: { count: number; of: number | null; note?: string; onClose: () => void }) {
  return (
    <div className="dr-corner">
      <div className="dr-counter hm-slab hm-slab--night" aria-live="polite" aria-label={of ? `${count} sheep counted, of ${of}` : `${count} sheep counted`}>
        <SheepHead size={24} />
        <b key={count} className="dr-counter-n">{count}</b>
        {of ? <span>{` of ${of}`}</span> : note ? <span>{` ${note}`}</span> : null}
      </div>
      <IconSlab className="dr-close" onClick={onClose} aria-label="Leave the dream" title="Leave the dream (Esc)"><CloseIcon size={14} /></IconSlab>
    </div>
  );
}

// ---------- cards ----------

export type CardKind = 'stage2' | 'stage3' | 'finale' | 'bump' | 'deep' | 'slept';
const CARDS: Record<CardKind, { tone: 'lantern' | 'ember'; art: ArtName; px: number; title: string; sub: string }> = {
  stage2: { tone: 'lantern', art: 'island', px: 2, title: 'Dreaming…', sub: 'Two letters now' },
  stage3: { tone: 'lantern', art: 'yarn-ball', px: 2, title: 'Deep dream', sub: 'Three letters now' },
  finale: { tone: 'lantern', art: 'z', px: 4, title: 'Nearly out cold', sub: 'Five fences to go' },
  bump: { tone: 'ember', art: 'bump-star', px: 2, title: 'Bump!', sub: 'The farmer stirs…' },
  deep: { tone: 'lantern', art: 'z', px: 4, title: 'Zzz…', sub: 'He’s out cold. Keep counting!' },
  slept: { tone: 'lantern', art: 'z', px: 4, title: 'Zzz…', sub: 'He slept right through it' },
};
/** One announcement (section 8): an ink card with a bar, an icon in a 24 box, a title and a second line. */
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

/** Before the first key (section 9): what to do, in three pictures. */
export function ReadyBoard({ practice }: { practice: boolean }) {
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
          <div className="dr-ready-pic rc-well"><span className="dr-ready-leap"><Art name="sheep-shadow" color="var(--hm-wool-hi)" /><i /></span></div>
          <figcaption>Press Enter to jump</figcaption>
        </figure>
      </div>
      <p className="dr-ready-foot">Press any key to start</p>
    </div>
  );
}

// ---------- the bubble's tail, and what rises along it ----------

/**
 * The tail: three pixel puffs from the window's bottom edge down to the farmer (section 3.3), his "z"s rising from his
 * nose into the smallest one (docs/dream/01-farmer.md, section 3: quicker and bigger the deeper he sleeps), and the
 * "!" of a bump or the "?" of a wrong word over his head.
 */
export function Tail({ puffs, nose, depth, mark, asleep, extra = 0 }: { puffs: readonly Box[]; nose: readonly [number, number]; depth: number; mark: 'bang' | 'question' | null; asleep: boolean;
  /** Changes when a word is taken: he lets out one extra "z", a size larger. */
  extra?: number;
}) {
  const last = puffs[puffs.length - 1], every = depth >= 3 ? 0.45 : depth === 2 ? 0.6 : 0.8;
  const to = { '--zx': `${Math.round(last.x + last.w / 2 - nose[0])}px`, '--zy': `${Math.round(last.y + last.h / 2 - nose[1])}px` } as CSSProperties;
  return (
    <div className="dr-tail" aria-hidden="true">
      {puffs.map((p, i) => <i key={i} className="dr-puff" data-i={i} style={{ left: p.x, top: p.y, width: p.w, height: p.h }} />)}
      {asleep && !mark && [0, 1, 2].map((i) => (
        <span key={`${depth}:${i}`} className="dr-z" style={{ left: nose[0], top: nose[1], animationDuration: `${every * 3}s`, animationDelay: `${-every * i}s`, ...to }}>
          <Art name="z" px={Math.min(4, depth + 1)} />
        </span>
      ))}
      {asleep && !mark && extra > 0 && <span key={extra} className="dr-z dr-z--once" style={{ left: nose[0], top: nose[1], ...to }}><Art name="z" px={Math.min(5, depth + 2)} /></span>}
      {mark && <span key={mark} className="dr-mark" style={{ left: nose[0], top: last.y }}><Art name={mark} /></span>}
    </div>
  );
}

/** The hidden field's ref, typed for the tray's callers. */
export type GhostRef = RefObject<HTMLInputElement | null>;
