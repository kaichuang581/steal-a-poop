import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { create } from 'zustand';
import { useMotionLevel } from '../hooks/useAmbient';
import { BALL_AT, BOOT_DOORS_ID, FLAKES, ballImage, ballShadeMarkup, ballShadowMarkup, guideMarkup } from '../loading/bootDoors';
import { CODE_IN, expectedSteps, startProgress, stepProgress, withSteps } from '../loading/progress';
import type { Progress } from '../loading/progress';
import { layYarn } from '../loading/yarn';
import { START, TOTAL, VIEWBOX, WORD, sampleAt } from '../loading/yarnWord';
import { stepsTaken } from '../scene/slices';
import { getTier } from '../perf/tier';
import { coarseFor } from '../voxel/refine';

/**
 * The loading screen (docs/landing/LANDING-PLAN.md): Home's night with a few slow flakes, the game's name as a faint
 * dotted line, and a red yarn ball that travels along it, laying one strand of real-looking yarn that spells the word.
 * The strand is the progress (loading/progress.ts): when the game is ready the word is complete and the small ball sits
 * on top of the "d", and after a moment the screen fades onto what was loading. No text, number, bar or sheep.
 *
 * It is the one loading screen for the whole painted skin: the first load, a game, practice, the dream. The names are
 * the barn doors' it replaced (BarnDoors, playBarnDoors, whenDoorsShut ...), kept because the rest of the game, the gate
 * tools and the e2e helpers call it by them. A page load starts with the screen already up: the page itself comes with
 * it drawn in at p = 0 (loading/bootDoors.ts), so it is there before this code has arrived, and the first screen here
 * takes over from that one. Going somewhere new, it comes up first, and only then does the new screen start building
 * behind it (`whenDoorsShut`); it goes once that is ready (`whenDoorsOpen`: a game's clock starts there).
 *
 * Ready means: nothing is holding the screen (`useLoadingHold`), and, when the load has a 3D scene, every three.js
 * canvas on the page has drawn a few frames (`MarkDrawn` sets DRAWN_ATTR) and at least one of them is new.
 */
interface Doors {
  key: number; canvas: boolean; holds: Record<string, string>; label: string | null;
  /** Whether this pair swings shut (false: already shut on its first frame, as on the first load). */
  swing: boolean;
  /** A quick change of screen: a short dark fade first, and the doors only if the new screen is not ready in a moment. */
  quick: boolean;
  /** The page's first load (its progress is the farm's build, counted against `sap:boot-steps`). */
  boot: boolean;
  /** The key of the pair that is fully shut, and of the pair that has started to open. */
  shut: number; opened: number;
}
const useDoors = create<Doors>(() => ({ key: 0, canvas: true, holds: {}, label: null, swing: false, quick: false, boot: false, shut: 0, opened: 0 }));

interface ShutOpts { canvas?: boolean; label?: string; quick?: boolean }

/** Swing the doors shut now, with `label` on the slip; they open once the new scene has drawn (or, with `canvas: false`,
 *  once nothing holds them). With `quick`, a short dark fade comes first and the doors only if the wait goes on: the
 *  loading screen is for loading, not for every change of screen. */
export const playBarnDoors = (opts: ShutOpts = {}) =>
  useDoors.setState((s) => ({ key: s.key + 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: !opts.quick, quick: !!opts.quick, boot: false }));

/** The page's first screen: the doors are shut from the very first frame, so the screen being built behind them is never
 *  seen first and then covered. `canvas: false` when the first screen has no 3D scene to wait for. */
