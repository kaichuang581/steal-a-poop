import { AnimatePresence, motion } from 'framer-motion';
import { inStealWindow } from '../engine';
import { useStore } from '../state/store';
import { ChainTile } from './ChainTile';
import { seatPosition } from './geometry';
import { Flights } from './Flights';
import { Pile } from './Pile';
import { Seat } from './Seat';

export function Table() {
  const game = useStore((s) => s.game)!;
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const n = game.players.length;
  return (
    <div className="relative size-full" data-table>
      <div className="absolute inset-x-[10%] inset-y-[14%] rounded-[50%] border-[10px] border-wood bg-felt shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_0_60px_rgba(0,0,0,0.55)] sm:border-[14px]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.07), transparent 65%), repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 5px)',
          borderColor: '#6b4423',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 3px #c98a4b55, inset 0 0 60px rgba(0,0,0,0.55)',
        }}
      />
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 sm:gap-8">
        <ChainTile letter={game.chainLetter} />
        <Pile pile={game.pile} />
      </div>
      <AnimatePresence>
        {stealOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[27%] z-10 -translate-x-1/2 rounded-full border-2 border-fuchsia-300 bg-fuchsia-600/90 px-3 py-1 text-xs font-black uppercase tracking-wider shadow-lg sm:top-[24%] sm:text-sm"
            role="status"
          >
            {game.turn?.seat === 0 ? '⚠ Others can steal!' : '⚡ Steal window'}
          </motion.div>
        )}
      </AnimatePresence>
      <Flights />
      {game.players.map((p) => {
        const { x, y } = seatPosition(p.id, n);
        return <Seat key={p.id} player={p} x={x} y={y} turn={game.turn} />;
      })}
    </div>
  );
}
