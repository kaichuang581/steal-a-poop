import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { CanvasProps } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, FogExp2, HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import type { PointLight } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Hour } from '../model/types';
import { BARN } from '../scene/layout';

/** The look, applied once and globally (plan V3.1 Part 1.3). */
// A warm white Christmas that is still winter (Brian, 2026-11-08: "warmer and more welcoming ... it looks a little dark"):
// the day's haze is a warm white rather than icy blue, and the night's a softer navy.
export const FOG: Record<Hour, string> = { dawn: '#F3CDB9', day: '#CED6DF', dusk: '#D49AA8', night: '#323E68' };
const SUN: Record<Hour, { color: string; intensity: number }> = {
  dawn: { color: '#FFD3A8', intensity: 1.55 },
  day: { color: '#FFE8C8', intensity: 1.85 },
  dusk: { color: '#FFD3A8', intensity: 1.7 },
  night: { color: '#C6CDE4', intensity: 0.9 }, // moonlight, less blue than it was; the lanterns carry the barn
};
// Physical falloff (decay 2) needs candela-scale intensity; 40 here lands where the plan's nominal 2.0 reads on screen.
export const LANTERN_LIGHT = { color: '#FFB862', intensity: 40, distance: 14, decay: 2 };

/** Exponential fog in the hour's colour; the sky dome, stars and aurora ignore it (their materials have fog off). */
export function Atmosphere({ hour }: { hour: Hour }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new FogExp2(FOG[hour], 0.012);
    scene.background = new Color(FOG[hour]);
  }, [scene, hour]);
  return null;
}

/**
 * One warm sun 20 degrees up and 35 degrees to the side of the camera (`viewYaw` is the camera's horizontal heading,
 * so shadows fall across the view), a cool sky fill, and the two lantern point lights.
 */
export function Lights({ hour, phone, viewYaw, lampRef }: { hour: Hour; phone: boolean; viewYaw: number; lampRef?: (i: number, l: PointLight | null) => void }) {
  const sun = SUN[hour];
  const az = viewYaw + Math.PI + (35 * Math.PI) / 180;
  const el = (20 * Math.PI) / 180;
  const pos: [number, number, number] = [Math.sin(az) * Math.cos(el) * 60, Math.sin(el) * 60, Math.cos(az) * Math.cos(el) * 60];
  return (
    <>
      {/* Sky fill and a faint bounce from below. Kept low, so the sun or moon on the tops against the shaded sides is what
          gives the snow its shape: a strong fill here flattened every drift to one grey. */}
      <hemisphereLight args={['#AEBEDA', '#655F5C', hour === 'night' ? 0.5 : 0.58]} />
      <directionalLight
        position={pos} color={sun.color} intensity={sun.intensity} castShadow
        shadow-mapSize={phone ? [2048, 2048] : [4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={1} shadow-camera-far={160}
      />
      {BARN.lanterns.map((p, i) => (
        <pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]} color={LANTERN_LIGHT.color} intensity={LANTERN_LIGHT.intensity} distance={LANTERN_LIGHT.distance} decay={LANTERN_LIGHT.decay} />
      ))}
    </>
  );
}

/** A light tilt-shift: a vertical blur that only touches the top and bottom fifth of the frame. */
const TiltShiftShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.15 }, texelY: { value: 1 / 1080 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform float texelY; varying vec2 vUv;
    void main() {
      float band = smoothstep(0.2, 0.0, vUv.y) + smoothstep(0.8, 1.0, vUv.y);
      float r = band * strength * 40.0;
      vec4 sum = vec4(0.0); float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float w = 1.0 - abs(float(i)) / 7.0;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, float(i) * r / 6.0 * texelY)) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

/**
 * The composer: the scene into a multisampled half-float target, bloom for the lanterns and windows only
 * (threshold 0.85), the optional tilt-shift, then tone mapping and sRGB in the output pass.
 */
