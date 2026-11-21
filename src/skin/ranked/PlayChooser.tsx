import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { apiBase } from '../../auth/config';
import { RANKED_MAX_PLAYERS, RANKED_MIN_PLAYERS, TIERS, rankOf } from '../../lib/ranked';
import { RankBadge, TierBadge } from './RankBadge';
import { useRanked } from './rankedStore';
import './ranked.css';
import './chooser.css';

type Art = 'casual' | 'casual-clouds' | 'casual-field' | 'bee' | 'ranked';
const ART = (name: Art) => `${import.meta.env.BASE_URL}play/${name}.webp`;

/** How often the open chooser asks the server how many are playing. */
export const COUNTS_EVERY_MS = 10_000;

/**
 * How many people are in each mode right now (Brian, 2026-11-21: "show how many players are playing each gamemode"),
 * from GET /api/play/counts while the chooser is open. Null until the first answer, and always without a game server:
 * the tags then simply are not there.
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

/** The count's words, in each side's own voice; an invitation when nobody is in yet. */
export function playingLabel(n: number, mode: 'casual' | 'ranked' = 'casual'): string {
  if (n <= 0) return 'Be the first in';
  return mode === 'casual' ? `${n.toLocaleString()} in the barn` : `${n.toLocaleString()} squaring up`;
}

const still = () => {
  try { return document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};

/** A felt tag tied on with yarn: how many are in this mode now. Not there without a count. */
function Tag({ n, mode }: { n: number | undefined; mode: 'casual' | 'ranked' }) {
  if (n === undefined) return null;
  return <span className="qz-tag" data-empty={n === 0 || undefined} aria-live="polite"><i aria-hidden="true" />{playingLabel(n, mode)}</span>;
}

/**
 * The bees over the meadow: where each one hovers (per cent of the meadow), how big it is, and how long one lap of its
 * wander takes. The far ones small and slow, the near ones big, in front of the flowers.
 */
const BEES: { x: number; y: number; s: number; t: number; near?: boolean }[] = [
  { x: 8, y: 16, s: 0.7, t: 7 }, { x: 22, y: 9, s: 0.55, t: 9 }, { x: 37, y: 24, s: 0.6, t: 6.5 }, { x: 47, y: 12, s: 0.5, t: 8 },
  { x: 14, y: 38, s: 0.8, t: 5.5 }, { x: 41, y: 44, s: 0.65, t: 7.5 }, { x: 5, y: 62, s: 1.5, t: 6, near: true }, { x: 34, y: 70, s: 1.9, t: 5, near: true },
];

/**
 * Streaks of light falling through the face-off, each in the colour of the panel it falls in, drawn chunky (a third of
 * the screen's pixels, scaled up square). Nothing under reduced motion: the picture holds still.
 */
function LightRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || still()) return;
    const LIGHT = ['#9CF2FF', '#FF9AE6', '#D4FF7A']; // the three panels of the picture, left to right
    let w = 1, h = 1;
    const fit = () => { w = cv.width = Math.max(1, Math.ceil(cv.clientWidth / 3)); h = cv.height = Math.max(1, Math.ceil(cv.clientHeight / 3)); };
    fit();
    type Drop = { x: number; y: number; len: number; v: number; a: number };
    const drop = (anywhere: boolean): Drop => ({ x: Math.floor(Math.random() * w), y: anywhere ? Math.random() * h : -Math.random() * 40, len: 6 + Math.random() * 26, v: 2 + Math.random() * 5, a: 0.2 + Math.random() * 0.55 });
    const drops = Array.from({ length: 80 }, () => drop(true));
    let raf = 0, last = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33 || document.hidden) return; // thirty frames a second is plenty for falling light
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        d.y += d.v;
        if (d.y - d.len > h) Object.assign(d, drop(false));
        ctx.globalAlpha = d.a;
        ctx.fillStyle = LIGHT[d.x / w < 0.36 ? 0 : d.x / w < 0.64 ? 1 : 2];
        ctx.fillRect(d.x, Math.round(d.y - d.len), 1, Math.round(d.len));
      }
    };
    raf = requestAnimationFrame(frame);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(cv);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, []);
  return <canvas ref={ref} className="qz-rain" aria-hidden="true" />;
}

