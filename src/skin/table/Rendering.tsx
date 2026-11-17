import { Canvas, addAfterEffect, invalidate, useFrame, useStore, useThree } from '@react-three/fiber';
import type { CanvasProps } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, FogExp2, HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import type { PointLight } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { doorsShut } from '../components/BarnDoors';
import type { Hour } from '../model/types';
import { createPacer, newPace, noteSceneDrawn } from '../perf/governor';
import type { Pace } from '../perf/governor';
import { watchScene } from '../perf/report';
import { BARN } from '../scene/layout';

/** The look, applied once and globally (plan V3.1 Part 1.3). */
// A warm white Christmas that is still winter (Brian, 2026-11-08: "warmer and more welcoming ... it looks a little dark"):
// the day's haze is a warm white rather than icy blue, and the night's a softer navy.
export const FOG: Record<Hour, string> = { dawn: '#F3CDB9', day: '#CED6DF', dusk: '#D49AA8', night: '#323E68' };
const SUN: Record<Hour, { color: string; intensity: number }> = {
  dawn: { color: '#FFD3A8', intensity: 1.55 },
  day: { color: '#FFE8C8', intensity: 1.85 },
  dusk: { color: '#FFD3A8', intensity: 1.7 },
  night: { color: '#C6CDE4', intensity: 1.15 }, // moonlight, less blue than it was; the lanterns carry the barn
};
// Physical falloff (decay 2) needs candela-scale intensity; 40 here lands where the plan's nominal 2.0 reads on screen.
export const LANTERN_LIGHT = { color: '#FFB862', intensity: 40, distance: 14, decay: 2 };
/**
 * At night the lanterns burn brighter and reach further, and the moon and the sky's fill are up a little (Brian,
 * 2026-11-13, of a room game, which is always at night: "make the room a little brighter ngl i cant see a thing").
 * The fill stays modest: a strong one flattens the snow (see Lights).
 */
