import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../auth/config';
import { DIVISION_POINTS, rankOf } from '../../lib/ranked';
import type { RankedMe } from './rankedStore';
import { CloseIcon } from '../components/Icons';
import { TierBadge } from './RankBadge';
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

/** How many are in this mode now, beside the mode's name. Not there without a count. */
function Count({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="qz-count" data-empty={n === 0 || undefined} aria-live="polite"><i aria-hidden="true" />{playingLabel(n)}</span>;
}

/**
 * Where you stand on the ladder, for the Ranked plate (Brian, 2026-11-21: "only show your own rank ... a bar of how
 * progressed you are IN that rank showing how close u r to rankup"): the rank's badge and name, how far through it you
 * are (0 to 1), and what is left. With no rating yet it is the first rank, empty; at the top rank the bar is full.
 */
export function rankProgress(me: RankedMe | null, signedIn: boolean): { tier: number; label: string; share: number; note: string; none: boolean } {
  if (!signedIn) return { tier: 0, label: 'No rank yet', share: 0, note: 'Sign in to climb', none: true };
  const r = rankOf(me?.rating ?? 0);
  if (r.toNext === null) return { tier: r.tier, label: r.label, share: 1, note: 'Top rank', none: false };
  return { tier: r.tier, label: r.label, share: r.points / DIVISION_POINTS, note: `${r.toNext} to ${r.next}`, none: false };
}

function MyRank({ me, signedIn }: { me: RankedMe | null; signedIn: boolean }) {
  const p = rankProgress(me, signedIn);
  return (
    <div className="qz-row qz-mine" data-none={p.none || undefined}>
      <TierBadge tier={p.tier} size={22} />
      <b>{p.label}</b>
      <span className="qz-bar" role="progressbar" aria-label={`Progress in ${p.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.share * 100)}>
        <i style={{ width: `${p.share * 100}%` }} />
      </span>
      <small>{p.note}</small>
    </div>
  );
}

/**
 * What Queue opens (Brian, 2026-11-13; redrawn 2026-11-21: "it should still be a popup ... rehash everything solely with
 * pixel art ... one looks casual/playful/nonstressful, while the other one looks exciting and competitive"). A popup in
 * Home's own slabs with two windows onto pixel-art scenes drawn by tools/art/playArt.js: Casual is a snow day on the
 * farm (snow falling over it), Ranked a night match on the rink (the crowd's flashes blinking). Under each picture
 * hangs a plate of three rows, the same in both: the mode's name with how many are playing, then what it is (Casual)
 * or your own rank and how close you are to the next (Ranked), then the way in.
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
            <div className="qz-plate">
              <div className="qz-name"><h3>Casual</h3><Count n={counts?.casual} /></div>
              <ul className="qz-row qz-facts">
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
            <div className="qz-plate">
              <div className="qz-name"><h3>Ranked</h3><Count n={counts?.ranked} /></div>
              <MyRank me={me} signedIn={rank === 'play'} />
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
