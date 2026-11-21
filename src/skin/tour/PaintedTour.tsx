import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../../state/roomStore';
import { useStore } from '../../state/store';
import { ClothButton, WoodButton } from '../kit';
import { enterOnline, onlinePlay } from '../rooms/enterOnline';
import { loadIdeaRanks } from './ideas';
import { RING_PAD, covered, markRect, ringFor } from './marks';
import type { MarkRect } from './marks';
import { TOUR_STEPS, enterMovesOn } from './steps';
import type { TourTarget } from './steps';
import './tour.css';

/**
 * The tutorial's guide in the painted game: one card in the kit's own paper, with the farm's sheepdog on it, and a ring
 * round whatever the card is talking about (the letter board, the word bar, the bomb, your name). It replaces the old
 * look's Tour for this skin (src/ui/Tour.tsx, which the old look keeps): that one blacked the table out to 72%, pointed
 * at things this skin does not have, and lost a card to the Enter key.
 *
 * The table stays in view. On a card to read the clock is stopped and the rest of the screen is dimmed a little; on a
 * step where the player acts nothing is dimmed and the card keeps out of the way: under the scoreboard where that is
 * a board at the side (a computer, a tablet), across the top under the bar where it is a row of names (a phone).
 */
interface Layout { left: number; top: number; width: number; side: boolean; ring: MarkRect | null }

/** How much of a thing the card may lie over and still have it ringed: the ring passes behind the card's corner. More
 *  than this and the thing is as good as hidden, so the next thing the step names is tried instead. */
const HIDDEN = 0.4;


/** Where a target is on screen right now, or null when it is not there to be pointed at. */
function rectOf(target: TourTarget): MarkRect | null {
  if (target.startsWith('mark:')) {
    const m = markRect(target.slice(5));
    return m && m.width > 4 && m.height > 4 ? m : null;
  }
  let el: Element | null = null;
  try { el = document.querySelector(target); } catch { return null; } // a browser without :has()
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) return null;
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/** Where the card goes and what gets the ring, re-measured every frame: the camera moves, and so do the name plates. */
function useLayout(targets: readonly TourTarget[], card: React.RefObject<HTMLDivElement | null>): Layout {
  const [layout, setLayout] = useState<Layout>({ left: -9999, top: 0, width: 320, side: true, ring: null });
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const h = card.current?.offsetHeight ?? 180;
      // The scoreboard is a board at the side on a computer or a tablet, and a row of names across the top on a phone.
      const board = document.querySelector('.sk-ledger')?.getBoundingClientRect();
      const side = !!board && board.height > 0 && vw >= 640;
      const width = side ? 320 : Math.min(372, vw - 16);
      const left = side ? Math.max(16, Math.min(board.right, vw - 12) - width) : (vw - width) / 2;
      let top = Math.max(8, Math.min(side ? board.bottom + 12 : 64, vh - h - 12));
      const bar = document.querySelector('.sk-input-prompt, .sk-input-bar')?.getBoundingClientRect();
      // The first thing on screen that the card is not sitting on. Across the top of a phone the card lies over the
      // row of names, so your name there is pointed at by moving the card down to just under it, when it still
      // clears the word bar. Failing both, no ring: one under the card helps nobody.
      let ring: MarkRect | null = null;
      for (const t of targets) {
        const r = rectOf(t);
        if (!r) continue;
        if (covered({ x: left, y: top, width, height: h }, r) <= HIDDEN) { ring = r; break; }
        const below = r.y + r.height + RING_PAD + 8;
        if (!side && r.y + r.height < vh * 0.3 && below + h < (bar ? bar.top : vh * 0.7) - 8) { top = below; ring = r; break; }
      }
      const next: Layout = {
        left: Math.round(left), top: Math.round(top), width, side,
        ring: ring && ringFor(ring, vw, vh),
      };
      setLayout((prev) => (prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.side === next.side
        && prev.ring?.x === next.ring?.x && prev.ring?.y === next.ring?.y && prev.ring?.width === next.ring?.width && prev.ring?.height === next.ring?.height ? prev : next));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [targets, card]);
  return layout;
}

const DOG = `${import.meta.env.BASE_URL}tour/sheepdog.webp`;