const NIGHT = { lantern: 1.5, reach: 19, fill: 0.62 };
/** How bright a lantern burns at this hour. */
export const lanternIntensity = (hour: Hour) => LANTERN_LIGHT.intensity * (hour === 'night' ? NIGHT.lantern : 1);

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
      <hemisphereLight args={['#AEBEDA', '#655F5C', hour === 'night' ? NIGHT.fill : 0.58]} />
      <directionalLight
        position={pos} color={sun.color} intensity={sun.intensity} castShadow
        shadow-mapSize={phone ? [2048, 2048] : [4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={1} shadow-camera-far={160}
      />
      {BARN.lanterns.map((p, i) => (
        <pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]} color={LANTERN_LIGHT.color} intensity={lanternIntensity(hour)} distance={hour === 'night' ? NIGHT.reach : LANTERN_LIGHT.distance} decay={LANTERN_LIGHT.decay} />
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
 * What the picture costs at a fine resolution (Brian, 2026-11-13: "make the website less laggy"). Measured at the barn
 * table at 1.5x on a Retina laptop: 24.5 ms a frame, of which the 4x multisampling was about 7.5 (every pass of the
 * composer resolves it again) and the bloom about 7.5, and both grow with every pixel. So: 4 samples only at 1x, where
 * the edges need them, 2 a little above, and none from 1.5x up, where the pixels are too small to show a stair (looked
 * at side by side, with and without); and the bloom, which only has to find the lanterns and the things that glow,
 * works on a picture no wider than BLOOM_MAX_W whatever the screen. After: 60 frames a second at 1.5x and at the full
 * 2x, where it had been 41 at 1.5x. Shadows were measured too and cost next to nothing.
 */
const samplesFor = (pixelRatio: number) => (pixelRatio > 1.4 ? 0 : pixelRatio > 1.1 ? 2 : 4);
const BLOOM_MAX_W = 720;

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
    const target = new WebGLRenderTarget(size.width, size.height, { type: HalfFloatType, samples: samplesFor(gl.getPixelRatio()) });
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
    const ratio = gl.getPixelRatio(), samples = samplesFor(ratio);
    // Fewer samples at a finer resolution: changing the count means new buffers, which setSize alone would not make.
    for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== samples) { t.samples = samples; t.dispose(); }
    composer.setPixelRatio(ratio);
    composer.setSize(size.width, size.height);
    for (const p of composer.passes) {
      if (p instanceof ShaderPass && p.uniforms.texelY) p.uniforms.texelY.value = 1 / size.height;
      // The bloom works at half of whatever size it is given: give it no more than BLOOM_MAX_W across.
      if (p instanceof UnrealBloomPass) { const w = size.width * ratio, k = Math.min(1, (BLOOM_MAX_W * 2) / w); p.setSize(w * k, size.height * ratio * k); }
    }
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

/**
 * Marks the canvas once the scene has drawn a few frames, so the barn doors (BarnDoors) open onto a finished picture.
 * The canvases draw on demand (see Governor), so until the mark is set each frame asks for the next one itself: a scene's
 * first pictures never wait on a rate.
 */
const DRAWN_AFTER = 3;
export function MarkDrawn() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame((state) => {
    if (frames.current >= DRAWN_AFTER) return;
    if (++frames.current === DRAWN_AFTER) gl.domElement.setAttribute('data-drawn', '');
    else state.invalidate();
  });
  useEffect(() => () => gl.domElement.removeAttribute('data-drawn'), [gl]);
  return null;
}

/**
 * The frame governor's loop, one in each canvas (perf/governor.ts has the why and the arithmetic). The canvas draws on
 * demand; this counts the screen's refreshes and asks for a picture on the ones that are due: at most 60 a second (72
 * at 144 Hz), fewer where the scene's `fps` asks for fewer, none at 0 or in a hidden tab. A scene is never held back
 * before its first pictures (`data-drawn`), which the loading doors wait for.
 *
 * It asks first and books its own next refresh after: the canvas library's loop, started by the asking, is then always
 * ahead of this one in the browser's queue, so a picture asked for on one refresh is drawn on the next and one is asked
 * for on every refresh that wants one. The other way round every second picture would be lost.
 */
function Governor({ pace, scene }: { pace: Pace; scene?: string }) {
  const store = useStore();
  useEffect(() => {
    const pacer = createPacer();
    let id = 0, marked = false, resting = false;
    const draw = () => {
      const state = store.getState();
      // A scene that rested under its cover goes on from where it stopped: the rest is not one enormous step of time.
      if (resting) { resting = false; state.clock.getDelta(); }
      invalidate(state);
    };
    const refresh = (now: number) => {
      const drawn = store.getState().gl.domElement.hasAttribute('data-drawn');
      if (drawn !== marked) { marked = drawn; noteSceneDrawn(scene, drawn); }
      const hidden = typeof document !== 'undefined' && document.hidden;
      const fps = !drawn ? undefined : hidden ? 0 : pace.fps;
      const due = pacer.step(now, fps);
      pace.targetMs = pacer.targetMs;
      pace.capMs = pacer.capMs;
      if (due) draw();
      else if (fps === 0 && !hidden) resting = true;
      id = requestAnimationFrame(refresh);
    };
    // The cover is going (AdaptiveCanvas calls this as the rate changes): a picture now, not a refresh or two later.
    pace.wake = () => { if (resting && pace.fps !== 0) draw(); };
    id = requestAnimationFrame(refresh);
    return () => { cancelAnimationFrame(id); pace.wake = null; noteSceneDrawn(scene, false); };
  }, [store, pace, scene]);
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
 *
 * Repaired (plan file 17, change 10; a friend's game was "broken-looking", one cause being a resolution stuck at 0.75x
 * for good after one slow second). The figures above are now ratios of the governor's own target, so a scene asked for
 * 30 pictures a second is not called slow for drawing 30: slow is over 1.25 times the target twice running, or over
 * 1.65 times once; fast is under 1.05 times for sixteen looks, and only at the full rate (a scene keeping a slower pace
 * shows nothing about what it could do). A level found too slow is no longer refused for good: it is tried again after
 * RETRY_S of play, and twice as long after each time it fails again, so a device at its limit is not jolted every
 * minute. Each look leaves out its one worst frame, so a single hitch (a piece of the scene being built, the garbage
 * collector) is not taken for the steady cost. Nothing is judged while the loading doors are shut, during a hold (a
 * burst, a dip of Home's camera), or for QUIET_S after the resolution, the rate or the canvas's size changed. Five
 * frames running over 250 ms are no longer ignored as stalls: that is a device drawing under four pictures a second.
 */
export const DPR_STEP = 0.25;
/** How long each look at the frame rate averages over, and how many looks each way move the resolution. */
export const DPR_WINDOW_S = 0.5;
const SLOW_LOOKS = 2, FAST_LOOKS = 16;
/** A look against the target interval: slow above SLOW_X of it, clearly slow above CLEARLY_SLOW_X, fast under FAST_X. */
const SLOW_X = 1.25, CLEARLY_SLOW_X = 1.65, FAST_X = 1.05;
/** Seconds of play before a refused level is tried again; doubled for each time in a row it was refused (to 2^7). */
export const RETRY_S = 60;
const retryAfter = (tries: number) => RETRY_S * 2 ** (Math.min(Math.max(tries, 1), 8) - 1);
/** The judge's memory: looks in a row each way, the level found too slow, when (seconds of play), and how many times running. */
export interface DprStreak { slow: number; fast: number; ceiling: number; refusedAt?: number; tries?: number }
/** What a look is measured against: the governor's target interval, whether that is the full rate, and the time of play. */
export interface DprLook { targetMs?: number; climb?: boolean; now?: number }
/** The level `cur` was too slow: a step coarser, and `cur` is remembered as refused. */
export function refuseDpr(cur: number, streak: DprStreak, min: number, now = 0): number {
  if (cur <= min) return cur;
  streak.tries = cur >= streak.ceiling ? (streak.tries ?? 1) + 1 : 1;
  streak.slow = 0; streak.fast = 0; streak.ceiling = cur; streak.refusedAt = now;
  return Math.max(min, cur - DPR_STEP);
}
export function nextDpr(cur: number, avgMs: number, streak: DprStreak, min: number, max: number, look: DprLook = {}): number {
  const target = look.targetMs ?? 1000 / 60, now = look.now ?? 0;
  if (avgMs > target * SLOW_X) {
    streak.slow++; streak.fast = 0;
    if (streak.slow >= SLOW_LOOKS || avgMs > target * CLEARLY_SLOW_X) return refuseDpr(cur, streak, min, now);
  } else if (avgMs < target * FAST_X && look.climb !== false) {
    streak.fast++; streak.slow = 0;
    if (streak.fast >= FAST_LOOKS) {
      // The refused level itself has held for sixteen looks: it is no longer refused.
      if (cur >= streak.ceiling) { streak.ceiling = Infinity; streak.tries = 0; }
      const up = Math.min(max, cur + DPR_STEP);
      if (up > cur && (up < streak.ceiling || now - (streak.refusedAt ?? 0) >= retryAfter(streak.tries ?? 1))) { streak.fast = 0; return up; }
    }
  } else { streak.slow = 0; streak.fast = 0; }
  return cur;
}
/**
 * Until when (performance.now) the judge looks away. A burst such as the bomb going off slows a few frames on purpose; a
 * resolution change in the middle of it reallocates every buffer, a 70 to 100 ms hitch of its own at the worst moment.
 */
let holdUntil = 0;
export function holdDpr(ms: number): void { holdUntil = Math.max(holdUntil, performance.now() + ms); }

/** A frame longer than this is a stall, not a slow frame; this many running are a device that cannot draw the scene. */
const STALL_S = 0.25, STALLS_SLOW = 5;
/** How long the judge looks away after a scene comes up, and after its resolution, rate or size changes. */
const QUIET_S = 1.5;

/** The steady frame rate's judge, inside a canvas: it reports a new resolution, and the level it found too slow. */
function AdaptiveDpr({ max, min, value, kept, pace, onChange }: { max: number; min: number; value: number; kept: Settled; pace: Pace; onChange: (next: Settled) => void }) {
  const st = useRef({ sum: 0, n: 0, worst: 0, stalls: 0, age: 0, quiet: QUIET_S, value, target: 0, w: 0, h: 0, streak: { slow: 0, fast: 0, ceiling: kept.ceiling, refusedAt: 0, tries: kept.tries } as DprStreak });
  useFrame(({ size }, dt) => {
    const s = st.current;
    if (dt <= 0) return;
    // The judge's clock is time the scene was seen drawing: a hidden tab or a stall adds a quarter second at most.
    s.age += Math.min(dt, STALL_S);
    const restart = () => { s.sum = 0; s.n = 0; s.worst = 0; s.stalls = 0; s.streak.slow = 0; };
    // A change of resolution, of the governor's rate or of the canvas's size reallocates or re-times the picture.
    const target = pace.targetMs;
    if (value !== s.value || Math.abs(target - s.target) > s.target * 0.1 || size.width !== s.w || size.height !== s.h) {
      s.value = value; s.target = target; s.w = size.width; s.h = size.height;
      s.quiet = Math.max(s.quiet, s.age + QUIET_S);
      s.streak.fast = 0;
      restart();
      return;
    }
    if (s.age < s.quiet) return;
    if (performance.now() < holdUntil || doorsShut()) { restart(); return; }
    const report = (next: number) => {
      s.quiet = s.age + QUIET_S;
      restart();
      if (next !== value) onChange({ dpr: next, ceiling: s.streak.ceiling, tries: s.streak.tries ?? 0 });
    };
    if (dt > STALL_S) {
      if (++s.stalls >= STALLS_SLOW) report(refuseDpr(value, s.streak, min, s.age));
      return;
    }
    s.stalls = 0;
    s.sum += dt; s.n++;
    if (dt > s.worst) s.worst = dt;
    if (s.sum < DPR_WINDOW_S) return;
    // The look's mean without its one worst frame.
    const avg = (s.n > 2 ? (s.sum - s.worst) / (s.n - 1) : s.sum / s.n) * 1000;
    s.sum = 0; s.n = 0; s.worst = 0;
    const next = nextDpr(value, avg, s.streak, min, max, { targetMs: target, climb: target <= pace.capMs * 1.01, now: s.age });
    if (next !== value) report(next);
    // A refused level that has now held is kept as cleared, so the next visit does not doubt it again.
    else if (s.streak.ceiling !== kept.ceiling && s.streak.ceiling === Infinity) onChange({ dpr: value, ceiling: Infinity, tries: 0 });
  });
  return null;
}

/**
 * What a scene settled on, on this device: the next visit starts there instead of stepping down again. `ceiling` is the
 * level found too slow (Infinity: none) and `tries` how many times running it was.
 */
export interface Settled { dpr: number; ceiling: number; tries: number }
/**
 * Which way of drawing a kept level was measured under. A level settled on before the picture got cheaper (see
 * `samplesFor`), or by the judge before its repair (which kept one slow second for good), says a resolution is too slow
 * that no longer is, so it is not believed: the scene finds its level again.
 */
const SETTLED_UNDER = 3;
/** A kept level is believed for this long. A device changes (a new driver, a charger, a cooler room). */
export const SETTLED_DAYS = 7;
/** A stored level as text, read back: null when it is not one, was measured another way, or is too old. */
export function believeSettled(raw: string | null, now: number = Date.now()): Settled | null {
  try {
    const v = JSON.parse(raw ?? 'null') as { dpr?: unknown; ceiling?: unknown; tries?: unknown; v?: unknown; at?: unknown } | null;
    if (!v || v.v !== SETTLED_UNDER || typeof v.dpr !== 'number' || !Number.isFinite(v.dpr) || typeof v.at !== 'number') return null;
    if (!(Math.abs(now - v.at) <= SETTLED_DAYS * 86_400_000)) return null;
    return { dpr: v.dpr, ceiling: typeof v.ceiling === 'number' && Number.isFinite(v.ceiling) ? v.ceiling : Infinity, tries: typeof v.tries === 'number' && v.tries > 0 ? Math.floor(v.tries) : 0 };
  } catch { return null; }
}
/** A stored level as text, to keep. */
export function keepSettled(v: Settled, now: number = Date.now()): string {
  return JSON.stringify({ dpr: v.dpr, ceiling: Number.isFinite(v.ceiling) ? v.ceiling : null, tries: v.tries, v: SETTLED_UNDER, at: now });
}
const SETTLED_KEY = 'sap:dpr:';
/** The scene's kept level. One that is no longer believed is dropped from storage, so the device report shows only live ones. */
function readSettled(key: string | undefined): Settled | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(SETTLED_KEY + key);
    const v = believeSettled(raw);
    if (!v && raw !== null) localStorage.removeItem(SETTLED_KEY + key);
    return v;
  } catch { return null; }
}
/** The lowest resolution any scene settled on, on this device: a scene seen for the first time starts there, not at
 *  the screen's full density, since the same graphics chip draws them all. Only levels still believed count. */
function deviceHint(): number | null {
  let low: number | null = null;
  try {
    // The names first: reading one may drop it, which would shift the list under a loop over it.
    const names: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(SETTLED_KEY)) names.push(k.slice(SETTLED_KEY.length));
    }
    for (const name of names) {
      const v = readSettled(name);
      if (v && (low === null || v.dpr < low)) low = v.dpr;
    }
  } catch { /* storage blocked */ }
  return low;
}
function writeSettled(key: string | undefined, v: Settled) {
  if (!key) return;
  try { localStorage.setItem(SETTLED_KEY + key, keepSettled(v)); } catch { /* storage blocked */ }
}

