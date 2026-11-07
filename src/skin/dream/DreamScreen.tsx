import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { dreamStreakDays, getDreamBest, getDreamStreak, loadStreak, markDreamStarted, recordBest, recordDream } from '../../dream/daily';
import { check, dreamSeed, dreamShareText, exampleWords, fenceAt, matched } from '../../dream/dream';
import { useStore } from '../../state/store';
import { useIsMobile } from '../../ui/hooks';
import { BlanketIcon, CloseIcon, FlameIcon, GustIcon } from '../components/Icons';
import { Chip, ClothButton, WoodButton } from '../components/Materials';
import { Notice } from '../components/Notice';
import { SheepIcon } from '../components/SheepIcon';
import { SnowCap } from '../components/SnowCap';
import { localDateKey } from '../hooks/useToday';
import { useMotionLevel } from '../hooks/useAmbient';
import { PAINTED_TITLE } from '../screens/PaintedHome';
import { shareCard } from '../share/card';
import { DevLine } from '../table/DevStats';
import { DreamStage } from './DreamStage';
import type { FenceView, Phase } from './DreamStage';
import { useDreamUi } from './dreamStore';
import { activeFence, freshLive, MAX_TYPED, TYPE_X, update } from './run';
import type { Live } from './run';
import { WAKE } from './stage';
import './dream.css';

/**
 * Counting Sheep (V4): the farmer's dream. He sleeps in the bottom-left of the frame; in the dream above him his
 * sheep runs along a cloud and jumps fences carrying the night's letters. Each fence names letters in order, and any
 * real word that has them clears it, one more sheep counted. Reach a fence without a word and the sheep bumps it:
 * the farmer wakes. The rules live in src/dream/dream.ts and are only played out here; nothing in the scene writes
 * to the run.
 */
const SAYS: Record<string, string> = { short: 'Three letters or more', letters: 'Needs those letters, in order', word: 'Not in the dictionary', used: 'Already counted that one', wait: 'Wait for the next fence' };
interface Hud { letters: string[]; lit: number; typed: string; say: string; wrong: boolean; active: boolean; index: number }

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

