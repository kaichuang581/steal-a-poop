import { useEffect, useRef, useState } from 'react';
import { inStealWindow } from '../engine';
import { rejectMessage } from '../lib/messages';
import { useStore } from '../state/store';

export function InputBar() {
  const game = useStore((s) => s.game)!;
  const act = useStore((s) => s.act);
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');

  const me = game.players[0];
  const playing = game.phase === 'playing' && !!game.turn;
  const myTurn = playing && game.turn!.seat === 0;
  const claimed = playing && game.turn!.claims.includes(0);
  const canSteal = stealOpen && !myTurn && (claimed || me.tokens > 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, [game.turn?.seat]);

  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(''), 2500);
    return () => clearTimeout(id);
  }, [hint]);

  const submit = () => {
    const word = value.trim();
    if (myTurn) {
      if (!word) return;
      const res = act({ type: 'play', seat: 0, word });
      if (res?.reason) setHint(rejectMessage(res.reason, game.chainLetter));
      setValue('');
    } else if (stealOpen) {
      steal();
    }
  };

  const steal = () => {
    if (!claimed) {
      const res = act({ type: 'stealClaim', seat: 0 });
      if (!res?.accepted) return setHint(rejectMessage(res?.reason, game.chainLetter));
      if (!value.trim()) return setHint('Steal armed: type a word and press Enter.');
    } else if (!value.trim()) {
      return setHint('Type a word to complete the steal.');
    }
    const res = act({ type: 'stealSubmit', seat: 0, word: value });
    if (res?.reason) setHint(rejectMessage(res.reason, game.chainLetter));
    setValue('');
  };

  const keep = (e: React.MouseEvent) => e.preventDefault(); // buttons never steal focus from the input
  const btn = 'min-h-12 rounded-xl px-4 text-base font-black uppercase tracking-wide shadow disabled:opacity-35 sm:px-6';

  return (
    <div className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-2xl">
        <div className="h-5 text-center text-xs font-bold text-amber-300" role="status">
          {hint || (claimed ? 'Steal armed. Type a word and press Enter!' : '')}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            onBlur={(e) => {
              if (!e.relatedTarget) requestAnimationFrame(() => inputRef.current?.focus());
            }}
            autoFocus
            autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
            enterKeyHint="send"
            maxLength={30}
            aria-label={`Type a word starting with ${game.chainLetter.toUpperCase()}`}
            placeholder={myTurn ? `Word starting with ${game.chainLetter.toUpperCase()}…` : 'Type ahead…'}
            className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-white/20 bg-black/40 px-4 text-lg font-bold lowercase placeholder:normal-case placeholder:text-white/35 focus:border-amber-300 focus:outline-none"
          />
          {canSteal ? (
            <button
              onMouseDown={keep} onClick={steal}
              className={`${btn} animate-pulse bg-fuchsia-500 text-white`}
            >
              {claimed ? 'Steal!' : 'Steal'}
            </button>
          ) : (
            <button onMouseDown={keep} onClick={submit} disabled={!myTurn} className={`${btn} bg-emerald-500 text-emerald-950`}>
              Play
            </button>
          )}
          <button
            onMouseDown={keep}
            onClick={() => act({ type: 'bank', seat: 0 })}
            disabled={!myTurn}
            className={`${btn} bg-amber-400 text-amber-950`}
          >
            Bank <span className="tabular-nums">{game.pile}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
