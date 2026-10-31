import { useEffect, useState } from 'react';
import { inStealWindow } from '../engine';
import type { GameState } from '../engine';
import { markTipSeen, tipSeen } from '../lib/tips';
import { useStore } from '../state/store';

interface Tip { id: string; title: string; text: (g: GameState) => string; when: (g: GameState, stealOpen: boolean) => boolean }

/** First-time explanations, shown once each, in priority order. */
const TIPS: Tip[] = [
  {
    id: 'modifier', title: 'Round modifier',
    text: () => 'The banner up top is this round’s special rule. Words that break it are rejected.',
    when: (g) => g.phase === 'playing' && g.round === 1,
  },
  {
    id: 'pile', title: 'The pile',
    text: () => 'The pile is shared. Plays grow it; BANK on your turn takes all of it. Unbanked pile burns at round end, and a big pile shortens everyone’s timer.',
    when: (g) => g.pile > 0,
  },
  {
    id: 'steal', title: 'Steal window',
    text: () => 'You are in the steal window. Type a valid word and press STEAL to take their turn and the whole pile. Steals are unlimited.',
    when: (g, open) => open && g.turn?.seat !== 0,
  },
  {
    id: 'trap', title: 'Trap letter',
    text: (g) => {
      const t = g.trap!;
      return `${g.players[t.trapperSeat].name} ended on “${t.letter.toUpperCase()}”. If ${g.players[t.victimSeat].name} times out or plays an invalid word, ${g.players[t.trapperSeat].name} gets +5.`;
    },
    when: (g) => g.trap !== null,
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
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border-2 border-sky-300 bg-[#12214a] p-3 shadow-xl" role="status">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300">Tip · {current.title}</div>
          <p className="text-sm text-white/90">{current.text}</p>
        </div>
        <button onClick={() => setCurrent(null)} className="min-h-11 shrink-0 rounded-lg bg-white/10 px-3 text-sm font-bold">Got it</button>
      </div>
    </div>
  );
}
