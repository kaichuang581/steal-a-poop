import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DIVISIONS, DIVISION_POINTS, RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, TOP_FLOOR } from '../../lib/ranked';
import { Icon, InfoGlyph, TierIcon } from '../boards/art';
import { TreeIcon } from '../home/SetupSheet';
import { BoardFrame, Pix, SnowCap } from '../kit/surfaces';
import { PlusMinusArt } from '../profile/art';
import { CROSS } from '../profile/Profile';
import '../profile/profile.css';

/** "1,800–2,099": figures of equal width with an en dash between. */
const fmt = (n: number) => n.toLocaleString('en-US');

/** What a loss costs at each rank, as a tag (TIERS[].lossShare: the share of an ordinary loss that is taken). */
export function lossTag(share: number): string | null {
  if (share === 0) return 'Losses free';
  if (share === 0.5) return 'Losses ½';
  if (share === 0.75) return 'Losses ¾';
  return null;
}

/**
 * How ranks work, over the profile (the profile plan, section 8): its own scrim and Board, the ribbon and the close
 * square; the eight ranks from Zenith down to Wood on the left, each one Tile with its icon, its points and at most one tag,
 * and four short rules on the right. Everything is read from src/lib/ranked.ts, so it can never disagree with the ladder.
 * Drawn beside the profile (a portal): a click or Esc that closes this must not close the profile too.
 */
export function RankGuide({ onClose, mine }: { onClose: () => void; mine: number | null }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    // Caught before the profile's own Esc (a bubbling listener on window), so Esc closes this alone.
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', on, true);
    return () => { window.removeEventListener('keydown', on, true); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [onClose]);
  return createPortal(
    <div className="pf-scrim pf-scrim--guide" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rg-title" className="pf pf--guide hm rc" onClick={(e) => e.stopPropagation()}>
        <i className="pf-face" aria-hidden="true" />
        <BoardFrame />
        <SnowCap icicles />
        <header className="pf-head">
          <h2 id="rg-title" className="pf-ribbon"><i className="pf-ribbon-face" aria-hidden="true" /><span className="pf-info pf-info--ink"><InfoGlyph /></span><span>How ranks work</span></h2>
          <button ref={close} type="button" className="pf-close hm-slab hm-knit" onClick={onClose} aria-label="Close" title="Close"><Pix rows={CROSS} colors={{ X: 'var(--hm-ink)' }} /></button>
        </header>
        <RankGuideBody mine={mine} />
      </div>
    </div>,
    document.body,
  );
}

function Rule({ icon, title, children, extra }: { icon: ReactNode; title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="pf-card pf-rule">
      <h3><span className="pf-sec-icon" aria-hidden="true">{icon}</span>{title}</h3>
      <p>{children}</p>
      {extra}
    </div>
  );
}

/** The ranks and the rules: everything in the guide but its frame. `mine` is your tier, or null when unranked. */
export function RankGuideBody({ mine }: { mine: number | null }) {
  const span = DIVISIONS * DIVISION_POINTS;
  return (
    <div className="pf-body pf-rg-body">
      {/* Highest first (Brian, 2026-11-14: "make it show highest to lowest in descending order"). */}
      <ol className="pf-rg-ranks" aria-label={`The ${TIERS.length} ranks, highest first`}>
        {TIERS.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => {
          const top = i === TIERS.length - 1;
          const from = i * span;
          const start = mine === null && i === 0;
          const tag = top ? 'Top rank' : start ? 'Start here' : lossTag(t.lossShare);
          const range = top ? `${fmt(TOP_FLOOR)} points and up` : `${fmt(from)}–${fmt(from + span - 1)} points${start ? ', losses are free' : ''}`;
          return (
            <li key={t.id} className="pf-rg-tile" data-you={mine === i || undefined}>
              {/* At 24, the badge's own size: 32 is no whole multiple of its 24 rows and blurred it (the plan asked 32). */}
              <span className="pf-rg-icon"><TierIcon tier={i} height={24} /></span>
              <span className="pf-rg-text">
                <b>{t.name}{mine === i && <span className="pf-pennant">You</span>}</b>
                <span>{range}</span>
              </span>
              {tag && <span className={`pf-tag ${top || start ? 'pf-tag--lantern' : 'pf-tag--ink'}`} data-free={t.lossShare === 0 && !start || undefined}>{tag}</span>}
            </li>
          );
        })}
      </ol>
      <div className="pf-rg-rules">
        <Rule icon={<Icon name="level" color="var(--hm-lantern-hi)" />} title="Climbing"
          extra={<span className="pf-climb" aria-hidden="true">{['I', 'II', 'III'].map((r, i) => <span key={r} className="pf-div-col"><span className="pf-div pf-div--14"><i style={{ '--fill': i === 0 ? '100%' : '0%' } as React.CSSProperties} /></span><small>{r}</small><small>{DIVISION_POINTS}</small></span>)}</span>}>
          {`Each rank has three divisions, I, II and III, of ${DIVISION_POINTS} points each. Fill one and you move up.`}
        </Rule>
        <Rule icon={<PlusMinusArt />} title="Points">
          Finish ahead of players to gain points, and behind them to lose some. Beating a higher rank gains more; losing to a lower rank costs more.
        </Rule>
        <Rule icon={<span style={{ color: 'var(--hm-lantern-hi)', display: 'contents' }}><TreeIcon level="easy" /></span>} title="A gentle start">
          {`Losses cost nothing in ${TIERS[0].name}, half in ${TIERS[1].name} and three quarters in ${TIERS[2].name}. Coming first with no tie always gains at least 1 point.`}
        </Rule>
        <Rule icon={<Icon name="wins" color="var(--hm-lantern-hi)" />} title="The games">
          {`${RANKED_MIN_PLAYERS} to ${RANKED_MAX_PLAYERS} players, the same rules for everyone. You need an account. Leaving a game counts as a loss.`}
        </Rule>
      </div>
    </div>
  );
}
