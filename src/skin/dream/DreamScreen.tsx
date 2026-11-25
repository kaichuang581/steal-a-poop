import { useLoadingHold } from '../components/BarnDoors';
import { foldAccents, getLang } from '../../lib/lang';
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { streakRow } from './streakRow';
import { DreamPayout } from '../shop/Payout';
import { dreamStreakDays, getDreamBest, getDreamStreak, loadStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { check, DREAM_LENGTH, dreamGlyphs, dreamSeed, dreamShareText, dreamSummary, fenceAt, FIELD, formatHint, lettersAt, matched } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useIsMobile } from '../../ui/hooks';
import { Board, Brass, Knit, Paper, Slate, WoodButton } from '../kit';
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
import { FESTIVE } from '../../config';
import { useTier } from '../perf/tier';
import { MOONS } from './scene/common';
import { S0 } from './scene/types';
import type { SceneState } from './scene/types';
import { placeSigns, signLayout, Signs, SLOTS } from './Signs';
import { ART, DRIFT, drawnLift, dreamView, screenX, SHEEP_ART, SHEEP_CENTRE, WAKE } from './stage';
import { STAR_WORDS } from './starWords';
import { CLOUD_MS, WakeClouds } from './WakeClouds';
import type { CloudState } from './WakeClouds';
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
  const [stage, setStage] = useState(1);
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
  // The wake-up (V4.1 Part 7.4): none, the dream popping, then gone.
  const [pop, setPopStage] = useState<'none' | 'pop' | 'gone'>('none');
  // The clouds between the dream and the bedroom: null, or rolling in, holding while the room is built, and parting.
  const [clouds, setClouds] = useState<{ state: CloudState; gentle: boolean } | null>(null);
  const ghost = useRef<HTMLInputElement>(null);
  // The results hang in the bedroom: the stage projects the beam's hook and the headboard onto these every frame.
  const boardAnchor = useRef<HTMLDivElement>(null);
  const anchors = useRef<RoomAnchors>({ board: boardAnchor }).current;
  const live = useRef<Live>(freshLive(seed));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;
  // The night has a shape; practice is the endless version ("How far can you run?").
  const length = practice ? null : DREAM_LENGTH;

  /** Starts the night; true when it did. The ref moves at once, so a letter typed in the same key press can land. */
  const begin = useCallback((): boolean => {
    if (phaseRef.current !== 'ready' || !dict) return false;
    if (!practice) markDreamStarted(night);
    live.current = freshLive(seed);
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

  // Once the results are up the bedroom is being built behind the clouds: hold them a moment for its first frames, then
  // part them on it. Any other phase (a fresh run) takes them away.
  const hasClouds = clouds !== null;
  useEffect(() => {
    if (phase !== 'results') {
      if (phase === 'ready' || phase === 'running') setClouds(null);
      return;
    }
    if (!hasClouds) return;
    setClouds((c) => c && { ...c, state: 'hold' });
    const part = setTimeout(() => setClouds((c) => c && { ...c, state: 'out' }), WAKE.reveal);
    const gone = setTimeout(() => setClouds(null), WAKE.reveal + CLOUD_MS.out + 300);
    return () => { clearTimeout(part); clearTimeout(gone); };
    // Only a change of phase starts this; the clouds' own changes must not restart the timers.
  }, [phase]);

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
    let hudKey = '', fenceKey = '', alarmed = false, stageNow = 1, wasAir = false;
    // The fence the sheep is in the air over: its word rises into the sky once it has landed.
    let over: { word: string; index: number } | null = null;
    const hooves = (): [number, number] => { const v = viewRef.current; return [screenX(v, SHEEP_CENTRE) - ART * SHEEP_ART.tail * v.s * 0.55, v.ground - 4]; };
    const signState: string[] = [];

    const events = {
      jump: () => {
        playSound('play'); // the bell at take-off
        const fe = live.current.fences.find((f) => f.jumped && !f.passed);
        over = fe ? { word: fe.word, index: fe.index } : null;
        // Five puffs fan out behind the hooves.
        fx.current?.puffs(...hooves(), 5);
      },
      count: (n: number) => { setCount(n); setReached(live.current.reached); setCounted({ n, key: Math.random() }); },
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
        if (!reduced) setTimeout(() => setClouds({ state: 'in', gentle: true }), DRIFT.clouds);
        setTimeout(finish, reduced ? DRIFT.reducedFinish : DRIFT.finish);
      },
      bump: () => {
        // Bump: the farmer stirs (the stage plays the wake-up; this calls finish when it ends).
        playSound('trap');
        setPhase('crashed');
        setCount(live.current.count);
        show('bump');
        setMark('bang');
        jolt();
        setTimeout(() => { setPopStage('pop'); if (!reduced) setClouds({ state: 'in', gentle: false }); }, reduced ? 0 : WAKE.pop);
        setTimeout(() => setPopStage('gone'), reduced ? 150 : WAKE.dark);
        setTimeout(finish, reduced ? WAKE.reducedFinish : WAKE.finish);
      },
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const ph = phaseRef.current;
      if (ph === 'running' || ph === 'ready' || ph === 'crashed' || ph === 'drifting') { L.t += dt; beat.current.beats = advance(beat.current.beats, dt, stageNow); }
      if (ph === 'running') update(L, dt, seed, events, length);
      // The landing: six puffs, the window drops 3 px for 80 ms, and 100 ms later the word rises into the sky.
      if (wasAir && L.jumpAt === null && L.crashAt === null && ph === 'running') {
        fx.current?.puffs(...hooves(), 6);
        nudge([0, 3, 3, 0].map((y) => ({ transform: `translateY(${y}px)` })), 80);
        const up = over;
        over = null;
        if (up?.word) setTimeout(() => {
          const r = signRect(up.index), st = stageEl.current?.getBoundingClientRect(), v = viewRef.current;
          fx.current?.word(up.word, r && st ? Math.max(8, r.left + r.width / 2 - st.left) : 8, r && st ? r.top + r.height / 2 - st.top : v.ground - 160);
        }, 100);
      }
      wasAir = L.jumpAt !== null;
      // The scenery's frame: the fences (each sign's board is moved to its fence on the way), the sheep, the clocks.
      const v = viewRef.current, k = v.s / S0, running = ph === 'running' && L.speed > 0;
      const scene: SceneState = {
        W: v.w / k, H: v.h / k, lane: v.ground / k, scroll: L.dist * S0, t: L.t, beats: beat.current.beats, u: 1 / k, stage: 1, gate: null, finale: 0, counted: L.count,
        seed, phone: sceneRef.current.phone, low: sceneRef.current.low, reduced, festive: FESTIVE, breath: 0.5 - 0.5 * Math.cos((L.t / 3200) * Math.PI * 2),
        fences: placeSigns(L, v, signsRef.current.hang, signTags, signState, reduced),
        sheep: { x: (SHEEP_CENTRE - v.l0) * S0, lift: L.jumpAt === null ? 0 : drawnLift(L.t - L.jumpAt) * S0, w: ART * SHEEP_ART.length * S0, running },
      };
      fx.current?.frame(scene, running ? L.speed * v.s : 0);
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
      const st = lettersAt(L.reached);
      if (st !== stageNow) { stageNow = st; setStage(st); }
      const fk = L.fences.map((fe) => `${fe.index}:${fe.locked ? fe.word : ''}:${fe === a}:${fe === a && wrong}`).join('|');
      if (fk !== fenceKey) {
        fenceKey = fk;
        setFences(L.fences.map((fe) => ({ index: fe.index, kind: fe.f.kind, letters: fe.f.letters, word: fe.word, locked: fe.locked, hot: fe === a, wrong: fe === a && wrong })));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seed, finish, reduced, length, show, jolt, nudge, signRect, signTags]);

  // The dream changes with the letters: a card says so as the second and third stages begin, and, on a counted night,
  // as the last five fences before he is out cold do.
  useEffect(() => {
    if (phaseRef.current === 'running' && stage > 1) show(stage === 2 ? 'stage2' : 'stage3');
  }, [stage, show]);
  useEffect(() => {
    if (length && phaseRef.current === 'running' && reached === length.fences - 5) show('finale');
  }, [reached, length, show]);

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
  // What a star word must not sit under: the moon.
  const keepOut = useMemo(() => { const k = view.s / S0, m = MOONS[1], r = (m.across / 2) * k * (frame.phone ? 1.6 : 1), cy = frame.phone ? Math.max(m.y * view.ground, 66 + r) : m.y * view.ground; return [{ x: m.x * view.w - r, y: cy - r, w: 2 * r, h: 2 * r }]; }, [view, frame.phone]);
  const rootVars = {
    '--u': `${frame.u}px`, '--dr-beat': `${(60 / bpmOf(deep ? 3 : stage)).toFixed(3)}s`, '--dr-pop-x': px(popAt[0]), '--dr-pop-y': px(popAt[1]),
    '--dr-org-x': px(popAt[0] - frame.view.x), '--dr-org-y': px(popAt[1] - frame.view.y),
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
    <main ref={setRoot} className="dr-root hm rc" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase} data-phone={frame.phone || undefined} data-pop={pop !== 'none' || undefined} data-gone={pop === 'gone' || undefined} onPointerDown={focus} style={{ ...rootVars, ...(fitKeys ? { height: vh! } : {}) }}>
      <BedroomBubble live={live} phase={phase} reduced={reduced} phone={mobile} blankets={blankets} anchors={anchors} depth={deep ? 3 : stage} frame={frame} />
      {playing && (
        <div ref={bubbleEl} className="dr-bubble" style={{ left: frame.bubble.x, top: frame.bubble.y, width: frame.bubble.w, height: frame.bubble.h }}>
          <i className="dr-bubble-shade" style={{ clipPath: shape.outer }} />
          <i className="dr-bubble-rim" style={{ clipPath: shape.outer }} />
          <div className="dr-window" style={{ clipPath: shape.inner }}>
            <div ref={stageEl} className="dr-stage" style={{ inset: RIM }} data-pop={pop !== 'none' || undefined} data-gone={pop === 'gone' || undefined} data-reduced={reduced || undefined}>
              <Fx ref={fx} w={view.w} h={view.h} lane={view.ground} seed={seed} phone={frame.phone} reduced={reduced} keepOut={keepOut} keeps={frame.phone ? STAR_WORDS.phoneKeeps : STAR_WORDS.across * STAR_WORDS.down} k={view.s / S0}>
                <DreamStage live={live} pop={counted} phase={phase} reduced={reduced} phone={mobile} fps={stageFps} />
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
        <div className="dr-burst" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--dx': `${Math.cos(i * 0.31 * 2) * (60 + (i % 5) * 28)}px`, '--dy': `${Math.sin(i * 0.31 * 2) * (50 + (i % 4) * 24)}px`, animationDelay: `${(i % 4) * 30}ms` } as React.CSSProperties} />)}
        </div>
      )}
      {/* Waking or drifting off (Brian, 2026-11-09: "refine it"): clouds close over the dream, the bedroom is built behind
          them, and they part on it (WakeClouds.tsx). */}
      {clouds && !reduced && <WakeClouds state={clouds.state} gentle={clouds.gentle} />}
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
        // The results hang in his bedroom (V6 Part 6.4): a plank on ropes from the beam, the room itself is the backdrop.
        <div className="dr-results" role="dialog" aria-modal="true" aria-label={asleep ? 'The farmer drifted off' : 'The farmer woke up'}>
          <div ref={boardAnchor} className="dr-results-anchor">
            <Board size="panel" hang="ropes" id="dr-results" className="dr-results-board" style={{ animationDelay: reduced ? '0ms' : '500ms' }}>
              <h2 className="dr-results-title">{practice ? 'Practice dream' : asleep ? 'The farmer drifted off' : 'The farmer woke up!'}</h2>
              <div className="dr-results-mid">
                <Slate size="plaque" className="dr-results-count"><b>{count}</b><span className="kit-chalk-hand">sheep</span></Slate>
                {/* Part of the plate, not a sheet pinned to it (Brian, 2026-11-09: "longest word should not be on a pin, it
                    should be on the plate as a section"). */}
                <div className="dr-results-facts">
                  {asleep
                    ? <p>{dreamSummary({ count, longest })}</p>
                    : <>
                        <p>Longest word: {longest > 0 ? `${longest} letters` : 'none yet'}</p>
                        {length ? <p>{`fence ${fenceNow} of ${length.fences}`}</p> : null}
                      </>}
                  {practice ? <p>Practice dreams don’t count toward your streak.</p> : null}
                </div>
              </div>
              {!practice && (
                <div className="dr-results-streak">
                  <Knit stitches={days} />
                  <span>{`${streakNow}-night streak, best ${loadStreak().best}`}</span>
                  <Paper kind="note" className="dr-results-blankets">Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights.</Paper>
                </div>
              )}
              <DreamPayout id={`dream:${seed}`} sheep={count} slept={asleep} bestStreak={practice ? 0 : loadStreak().best} />
              <div className="dr-results-rail">
                <Brass onClick={share} autoFocus>{copied ? 'Copied!' : 'Share'}</Brass>
                <WoodButton onClick={practiceAgain}>Practice</WoodButton>
                <WoodButton onClick={close}>Back to the farm</WoodButton>
              </div>
              {/* The next dream's time is the board's last line, part of the plate itself (Brian, 2026-11-09: "dont make it a
                  paper just extend the rectangle"). */}
              {!practice && <p className="dr-results-next">Tonight's dream returns at {midnightLabel()}.</p>}
            </Board>
          </div>
        </div>
      )}
    </main>
  );
}
