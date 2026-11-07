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

/** Whether the element's focus came from the keyboard (so it should be lit); true where the browser cannot say. */
function focusVisible(el: Element): boolean {
  try { return el.matches(':focus-visible'); } catch { return true; }
}

/**
 * A console-style title menu: big carved labels, the first one (Play) largest, and a lantern that moves to whichever
 * item is focused or hovered. Arrow keys (and W/S) move, Enter or Space picks, Home/End jump. The focused item's
 * caption shows below, so the labels can stay short.
 *
 * A row is lit only while the pointer is over it, or while the keyboard is driving the menu: once the pointer leaves,
 * nothing stays highlighted. The active index (for the keys and the caption) is remembered either way.
 */
export function GameMenu({ items, label, compact = false, autoFocus = false, keys = false }: {
  items: MenuItem[]; label: string; compact?: boolean; autoFocus?: boolean;
  /** Listen for the arrow keys, W/S, Home/End and Enter anywhere on the page, not only when the menu has focus. */
  keys?: boolean;
}) {
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((i) => !i.disabled)));
  // The row under the pointer, and whether the keyboard (not the pointer) made the last move: together they decide
  // which row is lit. The menu starts in keyboard mode so the first live row is lit before anyone touches it.
  const [hover, setHover] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(true);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Whether the player has touched the menu (pointer, keys, Tab); `settling` marks the menu's own focus calls.
  const touched = useRef(false);
  const settling = useRef(false);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const lit = (i: number) => hover === i || (keyboard && i === active);

  const move = (to: number) => {
    touched.current = true;
    setKeyboard(true);
    if (to === active) return;
    setActive(to);
    refs.current[to]?.focus();
    playTick(0.15);
  };
  const step = (dir: 1 | -1) => {
    const at = enabled.indexOf(active);
    move(enabled[(at + dir + enabled.length) % enabled.length]);
  };
  const onKey = (e: Pick<KeyboardEvent, 'key' | 'preventDefault'>) => {
    const k = e.key;
    if (k === 'ArrowDown' || k === 's' || k === 'S') step(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') step(-1);
    else if (k === 'Home') move(enabled[0]);
    else if (k === 'End') move(enabled[enabled.length - 1]);
    else return false;
    e.preventDefault();
    return true;
  };

  // Keys anywhere on the screen drive the menu (clicking still works too): the arrows move, Enter or Space picks
  // the item in focus. Typing in a field, a key with a modifier, or an open dialog leaves the keys alone.
  const latest = useRef({ onKey, items, active });
  latest.current = { onKey, items, active };
  useEffect(() => {
    if (!keys) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const { onKey: handle, items: list, active: at } = latest.current;
      if (handle(e)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        // A focused button clicks itself on Enter; only pick for the player when focus is elsewhere.
        if (t && t.closest('button, a')) return;
        const it = list[at];
        if (!it || it.disabled) return;
        e.preventDefault();
        it.onSelect();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keys]);

  // The item under the cursor can become disabled (the word list still loading): keep the lantern on a live one.
  useEffect(() => {
    if (items[active]?.disabled && enabled.length) setActive(enabled[0]);
  }, [items, active, enabled]);

  // On desktop the menu takes focus as the screen opens, so the arrow keys and Enter work straight away. Until the
  // player touches the menu, the first live item keeps that focus: Play once the word list has loaded (while it loads,
  // items under it can come alive first and must not keep it). Never takes focus from a control the player is using.
  const live = enabled.length;
  useEffect(() => {
    if (!autoFocus || !live) return;
    const el = document.activeElement;
    const ours = el instanceof HTMLButtonElement && refs.current.includes(el);
    if (el && el !== document.body && !ours) return;
    if (ours && touched.current) return;
    const target = touched.current ? (items[active]?.disabled ? enabled[0] : active) : enabled[0];
    setActive(target);
    settling.current = true;
    refs.current[target]?.focus({ preventScroll: true });
    settling.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, live]);

  const caption = items[active]?.caption;
  const item = (it: MenuItem, i: number) => (
    <li key={it.id} className="sk-menu-row" style={{ animationDelay: `${300 + i * 70}ms` }}>
      <button
        ref={(el) => { refs.current[i] = el; }}
        className={`sk-menu-item ${i === 0 ? 'sk-menu-primary' : 'kit-patch-row'}`}
        data-active={lit(i) || undefined}
        disabled={it.disabled}
        onClick={it.onSelect}
        onFocus={(e) => {
          if (!settling.current) touched.current = true;
          setActive(i);
          if (focusVisible(e.currentTarget)) setKeyboard(true);
        }}
        onPointerEnter={() => {
          if (it.disabled) return;
          touched.current = true;
          setHover(i);
          setKeyboard(false);
          if (i !== active) { setActive(i); playTick(0.15); }
        }}
        onPointerLeave={() => setHover((h) => (h === i ? null : h))}
        aria-describedby={i === active ? 'sk-menu-caption' : undefined}
      >
        {i === 0 && <><SnowCap className="sk-menu-snow" /><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" /><span className="sk-nail sk-nail-bl" /><span className="sk-nail sk-nail-br" /></>}
        {i === 0 ? <svg className="sk-menu-play-icon kit-peg kit-peg--light" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 4.8 C7 3.6 8.3 2.9 9.3 3.6 L20 10.8 C20.9 11.4 20.9 12.6 20 13.2 L9.3 20.4 C8.3 21.1 7 20.4 7 19.2 Z" fill="currentColor" /></svg> : null}
        <span className="sk-menu-label">{it.label}</span>
        {it.badge && <span className="sk-menu-badge">{it.badge}</span>}
      </button>
    </li>
  );
  // Play is the big sign on its own; everything else sits on a dark wooden board under it, with the caption for the
  // item in focus along the board's foot.
  return (
    <nav aria-label={label} className={`sk-menu ${compact ? 'sk-menu-compact' : ''}`} onKeyDown={keys ? undefined : (e) => { onKey(e); }}>
      <ul className="flex flex-col">{items.slice(0, 1).map((it) => item(it, 0))}</ul>
      <div className="sk-menu-board">
        <ul className="flex flex-col">{items.slice(1).map((it, k) => item(it, k + 1))}</ul>
        <p id="sk-menu-caption" className="sk-menu-caption">{caption}</p>
      </div>
    </nav>
  );
}

