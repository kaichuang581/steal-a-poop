import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { MessageView } from '../model/types';
import { BookIcon } from './Icons';
import { Paper, Peg, Tile } from '../kit';
import { PassIcon } from './PixelIcons';
import { MessageSlip } from './MessageSlip';

interface Props {
  letter: string;
  typed: string;
  /** Your turn (Play enabled). */
  myTurn: boolean;
  /** Whose turn it is (for the "waiting" line). */
  turnName: string;
  onChange: (v: string) => void;
  /** Plays your word on your turn. */
  onSubmit: () => void;
  message: MessageView | null;
  /** Tutorial: a Hint book and its word ideas. */
  hints?: { ideas: string[]; onHint: () => void; onPick: (w: string) => void };
  /** Changes when the turn changes, to refocus the input. */
  turnKey: number | undefined;
  /** Changes each time one of your words is accepted: the strip flashes. */
  acceptKey: number;
  /** You are out (frozen): the strip says so and takes no input. */
  out: boolean;
  /** Hand the bomb to the next sheep; only given when you can pass this round. */
  onPass?: () => void;
}

const keep = (e: MouseEvent) => e.preventDefault(); // buttons never take focus from the input

/**
 * The word bar: floating letters (chosen from the mockups, 2026-11-07). What the word needs on a line above (it starts
 * with the chain letter), the typed word in big white letters floating over the barn with a warm glow, a dotted line
 * under it, and a small key that is Play on your turn.
 */
export function InputStrip({ letter, typed, myTurn, turnName, onChange, onSubmit, message, hints, turnKey, acceptKey, out, onPass }: Props) {
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
  const mode = out ? 'out' : myTurn ? 'mine' : 'wait';
  const prompt = {
    mine: <>Your turn: type a word starting with <b>{L}</b> and press Enter</>,
    wait: <>{turnName}’s turn. Get ready</>,
    out: <>You’re frozen solid: out of wool. Watch who’s the last sheep standing</>,
  }[mode];
  return (
    <div className="px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4">
      <div className="mx-auto max-w-3xl">
        <MessageSlip message={message} />
        {hints && hints.ideas.length > 0 && (
          <Paper kind="note" pin="top" className="sk-pop sk-ideas" aria-label="Word ideas">
            <span className="flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}><BookIcon size={18} /> try:</span>
            {hints.ideas.map((w) => (
              <button key={w} onMouseDown={keep} onClick={() => hints.onPick(w)} className="sk-idea" aria-label={w}>
                {[...w].map((ch, i) => <Tile key={i} size="mini">{ch.toUpperCase()}</Tile>)}
              </button>
            ))}
          </Paper>
        )}
        {/* On your own turn the line under it already says it all; the prompt stays for the screen reader. */}
        <p className={`sk-input-prompt ${mode === 'mine' ? 'sr-only' : ''}`} aria-live="polite" data-mode={mode}>{prompt}</p>
        {/* The word itself shows in the speech bubble over your sheep (PaintedGame's name plates); down here is one quiet
            row: the letter it starts with, the hint and pass pegs, and Enter's key. The real input sits over the row,
            invisible, so typing, pasting and phone keyboards all work as usual. */}
        <div className={`sk-input-bar sk-input-row ${flash ? 'sk-accept-flash' : ''}`} data-mode={mode} data-tour="input"
          onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); ref.current?.focus(); } }}>
          <p className="sk-input-need" data-tour="chain" aria-label={`Starts with ${L}`}>
            <small>starts with</small>
            <span className="sk-input-letter" title="Starts with">{L}</span>
          </p>
          <div className="sk-input-field-wrap">
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
          <div className="sk-input-keys">
            {onPass && myTurn && (
              <Peg small light onMouseDown={keep} onClick={onPass} aria-label="Pass the bomb" title="Pass the bomb" className="sk-input-hint"><PassIcon size={20} /></Peg>
            )}
            {hints && (
              <Peg small light onMouseDown={keep} onClick={hints.onHint} disabled={!myTurn} aria-label="Hint" className="sk-input-hint"><BookIcon size={20} /></Peg>
            )}
            <button type="button" onMouseDown={keep} onClick={onSubmit} disabled={!myTurn} className="kit-float-go sk-input-go" aria-label="Play"><b>Enter</b> to play</button>
          </div>
        </div>
      </div>
    </div>
  );
}
