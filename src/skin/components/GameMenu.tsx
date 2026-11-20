import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { playTick } from '../../audio/sound';
import { PlayIcon } from './Icons';

export interface MenuItem {
  id: string;
  label: ReactNode;
  /** What the item is, in a sentence: Home's card shows it for the chosen item, and it describes the button. */
  caption: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** A small tag beside the label: a streak, "done", "soon". */
  badge?: ReactNode;
  /** The icon on the board's tile. */
  icon?: ReactNode;
  /** A short line under the label (Queue's). */
  sub?: ReactNode;
  /** Home's card only: something to show beside its action (Counting Sheep's nights). */
  more?: ReactNode;
}

/**
 * A console-style title menu (Home, "Word chain", 2026-11-20): a stack of boards, the first (Queue) the big one. The
 * chosen board is lit gold and slides out (home/home.css; it only slides, so nothing else moves), and stays lit until
 * another is chosen, by the pointer, the arrow keys (and W/S) or Tab: Home's card follows it (`onActive`). Enter or
 * Space picks, Home/End jump. The chosen item's caption describes its button.
 */
export function GameMenu({ items, label, compact = false, autoFocus = false, keys = false, onActive }: {
  items: MenuItem[]; label: string; compact?: boolean; autoFocus?: boolean;
  /** Told the id of the chosen item whenever it changes. */
  onActive?: (id: string) => void;
  /** Listen for the arrow keys, W/S, Home/End and Enter anywhere on the page, not only when the menu has focus. */
  keys?: boolean;
}) {
  const [active, setActive] = useState(() => Math.max(0, items.findIndex((i) => !i.disabled)));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Whether the player has touched the menu (pointer, keys, Tab); `settling` marks the menu's own focus calls.
  const touched = useRef(false);
  const settling = useRef(false);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const lit = (i: number) => i === active;
  const activeId = items[active]?.id;
  useEffect(() => { if (activeId) onActive?.(activeId); }, [activeId, onActive]);

  const move = (to: number) => {
    touched.current = true;
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
  // Home keeps the menu mounted under a setup panel (plan file 15, change 4); coming back starts it afresh, as a new
  // menu would: the first live item, lit for the keys.
  const wasAuto = useRef(autoFocus);
  useEffect(() => {
    if (autoFocus && !wasAuto.current) touched.current = false;
    wasAuto.current = autoFocus;
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
    <li key={it.id} className="sk-menu-row" style={{ '--n': i, animationDelay: `${200 + i * 60}ms` } as CSSProperties}>
      <button
        ref={(el) => { refs.current[i] = el; }}
        className={`sk-menu-item hm-board ${i === 0 ? 'sk-menu-primary' : ''}`.trim()}
        data-active={lit(i) || undefined}
        disabled={it.disabled}
        onClick={it.onSelect}
        onFocus={() => {
          if (!settling.current) touched.current = true;
          setActive(i);
        }}
        onPointerEnter={() => {
          if (it.disabled) return;
          touched.current = true;
          // The pointer chooses too: focus follows it, so Enter then picks the board that is lit.
          if (i !== active) { setActive(i); playTick(0.15); }
          if (document.activeElement !== refs.current[i] && (!document.activeElement || document.activeElement === document.body || refs.current.includes(document.activeElement as HTMLButtonElement))) {
            settling.current = true;
            refs.current[i]?.focus({ preventScroll: true });
            settling.current = false;
          }
        }}
        aria-describedby={i === active ? 'sk-menu-caption' : undefined}
      >
        <span className="hm-in">
          {it.icon && <span className="hm-ico" aria-hidden="true">{it.icon}</span>}
          <span className="hm-txt">
            <span className="sk-menu-label">{it.label}</span>
            {it.sub && <span className="hm-sub">{it.sub}</span>}
          </span>
          {it.badge && <span className="sk-menu-badge">{it.badge}</span>}
          {i === 0 && <span className="hm-go" aria-hidden="true"><PlayIcon /></span>}
        </span>
      </button>
    </li>
  );
  return (
    <nav aria-label={label} className={`sk-menu ${compact ? 'sk-menu-compact' : ''}`} onKeyDown={keys ? undefined : (e) => { onKey(e); }}>
      <ul>{items.map(item)}</ul>
      <p id="sk-menu-caption" className="sr-only">{caption}</p>
    </nav>
  );
}
