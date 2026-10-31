import { AnimatePresence, motion } from 'framer-motion';

export function ChainTile({ letter }: { letter: string }) {
  return (
    <div className="flex flex-col items-center gap-1" data-chain-tile style={{ perspective: 400 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={letter}
          initial={{ rotateY: -90 }}
          animate={{ rotateY: 0 }}
          exit={{ rotateY: 90 }}
          transition={{ duration: 0.16 }}
          className="flex size-12 items-center justify-center rounded-xl border-2 border-wood-light bg-gradient-to-b from-amber-100 to-amber-300 text-3xl font-black uppercase text-wood shadow-lg sm:size-20 sm:text-5xl"
          aria-label={`Required starting letter ${letter.toUpperCase()}`}
        >
          {letter}
        </motion.div>
      </AnimatePresence>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">starts with</div>
    </div>
  );
}
