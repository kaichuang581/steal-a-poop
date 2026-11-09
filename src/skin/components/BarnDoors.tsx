import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { create } from 'zustand';
import { playSound } from '../../audio/sound';
import { useMotionLevel } from '../hooks/useAmbient';
import { Nails } from '../kit';
import { SnowCap } from './SnowCap';
import { DOOR_BOXES, LINTEL_BEAM, LINTEL_SNOW } from '../loading/doorBoxes';

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
  /** A quick change of screen: a short dark fade first, and the doors only if the new screen is not ready in a moment. */
  quick: boolean;
  /** The key of the pair that is fully shut, and of the pair that has started to open. */
  shut: number; opened: number;
}
const useDoors = create<Doors>(() => ({ key: 0, canvas: true, holds: {}, label: null, swing: false, quick: false, shut: 0, opened: 0 }));

interface ShutOpts { canvas?: boolean; label?: string; quick?: boolean }

/** Swing the doors shut now, with `label` on the slip; they open once the new scene has drawn (or, with `canvas: false`,
 *  once nothing holds them). With `quick`, a short dark fade comes first and the doors only if the wait goes on: the
 *  loading screen is for loading, not for every change of screen. */
export const playBarnDoors = (opts: ShutOpts = {}) =>
  useDoors.setState((s) => ({ key: s.key + 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: !opts.quick, quick: !!opts.quick }));

/** The page's first screen: the doors are shut from the very first frame, so the screen being built behind them is never
 *  seen first and then covered. `canvas: false` when the first screen has no 3D scene to wait for. */
export const shutDoorsAtBoot = (opts: ShutOpts = {}) => {
  if (useDoors.getState().key === 0) useDoors.setState({ key: 1, canvas: opts.canvas ?? true, label: opts.label ?? null, swing: false, quick: false });
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
    useDoors.setState((s) => ({ holds: { ...s.holds, [id]: label }, ...(liveKey === s.key || !shut ? {} : { key: s.key + 1, canvas, label: null, swing: true, quick: false }) }));
    return () => useDoors.setState((s) => { const holds = { ...s.holds }; delete holds[id]; return { holds }; });
  }, [id, active, label, canvas, shut]);
}

/** The scenes' canvases mark themselves once they have drawn a few frames (Rendering's MarkDrawn). */
export const DRAWN_ATTR = 'data-drawn';
const CLOSE_MS = 620; // the swing shut (skin.css sk-door-close-*); the doors meet at 80% of it
const CLOSE_REDUCED_MS = 220; // reduced motion: a fade in instead
const HOLD_MS = 350; // once shut, the doors are seen shut at least this long
const VEIL_MS = 180; // a quick change: the dark fade, before the new screen mounts
const GRACE_MS = 800; // and how long the new screen has to be ready before the doors come down after all
const REVEAL_HOLD_MS = 700; // doors that come down late stay shut until their sign has dropped in (620 ms)
const GIVE_UP_MS = 15000; // a scene that never draws (no WebGL, something stuck): open anyway this long after it mounted
const GIVE_UP_TOTAL_MS = 30000; // and never stay shut longer than this, even while the scene is still being built
/** Whether doors are on screen and not yet opening, so a hold joins them instead of shutting a second pair. */
export const doorsShut = () => liveKey !== -1;
let liveKey = -1;

// The baked images, preloaded from index.html so they are in before the doors first draw, and the numbers that lay them
// out at one voxel size: as big as covers the screen with the doors and the beam above them.
const art = (part: string) => `url("${import.meta.env.BASE_URL}loading/doors-${part}.webp")`;
const ART = {
  '--doors-leaves': art('leaves'), '--doors-lintel': art('lintel'), '--doors-sill': art('sill'),
  '--vox-cols': DOOR_BOXES.leaves.w, '--leaf-rows': DOOR_BOXES.leaves.h,
  '--lintel-rows': DOOR_BOXES.lintel.h, '--lintel-above': LINTEL_BEAM + LINTEL_SNOW, '--sill-rows': DOOR_BOXES.sill.h,
} as CSSProperties;

/** A few flakes drifting down in front of the doors: placed by a fixed hash, so every load looks the same. */
const FLAKES: CSSProperties[] = Array.from({ length: 22 }, (_, i) => {
  const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: `${(r(1) * 100).toFixed(1)}%`, width: `${4 + Math.round(r(2) * 4)}px`, animationDuration: `${7 + r(3) * 7}s`, animationDelay: `${-r(4) * 14}s`, ['--drift' as string]: `${Math.round((r(5) - 0.5) * 80)}px` } as CSSProperties;
});

