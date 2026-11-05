import type { ReactNode } from 'react';
import type { PlayerView } from '../model/types';
import { AcornIcon, LeafIcon, SeedlingIcon } from './Icons';
import { IceOverlay, Lives } from './Lives';
import { SheepIcon } from './SheepIcon';

const BADGE = { easy: <SeedlingIcon size={13} />, medium: <LeafIcon size={13} />, hard: <AcornIcon size={13} /> } as const;

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
  /** Wool balls each sheep started with (empty rings show the ones lost). */
  maxLives?: number;
}

/** Paper card: creature, name, and its wool balls (lives). Amber ring on the player whose turn it is. */
export function PlayerCard({ player, isTurn, compact, lastWord, children, badge, title, maxLives = 3 }: Props) {
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
      <SheepIcon size={compact ? 22 : 30} bare={player.lives <= 1} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-extrabold" data-seat-name={player.id} title={title}>
          {badge && <span aria-hidden="true">{badge} </span>}
          {player.name}{player.isYou ? ' (you)' : ''}
          {player.difficulty && !compact && <span className="ml-1 inline-block align-[-1px]" title={`${player.difficulty} bot`} role="img" aria-label={`${player.difficulty} bot`}>{BADGE[player.difficulty]}</span>}
        </div>
        {!compact && (
          <div className="truncate text-xs font-bold uppercase" style={{ color: 'var(--ink-soft)' }} data-seat-word={player.id}>
            {lastWord ?? '—'}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end leading-none">
        <Lives lives={player.lives} max={maxLives} size={compact ? 13 : 17} />
      </div>
      {player.frozen && <IceOverlay />}
      {children}
    </div>
  );
}
