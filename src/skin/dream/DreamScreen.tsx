import { useLoadingHold, whenDoorsOpen } from '../components/BarnDoors';
import { foldAccents, getLang } from '../../lib/lang';
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { streakRow } from './streakRow';
import { dreamStreakDays, getDreamBest, getDreamStreak, loadStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { check, DREAM_LENGTH, dreamGlyphs, dreamSeed, dreamShareText, dreamSummary, fenceAt, FIELD, formatHint, lettersAt, matched } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useIsMobile } from '../../ui/hooks';
import { Paper } from '../kit';
import { localDateKey } from '../hooks/useToday';
import { useMotionLevel } from '../hooks/useAmbient';
import { PAINTED_TITLE } from '../screens/PaintedHome';
import { shareCard } from '../share/card';
import { DevLine } from '../table/DevStats';
import { useCoveredFps } from '../perf/governor';
import { advance, bpmOf } from './beat';
import { BedroomBubble } from './BedroomBubble';
import type { RoomAnchors } from './BedroomBubble';
import { DreamStage } from './DreamStage';
import type { FenceView, Phase } from './DreamStage';
import { dreamLink, useDreamUi } from './dreamStore';
import { flyTiles } from './fly';
import { Fx } from './Fx';
import type { FxHandle } from './Fx';
import { bubbleShape, dreamFrame, isPhoneLayout, meterSegments, NOSE, RIM, stripCamera, stripPoint, tailPuffs } from './frame';
import { Counter, DreamCard, Hint, ModeChip, NightTrack, ReadyBoard, Tail, Tray, trayWord } from './Interface';
import type { CardKind } from './Interface';
import { activeFence, freshLive, MAX_TYPED, TYPE_X, update } from './run';
import type { Live } from './run';
import { useTier } from '../perf/tier';
import type { StageN } from './scene/types';
import { freshWorldState, CHANGE_MS } from './world3d/DreamWorld';
import type { DreamWorldState, WorldN } from './world3d/DreamWorld';
import { lapAt, worldAt } from './worlds';
import { PLAN_M, projectDream } from './camera';
import { Art } from './Interface';
import { Results } from './Results';
import { placeSigns, signLayout, Signs, SLOTS } from './Signs';
import { DRIFT, dreamView, OPENING, PX, SHEEP_CENTRE, WAKE, worldX } from './stage';
import './dream.css';

/**
 * Counting Sheep: the farmer's dream (docs/dream/, the redesign of 2026-11-24). He sleeps in his bed along the bottom of
 * the screen, and the dream rises above him as one big thought bubble: his sheep runs along a lane and jumps fences
 * whose signs carry the night's letters. Any real word that starts with a sign's letters clears its fence, one more
 * sheep counted; the word is typed as letter tiles in the tray. Reach a fence without a word and the sheep bumps it,
 * which wakes him, or, once he is out cold, ends the night with him asleep. The rules live in src/dream/dream.ts and
 * are only played out here; nothing in the scene writes to the run.
 */
const SAYS: Record<string, string> = { short: 'Three letters or more', letters: 'Start with the letters on the sign', word: 'Not in the dictionary', used: 'Already counted that one', wait: 'Wait for the next fence' };
/** `left` is the meter's lit segments, -1 with no fence coming. */
interface Hud { letters: string[]; typed: string; say: string; wrong: boolean; active: boolean; index: number; left: number }
/** A refusal stays up this long, and the "?" over the farmer this long (docs/dream/data/timings.json). */
const SAY_MS = 1600, MARK_MS = 800;
/** A card drops in, stays and fades (section 8): 160 + 1400 + 160 ms. */
const CARD_MS = 1720;

/** The local date as "6 Nov". */
const shortDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : undefined, { day: 'numeric', month: 'short' });
/** The next local midnight, as "12:00 am". */
function midnightLabel(): string {
  const d = new Date(); d.setHours(24, 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** The scene follows the visual viewport on phones, so the keyboard never covers the bar. */
function useViewportHeight(): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setH(Math.round(vv.height));
    on();
    vv.addEventListener('resize', on);
    return () => vv.removeEventListener('resize', on);
  }, []);
  return h;
}

