import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { DIVISION_POINTS, TIERS, rankOf } from '../../lib/ranked';
import { getServerUrl } from '../../net/config';
import { Icon, InfoGlyph, TierIcon } from '../boards/art';
import { pixelRects } from '../components/pixels';
import { Section } from '../profile/parts';
import { BADGE_W, badgeArt } from './badge';
import { RankGuide } from './RankGuide';
import { useRanked } from './rankedStore';

const ROMAN = ['I', 'II', 'III'];

/** A rank's badge as a solid shape (a rank not reached yet: "locked", crisp, no fading), at one art pixel a pixel (24). */
export function TierShape({ tier, color = 'var(--pf-locked)', height = 24 }: { tier: number; color?: string; height?: number }) {
  const art = badgeArt(tier);
  const solid = Object.fromEntries(Object.keys(art.colors).map((k) => [k, color]));
  return (
    <svg viewBox={`0 0 ${BADGE_W} 24`} width={Math.round((height * BADGE_W) / 24)} height={height} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {pixelRects(art.rows.slice(0, 24), solid)}
    </svg>
  );
}

/**
 * The profile's Ranked section (the profile plan v2, section 7.1): your rank's icon, name and points (and the division
 * bar), then the eight ranks climbing a staircase from Wood to Zenith: ranks reached in full colour, the rest as locked
 * silhouettes, your step lantern with the "You" pennant. With no game server it says ranked play is not open (a
 * developer build shows a "Server off" tag). "How ranks work" opens the guide.
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
  const at = played ? rank.tier : 0; // the step that is yours (Wood, with "Start", while unranked)

  let title = 'Unranked', line: string;
  if (played) {
    title = rank.label;
    line = `${me.rating.toLocaleString()} points, ${rank.toNext !== null ? `${rank.toNext} to ${rank.next}` : 'top rank'}`;
  } else if (!server) line = 'Ranked play isn’t open yet.';
  else if (status === 'error') line = 'Your rank can’t be loaded right now. Try again in a moment.';
  else if (status === 'off') line = 'Sign in, then play a ranked game to start in Wood I.';
  else if (!me) line = 'Looking up your rank…';
  else line = 'Play a ranked game to start in Wood I.';

  return (
    <Section id="prof-ranked" className="pf-sec--ranked" tone="barn" icon={<Icon name="ranked" color="var(--hm-wool)" />} title="Ranked"
      tools={<>
        {import.meta.env.DEV && !server && <span className="pf-tag pf-tag--ink">Server off</span>}
        <button type="button" className="pf-slab pf-slab--28 hm-slab hm-knit" onClick={() => setGuide(true)} aria-haspopup="dialog">
          <span className="pf-info"><InfoGlyph /></span>How ranks work
        </button>
      </>}>
      <div className="pf-rk" aria-live="polite">
        <div className="pf-rk-line">
          {played
            ? <span className="pf-rk-icon"><TierIcon tier={rank.tier} height={48} /></span>
            : <span className="pf-rk-icon pf-rk-icon--none"><TierShape tier={0} color="var(--hm-night-3)" height={48} /><i className="pf-rk-q" aria-hidden="true" /></span>}
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
        <ol className="pf-stairs" aria-label={`The ${TIERS.length} ranks, from ${TIERS[0].name} to ${TIERS[TIERS.length - 1].name}`}>
          {TIERS.map((t, i) => {
            const you = i === at;
            const reached = played ? i <= rank.tier : i === 0;
            return (
              <li key={t.id} className="pf-stair" style={{ '--rise': i } as CSSProperties} data-you={you || undefined} data-next={(played ? i === rank.tier + 1 : false) || undefined} aria-current={you && played ? 'true' : undefined}>
                <span className="pf-stair-icon">{reached ? <TierIcon tier={i} height={24} /> : <TierShape tier={i} />}</span>
                <i className="pf-step" aria-hidden="true" />
                {you && played ? <span className="pf-pennant">You</span>
                  : you ? <span className="pf-start"><i aria-hidden="true" />Start</span>
                  : <span className="pf-stair-name">{t.name}</span>}
              </li>
            );
          })}
        </ol>
      </div>
      {guide && <RankGuide onClose={() => setGuide(false)} mine={played && me ? rank.tier : null} />}
    </Section>
  );
}
