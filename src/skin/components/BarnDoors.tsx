import { useEffect, useState } from 'react';
import { create } from 'zustand';

/** Each Start bumps the key; the doors live at the app's root so they outlast Home and open onto the game itself. */
const useDoors = create<{ key: number }>(() => ({ key: 0 }));
export const playBarnDoors = () => useDoors.setState((s) => ({ key: s.key + 1 }));

/** The table's canvases mark themselves once they have drawn a frame; the doors wait for that before they open. */
export const DRAWN_ATTR = 'data-drawn';
const HOLD_MS = 280; // the doors are seen shut, at least for a beat
const GIVE_UP_MS = 2600; // no WebGL, or a slow first build: open anyway

/**
 * Barn doors over the whole screen when a game starts. The game mounts behind them at once; they stay shut until its
 * barn has drawn, then swing in on their hinges onto the table (lantern light spilling through the gap first) while the
 * view steps through. Never a blank frame, never a white-out.
 */
export function BarnDoors() {
  const key = useDoors((s) => s.key);
  return key ? <Doors key={key} /> : null;
}

function Doors() {
  const [phase, setPhase] = useState<'shut' | 'open' | 'gone'>('shut');
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const age = performance.now() - t0;
      const drawn = document.querySelector(`canvas[${DRAWN_ATTR}]`);
      if ((drawn && age > HOLD_MS) || age > GIVE_UP_MS) return setPhase('open');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (phase !== 'open') return;
    const id = setTimeout(() => setPhase('gone'), 1150);
    return () => clearTimeout(id);
  }, [phase]);
  if (phase === 'gone') return null;
  return (
    <div className="sk-doors" data-phase={phase} aria-hidden="true">
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
    </div>
  );
}
