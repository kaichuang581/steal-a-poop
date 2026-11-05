import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type AlarmTone = 'speed' | 'twist' | 'steal';

export interface AlarmSpec {
  id: number;
  tone: AlarmTone;
  /** The small line over the title: what kind of alarm this is ("Round 3 · faster", "Steal turn"). */
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  /** How long it stays up; the queue's default otherwise. */
  ms?: number;
}

/** The barn's alarm lamp: a dome light on a base, with rays. */
function LampIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 20h16v2H4z M6 18h12v2H6z" fill="currentColor" opacity="0.75" />
      <path d="M7 18v-6a5 5 0 0 1 10 0v6z" fill="currentColor" />
      <path d="M12 2v3M4.2 6.6l2.1 2.1M19.8 6.6l-2.1 2.1M2 13h3M19 13h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The alarm board: a dark plank with hazard stripes and two blinking lamps, dropped in over the table for the
 * moments that change the game's rules on the spot: faster turns, a twist, a steal turn. The same carved display
 * lettering as the signboards, so it belongs to the barn, but no snow and no warm wood: this is a warning.
 */
export function Alarm({ tone, label, title, sub, compact = false }: Omit<AlarmSpec, 'id' | 'ms'> & { compact?: boolean }) {
  return (
    <div className={`sk-alarm sk-alarm-${tone} ${compact ? 'sk-alarm-compact' : ''}`} role="alert">
      <span className="sk-alarm-stripe sk-alarm-stripe-l" aria-hidden="true" />
      <span className="sk-alarm-lamp" aria-hidden="true"><LampIcon size={compact ? 20 : 26} /></span>
      <span className="sk-alarm-body">
        <span className="sk-alarm-label">{label}</span>
        <span className="sk-alarm-title">{title}</span>
        {sub && <span className="sk-alarm-sub">{sub}</span>}
      </span>
      <span className="sk-alarm-lamp sk-alarm-lamp-r" aria-hidden="true"><LampIcon size={compact ? 20 : 26} /></span>
      <span className="sk-alarm-stripe sk-alarm-stripe-r" aria-hidden="true" />
    </div>
  );
}

/** An alarm still waiting after this long is old news (a backgrounded tab catching up): it is dropped, not shown. */
const STALE_MS = 6000;
/** The most alarms that can wait their turn; older ones are dropped first. */
const MAX_QUEUE = 3;

/**
 * One alarm at a time: pushes queue up and show one after the other, each for its own time (or `defaultMs`), so a
 * round's "faster" and "new rule" never pile on top of each other. `clear` drops the lot (the game ended).
 */
export function useAlarms(defaultMs = 2600): [AlarmSpec | null, (a: Omit<AlarmSpec, 'id'>) => void, () => void] {
  const [current, setCurrent] = useState<AlarmSpec | null>(null);
  const queue = useRef<(AlarmSpec & { queuedAt: number })[]>([]);
  const showing = useRef(false);
  const timer = useRef(0);
  const show = useCallback(() => {
    let next = queue.current.shift();
    while (next && performance.now() - next.queuedAt > STALE_MS) next = queue.current.shift();
    if (!next) {
      showing.current = false;
      setCurrent(null);
      return;
    }
    showing.current = true;
    setCurrent(next);
    timer.current = window.setTimeout(show, next.ms ?? defaultMs);
  }, [defaultMs]);
  const push = useCallback((a: Omit<AlarmSpec, 'id'>) => {
    queue.current.push({ ...a, id: Math.random(), queuedAt: performance.now() });
    if (queue.current.length > MAX_QUEUE) queue.current.splice(0, queue.current.length - MAX_QUEUE);
    if (!showing.current) show();
  }, [show]);
  const clear = useCallback(() => {
    queue.current = [];
    window.clearTimeout(timer.current);
    showing.current = false;
    setCurrent(null);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [current, push, clear];
}
