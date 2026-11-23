import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { DIVISION_POINTS, TIERS, rankOf } from '../../lib/ranked';
import { getServerUrl } from '../../net/config';
import { Icon, InfoGlyph, TierIcon } from '../boards/art';
import { SectionHead } from '../profile/parts';
import { RankGuide } from './RankGuide';
import { useRanked } from './rankedStore';

const ROMAN = ['I', 'II', 'III'];

/**
 * The profile's Ranked section (the profile plan, section 6): your rank's icon, name and points, the division bar, and
 * the whole ladder from Wood to Zenith with your place on it. Before a first ranked game it says where you start; with no
 * game server it says ranked play is not open (never the words "game server": a developer build shows a "Server off" tag
 * instead). "How ranks work" opens the guide.
 */
export function ProfileRank() {
  const me = useRanked((s) => s.me);
  const status = useRanked((s) => s.status);
  useEffect(() => { void useRanked.getState().load(); }, []);
  const [guide, setGuide] = useState(false);
  const server = !!getServerUrl();
  const played = !!me && me.games > 0;
  const rank = rankOf(me?.rating ?? 0);
  const top = rank.tier === TIERS.length - 1;

  let title = 'Unranked', line: string;
  if (played) {
    title = rank.label;
    line = `${me.rating.toLocaleString()} points, ${rank.toNext !== null ? `${rank.toNext} to ${rank.next}` : 'top rank'}`;
  } else if (!server) line = 'Ranked play isn’t open yet.';
  else if (status === 'error') line = 'Your rank can’t be loaded right now. Try again in a moment.';
  else if (status === 'off') line = 'Sign in to get a rank. Your first ranked game puts you in Wood I.';
  else if (!me) line = 'Looking up your rank…';
  else line = 'Your first ranked game puts you in Wood I.';

  return (
    <section className="pf-sec pf-sec--ranked" aria-labelledby="prof-ranked">
      <SectionHead id="prof-ranked" icon={<Icon name="ranked" color="var(--hm-wool)" />} title="Ranked">
        {import.meta.env.DEV && !server && <span className="pf-tag pf-tag--ink">Server off</span>}
        <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" onClick={() => setGuide(true)} aria-haspopup="dialog">
          <span className="pf-info"><InfoGlyph /></span>How ranks work
        </button>
      </SectionHead>
      <div className="pf-card pf-rk" aria-live="polite">
        <div className="pf-rk-line">
          <span className="pf-rk-icon" data-none={!played || undefined}><TierIcon tier={played ? rank.tier : 0} height={48} /></span>
          <span className="pf-rk-text"><b>{title}</b><span>{line}</span></span>
          {played && <span className="pf-rk-record">{`${me.wins} win${me.wins === 1 ? '' : 's'} in ${me.games} game${me.games === 1 ? '' : 's'}`}<br />{`best ${rankOf(me.peak).label}`}</span>}
        </div>
        {played && (
          top ? (
            <div className="pf-divs pf-divs--top"><span className="pf-div"><i style={{ '--fill': '100%' } as CSSProperties} /></span><small>Top rank</small></div>
          ) : (
            <div className="pf-divs" role="img" aria-label={`${rank.points} of ${DIVISION_POINTS} points into ${rank.label}`}>
              {ROMAN.map((r, i) => {
                const d = rank.division ?? 1;
                const fill = i + 1 < d ? 1 : i + 1 === d ? rank.points / DIVISION_POINTS : 0;
                return <span key={r} className="pf-div-col"><span className="pf-div"><i style={{ '--fill': `${Math.round(fill * 100)}%` } as CSSProperties} /></span><small>{r}</small></span>;
              })}
            </div>
          )
        )}
        <ol className="pf-ladder" aria-label={`The ${TIERS.length} ranks, from ${TIERS[0].name} to ${TIERS[TIERS.length - 1].name}`}>
          {TIERS.map((t, i) => {
            const you = played && i === rank.tier;
            return (
              <li key={t.id} className="pf-rung" data-you={you || undefined} data-above={(played ? i > rank.tier : i > 0) || undefined} aria-current={you ? 'true' : undefined}>
                <span className="pf-rung-icon"><TierIcon tier={i} height={24} /></span>
                {you ? <span className="pf-pennant">You</span> : !played && i === 0 ? <span className="pf-start"><i aria-hidden="true" />Start</span> : <span className="pf-rung-name">{t.name}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      {guide && <RankGuide onClose={() => setGuide(false)} mine={played && me ? rank.tier : null} />}
    </section>
  );
}
