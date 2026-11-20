import { useEffect, useState } from 'react';
import { DIVISION_POINTS, TIERS, rankOf } from '../../lib/ranked';
import { Board as Sign, Paper, WoodButton } from '../kit';
import { RankBadge } from './RankBadge';
import { RankGuide } from './RankGuide';
import { useRanked } from './rankedStore';
import './ranked.css';

/**
 * The profile's ranked section: your rank's badge and name, your points and how far the next division is, and your
 * record. Before a first ranked game it says where everyone starts; with no account it says how to get a rank.
 */
export function ProfileRank() {
  const me = useRanked((s) => s.me);
  const status = useRanked((s) => s.status);
  useEffect(() => { void useRanked.getState().load(); }, []);
  const rank = rankOf(me?.rating ?? 0);
  const played = !!me && me.games > 0;
  const [guide, setGuide] = useState(false);
  return (
    <section aria-labelledby="prof-ranked">
      <div className="sk-prof-head">
        <Sign size="label" tone="wood" className="sk-room-heading"><h3 id="prof-ranked">Ranked</h3></Sign>
        <p className="sk-room-hint">{TIERS.length} ranks, from {TIERS[0].name} to {TIERS[TIERS.length - 1].name}. Ranked games are under Queue on the menu.</p>
      </div>
      <Paper kind="note" className="sk-prof-ranked">
        <RankBadge rating={me?.rating ?? 0} size={64} />
        <div className="sk-prof-ranked-text">
          {status === 'off' ? (
            <><b>No rank yet</b><span>Sign in, then choose Ranked under Queue. Your rank is kept on your account.</span></>
          ) : status === 'error' ? (
            <><b>Rank unavailable</b><span>The barn could not be reached. Try again in a moment.</span></>
          ) : !me ? (
            <><b>Checking</b><span>Asking the barn for your rank.</span></>
          ) : !played ? (
            <><b>Unranked</b><span>Everyone starts at {rank.label}. Your first ranked game starts the climb.</span></>
          ) : (
            <>
              <b>{rank.label}</b>
              <span>{me.rating.toLocaleString()} points{rank.toNext !== null ? `, ${rank.toNext} to ${rank.next}` : ''}</span>
              {rank.toNext !== null && (
                <span className="sk-prof-ranked-bar" role="img" aria-label={`${rank.points} of ${DIVISION_POINTS} points into ${rank.label}`}><i style={{ width: `${Math.round((rank.points / DIVISION_POINTS) * 100)}%` }} /></span>
              )}
              <span>{me.wins} win{me.wins === 1 ? '' : 's'} in {me.games} ranked game{me.games === 1 ? '' : 's'}, best {rankOf(me.peak).label}</span>
            </>
          )}
        </div>
        {/* The card's right side: the whole ladder, one press away (Brian, 2026-11-14). */}
        <WoodButton type="button" className="sk-prof-ranked-how" onClick={() => setGuide(true)} aria-haspopup="dialog">How ranks work</WoodButton>
      </Paper>
      {guide && <RankGuide onClose={() => setGuide(false)} mine={played && me ? rank.tier : null} />}
    </section>
  );
}
