import { useEffect, useRef, useState } from 'react';
import { inStealWindow } from '../engine';
import { rejectMessage } from '../lib/messages';
import { useStore } from '../state/store';

export function InputBar() {
  const game = useStore((s) => s.game)!;
  const act = useStore((s) => s.act);
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  const suggest = useStore((s) => s.suggest);
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  // A suggested fix for a clear typo. Submitting the same text again accepts it; editing cancels it.
  const [fix, setFix] = useState<{ from: string; to: string } | null>(null);

  const playing = game.phase === 'playing' && !!game.turn;
  const myTurn = playing && game.turn!.seat === mySeat;
  // A frozen player (out of lives) can no longer steal, so they never get the steal prompt.
  const canSteal = stealOpen && !myTurn && !game.players[mySeat]?.frozen;
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

  const send = async (type: 'play' | 'steal') => {
    const typed = value.trim();
    if (!typed) return;
    const confirmed = fix !== null && typed.toLowerCase() === fix.from;
    const res = await act({ type, seat: mySeat, word: confirmed ? fix.to : typed });
    if (res?.suggestion) {
      setFix({ from: typed.toLowerCase(), to: res.suggestion });
      setHint('');
      return;
    }
    setFix(null);
    if (res?.reason) setHint(rejectMessage(res.reason, game.chainLetter));
    if (res?.accepted) setValue('');
  };

  const submit = () => {
    if (myTurn) void send('play');
    else if (canSteal) steal();
  };

  // A steal needs the word typed first, so an empty click does nothing.
  const steal = () => {
    if (!value.trim()) return setHint('Type your word first, then press STEAL.');
    void send('steal');
  };

  const onChange = (next: string) => {
    setValue(next);
    if (fix && next.trim().toLowerCase() !== fix.from) setFix(null);
  };

  const keep = (e: React.MouseEvent) => e.preventDefault(); // buttons never steal focus from the input
  const btn = 'min-h-12 rounded-xl px-3 text-sm font-black uppercase tracking-wide shadow disabled:opacity-35 sm:px-6 sm:text-base';

  return (
    <div className="px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-2xl">
        {fix && (
          <div
            role="status"
            className="mb-1 rounded-xl border-2 border-sky-300 bg-[#12214a] px-3 py-2 text-center"
            data-typo-fix
          >
            <div className="text-lg font-black tracking-wide">
              <span className="text-white/60">“{fix.from}”</span>
              <span className="mx-2" aria-hidden="true">→</span>
              <span className="text-sky-300">“{fix.to}”</span>
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">
              submit again to confirm · or edit
            </div>
          </div>
        )}
        <div className="h-5 text-center text-xs font-bold text-amber-300" role="status">
          {hint || (canSteal ? 'Steal window: type your word, then press STEAL.' : '')}
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
            onChange={(e) => onChange(e.target.value)}
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
              className={`${btn} animate-pulse bg-fuchsia-700 text-white`}
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
            onClick={() => void act({ type: 'bank', seat: mySeat })}
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
