import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckIcon } from '../components/Icons';
import { Slab } from '../kit/modern';
import { CoinArt } from '../shop/art';
import { itemById } from '../shop/catalog';
import { usePayout } from '../shop/Payout';
import { grantStreak } from '../shop/store';
import { QuiltBand } from './Interface';
import { moonAt, paintMoon, paintSky, paintStars, skyOf, starsOf } from './scene/common';
import { Painter } from './scene/painter';
import type { SceneState, StageN } from './scene/types';
import { wordDots } from './starWords';
import type { StreakSlot } from './streakRow';

/**
 * The results board (docs/dream/07-opening-endings-results.md, section 4): a board from the kit with this mode's trim,
 * beside the farmer in his bedroom (a sheet under him on a phone). From the top: the quilt band and its blanket
 * stitch, the title on a ribbon, the count on the nightshirt's pocket with the night's facts, the night's words as
 * stars, the streak, the coins, the buttons, and when the next dream arrives.
 */
interface Props {
  title: string;
  count: number;
  /** The night's facts, one to a line. */
  facts: readonly string[];
  /** Every word of the night, in the order they were used, and the stage it reached. */
  words: readonly string[]; stage: StageN; seed: string;
  /** Not on a practice run: the streak, its best, and the seven places toward the next Warm Blanket. */
  streak: { now: number; best: number; days: readonly StreakSlot[] } | null;
  /** What the night pays: the game it is, for the Trading Post's wallet. */
  pay: { id: string; sheep: number; slept: boolean; bestStreak: number };
  /** When the next dream arrives ("12:00 am"); null on a practice run. */
  next: string | null;
  copied: boolean; reduced: boolean;
  onShare: () => void; onPractice: () => void; onClose: () => void;
  /** The line under a practice run's count. */
  note?: ReactNode;
}

