import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DIVISIONS, DIVISION_POINTS, RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, TOP_FLOOR } from '../../lib/ranked';
import { Icon, InfoGlyph, TierIcon } from '../boards/art';
import { getLang } from '../../lib/lang';
import { TreeIcon } from '../home/SetupSheet';
import { BoardFrame, Pix, SnowCap } from '../kit/surfaces';
import { PlusMinusArt } from '../profile/art';
import { IconTile } from '../profile/parts';
import type { TileTone } from '../profile/parts';
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

/** Each rank's colour (the profile plan v2, 2.1): its bar in the list and its square in the tags. */
const rankColor = (id: string) => `var(--rank-${id})`;

/**
 * How ranks work, over the profile (the profile plans v1 and v2, section 10): its own scrim and Board, the ribbon and the
 * close square. On the left the eight ranks from Zenith down to Wood, each a Tile with its colour bar, its icon in a well
 * (the wells joined into a ladder), its points and at most one tag; on the right four rules, each a card with a coloured
 * icon tile and a picture of what it says. Both columns end level. Everything is read from src/lib/ranked.ts.
 * Drawn beside the profile (a portal): a click or Esc that closes this must not close the profile too.
 */
export function RankGuide({ onClose, mine }: { onClose: () => void; mine: number | null }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Focus goes to the title, so no focus ring shows on the close button when the card opens (v2, F7).
    title.current?.focus({ preventScroll: true });
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
          <h2 id="rg-title" ref={title} tabIndex={-1} className="pf-ribbon"><i className="pf-ribbon-face" aria-hidden="true" /><span className="pf-info pf-info--ink"><InfoGlyph /></span><span>How ranks work</span></h2>
          <button type="button" className="pf-close hm-slab hm-knit" onClick={onClose} aria-label="Close" title="Close"><Pix rows={CROSS} colors={{ X: 'var(--hm-ink)' }} /></button>
        </header>
        <RankGuideBody mine={mine} />
      </div>
    </div>,
    document.body,
  );
}

function Rule({ tone, icon, title, children }: { tone: TileTone; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="pf-card pf-rule">
      <h3><IconTile tone={tone}>{icon}</IconTile>{title}</h3>
      {children}
    </div>
  );
}

/** A small ink tag with a rank's colour square: "Losses ½", "Stone · ½". */
function RankTag({ id, children }: { id: string; children: ReactNode }) {
  return <span className="pf-tag pf-tag--ink pf-tag--rank"><i style={{ '--rank': rankColor(id) } as CSSProperties} />{children}</span>;
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
          const loss = lossTag(t.lossShare);
          const range = top ? `${fmt(TOP_FLOOR)} points and up` : `${fmt(from)}–${fmt(from + span - 1)} points${start ? ' · losses are free' : ''}`;
          return (
            <li key={t.id} className="pf-rg-tile" data-you={mine === i || undefined} style={{ '--rank': rankColor(t.id) } as CSSProperties}>
              {/* At 24, the badge's own size: 32 is no whole multiple of its 24 rows and blurred it (the plan asked 32). */}
              <span className="pf-rg-well"><TierIcon tier={i} height={24} /></span>
              <span className="pf-rg-text">
                <b>{t.name}{mine === i && <span className="pf-pennant">You</span>}</b>
                <span>{range}</span>
              </span>
              {top ? <span className="pf-tag pf-tag--lantern">Top rank</span>
                : start ? <span className="pf-tag pf-tag--lantern">Start here</span>
                : loss && <RankTag id={t.id}>{loss}</RankTag>}
            </li>
          );
        })}
      </ol>
      <div className="pf-rg-rules">
        <Rule tone="lantern" icon={<Icon name="level" color="var(--hm-wool)" />} title="Climbing">
          <p>Each rank has three divisions. Fill one and you move up.</p>
          <span className="pf-climb" aria-hidden="true">
            {['I', 'II', 'III'].map((r, i) => <span key={r} className="pf-climb-seg" data-on={i === 0 || undefined}>{r}</span>)}
          </span>
          <span className="pf-climb-note">{`${DIVISION_POINTS} points each`}</span>
        </Rule>
        <Rule tone="barn" icon={<PlusMinusArt />} title="Points">
          {/* Its coloured words sit mid-sentence, which the page's translator (word by word) cannot do: French is written here. */}
          {getLang() === 'fr'
            ? <p data-i18n-skip="">Finis <em>devant</em> des joueurs pour <em data-good="">gagner</em> des points, et <em>derrière</em> eux pour en <em data-bad="">perdre</em>. Battre un rang plus haut <em data-good="">rapporte plus</em>{'\u202F'}; perdre contre un rang plus bas <em data-bad="">coûte plus</em>.</p>
            : <p>Finish <em>ahead</em> of players to <em data-good="">gain</em> points, and <em>behind</em> them to <em data-bad="">lose</em> some. Beating a higher rank <em data-good="">gains more</em>; losing to a lower rank <em data-bad="">costs more</em>.</p>}
        </Rule>
        <Rule tone="pasture" icon={<span className="pf-wool-icon"><TreeIcon level="easy" /></span>} title="A gentle start">
          <p>Losses cost less in the first three ranks:</p>
          <span className="pf-tags">
            <RankTag id={TIERS[0].id}>{`${TIERS[0].name} · free`}</RankTag>
            <RankTag id={TIERS[1].id}>{`${TIERS[1].name} · ½`}</RankTag>
            <RankTag id={TIERS[2].id}>{`${TIERS[2].name} · ¾`}</RankTag>
          </span>
          <p>Coming first with no tie always gains at least 1 point.</p>
        </Rule>
        <Rule tone="dusk" icon={<Icon name="wins" color="var(--hm-wool)" />} title="The games">
          <span className="pf-chips">
            {[`${RANKED_MIN_PLAYERS}–${RANKED_MAX_PLAYERS} players`, 'Same rules for all', 'Account needed', 'Leaving counts as a loss'].map((c) => <span key={c} className="pf-chip">{c}</span>)}
          </span>
        </Rule>
      </div>
    </div>
  );
}
