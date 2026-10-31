import { useEffect, useRef, useState } from 'react';
import { inStealWindow } from '../engine';
import { rejectMessage } from '../lib/messages';
import { useStore } from '../state/store';

export function InputBar() {
  const game = useStore((s) => s.game)!;
  const act = useStore((s) => s.act);
  const mode = useStore((s) => s.mode);
  const suggest = useStore((s) => s.suggest);
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);

  const playing = game.phase === 'playing' && !!game.turn;
  const myTurn = playing && game.turn!.seat === 0;
  const canSteal = stealOpen && !myTurn;
  const learning = mode === 'practice' || mode === 'tour';

  useEffect(() => {
    inputRef.current?.focus();
    setIdeas([]);
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
      if (res?.accepted) setValue('');
    } else if (stealOpen) {
      steal();
    }
  };

  // A steal needs the word typed first, so an empty click does nothing.
  const steal = () => {
    if (!value.trim()) return setHint('Type your word first, then press STEAL.');
    const res = act({ type: 'steal', seat: 0, word: value });
    if (res?.reason) setHint(rejectMessage(res.reason, game.chainLetter));
    if (res?.accepted) setValue('');
  };

  const keep = (e: React.MouseEvent) => e.preventDefault(); // buttons never steal focus from the input
  const btn = 'min-h-12 rounded-xl px-3 text-sm font-black uppercase tracking-wide shadow disabled:opacity-35 sm:px-6 sm:text-base';

  return (
    <div className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-2xl">
        <div className="h-5 text-center text-xs font-bold text-amber-300" role="status">
          {hint || (stealOpen && !myTurn ? 'Steal window: type your word, then press STEAL.' : '')}
        </div>
        {learning && ideas.length > 0 && (
          <div className="mb-1 flex flex-wrap items-center justify-center gap-1.5" aria-label="Word ideas">
            {ideas.map((w) => (
              <button
                key={w} onMouseDown={keep} onClick={() => setValue(w)}
                className="min-h-11 rounded-lg bg-sky-500/30 px-3 text-sm font-bold uppercase tracking-wide hover:bg-sky-500/50"
              >
                {w}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2" data-tour="input">
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
              onMouseDown={keep} onClick={steal} data-tour="steal"
              className={`${btn} animate-pulse bg-fuchsia-500 text-white`}
            >
              Steal
            </button>
          ) : (
            <button onMouseDown={keep} onClick={submit} disabled={!myTurn} className={`${btn} bg-emerald-500 text-emerald-950`}>
              Play
            </button>
          )}
          {learning && (
            <button
              onMouseDown={keep} onClick={() => setIdeas(suggest(3))}
              disabled={!myTurn && !canSteal}
              className={`${btn} min-w-12 bg-sky-500 text-sky-950`}
              aria-label="Hint"
            >
              <span className="sm:hidden" aria-hidden="true">💡</span>
              <span className="hidden sm:inline">Hint</span>
            </button>
          )}
          <button
            onMouseDown={keep} data-tour="bank"
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
