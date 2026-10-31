import { useState } from 'react';
import { ROUNDS, TURNS_PER_PLAYER_PER_ROUND } from '../engine';
import { MODIFIER_INFO } from '../lib/modifiers';
import { useStore } from '../state/store';

interface Props { onScore?: () => void; onChain?: () => void; onCheat: () => void }

export function TopBar({ onScore, onChain, onCheat }: Props) {
  const game = useStore((s) => s.game)!;
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const quit = useStore((s) => s.quit);
  const [leaving, setLeaving] = useState(false);
  const mod = MODIFIER_INFO[game.modifier];
  const left = game.players.reduce((sum, p) => sum + TURNS_PER_PLAYER_PER_ROUND - p.turnsTaken, 0);
  const btn = 'min-h-11 min-w-11 rounded-lg bg-white/10 px-2 text-lg hover:bg-white/15';
  return (
    <header className="flex flex-wrap items-center gap-2 px-2 py-1.5 sm:px-4">
      <div className="mr-auto rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black sm:mr-0">
        Round {game.round}/{ROUNDS}
      </div>
      <div
        className="order-last min-w-0 basis-full truncate rounded-lg border border-wood-light/40 bg-wood/40 px-3 py-1.5 text-center text-xs font-bold sm:order-none sm:flex-1 sm:basis-0 sm:text-sm"
        title={mod.detail}
        data-tour="modifier"
      >
        <span aria-hidden="true">{mod.emoji} </span>{mod.label}
        <span className="font-normal text-white/70 sm:hidden"> · {left} turns left</span>
      </div>
      <div className="ml-auto hidden text-xs text-white/70 sm:ml-0 sm:block">{left} turns left</div>
      <button className={btn} onClick={onCheat} aria-label="Scoring cheat sheet" title="Scoring cheat sheet">📖</button>
      {onScore && <button className={btn} onClick={onScore} aria-label="Scoreboard">📊</button>}
      {onChain && <button className={btn} onClick={onChain} aria-label="Chain history">🔗</button>}
      <button className={btn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button className={btn} onClick={() => setLeaving(true)} aria-label="Leave game">✕</button>
      {leaving && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={() => setLeaving(false)}>
          <div
            role="alertdialog" aria-modal="true" aria-label="Leave game?"
            className="w-full max-w-xs rounded-2xl border-2 border-wood-light bg-[#1a1145] p-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-black">Leave this game?</h2>
            <p className="mt-1 text-sm text-white/70">Your progress in this game will be lost.</p>
            <div className="mt-3 flex gap-2">
              <button autoFocus onClick={() => setLeaving(false)} className="min-h-12 flex-1 rounded-xl bg-white/10 font-bold">Stay</button>
              <button onClick={quit} className="min-h-12 flex-1 rounded-xl bg-red-400 font-black text-red-950">Leave</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
