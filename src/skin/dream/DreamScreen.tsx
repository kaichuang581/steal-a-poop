import { useLoadingHold } from '../components/BarnDoors';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { dreamStreakDays, getDreamBest, getDreamStreak, loadStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { check, DREAM_LENGTH, dreamGlyphs, dreamSeed, dreamShareText, dreamSummary, exampleWords, fenceAt, hintWord, matched } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useIsMobile } from '../../ui/hooks';
import { CloseIcon, GustIcon, MoonIcon } from '../components/Icons';
import { Notice } from '../components/Notice';
import { Board, Brass, Knit, Paper, Patch, Peg, Slate, Tally, WoodButton } from '../kit';
import { SheepIcon } from '../components/SheepIcon';
import { localDateKey } from '../hooks/useToday';
import { useMotionLevel } from '../hooks/useAmbient';
import { PAINTED_TITLE } from '../screens/PaintedHome';
import { shareCard } from '../share/card';
import { DevLine } from '../table/DevStats';
import { BedroomBubble } from './BedroomBubble';
import type { RoomAnchors } from './BedroomBubble';
import { DreamStage } from './DreamStage';
import type { FenceView, Phase } from './DreamStage';
import { dreamLink, useDreamUi } from './dreamStore';
import { activeFence, freshLive, MAX_TYPED, TYPE_X, update } from './run';
import type { Live } from './run';
import { DRIFT, PUFFS, WAKE } from './stage';
import './dream.css';

/**
 * Counting Sheep (V4): the farmer's dream. He sleeps in the bottom-left of the frame; in the dream above him his
 * sheep runs along a cloud and jumps fences carrying the night's letters. Each fence names letters in order, and any
 * real word that has them clears it, one more sheep counted. Reach a fence without a word and the sheep bumps it. The
 * night ends with the farmer asleep after the last fence, or awake on the last bump; practice ends on the first bump
 * and has no last fence. The rules live in src/dream/dream.ts and are only played out here; nothing in the scene writes
 * to the run.
 */
const SAYS: Record<string, string> = { short: 'Three letters or more', letters: 'Needs those letters, in order', word: 'Not in the dictionary', used: 'Already counted that one', wait: 'Wait for the next fence' };
interface Hud { letters: string[]; lit: number; typed: string; say: string; wrong: boolean; active: boolean; index: number; hint: string }
/** How long a fence waits before it offers a word, in ms of the run. */
const HINT_AFTER = 3200;

/** The local date as "6 Nov". */
const shortDate = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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

/** The night as saved: what the home screen's ticket and its share read back. */
function recordOf(L: Live, night: string, repaired: boolean) {
  return { date: night, status: 'done' as const, count: L.count, longest: L.longest, repaired: repaired ? true : undefined, reached: L.reached, bumps: L.bumps, asleep: L.asleepAt !== null };
}