export const shutDoorsAtBoot = (opts: ShutOpts = {}) => {
  if (useDoors.getState().key === 0) useDoors.setState({ key: 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: false, quick: false, boot: true });
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

/** While `active`, keep the doors shut, with `label` on the slip. If no doors are up, `shut` says whether this hold brings
 *  them down itself (and `canvas` whether they then also wait for a new scene to draw); with `shut: false` it only
 *  keeps doors that are already up from opening early. */
export function useLoadingHold(id: string, active: boolean, label = 'Getting the barn ready', canvas = false, shut = true) {
  useEffect(() => {
    if (!active) return;
    useDoors.setState((s) => ({ holds: { ...s.holds, [id]: label }, ...(liveKey === s.key || !shut ? {} : { key: s.key + 1, canvas, label: null, swing: true, quick: false, boot: false }) }));
    return () => useDoors.setState((s) => { const holds = { ...s.holds }; delete holds[id]; return { holds }; });
  }, [id, active, label, canvas, shut]);
}

/** The scenes' canvases mark themselves once they have drawn a few frames (Rendering's MarkDrawn). */
export const DRAWN_ATTR = 'data-drawn';
const CLOSE_MS = 180; // a hold that brings the screen up on its own: a fade in (skin.css, .sk-doors[data-phase="closing"])
const CLOSE_REDUCED_MS = 180;
const HOLD_MS = 350; // once shut, the doors are seen shut at least this long
const VEIL_MS = 180; // a quick change: the dark fade, before the new screen mounts
export const GRACE_MS = 800; // and how long the new screen has to be ready before the doors come down after all
// Doors that come down late stay shut only until they have finished fading in (skin.css sk-veil-in, 240 ms). It was
// 700, to let the sign finish dropping, which kept a screen that was ready covered for most of a second.
export const REVEAL_HOLD_MS = 240;
/**
 * The longest gap between two frames that counts, whole, as time spent waiting. Building a 3D screen freezes the page:
 * no frame is drawn until it is done, so the wait cannot be noticed until it is over. Counting that freeze as waiting
 * brought the doors down at the very moment the new screen was ready, and then kept them shut over it (measured on a
 * slow device going into practice: ready at 2.4 s, the doors up from 2.5 s, open at 3.2 s, off screen at 4.3 s;
 * Brian, 2026-11-13: "make sure ... it isnt just blocking the website for no reason"). So a freeze counts as one
 * short moment, and the doors come down only for a wait the page is awake through: something still being fetched, or
 * a build that goes on in steps.
 */
export const FROZEN_MS = 100;
/** The waiting so far, after one more frame that came `dt` ms after the last. */
export const waitedFor = (waited: number, dt: number) => waited + Math.min(Math.max(dt, 0), FROZEN_MS);
const GIVE_UP_MS = 15000; // a scene that never draws (no WebGL, something stuck): open anyway this long after it mounted
const GIVE_UP_TOTAL_MS = 30000; // and never stay shut longer than this, even while the scene is still being built
/** Whether doors are on screen and not yet opening, so a hold joins them instead of shutting a second pair. */
export const doorsShut = () => liveKey !== -1;
let liveKey = -1;

/** Once ready, the finished word stays on screen this long before the screen goes, so it is seen whole. */
export const FULL_HOLD_MS = 300;
/** The ball rocks on its base once the progress has not moved for this long. */
const REST_MS = 600;
/** The tap's hop (skin.css sk-yarn-hop). */
const HOP_MS = 380;
/** The most of the word laid in one frame, and while laying it again after a resize; and the time a frame may spend. */
const UNITS_A_FRAME = 60, UNITS_A_FRAME_RESIZED = 200, MS_A_FRAME = 6;
/** The steps a first load takes before ready, by detail level, until this device has counted its own (3.6). Measured
 *  on 2026-11-21 by loading Home at each detail level (docs/landing/review.md). */
export const DEFAULT_STEPS = { desktop: 465, touch: 440 };
const BOOT_STEPS = 'sap:boot-steps', LOAD_STEPS = 'sap:load-steps';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* a device that keeps nothing counts again */ } };

/** The doors the page came with (index.html), while they are still there. */
const bootDoors = () => (typeof document === 'undefined' ? null : document.getElementById(BOOT_DOORS_ID));

/** The page comes with shut doors already drawn, whatever it turns out to be. The painted game keeps them
 *  (`shutDoorsAtBoot`: its first pair takes over from them); anything else that opens here (the old look, a preview, the
 *  rules pages) is ready at once and calls this to take them away. */
