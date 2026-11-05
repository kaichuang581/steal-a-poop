import { useEffect, useState } from 'react';
import { inStealWindow } from '../engine';
import type { GameState } from '../engine';
import { markTipSeen, tipSeen } from '../lib/tips';
import { useStore } from '../state/store';

interface Tip { id: string; title: string; text: (g: GameState) => string; when: (g: GameState, stealOpen: boolean) => boolean }

/** First-time explanations, shown once each, in priority order. */
const TIPS: Tip[] = [
  {
    id: 'modifier', title: 'Round twist',
    text: () => 'The banner up top is this round’s twist. Words that break it bounce.',
    when: (g) => g.phase === 'playing' && g.modifier !== 'none',
  },
  {
    id: 'steal', title: 'Steal!',
    text: () => 'Their timer is red. Type a word starting with the chain letter and press STEAL: the first good word takes one of their wool balls. A bad word costs nothing.',
    when: (g, open) => open && g.turn?.seat !== 0 && !g.players[0]?.frozen,
  },
  {
    id: 'trap', title: 'Trap letter',
    text: (g) => {
      const t = g.trap!;
      return `${g.players[t.trapperSeat].name} ended on “${t.letter.toUpperCase()}”. If ${g.players[t.victimSeat].name} runs out of time, ${g.players[t.trapperSeat].name} gets a wool ball.`;
    },
    when: (g) => g.trap !== null,
  },
  {
    id: 'wool', title: 'Wool balls',
    text: () => 'Running out of time costs a wool ball. Lose them all and that sheep freezes solid. Last sheep standing wins.',
    when: (g) => g.events.some((e) => e.kind === 'lifeLost'),
  },
];

export function CoachTips() {
  const game = useStore((s) => s.game)!;
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const [current, setCurrent] = useState<{ id: string; title: string; text: string } | null>(null);

  useEffect(() => {
    if (current || game.phase !== 'playing') return;
    const tip = TIPS.find((t) => !tipSeen(t.id) && t.when(game, stealOpen));
    if (!tip) return;
    markTipSeen(tip.id);
    setCurrent({ id: tip.id, title: tip.title, text: tip.text(game) });
  }, [game, stealOpen, current]);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setCurrent(null), 9000);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-3 sm:bottom-28 sm:justify-start sm:px-4">
      <div className="coach-tip pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border-2 border-sky-300 bg-[#12214a] p-3 shadow-xl" role="status">
        <div className="min-w-0">
          <div className="coach-tip-label text-xs font-bold uppercase tracking-widest text-sky-300">Tip · {current.title}</div>
          <p className="coach-tip-text text-sm text-white/90">{current.text}</p>
        </div>
        <button onClick={() => setCurrent(null)} className="coach-tip-btn min-h-11 shrink-0 rounded-lg bg-white/10 px-3 text-sm font-bold">Got it</button>
      </div>
    </div>
  );
}