/** The dream's own size in CSS px: the side view and the HTML over it are laid out from it. */
function useBoxSize(el: HTMLElement | null): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight }));
  useEffect(() => {
    if (!el) return;
    const on = () => setSize((was) => (was.w === el.clientWidth && was.h === el.clientHeight ? was : { w: el.clientWidth, h: el.clientHeight }));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}

/** The night as saved: what the home screen's ticket and its share read back. */
function recordOf(L: Live, night: string, repaired: boolean) {
  return { date: night, status: 'done' as const, count: L.count, longest: L.longest, repaired: repaired ? true : undefined, reached: L.reached, bumps: L.bumps, asleep: L.deepAt !== null };
}

export function DreamScreen() {
  const dict = useStore((s) => s.dict);
  useLoadingHold('words', !dict, 'Fetching the word list');
  const practice = useDreamUi((s) => s.practice);
  const repair = useDreamUi((s) => s.repair);
  const close = useDreamUi((s) => s.close);
  const openDream = useDreamUi((s) => s.openDream);
  const reduced = useMotionLevel() === 'reduced';
  const mobile = useIsMobile();
  const vh = useViewportHeight();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const box = useBoxSize(root);
  // The screen's layout. A phone's fills the part of the screen visible above its keyboard.
  const fitKeys = isPhoneLayout(box.w, vh ?? box.h) && !!vh;
  const frame = useMemo(() => dreamFrame(Math.max(1, box.w), Math.max(1, fitKeys ? vh! : box.h)), [box.w, box.h, vh, fitKeys]);
  const segments = useRef(11);
  segments.current = meterSegments(frame.tiles, frame.phone, frame.u);
  // The side view of the dream's own box, as the stage has it: where the sheep's hooves and the ground line are.
  const view = useMemo(() => dreamView(Math.max(1, frame.view.w), Math.max(1, frame.view.h), mobile), [frame, mobile]);
  const viewRef = useRef(view);
  viewRef.current = view;
  // The effects (06): the two flat canvases, the beat's count, and the pieces of the screen they move.
  const fx = useRef<FxHandle>(null);
  const beat = useRef({ beats: 0 });
  const bubbleEl = useRef<HTMLDivElement>(null), stageEl = useRef<HTMLDivElement>(null), flyLayer = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  // The signs' boards: one tag a slot, moved to its fence every frame; how high they hang in this view.
  const signTags = useMemo(() => Array.from({ length: SLOTS }, () => createRef<HTMLDivElement>()), []);
  const signRoot = useRef<HTMLDivElement>(null);
  const signs = useMemo(() => signLayout(view, frame), [view, frame]);
  const signsRef = useRef(signs);
  signsRef.current = signs;
  useEffect(() => { signRoot.current?.toggleAttribute('data-compact', !signs.plank); });
  const low = useTier() === 'low';
  const sceneRef = useRef({ low, phone: frame.phone });
  sceneRef.current = { low, phone: frame.phone };
  /** A short move of the whole dream window (a swell, a dip, a shake): never under reduced motion. */
  const nudge = useCallback((frames: Keyframe[], ms: number, origin = '50% 50%') => {
    const el = bubbleEl.current;
    if (!el || reducedRef.current || typeof el.animate !== 'function') return;
    el.style.transformOrigin = origin;
    el.animate(frames, { duration: ms, easing: 'linear' });
  }, []);
  /** Where a fence's sign is on screen: its word plank, or its board where the window is too short for a plank. */
  const signRect = useCallback((index: number): DOMRect | null => {
    const tag = stageEl.current?.querySelector(`.dr-sign-tag[data-fence="${index}"]`);
    const plank = tag?.querySelector('.dr-sign-plank')?.getBoundingClientRect();
    return (plank && plank.width > 0 ? plank : tag?.querySelector('.dr-sign-board')?.getBoundingClientRect()) ?? null;
  }, []);
  const [glow, setGlow] = useState(0);
  const [bigZ, setBigZ] = useState(0);
  /** A bump: the window shakes 6 px each way four times in 240 ms, and an ember glow shows round its inside edge, once. */
  const jolt = useCallback(() => {
    nudge([0, 6, -6, 6, -6, 6, -6, 6, -6, 0].map((x) => ({ transform: `translateX(${x}px)` })), 240);
    setGlow(Math.random() + 1);
  }, [nudge]);
  // The night this dream belongs to, fixed when the screen opens: a dream begun before midnight is still that night's.
  const [today] = useState(() => localDateKey(new Date()));
  const night = repair ?? today;
  // `?dreamSeed=1` fixes the practice run for the gate script (V4.1 Part 10); it never touches tonight's dream.
  const [seed, setSeed] = useState(() => {
    const fixed = new URLSearchParams(location.search).get('dreamSeed');
    return practice ? `practice:${fixed ?? Date.now()}` : dreamSeed(night);
  });
  const [phase, setPhase] = useState<Phase>('ready');
  // Over the results the bedroom covers the dream whole: once it has faded in, the dream stops drawing.
  const stageFps = useCoveredFps(phase === 'results', 'bedroom');
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(() => getDreamBest());
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState<Hud>({ letters: [], typed: '', say: '', wrong: false, active: false, index: -1, left: -1 });
  // The stage: the letters a fence asks for where the sheep now is, 1 to 3 (docs/dream/00-overview.md, section 4).
  const [stage, setStage] = useState<StageN>(1);
  const [card, setCard] = useState<{ kind: CardKind; key: number } | null>(null);
  const [mark, setMark] = useState<'bang' | 'question' | null>(null);
  const sayUntil = useRef(0);
  const show = useCallback((kind: CardKind) => {
    const key = Math.random();
    setCard({ kind, key });
    setTimeout(() => setCard((c) => (c?.key === key ? null : c)), CARD_MS);
  }, []);
  const [fences, setFences] = useState<FenceView[]>([]);
  const [counted, setCounted] = useState<{ n: number; key: number } | null>(null);
  const [reached, setReached] = useState(0);
  // Out cold (the night's fence mark is behind him): the dream runs on, and for a moment a card says so.
  const [deep, setDeep] = useState(false);
  // How the dream ends (07, section 3): it pops when a bump wakes him, or sinks into his head when he sleeps on.
  const [pop, setPopStage] = useState<'none' | 'pop' | 'sink'>('none');
  // The results board slides in a moment after the bedroom has opened to the whole screen.
  const [boardUp, setBoardUp] = useState(false);
  // The opening (07, section 2): waiting for the loading screen to lift, playing, done.
  const [opening, setOpening] = useState<'wait' | 'play' | 'done'>(reduced ? 'done' : 'wait');
  useEffect(() => {
    if (opening !== 'wait') return;
    return whenDoorsOpen(() => setOpening('play'));
  }, [opening]);
  useEffect(() => {
    if (opening !== 'play') return;
    const t = setTimeout(() => setOpening('done'), OPENING.grown + 200);
    return () => clearTimeout(t);
  }, [opening]);
  // The keys go to the tray's field from the first moment, whatever the opening is showing.
  useEffect(() => { if (phaseRef.current === 'ready') ghost.current?.focus(); }, [opening]);
  const ghost = useRef<HTMLInputElement>(null);
  // Over his head in the room: the stage projects his head onto this every frame (his "z"s, or the "!").
  const headAnchor = useRef<HTMLDivElement>(null);
  const anchors = useRef<RoomAnchors>({ head: headAnchor }).current;
  const live = useRef<Live>(freshLive(seed));
  // Which world each fence stands in (docs/dream/v3/01, section 5): read from the rules' letters, never typed.
  const worldOf = useMemo(() => {
    let F3 = 0;
    while (lettersAt(F3) < 3 && F3 < 500) F3++;
    return (i: number): WorldN => worldAt(i + 1, lettersAt(i) as 1 | 2 | 3, F3 + 1);
  }, []);
  const lapOf = useMemo(() => {
    let F3 = 0;
    while (lettersAt(F3) < 3 && F3 < 500) F3++;
    return (i: number): number => lapAt(i + 1, F3 + 1);
  }, []);
  const worldState = useRef<DreamWorldState>(freshWorldState(worldOf));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;
  // The night has a shape; practice is the endless version ("How far can you run?").
  const length = practice ? null : DREAM_LENGTH;

  /** Starts the night; true when it did. The ref moves at once, so a letter typed in the same key press can land. */
  const begin = useCallback((): boolean => {
    if (phaseRef.current !== 'ready' || !dict) return false;
    if (!practice) markDreamStarted(night);
    live.current = freshLive(seed);
    setOpening('done'); // any key skips the opening
    setPhase('running');
    phaseRef.current = 'running';
    ghost.current?.focus();
    return true;
  }, [dict, practice, seed, night]);

  const record = useCallback(() => {
    const L = live.current;
    if (practice) return recordBest(L.count);
    return recordDream(recordOf(L, night, !!repair));
  }, [practice, night, repair]);

  const finish = useCallback(() => {
    const L = live.current;
    setPhase('results');
    if (practice) setBest(recordBest(L.count));
    else { setStreak(record()); setBest(getDreamBest()); }
  }, [practice, record]);

  // Leaving mid-dream still uses up the night's attempt, with what was counted so far.
  useEffect(() => () => {
    if (['running', 'crashed', 'drifting'].includes(phaseRef.current) && !practice) recordDream(recordOf(live.current, night, !!repair));
  }, [practice, night, repair]);

  // ---------- typing ----------
  const active = () => activeFence(live.current);
  const typeLetter = (ch: string) => {
    // The letter that starts the night is also the first letter of the word: the sign says "Type a word", and a
    // player who did lost that letter, so their first word always bounced (PART went in as ART).
    if (phaseRef.current === 'ready' && !begin()) return;
    if (phaseRef.current !== 'running') return;
    const L = live.current;
    if (L.typed.length >= MAX_TYPED) return;
    L.typed += ch;
    L.say = '';
    const a = active();
    playTick(a ? matched(a.f, trayWord(a.f.letters, L.typed).word) / a.f.letters.length : 0.2);
  };
  const backspace = () => { live.current.typed = live.current.typed.slice(0, -1); live.current.say = ''; };
  const submit = () => {
    if (phaseRef.current === 'ready') { begin(); return; }
    if (phaseRef.current !== 'running' || !dict) return;
    const L = live.current;
    if (!L.typed) return;
    const a = active();
    // The sign's letters are already in the tray, so the word may be typed whole or only from where the sign stops:
    // the word as typed is tried first, then the sign's letters with what was typed after them. Which words count is
    // the rules' own check either way.
    const typed = L.typed.toLowerCase(), start = a ? a.f.letters.join('') : '';
    const tries = !a ? [] : typed.startsWith(start) ? [typed, start + typed] : [trayWord(a.f.letters, typed).word];
    const w = tries.find((t) => check(dict, a!.f, t, L.used).ok) ?? tries[0] ?? typed;
    const v = a ? check(dict, a.f, w, L.used) : ({ ok: false, reason: 'wait' } as const);
    if (a && v.ok) {
      // The typed tiles fly to the sign's plank (06, section 2); as the first lands a ring spreads from the sign and
      // the window swells about it. Under reduced motion the word simply appears on the plank.
      const index = a.index, layer = flyLayer.current;
      const landed = () => {
        const r = signRect(index), st = stageEl.current?.getBoundingClientRect(), bb = bubbleEl.current?.getBoundingClientRect();
        if (!r || !st || !bb) return;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        fx.current?.ring(cx - st.left, cy - st.top);
        nudge([1, 1.012, 1].map((k) => ({ transform: `scale(${k})` })), 140, `${Math.round(cx - bb.left)}px ${Math.round(cy - bb.top)}px`);
      };
      if (layer && !reduced) flyTiles(layer, [...layer.parentElement!.querySelectorAll('.dr-tray .dr-tile--typed')].map((el) => ({ ch: el.textContent ?? '', from: el.getBoundingClientRect() })), () => signRect(index), landed);
      // In the bed, the farmer lets out one larger "z".
      setBigZ(Math.random() + 1);
      a.locked = true;
      a.word = w;
      L.used.add(w);
      L.longest = Math.max(L.longest, w.length);
      L.typed = '';
      playSound('bank');
    } else if (!v.ok) {
      L.wrongUntil = L.t + 320;
      L.say = SAYS[v.reason];
      sayUntil.current = L.t + SAY_MS;
      playSound('fail');
      // A "?" over the farmer's head: he does not move.
      setMark('question');
      setTimeout(() => setMark((m) => (m === 'question' ? null : m)), MARK_MS);
    }
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); begin(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submit(); }
  };
  const onInput = (value: string) => {
    for (const ch of foldAccents(value.toLowerCase())) if (ch >= 'a' && ch <= 'z') typeLetter(ch);
    if (ghost.current) ghost.current.value = '';
  };
  const focus = () => ghost.current?.focus();

  // ---------- the loop: the rules run here; the stage reads positions from the live ref every frame ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudKey = '', fenceKey = '', alarmed = false, stageNow = 1;
    const signState: string[] = [];
    // The worlds and their gates (v3/01, section 5; 07): a gate stands 3.0 m before the first fence of the world it
    // opens, and the world changes as the sheep passes its mark. Nothing on screen says when.
    const W = worldState.current = freshWorldState(worldOf);
    if (import.meta.env.DEV) Object.assign(window, { __dreamWorld: W });
    const GATE_AHEAD = (3.0 * PLAN_M) / PX, POSTS = (6.6 * PLAN_M) / PX;
    const gated = new Set<number>();
    const events = {
      jump: () => {
        playSound('play'); // the bell at take-off
      },
      count: (n: number) => {
        setCount(n); setReached(live.current.reached); setCounted({ n, key: Math.random() });
        // Every 10 sheep the moon puts on a show (v3/07, section 5).
        if (n % 10 === 0) W.moonShowAt = live.current.t;
      },
      stumble: () => {
        // A bump short of the last: the fence goes flat, the farmer stirs, and the run carries on.
        playSound('trap', 0.6);
        setReached(live.current.reached);
        show('bump');
        jolt();
      },
      deep: () => {
        // The night's mark: he is out cold. Nothing stops; the fences keep coming for as long as the sheep clears them.
        playSound('roundEnd', 0.7);
        setReached(live.current.reached);
        setDeep(true);
        show('deep');
      },
      asleep: () => {
        // A bump he sleeps through: no pop, the fence goes flat, the farmer sleeps on and the dream softens.
        playSound('trap', 0.4);
        setCount(live.current.count);
        setReached(live.current.reached);
        show('slept');
        jolt();
        setPhase('drifting');
        // The dream sinks into his head, the bedroom opens, and the board slides in (07, section 3.1).
        if (!reduced) setTimeout(() => setPopStage('sink'), DRIFT.sink);
        setTimeout(finish, reduced ? DRIFT.reducedRoom : DRIFT.room);
        setTimeout(() => setBoardUp(true), reduced ? DRIFT.reducedBoard : DRIFT.board);
      },
      bump: () => {
        // Bump: the farmer stirs (the stage plays the wake-up; this calls finish when it ends).
        playSound('trap');
        setPhase('crashed');
        setCount(live.current.count);
        show('bump');
        setMark('bang');
        jolt();
        // The dream pops, the bedroom opens, and the board slides in (07, section 3.2).
        if (!reduced) setTimeout(() => setPopStage('pop'), WAKE.pop);
        setTimeout(finish, reduced ? WAKE.reducedRoom : WAKE.room);
        setTimeout(() => setBoardUp(true), reduced ? WAKE.reducedBoard : WAKE.board);
      },
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const ph = phaseRef.current;
      if (ph === 'running' || ph === 'ready' || ph === 'crashed' || ph === 'drifting') { L.t += dt; beat.current.beats = advance(beat.current.beats, dt, stageNow); }
      if (ph === 'running') update(L, dt, seed, events, length);
      // A gate for each fence that opens a new world, as it joins the queue.
      for (const fe of L.fences) {
        if (fe.index < 1 || gated.has(fe.index) || worldOf(fe.index) === worldOf(fe.index - 1)) continue;
        gated.add(fe.index);
        const to = worldOf(fe.index), type = to === 2 ? 1 : to === 3 ? 2 : 3;
        W.gates.push({ type, dist: L.dist + fe.x + FIELD.fenceW / 2 - GATE_AHEAD, to, lap: lapOf(fe.index), passed: false });
      }
      // Passing one: gate 1 at its middle, gate 2 at the footboard's first post, gate 3 at the headboard's second.
      const sheepAt = L.dist + SHEEP_CENTRE;
      for (const g of W.gates) {
        const mark = g.dist + (g.type === 3 ? POSTS : 0);
        if (g.passed || ph !== 'running' || sheepAt < mark) continue;
        g.passed = true;
        W.change = { from: W.world, to: g.to, dist: g.dist, at: L.t };
        W.world = g.to;
        W.laps[g.to] = g.lap;
        const kind = g.to === 2 ? (g.lap > 1 ? 'lift' : 'stage2') : g.to === 3 ? (g.lap > 1 ? 'quilt' : 'stage3') : 'turn';
        setTimeout(() => show(kind as CardKind), 100);
        if (g.type === 1 && !reduced) { const v = viewRef.current, [gx] = projectDream(v, worldX(SHEEP_CENTRE) / PLAN_M, 0, 0); fx.current?.ring(gx, v.ground - 110, true); }
      }
      W.gates = W.gates.filter((g) => g.dist - L.dist > -2000);
      if (W.change && L.t - W.change.at > CHANGE_MS[W.change.to] + 100) W.change = null;
      W.beats = beat.current.beats;
      W.breath = 0.5 - 0.5 * Math.cos((L.t / 3200) * Math.PI * 2);
      const world = W.world;
      placeSigns(L, viewRef.current, signTags, signState);
      fx.current?.frame(L.t);
      // The farmer's alarm, low, as the dream pops.
      if (L.crashAt !== null && !alarmed && L.t - L.crashAt >= WAKE.pop) { alarmed = true; playSound('alarm', 0.35); }
      if (L.crashAt === null) alarmed = false;
      // What React shows, refreshed only when it changes.
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const wrong = L.t < L.wrongUntil, say = L.t < sayUntil.current ? L.say : '';
      // The meter: full when the fence opens for typing, empty as it reaches the sheep.
      const near = FIELD.sheepX + FIELD.sheepW;
      const left = a ? Math.ceil(Math.min(1, Math.max(0, (a.x - near) / (TYPE_X - near))) * segments.current) : -1;
      const hk = `${a?.index ?? -1}:${L.typed}:${say}:${wrong}:${left}`;
      if (hk !== hudKey) {
        hudKey = hk;
        setHud({ letters: a ? a.f.letters : [], typed: L.typed, say, wrong, active: !!a, index: a?.index ?? -1, left });
      }
      if (world !== stageNow) { stageNow = world; setStage(world as StageN); }
      const fk = L.fences.map((fe) => `${fe.index}:${fe.locked ? fe.word : ''}:${fe === a}:${fe === a && wrong}`).join('|');
      if (fk !== fenceKey) {
        fenceKey = fk;
        setFences(L.fences.map((fe) => ({ index: fe.index, kind: fe.f.kind, letters: fe.f.letters, word: fe.word, locked: fe.locked, hot: fe === a, wrong: fe === a && wrong })));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seed, finish, reduced, length, show, jolt, nudge, signTags, worldOf, lapOf]);


  // ---------- results ----------
  const streakNow = streak || getDreamStreak(today);
  const blankets = loadStreak().blankets;
  const share = async () => {
    const L = live.current;
    const asleep = L.asleepAt !== null;
    const text = dreamShareText({ date: night, count, longest: L.longest, streak: streakNow, blankets, bumped: !asleep, fences: L.reached, bumps: L.bumps, seed, title: PAINTED_TITLE, url: dreamLink() });
    await shareCard({
      title: `Counting Sheep, ${night}`,
      headline: asleep ? 'The farmer drifted off' : `The farmer counted ${count} sheep`,
      lines: [asleep ? dreamSummary({ count, longest: L.longest }) : L.longest > 0 ? `Longest word: ${L.longest} letters` : '', streakNow > 1 ? `${streakNow}-night streak` : ''].filter(Boolean),
      count, unit: 'sheep',
      stitches: practice ? undefined : streakRow(dreamStreakDays(today), streakNow),
      glyphs: dreamGlyphs(count, !asleep, { seed, bumps: L.bumps }),
    }, text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const practiceAgain = () => {
    const s = `practice:${Date.now()}`;
    openDream(true);
    setSeed(s);
    live.current = freshLive(s);
    setPopStage('none');
    setBoardUp(false);
    setOpening(reduced ? 'done' : 'play');
    setCount(0); setCounted(null); setStreak(0); setReached(0); setDeep(false); setCard(null); setMark(null); setStage(1); setGlow(0);
    fx.current?.reset();
    beat.current.beats = 0;
    setFences([]);
    setPhase('ready');
    ghost.current?.focus();
  };


  const sign = hud.letters.join('').toUpperCase();
  // The only hint: on the first fence of each new length, how it works, shown with a different start.
  const hint = hud.active && hud.index >= 0 ? formatHint(seed, fenceAt(seed, hud.index)) : null;
  const caption = phase !== 'running' || hud.say || !hint ? null
    : hud.letters.length === 1
      ? <>Type any word that starts with the letter on the sign, like <b>{hint.word.toUpperCase()}</b> for <b>{hint.start.toUpperCase()}</b>.</>
      : <>Now {hud.letters.length === 2 ? 'two' : 'three'} letters: start your word with all of them, like <b>{hint.word.toUpperCase()}</b> for <b>{hint.start.toUpperCase()}</b>.</>;
  const longest = live.current.longest;
  const asleep = phase === 'results' && live.current.asleepAt !== null;
  // The streak as knitted stitches, filled from the left; tonight's is ringed once it is played.
  const row = phase === 'results' && !practice ? streakRow(dreamStreakDays(today), streakNow) : [];
  const tonight = row.filter((st) => st !== 'empty').length - 1;
  const days = row.map((st, i) => (i === tonight && st === 'played' ? 'today' as const : st));
  const fenceNow = length ? Math.min(reached + 1, length.fences) : 0;
  // The frame (frame.ts): the bubble's shape, its tail down to the farmer's nose, and the point the dream pops toward.
  const shape = useMemo(() => bubbleShape(frame.bubble.w, frame.baseline, frame.scallops), [frame]);
  const tail = useMemo(() => {
    const cam = stripCamera(frame), puffs = tailPuffs(frame, cam);
    return { puffs, nose: stripPoint(cam, NOSE.x, NOSE.y, NOSE.z) };
  }, [frame]);
  const small = tail.puffs[tail.puffs.length - 1], popAt: [number, number] = [small.x + small.w / 2, small.y + small.h / 2];
  const px = (v: number) => `${Math.round(v)}px`;
  const rootVars = {
    '--u': `${frame.u}px`, '--dr-beat': `${(60 / bpmOf(deep ? 3 : stage)).toFixed(3)}s`, '--dr-pop-x': px(popAt[0]), '--dr-pop-y': px(popAt[1]),
    '--dr-org-x': px(popAt[0] - frame.bubble.x), '--dr-org-y': px(popAt[1] - frame.bubble.y), '--dr-org-bx': px(popAt[0] - frame.bubble.x),
  } as React.CSSProperties;
  // The night track's groups: where the sign's letter count changes, read from the rules.
  const groups = useMemo(() => {
    const out: { letters: number; count: number }[] = [];
    for (let i = 0; length && i < length.fences; i++) { const n = lettersAt(i); if (out[out.length - 1]?.letters === n) out[out.length - 1].count++; else out.push({ letters: n, count: 1 }); }
    return out;
  }, [length]);
  const bumpedAt = live.current.bumps[live.current.bumps.length - 1];
  const ended = length && bumpedAt !== undefined && bumpedAt < length.fences ? bumpedAt : null;
  const playing = phase !== 'results';
  const over = phase === 'crashed' || phase === 'drifting';
  const chip = practice ? (frame.phone ? 'Practice' : 'Practice dream') : frame.phone ? shortDate(night) : repair ? `Last night's dream: ${shortDate(night)}` : `Tonight's dream: ${shortDate(night)}`;

  if (!dict) return <main className="dr-root"><Paper kind="slip" className="dr-loading">Loading the word list...</Paper></main>;

  return (
    <main ref={setRoot} className="dr-root hm rc" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase} data-phone={frame.phone || undefined} data-pop={pop !== 'none' ? pop : undefined} data-opening={phase === 'ready' && opening !== 'done' ? opening : undefined} onPointerDown={focus} style={{ ...rootVars, ...(fitKeys ? { height: vh! } : {}) }}>
      <BedroomBubble live={live} phase={phase} reduced={reduced} phone={mobile} blankets={blankets} anchors={anchors} depth={deep ? 3 : stage} frame={frame} beat={beat} />
      {playing && (
        <div ref={bubbleEl} className="dr-bubble" style={{ left: frame.bubble.x, top: frame.bubble.y, width: frame.bubble.w, height: frame.bubble.h }}>
          <i className="dr-bubble-shade" style={{ clipPath: shape.outer }} />
          <i className="dr-bubble-rim" style={{ clipPath: shape.outer }} />
          <div className="dr-window" style={{ clipPath: shape.inner }}>
            <div ref={stageEl} className="dr-stage" style={{ inset: RIM }}>
              <Fx ref={fx} w={view.w} h={view.h} reduced={reduced}>
                <DreamStage live={live} pop={counted} phase={phase} reduced={reduced} phone={mobile} fps={stageFps} world={worldState} seed={seed} low={low} />
              </Fx>
              <Signs fences={fences} tags={signTags} root={signRoot} />
            </div>
            {glow > 0 && <i key={glow} className="dr-glow" aria-hidden="true" />}
            {/* The counters, inside the top of the dream window (section 7). */}
            <header className="dr-top">
              <ModeChip>{chip}</ModeChip>
              {length && <NightTrack groups={groups} reached={reached} ended={ended} />}
              <Counter count={count} of={length && !deep ? length.fences : null} note={deep ? 'out cold' : best > 0 && practice ? `best ${best}` : undefined} onClose={close} />
            </header>
            <div className="dr-cards" aria-live="polite">{card && <DreamCard key={card.key} kind={card.kind} />}</div>
            {phase === 'ready' && <ReadyBoard practice={!length} />}
            {frame.phone && (hud.say || caption) && <Hint kind={hud.say ? 'no' : 'hint'} style={{ left: frame.hint.x - frame.bubble.x, width: frame.hint.w, bottom: frame.hint.bottom - (frame.h - frame.bubble.y - frame.bubble.h) }}>{hud.say || caption}</Hint>}
          </div>
        </div>
      )}
      {playing && <Tail puffs={tail.puffs} nose={tail.nose} depth={deep ? 3 : stage} mark={mark} asleep={phase !== 'crashed'} extra={bigZ} />}
      <div ref={flyLayer} className="dr-fly" aria-hidden="true" />
      {pop === 'pop' && !reduced && (
        // The dream pops: its rim breaks into 14 pixel puffs that fly 60 to 140 px outward, through the three frames.
        <div className="dr-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2, b = frame.bubble, far = 60 + ((i * 37) % 81);
            const x = b.x + b.w / 2 + (Math.cos(a) * b.w) / 2, y = b.y + b.h / 2 + (Math.sin(a) * b.h) / 2;
            return (
              <span key={i} style={{ left: Math.min(b.x + b.w, Math.max(b.x, x)), top: Math.min(b.y + b.h, Math.max(b.y, y)), '--dx': `${Math.round(Math.cos(a) * far)}px`, '--dy': `${Math.round(Math.sin(a) * far)}px` } as React.CSSProperties}>
                <Art name="puff-1" px={4} /><Art name="puff-2" px={4} /><Art name="puff-3" px={4} />
              </span>
            );
          })}
        </div>
      )}
      <DevLine />

      {playing && !frame.phone && (hud.say || caption) && <Hint kind={hud.say ? 'no' : 'hint'} style={{ left: frame.hint.x, width: frame.hint.w, bottom: frame.hint.bottom }}>{hud.say || caption}</Hint>}
      {playing && (
        // The tray (section 4): the sign's letters stand in it, yours arrive as tiles, and Jump does what Enter does.
        <Tray frame={frame} sign={hud.active ? hud.letters : phase === 'ready' ? fenceAt(seed, 0).letters : []} typed={hud.typed} wrong={hud.wrong}
          left={hud.active && hud.left >= 0 && phase === 'running' ? hud.left / segments.current : phase === 'ready' ? 1 : null}
          over={over} canJump={phase === 'ready' || (phase === 'running' && hud.typed.length > 0)} onJump={submit}>
          <input
            ref={ghost} className="sk-input-ghost dr-ghost" autoFocus aria-label="Your word" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            enterKeyHint="go" onChange={(e) => onInput(e.target.value)} disabled={over}
            onBlur={() => { if (phaseRef.current === 'running' || phaseRef.current === 'ready') setTimeout(() => ghost.current?.focus(), 0); }}
          />
        </Tray>
      )}
      <p className="sr-only" aria-live="polite">{phase === 'running' ? `Starts with ${sign}. ${count} sheep.` : ''}</p>

      {phase === 'results' && (
        <>
          {/* Around him in the room (07, section 4.4): large "z"s when he drifted off; an "!" for the first second when he woke. */}
          <div ref={headAnchor} className="dr-res-head-at" aria-hidden="true">
            {asleep
              ? [0, 1, 2].map((i) => <span key={i} className="dr-z dr-z--room" style={{ animationDelay: `${-0.45 * i}s` }}><Art name="z" px={4} /></span>)
              : <span className="dr-mark dr-mark--once"><Art name="bang" px={4} /></span>}
          </div>
          {boardUp && (
            <div className="dr-res-at">
              <Results
                title={practice ? 'Practice dream' : asleep ? 'The farmer drifted off' : 'The farmer woke up!'}
                count={count}
                facts={[
                  ...(asleep && length ? [`Asleep after ${length.fences} fences`] : length ? [`Fence ${fenceNow} of ${length.fences}`] : []),
                  `Longest word: ${longest > 0 ? `${longest} letters` : 'none yet'}`,
                ]}
                words={[...live.current.used]} stage={deep ? 3 : stage} seed={seed}
                streak={practice ? null : { now: streakNow, best: loadStreak().best, days }}
                pay={{ id: `dream:${seed}`, sheep: count, slept: asleep, bestStreak: practice ? 0 : loadStreak().best }}
                next={practice ? null : midnightLabel()}
                note={practice ? 'Practice dreams don’t count toward your streak.' : undefined}
                copied={copied} reduced={reduced} onShare={share} onPractice={practiceAgain} onClose={close}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