export function DreamScreen() {
  const dict = useStore((s) => s.dict);
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
  const [seed, setSeed] = useState(() => (practice ? `practice:${Date.now()}` : dreamSeed(night)));
  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(0);
  const [best, setBest] = useState(() => getDreamBest());
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState<Hud>({ letters: [], lit: 0, typed: '', say: '', wrong: false, active: false, index: -1 });
  const [fences, setFences] = useState<FenceView[]>([]);
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  const [bump, setBump] = useState(0);
  const ghost = useRef<HTMLInputElement>(null);
  const live = useRef<Live>(freshLive(seed));
  const phaseRef = useRef<Phase>('ready');
  phaseRef.current = phase;

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
    const s = recordDream({ date: night, status: 'done', count: L.count, longest: L.longest, repaired: repair ? true : undefined });
    return s;
  }, [practice, night, repair]);

  const finish = useCallback(() => {
    const L = live.current;
    setPhase('results');
    if (practice) setBest(recordBest(L.count));
    else { setStreak(record()); setBest(getDreamBest()); }
  }, [practice, record]);

  // Leaving mid-dream still uses up the night's attempt, with what was counted so far.
  useEffect(() => () => {
    if (phaseRef.current === 'running' && !practice) recordDream({ date: night, status: 'done', count: live.current.count, longest: live.current.longest, repaired: repair ? true : undefined });
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
    let hudKey = '', fenceKey = '', alarmed = false;

    const events = {
      jump: () => playSound('play'), // the bell at take-off
      count: (n: number) => { setCount(n); setPop({ n, key: Math.random() }); },
      bump: () => {
        // Bump: the farmer stirs (the stage plays the wake-up; this calls finish when it ends).
        playSound('trap');
        setPhase('crashed');
        setCount(live.current.count);
        setBump(Math.random() + 1);
        setTimeout(finish, reduced ? WAKE.reducedFinish : WAKE.finish);
      },
    };

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const L = live.current;
      const ph = phaseRef.current;
      if (ph === 'running' || ph === 'ready' || ph === 'crashed') L.t += dt;
      if (ph === 'running') update(L, dt, seed, events);
      // The farmer's alarm, low, as the dream pops.
      if (L.crashAt !== null && !alarmed && L.t - L.crashAt >= WAKE.pop) { alarmed = true; playSound('alarm', 0.35); }
      if (L.crashAt === null) alarmed = false;
      // What React shows, refreshed only when it changes.
      const a = L.fences.find((x) => !x.locked && !x.passed && x.x < TYPE_X);
      const wrong = L.t < L.wrongUntil;
      const lit = a ? matched(a.f, L.typed) : 0;
      const hk = `${a?.index ?? -1}:${lit}:${L.typed}:${L.say}:${wrong}`;
      if (hk !== hudKey) {
        hudKey = hk;
        setHud({ letters: a ? a.f.letters : [], lit, typed: L.typed, say: L.say, wrong, active: !!a, index: a?.index ?? -1 });
      }
      const fk = L.fences.map((fe) => `${fe.index}:${fe.locked ? fe.word : ''}:${fe === a}:${fe === a && wrong}`).join('|');
      if (fk !== fenceKey) {
        fenceKey = fk;
        setFences(L.fences.map((fe) => ({ index: fe.index, letters: fe.f.letters, word: fe.word, locked: fe.locked, hot: fe === a, wrong: fe === a && wrong })));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seed, finish, reduced]);

  // ---------- results ----------
  const streakNow = streak || getDreamStreak(today);
  const blankets = loadStreak().blankets;
  const share = async () => {
    const text = dreamShareText({ date: night, count, longest: live.current.longest, streak: streakNow, blankets, bumped: true, title: PAINTED_TITLE });
    await shareCard({
      title: `Counting Sheep · ${night}`,
      headline: `The farmer counted ${count} sheep`,
      lines: [live.current.longest > 0 ? `Longest word: ${live.current.longest} letters` : '', streakNow > 1 ? `${streakNow}-night streak` : ''].filter(Boolean),
    }, text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const practiceAgain = () => {
    const s = `practice:${Date.now()}`;
    openDream(true);
    setSeed(s);
    live.current = freshLive(s);
    setCount(0); setPop(null); setBump(0); setStreak(0);
    setFences([]);
    setPhase('ready');
    ghost.current?.focus();
  };

  if (!dict) return <main className="dr-root"><p className="sk-paper sk-display px-4 py-2 text-lg">Loading the word list…</p></main>;

  const mode = phase === 'results' ? 'out' : hud.active ? 'mine' : 'wait';
  const typedLetters = [...hud.typed];
  const size = typedLetters.length <= 9 ? 'lg' : typedLetters.length <= 13 ? 'md' : 'sm';
  const sign = hud.letters.join('·').toUpperCase();
  const joined = hud.letters.map((l) => l.toUpperCase()).join(' then ');
  const examples = hud.active && hud.index >= 0 && hud.index < 3 ? exampleWords(fenceAt(seed, hud.index)) : [];
  const caption = phase !== 'running' ? null
    : hud.say ? <span style={{ color: '#FFD0C4' }}>{hud.say}</span>
      : hud.active
        ? <>Next fence: <b>{sign}</b>. Any word with those letters, in that order.{examples.length ? <> Like {examples.map((w) => w.toUpperCase()).join(', ').replace(/, ([^,]*)$/, ' or $1')}.</> : null}</>
        : null;
  const longest = live.current.longest;
  const days = phase === 'results' && !practice ? dreamStreakDays(today) : [];
  const dayInitials = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toLocaleDateString(undefined, { weekday: 'narrow' }); });

  return (
    <main className="dr-root" onKeyDown={onKey} aria-label="Counting Sheep" data-phase={phase} onPointerDown={focus} style={mobile && vh ? { height: vh } : undefined}>
      <div className="absolute inset-0"><DreamStage live={live} fences={fences} pop={pop} phase={phase} reduced={reduced} phone={mobile} landscapePhone={landscapePhone} /></div>
      <DevLine />

      <header className={`sk-swoop-in pointer-events-none relative z-30 flex items-start gap-2 p-2 ${mobile ? 'flex-row justify-between' : 'justify-between'}`}>
        <span className="sk-chip sk-display">{practice ? 'Practice dream' : repair ? `Last night's dream · ${shortDate(night)}` : `Tonight's dream · ${shortDate(night)}`}</span>
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <span className="sk-chip sk-num flex items-center gap-1.5" aria-live="polite" aria-label={`${count} sheep counted`}>
            <SheepIcon size={18} /><b className="sk-display text-lg">{count}</b>{best > 0 ? <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>best {best}</span> : null}
          </span>
          <Chip className="sk-icon-chip" onClick={close} aria-label="Leave the dream" title="Leave the dream (Esc)"><CloseIcon size={16} /></Chip>
        </div>
      </header>

      {/* The board at the top centre: how to play before the run, the bump when it ends. */}
      <div className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-3 px-3 ${mobile ? 'top-[14%]' : 'top-[12%]'}`} aria-live="polite">
        {phase === 'ready' && (
          <Notice tone="wood" size="lg" title="Count sheep to keep the farmer asleep" sub={<span className="dr-blink">Type a word with the fence’s letters, in order · press any key</span>} />
        )}
        {bump > 0 && phase === 'crashed' && <Notice key={bump} tone="cold" size="lg" icon={<GustIcon size={26} />} title="Bump!" sub="the farmer stirs…" />}
      </div>

      {phase !== 'results' && (
        <div className={`relative z-20 mt-auto px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:px-4 ${mobile ? 'dr-bar-phone' : ''}`}>
          <div className={mobile ? 'mx-auto' : 'ml-[30%] mr-[6%]'}>
            {caption && <p className="sk-input-prompt" data-mode={mode}>{caption}</p>}
            <div className="sk-input-bar" data-mode={mode} onPointerDown={(e) => { e.preventDefault(); focus(); }}>
              {/* The fence's letters as wooden tiles, each lighting up with a check once it is typed in order. */}
              <div className="dr-fence-tiles" data-wrong={hud.wrong || undefined} aria-label={hud.active ? `Needs ${hud.letters.join(', ')} in order` : 'No fence yet'}>
                {hud.letters.length
                  ? hud.letters.map((ch, i) => <span key={i} className="sk-type-tile dr-fence-tile" data-lit={i < hud.lit || undefined}>{ch.toUpperCase()}</span>)
                  : <span className="sk-hand dr-fence-none">· · ·</span>}
              </div>
              <div className="sk-input-tiles" data-size={size}>
                {typedLetters.length
                  ? typedLetters.map((ch, i) => <span key={i} className="sk-type-tile">{ch.toUpperCase()}</span>)
                  : <span className="sk-input-placeholder">{hud.active ? `a word with ${joined}` : phase === 'ready' ? `a word with ${fenceAt(seed, 0).letters.map((l) => l.toUpperCase()).join(' then ')}` : 'type ahead…'}</span>}
                <span className="sk-type-caret" aria-hidden="true" />
                <input
                  ref={ghost} className="sk-input-ghost" autoFocus aria-label="Your word" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  enterKeyHint="go" onChange={(e) => onInput(e.target.value)} disabled={phase === 'crashed'}
                  onBlur={() => { if (phaseRef.current === 'running' || phaseRef.current === 'ready') setTimeout(() => ghost.current?.focus(), 0); }}
                />
              </div>
              <WoodButton onMouseDown={(e) => e.preventDefault()} onClick={submit} disabled={phase === 'crashed'} className="sk-input-go">Jump</WoodButton>
            </div>
            {!mobile && <p className="sk-hand mt-1 text-center text-sm" style={{ color: 'var(--paper)', textShadow: '0 1px 2px rgba(30, 18, 8, 0.7)' }}>Each fence names letters: type any real word with them in that order and press Enter. Esc wakes up.</p>}
          </div>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{phase === 'running' ? `${sign}. ${count} sheep.` : ''}</p>

      {phase === 'results' && (
        <>
          <div className="sk-results-backdrop" aria-hidden="true" />
          <div className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
            <div className="sk-pop sk-tally relative w-full p-4 pt-5" style={{ maxWidth: 390 }} role="dialog" aria-modal="true" aria-label="The farmer woke up">
              <SnowCap className="sk-tally-snow" />
              <span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" /><span className="sk-nail sk-nail-bl" /><span className="sk-nail sk-nail-br" />
              <h2 className="sk-tally-title">The farmer woke up!</h2>
              <p className="sk-display mt-1 text-center" style={{ fontSize: 44, fontWeight: 800, color: 'var(--button-text)', lineHeight: 1.1 }}>{count} sheep</p>
              <p className="sk-hand text-center text-base" style={{ color: 'var(--glow)' }}>Longest word: {longest > 0 ? `${longest} letters` : '–'}</p>
              {practice ? (
                <p className="sk-hand mt-2 text-center text-lg" style={{ color: 'var(--glow)' }}>Practice dreams don’t count.</p>
              ) : (
                <>
                  <p className="sk-hand mt-2 flex items-center justify-center gap-2 text-lg" style={{ color: 'var(--glow)' }}>
                    <FlameIcon size={16} /> {streakNow}-night streak <span className="text-sm" style={{ color: 'var(--paper)' }}>best {loadStreak().best}</span>
                  </p>
                  <div className="dr-nights mt-2" aria-label="The last seven nights">
                    {days.map((st, i) => (
                      <span key={i} className="dr-night" data-status={st} data-today={i === 6 || undefined} title={st}>{st === 'blanket' ? <BlanketIcon size={14} /> : dayInitials[i]}</span>
                    ))}
                  </div>
                  <p className="sk-hand mt-2 text-center text-sm" style={{ color: 'var(--glow)' }}>
                    <span className="dr-blankets mr-1"><BlanketIcon size={16} held={blankets >= 1} /><BlanketIcon size={16} held={blankets >= 2} /></span>
                    Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights.
                  </p>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <WoodButton onClick={share} className="flex-1" autoFocus>{copied ? 'Copied!' : 'Share'}</WoodButton>
                <ClothButton onClick={practiceAgain} className="flex-1">Practice</ClothButton>
                <WoodButton onClick={close} className="basis-full">Back to the farm</WoodButton>
              </div>
              <p className="sk-hand mt-2 text-center" style={{ color: 'var(--glow)' }}>{practice ? 'Practice dreams don’t count toward your streak.' : `Tonight's dream returns at ${midnightLabel()}.`}</p>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
