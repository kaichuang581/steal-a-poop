import type { ReactNode } from 'react';
import { CloseIcon } from '../components/Icons';
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
    <div className="hm-setup" role="dialog" aria-label={label}>
      <div className="hm-setup-face" aria-hidden="true" />
      <div className="hm-setup-head">
        <span className="hm-setup-kicker">{kicker}</span>
        <h2>{title}</h2>
        <button className="hm-close hm-slab hm-slab--wool hm-slab--sm" onClick={onClose} aria-label="Back" title="Back"><CloseIcon size={16} /></button>
      </div>
      {note && <p className="hm-setup-note">{note}</p>}
      {/* The rows scroll when they do not fit (Custom's three rules on a short window); the action stays in view. */}
      <div className="hm-setup-rows">{children}</div>
      {action}
    </div>
  );
}

/** One setting: its icon tile and name, its choices, and a line under them saying what the choice means, on one leaning block. */
export function SetupRow({ icon, name, foot, label, children }: { icon: ReactNode; name: string; foot?: ReactNode; label?: string; children: ReactNode }) {
  return (
    <fieldset className="hm-setup-row">
      <legend className="sr-only">{label ?? name}</legend>
      <span className="hm-setup-up hm-setup-lead" aria-hidden="true">
        <span className="hm-setup-ico">{icon}</span>
        <b className="hm-setup-name">{name}</b>
      </span>
      <span className="hm-setup-right">
        <span className="hm-setup-choices">{children}</span>
        {foot && <span className="hm-setup-up hm-setup-foot" aria-live="polite">{foot}</span>}
      </span>
    </fieldset>
  );
}

/** A choice: a small leaning block, lantern when chosen. */
export function SetupChoice({ on, onClick, label, children, big = false }: { on: boolean; onClick: () => void; label?: string; children: ReactNode; big?: boolean }) {
  return (
    <button type="button" className={`hm-setup-choice hm-slab ${on ? 'hm-slab--lantern' : 'hm-slab--wool'}`} data-big={big || undefined} aria-pressed={on} aria-label={label} onClick={onClick}>
      <span className="hm-setup-up">{children}</span>
    </button>
  );
}

/** The sheet's one action, drawn like Queue: an icon tile, the label, and what was chosen under it. */
export function SetupGo({ icon, label, sub, onClick, disabled, autoFocus }: { icon: ReactNode; label: string; sub: ReactNode; onClick: () => void; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <button type="button" className="sk-sit hm-setup-go hm-slab hm-slab--lantern hm-knit" onClick={onClick} disabled={disabled} autoFocus={autoFocus}>
      <span className="hm-setup-up hm-setup-go-in">
        <span className="hm-setup-go-ico" aria-hidden="true">{icon}</span>
        <span className="hm-setup-go-text"><b>{label}</b><small>{sub}</small></span>
      </span>
    </button>
  );
}

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