export function dropBootDoorsUnlessShut() {
  if (useDoors.getState().key === 0) bootDoors()?.remove();
}

/** Whether the doors swallow key presses in this phase: while they are coming down or shut, never once they open, and
 *  never when they are gone. ('gone' doors stay mounted until the next pair: blocking there swallowed every letter typed
 *  at the table for the rest of the session, 2026-11-09.) */
export const keysBlocked = (phase: string) => phase === 'veiling' || phase === 'closing' || phase === 'shut';

export function BarnDoors() {
  const key = useDoors((s) => s.key);
  return key ? <Doors key={key} id={key} /> : null;
}

function Doors({ id }: { id: number }) {
  const reduced = useMotionLevel() === 'reduced';
  const [phase, setPhase] = useState<'veiling' | 'closing' | 'shut' | 'open' | 'gone'>(() => {
    const { quick, swing } = useDoors.getState();
    return quick ? 'veiling' : swing ? 'closing' : 'shut';
  });
  // A quick change shows only a dark fade, until the wait outlasts GRACE_MS: then the yarn (a real load).
  const [quick] = useState(() => useDoors.getState().quick);
  const [boot] = useState(() => useDoors.getState().boot);
  const [veil, setVeil] = useState(quick);
  const veilRef = useRef(veil);
  veilRef.current = veil;
  const holds = useDoors((s) => s.holds);
  const doorsLabel = useDoors((s) => s.label);
  // For screen readers only: what is being got ready. It never goes back once a hold has said it.
  const shown = useRef('');
  const live = Object.values(holds)[0] ?? doorsLabel ?? 'Loading';
  if (phase !== 'open' || !shown.current) shown.current = live;
  const before = useRef<Set<Element> | null>(null);
  /** Read by the yarn: whether the new screen is ready, and whether it is still being built. */
  const state = useRef({ ready: false, building: true, full: false });
  useEffect(() => {
    liveKey = id;
    // The canvases already drawn when the screen comes up belong to the screen being left: a new one has to draw.
    before.current = new Set(document.querySelectorAll(`canvas[${DRAWN_ATTR}]`));
    return () => { if (liveKey === id) liveKey = -1; };
  }, [id]);
  // Taking over from the screen the page came with: the same picture in the same place, so the only thing that could
  // show is the snow starting over. Each flake here picks up where its twin there had got to; then that screen goes.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const page = bootDoors();
    if (!page) return;
    const theirs = page.querySelectorAll('.sk-yarn-snow i');
    root.current?.querySelectorAll('.sk-yarn-snow i').forEach((flake, i) => {
      const from = theirs[i]?.getAnimations?.()[0], to = flake.getAnimations?.()[0];
      if (from && to && from.currentTime !== null) to.currentTime = from.currentTime;
    });
    page.remove();
  }, []);
  // A quick change: the fade, then the screen behind can mount.
  useEffect(() => {
    if (phase !== 'veiling') return;
    const t = setTimeout(() => setPhase('shut'), VEIL_MS);
    return () => clearTimeout(t);
  }, [phase]);
  // Coming up on its own: a short fade in, then it counts as up.
  useEffect(() => {
    if (phase !== 'closing') return;
    const done = setTimeout(() => setPhase('shut'), reduced ? CLOSE_REDUCED_MS : CLOSE_MS);
    return () => clearTimeout(done);
  }, [phase, reduced]);
  // Up: wait for the new screen.
  useEffect(() => {
    if (phase !== 'shut') return;
    useDoors.setState({ shut: id });
    const t0 = performance.now();
    let sceneAt = 0; // when a new scene first mounted: the first load builds its world before there is one
    let doorsAt = veilRef.current ? 0 : t0; // when the yarn itself came into view
    let revealed = false;
    let raf = 0;
    let last = t0, waited = 0; // waiting the page was awake for (see FROZEN_MS)
    const tick = () => {
      const now = performance.now();
      const age = now - t0;
      waited = waitedFor(waited, now - last);
      last = now;
      const { holds: h, canvas } = useDoors.getState();
      const scenes = [...document.querySelectorAll('canvas[data-engine]')];
      if (!sceneAt && scenes.some((c) => !before.current!.has(c))) sceneAt = now;
      const drawn = !canvas || (scenes.some((c) => c.hasAttribute(DRAWN_ATTR) && !before.current!.has(c)) && scenes.every((c) => c.hasAttribute(DRAWN_ATTR)));
      const held = Object.keys(h).length > 0;
      const ready = drawn && !held;
      state.current.ready = ready;
      state.current.building = held || (canvas && !sceneAt);
      // Behind the fade, ready means open straight away; still waiting after GRACE_MS awake, and it is a real load: the yarn.
      if (veilRef.current && !ready && waited > GRACE_MS) { setVeil(false); doorsAt = now; revealed = true; }
      const stuck = (canvas ? sceneAt > 0 && now - sceneAt > GIVE_UP_MS : age > GIVE_UP_MS) || age > GIVE_UP_TOTAL_MS;
      // Seen: the finished word stays FULL_HOLD_MS before the screen goes (state.current.full, set by the yarn).
      if ((ready && (veilRef.current || (state.current.full && now - doorsAt > (revealed ? REVEAL_HOLD_MS : HOLD_MS)))) || stuck) return setPhase('open');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, id]);
  useEffect(() => {
    if (phase !== 'open') return;
    if (liveKey === id) liveKey = -1;
    useDoors.setState({ opened: id });
    const t = setTimeout(() => setPhase('gone'), 260);
    return () => clearTimeout(t);
  }, [phase, id]);
  // The screen is modal: keys pressed while it is up do not reach the screen behind (starting the dream, typing at
  // the table). Browser shortcuts with Ctrl, Cmd or Alt still work.
  useEffect(() => {
    if (!keysBlocked(phase)) return;
    const block = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [phase]);

  // The yarn (3.5): every frame, the progress shown, the strand laid up to it, the ball moved to the strand's tip.
  const word = useRef<HTMLDivElement>(null), shadowCv = useRef<HTMLCanvasElement>(null), yarnCv = useRef<HTMLCanvasElement>(null);
  const ball = useRef<HTMLDivElement>(null), wraps = useRef<HTMLImageElement>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  useEffect(() => {
    const box = word.current, sc = shadowCv.current, yc = yarnCv.current, b = ball.current, w = wraps.current, el = root.current;
    if (!box || !sc || !yc || !b || !w || !el) return;
    const sctx = sc.getContext('2d'), yctx = yc.getContext('2d');
    if (!sctx || !yctx) return;
    // How many steps this load is expected to take: the device's own count, by detail level or by what is loading.
    const key = boot ? (coarseFor(getTier()) ? 'touch' : 'desktop') : (useDoors.getState().label ?? 'load');
    const store = boot ? BOOT_STEPS : LOAD_STEPS;
    const expected = expectedSteps(read(store), key, boot ? DEFAULT_STEPS[key as 'desktop' | 'touch'] || null : null);
    const steps0 = stepsTaken;
    let p: Progress = startProgress(performance.now(), boot ? 0 : CODE_IN);
    let u = 1, drawn = 0, relay = 0, last = performance.now(), movedAt = last, lastShown = -1, saved = false, fullAt = 0, raf = 0;
    const size = () => {
      const r = box.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
      if (!r.width) return;
      u = r.width / VIEWBOX.w;
      for (const [cv, ctx] of [[sc, sctx], [yc, yctx]] as const) {
        cv.width = Math.round(r.width * ratio); cv.height = Math.round(r.height * ratio);
        const k = (r.width * ratio) / VIEWBOX.w;
        ctx.setTransform(k, 0, 0, k, -VIEWBOX.x * k, -VIEWBOX.y * k);
      }
      // Cleared: what was laid is laid again, a little each frame.
      relay = Math.max(relay, drawn);
      drawn = 0;
    };
    size();
    const watch = new ResizeObserver(size);
    watch.observe(box);
    const frame = () => {
      const now = performance.now();
      const { ready, building } = state.current;
      const frac = building ? (expected ? (stepsTaken - steps0) / expected : null) : false;
      p = stepProgress(p, { now, dt: now - last, building: frac, ready });
      last = now;
      if (ready && !saved) {
        saved = true;
        const n = stepsTaken - steps0;
        if (n > 0) write(store, withSteps(read(store), key, n));
      }
      // Lay the yarn up to the progress, in order, at most so much a frame.
      const want = Math.min(TOTAL, p.shown * TOTAL), t0 = performance.now();
      const most = drawn + (drawn < relay ? UNITS_A_FRAME_RESIZED : UNITS_A_FRAME);
      while (drawn < want - 1e-6 && drawn < most && performance.now() - t0 < MS_A_FRAME) {
        const to = Math.min(want, drawn + 10, most);
        layYarn(sctx, yctx, WORD.pts, 1, drawn, to);
        drawn = to;
      }
      // The ball at the strand's tip (never ahead of it), shrinking as its yarn runs out, turning as it rolls.
      const at = sampleAt(drawn < relay ? relay : drawn), shownP = drawn < relay ? relay / TOTAL : drawn / TOTAL;
      b.style.transform = `translate(${((at.x - START.x) * u).toFixed(2)}px, ${((at.y - START.y) * u).toFixed(2)}px) scale(${(1 - 0.42 * p.shown).toFixed(4)})`;
      if (!reducedRef.current) w.style.rotate = `${(300 * p.shown).toFixed(2)}deg`;
      // Waiting: the ball rocks once the progress has not moved for REST_MS.
      if (p.shown !== lastShown) { lastShown = p.shown; movedAt = now; b.removeAttribute('data-rest'); }
      else if (now - movedAt > REST_MS && !reducedRef.current) b.setAttribute('data-rest', '');
      el.setAttribute('aria-valuenow', String(Math.round(p.shown * 100)));
      // The word is whole: the screen may go FULL_HOLD_MS later.
      if (ready && drawn >= TOTAL - 1e-6 && shownP >= 1 - 1e-6) { fullAt ||= now; state.current.full = now - fullAt >= FULL_HOLD_MS; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); watch.disconnect(); };
  }, [boot]);
  // A tap or click on the ball: a hop, and nothing else (the screen takes every pointer event, so nothing behind gets it).
  const hop = () => {
    const b = ball.current;
    if (!b || reducedRef.current) return;
    b.removeAttribute('data-hop');
    void b.offsetWidth; // start the hop again on a second tap
    b.setAttribute('data-hop', '');
    setTimeout(() => b.removeAttribute('data-hop'), HOP_MS);
  };

  if (phase === 'gone') return null;
  return (
    <div
      ref={root} className="sk-doors sk-yarn" data-phase={phase} data-veil={veil || undefined} data-revealed={(quick && !veil) || undefined}
      role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-valuetext={shown.current}
    >
      <div className="sk-yarn-snow" aria-hidden="true">{FLAKES.map((f, i) => <i key={i} style={f as CSSProperties} />)}</div>
      <div ref={word} className="sk-yarn-word">
        <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: GUIDE }} />
        <canvas ref={shadowCv} className="sk-yarn-shadow" />
        <canvas ref={yarnCv} className="sk-yarn-strand" />
        <div ref={ball} className="sk-yarn-ball" style={BALL_STYLE} onPointerDown={hop}>
          <div className="sk-yarn-ball-body">
            <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SHADOW }} />
            <img ref={wraps} className="sk-yarn-ball-wraps" src={BALL_SRC} alt="" draggable={false} />
            <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SHADE }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// The same pieces the page's own copy is written from (loading/bootDoors.ts), so the handover shows nothing.
const GUIDE = guideMarkup(), SHADOW = ballShadowMarkup(), SHADE = ballShadeMarkup('yb1');
const BALL_SRC = ballImage(import.meta.env.BASE_URL);
const BALL_STYLE: CSSProperties = { left: BALL_AT.left, top: BALL_AT.top };
