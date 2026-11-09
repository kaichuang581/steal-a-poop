import { useRoomStore } from '../../state/roomStore';
import type { PlayerView } from '../model/types';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { useAvatar } from '../avatars/store';
import { Slate, Tally } from '../kit';
import { MiniBomb } from './BombClock';
import { AcornIcon, LeafIcon, SeedlingIcon, SnowflakeIcon } from './Icons';
import { SheepIcon } from './SheepIcon';

const BADGE = { easy: <SeedlingIcon size={13} />, medium: <LeafIcon size={13} />, hard: <AcornIcon size={13} /> } as const;

/** The avatar a player wears: your own pick, or what the room says theirs is; bots and offline players are sheep. */
function useWorn(player: PlayerView): string | null {
  const chosen = useAvatar();
  const theirs = useRoomStore((s) => {
    if (player.isYou || !s.room) return null;
    const uid = Object.keys(s.room.seatOf).find((u) => s.room!.seatOf[u] === Number(player.id));
    return s.room.members.find((m) => m.userId === uid)?.avatar ?? null;
  });
  return player.isYou ? chosen : theirs;
}

function Portrait({ player, size }: { player: PlayerView; size: number }) {
  const worn = useWorn(player);
  return worn ? <AvatarIcon id={worn} size={size} /> : <SheepIcon size={size} bare={player.lives <= 1} />;
}

interface RowProps {
  player: PlayerView;
  place: number;
  maxLives: number;
  /** Its name ringed in chalk: the sheep on turn, or the winner on the tally. */
  ringed?: boolean;
  /** The bomb in its hand: the sheep on turn. */
  bomb?: boolean;
  className?: string;
  /** The last word it played, in small chalk under the name. */
  lastWord?: string | null;
  /** The table's own scoreboard carries the seat attributes the tour and the tests look for; the tally does not. */
  marks?: boolean;
}

/** One chalk row of the barn ledger (V6 Part 6.3): the place, the portrait, the name, the wool as tally strokes. */
export function LedgerRow({ player: p, place, maxLives, ringed, bomb, lastWord, marks, className }: RowProps) {
  return (
    <li className={`kit-slate-row sk-ledger-row ${className ?? ""}`} data-dim={p.dimmed || undefined} data-seat={marks ? p.id : undefined} data-tour={marks && p.isYou ? 'me' : undefined}>
      <span className="sk-ledger-place">{place}</span>
      <Portrait player={p} size={22} />
      <span className="sk-ledger-who">
        <span className={`sk-ledger-name ${ringed ? 'kit-chalk-ring' : ''} ${p.frozen ? 'kit-chalk-strike' : ''}`} data-seat-name={marks ? p.id : undefined}>
          {p.name}{p.isYou ? ' (you)' : ''}
          {p.difficulty && <span className="sk-ledger-badge" title={`${p.difficulty} bot`} role="img" aria-label={`${p.difficulty} bot`}>{BADGE[p.difficulty]}</span>}
        </span>
        <span className="sk-ledger-sub">
          {p.isBot && <span>farm sheep{lastWord !== undefined ? ' · ' : ''}</span>}
          {lastWord !== undefined && <span className="sk-ledger-word" data-seat-word={marks ? p.id : undefined}>{lastWord ?? '—'}</span>}
        </span>
      </span>
      {bomb && <span key={p.id} className="sk-bomb-hand" aria-hidden="true"><MiniBomb /></span>}
      {p.frozen ? <span className="sk-ledger-ice" title="frozen" aria-label="frozen"><SnowflakeIcon size={16} /></span> : null}
      <span className="sk-ledger-wool" role="img" aria-label={`${p.lives} wool ball${p.lives === 1 ? '' : 's'} left`}><Tally have={p.lives} of={Math.max(maxLives, p.lives)} /></span>
    </li>
  );
}

/**
 * The barn ledger (V6 Part 6.3): a wool slate tucked under the top-right pegs, one row per sheep in
 * standings order. On a phone it is a strip of mini slates across the top: portrait, name, strokes.
 */
export function Ledger({ players, turnId, lastWords, maxLives, compact }: {
  players: PlayerView[]; turnId: string; lastWords: Record<string, string | null | undefined>; maxLives: number; compact: boolean;
}) {
  if (compact) {
    return (
      <ol className="sk-ledger-strip" aria-label="Scoreboard">
        {players.map((p) => (
          <li key={p.id} data-seat={p.id} data-tour={p.isYou ? 'me' : undefined} data-dim={p.dimmed || undefined}>
            <Slate size="mini" className={p.id === turnId ? 'sk-ledger-turn' : undefined}>
              <Portrait player={p} size={16} />
              <span className={`sk-ledger-name ${p.frozen ? 'kit-chalk-strike' : ''}`} data-seat-name={p.id}>{p.name}{p.isYou ? ' (you)' : ''}</span>
              <span className="sk-ledger-wool" role="img" aria-label={`${p.lives} wool ball${p.lives === 1 ? '' : 's'} left`}><Tally have={p.lives} of={Math.max(maxLives, p.lives)} /></span>
            </Slate>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <aside className="sk-ledger" aria-label="Scoreboard">
      <Slate size="board">
        <ol>
          {players.map((p, i) => <LedgerRow key={p.id} player={p} place={i + 1} maxLives={maxLives} ringed={p.id === turnId} bomb={p.id === turnId} lastWord={lastWords[p.id] ?? null} marks />)}
        </ol>
      </Slate>
    </aside>
  );
}
