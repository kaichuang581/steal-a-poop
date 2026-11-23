import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pix } from '../kit/surfaces';
import { PenIcon } from '../rooms/penArt';
import { pixelRects } from '../components/pixels';

/**
 * The setup sheets Create lobby and Practice open (Brian, 2026-11-22: "the popup ui is poorly done, its just another plain
 * card"; of three layouts drawn over Home he chose "B but better"). A sheet of its own floating over the scenery, apart
 * from the panel ("i dont want it growing out of the menu ... now it just looks the same as the side bar"): leaning 11
 * degrees like the menu, a lighter night face with a lantern band on top, every setting a darker sunken row, every choice a
 * leaning block with its text upright, and the action a big lit block like Queue with what you chose written under it.
 * The chosen menu item stays lit behind it. Home's pieces only (home.css, `.hm-setup*`).
 */
export function SetupSheet({ label, kicker, title, note, onClose, action, children }: { label: string; kicker: string; title: string; note?: ReactNode; onClose: () => void; action: ReactNode; children: ReactNode }) {
  return (
    <div className="hm-setup rc" role="dialog" aria-label={label}>
      <div className="hm-setup-face" aria-hidden="true" />
      <div className="hm-setup-frame" aria-hidden="true" />
      <div className="hm-setup-head">
        <span className="hm-setup-kicker">{kicker}</span>
        <h2>{title}</h2>
        <button className="hm-close hm-slab hm-slab--sm" onClick={onClose} aria-label="Back" title="Back"><Pix rows={CROSS} colors={{ X: 'var(--hm-ink)' }} /></button>
      </div>
      {note && <p className="hm-setup-note">{note}</p>}
      {/* The rows scroll when they do not fit (Custom's three rules on a short window); the action stays in view. */}
      <div className="hm-setup-rows">{children}</div>
      {action}
    </div>
  );
}

/**
 * One setting, on two fixed columns: its icon tile and name (centred on the controls' line), then its controls, and the
 * hint under them starting at their left edge. The row leans with the card; only text and icons are stood upright.
 */
export function SetupRow({ icon, name, foot, label, children, hintTone }: { icon: ReactNode; name: string; foot?: ReactNode; label?: string; children: ReactNode; hintTone?: 'error' }) {
  return (
    <fieldset className="hm-setup-row">
      <legend className="sr-only">{label ?? name}</legend>
      <span className="hm-setup-up hm-setup-lead" aria-hidden="true">
        <span className="hm-setup-ico">{icon}</span>
        <b className="hm-setup-name">{name}</b>
      </span>
      <span className="hm-setup-choices">{children}</span>
      {foot && <span className="hm-setup-foot" data-tone={hintTone} aria-live="polite"><span className="hm-setup-up">{foot}</span></span>}
    </fieldset>
  );
}

/** A choice: a leaning slab, lantern when chosen, its label upright in Fraunces. */
export function SetupChoice({ on, onClick, label, children }: { on: boolean; onClick: () => void; label?: string; children: ReactNode; big?: boolean }) {
  return (
    <button type="button" className={`hm-setup-choice hm-slab ${on ? 'hm-slab--lantern' : 'hm-slab--wool'}`} aria-pressed={on} aria-label={label} onClick={onClick}>
      <span className="hm-setup-up">{children}</span>
    </button>
  );
}

/** The card's one action: a lantern slab on the card's slant, its icon at 24 and two lines, the label and the state. */
export function SetupGo({ icon, label, sub, onClick, disabled, autoFocus }: { icon: ReactNode; label: string; sub: ReactNode; onClick: () => void; disabled?: boolean; autoFocus?: boolean }) {
  const [auto, setAuto] = useState(!!autoFocus); // focused by the card, not by the player: no ring until it is
  return (
    <button type="button" className="sk-sit hm-setup-go hm-slab hm-slab--lantern hm-knit" onClick={onClick} disabled={disabled} autoFocus={autoFocus}
      data-auto={auto || undefined} onBlur={() => setAuto(false)}>
      <span className="hm-setup-up hm-setup-go-in">
        <span className="hm-setup-go-ico" aria-hidden="true">{icon}</span>
        <span className="hm-setup-go-text"><b>{label}</b><small>{sub}</small></span>
      </span>
    </button>
  );
}

