import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { IceOverlay, Lives } from './Lives';
import { SnowCap } from './SnowCap';
import { SheepIcon } from './SheepIcon';

interface Props {
  players: PlayerView[];
  round: number;
  isGameEnd: boolean;
  winnerIds?: string[];
  longestWord?: { word: string; playerId: string };
  /** Extra lines under the rows (stats, notes). */
  children?: ReactNode;
  /** Buttons row. */
  actions?: ReactNode;
  /** Wool balls each sheep started with. */
  maxLives?: number;
}

/** Wooden board with every sheep's wool balls, in standings order; frozen sheep under ice; the last one standing glows. */
export function TallyBoard({ players, round, isGameEnd, winnerIds, longestWord, children, actions, maxLives = 3 }: Props) {
  const rows = players; // already in standings order (rankPlayers): still standing first, then by how long they lasted
  const winners = new Set(winnerIds);
  const left = rows.filter((p) => !p.frozen).length;
  return (
    <div
      className="sk-pop sk-tally relative w-full max-w-md p-4 pt-5"
      role={isGameEnd ? 'dialog' : 'status'} aria-modal={isGameEnd || undefined} aria-label={isGameEnd ? 'Game over' : `Round ${round} tally`}
    >
      <SnowCap className="sk-tally-snow" />
      <span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" /><span className="sk-nail sk-nail-bl" /><span className="sk-nail sk-nail-br" />
      <h2 className="sk-tally-title">
        {isGameEnd
          ? `${rows.find((p) => winners.has(p.id))?.name ?? rows[0].name} is the last sheep standing!`
          : `After round ${round}`}
      </h2>
      {!isGameEnd && (
        <p className="sk-hand mt-1 text-center" style={{ color: 'var(--glow)' }}>
          {left} sheep still standing. Turns get faster now.
        </p>
      )}
      {isGameEnd && longestWord && (
        <p className="sk-hand mt-1 text-center" style={{ color: 'var(--glow)' }}>
          Longest word: {longestWord.word.toUpperCase()}
        </p>
      )}
      <ol className="mt-2 space-y-1.5">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className="sk-paper sk-pop relative flex items-center gap-2 px-3 py-1.5"
            style={{
              animationDelay: `${i * 120}ms`,
              boxShadow: winners.has(p.id) ? '0 0 0 3px var(--amber), 0 0 22px var(--glow)' : undefined,
            }}
          >
            <span className="sk-display w-5 text-center">{i + 1}</span>
            <SheepIcon size={24} bare={p.lives <= 1} />
            <span className="min-w-0 flex-1 truncate font-extrabold">{p.name}{p.isYou ? ' (you)' : ''}</span>
            {p.frozen ? <span className="sk-hand text-sm" style={{ color: 'var(--ink-soft)' }}>out</span> : <Lives lives={p.lives} max={maxLives} size={18} />}
            {p.frozen && <IceOverlay />}
          </li>
        ))}
      </ol>
      {children}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