/** A pair of scissors in pixels: closing snips the thread. */
function Scissors() {
  const d = ['M3 2h2v1H3z', 'M2 3h1v3H2z', 'M5 3h1v3H5z', 'M3 6h2v1H3z', 'M11 2h2v1h-2z', 'M10 3h1v3h-1z', 'M13 3h1v3h-1z', 'M11 6h2v1h-2z',
    'M6 6h1v1H6z', 'M7 7h2v2H7z', 'M9 6h1v1H9z', 'M6 9h1v1H6z', 'M5 10h1v1H5z', 'M4 11h1v1H4z', 'M9 9h1v1H9z', 'M10 10h1v1h-1z', 'M11 11h1v1h-1z', 'M3 12h1v2H3z', 'M12 12h1v2h-1z'];
  return <svg viewBox="0 0 16 16" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true"><path fill="currentColor" d={d.join('')} /></svg>;
}

function Bee({ x, y, s, t, near }: { x: number; y: number; s: number; t: number; near?: boolean }) {
  return (
    <span className="qz-bee" data-near={near || undefined} style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': s, '--t': `${t}s`, '--d': `${-(x % 5)}s` } as CSSProperties}>
      <img src={ART('bee')} alt="" width={54} height={48} />
    </span>
  );
}

/**
 * What Queue opens (Brian, 2026-11-13; then 2026-11-21: "it should be unique, and ideally not a card ... be novel",
 * inspired by Persona's and Friday Night Funkin's menus, not copied from them). The whole screen becomes the choice:
 * the meadow on the left, alive (its layers move apart as the pointer moves, bees wander and bob on the beat), the
 * face-off on the right with light raining through it, the two sewn together down a slanted seam of yarn that a needle
 * stitches as the chooser opens. Pointing at a side pulls the seam across and dims the other. The names are knitted
 * letters, the counts are felt tags, the heading is a stitched ribbon hanging over the seam, and closing is a snip.
 *
 * `rank` says what the Ranked side can do: play, or ask for a sign-in first (a guest has no rating to play for).
 */
