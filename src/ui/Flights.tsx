import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { seatPosition } from './geometry';
import { useStore } from '../state/store';
import { useNewEvents } from './useNewEvents';
import { WordText } from './WordText';

interface Flight { id: number; seat: number; word: string; amount: number; steal: boolean }

/** Word card slides from the seat to the pile, then a "+N" floater rises from the pile. */
export function Flights() {
  const reduced = useReducedMotion();
  const n = useStore((s) => s.game?.players.length ?? 0);
  const [flights, setFlights] = useState<Flight[]>([]);

  useNewEvents((e) => {
    if ((e.kind !== 'play' && e.kind !== 'steal') || !e.word || e.seat === null) return;
    const f = { id: e.id, seat: e.seat, word: e.word, amount: e.amount, steal: e.kind === 'steal' };
    setFlights((list) => [...list.slice(-4), f]);
    setTimeout(() => setFlights((list) => list.filter((x) => x.id !== f.id)), 1700);
  });

  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <AnimatePresence>
        {flights.map((f) => {
          const { x, y } = seatPosition(f.seat, n);
          return (
            <div key={f.id}>
              <motion.div
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg border-2 border-amber-200 bg-amber-100 px-2.5 py-1 text-sm font-black uppercase tracking-wide text-wood shadow-xl sm:text-xl"
                initial={{ left: `${x}%`, top: `${y}%`, scale: 0.6, opacity: 0 }}
                animate={{ left: '50%', top: '38%', scale: [0.6, 1.2, 1], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.0, times: [0, 0.35, 0.8, 1], ease: 'easeInOut' }}
              >
                <WordText word={f.word} />
              </motion.div>
              <motion.div
                className={`absolute left-1/2 top-[52%] -translate-x-1/2 text-2xl font-black drop-shadow sm:text-4xl ${f.steal ? 'text-fuchsia-300' : 'text-emerald-300'}`}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: -50, scale: [0.6, 1.2, 1, 1] }}
                transition={{ delay: 0.7, duration: 0.9 }}
              >
                +{f.amount}
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
