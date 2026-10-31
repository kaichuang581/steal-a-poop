import { motion } from 'framer-motion';
import { useReduceMotion } from './useReduceMotion';
import { useMemo } from 'react';

const COLORS = ['#f5c26b', '#c98a4b', '#f472b6', '#38bdf8', '#a3e635'];

export function Confetti() {
  const reduced = useReduceMotion();
  const pieces = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8,
      rot: (Math.random() - 0.5) * 720, color: COLORS[i % COLORS.length], size: 6 + Math.random() * 6,
    })),
    [],
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color }}
          initial={{ y: -20, opacity: 0.9 }}
          animate={{ y: '105vh', rotate: p.rot, opacity: [0.9, 0.9, 0] }}
          transition={{ delay: p.delay, duration: p.dur, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