export function PaintedTour() {
  const game = useStore((s) => s.game)!;
  const mySeat = useStore((s) => s.mySeat);
  const pause = useStore((s) => s.pause);
  const resume = useStore((s) => s.resume);
  const endTour = useStore((s) => s.endTour);
  const afterTour = useStore((s) => s.afterTour);
  const [i, setI] = useState(0);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;
  const ctx = { game, mySeat };
  const card = useRef<HTMLDivElement>(null);
  const layout = useLayout(step.targets, card);
  const shownAt = useRef(0);
  const next = () => setI((n) => Math.min(n + 1, TOUR_STEPS.length - 1));
  // The game after the tutorial is a real one: straight into the casual queue with real people, never a table of
  // farm sheep (Brian, 2026-11-13: "make the 'after tutorial first game thing' queue them into a real game not a bot
  // lobby"). If that cannot be done (no name on the plate yet), the menu says why.
  const real = onlinePlay();
  const toRealGame = () => {
    endTour('menu');
    const problem = enterOnline({ t: 'quick' });
    if (problem) useRoomStore.setState({ notice: problem });
  };
  const leave = () => (afterTour === 'quick' && real ? toRealGame() : endTour('menu'));

  // The hint book offers everyday words (ideas.ts), which needs the frequency list: ask for it now, so it is in by
  // the time the first word is wanted.
  useEffect(() => { void loadIdeaRanks(); }, []);

  // A card to read stops the clock; a step to play lets it run.
  useEffect(() => {
    shownAt.current = performance.now();
    if (step.kind === 'info') pause();
    else resume();
  }, [step, pause, resume]);

  // A step to play moves on by itself once the thing is done, after a moment to see it happen.
  const done = step.kind === 'wait' && !!step.done?.(ctx);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(next, step.linger ?? 600);
    return () => clearTimeout(id);
  }, [done, step]);

  // Enter moves a card on. It is taken before the word bar sees it, so it never also plays a word; and it is ignored
  // for a moment after a card comes up, so the Enter that played a word (or a held key) cannot dismiss the card it brought.
  useEffect(() => {
    if (step.kind !== 'info' || last) return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (enterMovesOn(performance.now() - shownAt.current, e.repeat)) next();
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [step, last]);

  const info = step.kind === 'info';
  const note = step.note?.(ctx);
  const ring = layout.ring;
  return (
    <div className="sk-tour" role="dialog" aria-label="Tutorial">
      {info && (ring
        ? <div className="sk-tour-dim" style={{ left: ring.x, top: ring.y, width: ring.width, height: ring.height }} aria-hidden="true" />
        : <div className="sk-tour-dim sk-tour-dim--all" aria-hidden="true" />)}
      {ring && <div key={step.id} className="sk-tour-ring" style={{ left: ring.x, top: ring.y, width: ring.width, height: ring.height }} aria-hidden="true" />}
      <div ref={card} className="kit-paper kit-paper--note sk-tour-card" style={{ left: layout.left, top: layout.top, width: layout.width }} data-kind={step.kind} data-dock={layout.side ? 'side' : 'top'}>
        <div className="sk-tour-head">
          <span className="sk-tour-dog"><img src={DOG} alt="" width={48} height={48} /></span>
          <div className="sk-tour-meta">
            <span className="sk-tour-kicker">{`Tutorial, step ${i + 1} of ${TOUR_STEPS.length}`}</span>
            <span className="sk-tour-pips" aria-hidden="true">{TOUR_STEPS.map((s, k) => <i key={s.id} data-on={k < i ? 'done' : k === i ? 'now' : undefined} />)}</span>
          </div>
        </div>
        <div key={step.id} className="sk-tour-text" aria-live="polite">
          <h2 className="sk-tour-title">{step.title}</h2>
          <p className="sk-tour-body">{step.body(ctx)}</p>
          {note && <p className="sk-tour-note">{note}</p>}
        </div>
        <div className="sk-tour-actions">
          {info && !last && <WoodButton className="kit-btn--sm sk-tour-next" onClick={next}>{step.next ?? 'Next'}<b className="sk-tour-key" aria-hidden="true">Enter</b></WoodButton>}
          {last && (
            <>
              {real && <ClothButton className="kit-btn--sm sk-tour-go" onClick={toRealGame}>Play a real game</ClothButton>}
              <WoodButton className="kit-btn--sm" onClick={() => endTour('menu')}>{real ? 'Menu' : 'Back to the menu'}</WoodButton>
            </>
          )}
          {step.kind === 'wait' && <button type="button" className="sk-tour-skip" onClick={next}>Skip this step</button>}
          {!last && <button type="button" className="sk-tour-skip sk-tour-leave" onClick={leave}>{afterTour === 'quick' && real ? 'Skip, find a game' : 'Skip tutorial'}</button>}
        </div>
      </div>
    </div>
  );
}