/** A number counting up from 0 over `ms` (at once under reduced motion). */
function useCountUp(to: number, ms: number, still: boolean): number {
  const [n, setN] = useState(still ? to : 0);
  useEffect(() => {
    if (still || to <= 0) { setN(to); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); setN(Math.round(to * k)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, still]);
  return n;
}

/**
 * "Your night sky": the sky of the stage the night reached, with its moon, and every word of the night in stars (dots
 * 2 x 2, 3 apart), fading in one after another, 40 ms apart. Its own small canvas, drawn until the last word is in.
 */
function NightSky({ words, stage, seed, reduced }: { words: readonly string[]; stage: StageN; seed: string; reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current, c = el?.getContext('2d');
    if (!el || !c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = el.clientWidth, h = el.clientHeight;
    el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
    // Laid out in rows from the top left, the newest last; if the night had more words than fit, the newest that do.
    const pitch = 3, rowH = 5 * pitch + 9, rows = Math.max(1, Math.floor((h - 8) / rowH));
    const laid: { dots: [number, number][]; x: number; y: number }[] = [];
    const place = (list: readonly string[]) => {
      laid.length = 0;
      let x = 10, row = 0;
      for (const word of list) {
        const d = wordDots(word), width = d.cols * pitch;
        if (x + width > w - 10) { x = 10; row++; }
        if (row >= rows) return false;
        laid.push({ dots: d.dots, x, y: 8 + row * rowH });
        x += width + 14;
      }
      return true;
    };
    let list = [...words];
    while (list.length > 1 && !place(list)) list = list.slice(1);
    if (list.length === 1) place(list);
    const st: SceneState = {
      W: w, H: h, lane: h + 46, scroll: 0, t: 0, beats: 0.5, u: 1, stage, gate: null, arch: null, finale: 0, counted: 0, stream: -1, seed,
      phone: false, low: true, reduced: true, festive: false, breath: 0, fences: [], sheep: { x: 0, lift: 0, w: 0, running: false },
    };
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      const p = new Painter(c, dpr), sky = skyOf(stage);
      paintSky(p, st, sky);
      paintStars(p, st, starsOf(st, 26), stage !== 3);
      // The stage's moon, small, at the sky's right end.
      const m = moonAt(st);
      paintMoon(p, st, { ...m, cx: w - 34, cy: h * 0.42, r: 22 }, sky.bands[1]);
      p.done();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const since = reduced ? 1e6 : now - t0;
      laid.forEach((word, i) => {
        const a = Math.min(1, Math.max(0, (since - i * 40) / 160));
        if (a <= 0) return;
        c.fillStyle = `rgba(187,204,240,${0.9 * a})`;
        for (const [dx, dy] of word.dots) c.fillRect(word.x + dx * pitch, word.y + dy * pitch, 2, 2);
      });
      if (since < laid.length * 40 + 200) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [words, stage, seed, reduced]);
  return <canvas ref={ref} className="dr-res-sky rc-well" aria-hidden="true" />;
}

export function Results({ title, count, facts, words, stage, seed, streak, pay, next, copied, reduced, onShare, onPractice, onClose, note }: Props) {
  const shown = useCountUp(count, 600, reduced);
  const payout = usePayout(pay.id, { mode: 'dream', sheep: pay.sheep, slept: pay.slept });
  const [granted, setGranted] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void grantStreak(pay.bestStreak).then((ids) => { if (live) setGranted(ids.map((i) => itemById(i)?.name ?? i)); });
    return () => { live = false; };
  }, [pay.bestStreak]);
  const tonight = streak ? streak.days.filter((d) => d !== 'empty').length - 1 : -1;
  return (
    <div className="dr-res rc-board" role="dialog" aria-modal="true" aria-label={title}>
      <QuiltBand className="dr-res-band" />
      <i className="dr-res-stitch" aria-hidden="true" />
      <h2 className="dr-res-ribbon"><span>{title}</span></h2>
      <div className="dr-res-scroll">
        <div className="dr-res-top">
          {/* The nightshirt's pocket: cream with a thin blue stripe, as on him. */}
          <div className="dr-res-pocket" aria-label={`${count} sheep`}><b>{shown}</b><span>sheep</span></div>
          <div className="dr-res-facts">{facts.map((f) => <p key={f}>{f}</p>)}</div>
        </div>
        {note && <p className="dr-res-note">{note}</p>}
        {words.length > 0 && (
          <div className="dr-res-part">
            <p className="dr-res-label">Your night sky</p>
            <NightSky words={words} stage={stage} seed={seed} reduced={reduced} />
          </div>
        )}
        {streak && (
          <div className="dr-res-card rc-tile">
            <p className="dr-res-head"><b>{`${streak.now}-night streak`}</b><span>{`best ${streak.best}`}</span></p>
            {/* The seven places toward the next Warm Blanket: earned ones lit with a check, tonight's ringed. */}
            <div className="dr-res-days" aria-hidden="true">
              {streak.days.map((d, i) => <i key={i} data-s={d === 'empty' || d === 'missed' ? undefined : 'on'} data-today={i === tonight || undefined}>{d !== 'empty' && d !== 'missed' && <CheckIcon size={12} />}</i>)}
            </div>
            <p className="dr-res-small">Every 7 nights earns a Warm Blanket. It saves your streak if you miss a night.</p>
          </div>
        )}
        {(payout || granted.length > 0) && (
          <div className="dr-res-card rc-tile" aria-label={payout ? `You earned ${payout.coins} Wool Coins` : undefined}>
            {payout && <p className="dr-res-head"><CoinArt size={18} /><b>{`+${payout.coins} Wool Coins`}</b></p>}
            {payout && (
              <ul className="dr-res-rows">
                {payout.lines.map((l, i) => <li key={l.label} style={{ animationDelay: `${i * 80}ms` }}><span>{l.label}</span><span>{l.coins >= 0 ? `+${l.coins}` : l.coins}</span></li>)}
              </ul>
            )}
            {payout && payout.bells > 0 && <p className="dr-res-small">+{payout.bells} Golden Bell{payout.bells === 1 ? '' : 's'}</p>}
            {payout && payout.items.length > 0 && <p className="dr-res-small">Mission done! New in your collection: {payout.items.map((i) => itemById(i)?.name ?? i).join(', ')}.</p>}
            {payout?.levelUp && <p className="dr-res-small">Level {payout.levelUp.to}!{payout.levelUp.title ? ` You are now a ${payout.levelUp.title}.` : ''}</p>}
            {granted.length > 0 && <p className="dr-res-small">New in the Trading Post: {granted.join(', ')}, yours for your dream streak.</p>}
          </div>
        )}
      </div>
      <div className="dr-res-buttons">
        <Slab tone="lantern" onClick={onShare} autoFocus>{copied ? 'Copied!' : 'Share'}</Slab>
        <Slab onClick={onPractice}>Practice</Slab>
        <Slab onClick={onClose}>Back to the farm</Slab>
      </div>
      {next && <p className="dr-res-foot">The next dream arrives at {next}.</p>}
    </div>
  );
}