const LINES = ['Counting the sheep', 'Fluffing the hay', 'Lighting the lanterns', 'Shooing the hens', 'Sweeping the snow off the step'];

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
  // A quick change shows only a dark fade, until the wait outlasts GRACE_MS: then the doors (a real load).
  const [quick] = useState(() => useDoors.getState().quick);
  const [veil, setVeil] = useState(quick);
  const veilRef = useRef(veil);
  veilRef.current = veil;
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
  // A quick change: the fade, then the screen behind can mount.
  useEffect(() => {
    if (phase !== 'veiling') return;
    const t = setTimeout(() => setPhase('shut'), VEIL_MS);
    return () => clearTimeout(t);
  }, [phase]);
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
    let doorsAt = veilRef.current ? 0 : t0; // when the doors themselves came into view
    let revealed = false;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const age = now - t0;
      const { holds: h, canvas } = useDoors.getState();
      const scenes = [...document.querySelectorAll('canvas[data-engine]')];
      if (!sceneAt && scenes.some((c) => !before.current!.has(c))) sceneAt = now;
      const drawn = !canvas || (scenes.some((c) => c.hasAttribute(DRAWN_ATTR) && !before.current!.has(c)) && scenes.every((c) => c.hasAttribute(DRAWN_ATTR)));
      const ready = drawn && Object.keys(h).length === 0;
      // Behind the fade, ready means open straight away; slower than GRACE_MS, and it is a real load: the doors.
      if (veilRef.current && !ready && age > GRACE_MS) { setVeil(false); doorsAt = now; revealed = true; }
      const stuck = (canvas ? sceneAt > 0 && now - sceneAt > GIVE_UP_MS : age > GIVE_UP_MS) || age > GIVE_UP_TOTAL_MS;
      if ((ready && (veilRef.current || now - doorsAt > (revealed ? REVEAL_HOLD_MS : HOLD_MS))) || stuck) return setPhase('open');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, id]);
  useEffect(() => {
    if (phase !== 'open') return;
    if (liveKey === id) liveKey = -1;
    useDoors.setState({ opened: id });
    if (!veilRef.current) playSound('doorOpen', 0.8);
    const t = setTimeout(() => setPhase('gone'), veilRef.current ? 260 : 1150);
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
    <div className="sk-doors" data-phase={phase} data-veil={veil || undefined} data-revealed={(quick && !veil) || undefined} role="status" aria-live="polite" aria-label={phase === 'open' ? undefined : 'Loading'} style={ART}>
      <div className="sk-doors-spill" />
      {/* The doors are voxels baked to images (src/skin/loading, tools/renderDoors.mjs), each leaf showing its half. */}
      <div className="sk-doors-frame">
        {(['l', 'r'] as const).map((side) => (
          <div key={side} className={`sk-door sk-door-${side}`}><span className="sk-door-art" /></div>
        ))}
      </div>
      <div className="sk-doors-sky" />
      <div className="sk-doors-lintel" />
      <div className="sk-doors-sill" />
      <div className="sk-doors-snow" aria-hidden="true">{FLAKES.map((f, i) => <i key={i} style={f} />)}</div>
      {/* A sign hung from the beam on two ropes once the doors meet: a little moonlit window where a sheep runs and leaps
          a snowy fence, and under it what is being got ready. Only transform and opacity move, so it keeps going while
          the page is busy building a scene. */}
      <div className="sk-load" aria-hidden="true">
        <span className="kit-rope sk-load-rope sk-load-rope--l" /><span className="kit-rope sk-load-rope sk-load-rope--r" />
        <div className="sk-load-board kit-plank" data-knot="2">
          <SnowCap className="kit-snow" />
          <Nails />
          <span className="sk-load-window">
            <LoadingScene />
            <span className="sk-load-sheep"><HopSheep /></span>
            <span className="sk-load-puff"><SnowPuff /></span>
          </span>
          <span className="sk-load-line">{shown.current}…</span>
        </div>
      </div>
    </div>
  );
}

/** Pixel art from rows of letters: one letter a pixel, '.' empty. Drawn with crisp edges, like the game's icons. */
function Pixels({ rows, colors, className }: { rows: readonly string[]; colors: Record<string, string>; className?: string }) {
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      if (c !== '.') rects.push(<rect key={`${x},${y}`} x={x} y={y} width={run} height={1} fill={colors[c]} />);
      x += run;
    }
  });
  return <g className={className}>{rects}</g>;
}

