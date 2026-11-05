import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { MessageView } from '../model/types';
import { BookIcon } from './Icons';
import { CoralButton, WoodButton } from './Materials';
import { MessageSlip } from './MessageSlip';

interface Props {
  letter: string;
  typed: string;
  /** Your turn (Play enabled). */
  myTurn: boolean;
  /** Another sheep's timer is red: you can steal. */
  stealOpen: boolean;
  /** Whose turn it is (for the "waiting" and "steal" lines). */
  turnName: string;
  onChange: (v: string) => void;
  /** Plays on your turn, steals in the red seconds. */
  onSubmit: () => void;
  message: MessageView | null;
  /** Practice and tutorial: a Hint book and its word ideas. */
  hints?: { ideas: string[]; onHint: () => void; onPick: (w: string) => void };
  /** Changes when the turn changes, to refocus the input. */
  turnKey: number | undefined;
  /** Changes each time one of your words is accepted: the strip flashes. */
  acceptKey: number;
  /** You are out (frozen): the strip says so and takes no input. */
  out: boolean;
}

const keep = (e: MouseEvent) => e.preventDefault(); // buttons never steal focus from the input

/**
 * The word bar: the starting letter on a big tile, a roomy field, and one button that is Play on your turn and Steal
 * (red, glowing) when another sheep's timer goes red. A line above says what you can do right now.
 */
export function InputStrip({ letter, typed, myTurn, stealOpen, turnName, onChange, onSubmit, message, hints, turnKey, acceptKey, out }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [turnKey]);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!acceptKey) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 650);
    return () => clearTimeout(id);
  }, [acceptKey]);
  const L = letter.toUpperCase();
  const letters = [...typed.trim()];
  // Tiles shrink as the word grows, so even a long word fits on one row.
  const size = letters.length <= 9 ? 'lg' : letters.length <= 13 ? 'md' : 'sm';
  const mode = out ? 'out' : myTurn ? 'mine' : stealOpen ? 'steal' : 'wait';
  const prompt = {
    mine: <>Your turn: type a word starting with <b>{L}</b> and press Enter</>,
    steal: <><b>STEAL!</b> {turnName}’s time is running out. Type a word starting with <b>{L}</b> first to take one of their wool balls</>,
    wait: <>{turnName}’s turn. When their timer turns <b style={{ color: 'var(--coral-dark)' }}>red</b>, you can steal a wool ball</>,
    out: <>You’re frozen solid: out of wool. Watch who’s the last sheep standing</>,
  }[mode];
  const placeholder = { mine: `a word starting with ${L}`, steal: `quick, a ${L}-word!`, wait: 'type ahead…', out: '' }[mode];
  return (
    <div className="px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <MessageSlip message={message} />
        {hints && hints.ideas.length > 0 && (
          <div className="sk-paper sk-pop mb-1 flex flex-wrap items-center justify-center gap-1.5 px-3 py-2" aria-label="Word ideas">
            <span className="sk-hand flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}><BookIcon size={18} /> try:</span>
            {hints.ideas.map((w) => (
              <button key={w} onMouseDown={keep} onClick={() => hints.onPick(w)} className="sk-chip uppercase">{w}</button>
            ))}
          </div>
        )}
        <p className={`sk-input-prompt ${mode === 'steal' ? 'sk-input-prompt-steal' : ''}`} aria-live="polite" data-mode={mode}>{prompt}</p>
        <div className={`sk-input-bar ${flash ? 'sk-accept-flash' : ''}`} data-mode={mode} data-tour="input">
          <span className="sk-input-letter" aria-hidden="true" title="Starts with">{L}</span>
          {/* What you type is laid out as wooden letter tiles, like a word on a board. The real input sits on top,
              invisible, so typing, pasting and phone keyboards all work as usual. */}
          <div className="sk-input-tiles" data-size={size} onMouseDown={(e) => { e.preventDefault(); ref.current?.focus(); }}>
            {letters.length ? letters.map((ch, i) => (
              <span key={i} className="sk-type-tile" data-first={i === 0 ? (ch.toLowerCase() === letter.toLowerCase() ? 'ok' : 'bad') : undefined}>{ch.toUpperCase()}</span>
            )) : <span className="sk-input-placeholder">{placeholder}</span>}
            {!out && <span className="sk-type-caret" aria-hidden="true" />}
            <input
              ref={ref}
              value={typed}
              disabled={out}
              onChange={(e) => onChange(e.target.value.replace(/[^a-zA-Z]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
              onBlur={(e) => {
                if (!e.relatedTarget) requestAnimationFrame(() => ref.current?.focus());
              }}
              autoFocus
              autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
              enterKeyHint="send" maxLength={30}
              aria-label={`Type a word starting with ${L}`}
              className="sk-input-ghost"
            />
          </div>
          {hints && (
            <WoodButton onMouseDown={keep} onClick={hints.onHint} disabled={!myTurn && !stealOpen} aria-label="Hint" className="sk-input-hint"><BookIcon size={24} /></WoodButton>
          )}
          {mode === 'steal' ? (
            <CoralButton onMouseDown={keep} onClick={onSubmit} data-tour="steal" className="sk-halo sk-input-go uppercase">Steal</CoralButton>
          ) : (
            <WoodButton onMouseDown={keep} onClick={onSubmit} disabled={!myTurn} className="sk-input-go">Play</WoodButton>
          )}
        </div>
      </div>
    </div>
  );
}
