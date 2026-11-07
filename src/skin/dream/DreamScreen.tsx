import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { getDreamBest, getDreamStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { check, dreamSeed, dreamShareText, fenceAt, FIELD, JUMP_MS, jumpHeight, matched, signOf, speedAt, takeoffDistance } from '../../dream/dream';
import type { Fence } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useIsMobile } from '../../ui/hooks';
import { CloseIcon, GustIcon } from '../components/Icons';
import { Chip, ClothButton, WoodButton } from '../components/Materials';
import { Notice } from '../components/Notice';
import { SnowCap } from '../components/SnowCap';
import { localDateKey } from '../hooks/useToday';
import { useMotionLevel } from '../hooks/useAmbient';
import { shareCard } from '../share/card';
import type { SheepState } from '../table/Sheep';
import { DreamStage } from './DreamStage';
import type { FenceView, StageLive } from './DreamStage';
import { useDreamUi } from './dreamStore';
import './dream.css';

/**
 * Counting Sheep: the farmer's dream, played out on the winter farm itself. Your sheep gallops along the lane in
 * front of the barn while the farm rolls by; each fence ahead names letters in order, and any real word that has them
 * clears it, one more sheep counted. Reach a fence without a word and the sheep bumps it: the farmer wakes. One life,
 * faster and harder the longer it goes. The rules live in src/dream/dream.ts; this screen only plays them.
 */
const W = 320;
const { sheepX: SX, sheepW: SW, fenceW: FW, fenceH: FH } = FIELD;
const SPAWN_X = W + 24;
/** A fence takes a word only once it is about to come into view, so nobody can bank fences far ahead. */
const TYPE_X = W + 70;
const MAX_TYPED = 16;
const SAYS: Record<string, string> = { short: 'Three letters or more', letters: 'Needs those letters, in order', word: 'Not in the dictionary', used: 'Already counted that one', wait: 'Wait for the next fence' };

type Phase = 'ready' | 'running' | 'crashed' | 'results';
interface Live extends StageLive {
  fences: { f: Fence; index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; word: string }[];
  next: number;
  typed: string;
  wrongUntil: number;
  say: string;
  count: number;
  longest: number;
  used: Set<string>;
  speed: number;
}
interface Hud { letters: string[]; lit: number; typed: string; say: string; wrong: boolean; active: boolean }

function freshLive(seed: string): Live {
  const first = fenceAt(seed, 0);
  return {
    fences: [{ f: first, index: 0, x: SX + SW + 150, locked: false, passed: false, jumped: false, word: '' }],
    next: 1, typed: '', wrongUntil: 0, say: '', count: 0, longest: 0, used: new Set(), speed: speedAt(0), dist: 0, jumpAt: null, t: 0, crashAt: null,
  };
}

