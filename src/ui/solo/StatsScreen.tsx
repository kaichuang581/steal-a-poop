import { useEffect, useRef, useState } from 'react';
import type { GameRecord } from '../../lib/stats';
import { useStore } from '../../state/store';

const TRIGGER =
  'flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-white/10 px-4 font-bold hover:bg-white/15';

/**
 * Opens the local stats. It owns its open state so a host screen only needs to render the button,
 * and it is styled for a full-width slot by default.
 */
export function StatsButton({ className = TRIGGER, label = 'Stats' }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <span>{label}</span>
        <span aria-hidden="true">›</span>
      </button>
      {open && <StatsScreen onClose={() => setOpen(false)} />}
    </>
  );
}

function place(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Today shows a time, anything older shows a date. Local time, since these games are local. */
function whenLabel(at: number): string {
  const then = new Date(at);
  if (then.toDateString() === new Date().toDateString()) {
    return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function GameRow({ game }: { game: GameRecord }) {
  return (
    <li className="rounded-xl bg-white/5 px-3 py-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold text-amber-200">{game.mode === 'quick' ? 'Quick Game' : 'Practice'}</span>
        <span className="text-xs text-white/50">{whenLabel(game.at)}</span>
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-white/80">
          {place(game.rank)} of {game.players}
          {game.won ? ' 🏆' : ''}
        </span>
        <span className="font-black tabular-nums">{game.score} wool</span>
      </div>
      {game.longestWord && (
        <div className="mt-0.5 text-xs text-white/50">Longest {game.longestWord.toUpperCase()}</div>
      )}
    </li>
  );
}

/**
 * Local statistics: stored in this browser only, never uploaded. Reset asks for confirmation in the
 * page itself, so it works the same on every device and cannot be dismissed by accident.
 */
export function StatsScreen({ onClose }: { onClose: () => void }) {
  const stats = useStore((s) => s.stats);
  const resetStats = useStore((s) => s.resetStats);
  const [confirming, setConfirming] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const hasAnything = stats.games > 0 || stats.history.length > 0;
  const rows: [string, string | number][] = [
    ['Games played', stats.games],
    ['Wins', stats.games ? `${stats.wins} · ${winRate}%` : '—'],
    ['Most wool kept', stats.games ? stats.bestScore.toLocaleString() : '—'],
    ['Longest word', stats.longestWord ? `${stats.longestWord.toUpperCase()} (${stats.longestWord.length})` : '—'],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Your stats"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border-2 border-wood-light bg-[#1a1145] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-xl font-black text-amber-300">Your stats</h2>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="text-xs text-white/55">Saved in this browser only, from Quick Game and Practice games.</p>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
              <dd className="truncate font-black">{value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-4 text-sm font-black uppercase tracking-wider text-amber-300">Recent games</h3>
        {stats.history.length ? (
          <ol className="mt-1 space-y-1" aria-label="Recent games">
            {stats.history.map((game, i) => (
              <GameRow key={`${game.at}-${i}`} game={game} />
            ))}
          </ol>
        ) : (
          <p className="mt-1 rounded-xl bg-white/5 px-3 py-3 text-sm text-white/60">
            No finished games yet. Play a Quick Game or Practice to start your history.
          </p>
        )}

        {confirming ? (
          <div role="alert" className="mt-3 rounded-xl border-2 border-red-300/60 bg-red-900/30 p-3">
            <p className="text-sm font-bold">
              Clear every stat and all {stats.history.length === 1 ? '1 saved game' : `${stats.history.length} saved games`}?
              This cannot be undone.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => { resetStats(); setConfirming(false); }}
                className="min-h-11 flex-1 rounded-lg bg-red-300 px-3 font-black text-red-950"
              >
                Yes, clear
              </button>
              <button onClick={() => setConfirming(false)} className="min-h-11 flex-1 rounded-lg bg-white/10 px-3 font-bold">
                Keep them
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)} disabled={!hasAnything}
            className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-3 font-bold hover:bg-white/15 disabled:opacity-40"
          >
            Reset stats
          </button>
        )}
      </div>
    </div>
  );
}
