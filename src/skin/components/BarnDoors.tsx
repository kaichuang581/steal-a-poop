import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { playSound } from '../../audio/sound';
import { useMotionLevel } from '../hooks/useAmbient';
import { Paper } from '../kit';

/**
 * The loading screen: barn doors over the whole screen, with a slip pinned between them where a sheep hops a fence and
 * the slip says what is being got ready. It is the one loading screen for the whole painted skin: the first load, a game,
 * practice, the dream. Going somewhere new, the doors swing shut over the screen being left and meet with a thud; only
 * then does the new screen start building behind them (`whenDoorsShut`), so the swing never stutters. They stay shut
 * until it is ready, then unlatch and swing in onto it (`whenDoorsOpen`: a game's clock starts there). The very first
 * load starts with them already shut. Never a blank frame, never a half-built scene.
 *
 * Ready means: nothing is holding the doors (`useLoadingHold`), and, when the load has a 3D scene, every three.js
 * canvas on the page has drawn a few frames (`MarkDrawn` sets DRAWN_ATTR) and at least one of them is new.
 */
interface Doors {
  key: number; canvas: boolean; holds: Record<string, string>; label: string | null;
  /** Whether this pair swings shut (false: already shut on its first frame, as on the first load). */
  swing: boolean;
  /** The key of the pair that is fully shut, and of the pair that has started to open. */
  shut: number; opened: number;
}
const useDoors = create<Doors>(() => ({ key: 0, canvas: true, holds: {}, label: null, swing: false, shut: 0, opened: 0 }));

interface ShutOpts { canvas?: boolean; label?: string }

/** Swing the doors shut now, with `label` on the slip; they open once the new scene has drawn (or, with `canvas: false`,
 *  once nothing holds them). */
export const playBarnDoors = (opts: ShutOpts = {}) =>
  useDoors.setState((s) => ({ key: s.key + 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: true }));

/** The page's first screen: the doors are shut from the very first frame, so the screen being built behind them is never
 *  seen first and then covered. `canvas: false` when the first screen has no 3D scene to wait for. */
export const shutDoorsAtBoot = (opts: ShutOpts = {}) => {
  if (useDoors.getState().key === 0) useDoors.setState({ key: 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: false });
};

/** Calls `fn` once the current doors are fully shut (at once if they already are). Returns a cancel function. */
export function whenDoorsShut(fn: () => void): () => void {
  return when((s) => s.key > 0 && s.shut === s.key, fn);
}

/** Calls `fn` once the current doors start to open, or at once if there are none. Returns a cancel function. */
export function whenDoorsOpen(fn: () => void): () => void {
  return when((s) => s.key === 0 || s.opened === s.key, fn);
}

function when(test: (s: Doors) => boolean, fn: () => void): () => void {
  if (test(useDoors.getState())) { fn(); return () => {}; }
  const off = useDoors.subscribe((s) => { if (test(s)) { off(); fn(); } });
  return off;
}

/** While `active`, keep the doors shut (and swing them shut if they are not), with `label` on the slip. If this hold
 *  shuts the doors itself, `canvas` says whether they also wait for a new scene to draw. */
export function useLoadingHold(id: string, active: boolean, label = 'Getting the barn ready', canvas = false) {
  useEffect(() => {
    if (!active) return;
    useDoors.setState((s) => ({ holds: { ...s.holds, [id]: label }, ...(liveKey === s.key ? {} : { key: s.key + 1, canvas, label: null, swing: true }) }));
    return () => useDoors.setState((s) => { const holds = { ...s.holds }; delete holds[id]; return { holds }; });
  }, [id, active, label, canvas]);
}

/** The scenes' canvases mark themselves once they have drawn a few frames (Rendering's MarkDrawn). */
export const DRAWN_ATTR = 'data-drawn';
const CLOSE_MS = 620; // the swing shut (skin.css sk-door-close-*); the doors meet at 80% of it
const CLOSE_REDUCED_MS = 220; // reduced motion: a fade in instead
const HOLD_MS = 350; // once shut, the doors are seen shut at least this long
const GIVE_UP_MS = 15000; // a scene that never draws (no WebGL, something stuck): open anyway this long after it mounted
const GIVE_UP_TOTAL_MS = 30000; // and never stay shut longer than this, even while the scene is still being built
/** Whether doors are on screen and not yet opening, so a hold joins them instead of shutting a second pair. */
export const doorsShut = () => liveKey !== -1;
let liveKey = -1;

const LINES = ['Counting the sheep', 'Fluffing the hay', 'Lighting the lanterns', 'Shooing the hens', 'Sweeping the snow off the step'];

export function BarnDoors() {
  const key = useDoors((s) => s.key);
  return key ? <Doors key={key} id={key} /> : null;
}

