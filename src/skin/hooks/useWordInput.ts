import { useEffect, useState } from 'react';
import { rejectMessage } from '../../lib/messages';
import { useStore } from '../../state/store';
import type { MessageView } from '../model/types';
import { fuseLit } from '../model/turnClock';
import { everydayIdeas } from '../tour/ideas';

/**
 * The classic InputBar's behaviour, kept as local state the same way: typed text, the typo fix (submit the same text
 * again to confirm, edit to cancel), rejection messages, and tutorial hints. Calls only the store's existing act().
 */
export function useWordInput() {
  const game = useStore((s) => s.game)!;
  const act = useStore((s) => s.act);
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  // Whether the fuse is lit, not the clock itself: the clock moves every frame and would render the table every frame.
  const lit = useStore(fuseLit);
  const suggest = useStore((s) => s.suggest);
  const dict = useStore((s) => s.dict);
  const [typed, setTyped] = useState('');
  const [hint, setHint] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [fix, setFix] = useState<{ from: string; to: string } | null>(null);
  // Bumps on every accepted word of yours, for the bar's flash.
  const [acceptKey, setAcceptKey] = useState(0);
  // The last word sent back and why (the engine's reason), for Practice's coach to say so.
  const [reject, setReject] = useState<{ reason: string; word: string; key: number } | null>(null);

  const playing = game.phase === 'playing' && !!game.turn;
  // Yours once your fuse is lit: in the beat after a bomb has gone off a word can be typed ahead, not sent.
  const myTurn = playing && game.turn!.seat === mySeat && lit;
  const learning = mode === 'tour';

  useEffect(() => setIdeas([]), [game.turn?.seat]);
  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(''), 2500);
    return () => clearTimeout(id);
  }, [hint]);

  const send = async (type: 'play') => {
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
    if (res?.reason) { setHint(rejectMessage(res.reason, game.chainLetter)); if (!res.accepted) setReject({ reason: res.reason, word, key: Date.now() }); }
    if (res?.accepted) {
      setTyped('');
      if (!res.reason) setAcceptKey((k) => k + 1);
    }
  };
  const submit = () => {
    if (myTurn) void send('play');
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
    game, typed, onChange, submit, message, ideas, learning, myTurn, acceptKey, reject,
    // Everyday words when the tutorial has its list in (tour/ideas.ts); the engine's picker until then.
    hintIdeas: () => setIdeas((dict && everydayIdeas(dict, game, 3)) || suggest(3)),
    useIdea: (w: string) => setTyped(w),
  };
}