// The sheep, side on and running right: an ink outline, wool with a highlight and a shaded belly, a dark face with a
// white eye and a glint, a red collar and a brass bell. Two sets of legs take turns, so it trots.
const SHEEP_BODY = [
  '......KKKK..KKKK........',
  '....KKWWWWKKWWWWKK......',
  '...KWWHHWWWWWWHHWWK.....',
  '..KWWHWWWWWWWWWWWWWK....',
  '.KWWWWWWWWWWWWWWWWKKKK..',
  '.KWWWWWWWWWWWWWWWKFFFFK.',
  'KWWWWWWWWWWWWWWWWKFGEFFK',
  'KSWWWWWWWWWWWWWWWKFGKFFK',
  'KSWWWWWWWWWWWWWWWKFFFFFK',
  '.KSWWWWWWWWWWWWWCCKFFFK.',
  '.KSSWWWWWWWWWWWSCBCKKK..',
  '..KSSSSWWWWSSSSSKK......',
];
const SHEEP_LEGS_A = ['...KKLLKKKKKKLLKK.......', '....KLLK....KLLK........', '....KLLK....KLLK........', '....KKKK....KKKK........'];
const SHEEP_LEGS_B = ['...KKLLKKKKKKLLKK.......', '...KLLK......KLLK.......', '..KLLK........KLLK......', '..KKKK........KKKK......'];
const SHEEP_COLORS = { K: '#2E2724', W: '#FBF7EC', H: '#FFFFFF', S: '#DCD3C0', F: '#4A4242', G: '#625957', E: '#F6F1E6', L: '#4A4242', C: '#C24E45', B: '#F0C45C' };

function HopSheep() {
  return (
    <svg width={72} height={48} viewBox="0 0 24 16" shapeRendering="crispEdges" aria-hidden="true">
      <Pixels rows={SHEEP_BODY} colors={SHEEP_COLORS} />
      <g transform="translate(0 12)">
        <Pixels rows={SHEEP_LEGS_A} colors={SHEEP_COLORS} className="sk-load-legs-a" />
        <Pixels rows={SHEEP_LEGS_B} colors={SHEEP_COLORS} className="sk-load-legs-b" />
      </g>
    </svg>
  );
}

/** The window's night: sky, a few stars and the moon, dark hills, two snowy pines, the snow field and the fence. */
function LoadingScene() {
  const stars = [[6, 3], [15, 7], [24, 2], [33, 5], [41, 2], [58, 4], [66, 8], [71, 2], [77, 6], [12, 12], [62, 13]];
  const pine = (x: number) => (
    <g key={x}>
      <rect x={x + 3} y={21} width={2} height={5} fill="#3A2A1E" />
      {[0, 1, 2, 3, 4].map((t) => <rect key={t} x={x + 3 - Math.ceil(t * 0.8)} y={11 + t * 2} width={2 + Math.ceil(t * 0.8) * 2} height={2} fill={t % 2 ? '#24453A' : '#2D5546'} />)}
      {[0, 2, 4].map((t) => <rect key={`s${t}`} x={x + 3 - Math.ceil(t * 0.8)} y={11 + t * 2} width={1 + Math.ceil(t * 0.8)} height={1} fill="#EAF2FB" />)}
    </g>
  );
  return (
    <svg className="sk-load-scene" viewBox="0 0 96 32" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      <rect width={96} height={32} fill="#1B2143" />
      <rect y={14} width={96} height={18} fill="#222A52" />
      {stars.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="#FFF3CF" className={i % 3 === 0 ? 'sk-load-twinkle' : undefined} />)}
      <rect x={82} y={3} width={5} height={5} fill="#FFF1C9" /><rect x={81} y={4} width={1} height={3} fill="#FFF1C9" /><rect x={84} y={4} width={2} height={2} fill="#E9DBB0" />
      <path d="M0 22h8v-2h10v-2h12v2h10v-3h14v3h12v-2h12v2h8v10H0z" fill="#2B3561" />
      {pine(2)}{pine(84)}
      <rect y={26} width={96} height={6} fill="#EEF4FA" />
      <rect y={26} width={96} height={1} fill="#FFFFFF" />
      <path d="M0 31h96v1H0zM10 29h6v1h-6zM60 28h8v1h-8zM30 30h10v1H30z" fill="#C9D7E8" />
      {/* The fence the sheep jumps: two posts and two rails, snow on top. */}
      <rect x={43} y={17} width={2} height={10} fill="#8B5E3C" /><rect x={51} y={17} width={2} height={10} fill="#8B5E3C" />
      <rect x={44} y={17} width={1} height={10} fill="#5A3C25" /><rect x={52} y={17} width={1} height={10} fill="#5A3C25" />
      <rect x={40} y={19} width={16} height={2} fill="#9A6B47" /><rect x={40} y={23} width={16} height={2} fill="#9A6B47" />
      <rect x={40} y={20} width={16} height={1} fill="#6F4A2E" /><rect x={40} y={24} width={16} height={1} fill="#6F4A2E" />
      <rect x={42} y={16} width={4} height={1} fill="#FFFFFF" /><rect x={50} y={16} width={4} height={1} fill="#FFFFFF" /><rect x={40} y={18} width={16} height={1} fill="#F2F7FC" />
    </svg>
  );
}

/** The puff of snow kicked up where the sheep lands. */
function SnowPuff() {
  return (
    <svg width={36} height={18} viewBox="0 0 12 6" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 4h2v2H2zM5 2h2v4H5zM8 3h2v3H8zM0 5h1v1H0zM11 5h1v1h-1zM4 1h1v1H4zM8 1h1v1H8z" fill="#F4F8FF" />
    </svg>
  );
}
