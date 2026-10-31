import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { EventKind } from '../engine';
import { useStore } from '../state/store';

interface Toast { id: number; text: string; kind: EventKind }

const TOASTED = new Set<EventKind>(['steal', 'trapSprung', 'burn', 'timeout', 'invalid', 'stealFail', 'bank']);
const TONE: Partial<Record<EventKind, string>> = {
  steal: 'border-fuchsia-300 bg-fuchsia-600',
  trapSprung: 'border-amber-300 bg-amber-600',
  burn: 'border-orange-300 bg-orange-700',
  timeout: 'border-red-300 bg-red-700',
  invalid: 'border-red-300 bg-red-700',
  stealFail: 'border-red-300 bg-red-800',
  bank: 'border-emerald-300 bg-emerald-700',
};

/** Visual toasts for notable events, plus an aria-live feed of every event. */
export function EventFeed() {
  const events = useStore((s) => s.game?.events);
  const lastSeen = useRef(events?.at(-1)?.id ?? 0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [spoken, setSpoken] = useState('');
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!events) return;
    const fresh = events.filter((e) => e.id > lastSeen.current);
    if (!fresh.length) return;
    lastSeen.current = fresh[fresh.length - 1].id;
    setSpoken(fresh.map((e) => e.text).join('. '));
    const add = fresh.filter((e) => TOASTED.has(e.kind)).slice(-3).map((e) => ({ id: e.id, text: e.text, kind: e.kind }));
    if (!add.length) return;
    setToasts((t) => [...t, ...add].slice(-4));
    const ids = new Set(add.map((a) => a.id));
    // Not cleared on re-run: `events` changes identity every turn and would cancel earlier removals.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((t) => t.filter((x) => !ids.has(x.id)));
    }, 2600);
    timers.current.add(timer);
  }, [events]);

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{spoken}</div>
      <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-xl border-2 px-4 py-2 text-sm font-black shadow-xl sm:text-lg ${TONE[t.kind] ?? 'border-white/30 bg-slate-700'}`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
