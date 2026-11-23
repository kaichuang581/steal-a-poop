import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './hud-overlays.css';

export type AlarmTone = 'speed' | 'twist';

export interface AlarmSpec {
  id: number;
  tone: AlarmTone;
  /** The small line over the title: what kind of alarm this is ("Round 3: faster", "Round 2: new rule"). */
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  /** How long it stays up; the queue's default otherwise. */
  ms?: number;
}

/**
 * The alarm band, dropped in over the table for the moments that change the game's rules on the spot: faster turns
 * and a new rule. The pen's felt bar right across the screen with a lantern rule along each edge (frost for a rule), a
 * small caps line, the news in Fraunces and a line in Nunito (Brian, 2026-11-23: the old striped plank was "outdated ui").
 */
export function Alarm({ tone, label, title, sub, compact = false }: Omit<AlarmSpec, 'id' | 'ms'> & { compact?: boolean }) {
  return (
    <div className={`kit-alarm hm rc kit-alarm-${tone} ${compact ? 'kit-alarm-compact' : ''}`} role="alert">
      <span className="kit-alarm-label">{label}</span>
      <span className="kit-alarm-title">{title}</span>
      {sub && <span className="kit-alarm-sub">{sub}</span>}
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
