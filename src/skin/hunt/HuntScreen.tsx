import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, FlameIcon } from '../components/Icons';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { checkNickname } from '../../lib/nickname';
import { getHuntBest, huntShareText, recordHuntBest } from '../../hunt/record';
import { appendLog, logLine, readLog } from '../../hunt/log';
import type { RunCause } from '../../hunt/log';
import { beat, meet, readBestiary } from '../../hunt/bestiary';
import { newCode, normaliseCode, parseCode, seedOf } from '../../hunt/codes';
import { attemptOf, lastPack, ordinal, recordAttempt } from '../../hunt/packs';
import { WORDS_VERSION } from '../../config';
import {
  activeRules, applyItem, attack, causeOf, checkTyped, exampleWords, HEAL_ON_WIN, HP_PER_LEVEL, ITEMS, lastWords, MOVES, nextPredator,
  START_LEVEL, startRun, timeOut, turnSeconds, walkHome,
} from '../../hunt/hunt';
import type { ItemId, Outcome, PredatorKind, Run } from '../../hunt/hunt';
import { ruleHow } from '../../hunt/rules';
import type { Rule } from '../../hunt/rules';
import { useStore } from '../../state/store';
import { useMotionLevel } from '../hooks/useAmbient';
import { localDateKey } from '../hooks/useToday';
import { devOn, DevLine } from '../table/DevStats';
import { packLink, useHuntUi } from './huntStore';
import { CodeBoxes, DeathPanel, Dex, GbButtons, ResultsCard, RuleCardView } from './panels';
import type { RuleCard } from './panels';
import { PredatorSprite, SheepBackSprite } from './sprites';
import './hunt.css';

/**
 * The Hunt, played like a handheld monster battle: a fixed 256 x 192 screen scaled up with crisp pixels, the wild
 * predator top right with its name box, the sheep from behind bottom left with its HP and EXP, and a text box along the
 * bottom with FIGHT / BAG / RULES / RUN. Every action plays out as a queue of typed messages and effects. Plan v7 adds
 * a lobby (no auto-start), pack codes, rule cards that teach, a live check of the typed word, a death screen, a results
 * card made to be screenshotted, the bestiary, walking home after a boss and a leave prompt. The run itself lives in
 * src/hunt (pure and seeded); this screen only plays it out.
 */
const W = 256, H = 192;
const BEAT = 480;
const ARROWS = ['←', '↓', '↑', '→'];
const ITEM_IDS: ItemId[] = ['milk', 'bell', 'pepper'];
const LOBBY_ITEMS = ['NEW PACK', 'ENTER CODE', 'BESTIARY', 'FARM'];
/** What each predator gets you with, for the death screen. */
const WEAPON: Record<PredatorKind, string> = { wolf: 'fangs', fox: 'teeth', lynx: 'claws', bear: 'paws', eagle: 'talons', shadow: 'fangs' };
type Fx = 'meAttack' | 'foeHit' | 'foeAttack' | 'meHit' | 'foeFaint' | 'freeze' | 'heal' | 'appear' | 'go';
interface Step { text?: string; fx?: Fx; foeHp?: number; meHp?: number; meMax?: number; level?: number; exp?: number; ms?: number }
type After = 'menu' | 'announce' | 'next' | 'death';
type Mode =
  | { m: 'lobby' }
  /** Typing a pack code; `stale` holds a code from another word list awaiting FIGHT ANYWAY. */
  | { m: 'code'; stale?: string }
  | { m: 'dex' }
  /** `resume`: back to the menu without a new turn. */
  | { m: 'steps'; steps: Step[]; at: number; after: After; enraged?: Rule; resume?: boolean }
  | { m: 'announce'; rules: Rule[]; enraged: boolean; mystery: boolean }
  | { m: 'menu' }
  | { m: 'fight' }
  | { m: 'bag' }
  /** The rule cards: the clock keeps running (reading costs time, not a turn). */
  | { m: 'rules' }
  /** A boss is down: walk home or hunt on. No clock. */
  | { m: 'walk' }
  | { m: 'death' }
  | { m: 'results' }
  /** "Leave the hunt?" over whatever was on; `left` is the turn time to give back on STAY. */
  | { m: 'leave'; back: Mode; left: number };
/** How the run ended, for the death screen and the log. */
interface Ending { cause: 'timeout' | 'broke' | 'hits'; before: Run; outcome: Outcome; word: string; after: Run }

