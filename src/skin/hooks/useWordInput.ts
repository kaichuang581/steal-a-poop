import { useEffect, useState } from 'react';
import { inStealWindow } from '../../engine';
import { rejectMessage } from '../../lib/messages';
import { useStore } from '../../state/store';
import type { MessageView } from '../model/types';

/**
 * The classic InputBar's behaviour, kept as local state the same way: typed text, the typo fix (submit the same text
 * again to confirm, edit to cancel), rejection messages, and tutorial hints. Calls only the store's existing act().
 */
export function useWordInput() {
  const game = useStore((s) => s.game)!;
  const act = useStore((s) => s.act);
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  const suggest = useStore((s) => s.suggest);
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [fix, setFix] = useState<{ from: string; to: string } | null>(null);
  // Bumps on every accepted word of yours, for the bar's flash.
  const [acceptKey, setAcceptKey] = useState(0);

  const playing = game.phase === 'playing' && !!game.turn;
  const myTurn = playing && game.turn!.seat === mySeat;
  // A frozen player (out of lives) can no longer steal, so they never get the steal prompt.
  const canSteal = stealOpen && !myTurn && !game.players[mySeat]?.frozen;
  const learning = mode === 'tour';

  useEffect(() => setIdeas([]), [game.turn?.seat]);
  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(''), 2500);
    return () => clearTimeout(id);
  }, [hint]);

  const send = async (type: 'play' | 'steal') => {
    const word = typed.trim();
    if (!word) return;
    const confirmed = fix !== null && word.toLowerCase() === fix.from;
    const res = await act({ type, seat: mySeat, word: confirmed ? fix.to : word });
    if (res?.suggestion) {
      setFix({ from: word.toLowerCase(), to: res.suggestion });
      setHint('');
      return;
    }
    setFix(null);
    if (res?.reason) setHint(rejectMessage(res.reason, game.chainLetter));
    if (res?.accepted) {
      setTyped('');
      if (!res.reason) setAcceptKey((k) => k + 1);
    }
  };
  const steal = () => {
    if (!typed.trim()) return setHint(`Type a word starting with ${game.chainLetter.toUpperCase()} first.`);
    void send('steal');
  };
  const submit = () => {
    if (myTurn) void send('play');
    else if (canSteal) steal();
  };
  const onChange = (next: string) => {
    setTyped(next);
    if (fix && next.trim().toLowerCase() !== fix.from) setFix(null);
  };

  const message: MessageView | null = fix
    ? { kind: 'typo', text: fix.from, fix: fix.to }
    : hint
      ? { kind: 'invalid', text: hint }
      : null;

  return {
    game, typed, onChange, submit, steal, message, ideas, learning, myTurn, canSteal, acceptKey,
    hintIdeas: () => setIdeas(suggest(3)),
    useIdea: (w: string) => setTyped(w),
  };
}