export function Effects({ tiltShift = 0 }: { tiltShift?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // The resolution can change under it (AdaptiveDpr), and the composer's targets must follow or it draws blurred.
  const dpr = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(size.width, size.height, { type: HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    // Bloom at half resolution: it only has to catch the lanterns, and the full-size blur chain costs most of a frame.
    c.addPass(new UnrealBloomPass(new Vector2(Math.ceil(size.width / 2), Math.ceil(size.height / 2)), 0.35, 0.4, 0.85));
    if (tiltShift > 0) {
      const pass = new ShaderPass(TiltShiftShader);
      pass.uniforms.strength.value = tiltShift;
      pass.uniforms.texelY.value = 1 / size.height;
      c.addPass(pass);
    }
    c.addPass(new OutputPass());
    return c;
    // The size is applied by the effect below; recreating on every resize would drop frames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, tiltShift]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    for (const p of composer.passes) if (p instanceof ShaderPass && p.uniforms.texelY) p.uniforms.texelY.value = 1 / size.height;
  }, [composer, gl, size, dpr]);
  useEffect(() => () => composer.dispose(), [composer]);
  // The composer is several draws; counting across all of them keeps the dev overlay's triangle count honest.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);
  useFrame(() => {
    gl.info.reset();
    composer.render();
  }, 1);
  return null;
}

/** The camera's horizontal heading (0 = looking toward +z) from a position and a target. */
export function yawToward(from: readonly number[], to: readonly number[]): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

/** Marks the canvas once the scene has drawn a few frames, so the barn doors (BarnDoors) open onto a finished picture. */
export function MarkDrawn() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 3) gl.domElement.setAttribute('data-drawn', '');
  });
  useEffect(() => () => gl.domElement.removeAttribute('data-drawn'), [gl]);
  return null;
}

/**
 * Keeps a scene smooth on any device by trading resolution for frame rate (Brian, 2026-11-09: "make the game less laggy
 * without removing anything ... optimize this for all devices whether thats ipad, laptop, phone, pc"). Nothing in the
 * scene changes; only how many pixels it is drawn at. The scenes are limited by the graphics chip filling pixels, not
 * by the page's code: the barn ran at 30 fps on a Retina laptop at 2x and at 60 on a phone. So every half second this
 * looks at the frame rate: under about 48 fps for a second running (or under about 36 fps for one half second), it draws
 * a quarter step coarser; at the display's full rate for eight seconds, a quarter step finer, but never back up to a
 * resolution that was already too slow. It starts at the device's own pixel ratio (capped at `max`), ignores the first
 * 1.5 s (the scene is still being built and its shaders compiled) and any frame over 250 ms (a stall or a hidden tab
 * says nothing about the steady cost). It used to look once a second and wait 3 s, so a short practice run (Brian,
 * 2026-11-09: "the bomb explosion for the practice gamemode is still super laggy") spent its whole life at the slow
 * resolution and only got smooth after the bang.
 */
export const DPR_STEP = 0.25;
/** How long each look at the frame rate averages over, and how many looks each way move the resolution. */
export const DPR_WINDOW_S = 0.5;
const SLOW_LOOKS = 2, FAST_LOOKS = 16, CLEARLY_SLOW_MS = 28;
export function nextDpr(cur: number, avgMs: number, streak: { slow: number; fast: number; ceiling: number }, min: number, max: number): number {
  if (avgMs > 21) {
    streak.slow++; streak.fast = 0;
    if ((streak.slow >= SLOW_LOOKS || avgMs > CLEARLY_SLOW_MS) && cur > min) { streak.slow = 0; streak.ceiling = cur; return Math.max(min, cur - DPR_STEP); }
  } else if (avgMs < 17.6) {
    streak.fast++; streak.slow = 0;
    const up = Math.min(max, cur + DPR_STEP);
    if (streak.fast >= FAST_LOOKS && up > cur && up < streak.ceiling) { streak.fast = 0; return up; }
  } else { streak.slow = 0; streak.fast = 0; }
  return cur;
}
/**
 * Until when (performance.now) the judge looks away. A burst such as the bomb going off slows a few frames on purpose; a
 * resolution change in the middle of it reallocates every buffer, a 70 to 100 ms hitch of its own at the worst moment.
 */
