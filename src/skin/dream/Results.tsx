import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CheckIcon } from '../components/Icons';
import { Slab } from '../kit/modern';
import { CoinArt } from '../shop/art';
import { itemById } from '../shop/catalog';
import { usePayout } from '../shop/Payout';
import { grantStreak } from '../shop/store';
import { Art, QuiltBand } from './Interface';
import { starPlace } from './SkyStars';
import type { StreakSlot } from './streakRow';

/**
 * The results board (docs/dream/v3/09, section 4): a board from the kit with this mode's trim, beside the farmer in
 * his bedroom (a sheet under him on a phone). From the top: the quilt band and its blanket stitch, the title on a
 * ribbon, the count and the best as two tiles side by side with the night's facts, the night sky with one star for
 * each sheep over the night's words, readable, the streak, the coins, the buttons, and when the next dream arrives.
 */
interface Props {
  title: string;
  count: number;
  /** The best this run is measured against, and whether it beat it: the right tile shows the best, or "New best". */
  best: number; newBest: boolean;
  /** The night's facts, one to a line. */
  facts: readonly string[];
  /** Every word of the night in the order it was used, and the night's seed (where each sheep's star goes). */
  words: readonly string[]; seed: string;
  /** Lines the word list may take: three, two on a phone. */
  lines: number;
  /** Not on a practice run: the streak, its longest, and the seven places toward the next Warm Blanket. */
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

/** The most stars the board's sky draws: the newest. */
export const BOARD_STARS = 60;

/**
 * "Your night sky": a strip in world 1's sky colours with the small moon at its right and one star for each sheep
 * counted, each in its place in the window's sky (SkyStars.tsx), scaled to the strip.
 */
function NightStrip({ count, seed }: { count: number; seed: string }) {
  const first = Math.max(1, count - BOARD_STARS + 1);
  return (
    <div className="dr-res-strip" aria-hidden="true">
      {Array.from({ length: Math.max(0, count - first + 1) }, (_, i) => {
        const [fx, fy] = starPlace(seed, first + i);
        // Clear of the moon's end of the strip (its last 56 px).
        return <Art key={i} name="star-plus" px={2} className="dr-res-star" style={{ left: `calc(6px + (100% - 62px) * ${fx.toFixed(3)})`, top: `calc(4px + (100% - 18px) * ${fy.toFixed(3)})` }} />;
      })}
      <Art name="moon-small" px={2} className="dr-res-moon" />
    </div>
  );
}

/**
 * The night's words, readable: the longest first as letter tiles, then the rest in order, newest last, wrapped to
 * `lines` lines; what does not fit is counted as "+N more".
 */
function WordList({ words, lines }: { words: readonly string[]; lines: number }) {
  const longest = words.reduce((a, w) => (w.length > a.length ? w : a), '');
  const rest = words.filter((w) => w !== longest);
  const [shown, setShown] = useState(rest.length);
  const box = useRef<HTMLParagraphElement>(null);
  useEffect(() => setShown(rest.length), [rest.length]);
  // Take words off the end until the list fits its lines.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && shown > 0 && el.scrollHeight > el.clientHeight + 1) setShown(shown - 1);
  });
  if (!longest) return null;
  return (
    <>
      <span className="dr-res-longest" aria-label={`Longest word: ${longest}`}>{[...longest.toUpperCase()].map((ch, i) => <span key={i} className="dr-tile">{ch}</span>)}</span>
      {rest.length > 0 && (
        <p ref={box} className="dr-res-words" style={{ '--lines': lines } as CSSProperties}>
          {rest.slice(0, shown).map((w, i) => <span key={i}>{w.toUpperCase()}</span>)}
          {shown < rest.length && <span className="dr-res-more">{`+${rest.length - shown} more`}</span>}
        </p>
      )}
    </>
  );
}

export function Results({ title, count, best, newBest, facts, words, seed, lines, streak, pay, next, copied, reduced, onShare, onPractice, onClose, note }: Props) {
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
          <div className="dr-res-tiles">
            {/* The nightshirt's pocket: cream with a thin blue stripe, as on him. */}
            <div className="dr-res-pocket" aria-label={`${count} sheep`}><b>{shown}</b><span>sheep</span></div>
            <div className="dr-res-best rc-tile" data-new={newBest || undefined}><span>{newBest ? 'New best' : 'Best'}</span><b>{best}</b></div>
          </div>
          <div className="dr-res-facts">{facts.map((f) => <p key={f}>{f}</p>)}</div>
        </div>
        {note && <p className="dr-res-note">{note}</p>}
        {count > 0 || words.length > 0 ? (
          <div className="dr-res-part">
            <p className="dr-res-label">Your night sky</p>
            <div className="dr-res-sky rc-well">
              <NightStrip count={count} seed={seed} />
              {words.length > 0 && <div className="dr-res-list"><WordList words={words} lines={lines} /></div>}
            </div>
          </div>
        ) : null}
        {streak && (
          <div className="dr-res-card rc-tile">
            <p className="dr-res-head"><b>{`${streak.now}-night streak`}</b><span>{`Longest: ${streak.best}`}</span></p>
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