// The card's pixel art (docs/home-ui, the cards plan of 2026-11-23, section 5): drawn at 2 px an art pixel unless said.
const CROSS = ['XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX'];
const KEY = ['............', '............', '............', '.XXXX.......', 'XXXXXX......', 'XX..XXXXXXXX', 'XX..XXXXXXXX', 'XXXXXX..XX.X', '.XXXX...XX.X', '............', '............', '............'];
const BOT = ['...XX...', '...XX...', 'XXXXXXXX', 'XX.XX.XX', 'XXXXXXXX', 'XX....XX', 'XXXXXXXX', '.XX..XX.'];
const TREES = {
  easy: ['........', 'XX....XX', 'XXX..XXX', '.XXXXXX.', '...XX...', '...XX...', '...XX...', '..XXXX..'],
  medium: ['........', '...XX...', '..XXXX..', '.XXXXXX.', '..XXXX..', '...XX...', '...XX...', '..XXXX..'],
  hard: ['...XX...', '..XXXX..', '.XXXXXX.', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', '...XX...', '..XXXX..'],
} as const;
const STOPWATCH = ['....XXXX....', '.....XX.....', '...XXXXXX...', '..XX....XX..', '.XX..X...XX.', '.X...X....X.', '.X...XXX..X.', '.X........X.', '.XX......XX.', '..XX....XX..', '...XXXXXX...', '............'];
/** The key, in lantern, for the Code row's ink tile. */
export const KeyIcon = () => <Pix rows={KEY} colors={{ X: 'var(--hm-lantern)' }} />;
/** The bot's face, 8 x 8 at 3 px an art pixel (24), in the row's ink tile. */
export const BotIcon = () => <Pix rows={BOT} colors={{ X: 'var(--hm-wool)' }} px={3} />;
/** The clock (PEN-PLAN-V3 11.9) at 3 px an art pixel (24), in the row's ink tile. */
export const ClockArt = () => <PenIcon name="clock" color="var(--hm-wool)" px={3} />;
/** A tree that grows with the bot: sprout, sapling, pine (16), in the slab's ink. */
export const TreeIcon = ({ level }: { level: keyof typeof TREES }) => <Pix rows={TREES[level]} colors={{ X: 'currentColor' }} />;
/** The stopwatch, for Start run (24, the button's ink). */
export const StopwatchIcon = () => <Pix rows={STOPWATCH} colors={{ X: 'currentColor' }} />;
/** The gate (PEN-PLAN-V3 11.5): joining walks you into the pen. */
export const GateIcon = () => <PenIcon name="gate" color="currentColor" />;

/** Two small pixel pictures the sheets need and the icon set did not have (10 x 10, like the rest). */
const pic = (rows: string, colors: Record<string, string>) => (
  <svg viewBox="0 0 10 10" width="100%" height="100%" aria-hidden="true" shapeRendering="crispEdges">{pixelRects(rows.trim().split('\n').map((r) => r.trim()), colors)}</svg>
);
/** An hourglass: the game's length. */
export const HourglassIcon = () => pic(`
  .########.
  ..#....#..
  ..#ssss#..
  ...#ss#...
  ....##....
  ...#..#...
  ..#..s.#..
  ..#ssss#..
  .########.
  ..........`, { '#': 'var(--hm-wool)', s: 'var(--hm-lantern)' });
/** A ball of wool: a sheep's lives. */
export const WoolBallIcon = () => pic(`
  ..........
  ...####...
  ..#w#ww#..
  .#ww#w#w#.
  .#w#ww#w#.
  .#ww#w#w#.
  ..#w#ww#..
  ...####.##
  ..........
  ..........`, { '#': 'var(--hm-barn)', w: 'var(--hm-wool)' });
