import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Paper } from '../kit';

/**
 * The loading screen: shut barn doors over the whole screen, with a slip pinned between them where a sheep hops a fence
 * and the slip says what is being got ready. It is the one loading screen for the whole painted skin: the first load,
 * a game, practice, the dream, the Hunt's word list. Whatever is loading mounts behind the doors at once; they stay
 * shut until it is ready, then swing in on their hinges onto it. Never a blank frame, never a half-built scene.
 *
 * Ready means: nothing is holding the doors (`useLoadingHold`), and, when the load has a 3D scene, every three.js
 * canvas on the page has drawn a few frames (`MarkDrawn` sets DRAWN_ATTR) and at least one of them is new.
 */
interface Doors { key: number; canvas: boolean; holds: Record<string, string> }
const useDoors = create<Doors>(() => ({ key: 0, canvas: true, holds: {} }));

/** Shut the doors now; they open once the new scene has drawn (or, with `canvas: false`, once nothing holds them). */
export const playBarnDoors = (opts: { canvas?: boolean } = {}) => useDoors.setState((s) => ({ key: s.key + 1, canvas: opts.canvas ?? true }));

/** While `active`, keep the doors shut (and shut them if they are not), with `label` on the slip. If this hold shuts
 *  the doors itself, `canvas` says whether they also wait for a new scene to draw. */
export function useLoadingHold(id: string, active: boolean, label = 'Getting the barn ready', canvas = false) {
  useEffect(() => {
    if (!active) return;
    useDoors.setState((s) => ({ holds: { ...s.holds, [id]: label }, ...(liveKey === s.key ? {} : { key: s.key + 1, canvas }) }));
    return () => useDoors.setState((s) => { const holds = { ...s.holds }; delete holds[id]; return { holds }; });
  }, [id, active, label, canvas]);
}

/** The scenes' canvases mark themselves once they have drawn a few frames (Rendering's MarkDrawn). */
export const DRAWN_ATTR = 'data-drawn';
const HOLD_MS = 450; // the doors are seen shut, at least for a beat
const GIVE_UP_MS = 15000; // no WebGL, or something stuck: open anyway
/** The key of the doors on screen now, so a hold joins them instead of shutting a second pair. */
export const doorsShut = () => liveKey !== -1;
let liveKey = -1;

const LINES = ['Counting the sheep', 'Fluffing the hay', 'Lighting the lanterns', 'Shooing the hens', 'Sweeping the snow off the step'];

export function BarnDoors() {
  const key = useDoors((s) => s.key);
  return key ? <Doors key={key} id={key} /> : null;
}

function Doors({ id }: { id: number }) {
  const [phase, setPhase] = useState<'shut' | 'open' | 'gone'>('shut');
  const holds = useDoors((s) => s.holds);
  const label = Object.values(holds)[0];
  const [line, setLine] = useState(0);
  const before = useRef<Set<Element> | null>(null);
  useEffect(() => {
    liveKey = id;
    // The canvases already drawn when the doors shut belong to the screen being left: a new one has to draw.
    before.current = new Set(document.querySelectorAll(`canvas[${DRAWN_ATTR}]`));
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const age = performance.now() - t0;
      const { holds: h, canvas } = useDoors.getState();
      const scenes = [...document.querySelectorAll('canvas[data-engine]')];
      const drawn = !canvas || (scenes.some((c) => c.hasAttribute(DRAWN_ATTR) && !before.current!.has(c)) && scenes.every((c) => c.hasAttribute(DRAWN_ATTR)));
      if ((age > HOLD_MS && drawn && Object.keys(h).length === 0) || age > GIVE_UP_MS) return setPhase('open');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (liveKey === id) liveKey = -1; };
  }, [id]);
  useEffect(() => {
    if (phase !== 'open') return;
    if (liveKey === id) liveKey = -1;
    const t = setTimeout(() => setPhase('gone'), 1150);
    return () => clearTimeout(t);
  }, [phase, id]);
  // A long load turns over a few lines, so it never looks stuck.
  useEffect(() => {
    if (phase !== 'shut') return;
    const t = setInterval(() => setLine((n) => n + 1), 2200);
    return () => clearInterval(t);
  }, [phase]);
  if (phase === 'gone') return null;
  return (
    <div className="sk-doors" data-phase={phase} role="status" aria-live="polite" aria-label={phase === 'shut' ? 'Loading' : undefined}>
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
      {/* Pinned over the crack: a sheep hopping a fence, and what is being got ready. Only transform and opacity move,
          so it keeps hopping while a scene is being built and the page is busy. */}
      <Paper kind="slip" pin="top" className="sk-load" aria-hidden="true">
        <span className="sk-load-field">
          <span className="sk-load-sheep"><HopSheep /></span>
          <span className="sk-load-fence"><i /><i /><i /></span>
        </span>
        <span className="sk-load-line">{label ?? LINES[line % LINES.length]}…</span>
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
