import { useEffect, useRef } from 'react';
import { rankOf, signed } from '../../lib/ranked';
import { useRoomStore } from '../../state/roomStore';
import { RankBadge } from './RankBadge';
import { useRanked } from './rankedStore';

/**
 * On the results board of a ranked game: what the game did to your rating. The server sends it a moment after the
 * game ends (it has to store it first), so this says so until it arrives. Nothing is shown after any other game.
 */
export function RatedSlip() {
  const ranked = useRoomStore((s) => !!s.room?.ranked);
  const rated = useRoomStore((s) => s.room?.rated ?? null);
  const me = useRoomStore((s) => s.user?.userId ?? null);
  const mine = rated && me ? rated[me] ?? null : null;
  const gameOver = useRoomStore((s) => s.room?.phase === 'finished');
  // Tell the rest of the game (the Play chooser, the profile) once, when the change arrives.
  const told = useRef(false);
  useEffect(() => {
    if (!mine || told.current) return;
    told.current = true;
    useRanked.getState().rated(mine.after, mine.place === 1);
  }, [mine]);
  if (!ranked || !gameOver) return null;
  if (!mine) return <p className="sk-rated sk-rated--wait" role="status">Ranked game · working out your rating…</p>;
  const before = rankOf(mine.before), after = rankOf(mine.after);
  // Rated among the people who sat down: a farm sheep that took a leaver's seat is not one of them, so a player can
  // be first here and second on the podium.
  const of = Object.keys(rated ?? {}).length;
  const ORDINAL = ['1st', '2nd', '3rd', '4th'];
  const moved = after.label !== before.label ? (mine.after > mine.before ? 'up' : 'down') : null;
  return (
    <div className="sk-rated" data-moved={moved ?? undefined} role="status" aria-label={`Ranked: ${signed(mine.delta)} points. ${after.label}, ${mine.after} points.`}>
      <RankBadge rating={mine.after} size={44} />
      <div className="sk-rated-text">
        <span className="sk-rated-rank">{after.label}{moved === 'up' && <b> · ranked up!</b>}{moved === 'down' && <b> · down a division</b>}</span>
        <span className="sk-rated-points">
          <b data-sign={mine.delta < 0 ? 'minus' : 'plus'}>{signed(mine.delta)} points</b>
          <small> · rated {ORDINAL[mine.place - 1] ?? `#${mine.place}`} of {of} · {mine.after} in all{after.toNext !== null ? ` · ${after.toNext} to ${after.next}` : ''}</small>
        </span>
      </div>
    </div>
  );
}
