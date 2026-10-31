import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { rankPlayers } from '../engine';
import { useStore } from '../state/store';
import type { ChainEntry, GameState } from '../engine';

export function Scoreboard({ game }: { game: GameState }) {
  const mySeat = useStore((s) => s.mySeat);
  const room = useStore((s) => s.mode === 'room');
  const ranked = rankPlayers(game.players);
  return (
    <ol className="space-y-1" aria-label="Scoreboard">
      {ranked.map((p, i) => (
        <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm">
          <span className="w-4 text-white/50 tabular-nums">{i + 1}</span>
          <span aria-hidden="true">{p.emoji}</span>
          <span className="min-w-0 flex-1 truncate font-bold" style={{ color: p.color }}>{p.name}{room && p.id === mySeat ? ' (you)' : ''}</span>
          {p.steals > 0 && <span className="text-xs text-amber-300" title="steals">⚡{p.steals}</span>}
          <span className="font-black tabular-nums">{p.banked}</span>
        </li>
      ))}
    </ol>
  );
}

function describe(e: ChainEntry): string {
  switch (e.kind) {
    case 'play': return `${e.word!.toUpperCase()} +${e.points}`;
    case 'steal': return `${e.word!.toUpperCase()} STEAL +${e.points}`;
    case 'bank': return `banked ${e.points}`;
    case 'stealFail': return e.points ? `steal failed ${e.points} pts` : 'steal failed (no penalty)';
    case 'timeout': return e.points ? 'timed out −5' : 'timed out (no penalty)';
    case 'invalid': return e.points ? 'invalid word −5' : 'invalid word (no penalty)';
  }
}

export function ChainHistory({ game, limit }: { game: GameState; limit?: number }) {
  const entries = [...game.history].reverse().slice(0, limit);
  if (!entries.length) return <p className="text-sm text-white/50">No moves yet this round.</p>;
  return (
    <ol className="space-y-1" aria-label="Chain history">
      {entries.map((e, i) => {
        const p = game.players[e.seat];
        return (
          <li key={game.history.length - i} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm">
            <span aria-hidden="true">{p.emoji}</span>
            <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
            <span className="ml-auto text-right text-white/85">{describe(e)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Desktop side panel that collapses to a slim tab. */
export function SidePanel(props: {
  title: string; side: 'left' | 'right'; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const { title, side, open, onToggle, children } = props;
  return (
    <aside className={`flex shrink-0 flex-col py-3 ${side === 'left' ? 'pl-3' : 'pr-3'}`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mb-2 flex min-h-11 items-center justify-between gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold hover:bg-white/15"
      >
        <span>{open ? title : title[0]}</span>
        <span aria-hidden="true">{open ? (side === 'left' ? '◀' : '▶') : side === 'left' ? '▶' : '◀'}</span>
      </button>
      {open && <div className="w-56 min-h-0 flex-1 overflow-y-auto pr-1 lg:w-64">{children}</div>}
    </aside>
  );
}

export function BottomSheet(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {props.open && (
        <motion.div
          className="fixed inset-0 z-30 flex items-end bg-black/50"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={props.onClose}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={props.title}
            className="mx-auto max-h-[80%] w-full overflow-y-auto rounded-t-2xl sm:max-w-2xl border-t border-white/15 bg-[#17103a] p-4"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">{props.title}</h2>
              <button onClick={props.onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">✕</button>
            </div>
            {props.children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