export function DreamScreen() {
  const dict = useStore((s) => s.dict);
  const practice = useDreamUi((s) => s.practice);
  const close = useDreamUi((s) => s.close);
  const openDream = useDreamUi((s) => s.openDream);
  const reduced = useMotionLevel() === 'reduced';
  const mobile = useIsMobile();
  // The night this dream belongs to, fixed when the screen opens: a dream begun before midnight is still that night's.
  const [today] = useState(() => localDateKey(new Date()));
  const [seed, setSeed] = useState(() => (practice ? `practice:${Date.now()}` : dreamSeed(today)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(() => getDreamBest());
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState<Hud>({ letters: [], lit: 0, typed: '', say: '', wrong: false, active: false });
  const [fences, setFences] = useState<FenceView[]>([]);
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  const [air, setAir] = useState(false);
  const [bump, setBump] = useState(0);
  const ghost = useRef<HTMLInputElement>(null);
  const live = useRef<Live>(freshLive(seed));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

  const begin = useCallback(() => {
    if (phaseRef.current !== 'ready' || !dict) return;
    if (!practice) markDreamStarted(today);
    live.current = freshLive(seed);
    setPhase('running');
    ghost.current?.focus();
  }, [dict, practice, seed, today]);

  const finish = useCallback(() => {
    const L = live.current;
    setPhase('results');
    if (practice) setBest(recordBest(L.count));
    else {
      setStreak(recordDream({ date: today, status: 'done', count: L.count, longest: L.longest }));
      setBest(getDreamBest());
    }
  }, [practice, today]);

  // Leaving mid-dream still uses up the night's attempt, with what was counted so far.
  useEffect(() => () => {
    if (phaseRef.current === 'running' && !practice) recordDream({ date: today, status: 'done', count: live.current.count, longest: live.current.longest });
  }, [practice, today]);

  // ---------- typing ----------
  const active = () => {
    const a = live.current.fences.find((x) => !x.locked && !x.passed);
    return a && a.x < TYPE_X ? a : null;
  };
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
    let hudKey = '', fenceKey = '', airWas = false;

    const update = (L: Live, dt: number) => {
      const target = speedAt(L.count);
      L.speed += (target - L.speed) * Math.min(1, dt / 600);
      const dx = (L.speed * dt) / 1000;
      L.dist += dx;
      for (const fe of L.fences) fe.x -= dx;
      // Keep fences queued ahead: each one its gap in seconds behind the last, at the speed it will be met.
      while (L.fences.length < 4) {
        const prev = L.fences[L.fences.length - 1];
        const f = fenceAt(seed, L.next++);
        L.fences.push({ f, index: f.index, x: Math.max(SPAWN_X, prev.x + f.gap * speedAt(f.index)), locked: false, passed: false, jumped: false, word: '' });
      }
      // Jump the next finished fence when it reaches the take-off point (or at once if it was finished late).
      const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
      if (ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed)) {
        ahead.jumped = true;
        L.jumpAt = L.t;
      }
      const airNow = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt);
      if (L.jumpAt !== null && L.t - L.jumpAt >= JUMP_MS) L.jumpAt = null;
      for (const fe of L.fences) {
        if (fe.passed) continue;
        const overlaps = fe.x < SX + SW - 3 && fe.x + FW > SX + 3;
        if (overlaps && airNow < FH - 6) {
          // Bump: the farmer stirs.
          L.crashAt = L.t;
          L.jumpAt = null;
          playSound('trap');
          setPhase('crashed');
          setCount(L.count);
          setBump(Math.random() + 1);
          setTimeout(finish, reduced ? 600 : 1500);
          return;
        }
        if (fe.x + FW < SX) {
          fe.passed = true;
          L.count++;
          setCount(L.count);
          setPop({ n: L.count, key: Math.random() });
        }
      }
      L.fences = L.fences.filter((fe) => fe.x > -60);
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const ph = phaseRef.current;
      if (ph === 'running' || ph === 'ready' || ph === 'crashed') L.t += dt;
      if (ph === 'running') update(L, dt);
      // What React shows, refreshed only when it changes.
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const wrong = L.t < L.wrongUntil;
      const lit = a ? matched(a.f, L.typed) : 0;
      const hk = `${a?.index ?? -1}:${lit}:${L.typed}:${L.say}:${wrong}`;
      if (hk !== hudKey) {
        hudKey = hk;
        setHud({ letters: a ? a.f.letters : [], lit, typed: L.typed, say: L.say, wrong, active: !!a });
      }
      const fk = L.fences.map((fe) => `${fe.index}:${fe.locked ? fe.word : ''}:${fe === a}:${fe === a && wrong}`).join('|');
      if (fk !== fenceKey) {
        fenceKey = fk;
        setFences(L.fences.map((fe) => ({ index: fe.index, label: fe.locked ? fe.word.toUpperCase() : signOf(fe.f), locked: fe.locked, hot: fe === a, wrong: fe === a && wrong })));
      }
      const airIs = L.jumpAt !== null;
      if (airIs !== airWas) { airWas = airIs; setAir(airIs); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seed, finish, reduced]);

  const share = async () => {
    const text = dreamShareText({ date: today, count, longest: live.current.longest, streak: streak || getDreamStreak(today) });
    await shareCard({
      title: `Counting Sheep · ${today}`,
      headline: `The farmer counted ${count} sheep`,
      lines: [live.current.longest > 0 ? `Longest word: ${live.current.longest} letters` : '', (streak || getDreamStreak(today)) > 1 ? `${streak || getDreamStreak(today)}-night streak` : ''].filter(Boolean),
    }, text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const again = () => {
    const s = `practice:${Date.now()}`;
    openDream(true);
    setSeed(s);
    live.current = freshLive(s);
    setCount(0);
    setPop(null);
    setPhase('ready');
    ghost.current?.focus();
  };

  if (!dict) return <main className="dr-root"><p className="sk-paper sk-display px-4 py-2 text-lg">Loading the word list…</p></main>;

  const sheepState: SheepState = phase === 'crashed' ? 'startled' : phase === 'results' ? 'cold' : phase === 'running' ? (air ? 'leaping' : 'running') : 'idle';
  const mode = phase === 'results' ? 'out' : hud.active ? 'mine' : 'wait';
  const typedLetters = [...hud.typed];
  const size = typedLetters.length <= 9 ? 'lg' : typedLetters.length <= 13 ? 'md' : 'sm';
  const sign = hud.letters.join('·').toUpperCase();
  const prompt = phase === 'ready'
    ? <>Each fence names letters. Type any real word with them <b>in that order</b> and press Enter: the sheep clears it</>
    : hud.say ? <span style={{ color: '#FFD0C4' }}>{hud.say}</span>
      : hud.active ? <>Next fence: <b>{sign}</b>. Any word with those letters in order, like {example(hud.letters)}</>
        : <>Keep running… the next fence is on its way</>;

  return (
    <main className="dr-root sk-swoop-in" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase} onPointerDown={focus}>
      <div className="absolute inset-0"><DreamStage live={live} fences={fences} pop={pop} sheepState={sheepState} reduced={reduced} phone={mobile} /></div>
      {/* The dream's haze: the game's warm vignette, cooled to moonlight at the edges. */}
      <div className="dr-edge" aria-hidden="true" />

      <header className="pointer-events-none relative z-30 flex items-start justify-between gap-2 p-2">
        <div className="flex flex-col items-start gap-1">
          <span className="sk-chip sk-display">Counting Sheep{practice ? ' · practice' : ' · tonight'}</span>
          <span className="sk-chip sk-num" aria-live="polite"><b className="sk-display text-lg">{count}</b>&nbsp;sheep counted{best > 0 ? <span style={{ color: 'var(--ink-soft)' }}>&nbsp;· best {best}</span> : null}</span>
        </div>
        <div className="pointer-events-auto flex gap-1">
          <Chip className="sk-icon-chip" onClick={close} aria-label="Leave the dream" title="Leave the dream (Esc)"><CloseIcon size={16} /></Chip>
        </div>
      </header>

      {/* The boards over the field: how to play before the run, the bump when it ends. */}
      <div className="pointer-events-none absolute inset-x-0 top-[18%] z-20 flex flex-col items-center gap-3 px-3" aria-live="polite">
        {phase === 'ready' && (
          <>
            <Notice tone="wood" size="lg" title="Count sheep to fall asleep" sub="type a word with each fence’s letters, in order · press any key to start" />
            <p className="sk-hand text-lg" style={{ color: 'var(--glow)', textShadow: '0 1px 2px rgba(30, 18, 8, 0.85)' }}>the farmer is dozing off… keep him dreaming</p>
          </>
        )}
        {bump > 0 && phase === 'crashed' && <Notice key={bump} tone="cold" size="lg" icon={<GustIcon size={26} />} title="Bump!" sub="the farmer stirs…" />}
      </div>

      {phase !== 'results' && (
        <div className="relative z-20 mt-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4">
          <div className="mx-auto max-w-3xl">
            <p className="sk-input-prompt" data-mode={mode}>{prompt}</p>
            <div className="sk-input-bar" data-mode={mode} onPointerDown={(e) => { e.preventDefault(); focus(); }}>
              {/* The fence's letters as wooden tiles, each lighting up once it is typed in order. */}
              <div className="dr-fence-tiles" data-wrong={hud.wrong || undefined} aria-label={hud.active ? `Needs ${hud.letters.join(', ')} in order` : 'No fence yet'}>
                {hud.letters.length
                  ? hud.letters.map((ch, i) => <span key={i} className="sk-type-tile dr-fence-tile" data-lit={i < hud.lit || undefined}>{ch.toUpperCase()}</span>)
                  : <span className="sk-hand dr-fence-none">· · ·</span>}
              </div>
              <div className="sk-input-tiles" data-size={size}>
                {typedLetters.length
                  ? typedLetters.map((ch, i) => <span key={i} className="sk-type-tile">{ch.toUpperCase()}</span>)
                  : <span className="sk-input-placeholder">{phase === 'ready' ? 'press any key' : hud.active ? `a word with ${sign}` : 'type ahead…'}</span>}
                <span className="sk-type-caret" aria-hidden="true" />
                <input
                  ref={ghost} className="sk-input-ghost" autoFocus aria-label="Your word" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  enterKeyHint="go" onChange={(e) => onInput(e.target.value)}
                  onBlur={() => { if (phaseRef.current === 'running' || phaseRef.current === 'ready') setTimeout(() => ghost.current?.focus(), 0); }}
                />
              </div>
              <WoodButton onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={phase === 'crashed'} className="sk-input-go">{phase === 'ready' ? 'Dream' : 'Jump'}</WoodButton>
            </div>
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{phase === 'running' ? `${sign}. ${count} sheep.` : ''}</p>

      {phase === 'results' && (
        <>
          <div className="sk-results-backdrop" aria-hidden="true" />
          <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
            <div className="sk-pop sk-tally relative w-full max-w-md p-4 pt-5" role="dialog" aria-modal="true" aria-label="The farmer woke up">
              <SnowCap className="sk-tally-snow" />
              <span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" /><span className="sk-nail sk-nail-bl" /><span className="sk-nail sk-nail-br" />
              <h2 className="sk-tally-title">The farmer woke up!</h2>
              <p className="sk-hand mt-2 text-center text-lg" style={{ color: 'var(--glow)' }}>
                He counted <b className="sk-display text-3xl" style={{ color: 'var(--button-text)' }}>{count}</b> sheep before the bump
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-1.5 text-sm">
                {[['Best', best], ['Longest word', live.current.longest || '–'], practice ? ['Mode', 'practice'] : ['Streak', `${streak} night${streak === 1 ? '' : 's'}`]].map(([key, v]) => (
                  <div key={key as string} className="sk-paper px-2 py-1 text-center">
                    <dt className="sk-hand" style={{ color: 'var(--ink-soft)' }}>{key}</dt>
                    <dd className="sk-display text-xl font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <ClothButton onClick={again} className="basis-full" autoFocus>Dream again</ClothButton>
                {!practice && <WoodButton onClick={share} className="flex-1">{copied ? 'Copied!' : 'Share'}</WoodButton>}
                <WoodButton onClick={close} className="flex-1">Back to the farm</WoodButton>
              </div>
              <p className="sk-hand mt-2 text-center" style={{ color: 'var(--glow)' }}>{practice ? 'Practice dreams don’t count toward your streak.' : 'A new dream every night at midnight. Practice as much as you like.'}</p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/** A word that fits the fence, shown as a hint: the fence is cut from one, so there is always one. */
function example(letters: string[]): string {
  const hint = [...letters];
  return hint.length ? `${hint.join('…').toUpperCase()}…` : '';
}
