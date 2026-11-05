import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { playTick } from '../../audio/sound';
import { SnowCap } from './SnowCap';

export interface MenuItem {
  id: string;
  label: ReactNode;
  /** One line for the caption under the menu while this item is focused. */
  caption: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** A small tag beside the label: a streak, "done", "soon". */
  badge?: ReactNode;
  /** A small pixel icon before the label (the items under Play). */
  icon?: ReactNode;
}

/**
 * A console-style title menu: big carved labels, the first one (Play) largest, and a lantern that moves to whichever
 * item is focused or hovered. Arrow keys (and W/S) move, Enter or Space picks, Home/End jump. The focused item's
 * caption shows below, so the labels can stay short.
 */
export function GameMenu({ items, label, compact = false, autoFocus = false }: { items: MenuItem[]; label: string; compact?: boolean; autoFocus?: boolean }) {
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((i) => !i.disabled)));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  const move = (to: number) => {
    if (to === active) return;
    setActive(to);
    refs.current[to]?.focus();
    playTick(0.15);
  };
  const step = (dir: 1 | -1) => {
    const at = enabled.indexOf(active);
    move(enabled[(at + dir + enabled.length) % enabled.length]);
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowDown' || k === 's' || k === 'S') step(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') step(-1);
    else if (k === 'Home') move(enabled[0]);
    else if (k === 'End') move(enabled[enabled.length - 1]);
    else return;
    e.preventDefault();
  };

  // The item under the cursor can become disabled (the word list still loading): keep the lantern on a live one.
  useEffect(() => {
    if (items[active]?.disabled && enabled.length) setActive(enabled[0]);
  }, [items, active, enabled]);

  // On desktop the menu takes focus as the screen opens, so the arrow keys and Enter work straight away.
  // Waits for the items to come alive (Play is disabled while the word list loads), and never takes focus from a
  // control the player is already using.
  const live = enabled.length;
  useEffect(() => {
    if (!autoFocus || !live) return;
    const el = document.activeElement;
    if (el && el !== document.body) return;
    refs.current[items[active]?.disabled ? enabled[0] : active]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, live]);

  const caption = items[active]?.caption;
  const item = (it: MenuItem, i: number) => (
    <li key={it.id} className="sk-menu-row" style={{ animationDelay: `${300 + i * 70}ms` }}>
      <button
        ref={(el) => { refs.current[i] = el; }}
        className={`sk-menu-item ${i === 0 ? 'sk-menu-primary' : ''}`}
        data-active={i === active || undefined}
        disabled={it.disabled}
        onClick={it.onSelect}
        onFocus={() => setActive(i)}
        onPointerEnter={() => { if (!it.disabled && i !== active) { setActive(i); playTick(0.15); } }}
        aria-describedby={i === active ? 'sk-menu-caption' : undefined}
      >
        {i === 0 && <><SnowCap className="sk-menu-snow" /><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" /><span className="sk-nail sk-nail-bl" /><span className="sk-nail sk-nail-br" /></>}
        {i === 0 ? <svg className="sk-menu-play-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 4.8 C7 3.6 8.3 2.9 9.3 3.6 L20 10.8 C20.9 11.4 20.9 12.6 20 13.2 L9.3 20.4 C8.3 21.1 7 20.4 7 19.2 Z" fill="currentColor" /></svg> : <span className="sk-menu-cursor" aria-hidden="true"><PixelArrow /></span>}
        <span className="sk-menu-label">{it.label}</span>
        {it.badge && <span className="sk-menu-badge">{it.badge}</span>}
      </button>
    </li>
  );
  // Play is the big sign on its own; everything else sits on a dark wooden board under it, with the caption for the
  // item in focus along the board's foot.
  return (
    <nav aria-label={label} className={`sk-menu ${compact ? 'sk-menu-compact' : ''}`} onKeyDown={onKey}>
      <ul className="flex flex-col">{items.slice(0, 1).map((it) => item(it, 0))}</ul>
      <div className="sk-menu-board sk-pixel-panel">
        <ul className="flex flex-col">{items.slice(1).map((it, k) => item(it, k + 1))}</ul>
        <p id="sk-menu-caption" className="sk-menu-caption">{caption}</p>
      </div>
    </nav>
  );
}

/** The menu cursor: a small pixel arrow, like a cartridge game's. */
function PixelArrow() {
  return (
    <svg viewBox="0 0 5 7" width="10" height="14" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="1" height="7" fill="#5B3A1E" /><rect x="1" y="1" width="1" height="5" fill="#5B3A1E" /><rect x="2" y="2" width="1" height="3" fill="#5B3A1E" /><rect x="3" y="3" width="1" height="1" fill="#5B3A1E" />
      <rect x="0" y="1" width="1" height="5" fill="#FFD98A" /><rect x="1" y="2" width="1" height="3" fill="#FFD98A" /><rect x="2" y="3" width="1" height="1" fill="#FFD98A" />
    </svg>
  );
}