/**
 * A scene canvas whose resolution follows the frame rate (see `nextDpr`). The resolution lives here, as the canvas's own
 * `dpr`: the canvas re-applies its `dpr` prop every time it renders, and the game screen renders every frame, so a
 * resolution set from inside the scene was put straight back (and each round trip reallocated the buffers, a 120 ms
 * hitch every two seconds). `memory` names the scene, so the level it settles on is kept per device and the next visit
 * starts there: each change of resolution reallocates the buffers, a short hitch best paid once.
 *
 * The canvas is measured by its layout box (`resize: { offsetSize: true }`) unless the caller says otherwise, so a
 * transform on a parent (the swoop into a game scales the whole screen) cannot make it bigger than its box.
 *
 * It draws on demand, paced by its Governor: `fps` is how many pictures a second the scene asks for (none given: the
 * full rate, at most 60 a second; 0: none, once the scene has drawn). `frameloop="never"` still stops it dead, as Home's
 * farm does behind the Trading Post. And it asks for the device's default graphics chip, not its hungriest: on a
 * laptop with two, the browser's choice is the one that spares the battery.
 */
export function AdaptiveCanvas({ maxDpr, minDpr = 0.75, memory, fps, children, ...given }: Omit<CanvasProps, 'dpr'> & { maxDpr: number; minDpr?: number; memory?: string; fps?: number }) {
  const frameloop = given.frameloop === 'never' ? 'never' as const : 'demand' as const;
  const props = { ...given, resize: given.resize ?? LAYOUT_SIZE, frameloop, gl: easyOnPower(given.gl) };
  const [state, setState] = useState<Settled>(() => {
    const device = Math.max(minDpr, Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
    const kept = readSettled(memory);
    if (kept) return { ...kept, dpr: Math.max(minDpr, Math.min(device, kept.dpr)) };
    const hint = memory ? deviceHint() : null;
    return { dpr: hint === null ? device : Math.max(minDpr, Math.min(device, hint)), ceiling: Infinity, tries: 0 };
  });
  const onChange = (next: Settled) => {
    setState(next);
    writeSettled(memory, next);
  };
  // The rate goes to the governor through an object both sides hold, not through the scene's own tree: the tree inside
  // a canvas is rendered a moment after the page's, and a scene coming out from under its cover must draw at once.
  const [pace] = useState(() => newPace(fps));
  useLayoutEffect(() => {
    pace.fps = fps;
    pace.wake?.();
  }, [pace, fps]);
  // As each canvas gets its renderer the device report starts watching it (perf/report.ts): when it draws, what a frame
  // costs, and its WebGL context being taken away (asked back with preventDefault) or given back. What the player sees
  // then, "Redrawing the farm..." or the card, is SceneBoundary's, which stands round this canvas.
  const onCreated: CanvasProps['onCreated'] = (root) => {
    watchScene(memory, root.gl, addAfterEffect);
    given.onCreated?.(root);
  };
  // `?dpr=1.5` pins the resolution, for measuring what a scene or an effect costs at one size (nothing adapts, nothing is kept).
  if (PINNED_DPR) return <Canvas {...props} onCreated={onCreated} dpr={PINNED_DPR}><Governor pace={pace} scene={memory} />{children}</Canvas>;
  return (
    <Canvas {...props} onCreated={onCreated} dpr={state.dpr}>
      <Governor pace={pace} scene={memory} />
      <AdaptiveDpr max={maxDpr} min={minDpr} value={state.dpr} kept={state} pace={pace} onChange={onChange} />
      {children}
    </Canvas>
  );
}
/** The canvas's renderer settings with the default graphics chip asked for, unless the caller chose or made its own. */
function easyOnPower(gl: CanvasProps['gl']): CanvasProps['gl'] {
  if (gl === undefined) return DEFAULT_CHIP;
  if (typeof gl === 'function' || 'render' in gl) return gl;
  return { powerPreference: 'default', ...gl };
}
const DEFAULT_CHIP = { powerPreference: 'default' } as const;
const LAYOUT_SIZE = { offsetSize: true };
const PINNED_DPR = (() => {
  if (typeof location === 'undefined') return 0;
  const v = Number(new URLSearchParams(location.search).get('dpr'));
  return Number.isFinite(v) && v >= 0.5 && v <= 3 ? v : 0;
})();
