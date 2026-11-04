import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/** Writes triangles on screen and frame time into #sk-dev (plan V3: a dev overlay prints both). Shown with ?dev=1. */
export function DevStats() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ last: performance.now(), sum: 0, n: 0, shown: 0 });
  useEffect(() => { console.log('painted: renderer pixel ratio', gl.getPixelRatio(), 'devicePixelRatio', window.devicePixelRatio); }, [gl]);
  useFrame(() => {
    const now = performance.now();
    const a = acc.current;
    a.sum += now - a.last;
    a.last = now;
    a.n += 1;
    if (now - a.shown < 500) return;
    const el = document.getElementById('sk-dev');
    if (el) el.textContent = `${gl.info.render.triangles.toLocaleString()} triangles · ${(a.sum / a.n).toFixed(1)} ms/frame · ${gl.info.render.calls} draws · dpr ${gl.getPixelRatio()}`;
    a.sum = 0;
    a.n = 0;
    a.shown = now;
  });
  return null;
}

export const devOn = () => new URLSearchParams(location.search).has('dev');

export function DevLine() {
  if (!devOn()) return null;
  return <div id="sk-dev" className="pointer-events-none fixed bottom-1 left-1 z-[90] rounded bg-white/80 px-2 py-0.5 font-mono text-xs" style={{ color: '#3B3028' }} />;
}