function Doors({ id }: { id: number }) {
  const reduced = useMotionLevel() === 'reduced';
  const [phase, setPhase] = useState<'closing' | 'shut' | 'open' | 'gone'>(() => (useDoors.getState().swing ? 'closing' : 'shut'));
  const holds = useDoors((s) => s.holds);
  const doorsLabel = useDoors((s) => s.label);
  const [line, setLine] = useState(0);
  // The slip keeps the last line it showed while the doors open: a hold ending is what opens them, and its line
  // should not flick back to the one under it on the way out.
  const shown = useRef('');
  const live = Object.values(holds)[0] ?? doorsLabel ?? LINES[line % LINES.length];
  if (phase !== 'open' || !shown.current) shown.current = live;
  const label = Object.values(holds)[0] ?? doorsLabel;
  const before = useRef<Set<Element> | null>(null);
  useEffect(() => {
    liveKey = id;
    // The canvases already drawn when the doors come down belong to the screen being left: a new one has to draw.
    before.current = new Set(document.querySelectorAll(`canvas[${DRAWN_ATTR}]`));
    return () => { if (liveKey === id) liveKey = -1; };
  }, [id]);
  // Swinging shut: the thud as they meet, then they count as shut.
  useEffect(() => {
    if (phase !== 'closing') return;
    const ms = reduced ? CLOSE_REDUCED_MS : CLOSE_MS;
    const thud = setTimeout(() => playSound('doorShut', 0.8), reduced ? 0 : ms * 0.8);
    const done = setTimeout(() => setPhase('shut'), ms);
    return () => { clearTimeout(thud); clearTimeout(done); };
  }, [phase, reduced]);
  // Shut: wait for the new screen.
  useEffect(() => {
    if (phase !== 'shut') return;
    useDoors.setState({ shut: id });
    const t0 = performance.now();
    let sceneAt = 0; // when a new scene first mounted: the first load builds its world before there is one
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const age = now - t0;
      const { holds: h, canvas } = useDoors.getState();
      const scenes = [...document.querySelectorAll('canvas[data-engine]')];
      if (!sceneAt && scenes.some((c) => !before.current!.has(c))) sceneAt = now;
      const drawn = !canvas || (scenes.some((c) => c.hasAttribute(DRAWN_ATTR) && !before.current!.has(c)) && scenes.every((c) => c.hasAttribute(DRAWN_ATTR)));
      const stuck = (canvas ? sceneAt > 0 && now - sceneAt > GIVE_UP_MS : age > GIVE_UP_MS) || age > GIVE_UP_TOTAL_MS;
      if ((age > HOLD_MS && drawn && Object.keys(h).length === 0) || stuck) return setPhase('open');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, id]);
  useEffect(() => {
    if (phase !== 'open') return;
    if (liveKey === id) liveKey = -1;
    useDoors.setState({ opened: id });
    playSound('doorOpen', 0.8);
    const t = setTimeout(() => setPhase('gone'), 1150);
    return () => clearTimeout(t);
  }, [phase, id]);
  // The doors are modal: keys pressed while they are up do not reach the screen behind (starting the dream, typing at
  // the table). Browser shortcuts with Ctrl, Cmd or Alt still work.
  useEffect(() => {
    if (phase === 'open') return;
    const block = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [phase]);
  // A long load turns over a few lines, so it never looks stuck.
  useEffect(() => {
    if (phase !== 'shut' || label) return;
    const t = setInterval(() => setLine((n) => n + 1), 2200);
    return () => clearInterval(t);
  }, [phase, label]);
  if (phase === 'gone') return null;
  return (
    <div className="sk-doors" data-phase={phase} role="status" aria-live="polite" aria-label={phase === 'open' ? undefined : 'Loading'}>
      <div className="sk-doors-spill" />
      <div className="sk-doors-frame">
        {(['l', 'r'] as const).map((side) => (
          <div key={side} className={`sk-door sk-door-${side}`}>
            <span className="sk-door-brace" />
            <span className="sk-door-hinge sk-door-hinge-top" /><span className="sk-door-hinge sk-door-hinge-low" />
            <span className="sk-door-handle" />
          </div>
        ))}
      </div>
      <div className="sk-doors-lintel" />
      {/* Pinned over the crack once the doors meet: a sheep hopping a fence, and what is being got ready. Only transform
          and opacity move, so it keeps hopping while a scene is being built and the page is busy. */}
      <Paper kind="slip" pin="top" className="sk-load" aria-hidden="true">
        <span className="sk-load-field">
          <span className="sk-load-sheep"><HopSheep /></span>
          <span className="sk-load-fence"><i /><i /><i /></span>
        </span>
        <span className="sk-load-line">{shown.current}…</span>
      </Paper>
    </div>
  );
}

/** The slip's sheep, side on in pixels: a wool body with an ink outline (it is on cream paper), a dark face and legs. */
function HopSheep() {
  const ink = '#3B3028', wool = '#FBF7EC', fleck = '#E6DDC8', face = '#4A4444';
  return (
    <svg width={64} height={48} viewBox="0 0 16 12" shapeRendering="crispEdges" aria-hidden="true">
      <rect x={1} y={2} width={12} height={7} fill={ink} /><rect x={2} y={1} width={10} height={1} fill={ink} /><rect x={0} y={3} width={1} height={2} fill={ink} />
      <rect x={2} y={3} width={10} height={5} fill={wool} /><rect x={3} y={2} width={8} height={1} fill={wool} /><rect x={1} y={4} width={1} height={1} fill={wool} />
      <rect x={4} y={4} width={1} height={1} fill={fleck} /><rect x={8} y={3} width={1} height={1} fill={fleck} /><rect x={6} y={6} width={1} height={1} fill={fleck} /><rect x={10} y={5} width={1} height={1} fill={fleck} />
      <rect x={12} y={2} width={4} height={4} fill={face} /><rect x={12} y={1} width={2} height={1} fill={face} /><rect x={14} y={3} width={1} height={1} fill={wool} />
      <rect x={3} y={9} width={1} height={3} fill={face} /><rect x={5} y={9} width={1} height={2} fill={face} /><rect x={9} y={9} width={1} height={3} fill={face} /><rect x={11} y={9} width={1} height={2} fill={face} />
    </svg>
  );
}
