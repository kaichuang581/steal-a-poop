import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DIVISIONS, DIVISION_POINTS, RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, TOP_FLOOR } from '../../lib/ranked';
import { CloseIcon } from '../components/Icons';
import { Board as Sign, Peg, Slate } from '../kit';
import { TierBadge } from './RankBadge';
import './ranked.css';

const ROMAN = ['I', 'II', 'III'];
const fmt = (n: number) => n.toLocaleString('en-US');

/** What a loss costs at each rank, in words (TIERS[].lossShare: the share of an ordinary loss that is taken). */
function lossLine(share: number): string | null {
  if (share === 0) return 'Losing costs no points';
  if (share === 0.5) return 'Losses cost half';
  if (share === 0.75) return 'Losses cost three quarters';
  return null;
}

/**
 * How ranked works, opened from the profile's ranked section (Brian, 2026-11-14: "put a button there that explains the
 * ranked system, all the ranks consecutively"). Every rank in order, highest first, with its badge, its divisions and the
 * points it covers, your own rank marked; beside it, how points are won and lost. Everything is read from
 * src/lib/ranked.ts, so it can never disagree with the ladder.
 *
 * Drawn beside the profile, not inside it (a portal): a click or Esc that closes this must not close the profile too.
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
    <div className="sk-play sk-rg" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rg-title" className="sk-rg-box rm-panel kit-wall kit-drift" onClick={(e) => e.stopPropagation()}>
        <div className="sk-rg-head">
          <Sign size="label" tone="wood" className="sk-room-heading"><h2 id="rg-title">How ranks work</h2></Sign>
          <Peg light ref={close} className="sk-rg-close" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={18} /></Peg>
        </div>
        <RankGuideBody mine={mine} />
      </div>
    </div>,
    document.body,
  );
}

/** The ladder and the rules: everything in the guide but its frame. */
export function RankGuideBody({ mine }: { mine: number | null }) {
  const span = DIVISIONS * DIVISION_POINTS;
  return (
        <div className="sk-rg-body">
          <Slate size="board" className="sk-rg-ladder">
            {/* Highest first (Brian, 2026-11-14: "make it show highest to lowest in descending order"). */}
            <ol aria-label={`The ${TIERS.length} ranks, highest first`}>
              {TIERS.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => {
                const top = i === TIERS.length - 1;
                const from = i * span;
                const loss = lossLine(t.lossShare);
                return (
                  <li key={t.id} className="sk-rg-rung" data-you={mine === i || undefined}>
                    <span className="sk-rg-n">{i + 1}</span>
                    <TierBadge tier={i} size={40} />
                    <span className="sk-rg-name">
                      <b>{t.name}</b>
                      {mine === i && <span className="sk-rg-you">you</span>}
                      <small>{top ? `${fmt(TOP_FLOOR)} points and up` : `${fmt(from)} to ${fmt(from + span - 1)} points`}{loss ? `. ${loss}` : ''}</small>
                    </span>
                    <span className="sk-rg-divs" aria-label={top ? 'No divisions: the top rank' : `Divisions ${ROMAN.join(', ')}`}>
                      {top ? <i data-top>Top rank</i> : ROMAN.map((r) => <i key={r}>{r}</i>)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Slate>
          <div className="sk-rg-rules">
            <Slate size="board" className="sk-rg-rule">
              <h3>Climbing</h3>
              <p>Everyone starts at {TIERS[0].name} I with 0 points. Each rank has three divisions, I, II and III, of {DIVISION_POINTS} points each; fill one and you move up.</p>
            </Slate>
            <Slate size="board" className="sk-rg-rule">
              <h3>Points</h3>
              <p>Finish ahead of other players to gain points, behind them to lose some. Beating someone ranked above you is worth more; losing to someone below you costs more.</p>
            </Slate>
            <Slate size="board" className="sk-rg-rule">
              <h3>Easy at the start</h3>
              <p>A loss costs nothing in {TIERS[0].name}, half in {TIERS[1].name} and three quarters in {TIERS[2].name}. Coming first on your own always gains at least a point.</p>
            </Slate>
            <Slate size="board" className="sk-rg-rule">
              <h3>The games</h3>
              <p>Ranked is {RANKED_MIN_PLAYERS} to {RANKED_MAX_PLAYERS} players, the same rules for everyone, and needs an account. Leaving a game counts as a loss.</p>
            </Slate>
          </div>
        </div>
  );
}
