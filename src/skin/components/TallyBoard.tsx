import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { Creature } from './Creature';

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
}

/** Wooden board with every player's banked total; rows light one by one; the winner glows. */
export function TallyBoard({ players, round, isGameEnd, winnerIds, longestWord, children, actions }: Props) {
  const rows = players; // already in standings order (rankPlayers), so ties follow the engine's tie-break
  const tie = isGameEnd && rows.length > 1 && rows[0].banked === rows[1].banked;
  const winners = new Set(winnerIds);
  return (
    <div
      className="sk-pop w-full max-w-md rounded-2xl p-3"
      style={{ background: 'var(--wood-dark)', boxShadow: 'inset 0 4px 0 var(--wood), var(--shadow-warm)' }}
      role={isGameEnd ? 'dialog' : 'status'} aria-modal={isGameEnd || undefined} aria-label={isGameEnd ? 'Game over' : `Round ${round} tally`}
    >
      <h2 className="sk-display text-center text-2xl" style={{ color: 'var(--button-text)' }}>
        {isGameEnd ? (winners.size > 1 ? 'A shared win!' : `${rows.find((p) => winners.has(p.id))?.name ?? rows[0].name} wins!`) : `After round ${round}`}
      </h2>
      {tie && longestWord && (
        <p className="sk-hand mt-1 text-center" style={{ color: 'var(--glow)' }}>
          Tie broken by the longest word: {longestWord.word.toUpperCase()}
        </p>
      )}
      <ol className="mt-2 space-y-1.5">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className="sk-paper sk-pop flex items-center gap-2 px-3 py-1.5"
            style={{
              animationDelay: `${i * 120}ms`,
              boxShadow: winners.has(p.id) ? '0 0 0 3px var(--amber), 0 0 22px var(--glow)' : undefined,
            }}
          >
            <span className="sk-display w-5 text-center">{i + 1}</span>
            {p.creature && <Creature id={p.creature} size={26} />}
            <span className="min-w-0 flex-1 truncate font-extrabold">{p.name}{p.isYou ? ' (you)' : ''}</span>
            <span className="sk-display text-xl">{p.banked}</span>
          </li>
        ))}
      </ol>
      {children}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
