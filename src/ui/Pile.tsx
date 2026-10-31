import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { pileColor } from './geometry';

export function Pile({ pile }: { pile: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(pile);
  const shownRef = useRef(pile);

  useEffect(() => {
    const controls = animate(shownRef.current, pile, {
      duration: reduced ? 0 : 0.55,
      ease: 'easeOut',
      onUpdate: (v) => {
        shownRef.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [pile, reduced]);

  const chips = Math.min(14, Math.ceil(pile / 8));
  const color = pileColor(pile);
  return (
    <div className="flex flex-col items-center" data-pile>
      <div className="relative h-10 w-14 sm:h-16 sm:w-20" aria-hidden="true">
        {Array.from({ length: chips }, (_, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 h-2.5 w-10 rounded-full border border-black/30 sm:h-3.5 sm:w-14"
            style={{
              bottom: `${i * (chips > 8 ? 3 : 4)}px`,
              x: `calc(-50% + ${(i % 3) - 1}px)`,
              background: color,
              boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
            }}
            initial={{ scale: 0, y: -18 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          />
        ))}
      </div>
      <motion.div
        key={pile}
        initial={{ scale: pile === 0 ? 1 : 1.4 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14 }}
        className="text-4xl font-black tabular-nums leading-none drop-shadow sm:text-6xl"
        style={{ color }}
        aria-label={`Pile ${pile} points`}
      >
        {shown}
      </motion.div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">pile</div>
    </div>
  );
}