let holdUntil = 0;
export function holdDpr(ms: number): void { holdUntil = Math.max(holdUntil, performance.now() + ms); }

/** The steady frame rate's judge, inside a canvas: it reports a new resolution, and the level it found too slow. */
function AdaptiveDpr({ max, min, value, ceiling, onChange }: { max: number; min: number; value: number; ceiling: number; onChange: (dpr: number, ceiling: number) => void }) {
  const st = useRef({ sum: 0, n: 0, age: 0, streak: { slow: 0, fast: 0, ceiling } });
  useFrame((_, dt) => {
    const s = st.current;
    s.age += dt;
    if (s.age < 1.5 || dt > 0.25 || dt <= 0) return;
    if (performance.now() < holdUntil) { s.sum = 0; s.n = 0; s.streak.slow = 0; return; }
    s.sum += dt; s.n++;
    if (s.sum < DPR_WINDOW_S) return;
    const avg = (s.sum / s.n) * 1000;
    s.sum = 0; s.n = 0;
    const next = nextDpr(value, avg, s.streak, min, max);
    if (next !== value) onChange(next, s.streak.ceiling);
  });
  return null;
}

/** What a scene settled on, on this device: the next visit starts there instead of stepping down again. */
interface Settled { dpr: number; ceiling: number }
function readSettled(key: string | undefined): Settled | null {
  if (!key) return null;
  try {
    const v = JSON.parse(localStorage.getItem(`sap:dpr:${key}`) ?? 'null') as Settled | null;
    return v && Number.isFinite(v.dpr) ? { dpr: v.dpr, ceiling: Number.isFinite(v.ceiling) ? v.ceiling : Infinity } : null;
  } catch { return null; }
}
/** The lowest resolution any scene settled on, on this device: a scene seen for the first time starts there, not at
 *  the screen's full density, since the same graphics chip draws them all. */
function deviceHint(): number | null {
  let low: number | null = null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('sap:dpr:')) continue;
      const v = readSettled(k.slice('sap:dpr:'.length));
      if (v && (low === null || v.dpr < low)) low = v.dpr;
    }
  } catch { /* storage blocked */ }
  return low;
}
function writeSettled(key: string | undefined, v: Settled) {
  if (!key) return;
  try { localStorage.setItem(`sap:dpr:${key}`, JSON.stringify({ dpr: v.dpr, ceiling: Number.isFinite(v.ceiling) ? v.ceiling : null })); } catch { /* storage blocked */ }
}

/**
 * A scene canvas whose resolution follows the frame rate (see `nextDpr`). The resolution lives here, as the canvas's own
 * `dpr`: the canvas re-applies its `dpr` prop every time it renders, and the game screen renders every frame, so a
 * resolution set from inside the scene was put straight back (and each round trip reallocated the buffers, a 120 ms
 * hitch every two seconds). `memory` names the scene, so the level it settles on is kept per device and the next visit
 * starts there: each change of resolution reallocates the buffers, a short hitch best paid once.
 */
export function AdaptiveCanvas({ maxDpr, minDpr = 0.75, memory, children, ...props }: Omit<CanvasProps, 'dpr'> & { maxDpr: number; minDpr?: number; memory?: string }) {
  const [state, setState] = useState<Settled>(() => {
    const device = Math.max(minDpr, Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
    const kept = readSettled(memory);
    if (kept) return { dpr: Math.max(minDpr, Math.min(device, kept.dpr)), ceiling: kept.ceiling };
    const hint = memory ? deviceHint() : null;
    return { dpr: hint === null ? device : Math.max(minDpr, Math.min(device, hint)), ceiling: Infinity };
  });
  const onChange = (dpr: number, ceiling: number) => {
    const next = { dpr, ceiling };
    setState(next);
    writeSettled(memory, next);
  };
  return (
    <Canvas {...props} dpr={state.dpr}>
      <AdaptiveDpr max={maxDpr} min={minDpr} value={state.dpr} ceiling={state.ceiling} onChange={onChange} />
      {children}
    </Canvas>
  );
}
