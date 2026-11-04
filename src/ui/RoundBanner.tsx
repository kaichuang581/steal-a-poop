import { AnimatePresence, motion } from 'framer-motion';
import { MODIFIER_INFO } from '../lib/modifiers';
import { useStore } from '../state/store';

export function RoundBanner() {
  const game = useStore((s) => s.game)!;
  const mod = MODIFIER_INFO[game.modifier];
  return (
    <AnimatePresence>
      {game.phase === 'intro' && game.mode !== 'tour' && (
        <motion.div
          key={game.round}
          className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-black/55 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="rounded-3xl border-2 border-wood-light bg-[#1d1346] px-8 py-6 text-center shadow-2xl"
            initial={{ scale: 0.7, rotate: -3 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <div className="text-sm font-bold uppercase tracking-widest text-white/60">Round {game.round} of {game.settings.rounds}</div>
            <div className="my-2 text-5xl" aria-hidden="true">{mod.emoji}</div>
            <div className="text-2xl font-black text-amber-300 sm:text-4xl">{mod.label}</div>
            <div className="mt-1 text-sm text-white/80 sm:text-base">{mod.detail}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
