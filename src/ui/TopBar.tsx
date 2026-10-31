import { ROUNDS, TURNS_PER_PLAYER_PER_ROUND } from '../engine';
import { MODIFIER_INFO } from '../lib/modifiers';
import { useStore } from '../state/store';

interface Props { onScore?: () => void; onChain?: () => void }

export function TopBar({ onScore, onChain }: Props) {
  const game = useStore((s) => s.game)!;
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const quit = useStore((s) => s.quit);
  const mod = MODIFIER_INFO[game.modifier];
  const left = game.players.reduce((sum, p) => sum + TURNS_PER_PLAYER_PER_ROUND - p.turnsTaken, 0);
  const btn = 'min-h-11 min-w-11 rounded-lg bg-white/10 px-2 text-lg hover:bg-white/15';
  return (
    <header className="flex flex-wrap items-center gap-2 px-2 py-1.5 sm:px-4">
      <div className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black">
        Round {game.round}/{ROUNDS}
      </div>
      <div
        className="order-last min-w-0 basis-full truncate rounded-lg border border-wood-light/40 bg-wood/40 px-3 py-1.5 text-center text-xs font-bold sm:order-none sm:flex-1 sm:basis-0 sm:text-sm"
        title={mod.detail}
      >
        <span aria-hidden="true">{mod.emoji} </span>{mod.label}
      </div>
      <div className="ml-auto text-xs text-white/70 sm:ml-0">{left} turns left</div>
      {onScore && <button className={btn} onClick={onScore} aria-label="Scoreboard">📊</button>}
      {onChain && <button className={btn} onClick={onChain} aria-label="Chain history">🔗</button>}
      <button className={btn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        {muted ? '🔇' : '🔊'}
      </button>
      <button className={btn} onClick={quit} aria-label="Leave game">✕</button>
    </header>
  );
}