export function PlayChooser({ onClose, onCasual, onRanked, onSignIn, rank, busy, error }: {
  onClose: () => void; onCasual: () => void; onRanked: () => void; onSignIn: () => void;
  rank: 'play' | 'signin'; busy: boolean; error?: string;
}) {
  const me = useRanked((s) => s.me);
  const first = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hot, setHot] = useState<'casual' | 'ranked' | null>(null);
  // Where the pointer was when the chooser opened: the browser reports a "move" when the page changes under a pointer
  // that has not moved, so a side only leads once the pointer has really travelled.
  const from = useRef<{ x: number; y: number } | null>(null);
  const travelled = (e: ReactPointerEvent) => {
    if (!from.current) { from.current = { x: e.clientX, y: e.clientY }; return false; }
    return Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 8;
  };
  // Focus goes to the first button, and back to whatever opened the chooser (Queue) when it shuts.
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
  // The meadow's layers lean away from the pointer, each by its own depth (chooser.css), -1 to 1 across the screen.
  const lean = (e: ReactPointerEvent) => {
    const el = root.current;
    if (!el || e.pointerType !== 'mouse') return;
    el.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    el.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };
  // Pointing at a side, or tabbing to it, makes it the one you are looking at. The chooser opens with the first button
  // focused for the keyboard, which must not count: at rest, neither side leads.
  const tabbed = useRef(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Tab') tabbed.current = true; };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const side = (mode: 'casual' | 'ranked') => ({
    onPointerMove: (e: ReactPointerEvent) => { if (hot !== mode && travelled(e)) setHot(mode); },
    onFocus: () => { if (tabbed.current) setHot(mode); },
  });
  return (
    <div ref={root} className="sk-play qz" role="dialog" aria-modal="true" aria-label="Queue" data-hot={hot ?? undefined} onPointerMove={lean}>
      <section className="qz-side" data-mode="casual" aria-label="Casual" {...side('casual')}>
        <div className="qz-scene" aria-hidden="true">
          <div className="qz-layer" data-depth="1"><img src={ART('casual')} alt="" width={1440} height={900} /></div>
          <div className="qz-layer qz-clouds" data-depth="2"><img src={ART('casual-clouds')} alt="" width={1440} height={900} /></div>
          {BEES.filter((b) => !b.near).map((b, i) => <Bee key={`f${i}`} {...b} />)}
          <div className="qz-layer" data-depth="3"><img src={ART('casual-field')} alt="" width={1440} height={900} /></div>
          {BEES.filter((b) => b.near).map((b, i) => <Bee key={`n${i}`} {...b} />)}
        </div>
        <div className="qz-copy">
          <Tag n={counts?.casual} mode="casual" />
          <h3 className="qz-title">Casual</h3>
          <p className="qz-line">We find you an open barn with real people. Nothing rides on it.</p>
          <ul className="qz-facts">
            <li>Any number of players</li>
            <li>No account needed</li>
          </ul>
          <button ref={first} type="button" className="qz-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onCasual}>Find a game</button>
        </div>
      </section>

      <section className="qz-side" data-mode="ranked" aria-label="Ranked" {...side('ranked')}>
        <div className="qz-scene" aria-hidden="true">
          <img className="qz-art" src={ART('ranked')} alt="" width={1024} height={1024} />
          <LightRain />
        </div>
        <div className="qz-copy">
          <Tag n={counts?.ranked} mode="ranked" />
          <h3 className="qz-title">Ranked</h3>
          <p className="qz-line">People only, the same rules for everyone. Finish higher, gain points, rank up.</p>
          <ul className="qz-facts">
            <li>{RANKED_MIN_PLAYERS} to {RANKED_MAX_PLAYERS} players</li>
            <li>Leaving a game counts as a loss</li>
          </ul>
          <div className="qz-ladder" aria-label={`The ranks, lowest first: ${TIERS.map((t) => t.name).join(', ')}`}>
            {TIERS.map((t, i) => <span key={t.id} data-on={mine?.tier === i || undefined} title={t.name}><TierBadge tier={i} size={24} /></span>)}
          </div>
          {rank === 'play' && (
            <p className="qz-rank" aria-live="polite">
              {me && mine ? (
                <><RankBadge rating={me.rating} size={30} /><span><b>{mine.label}</b><small>{me.games > 0 ? `${me.rating} points, ${me.wins} win${me.wins === 1 ? '' : 's'} in ${me.games}` : 'Your first ranked game starts the climb.'}</small></span></>
              ) : <span><b>Unranked</b><small>{`Everyone starts at ${TIERS[0].name} I.`}</small></span>}
            </p>
          )}
          {rank === 'play'
            ? <button type="button" className="qz-go hm-slab hm-slab--lantern hm-knit" disabled={busy} onClick={onRanked}>Find a ranked game</button>
            : <button type="button" className="qz-go hm-slab hm-knit" onClick={onSignIn}>Sign in to play ranked</button>}
          {rank === 'signin' && <p className="qz-note">Your rank is kept on your account.</p>}
        </div>
      </section>

      <div className="qz-seam" aria-hidden="true"><i className="qz-needle" /></div>
      <div className="qz-ribbon"><div className="qz-cloth"><h2>Play with real people</h2><small>Pick a side</small></div></div>
      {error && <p className="qz-error" role="alert">{error}</p>}
      <button type="button" className="qz-snip hm-slab hm-slab--sm" onClick={onClose} aria-label="Close" title="Close"><Scissors /></button>
    </div>
  );
}
