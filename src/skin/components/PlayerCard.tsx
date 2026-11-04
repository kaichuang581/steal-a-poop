import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { Creature } from './Creature';
import { IceOverlay, Lives } from './Lives';

const BADGE = { easy: '🌱', medium: '🍃', hard: '🌰' } as const;

interface Props {
  player: PlayerView;
  isTurn: boolean;
  compact: boolean;
  /** Last word played, under the name. */
  lastWord?: string | null;
  /** Floating "+5" / "−5" chips from events. */
  children?: ReactNode;
  /** Badge and title a room player wears. */
  badge?: string;
  title?: string;
  /** Practice has no lives, so no flames. */
  showLives?: boolean;
}

/** Paper card: creature, name, banked score. Amber ring on the player whose turn it is. */
export function PlayerCard({ player, isTurn, compact, lastWord, children, badge, title, showLives = true }: Props) {
  return (
    <div
      className="sk-paper relative flex items-center gap-2 px-2 py-1"
      style={{
        opacity: player.dimmed ? 0.5 : 1,
        boxShadow: isTurn ? '0 0 0 3px var(--amber), var(--shadow-warm)' : undefined,
        transition: 'opacity var(--t-feedback) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)',
        width: compact ? undefined : 200,
      }}
      data-seat={player.id}
      data-tour={player.isYou ? 'me' : undefined}
    >
      {player.creature && <Creature id={player.creature} size={compact ? 26 : 36} />}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-extrabold" data-seat-name={player.id} title={title}>
          {badge && <span aria-hidden="true">{badge} </span>}
          {player.name}{player.isYou ? ' (you)' : ''}
          {player.difficulty && !compact && <span className="ml-1" title={`${player.difficulty} bot`} aria-label={`${player.difficulty} bot`}>{BADGE[player.difficulty]}</span>}
        </div>
        {!compact && (
          <div className="truncate text-xs font-bold uppercase" style={{ color: 'var(--ink-soft)' }} data-seat-word={player.id}>
            {lastWord ?? '—'}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end leading-none">
        <span className="sk-display text-lg">{player.banked}</span>
        {showLives && <Lives lives={player.lives} size={compact ? 10 : 13} />}
      </div>
      {player.frozen && <IceOverlay />}
      {children}
    </div>
  );
}
