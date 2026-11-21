import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../auth/config';
import { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, rankOf } from '../../lib/ranked';
import { CloseIcon } from '../components/Icons';
import { RankBadge, TierBadge } from './RankBadge';
import { useRanked } from './rankedStore';
import './ranked.css';
import './chooser.css';

type Art = 'casual' | 'casual-snow' | 'ranked' | 'ranked-flash';
const ART = (name: Art) => `${import.meta.env.BASE_URL}play/${name}.webp`;

/** How often the open chooser asks the server how many are playing. */
export const COUNTS_EVERY_MS = 10_000;

/**
 * How many people are in each mode right now (Brian, 2026-11-21: "show how many players are playing each gamemode"),
 * from GET /api/play/counts while the chooser is open. Null until the first answer, and always without a game server:
 * the counts then simply are not there.
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

/** How many are in this mode now, on a small block in the picture's corner. Not there without a count. */
function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="qz-count" data-empty={n === 0 || undefined} aria-live="polite"><i aria-hidden="true" />{playingLabel(n)}</span>;
}

/**
 * What Queue opens (Brian, 2026-11-13; redrawn 2026-11-21: "it should still be a popup ... rehash everything solely with
 * pixel art ... one looks casual/playful/nonstressful, while the other one looks exciting and competitive"). A popup in
 * Home's own slabs with two windows onto pixel-art scenes drawn by tools/art/playArt.js: Casual is a snow day on the
 * farm (snow falling over it), Ranked a night match on the rink (the crowd's flashes blinking). Each window has its
 * count in the corner and a plate along its foot with the mode's name, what it is, and the way in.
 *
 * `rank` says what the Ranked side can do: play, or ask for a sign-in first (a guest has no rating to play for).
 */
export function PlayChooser({ onClose, onCasual, onRanked, onSignIn, rank, busy, error }: {
  onClose: () => void; onCasual: () => void; onRanked: () => void; onSignIn: () => void;
  rank: 'play' | 'signin'; busy: boolean; error?: string;
}) {
  const me = useRanked((s) => s.me);
  const first = useRef<HTMLButtonElement>(null);
  // Focus goes to the first button, and back to whatever opened the chooser (Queue) when it shuts, so the menu keeps
  // Queue lit instead of dropping its highlight when the chooser closes.
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
    <div className="sk-play qz" role="dialog" aria-modal="true" aria-label="Queue" onClick={onClose}>
      <div className="qz-box" onClick={(e) => e.stopPropagation()}>
        <div className="qz-head">
          <span className="qz-kicker">Queue</span>
          <h2>Play with real people</h2>
          <button type="button" className="qz-close hm-slab hm-slab--sm" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={16} /></button>
        </div>
        {error && <p className="qz-error" role="alert">{error}</p>}
        <div className="qz-tiles">
          <section className="qz-tile" data-mode="casual" aria-label="Casual">
            <div className="qz-window" aria-hidden="true">
              <img className="qz-art" src={ART('casual')} alt="" width={800} height={880} />
              <span className="qz-snow" style={{ backgroundImage: `url(${ART('casual-snow')})` }} />
            </div>
            <Count n={counts?.casual} />
            <div className="qz-plate">
              <div className="qz-name"><h3>Casual</h3></div>
              <ul className="qz-facts">
                <li>Any number of players</li>
                <li>No account needed</li>
              </ul>
              <button ref={first} type="button" className="qz-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onCasual}>Find a game</button>
            </div>
          </section>

          <section className="qz-tile" data-mode="ranked" aria-label="Ranked">
            <div className="qz-window" aria-hidden="true">
              <img className="qz-art" src={ART('ranked')} alt="" width={800} height={880} />
              <img className="qz-flash" src={ART('ranked-flash')} alt="" width={800} height={880} />
            </div>
            <Count n={counts?.ranked} />
            <div className="qz-plate">
              <div className="qz-name">
                <h3>Ranked</h3>
                <div className="qz-ladder" aria-label={`The ranks, lowest first: ${TIERS.map((t) => t.name).join(', ')}`}>
                  {TIERS.map((t, i) => <span key={t.id} data-on={mine?.tier === i || undefined} title={t.name}><TierBadge tier={i} size={18} /></span>)}
                </div>
              </div>
              <ul className="qz-facts">
                <li>{`${RANKED_MIN_PLAYERS} to ${RANKED_MAX_PLAYERS} players`}</li>
                <li>Leaving a game counts as a loss</li>
                {rank === 'play' && me && mine && <li className="qz-mine" aria-live="polite"><RankBadge rating={me.rating} size={16} />{mine.label}</li>}
              </ul>
              {rank === 'play'
                ? <button type="button" className="qz-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onRanked}>Find a ranked game</button>
                : <button type="button" className="qz-go hm-slab hm-knit" onClick={onSignIn}>Sign in to play ranked</button>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
