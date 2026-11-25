import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { MIN_TURN_MS, PRACTICE_WORDS_PER_STEP, practiceTurnMs } from '../../../engine';
import { getPracticeBest, practiceRating } from '../../../lib/practice';
import { rejectMessage } from '../../../lib/messages';
import { playSound } from '../../../audio/sound';
import { useStore } from '../../../state/store';
import type { useWordInput } from '../../hooks/useWordInput';
import { Slab } from '../../kit/modern';
import { pixelRects } from '../../components/pixels';
import { useWallet } from '../../shop/store';
import { useAvatar } from '../../avatars/store';
import type { SheepState } from '../../table/Sheep';
import { PIXEL_ART, TIMINGS } from '../models.gen';
import { artColour } from './board';
import type { BoardState, RunBoard } from './board';
import { RinkTable } from './RinkTable';
import type { Pin, RinkCamState } from './RinkTable';
import './rink.css';

/**
 * A practice run, as docs/trading-post-practice P1 to P4 draw it: the rink scene (RinkTable) and everything read off
 * it. The count, the letter and the clock are chalk and cards on the board; your word is tiles on the rack; every
 * message is the coach speaking; the end is the coach's report in chalk. No rule is read anywhere but the engine.
 */
type Mood = { state: SheepState; key: number };
const LEVEL_WORD = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
const STEP = PRACTICE_WORDS_PER_STEP;
const T = TIMINGS.practice;
/** "Every 5 words, a second comes off." is said once a page session. */
let toldStep = false;

