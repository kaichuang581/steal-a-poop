import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { TOUR_STEPS } from './tourSteps';

/** Re-measures the highlighted element every frame, so the spotlight follows layout and animation. */
function useTargetRect(target: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const el = target ? document.querySelector(`[data-tour="${target}"]`) : null;
      const r = el ? el.getBoundingClientRect() : null;
      setRect((prev) => {
        if (!r) return prev === null ? prev : null;
        if (prev && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height) return prev;
        return r;
      });
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return rect;
}

const CARD_W = 340;
const PAD = 8;
/** Height of the hint-chip row plus the status line above the input bar. */
const CLEAR_ABOVE = 84;

export function Tour() {
  const game = useStore((s) => s.game)!;
  const pause = useStore((s) => s.pause);
  const resume = useStore((s) => s.resume);
  const endTour = useStore((s) => s.endTour);
  const afterTour = useStore((s) => s.afterTour);
  const [i, setI] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(190);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;
  const ctx = { game };
  const rect = useTargetRect(step.target);

  // Track the card's real height so it can sit clear of the thing being highlighted.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCardH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Entering a step sets the clock state it needs.
  useEffect(() => {
    if (step.pause) pause();
    else resume();
  }, [step, pause, resume]);

  // Wait steps advance themselves when the player does the thing.
  useEffect(() => {
    if (step.kind === 'wait' && step.done?.({ game })) setI((n) => Math.min(n + 1, TOUR_STEPS.length - 1));
  }, [step, game]);

  // Skip and finish both mark the tour done; first-run players then land in a real game.
  const leave = (next: 'menu' | 'quick') => endTour(next);

  const vw = typeof window === 'undefined' ? 1000 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  // On wide screens, steps where the player acts dock the card in the free gutter beside the
  // input bar so the table, pile and your own seat stay visible. Elsewhere it sits near its target.
  const dockRight = step.kind === 'wait' && !!rect && vw >= 1100 && rect.top > vh * 0.6;
  const width = dockRight ? 280 : Math.min(CARD_W, vw - 24);
  let left = (vw - width) / 2;
  let top = vh / 2 - 90;
  if (dockRight && rect) {
    left = vw - width - 12;
    top = Math.max(12, rect.bottom - cardH);
  } else if (rect) {
    left = Math.min(Math.max(12, rect.x + rect.width / 2 - width / 2), vw - width - 12);
    const below = rect.bottom + PAD + 12 + cardH < vh;
    // Wait steps need the controls usable: leave room above the input for the hint chips and message line.
    const reserve = step.kind === 'wait' ? CLEAR_ABOVE : 0;
    top = below ? rect.bottom + PAD + 12 : Math.max(12, rect.top - PAD - 12 - cardH - reserve);
  }

  const blocking = step.kind === 'info';
  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" role="dialog" aria-label="Tutorial" aria-live="polite">
      {blocking && <div className="pointer-events-auto absolute inset-0" />}
      {rect ? (
        <div
          className="tour-ring absolute rounded-2xl border-2 border-amber-300 transition-all duration-150"
          style={{
            left: rect.x - PAD, top: rect.y - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(5,5,20,0.72)',
          }}
        />
      ) : (
        blocking && <div className="absolute inset-0 bg-[rgba(5,5,20,0.72)]" />
      )}
      <div
        ref={cardRef}
        className="tour-card pointer-events-auto absolute rounded-2xl border-2 border-amber-300 bg-[#1d1346] p-4 shadow-2xl"
        style={{ left, top, width }}
      >
        <div className="tour-step mb-1 text-xs font-bold uppercase tracking-widest text-white/50">
          Step {i + 1} of {TOUR_STEPS.length}
        </div>
        <h2 className="tour-title text-lg font-black text-amber-300">{step.title}</h2>
        <p className="tour-body mt-1 text-sm text-white/85">{step.body(ctx)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {step.kind === 'info' && !last && (
            <button
              onClick={() => setI((n) => n + 1)}
              className="tour-next min-h-11 flex-1 rounded-xl bg-amber-400 px-4 font-black text-amber-950"
              autoFocus
            >
              Next
            </button>
          )}
          {last && (
            <>
              <button
                onClick={() => leave('quick')}
                className="tour-primary min-h-11 flex-1 rounded-xl bg-emerald-500 px-4 font-black text-emerald-950"
              >
                Play a real game
              </button>
              <button onClick={() => leave('menu')} className="tour-secondary min-h-11 rounded-xl bg-white/10 px-4 font-bold">
                Menu
              </button>
            </>
          )}
          {step.kind === 'wait' && (
            <button
              onClick={() => setI((n) => n + 1)}
              className="tour-secondary min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold"
            >
              Skip this step
            </button>
          )}
          {!last && (
            <button
              onClick={() => leave(afterTour)}
              className="tour-link min-h-11 rounded-xl px-3 text-sm font-bold text-white/60 underline"
            >
              {afterTour === 'quick' ? 'Skip tour, start game' : 'Exit tour'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
