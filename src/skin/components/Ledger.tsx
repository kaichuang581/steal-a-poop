import { useRoomStore } from '../../state/roomStore';
import type { PlayerView } from '../model/types';
import { PixelHead } from '../avatars/AvatarIcon';
import { useAvatar } from '../avatars/store';
import { BoardFrame, SnowCap } from '../kit/surfaces';
import { MiniBomb } from './BombClock';
import { SnowflakeIcon } from './Icons';
import '../kit/nameplate.css';
import './hud-boards.css';

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

/** The crisp pixel head, in a dark square as on the pen's list. 28: every head is drawn at its own size (21 to 25). */
function Portrait({ player }: { player: PlayerView }) {
  const worn = useWorn(player);
  return <span className="hb-avatar" aria-hidden="true"><PixelHead id={worn ?? 'sheep'} box={28} /></span>;
}

/** Wool balls as the name tag's dots (kit/NamePlate): one a ball, the lost ones dimmed. */
function Wool({ have, of }: { have: number; of: number }) {
  return (
    <span className="np-lives hb-wool" role="img" aria-label={`${have} wool ball${have === 1 ? '' : 's'} left`}>
      {Array.from({ length: Math.max(of, have) }, (_, i) => <i key={i} data-off={i >= have || undefined} />)}
    </span>
  );
}

interface RowProps {
  player: PlayerView;
  place: number;
  maxLives: number;
  /** Marked with the lantern bar: the sheep on turn, or the winner on the tally. */
  ringed?: boolean;
  /** The bomb in its hand: the sheep on turn. */
  bomb?: boolean;
  className?: string;
  /** The last word it played, small under the name. */
  lastWord?: string | null;
  /** The table's own scoreboard carries the seat attributes the tour and the tests look for; the tally does not. */
  marks?: boolean;
}

/**
 * One row of the scoreboard, a tile as on the pen's list of players: the place, the pixel head, the name (yours in
 * lantern), a quiet "bot" tag, the wool as the name tag's dots. The one on turn has a lantern bar inside its tile; a
 * frozen sheep's row is sunk into the board. It brings Home's tokens, so it sits on any screen (the end scoreboard).
 */
export function LedgerRow({ player: p, place, maxLives, ringed, bomb, lastWord, marks, className }: RowProps) {
  // Online, a seat filled after a quiet spell is not marked as a bot (Brian, 2026-11-14: "dont say they are bots").
  // Offline (practice, a table of your own, the tutorial) you chose the bots, and they say so.
  const online = useRoomStore((s) => !!s.room);
  const markBot = p.isBot && !online;
  return (
    <li
      className={`hb-row hm rc hb ${p.frozen ? 'rc-well' : 'rc-tile'} ${className ?? ''}`}
      data-dim={p.dimmed || undefined} data-frozen={p.frozen || undefined} data-you={p.isYou || undefined} data-lit={ringed || undefined}
      data-seat={marks ? p.id : undefined} data-tour={marks && p.isYou ? 'me' : undefined}
    >
      {ringed && <i className="hb-bar" aria-hidden="true" />}
      <span className="hb-place">{place}</span>
      <Portrait player={p} />
      <span className="hb-who">
        <span className="hb-line">
          <b className="hb-name" data-seat-name={marks ? p.id : undefined}>{p.name}{p.isYou && <span className="hb-sr"> (you)</span>}</b>
          {markBot && <span className="hb-tag" title={p.difficulty ? `${p.difficulty} bot` : undefined}>{p.difficulty && <span className="hb-sr">{p.difficulty} </span>}bot</span>}
        </span>
        {lastWord !== undefined && <span className="hb-word" data-seat-word={marks ? p.id : undefined}>{lastWord ?? '—'}</span>}
      </span>
      {bomb && <span key={p.id} className="sk-bomb-hand hb-bomb" aria-hidden="true"><MiniBomb size={16} /></span>}
      {p.frozen ? <span className="hb-ice" title="frozen" aria-label="frozen"><SnowflakeIcon size={10} /></span> : null}
      <Wool have={p.lives} of={maxLives} />
    </li>
  );
}

/**
 * The scoreboard at the top right: a board as the pen's (felt, inner frame, snow on top), one tile per sheep in
 * standings order. On a phone it is a grid of small tiles across the top: head, name, wool.
 */
export function Ledger({ players, turnId, lastWords, maxLives, compact }: {
  players: PlayerView[]; turnId: string; lastWords: Record<string, string | null | undefined>; maxLives: number; compact: boolean;
}) {
  if (compact) {
    return (
      <ol className="hb-strip hm rc hb" aria-label="Scoreboard">
        {players.map((p) => (
          <li
            key={p.id} className={`hb-chip ${p.frozen ? 'rc-well' : 'rc-tile'}`}
            data-seat={p.id} data-tour={p.isYou ? 'me' : undefined} data-dim={p.dimmed || undefined}
            data-frozen={p.frozen || undefined} data-you={p.isYou || undefined} data-lit={p.id === turnId || undefined}
          >
            {p.id === turnId && <i className="hb-bar" aria-hidden="true" />}
            <Portrait player={p} />
            <b className="hb-name" data-seat-name={p.id}>{p.name}{p.isYou && <span className="hb-sr"> (you)</span>}</b>
            <Wool have={p.lives} of={maxLives} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <aside className="sk-ledger hb-ledger hm rc hb rc-board" aria-label="Scoreboard">
      <BoardFrame corners={['bl', 'br']} />
      <SnowCap />
      <ol className="hb-rows">
        {players.map((p, i) => <LedgerRow key={p.id} player={p} place={i + 1} maxLives={maxLives} ringed={p.id === turnId} bomb={p.id === turnId} lastWord={lastWords[p.id] ?? null} marks />)}
      </ol>
    </aside>
  );
}
