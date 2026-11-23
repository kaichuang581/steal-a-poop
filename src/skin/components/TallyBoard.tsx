import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { BoardFrame, SnowCap } from '../kit/surfaces';
import '../kit/modern.css';
import { LedgerRow } from './Ledger';
import './hud-boards.css';

interface Props {
  players: PlayerView[];
  round: number;
  isGameEnd: boolean;
  winnerIds?: string[];
  longestWord?: { word: string; playerId: string };
  /** Extra lines under the rows (stats, notes). */
  children?: ReactNode;
  /** Buttons row: `Slab`s from kit/modern, the main one lantern. */
  actions?: ReactNode;
  /** Wool balls each sheep started with. */
  maxLives?: number;
  /** The turn length from this round on, for the round tally's line. */
  nextTurnSeconds?: number;
}

/**
 * The tally between rounds and at the end: the modern kit's dialog board (felt, inner frame, snow with icicles; the
 * `Dialog` recipe, kept as markup here because the round's tally is a status, not a modal), a title in Fraunces and the
 * standings as the scoreboard's tiles (the winner's with the lantern bar, frozen sheep sunk into the board).
 */
export function TallyBoard({ players, round, isGameEnd, winnerIds, longestWord, children, actions, maxLives = 3, nextTurnSeconds }: Props) {
  const rows = players; // already in standings order (rankPlayers): still standing first, then by how long they lasted
  const winners = new Set(winnerIds);
  const left = rows.filter((p) => !p.frozen).length;
  return (
    <div
      id={isGameEnd ? 'tally-end' : `tally-${round}`} className="md-dialog hm rc hb rc-board hb-tally"
      role={isGameEnd ? 'dialog' : 'status'} aria-modal={isGameEnd || undefined} aria-label={isGameEnd ? 'Game over' : `Round ${round} tally`}
    >
      <BoardFrame corners={['bl', 'br']} />
      <SnowCap icicles />
      <header className="md-dialog-head">
        <h2>
          {isGameEnd
            ? `${rows.find((p) => winners.has(p.id))?.name ?? rows[0].name} is the last sheep standing!`
            : `After round ${round}`}
        </h2>
      </header>
      <div className="md-dialog-body">
        {!isGameEnd && (
          <p className="hb-tally-line">
            <b>{left}</b> sheep still standing.{nextTurnSeconds ? <> <b>{nextTurnSeconds}</b>-second turns from here.</> : ''}
          </p>
        )}
        {isGameEnd && longestWord && <p className="hb-tally-line">Longest word: <b>{longestWord.word.toUpperCase()}</b></p>}
        <ol className="hb-rows">
          {rows.map((p, i) => <LedgerRow key={p.id} player={p} place={i + 1} maxLives={maxLives} ringed={winners.has(p.id)} />)}
        </ol>
        {children}
      </div>
      {actions && <div className="md-row hb-tally-actions">{actions}</div>}
    </div>
  );
}
