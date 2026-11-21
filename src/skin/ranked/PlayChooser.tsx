import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../auth/config';
import { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, rankOf } from '../../lib/ranked';
import { CloseIcon } from '../components/Icons';
import { RankBadge, TierBadge } from './RankBadge';
import { useRanked } from './rankedStore';
import './ranked.css';

const ART = (name: 'casual' | 'ranked') => `${import.meta.env.BASE_URL}play/${name}.webp`;

/** How often the open chooser asks the server how many are playing. */
export const COUNTS_EVERY_MS = 10_000;

/**
 * How many people are in each mode right now (Brian, 2026-11-21: "show how many players are playing each gamemode"),
 * from GET /api/play/counts while the chooser is open. Null until the first answer, and always without a game server:
 * the cards then simply show no count.
 */
export function usePlayCounts(): { casual: number; ranked: number } | null {
  const [counts, setCounts] = useState<{ casual: number; ranked: number } | null>(null);
  useEffect(() => {
    const base = apiBase();
    if (!base) return;
    let gone = false;
    const ask = () => {
      fetch(`${base}/api/play/counts`, { credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { casual?: unknown; ranked?: unknown } | null) => {
          if (!gone && j && typeof j.casual === 'number' && typeof j.ranked === 'number') setCounts({ casual: j.casual, ranked: j.ranked });
        })
        .catch(() => undefined);
    };
    ask();
    const timer = setInterval(ask, COUNTS_EVERY_MS);
    return () => { gone = true; clearInterval(timer); };
  }, []);
  return counts;
}

/** The count's words: "12 playing", or an invitation when nobody is in yet. */
export function playingLabel(n: number): string {
  return n > 0 ? `${n.toLocaleString()} playing` : 'Be the first in';
}

function Live({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="sk-play-live" data-empty={n === 0 || undefined} aria-live="polite"><i aria-hidden="true" />{playingLabel(n)}</span>;
}

/**
 * What Queue opens (Brian, 2026-11-13: "when u press play, it gives u two options that pop up on ur screen, casual and
 * ranked. make the casual side popup be a relaxed sort of sheep icon background/scenery and the ranked look more like
 * a competitive thing"). Two cards, both for games with real people. Since 2026-11-21 (Brian) the pictures are pixel
 * art drawn by tools/art/playArt.js (Casual: a sheep among sunflowers at sunset; Ranked: a three-panel neon face-off),
 * each card shows how many people are in that mode now (usePlayCounts), and on Home the box is a nailed barn board
 * (home.css). Ranked also shows your rank and the ladder you climb.
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
  const counts = usePlayCounts();
  return (
    <div className="sk-play" role="dialog" aria-modal="true" aria-label="Queue" onClick={onClose}>
      <div className="sk-play-box" onClick={(e) => e.stopPropagation()}>
        <div className="sk-play-head">
          <div className="sk-play-title">
            <span className="sk-play-kicker">Queue</span>
            <h2>Play with real people</h2>
          </div>
          <button type="button" className="hm-close hm-slab hm-slab--wool hm-slab--sm" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={16} /></button>
        </div>
        {error && <p className="sk-play-error" role="alert">{error}</p>}
        <div className="sk-play-cards">
          <section className="sk-play-card kit-paper" data-mode="casual" aria-label="Casual">
            <div className="sk-play-frame">
              <img className="sk-play-art" src={ART('casual')} alt="" width={1440} height={900} />
              <Live n={counts?.casual} />
              <h3 className="sk-play-tag">Casual</h3>
            </div>
            <div className="sk-play-body">
              <p className="sk-play-line">We find you an open barn with real people. Nothing rides on it.</p>
              <ul className="sk-play-facts">
                <li>Any number of players</li>
                <li>No account needed</li>
              </ul>
              <button ref={first} type="button" className="sk-play-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onCasual}>Find a game</button>
            </div>
          </section>
          <section className="sk-play-card" data-mode="ranked" aria-label="Ranked">
            <div className="sk-play-frame">
              <img className="sk-play-art" src={ART('ranked')} alt="" width={1024} height={640} />
              <Live n={counts?.ranked} />
              <h3 className="sk-play-tag">Ranked</h3>
            </div>
            <div className="sk-play-body">
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
