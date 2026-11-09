import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { Board, Slate } from '../kit';
import { LedgerRow } from './Ledger';

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
  /** The turn length from this round on, for the round tally's line. */
  nextTurnSeconds?: number;
}

/**
 * The tally between rounds and at the end (V6 Part 6.3): a `Board panel` hung on two ropes with snow on it, swinging in
 * from above, the title carved on the plank and the standings chalked on a slate set into it (rows as in the barn
 * ledger: frozen sheep struck through, the winner's name ringed under a lantern ring).
 */
export function TallyBoard({ players, round, isGameEnd, winnerIds, longestWord, children, actions, maxLives = 3, nextTurnSeconds }: Props) {
  const rows = players; // already in standings order (rankPlayers): still standing first, then by how long they lasted
  const winners = new Set(winnerIds);
  const left = rows.filter((p) => !p.frozen).length;
  return (
    <Board
      size="panel" hang="ropes" snow id={isGameEnd ? 'tally-end' : `tally-${round}`} className="sk-tally w-full max-w-md"
      role={isGameEnd ? 'dialog' : 'status'} aria-modal={isGameEnd || undefined} aria-label={isGameEnd ? 'Game over' : `Round ${round} tally`}
    >
      <h2 className="sk-tally-title">
        {isGameEnd
          ? `${rows.find((p) => winners.has(p.id))?.name ?? rows[0].name} is the last sheep standing!`
          : `After round ${round}`}
      </h2>
      {!isGameEnd && (
        <p className="sk-tally-line">
          {left} sheep still standing.{nextTurnSeconds ? ` ${nextTurnSeconds}-second turns from here.` : ''}
        </p>
      )}
      {isGameEnd && longestWord && <p className="sk-tally-line">Longest word: {longestWord.word.toUpperCase()}</p>}
      <Slate size="board" className="sk-tally-slate">
        <ol>
          {rows.map((p, i) => (
            <LedgerRow key={p.id} player={p} place={i + 1} maxLives={maxLives} ringed={winners.has(p.id)} className={winners.has(p.id) ? 'sk-tally-winner' : undefined} />
          ))}
        </ol>
      </Slate>
      {children}
      {actions && <div className="sk-tally-actions">{actions}</div>}
    </Board>
  );
}
