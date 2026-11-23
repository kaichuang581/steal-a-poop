import { useEffect, useState } from 'react';
import type { GameState } from '../../engine';
import { markTipSeen, tipSeen } from '../../lib/tips';
import { useStore } from '../../state/store';

interface Tip { id: string; title: string; text: (g: GameState) => string; when: (g: GameState) => boolean }

/**
 * The game's first-time tips, the painted copy of src/ui/CoachTips.tsx (fenced): the same tips, ids and seen-store
 * (lib/tips), so a tip seen in either look is seen in both. Its label is the tip's name alone: the classic "Tip · Wool
 * balls" broke Brian's no-middle-dot rule. Dressed by hud-overlays.css (the `coach-tip` classes).
 */
const TIPS: Tip[] = [
  {
    id: 'modifier', title: 'Round twist',
    text: () => 'The rule beside the letter is this round’s twist. Words that break it bounce.',
    when: (g) => g.phase === 'playing' && g.modifier !== 'none',
  },
  {
    id: 'wool', title: 'Wool balls',
    text: () => 'Running out of time costs a wool ball. Lose them all and that sheep freezes solid. Last sheep standing wins.',
    when: (g) => g.events.some((e) => e.kind === 'lifeLost'),
  },
];

export function GameTips() {
  const game = useStore((s) => s.game)!;
  const [current, setCurrent] = useState<{ id: string; title: string; text: string } | null>(null);

  useEffect(() => {
    if (current || game.phase !== 'playing') return;
    const tip = TIPS.find((t) => !tipSeen(t.id) && t.when(game));
    if (!tip) return;
    markTipSeen(tip.id);
    setCurrent({ id: tip.id, title: tip.title, text: tip.text(game) });
  }, [game, current]);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), 9000);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-3 sm:bottom-28 sm:justify-start sm:px-4">
      <div className="coach-tip pointer-events-auto flex max-w-md items-start gap-3" role="status">
        <div className="min-w-0">
          <div className="coach-tip-label">{current.title}</div>
          <p className="coach-tip-text">{current.text}</p>
        </div>
        <button type="button" onClick={() => setCurrent(null)} className="coach-tip-btn">Got it</button>
      </div>
    </div>
  );
}