export function PracticeRink({ input, states, boomKey, reduced, phone, dreamWaiting, fps }: {
  input: ReturnType<typeof useWordInput>;
  states: [Mood, Mood];
  boomKey: number | undefined;
  reduced: boolean;
  phone: boolean;
  dreamWaiting: boolean;
  fps?: number;
}) {
  const game = useStore((s) => s.game)!;
  const run = useStore((s) => s.practiceResult);
  const rematch = useStore((s) => s.rematch);
  const quit = useStore((s) => s.quit);
  const avatar = useAvatar();
  const { bomb, blast } = useWallet().equipped;
  const start = game.settings.practiceClock ?? 15;
  const bot = game.settings.botDifficulty as 'easy' | 'medium' | 'hard';
  const best = useMemo(() => getPracticeBest(start, bot), [game.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = game.players[0].wordsPlayed;
  const clockMs = practiceTurnMs(start, count);
  const fastest = clockMs <= MIN_TURN_MS;
  const L = (game.chainLetter ?? '').toLowerCase();
  const over = game.phase === 'gameOver';
  const playing = game.phase === 'playing' && !!game.turn;
  const holder = playing ? game.turn!.seat : null;

  // ---- The coach: one bubble at a time, 2.4 s, a new one replaces the old.
  const [said, setSaid] = useState<{ title: string; line?: string; key: number } | null>(null);
  const coach = useRef({ blowAt: -1e9, blows: 1, lookAt: -1e9, lean: false });
  const say = (title: string, line?: string, blow = 0) => {
    setSaid({ title, line, key: performance.now() });
    if (blow) { coach.current.blowAt = performance.now(); coach.current.blows = blow; playSound('whistle'); }
  };
  useEffect(() => {
    if (!said) return;
    const id = setTimeout(() => setSaid(null), T.wrong_word.coach_bubble_ms);
    return () => clearTimeout(id);
  }, [said]);
  // The run starts: the whistle, and the best to beat.
  const started = useRef(false);
  useEffect(() => {
    if (!playing || started.current) return;
    started.current = true;
    say(best > 0 ? `Best ${best}. Beat it!` : 'First run. Go!', undefined, 1);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  // A word sent back: the tiles shake and the coach says why.
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => {
    const r = input.reject;
    if (!r) return;
    setShakeKey(r.key);
    playSound('fail');
    const word = r.word.toLowerCase(), Lu = L.toUpperCase();
    if (r.reason === 'already_used') {
      const by = game.history.find((h) => h.kind === 'play' && h.word === word);
      say('Already played!', `${by && by.seat !== 0 ? game.players[by.seat].name : 'You'} played ${word} this run. Another ${Lu} word.`);
    } else if (r.reason === 'not_in_dictionary') say('Not a word!', `${word} is not in our list.`);
    else if (r.reason === 'wrong_start') say(`Needs ${Lu}!`, rejectMessage(r.reason, L));
    else if (r.reason === 'too_short') say('Too short!', rejectMessage(r.reason, L));
    else if (r.reason === 'format') say('Letters only!', rejectMessage(r.reason, L));
    else say('Not that one!', rejectMessage(r.reason, L));
  }, [input.reject?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Every speed-up: the whistle, the coach turns to the clock card, and says the new length.
  const lastClock = useRef(clockMs);
  useEffect(() => {
    if (clockMs < lastClock.current) {
      coach.current.lookAt = performance.now();
      say(`Faster! ${clockMs / 1000} s a turn`, toldStep ? undefined : `Every ${STEP} words, a second comes off.`, 1);
      toldStep = true;
    }
    lastClock.current = clockMs;
  }, [clockMs]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your count passes your best.
  const toldBest = useRef(false);
  useEffect(() => {
    if (best > 0 && count > best && !toldBest.current && !over) { toldBest.current = true; say('New best!'); }
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- The board: a new object whenever a value changes; the scene redraws it then (and while it moves).
  const board = useRef<BoardState>(null!);
  const prev = useRef<RunBoard | null>(null);
  // The countdown (P2 section 1): today's start has a 1.2 s intro and no countdown, so the card flips 3, 2, 1 across it.
  const [intro, setIntro] = useState<string | null>(null);
  useEffect(() => {
    if (game.phase !== 'intro' || reduced) { setIntro(null); return; }
    const step = 1200 / 3;
    setIntro('3');
    const ids = [setTimeout(() => setIntro('2'), step), setTimeout(() => setIntro('1'), step * 2)];
    return () => ids.forEach(clearTimeout);
  }, [game.phase, reduced]);
  const now = performance.now();
  const card = over ? 'OUT' : intro ?? L.toUpperCase();
  if (!over || !board.current || board.current.kind === 'run') {
    const p = prev.current;
    const marks = fastest ? -1 : count % STEP;
    const nb: RunBoard = {
      kind: 'run', count, marks, next: fastest ? 'fastest' : `−1 s at ${STEP}`, best: Math.max(best, count), letter: card, clock: clockMs / 1000, phone,
      countAt: p && p.count !== count ? now : p?.countAt ?? -1e9,
      markAt: p && p.count !== count ? now : p?.markAt ?? -1e9,
      wipeAt: p && p.marks > 0 && marks === 0 ? now : p?.wipeAt ?? -1e9,
      letterAt: p && p.letter !== card ? now : p?.letterAt ?? -1e9,
      clockAt: p && p.clock !== clockMs / 1000 ? now : p?.clockAt ?? -1e9,
      prevLetter: p && p.letter !== card ? p.letter : p?.prevLetter ?? '',
      prevClock: p && p.clock !== clockMs / 1000 ? p.clock : p?.prevClock ?? 0,
    };
    if (!p || JSON.stringify({ ...p, countAt: 0, markAt: 0, wipeAt: 0, letterAt: 0, clockAt: 0, prevLetter: 0, prevClock: 0 }) !== JSON.stringify({ ...nb, countAt: 0, markAt: 0, wipeAt: 0, letterAt: 0, clockAt: 0, prevLetter: 0, prevClock: 0 })) {
      prev.current = nb;
      board.current = nb;
    }
  }

  // ---- The bang, the freeze and the report.
  const cam = useRef<RinkCamState>({ craneAt: null, shakeAt: -1e9 });
  const [boomAt, setBoomAt] = useState(-1e9);
  const seenBoom = useRef(boomKey);
  useEffect(() => { if (boomKey !== seenBoom.current) { seenBoom.current = boomKey; setBoomAt(performance.now()); } }, [boomKey]);
  const [report, setReport] = useState<number | null>(null);
  useEffect(() => {
    if (!over) { setReport(null); cam.current.craneAt = null; return; }
    // The run ends on the bang itself: the report begins 1,100 ms after it.
    const wait = T.report.starts_after_burst_ms;
    const id = setTimeout(() => {
      const at = performance.now();
      cam.current.craneAt = at;
      setReport(at);
    }, reduced ? 0 : wait);
    return () => clearTimeout(id);
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  const score = run?.score ?? count;
  const words = useMemo(() => game.history.filter((h) => h.seat === 0 && h.kind === 'play' && h.word).map((h) => h.word!), [game.history.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (over && report !== null && board.current?.kind !== 'report') {
    const endClock = practiceTurnMs(start, score) / 1000;
    board.current = {
      kind: 'report',
      title: run?.isNew ? 'New best!' : score >= 10 ? 'Good session' : 'Warm-up done', titleBest: !!run?.isNew,
      count: score,
      facts: [['Best', String(run?.best ?? Math.max(best, score))], ['Clock', endClock === start ? `${start} s` : `${start} to ${endClock} s`], ['Bot', LEVEL_WORD[bot]], ['Rating', String(practiceRating(start, bot, score))]],
      rosette: !!run?.isNew,
      at: report + (reduced ? 0 : T.report.camera_crane_ms),
    };
  }
  // Skip to the finished report on any tap or key.
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    if (report === null) { setSkipped(false); return; }
    const skip = () => { setSkipped(true); cam.current.craneAt = -1e9; if (board.current?.kind === 'report') board.current = { ...board.current, at: -1e9 }; };
    addEventListener('pointerdown', skip, { once: true }); addEventListener('keydown', skip, { once: true });
    return () => { removeEventListener('pointerdown', skip); removeEventListener('keydown', skip); };
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- The word a sheep just played, over its plate for 1.2 s; the bot's three dots while it thinks.
  const [bubble, setBubble] = useState<{ seat: number; word: string; key: number } | null>(null);
  const lastPlay = game.history.length ? game.history[game.history.length - 1] : null;
  useEffect(() => {
    if (!lastPlay || lastPlay.kind !== 'play' || !lastPlay.word) return;
    setBubble({ seat: lastPlay.seat, word: lastPlay.word, key: performance.now() });
    const id = setTimeout(() => setBubble(null), T.bubble.show_ms_after_turn_passes + T.bubble.fade_ms);
    return () => clearTimeout(id);
  }, [game.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Typing: a real hidden field keeps focus; the tiles mirror it. The letter is always the first tile.
  const field = useRef<HTMLInputElement>(null);
  const shown = !L ? input.typed : input.typed.toLowerCase().startsWith(L) ? input.typed : L + input.typed;
  const onType = (v: string) => {
    let next = v.replace(/[^a-zA-Z]/g, '');
    if (L && !next.toLowerCase().startsWith(L)) next = L + next;
    if (L && next.toLowerCase() === L + L) next = L; // the letter typed again out of habit
    input.onChange(next);
  };
  useEffect(() => { if (playing && !phone) field.current?.focus(); }, [playing, phone]);

  // ---- Pins: what is laid over the scene, and where.
  const refs = useRef(new Map<string, RefObject<HTMLDivElement | null>>()).current;
  const ref = (k: string) => { let r = refs.get(k); if (!r) refs.set(k, (r = { current: null })); return r; };
  const runOn = () => report === null;
  const pins: Pin[] = useMemo(() => [
    { el: ref('seat0'), at: () => (runOn() ? [-1.15, 1.5, 0] : null), mode: 'above' },
    { el: ref('seat1'), at: () => (runOn() ? [1.15, 1.5, 0] : null), mode: 'above' },
    { el: ref('coach'), at: () => (phone ? [-2.15, 2.85, -3.35] : [-2.5, 2.55, -3.35]), mode: phone ? 'above' : 'left' },
    { el: ref('rack'), at: () => (phone || !runOn() ? null : [-1.02 - 0.075, 0.15, 2.47]), mode: 'foot', depthVar: true },
    { el: ref('pass'), at: () => (phone || !runOn() ? null : [1.32, 0.33, 2.47]), mode: 'foot', depthVar: true },
    { el: ref('report'), at: () => (runOn() ? null : [0, 1.46, -4.3]), mode: 'below' },
  ], [phone, report]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = holder === 0;
  const states2: [Mood, Mood] = states;
  return (
    <div className="rk" data-phone={phone || undefined} data-reduced={reduced || undefined}>
      <RinkTable states={states2} avatar={avatar} bot={bot} holder={holder} bomb={bomb} blast={blast} boomKey={boomKey}
        frozenSeat={over ? 0 : null} frozenAt={boomAt} board={board} cam={cam} coach={coach} pins={pins} reduced={reduced} phone={phone} fps={fps} />
      <div className="rk-pins" aria-live="polite">
        {[0, 1].map((seat) => {
          const p = game.players[seat];
          const showWord = bubble && bubble.seat === seat ? bubble.word : null;
          const thinking = seat === 1 && holder === 1 && !showWord && playing;
          return (
            <div key={seat} ref={ref(`seat${seat}`)} className="rk-pin rk-head">
              {showWord && <div className="rk-bubble" key={bubble!.key}>{showWord}</div>}
              {thinking && <div className="rk-bubble rk-dots" aria-label={`${p.name} is thinking`}><i /><i /><i /></div>}
              {(!phone || (!showWord && !thinking)) && (
                <div className="rk-plate" data-you={seat === 0 || undefined}>
                  <b>{p.name}</b>
                  {seat === 1 && <><span className="rk-plate-rule" /><Art k={bot} px={2} /><span className="rk-plate-level">{LEVEL_WORD[bot]}</span></>}
                </div>
              )}
            </div>
          );
        })}
        <div ref={ref('coach')} className="rk-pin">
          {said && <div className="rk-coach" key={said.key} data-phone={phone || undefined}><b>{said.title}</b>{said.line && <span>{said.line}</span>}</div>}
        </div>
        <div ref={ref('rack')} className="rk-pin rk-rack-pin">
          <Tiles word={shown} letterLocked={!!L} shakeKey={shakeKey} caret={playing} />
        </div>
        <div ref={ref('pass')} className="rk-pin rk-pass-pin">
          <PassTile ready={mine} onPass={() => input.submit()} />
        </div>
        <div ref={ref('report')} className="rk-pin rk-report-pin">
          {report !== null && <Report words={words} phone={phone} skipped={skipped || reduced} onAgain={rematch} onFarm={quit} dream={dreamWaiting} />}
        </div>
      </div>
      {phone && report === null && (
        <div className="rk-strip" onPointerDown={(e) => { e.preventDefault(); field.current?.focus(); }} onClick={() => field.current?.focus()}>
          <Tiles word={shown} letterLocked={!!L} shakeKey={shakeKey} caret={playing} />
          <PassTile ready={mine} onPass={() => input.submit()} />
        </div>
      )}
      <input ref={field} className="rk-field" value={shown} aria-label={`Your word, starting with ${L.toUpperCase()}`}
        autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" disabled={over}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); input.submit(); } }}
        onBlur={() => { if (!phone && playing) setTimeout(() => { if (document.activeElement === document.body) field.current?.focus(); }, 0); }} />
    </div>
  );
}

/** The tiles on the rack: the letter in lantern (locked), the typed letters in wool, the caret where the next stands. */
function Tiles({ word, letterLocked, shakeKey, caret }: { word: string; letterLocked: boolean; shakeKey: number; caret: boolean }) {
  const n = Math.max(1, word.length);
  return (
    <div className="rk-tiles" key={shakeKey} data-shake={shakeKey ? true : undefined} style={{ '--n': n } as React.CSSProperties} aria-hidden="true">
      {[...word].map((ch, i) => <span key={i} className="rk-tile" data-lantern={(i === 0 && letterLocked) || undefined}>{ch.toUpperCase()}</span>)}
      {caret && <span className="rk-caret" />}
    </div>
  );
}

function PassTile({ ready, onPass }: { ready: boolean; onPass: () => void }) {
  return (
    <button type="button" className="rk-pass" disabled={!ready} onPointerDown={(e) => e.preventDefault()} onClick={onPass}>
      <Art k="return-key" px={2} /> Pass
    </button>
  );
}

/** Under the board at the end: your words on slips, Go again, Back to the farm, and tonight's dream if unplayed. */
function Report({ words, phone, skipped, onAgain, onFarm, dream }: { words: string[]; phone: boolean; skipped: boolean; onAgain: () => void; onFarm: () => void; dream: boolean }) {
  const room = phone ? 16 : 26; // two rows on a computer, four on a phone
  const shown = words.length > room ? words.slice(0, room - 1) : words;
  const [log, setLog] = useState(false);
  const slipsAt = TIMINGS.practice.report.camera_crane_ms + 200 + 600;
  const buttonsAt = slipsAt + shown.length * 30 + 400;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter') onAgain(); };
    const id = setTimeout(() => addEventListener('keydown', k), skipped ? 0 : buttonsAt);
    return () => { clearTimeout(id); removeEventListener('keydown', k); };
  }, [skipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = (ms: number) => ({ animationDelay: `${skipped ? 0 : ms}ms` });
  return (
    <div className="rk-report hm" data-skipped={skipped || undefined}>
      <p className="rk-report-head" style={d(slipsAt)}>Your words</p>
      <div className="rk-slips">
        {(log ? words : shown).map((w, i) => <span key={i} className="rk-slip" style={d(slipsAt + i * 30)}>{w}</span>)}
        {!log && words.length > shown.length && <button type="button" className="rk-slip" data-lantern style={d(slipsAt + shown.length * 30)} onClick={() => setLog(true)}>+{words.length - shown.length} more</button>}
        {!words.length && <span className="rk-slip" style={d(slipsAt)}>none this time</span>}
      </div>
      <div className="rk-actions" style={d(buttonsAt)}>
        <Slab tone="lantern" onClick={onAgain} autoFocus>Go again</Slab>
        <Slab onClick={onFarm}>Back to the farm</Slab>
        {dream && <span className="rk-dream"><Art k="moon-small" px={2} /> Tonight&rsquo;s dream is waiting</span>}
      </div>
    </div>
  );
}

/** An icon from the pack's pixel art (X1). */
export function Art({ k, px }: { k: string; px: number }) {
  const a = PIXEL_ART[k];
  if (!a) return null;
  const w = Math.max(...a.rows.map((r) => r.length)), h = a.rows.length;
  const colours = Object.fromEntries(Object.entries(a.colours).map(([ch, c]) => [ch, artColour(c) ?? 'transparent']));
  return <svg className="rk-art" width={w * px} height={h * px} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">{pixelRects(a.rows, colours)}</svg>;
}