export function HuntScreen() {
  const dict = useStore((s) => s.dict);
  const nickname = useStore((s) => s.settings.name);
  const close = useHuntUi((s) => s.close);
  const reduced = useMotionLevel() === 'reduced';
  const me = (checkNickname(nickname).ok && nickname.trim() ? nickname.trim() : 'Lamb').toUpperCase().slice(0, 10);

  const [run, setRun] = useState<Run | null>(null);
  const [pack, setPack] = useState<{ code: string; attempt: number; stale: boolean } | null>(null);
  const [mode, setMode] = useState<Mode>({ m: 'lobby' });
  // What the boxes show; steps move these, so a bar drains when the strike lands rather than when it is decided.
  const [view, setView] = useState({ foeHp: 0, meHp: 0, meMax: 0, level: START_LEVEL, exp: 0 });
  const [fx, setFx] = useState<{ kind: Fx; key: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [bagCursor, setBagCursor] = useState(0);
  /** The cursor on a panel whose buttons start unchosen (death, results, prompts): -1 until an arrow or the pointer moves it. */
  const [pick, setPick] = useState(-1);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [turnEnds, setTurnEnds] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [beatN, setBeat] = useState(0);
  const [record, setRecord] = useState<{ defeated: number; damage: number; isNew: boolean } | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(2);
  const [codeTyped, setCodeTyped] = useState('');
  const [codeError, setCodeError] = useState(0);
  const [dexCursor, setDexCursor] = useState(0);
  const [flipped, setFlipped] = useState<PredatorKind | null>(null);
  const ghost = useRef<HTMLInputElement>(null);
  const codeGhost = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const speed = reduced ? 0.5 : 1;
  // For the run log: when the run began, where the current predator's marks start, and whether it is recorded.
  const startedAt = useRef(0);
  const markStart = useRef(0);
  const finished = useRef(true);
  /** The biggest hit landed on the predator in front of the sheep, for its bestiary card. */
  const bigHit = useRef<{ word: string; damage: number } | null>(null);
  const today = () => localDateKey(new Date());

  // Scale the 256 x 192 screen to fit, in half steps so the pixels stay as even as possible, and never past 3x:
  // bigger only makes the boxes and text clumsy.
  useLayoutEffect(() => {
    const fit = () => setScale(Math.max(1, Math.min(3, Math.floor(Math.min(window.innerWidth / W, (window.innerHeight * 0.86) / H) * 2) / 2)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const sync = useCallback((r: Run) => setView({ foeHp: r.predator.hp, meHp: r.hp, meMax: r.maxHp, level: r.level, exp: 1 - r.predator.hp / r.predator.maxHp }), []);

  function appearSteps(r: Run, first: boolean): Mode {
    const name = r.predator.name.toUpperCase();
    const steps: Step[] = [{ text: r.predator.boss ? `The ${name} steps out of the blizzard!` : `Wild ${name} appeared!`, fx: 'appear', ms: 1600 }];
    if (first) steps.push({ text: `Go! ${me}!`, fx: 'go', ms: 1100 });
    return { m: 'steps', steps, at: 0, after: 'announce' };
  }

  /** Starts a run of a pack. Nothing starts on its own: this runs only from a choice (or a ?pack= link). */
  function begin(code: string, stale: boolean) {
    if (!dict) return;
    const r = startRun(dict, seedOf(code));
    startedAt.current = Date.now();
    markStart.current = 0;
    finished.current = false;
    bigHit.current = null;
    meet(r.predator.kind, today());
    setPack({ code, attempt: attemptOf(code), stale });
    setRun(r);
    sync(r);
    setRecord(null);
    setEnding(null);
    setHint(null);
    setCopied(false);
    setPick(-1);
    setMode(appearSteps(r, true));
  }

  /** Records a finished run once: the best, the pack's attempt, and the log (plan v7 Parts 3 and 4.1). */
  function finish(r: Run, end: { cause: RunCause; brokeRule?: string }) {
    if (finished.current || !pack) return;
    finished.current = true;
    const date = today();
    const { best, isNew } = recordHuntBest({ defeated: r.defeated, damage: r.damage, code: pack.code, attempt: pack.attempt, date, walked: !!r.walkedHome });
    setRecord(best ? { defeated: best.defeated, damage: best.damage, isNew } : null);
    recordAttempt(pack.code, { defeated: r.defeated, damage: r.damage });
    appendLog({
      code: pack.code, attempt: pack.attempt, date, defeated: r.defeated, damage: r.damage, words: r.used.length,
      level: r.level, reached: r.predator.kind, cause: end.cause, ...(end.brokeRule ? { brokeRule: end.brokeRule } : {}),
      turnsAtDeath: r.marks.length - markStart.current, itemsLeft: { ...r.items }, seconds: Math.round((Date.now() - startedAt.current) / 1000),
      wordsVersion: WORDS_VERSION,
    });
  }

  // A friend's code from a ?pack= link: straight into its announcement, or the older-list notice first.
  useEffect(() => {
    if (!dict) return;
    const raw = useHuntUi.getState().takeCode();
    if (raw === null) return;
    const parsed = parseCode(raw);
    if (!parsed) { setCodeTyped(normaliseCode(raw).slice(0, 5)); setCodeError((n) => n + 1); setMode({ m: 'code' }); }
    else if (parsed.stale) { setPick(-1); setMode({ m: 'code', stale: parsed.code }); }
    else begin(parsed.code, false);
  }, [dict]); // eslint-disable-line react-hooks/exhaustive-deps

  // The turn clock runs while the sheep chooses (menu, fight, bag, the rule cards). Running out lets the predator strike.
  function startTurn() {
    setTurnEnds(performance.now() + (run ? turnSeconds(run.index) : 20) * 1000);
    setTyped('');
    setNote('');
    setCursor(0);
  }

  function goNext() {
    if (!run || !dict) return;
    const next = nextPredator(run, dict);
    markStart.current = next.marks.length;
    bigHit.current = null;
    meet(next.predator.kind, today());
    setRun(next);
    sync(next);
    setMode(appearSteps(next, false));
  }

  // Play the step queue: apply each step's effect and bar values, wait, move on.
  useEffect(() => {
    if (mode.m !== 'steps' || !run || !dict) return;
    const step = mode.steps[mode.at];
    if (!step) {
      if (mode.after === 'menu') { if (!mode.resume) startTurn(); setMode({ m: 'menu' }); }
      else if (mode.after === 'announce') setMode({ m: 'announce', rules: mode.enraged ? [mode.enraged] : run.predator.rules, enraged: !!mode.enraged, mystery: !mode.enraged && !!run.predator.reserve });
      else if (mode.after === 'death') { setPick(-1); setMode({ m: 'death' }); }
      // A boss is down: the sheep may walk home with its win (plan v7 Part 5.7).
      else if (run.predator.boss) { setPick(-1); setMode({ m: 'walk' }); }
      else goNext();
      return;
    }
    setView((v) => ({
      foeHp: step.foeHp ?? v.foeHp, meHp: step.meHp ?? v.meHp, meMax: step.meMax ?? v.meMax, level: step.level ?? v.level, exp: step.exp ?? v.exp,
    }));
    if (step.fx) {
      setFx({ kind: step.fx, key: Date.now() });
      if (step.fx === 'foeHit') playSound('play');
      else if (step.fx === 'meHit') playSound('fail');
      else if (step.fx === 'foeFaint') playSound('bank');
      else if (step.fx === 'freeze') playSound('roundEnd');
      else if (step.fx === 'heal') playSound('fanfare');
    }
    const ms = (step.ms ?? (step.text ? 1250 + step.text.length * 18 : 750)) * speed;
    const id = setTimeout(() => setMode({ ...mode, at: mode.at + 1 }), ms);
    return () => clearTimeout(id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // The announcement: the predator bops to the beat and names its rules, one sign per rule (four beats each, so the
  // examples can be read), then the turn begins. Under reduced motion the signs are all there at once, for the same
  // total time: the reading time is not an animation.
  const announceMs = (rules: number, mystery: boolean) => BEAT * (2 + rules * 4 + (mystery ? 2 : 0));
  const signDelay = (i: number) => (reduced ? 0 : BEAT * (2 + i * 4));
  useEffect(() => {
    if (mode.m !== 'announce') return;
    const id = setTimeout(() => { startTurn(); setMode({ m: 'menu' }); }, announceMs(mode.rules.length, mode.mystery));
    return () => clearTimeout(id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setBeat((b) => b + 1), BEAT);
    return () => clearInterval(id);
  }, [reduced]);
  useEffect(() => { if (mode.m === 'announce' && beatN % 3 === 2) playTick(0.2 + (beatN % 4) * 0.1); }, [beatN, mode.m]);

  const choosing = mode.m === 'menu' || mode.m === 'fight' || mode.m === 'bag' || mode.m === 'rules';
  useEffect(() => {
    if (!choosing) return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [choosing]);
  useEffect(() => {
    if (!choosing || !run || !turnEnds || now < turnEnds) return;
    const { run: next, outcome } = timeOut(run);
    resolve(next, outcome, '');
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus: the hidden input while typing a word or a code, otherwise the screen itself for the arrow keys.
  useEffect(() => {
    if (mode.m === 'fight') ghost.current?.focus();
    else if (mode.m === 'code' && !mode.stale) codeGhost.current?.focus();
    else rootRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // The dev overlay's line: the run log's summary (plan v7 Part 3.2).
  useEffect(() => {
    if (!devOn()) return;
    const el = document.getElementById('sk-dev');
    if (el) el.textContent = logLine(readLog());
  }, [mode.m]);

  const rules = useMemo(() => (run && dict ? activeRules(run, dict) : { rules: [], relaxed: [] }), [run, dict]);
  const check = useMemo(() => (run && dict && mode.m === 'fight' && typed.length >= 3 ? checkTyped(run, dict, typed) : null), [run, dict, typed, mode.m]);

  /** Turns an outcome into the message queue that plays it out. */
  function resolve(next: Run, outcome: Outcome, word: string) {
    if (!run) return;
    const foe = run.predator.name.toUpperCase();
    const move = MOVES[run.predator.kind];
    const steps: Step[] = [];
    const strike = (counter: number, hp: number, dead: boolean) => {
      steps.push({ text: `Wild ${foe} used ${move}!`, fx: 'foeAttack', ms: 1300 }, { fx: 'meHit', meHp: hp, ms: 800 });
      if (counter > 14) steps.push({ text: "It's super effective!" });
      if (dead) steps.push({ text: `${me} is frozen solid!`, fx: 'freeze', ms: 2200 }, { text: `${me} can't go on...` });
    };
    let after: After = 'menu';
    let enraged: Rule | undefined;
    if (outcome.kind === 'hit') {
      if (!bigHit.current || outcome.damage > bigHit.current.damage) bigHit.current = { word, damage: outcome.damage };
      steps.push({ text: `${me} used ${word.toUpperCase()}!`, fx: 'meAttack', ms: 1100 });
      steps.push({ fx: 'foeHit', foeHp: outcome.predatorHp, exp: 1 - outcome.predatorHp / run.predator.maxHp, ms: 900 });
      if (run.peppered) steps.push({ text: 'The pepper burns! Double damage!' });
      if (outcome.crit) steps.push({ text: 'A critical hit! What a rare word!' });
      if (outcome.defeated) {
        beat(run.predator.kind, run.index + START_LEVEL, bigHit.current);
        const max = run.maxHp + HP_PER_LEVEL;
        steps.push({ text: `Wild ${foe} fainted!`, fx: 'foeFaint', ms: 1600 });
        steps.push({ text: `${me} gained ${run.predator.maxHp} EXP. Points!`, exp: 1 });
        steps.push({ text: `${me} grew to Lv${run.level + 1}!`, fx: 'heal', level: run.level + 1, exp: 0, meMax: max, meHp: Math.min(max, run.hp + HP_PER_LEVEL + HEAL_ON_WIN) });
        after = 'next';
      } else {
        strike(outcome.counter, outcome.hp, outcome.dead);
        if (outcome.enraged && !outcome.dead) { steps.push({ text: `${foe} is getting angry!` }); after = 'announce'; enraged = outcome.enraged; }
      }
    } else if (outcome.kind === 'broke') {
      steps.push({ text: `${me} used ${word.toUpperCase()}!`, fx: 'meAttack', ms: 1100 }, { text: `But it broke a rule: ${outcome.rule.label}!` });
      strike(outcome.counter, outcome.hp, outcome.dead);
    } else if (outcome.kind === 'timeout') {
      steps.push({ text: `${me} hesitated...` });
      strike(outcome.counter, outcome.hp, outcome.dead);
    } else if (outcome.kind === 'item') {
      steps.push({ text: `${me} used the ${ITEMS[outcome.item].name.toUpperCase()}!` });
      if (outcome.item === 'milk') steps.push({ text: `${me} recovered ${outcome.heal} HP!`, fx: 'heal', meHp: run.hp + outcome.heal });
      if (outcome.item === 'bell') { steps.push({ text: outcome.hint ? `The bell rings out: "${outcome.hint.toUpperCase()}"!` : 'The bell rings... but no word comes.' }); setHint(outcome.hint); }
      if (outcome.item === 'pepper') steps.push({ text: `${me}'s next word will hit twice as hard!` });
      strike(outcome.counter, outcome.hp, outcome.dead);
    }
    if (next.over && outcome.kind !== 'invalid') {
      after = 'death';
      const cause = causeOf(outcome);
      setEnding({ cause, before: run, outcome, word, after: next });
      finish(next, { cause, ...(outcome.kind === 'broke' ? { brokeRule: outcome.rule.id } : {}) });
    }
    if (outcome.kind === 'hit' || outcome.kind === 'broke') setHint(null);
    setRun(next);
    setMode({ m: 'steps', steps, at: 0, after, enraged });
  }

  const submitWord = () => {
    if (!run || !dict || !typed.trim()) return;
    const { run: next, outcome } = attack(run, dict, typed);
    if (outcome.kind === 'invalid') {
      setNote(outcome.reason === 'notWord' ? "That's not a word!" : outcome.reason === 'used' ? 'Already used this hunt!' : outcome.reason === 'short' ? 'At least 3 letters!' : 'Letters only!');
      return;
    }
    resolve(next, outcome, typed);
  };

  const choose = (i: number) => {
    if (!run) return;
    if (i === 0) { setMode({ m: 'fight' }); return; }
    if (i === 1) { setBagCursor(0); setMode({ m: 'bag' }); return; }
    if (i === 2) { setMode({ m: 'rules' }); return; }
    setMode({ m: 'steps', steps: [{ text: "There's no running from a predator!" }], at: 0, after: 'menu', resume: true });
  };

  const pickItem = (id: ItemId) => {
    if (!run || !dict) return;
    const out = applyItem(run, dict, id);
    if (out) resolve(out.run, out.outcome, '');
  };

  // ---------- the lobby, codes and the bestiary ----------
  const lobbyPick = (i: number) => {
    if (i === 0) begin(newCode(), false);
    else if (i === 1) { setCodeTyped(''); setCodeError(0); setMode({ m: 'code' }); }
    else if (i === 2) { setFlipped(null); setMode({ m: 'dex' }); }
    else close();
  };
  const submitCode = () => {
    const parsed = parseCode(codeTyped);
    if (!parsed) { setCodeError((n) => n + 1); playSound('fail'); return; }
    if (parsed.stale) { setPick(-1); setMode({ m: 'code', stale: parsed.code }); return; }
    begin(parsed.code, false);
  };
  const toLobby = () => { setPick(-1); setMode({ m: 'lobby' }); };

  // ---------- the run's end ----------
  const deathPick = (i: number) => {
    if (!pack) return;
    if (i === 0) begin(pack.code, pack.stale);
    else if (i === 1) begin(newCode(), false);
    else { setPick(-1); setMode({ m: 'results' }); }
  };
  const resultItems = ending ? ['BACK', 'FIGHT AGAIN', 'NEW PACK', 'SHARE', 'FARM'] : ['FIGHT AGAIN', 'NEW PACK', 'SHARE', 'FARM'];
  const resultsPick = (i: number) => {
    if (!pack) return;
    const item = resultItems[i];
    if (item === 'BACK') { setPick(-1); setMode({ m: 'death' }); }
    else if (item === 'FIGHT AGAIN') begin(pack.code, pack.stale);
    else if (item === 'NEW PACK') begin(newCode(), false);
    else if (item === 'SHARE') void share();
    else close();
  };
  const walkPick = (i: number) => {
    if (!run) return;
    if (i === 0) {
      const walked = walkHome(run);
      setRun(walked);
      finish(walked, { cause: 'walk' });
      setPick(-1);
      setMode({ m: 'results' });
    } else goNext();
  };

  // ---------- leaving ----------
  const midRun = !!run && !run.over && !finished.current && mode.m !== 'lobby' && mode.m !== 'code' && mode.m !== 'dex' && mode.m !== 'leave';
  /** The quit button and Esc from the menu: mid-run, ask once; otherwise leave at once. */
  const askLeave = () => {
    if (!midRun) { close(); return; }
    setPick(-1);
    setMode({ m: 'leave', back: mode, left: choosing ? Math.max(0, turnEnds - performance.now()) : 0 });
  };
  const leavePick = (i: number) => {
    if (mode.m !== 'leave' || !run) return;
    if (i === 0) { finish(run, { cause: 'left' }); close(); return; }
    const back = mode.back;
    if (back.m === 'menu' || back.m === 'fight' || back.m === 'bag' || back.m === 'rules') setTurnEnds(performance.now() + mode.left);
    setMode(back);
  };

  /** Moves a -1-based cursor over n buttons. */
  const movePick = (n: number, dir: number) => setPick((c) => (c < 0 ? (dir > 0 ? 0 : n - 1) : (c + dir + n) % n));

  const onKey = (e: ReactKeyboardEvent) => {
    const k = e.key;
    const ok = k === 'Enter' || k === ' ' || k === 'z' || k === 'Z';
    const back = k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace';
    const next = k === 'ArrowDown' || k === 'ArrowRight';
    const prev = k === 'ArrowUp' || k === 'ArrowLeft';
    /** A panel whose buttons start unchosen: arrows place the cursor, Enter only acts once it is placed. */
    const panel = (n: number, act: (i: number) => void, onBack?: () => void) => {
      if (next) movePick(n, 1);
      else if (prev) movePick(n, -1);
      else if (ok) { if (pick >= 0) act(pick); else return false; }
      else if (back && onBack) onBack();
      else return false;
      return true;
    };
    let handled = true;
    if (mode.m === 'menu' || mode.m === 'lobby') {
      const act = mode.m === 'menu' ? choose : lobbyPick;
      if (k === 'ArrowRight' || k === 'ArrowLeft') setCursor((c) => c ^ 1);
      else if (k === 'ArrowDown' || k === 'ArrowUp') setCursor((c) => c ^ 2);
      else if (ok) act(cursor);
      else if (back) { if (mode.m === 'menu') askLeave(); else close(); }
      else handled = false;
    } else if (mode.m === 'bag') {
      if (k === 'ArrowDown') setBagCursor((c) => Math.min(ITEM_IDS.length, c + 1));
      else if (k === 'ArrowUp') setBagCursor((c) => Math.max(0, c - 1));
      else if (ok) { if (bagCursor === ITEM_IDS.length) setMode({ m: 'menu' }); else pickItem(ITEM_IDS[bagCursor]); }
      else if (back) setMode({ m: 'menu' });
      else handled = false;
    } else if (mode.m === 'rules') {
      if (back || ok) setMode({ m: 'menu' });
      else handled = false;
    } else if (mode.m === 'steps' && ok) {
      // Skip ahead, like pressing A on a message.
      setMode({ ...mode, at: mode.at + 1 });
    } else if (mode.m === 'death') handled = panel(3, deathPick);
    else if (mode.m === 'results') handled = panel(resultItems.length, resultsPick, ending ? () => { setPick(-1); setMode({ m: 'death' }); } : undefined);
    else if (mode.m === 'walk') handled = panel(2, walkPick);
    else if (mode.m === 'leave') handled = panel(2, leavePick, () => leavePick(1));
    else if (mode.m === 'code' && mode.stale) handled = panel(2, (i) => (i === 0 ? begin(mode.stale!, true) : setMode({ m: 'code' })), () => setMode({ m: 'code' }));
    else if (mode.m === 'dex') {
      if (k === 'ArrowRight') setDexCursor((c) => (c + 1) % 6);
      else if (k === 'ArrowLeft') setDexCursor((c) => (c + 5) % 6);
      else if (k === 'ArrowDown' || k === 'ArrowUp') setDexCursor((c) => (c + 3) % 6);
      else if (ok) flip(dexCursor);
      else if (back) toLobby();
      else handled = false;
    } else handled = false;
    if (!handled) return;
    if (mode.m !== 'steps') playTick(0.1);
    e.preventDefault();
  };

  const dex = useMemo(() => (mode.m === 'dex' || mode.m === 'lobby' ? readBestiary() : null), [mode.m]);
  const flip = (i: number) => {
    setDexCursor(i);
    const kind = (['fox', 'wolf', 'lynx', 'eagle', 'bear', 'shadow'] as PredatorKind[])[i];
    if (dex?.[kind].met) setFlipped((f) => (f === kind ? null : kind));
  };

  const share = async () => {
    if (!run || !pack) return;
    const boss = run.walkedHome ? run.predator.name : undefined;
    const text = huntShareText({
      defeated: run.defeated, damage: run.damage, marks: run.marks, record: record?.isNew,
      code: pack.code, attempt: pack.attempt, stale: pack.stale, walked: boss, link: packLink(pack.code).replace(/^https?:\/\//, ''),
    });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!dict) {
    return <main className="gb-root"><p className="gb-loading">Loading the word list…</p></main>;
  }

  // ---------- the lobby, the code entry and the bestiary have no run on screen ----------
  const inBattle = !!run && mode.m !== 'lobby' && mode.m !== 'code' && mode.m !== 'dex';
  const shownMode = mode.m === 'leave' ? mode.back : mode;

  const frame = (children: ReactNode) => (
    <main ref={rootRef} className="gb-root" tabIndex={-1} onKeyDown={onKey} aria-label="Hunt" data-mode={mode.m}>
      <div className="gb-frame" style={{ width: W * scale, height: H * scale }}>
        <div className={`gb-screen ${fx?.kind === 'meHit' && mode.m === 'steps' && !reduced ? 'gb-quake' : ''}`} style={{ transform: `scale(${scale})` }}>
          <div className="gb-sky" aria-hidden="true" />
          <div className="gb-flakes" aria-hidden="true" />
          {children}
        </div>
      </div>
      <button className="gb-quit" onClick={askLeave} aria-label="Leave the hunt"><CloseIcon size={16} /></button>
      <DevLine />
      <p className="gb-help" aria-hidden="true">Arrow keys move · Enter picks · Esc goes back · type your word in FIGHT</p>
    </main>
  );

  if (!inBattle || !run) {
    const best = getHuntBest();
    const last = lastPack();
    const met = dex ? Object.values(dex).filter((e) => e.met).length : 0;
    const lobbyText = mode.m === 'code' && mode.stale ? 'FIGHT ANYWAY, or go BACK?' : mode.m === 'code' ? "Type a friend's pack code." : 'The pack is out there.';
    return frame(
      <>
        <div className="gb-pad gb-pad-me" aria-hidden="true" />
        <div className="gb-me" aria-hidden="true"><SheepBackSprite /></div>
        <section className="gb-box gb-lobby-box" aria-label="Your records">
          <div className="gb-row gb-lobby-title"><span>THE HUNT</span>{met > 0 && <span>{met}/6 MET</span>}</div>
          <div className="gb-lobby-line">{best ? `BEST ${best.defeated} BEATEN · ${best.damage}` : 'NO HUNTS YET'}</div>
          {last && <div className="gb-lobby-line">LAST PACK {last.code} · {ordinal(last.attempts)} TRY</div>}
        </section>

        {mode.m === 'code' && (
          <div className="gb-code" role="dialog" aria-label="Enter a pack code">
            {mode.stale ? (
              <>
                <h2>{mode.stale}</h2>
                <p>This code is from an older word list. The pack may not match your friend&apos;s.</p>
                <GbButtons label="Fight it anyway?" items={['FIGHT ANYWAY', 'BACK']} cursor={pick} onHover={setPick}
                  onPick={(i) => (i === 0 ? begin(mode.stale!, true) : setMode({ m: 'code' }))} className="gb-buttons-row" />
              </>
            ) : (
              <>
                <h2>PACK CODE</h2>
                <div className="gb-code-input" onClick={() => codeGhost.current?.focus()}>
                  <CodeBoxes value={codeTyped} shake={codeError} />
                  <input
                    ref={codeGhost} className="gb-ghost" value={codeTyped} aria-label="Pack code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={8}
                    onChange={(e) => { setCodeTyped(normaliseCode(e.target.value).replace(/[^0-9A-Z]/g, '').slice(0, 5)); setCodeError(0); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitCode(); } else if (e.key === 'Escape') { e.preventDefault(); toLobby(); } e.stopPropagation(); }}
                  />
                </div>
                <p className={codeError ? 'gb-code-error' : ''}>{codeError ? "That's not a pack code." : 'A friend’s code fights the same pack.'}</p>
                <GbButtons label="Code" items={['FIGHT', 'BACK']} cursor={-1} onHover={() => {}} onPick={(i) => (i === 0 ? submitCode() : toLobby())} className="gb-buttons-row" />
              </>
            )}
          </div>
        )}

        {mode.m === 'dex' && dex && <Dex dex={dex} cursor={dexCursor} flipped={flipped} onPick={flip} onHover={setDexCursor} />}

        <div className="gb-bottom">
          <div className="gb-text gb-text-half"><Typewriter key={lobbyText} text={lobbyText} /></div>
          {mode.m === 'lobby' ? (
            <div className="gb-panel gb-menu gb-lobby-menu" role="menu" aria-label="The hunt">
              {LOBBY_ITEMS.map((label, i) => (
                <button key={label} role="menuitem" data-on={cursor === i || undefined} onClick={() => lobbyPick(i)} onPointerEnter={() => setCursor(i)}>{label}</button>
              ))}
            </div>
          ) : (
            <div className="gb-panel gb-menu gb-lobby-menu"><button onClick={toLobby} data-on>BACK</button></div>
          )}
        </div>
      </>,
    );
  }

  const p = run.predator;
  const foe = p.name.toUpperCase();
  const left = Math.max(0, turnEnds - now);
  const total = turnSeconds(run.index) * 1000;
  const sm = shownMode;
  const step = sm.m === 'steps' ? sm.steps[sm.at] : null;
  const fxKind = sm.m === 'steps' ? fx?.kind : undefined;
  const over = sm.m === 'death' || sm.m === 'results';
  const frozen = (over && !run.walkedHome) || fxKind === 'freeze' || (sm.m === 'steps' && sm.after === 'death' && sm.steps.slice(0, sm.at + 1).some((s) => s.fx === 'freeze'));
  const fainted = (sm.m === 'steps' && sm.after === 'next' && sm.steps.slice(0, sm.at + 1).some((s) => s.fx === 'foeFaint')) || sm.m === 'walk' || (over && !!run.walkedHome);
  const message =
    sm.m === 'menu' ? `What will\n${me} do?` :
    sm.m === 'announce' ? `${foe}: "${sm.rules.map((r) => r.line).join(' ')}"` :
    sm.m === 'bag' ? (bagCursor < ITEM_IDS.length ? ITEMS[ITEM_IDS[bagCursor]].about : 'Close the bag.') :
    sm.m === 'rules' ? 'Reading costs time, not a turn.' :
    sm.m === 'death' || sm.m === 'results' ? `${me} can't go on...` :
    step?.text ?? lastText(sm);
  const chain = rules.rules.some((r) => r.id === 'chain') && run.prev ? run.prev.at(-1)!.toUpperCase() : null;
  const ex = (r: Rule) => (r.usesPrev && run.prev && dict ? exampleWords(dict, r, `${run.seed}:live:${run.used.length}`, { prev: run.prev, together: rules.rules }) : p.examples[r.id] ?? null);
  const cards: RuleCard[] = [
    ...p.rules.map((r) => ({ id: r.id, label: r.label, how: ruleHow(r, run.prev), example: ex(r), asleep: rules.relaxed.includes(r) })),
    ...(p.reserve ? [{ id: '?', label: '?', how: '', example: null, hidden: true }] : []),
  ];
  const liveNote = note || (check
    ? check.broken ? `breaks: ${check.broken.label}` : check.known === false ? 'not a word' : check.used ? 'already used' : null
    : null);
  const noteBad = !note && !!check && (!!check.broken || check.known === false || check.used);
  const defaultNote = rules.relaxed.length ? `${rules.relaxed[0].label}: asleep this turn` : rules.rules.map((r) => r.label).join(' · ') || 'Anything goes!';

  return frame(
    <>
      {/* The wild predator and its name box. */}
      <div className="gb-pad gb-pad-foe" aria-hidden="true" />
      <div
        key={`foe-${run.index}`}
        className={`gb-foe ${fxKind === 'appear' ? 'gb-slide-in' : ''} ${fxKind === 'foeHit' ? 'gb-blink' : ''} ${fxKind === 'foeAttack' ? 'gb-lunge' : ''} ${fainted ? 'gb-faint' : ''} ${sm.m === 'announce' && beatN % 2 === 0 ? 'gb-bop' : ''}`}
        aria-hidden="true"
      >
        <PredatorSprite kind={p.kind} />
      </div>
      <section className="gb-box gb-box-foe" aria-label={`${p.name}, level ${p.level + START_LEVEL - 1}`}>
        <div className="gb-row"><span>{foe}</span><span>Lv{p.level + START_LEVEL - 1}</span></div>
        <Hp hp={view.foeHp} max={p.maxHp} label={`${p.name} health`} />
      </section>
      {pack && <div className="gb-packline" aria-label={`Pack ${pack.code}, ${ordinal(pack.attempt)} try`}>PACK {pack.code} · {ordinal(pack.attempt)} try{pack.stale ? ' · old list' : ''}</div>}
      <ul className="gb-tags" aria-label="Its rules">
        {p.rules.map((r) => (
          <li key={r.id} title={ruleHow(r, run.prev)} data-relaxed={rules.relaxed.includes(r) || undefined} data-broken={check?.broken === r || undefined}>{r.label}</li>
        ))}
        {p.reserve && <li className="gb-tag-q" title="A rule it brings out when it's hurt">?</li>}
      </ul>

      {/* The sheep from behind, and its box with HP and EXP. */}
      <div className="gb-pad gb-pad-me" aria-hidden="true" />
      <div className={`gb-me ${fxKind === 'go' ? 'gb-pop-in' : ''} ${fxKind === 'meHit' ? 'gb-blink' : ''} ${fxKind === 'meAttack' ? 'gb-nudge' : ''}`} aria-hidden="true">
        <SheepBackSprite frozen={frozen} />
        {frozen && <div className="gb-ice" />}
      </div>
      <section className="gb-box gb-box-me" aria-label="You">
        <div className="gb-row"><span>{me}</span><span>Lv{view.level}</span></div>
        <Hp hp={view.meHp} max={view.meMax} label="Your health" />
        <div className="gb-hpnum">{view.meHp}/ {view.meMax}</div>
        <div className="gb-exp"><span>EXP</span><div><i style={{ width: `${view.exp * 100}%` }} /></div></div>
      </section>

      {/* Strike effects. */}
      {fxKind === 'meAttack' && step?.text && <div key={fx!.key} className="gb-word" aria-hidden="true">{typedWord(step.text)}</div>}
      {fxKind === 'foeAttack' && <div key={fx!.key} className="gb-claw" aria-hidden="true" />}
      {fxKind === 'heal' && <div key={fx!.key} className="gb-sparkle" aria-hidden="true" />}
      {run.peppered && choosing && <div className="gb-pepper" aria-hidden="true"><FlameIcon size={10} /></div>}

      {/* The predator's song: the stage darkens, arrows light on the beat, each rule pops up as a sign that teaches. */}
      {sm.m === 'announce' && (
        <div className="gb-announce" aria-hidden="true">
          <div className="gb-arrows">{ARROWS.map((a, i) => <span key={a} data-lit={beatN % 4 === i || undefined}>{a}</span>)}</div>
          <div className="gb-signs" data-count={sm.rules.length + (sm.mystery ? 1 : 0)}>
            {sm.rules.map((r, i) => (
              <div key={r.id} className="gb-sign" style={{ animationDelay: `${signDelay(i)}ms` }}>
                <RuleCardView card={{ id: r.id, label: r.label, how: ruleHow(r, run.prev), example: p.examples[r.id] ?? null }} title={sm.enraged ? 'NEW RULE!' : 'RULE'} />
              </div>
            ))}
            {sm.mystery && (
              <div className="gb-sign" style={{ animationDelay: `${signDelay(sm.rules.length)}ms` }}>
                <RuleCardView card={{ id: '?', label: '?', how: '', example: null, hidden: true }} title="SECRET RULE" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* RULES: one card per rule in force; the clock keeps running. */}
      {sm.m === 'rules' && (
        <div className="gb-rulecards" role="dialog" aria-label={`${p.name}'s rules`}>
          {cards.map((c) => <RuleCardView key={c.id} card={c} />)}
        </div>
      )}

      {sm.m === 'walk' && <div className="gb-ask">The {foe} is down. Walk home with the flock, or hunt on?</div>}
      {mode.m === 'leave' && <div className="gb-ask">Leave the hunt? This run ends.</div>}

      {sm.m === 'death' && ending && (
        <DeathPanel cause={causeLine(ending)} help={helpLine(ending, dict)} cursor={pick} onPick={deathPick} onHover={setPick} />
      )}
      {sm.m === 'results' && pack && (
        <ResultsCard
          defeated={run.defeated} damage={run.damage} marks={run.marks} best={run.best} code={pack.code} attempt={pack.attempt} stale={pack.stale}
          reached={p.kind} beaten={!!run.walkedHome} frozen={!run.walkedHome} walked={!!run.walkedHome} record={!!record?.isNew}
        />
      )}

      {/* The text box, and the menu, move or bag panel beside it. */}
      <div className="gb-bottom">
        {mode.m === 'leave' ? (
          <GbButtons label="Leave?" items={['LEAVE', 'STAY']} cursor={pick} onPick={leavePick} onHover={setPick} className="gb-panel gb-buttons-bar" />
        ) : sm.m === 'walk' ? (
          <GbButtons label="Walk home?" items={['WALK HOME', 'HUNT ON']} cursor={pick} onPick={walkPick} onHover={setPick} className="gb-panel gb-buttons-bar" />
        ) : sm.m === 'results' ? (
          <GbButtons label="What next?" items={resultItems.map((t) => (t === 'SHARE' && copied ? 'COPIED!' : t))} cursor={pick} onPick={resultsPick} onHover={setPick} className="gb-panel gb-buttons-bar" />
        ) : sm.m === 'fight' ? (
          <>
            <div className="gb-panel gb-moves" onClick={() => ghost.current?.focus()}>
              <div className="gb-typed">
                <span className="gb-arrow">▶</span>{typed ? typed.toUpperCase() : <span className="gb-placeholder">{hint ? hint.toUpperCase() : chain ? `${chain}...` : 'TYPE A WORD'}</span>}<span className="gb-caret" />
              </div>
              <div className="gb-note" data-bad={noteBad || undefined}>{liveNote ?? defaultNote}</div>
              <input
                ref={ghost} className="gb-ghost" value={typed} aria-label="Your word" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={20}
                onChange={(e) => { setTyped(e.target.value.replace(/[^a-zA-Z]/g, '')); setNote(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitWord(); } else if (e.key === 'Escape') { e.preventDefault(); setMode({ m: 'menu' }); } e.stopPropagation(); }}
              />
            </div>
            <div className="gb-panel gb-info">
              <div className="gb-row"><span>TIME</span><span>{Math.ceil(left / 1000)}</span></div>
              <div className="gb-row"><span>START</span><span>{chain ?? 'ANY'}</span></div>
              <button className="gb-mini" onClick={() => setMode({ m: 'menu' })}>BACK</button>
            </div>
          </>
        ) : (
          <>
            <div className={`gb-text ${sm.m === 'menu' || sm.m === 'bag' || sm.m === 'rules' ? 'gb-text-half' : ''}`} onClick={() => { if (sm.m === 'steps') setMode({ ...sm, at: sm.at + 1 }); }}>
              <Typewriter key={message} text={message} />
            </div>
            {sm.m === 'menu' && (
              <div className="gb-panel gb-menu" role="menu" aria-label="What will you do?">
                {['FIGHT', 'BAG', 'RULES', 'RUN'].map((label, i) => (
                  <button key={label} role="menuitem" data-on={cursor === i || undefined} onClick={() => choose(i)} onPointerEnter={() => setCursor(i)}>{label}</button>
                ))}
              </div>
            )}
            {sm.m === 'rules' && (
              <div className="gb-panel gb-menu" role="menu" aria-label="Rules"><button role="menuitem" data-on onClick={() => setMode({ m: 'menu' })}>BACK</button></div>
            )}
            {sm.m === 'bag' && (
              <div className="gb-panel gb-bag" role="menu" aria-label="Bag">
                {ITEM_IDS.map((id, i) => (
                  <button key={id} role="menuitem" data-on={bagCursor === i || undefined} disabled={run.items[id] <= 0} onClick={() => pickItem(id)} onPointerEnter={() => setBagCursor(i)}>
                    <span>{ITEMS[id].name.toUpperCase()}</span><span>×{run.items[id]}</span>
                  </button>
                ))}
                <button role="menuitem" data-on={bagCursor === ITEM_IDS.length || undefined} onClick={() => setMode({ m: 'menu' })} onPointerEnter={() => setBagCursor(ITEM_IDS.length)}>CANCEL</button>
              </div>
            )}
          </>
        )}
        {choosing && <div className="gb-clock" aria-hidden="true"><i style={{ width: `${(left / total) * 100}%` }} data-low={left < 4000 || undefined} /></div>}
      </div>
    </>,
  );
}

/** The death screen's first line: what got you, plainly (plan v7 Part 5.3). */
function causeLine(e: Ending): string {
  const foe = e.before.predator.name.toUpperCase();
  if (e.outcome.kind === 'timeout') return `The clock. ${turnSeconds(e.before.index)} seconds wasn't enough for the ${foe}'s rules.`;
  if (e.outcome.kind === 'broke') return `A broken rule: ${e.outcome.rule.label}. You typed ${e.word.toUpperCase()}.`;
  const had = e.outcome.kind === 'item' ? e.before.hp + e.outcome.heal : e.before.hp;
  const counter = e.outcome.kind === 'hit' || e.outcome.kind === 'item' ? e.outcome.counter : 0;
  return `The ${foe}'s ${WEAPON[e.before.predator.kind]}. It hit for ${counter} and you had ${had}.`;
}

/** The second line: a word that would have worked, or the milk left in the bag; null when neither applies. */
function helpLine(e: Ending, dict: NonNullable<ReturnType<typeof useStore.getState>['dict']>): string | null {
  const { word, itemHelp } = lastWords(e.before, dict);
  if (e.cause === 'hits') return itemHelp && e.after.items.milk > 0 ? 'A Warm Milk was still in the bag.' : null;
  return word ? `${word.toUpperCase()} would have done.` : null;
}

function lastText(mode: Mode): string {
  if (mode.m !== 'steps') return '';
  for (let i = Math.min(mode.at, mode.steps.length - 1); i >= 0; i--) if (mode.steps[i].text) return mode.steps[i].text!;
  return '';
}
function typedWord(text: string): string {
  const m = /used (.+)!$/.exec(text);
  return m ? m[1] : '';
}

function Hp({ hp, max, label }: { hp: number; max: number; label: string }) {
  const f = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  return (
    <div className="gb-hp" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span>HP</span>
      <div><i data-level={f > 0.5 ? 'ok' : f > 0.2 ? 'warn' : 'low'} style={{ width: `${f * 100}%` }} /></div>
    </div>
  );
}

/** Text that types itself out, like a handheld text box. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((k) => k + 1), 16);
    return () => clearTimeout(id);
  }, [n, text]);
  return (
    <p className="gb-line" aria-live="polite">
      <span>{text.slice(0, n)}</span><span className="gb-rest" aria-hidden="true">{text.slice(n)}</span>
    </p>
  );
}
