import { HintIcon } from './PixelIcons';
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { MessageView } from '../model/types';
import { ClothButton, CoralButton, WoodButton } from './Materials';
import { MessageSlip } from './MessageSlip';

interface Props {
  letter: string;
  typed: string;
  /** Your turn (Play enabled). */
  myTurn: boolean;
  /** Another player's steal window is open. */
  stealOpen: boolean;
  onChange: (v: string) => void;
  onPlay: () => void;
  onBank: () => void;
  onSteal: () => void;
  pile: number;
  message: MessageView | null;
  /** Practice and tutorial: a Hint book and its word ideas. */
  hints?: { ideas: string[]; onHint: () => void; onPick: (w: string) => void };
  /** Changes when the turn changes, to refocus the input. */
  turnKey: number | undefined;
}

const keep = (e: MouseEvent) => e.preventDefault(); // buttons never steal focus from the input

/** Paper field with the starting letter printed in front, Play (wood), Bank (cloth) and, in the window, Steal (coral). */
export function InputStrip({ letter, typed, myTurn, stealOpen, onChange, onPlay, onBank, onSteal, pile, message, hints, turnKey }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [turnKey]);
  const L = letter.toUpperCase();
  return (
    <div className="px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <MessageSlip message={message} />
        {hints && hints.ideas.length > 0 && (
          <div className="sk-paper sk-pop mb-1 flex flex-wrap items-center justify-center gap-1.5 px-3 py-2" aria-label="Word ideas">
            <span className="sk-hand" style={{ color: 'var(--ink-soft)' }}><HintIcon size={16} /></span>
            {hints.ideas.map((w) => (
              <button key={w} onMouseDown={keep} onClick={() => hints.onPick(w)} className="sk-chip uppercase">{w}</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap" data-tour="input">
          <label className="sk-paper flex min-h-11 min-w-0 flex-1 basis-full items-center gap-2 px-3 sm:basis-auto">
            <span className="sk-display text-2xl" style={{ color: 'var(--wood-ink)' }} aria-hidden="true">{L}</span>
            <input
              ref={ref}
              value={typed}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (myTurn) onPlay();
                else if (stealOpen) onSteal();
              }}
              onBlur={(e) => {
                if (!e.relatedTarget) requestAnimationFrame(() => ref.current?.focus());
              }}
              autoFocus
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              enterKeyHint="send" maxLength={30}
              aria-label={`Type a word starting with ${L}`}
              placeholder={myTurn ? `Type a word starting with ${L}` : 'Type ahead…'}
              className="min-w-0 flex-1 bg-transparent text-lg font-extrabold lowercase outline-none placeholder:normal-case"
              style={{ color: 'var(--ink)', caretColor: 'var(--amber)' }}
            />
          </label>
          {stealOpen ? (
            <CoralButton onMouseDown={keep} onClick={onSteal} data-tour="steal" className="sk-halo flex-1 uppercase sm:flex-none">
              {typed.trim() ? `Steal with ${typed.trim().toUpperCase()}` : 'Steal'}
            </CoralButton>
          ) : (
            <WoodButton onMouseDown={keep} onClick={onPlay} disabled={!myTurn} className="flex-1 sm:flex-none">Play</WoodButton>
          )}
          {hints && (
            <WoodButton onMouseDown={keep} onClick={hints.onHint} disabled={!myTurn && !stealOpen} aria-label="Hint" className="px-3"><HintIcon size={16} /></WoodButton>
          )}
          <ClothButton onMouseDown={keep} onClick={onBank} disabled={!myTurn} data-tour="bank" className="flex-1 sm:flex-none">
            Bank <span className="sk-num">{pile}</span>
          </ClothButton>
        </div>
      </div>
    </div>
  );
}