/** Waking clouds: x and y (% of the screen, the cloud's centre), width (vmax) and a delay (ms), round the edges inward. */
const CLOUDS: [number, number, number, number][] = [
  [0, 0, 60, 0], [50, -6, 64, 60], [100, 0, 60, 30], [-4, 50, 58, 90], [104, 50, 58, 120], [0, 100, 62, 40], [50, 106, 66, 80], [100, 100, 62, 10],
  [25, 22, 48, 180], [75, 22, 48, 210], [25, 78, 48, 160], [75, 78, 48, 230], [50, 50, 56, 280],
];

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
  const landscapePhone = typeof window !== 'undefined' && window.innerWidth > window.innerHeight && Math.min(window.innerWidth, window.innerHeight) < 500;
  // The night this dream belongs to, fixed when the screen opens: a dream begun before midnight is still that night's.
  const [today] = useState(() => localDateKey(new Date()));
  const night = repair ?? today;
  // `?dreamSeed=1` fixes the practice run for the gate script (V4.1 Part 10); it never touches tonight's dream.
  const [seed, setSeed] = useState(() => {
    const fixed = new URLSearchParams(location.search).get('dreamSeed');
    return practice ? `practice:${fixed ?? Date.now()}` : dreamSeed(night);
  });
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(() => getDreamBest());
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState<Hud>({ letters: [], lit: 0, typed: '', say: '', wrong: false, active: false, index: -1, hint: '' });
  const [fences, setFences] = useState<FenceView[]>([]);
  const [counted, setCounted] = useState<{ n: number; key: number } | null>(null);
  const [bump, setBump] = useState(0);
  const [bumps, setBumps] = useState(0);
  const [reached, setReached] = useState(0);
  const [stirred, setStirred] = useState(0);
  // The wake-up (V4.1 Part 7.4): none, the dream popping, then gone.
  const [pop, setPopStage] = useState<'none' | 'pop' | 'gone'>('none');
  const ghost = useRef<HTMLInputElement>(null);
  // The results hang in the bedroom: the stage projects the beam's hook and the headboard onto these every frame.
  const boardAnchor = useRef<HTMLDivElement>(null);
  const slipAnchor = useRef<HTMLDivElement>(null);
  const anchors = useRef<RoomAnchors>({ board: boardAnchor, slip: slipAnchor }).current;
  const live = useRef<Live>(freshLive(seed));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;
  // The night has a shape; practice is the endless version ("How far can you run?").
  const length = practice ? null : DREAM_LENGTH;

  const begin = useCallback(() => {
    if (phaseRef.current !== 'ready' || !dict) return;
    if (!practice) markDreamStarted(night);
    live.current = freshLive(seed);
    setPhase('running');
    ghost.current?.focus();
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
    if (phaseRef.current === 'ready') { begin(); return; }
    if (phaseRef.current !== 'running') return;
    const L = live.current;
    if (L.typed.length >= MAX_TYPED) return;
    L.typed += ch;
    L.say = '';
    const a = active();
    playTick(a ? matched(a.f, L.typed) / a.f.letters.length : 0.2);
  };
  const backspace = () => { live.current.typed = live.current.typed.slice(0, -1); live.current.say = ''; };
  const submit = () => {
    if (phaseRef.current === 'ready') { begin(); return; }
    if (phaseRef.current !== 'running' || !dict) return;
    const L = live.current;
    if (!L.typed) return;
    const a = active();
    const v = a ? check(dict, a.f, L.typed, L.used) : ({ ok: false, reason: 'wait' } as const);
    if (a && v.ok) {
      const w = L.typed.toLowerCase();
      a.locked = true;
      a.word = w;
      L.used.add(w);
      L.longest = Math.max(L.longest, w.length);
      L.typed = '';
      playSound('bank');
    } else if (!v.ok) {
      L.wrongUntil = L.t + 320;
      L.say = SAYS[v.reason];
      playSound('fail');
    }
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); begin(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submit(); }
  };
  const onInput = (value: string) => {
    for (const ch of value.toLowerCase()) if (ch >= 'a' && ch <= 'z') typeLetter(ch);
    if (ghost.current) ghost.current.value = '';
  };
  const focus = () => ghost.current?.focus();

  // ---------- the loop: the rules run here; the stage reads positions from the live ref every frame ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudKey = '', fenceKey = '', alarmed = false, activeIndex = -1, activeAt = 0;

    const events = {
      jump: () => playSound('play'), // the bell at take-off
      count: (n: number) => { setCount(n); setReached(live.current.reached); setCounted({ n, key: Math.random() }); },
      stumble: (n: number) => {
        // A bump short of the last: the fence goes flat, the farmer stirs, and the run carries on.
        playSound('trap', 0.6);
        setBumps(n);
        setReached(live.current.reached);
        setStirred(Math.random() + 1);
        setTimeout(() => setStirred(0), 1400);
      },
      asleep: () => {
        // The last fence: no pop, the farmer sleeps on and the dream softens.
        playSound('roundEnd', 0.7);
        setReached(live.current.reached);
        setPhase('drifting');
        setTimeout(finish, reduced ? DRIFT.reducedFinish : DRIFT.finish);
      },
      bump: () => {
        // Bump: the farmer stirs (the stage plays the wake-up; this calls finish when it ends).
        playSound('trap');
        setPhase('crashed');
        setCount(live.current.count);
        setBumps(live.current.bumps.length);
        setBump(Math.random() + 1);
        setTimeout(() => setPopStage('pop'), reduced ? 0 : WAKE.pop);
        setTimeout(() => setPopStage('gone'), reduced ? 150 : WAKE.dark);
        setTimeout(finish, reduced ? WAKE.reducedFinish : WAKE.finish);
      },
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const ph = phaseRef.current;
      if (ph === 'running' || ph === 'ready' || ph === 'crashed' || ph === 'drifting') L.t += dt;
      if (ph === 'running') update(L, dt, seed, events, length);
      // The farmer's alarm, low, as the dream pops.
      if (L.crashAt !== null && !alarmed && L.t - L.crashAt >= WAKE.pop) { alarmed = true; playSound('alarm', 0.35); }
      if (L.crashAt === null) alarmed = false;
      // What React shows, refreshed only when it changes.
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const wrong = L.t < L.wrongUntil;
      const lit = a ? matched(a.f, L.typed) : 0;
      if ((a?.index ?? -1) !== activeIndex) { activeIndex = a?.index ?? -1; activeAt = L.t; }
      // Stuck on a fence? After a moment it offers a word that fits.
      const hint = a && !L.typed && L.t - activeAt > HINT_AFTER ? hintWord(a.f, L.used) : '';
      const hk = `${a?.index ?? -1}:${lit}:${L.typed}:${L.say}:${wrong}:${hint}`;
      if (hk !== hudKey) {
        hudKey = hk;
        setHud({ letters: a ? a.f.letters : [], lit, typed: L.typed, say: L.say, wrong, active: !!a, index: a?.index ?? -1, hint });
      }
      const fk = L.fences.map((fe) => `${fe.index}:${fe.locked ? fe.word : ''}:${fe === a}:${fe === a && wrong}`).join('|');
      if (fk !== fenceKey) {
        fenceKey = fk;
        setFences(L.fences.map((fe) => ({ index: fe.index, kind: fe.f.kind, letters: fe.f.letters, word: fe.word, locked: fe.locked, hot: fe === a, wrong: fe === a && wrong })));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seed, finish, reduced, length]);

  // ---------- results ----------
  const streakNow = streak || getDreamStreak(today);
  const blankets = loadStreak().blankets;
  const share = async () => {
    const L = live.current;
    const asleep = L.asleepAt !== null;
    const text = dreamShareText({ date: night, count, longest: L.longest, streak: streakNow, blankets, bumped: !asleep, fences: L.reached, bumps: L.bumps, seed, title: PAINTED_TITLE, url: dreamLink() });
    await shareCard({
      title: `Counting Sheep · ${night}`,
      headline: asleep ? 'The farmer drifted off' : `The farmer counted ${count} sheep`,
      lines: [asleep ? dreamSummary({ fences: L.reached, bumps: L.bumps, longest: L.longest }) : L.longest > 0 ? `Longest word: ${L.longest} letters` : '', streakNow > 1 ? `${streakNow}-night streak` : ''].filter(Boolean),
      count, unit: 'sheep',
      stitches: practice ? undefined : dreamStreakDays(today),
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
    setCount(0); setCounted(null); setBump(0); setStreak(0); setBumps(0); setReached(0); setStirred(0);
    setFences([]);
    setPhase('ready');
    ghost.current?.focus();
  };

  if (!dict) return <main className="dr-root"><Paper kind="slip" pin="top" className="dr-loading">Loading the word list...</Paper></main>;

  const mode = phase === 'results' ? 'out' : hud.active ? 'mine' : 'wait';
  const typedLetters = [...hud.typed];
  // Which typed letters meet the fence's letters, in order: they light up gold.
  const typedHits = (() => { let k = 0; return typedLetters.map((ch) => { const hit = k < hud.letters.length && ch.toLowerCase() === hud.letters[k]; if (hit) k++; return hit; }); })();
  const sign = hud.letters.join('...').toUpperCase();
  const joined = hud.letters.map((l) => l.toUpperCase()).join(', then ');
  const examples = hud.active && hud.index >= 0 && hud.index < 3 ? exampleWords(fenceAt(seed, hud.index)) : [];
  const caption = phase !== 'running' ? null
    : hud.say ? <span style={{ color: '#FFD0C4' }}>{hud.say}</span>
      : hud.active
        ? <>
            {hud.letters.length > 1 ? <>Any word with <b>{joined}</b> somewhere after it.</> : <>Any word with a <b>{sign}</b> in it.</>}
            {examples.length ? <> Like {examples.map((w) => w.toUpperCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}.</> : hud.hint ? <> Try <b>{hud.hint.toUpperCase()}</b>.</> : null}
          </>
        : null;
  const longest = live.current.longest;
  const asleep = phase === 'results' && live.current.asleepAt !== null;
  const bumpsLeft = length ? length.bumps - bumps : 0;
  // The week as knitted stitches; tonight's is ringed once it is played.
  const days = phase === 'results' && !practice ? dreamStreakDays(today).map((st, i) => (i === 6 && st === 'played' ? 'today' as const : st)) : [];
  const fenceNow = length ? Math.min(reached + 1, length.fences) : 0;

  return (
    <main className="dr-root" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase} data-pop={pop !== 'none' || undefined} data-gone={pop === 'gone' || undefined} onPointerDown={focus} style={mobile && vh ? { height: vh } : undefined}>
      <div className="dr-stage" data-pop={pop !== 'none' || undefined} data-gone={pop === 'gone' || undefined} data-reduced={reduced || undefined}>
        <DreamStage live={live} fences={fences} pop={counted} phase={phase} reduced={reduced} phone={mobile} landscapePhone={landscapePhone} />
      </div>
      {PUFFS.map(([x, y, w], i) => (
        <span key={i} className="dream-puff" data-i={i} aria-hidden="true" style={{ left: `${x - w / 2}%`, top: `${y}%`, width: `${w}%` }}>
          <svg viewBox="0 0 150 100"><g fill="#EDE8F9"><ellipse cx="75" cy="55" rx="55" ry="30" /><circle cx="35" cy="48" r="26" /><circle cx="72" cy="32" r="30" /><circle cx="112" cy="46" r="26" /></g></svg>
        </span>
      ))}
      {pop === 'pop' && !reduced && (
        <div className="dr-burst" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--dx': `${Math.cos(i * 0.31 * 2) * (60 + (i % 5) * 28)}px`, '--dy': `${Math.sin(i * 0.31 * 2) * (50 + (i % 4) * 24)}px`, animationDelay: `${(i % 4) * 30}ms` } as React.CSSProperties} />)}
        </div>
      )}
      <BedroomBubble live={live} phase={phase} reduced={reduced} phone={mobile} blankets={blankets} anchors={anchors} />
      {/* Waking (Brian, 2026-11-08: the old pop shrank the scene to a square): the dream blurs and soft clouds roll in from
          every edge, the bedroom comes up behind them, and they part to show it. */}
      {pop !== 'none' && !reduced && (
        <div className="dr-clouds" data-state={phase === 'results' ? 'out' : 'in'} aria-hidden="true">
          <i className="dr-clouds-fill" />
          {CLOUDS.map(([x, y, w, d], i) => (
            <svg key={i} className="dr-cloud" viewBox="0 0 150 100" style={{ left: `${x}%`, top: `${y}%`, width: `${w}vmax`, '--dx': `${(x - 50) * 1.6}vw`, '--dy': `${(y - 50) * 1.6}vh`, animationDelay: `${d}ms` } as React.CSSProperties}>
              <g fill={i % 3 ? '#EDE8F9' : '#DCD4F3'}><ellipse cx="75" cy="58" rx="58" ry="30" /><circle cx="36" cy="50" r="27" /><circle cx="73" cy="32" r="31" /><circle cx="113" cy="47" r="27" /></g>
            </svg>
          ))}
        </div>
      )}
      <DevLine />

      {phase !== 'results' && (
        <header className="dr-hud sk-swoop-in pointer-events-none relative z-30 flex items-start justify-between gap-2 p-2">
          <Patch icon={<MoonIcon size={18} />} className="dr-night-patch">{practice ? 'Practice dream' : repair ? `Last night's dream · ${shortDate(night)}` : `Tonight's dream · ${shortDate(night)}`}</Patch>
          <div className="pointer-events-auto flex items-start gap-2">
            {/* The count in chalk on a slate: sheep counted, the best, and how far into the night with the bumps left. */}
            <Slate size="plaque" className="dr-count" aria-live="polite" aria-label={`${count} sheep counted`}>
              <span className="dr-count-main"><SheepIcon size={20} /><b>{count}</b></span>
              {best > 0 ? <span className="kit-chalk-hand dr-count-sub">best {best}</span> : null}
              {length && (
                <span className="kit-chalk-hand dr-count-sub" aria-label={`Fence ${fenceNow} of ${length.fences}, ${bumpsLeft} bumps left`}>
                  {fenceNow}/{length.fences} <Tally have={bumpsLeft} of={length.bumps} />
                </span>
              )}
            </Slate>
            <Peg onClick={close} aria-label="Leave the dream" title="Leave the dream (Esc)"><CloseIcon size={18} /></Peg>
          </div>
        </header>
      )}

      {/* The board at the top centre: how to play before the run, the bump when it ends. */}
      <div className={`dr-boards pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-3 px-3 ${mobile ? 'top-[9%]' : 'top-[6%]'}`} aria-live="polite">
        {phase === 'ready' && (
          <Notice tone="wood" snow={false} size={mobile ? 'sm' : 'lg'} title={length ? 'Count sheep to keep the farmer asleep' : 'How far can you run?'} sub={<span className="dr-blink">Type a word with the fence’s letters, in order · press any key</span>} />
        )}
        {stirred > 0 && phase === 'running' && <Notice key={stirred} tone="wood" snow={false} size="lg" icon={<GustIcon size={26} />} title="Bump!" sub={`mmf… ${bumpsLeft === 1 ? 'one more wakes him' : `${bumpsLeft} bumps left`}`} />}
        {phase === 'drifting' && <Notice tone="wood" snow={false} size="lg" title="Zzz…" sub="he’s out cold" />}
        {bump > 0 && phase === 'crashed' && <Notice key={bump} tone="wood" snow={false} size="lg" icon={<GustIcon size={26} />} title="Bump!" sub="the farmer stirs…" />}
      </div>

      {phase !== 'results' && (
        <div className={`dr-hud relative z-20 mt-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4 ${mobile ? 'dr-bar-phone' : ''}`}>
          <div className={mobile ? 'mx-auto' : 'mx-auto max-w-3xl'}>
            {caption && <p className="sk-input-prompt" data-mode={mode}>{caption}</p>}
            {/* The word bar: floating letters (chosen from the mockups, 2026-11-07). The fence's letters above with gaps for
                anything between them, lighting up as the word meets them; the word big over the snow; Enter's key below. */}
            <div className="dr-trough kit-float" data-scene="dream" data-mode={mode} data-wrong={hud.wrong || undefined}
              onPointerDown={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') { e.preventDefault(); focus(); } }}>
              <p className="kit-float-need dr-fence-rope" data-wrong={hud.wrong || undefined} aria-label={hud.active ? `Needs ${hud.letters.join(', ')} in order` : 'No fence yet'}>
                {hud.letters.map((ch, i) => (
                  <Fragment key={`${hud.index}:${i}`}>
                    {i > 0 && <span className="kit-float-gap" />}
                    <span className="dr-fence-tile" data-on={i < hud.lit || undefined}>{ch.toUpperCase()}</span>
                  </Fragment>
                ))}
              </p>
              <div className="kit-float-word dr-typed-row" style={{ '--len': Math.max(6, typedLetters.length) } as React.CSSProperties}>
                {typedLetters.length
                  ? typedLetters.map((ch, i) => <span key={i} className="dr-typed" data-hit={typedHits[i] || undefined}>{ch.toUpperCase()}</span>)
                  : <span className="kit-float-ph dr-placeholder">{hud.active ? `a word with ${joined}` : phase === 'ready' ? `a word with ${fenceAt(seed, 0).letters.map((l) => l.toUpperCase()).join(', then ')}` : 'type ahead...'}</span>}
                <span className="sk-type-caret" aria-hidden="true" />
                <input
                  ref={ghost} className="sk-input-ghost" autoFocus aria-label="Your word" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  enterKeyHint="go" onChange={(e) => onInput(e.target.value)} disabled={phase === 'crashed' || phase === 'drifting'}
                  onBlur={() => { if (phaseRef.current === 'running' || phaseRef.current === 'ready') setTimeout(() => ghost.current?.focus(), 0); }}
                />
              </div>
              <span className="kit-float-rule" aria-hidden="true" />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={phase === 'crashed' || phase === 'drifting'} className="kit-float-go dr-jump" aria-label="Jump"><b>Enter</b> to jump</button>
            </div>
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{phase === 'running' ? `${sign}. ${count} sheep.` : ''}</p>

      {phase === 'results' && (
        // The results hang in his bedroom (V6 Part 6.4): a plank on ropes from the beam, the room itself is the backdrop.
        <div className="dr-results" role="dialog" aria-modal="true" aria-label={asleep ? 'The farmer drifted off' : 'The farmer woke up'}>
          <div ref={boardAnchor} className="dr-results-anchor">
            <Board size="panel" hang="ropes" id="dr-results" className="dr-results-board" style={{ animationDelay: reduced ? '0ms' : '500ms' }}>
              <h2 className="dr-results-title">{practice ? 'Practice dream' : asleep ? 'The farmer drifted off' : 'The farmer woke up!'}</h2>
              <div className="dr-results-mid">
                <Slate size="plaque" className="dr-results-count"><b>{count}</b><span className="kit-chalk-hand">sheep</span></Slate>
                <Paper kind="sheet" pin="top" seed={night} className="dr-results-sheet">
                  {asleep
                    ? <p>{dreamSummary({ fences: live.current.reached, bumps: live.current.bumps, longest })}</p>
                    : <>
                        <p>Longest word: {longest > 0 ? `${longest} letters` : 'none yet'}</p>
                        {length ? <p>fence {fenceNow} of {length.fences}</p> : null}
                      </>}
                  {practice ? <p>Practice dreams don’t count toward your streak.</p> : null}
                </Paper>
              </div>
              {!practice && (
                <div className="dr-results-streak">
                  <Knit stitches={days} />
                  <span>{streakNow}-night streak · best {loadStreak().best}</span>
                  <Paper kind="note" seed="blankets" className="dr-results-blankets">Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights.</Paper>
                </div>
              )}
              <div className="dr-results-rail">
                <Brass onClick={share} autoFocus>{copied ? 'Copied!' : 'Share'}</Brass>
                <WoodButton onClick={practiceAgain}>Practice</WoodButton>
                <WoodButton onClick={close}>Back to the farm</WoodButton>
              </div>
            </Board>
          </div>
          {!practice && (
            <div ref={slipAnchor} className="dr-results-slip">
              <Paper kind="slip" pin="top" seed="midnight" tilt>Tonight's dream returns at {midnightLabel()}.</Paper>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
