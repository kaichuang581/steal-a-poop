import { useEffect, useRef } from 'react';
import { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, rankOf } from '../../lib/ranked';
import { CloseIcon } from '../components/Icons';
import { RankBadge, TierBadge } from './RankBadge';
import { useRanked } from './rankedStore';
import './ranked.css';

const ART = (name: 'casual' | 'ranked') => `${import.meta.env.BASE_URL}play/${name}.webp`;

/**
 * What Queue opens (Brian, 2026-11-13: "when u press play, it gives u two options that pop up on ur screen, casual and
 * ranked. make the casual side popup be a relaxed sort of sheep icon background/scenery and the ranked look more like
 * a competitive thing"). Two cards, both for games with real people. Casual is the farm by day on cream paper;
 * Ranked is the face-off on the ice at night on slate, with your rank and the ladder you climb.
 *
 * `rank` says what the Ranked card can do: play, ask for a sign-in first (a guest has no rating to play for), or
 * nothing at all (this copy of the game has no server).
 */
export function PlayChooser({ onClose, onCasual, onRanked, onSignIn, rank, busy, error }: {
  onClose: () => void; onCasual: () => void; onRanked: () => void; onSignIn: () => void;
  rank: 'play' | 'signin'; busy: boolean; error?: string;
}) {
  const me = useRanked((s) => s.me);
  const first = useRef<HTMLButtonElement>(null);
  // Focus goes to the first card's button, and back to whatever opened the chooser (Queue) when it shuts, so the menu
  // keeps Queue lit instead of dropping its highlight (and its slight shift) when the chooser closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    first.current?.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (rank === 'play') void useRanked.getState().load(); }, [rank]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  const mine = me ? rankOf(me.rating) : null;
  return (
    <div className="sk-play" role="dialog" aria-modal="true" aria-label="Queue" onClick={onClose}>
      <div className="sk-play-box" onClick={(e) => e.stopPropagation()}>
        <div className="sk-play-head">
          <h2>Play with real people</h2>
          <button type="button" className="hm-close hm-slab hm-slab--wool hm-slab--sm" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={16} /></button>
        </div>
        {error && <p className="sk-play-error" role="alert">{error}</p>}
        <div className="sk-play-cards">
          <section className="sk-play-card kit-paper" data-mode="casual" aria-label="Casual">
            <img className="sk-play-art" src={ART('casual')} alt="" width={800} height={500} />
            <div className="sk-play-body">
              <h3>Casual</h3>
              <p className="sk-play-line">We find you an open barn with real people. Nothing rides on it.</p>
              <ul className="sk-play-facts">
                <li>Any number of players</li>
                <li>No account needed</li>
              </ul>
              <button ref={first} type="button" className="sk-play-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onCasual}>Find a game</button>
            </div>
          </section>
          <section className="sk-play-card" data-mode="ranked" aria-label="Ranked">
            <img className="sk-play-art" src={ART('ranked')} alt="" width={800} height={500} />
            <div className="sk-play-body">
              <h3>Ranked</h3>
              <p className="sk-play-line">People only, the same rules for everyone. Finish higher, gain points, rank up.</p>
              <ul className="sk-play-facts">
                <li>{RANKED_MIN_PLAYERS} to {RANKED_MAX_PLAYERS} players</li>
                <li>Leaving a game counts as a loss</li>
              </ul>
              <div className="sk-play-ladder" aria-label={`The ranks, lowest first: ${TIERS.map((t) => t.name).join(', ')}`}>
                {TIERS.map((t, i) => <span key={t.id} data-on={mine?.tier === i || undefined} title={t.name}><TierBadge tier={i} size={26} /></span>)}
              </div>
              {rank === 'play' && (
                <p className="sk-play-rank" aria-live="polite">
                  {me && mine ? (
                    <><RankBadge rating={me.rating} size={34} /><span><b>{mine.label}</b><small>{me.games > 0 ? `${me.rating} points, ${me.wins} win${me.wins === 1 ? '' : 's'} in ${me.games}` : 'Your first ranked game starts the climb.'}</small></span></>
                  ) : <span><b>Unranked</b><small>{`Everyone starts at ${TIERS[0].name} I.`}</small></span>}
                </p>
              )}
              {rank === 'play'
                ? <button type="button" className="sk-play-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onRanked}>Find a ranked game</button>
                : <button type="button" className="sk-play-go hm-slab hm-slab--wool hm-knit" onClick={onSignIn}>Sign in to play ranked</button>}
              {rank === 'signin' && <p className="sk-play-note">Your rank is kept on your account.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
