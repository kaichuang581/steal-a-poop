import { useEffect } from 'react';
import { ROUNDS } from '../../engine';
import { useStore } from '../../state/store';

/**
 * Offers to pick up a Quick or Practice game that a reload interrupted. Renders nothing when there
 * is no fresh save, so the start screen shows it unconditionally.
 */
export function ResumeBanner() {
  const resumable = useStore((s) => s.resumable);
  const ready = useStore((s) => s.dictStatus === 'ready');
  const refreshResume = useStore((s) => s.refreshResume);
  const resumeSaved = useStore((s) => s.resumeSaved);

  // The store reads the save once at startup. Check again whenever the menu appears and whenever the
  // tab comes back, so a save that has just expired disappears instead of leaving a dead button.
  useEffect(() => {
    refreshResume();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshResume();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshResume]);

  if (!resumable || !ready) return null;
  const { game, mode } = resumable;
  const me = game.players[0];
  return (
    <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-400/10 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-200">You have a game in progress</p>
      <p className="mt-1 text-sm text-white/80">
        {mode === 'practice' ? 'Practice' : 'Quick Game'} · round {game.round} of {ROUNDS} ·{' '}
        {game.players.length} players · {me.banked} banked
      </p>
      <button
        onClick={() => resumeSaved()}
        className="mt-2 min-h-12 w-full rounded-xl bg-amber-400 text-base font-black text-amber-950"
      >
        Resume your game
      </button>
    </div>
  );
}
