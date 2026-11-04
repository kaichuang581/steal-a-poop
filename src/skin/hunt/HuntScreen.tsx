import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { utcDateKey } from '../../engine';
import { checkNickname } from '../../lib/nickname';
import { getHuntStreak, huntShareText, markHuntStarted, recordHunt } from '../../hunt/daily';
import { activeRules, applyItem, attack, dailySeed, HEAL_ON_WIN, HP_PER_LEVEL, ITEMS, MOVES, nextPredator, START_LEVEL, startRun, timeOut, turnSeconds } from '../../hunt/hunt';
import type { ItemId, Outcome, Run } from '../../hunt/hunt';
import type { Rule } from '../../hunt/rules';
import { useStore } from '../../state/store';
import { useMotionLevel } from '../hooks/useAmbient';
import { useHuntUi } from './huntStore';
import { PredatorSprite, SheepBackSprite } from './sprites';
import './hunt.css';

/**
 * The Daily Hunt, played like a handheld monster battle: a fixed 240 x 160 screen scaled up with crisp pixels, the
 * wild predator top right with its name box, the sheep from behind bottom left with its HP and EXP, and a text box
 * along the bottom with FIGHT / BAG / RULES / RUN. Every action plays out as a queue of typed messages and effects.
 * The run itself lives in src/hunt (pure and seeded); this screen only plays it out.
 */
const W = 240, H = 160;
const BEAT = 480;
const ARROWS = ['←', '↓', '↑', '→'];
const ITEM_IDS: ItemId[] = ['milk', 'bell', 'pepper'];
type Fx = 'meAttack' | 'foeHit' | 'foeAttack' | 'meHit' | 'foeFaint' | 'freeze' | 'heal' | 'appear' | 'go';
interface Step { text?: string; fx?: Fx; foeHp?: number; meHp?: number; meMax?: number; level?: number; exp?: number; ms?: number }
type After = 'menu' | 'announce' | 'next' | 'results';
type Mode =
  /** `resume`: back to the menu without a new turn (reading the rules, trying to run). */
  | { m: 'steps'; steps: Step[]; at: number; after: After; enraged?: Rule; resume?: boolean }
  | { m: 'announce'; rules: Rule[]; enraged: boolean }
  | { m: 'menu' }
  | { m: 'fight' }
  | { m: 'bag' }
  | { m: 'results' };

export function HuntScreen() {
  const dict = useStore((s) => s.dict);
  const nickname = useStore((s) => s.settings.name);
  const practice = useHuntUi((s) => s.practice);
  const close = useHuntUi((s) => s.close);
  const openHunt = useHuntUi((s) => s.openHunt);
  const reduced = useMotionLevel() === 'reduced';
  const today = utcDateKey(new Date());
  const me = (checkNickname(nickname).ok && nickname.trim() ? nickname.trim() : 'Lamb').toUpperCase().slice(0, 10);

  const [run, setRun] = useState<Run | null>(null);
  const [mode, setMode] = useState<Mode>({ m: 'menu' });
  // What the boxes show; steps move these, so a bar drains when the strike lands rather than when it is decided.
  const [view, setView] = useState({ foeHp: 0, meHp: 0, meMax: 0, level: START_LEVEL, exp: 0 });
  const [fx, setFx] = useState<{ kind: Fx; key: number } | null>(null);
  const [cursor, setCursor] = useState(0);
  const [bagCursor, setBagCursor] = useState(0);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [turnEnds, setTurnEnds] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [beat, setBeat] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(2);
  const ghost = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const speed = reduced ? 0.5 : 1;

  // Scale the 240 x 160 screen to fit, in half steps so the pixels stay as even as possible.
  useLayoutEffect(() => {
    const fit = () => setScale(Math.max(1, Math.floor(Math.min(window.innerWidth / W, (window.innerHeight * 0.86) / H) * 2) / 2));
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

  // Start the run once the word list is ready. The daily hunt counts as the day's attempt as soon as it starts.
  useEffect(() => {
    if (!dict || run) return;
    const seed = practice ? `practice:${Date.now()}` : dailySeed(today);
    if (!practice) markHuntStarted(today);
    const r = startRun(dict, seed);
    setRun(r);
    sync(r);
    setMode(appearSteps(r, true));
  }, [dict, run, practice, today, sync]); // eslint-disable-line react-hooks/exhaustive-deps

  // The turn clock runs while the sheep chooses (menu, fight, bag). Running out lets the predator strike.
  function startTurn() {
    setTurnEnds(performance.now() + (run ? turnSeconds(run.index) : 20) * 1000);
    setTyped('');
    setNote('');
    setCursor(0);
  }

  // Play the step queue: apply each step's effect and bar values, wait, move on.
  useEffect(() => {
    if (mode.m !== 'steps' || !run || !dict) return;
    const step = mode.steps[mode.at];
    if (!step) {
      if (mode.after === 'menu') { if (!mode.resume) startTurn(); setMode({ m: 'menu' }); }
      else if (mode.after === 'announce') setMode({ m: 'announce', rules: mode.enraged ? [mode.enraged] : run.predator.rules, enraged: !!mode.enraged });
      else if (mode.after === 'results') setMode({ m: 'results' });
      else {
        const next = nextPredator(run, dict);
        setRun(next);
        sync(next);
        setMode(appearSteps(next, false));
      }
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
      else if (step.fx === 'heal') playSound('steal');
    }
    const ms = (step.ms ?? (step.text ? 1250 + step.text.length * 18 : 750)) * speed;
    const id = setTimeout(() => setMode({ ...mode, at: mode.at + 1 }), ms);
    return () => clearTimeout(id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // The announcement: the predator bops to the beat and names its rules, one sign per rule, then the turn begins.
  useEffect(() => {
    if (mode.m !== 'announce') return;
    const id = setTimeout(() => { startTurn(); setMode({ m: 'menu' }); }, BEAT * (2 + mode.rules.length * 3) * speed);
    return () => clearTimeout(id);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setBeat((b) => b + 1), BEAT);
    return () => clearInterval(id);
  }, [reduced]);
  useEffect(() => { if (mode.m === 'announce' && beat % 3 === 2) playTick(0.2 + (beat % 4) * 0.1); }, [beat, mode.m]);

  const choosing = mode.m === 'menu' || mode.m === 'fight' || mode.m === 'bag';
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

  // The run is over: save it once.
  useEffect(() => {
    if (mode.m !== 'results' || !run || practice) return;
    setStreak(recordHunt({ date: today, status: 'done', defeated: run.defeated, damage: run.damage, marks: run.marks, best: run.best }));
  }, [mode.m]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus: the hidden input while typing a word, otherwise the screen itself for the arrow keys.
  useEffect(() => {
    if (mode.m === 'fight') ghost.current?.focus();
    else if (mode.m !== 'results') rootRef.current?.focus({ preventScroll: true });
  }, [mode.m]);

  const rules = useMemo(() => (run && dict ? activeRules(run, dict) : { rules: [], relaxed: [] }), [run, dict]);

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
      steps.push({ text: `${me} used ${word.toUpperCase()}!`, fx: 'meAttack', ms: 1100 });
      steps.push({ fx: 'foeHit', foeHp: outcome.predatorHp, exp: 1 - outcome.predatorHp / run.predator.maxHp, ms: 900 });
      if (run.peppered) steps.push({ text: 'The pepper burns! Double damage!' });
      if (outcome.crit) steps.push({ text: 'A critical hit! What a rare word!' });
      if (outcome.defeated) {
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
    if (next.over) after = 'results';
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
    if (i === 2) {
      const foe = run.predator.name.toUpperCase();
      const list = rules.rules.map((r) => r.label).join(', ') || 'none';
      const steps: Step[] = [{ text: `${foe}'s rules: ${list}.` }];
      if (rules.relaxed.length) steps.push({ text: `It lets "${rules.relaxed.map((r) => r.label).join('", "')}" slide this turn.` });
      setMode({ m: 'steps', steps, at: 0, after: 'menu', resume: true });
      return;
    }
    setMode({ m: 'steps', steps: [{ text: "There's no running from a predator!" }], at: 0, after: 'menu', resume: true });
  };

  const pickItem = (id: ItemId) => {
    if (!run || !dict) return;
    const out = applyItem(run, dict, id);
    if (out) resolve(out.run, out.outcome, '');
  };

  const onKey = (e: ReactKeyboardEvent) => {
    const k = e.key;
    const ok = k === 'Enter' || k === ' ' || k === 'z' || k === 'Z';
    const back = k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace';
    if (mode.m === 'menu') {
      if (k === 'ArrowRight' || k === 'ArrowLeft') setCursor((c) => c ^ 1);
      else if (k === 'ArrowDown' || k === 'ArrowUp') setCursor((c) => c ^ 2);
      else if (ok) choose(cursor);
      else return;
      playTick(0.1);
    } else if (mode.m === 'bag') {
      if (k === 'ArrowDown') setBagCursor((c) => Math.min(ITEM_IDS.length, c + 1));
      else if (k === 'ArrowUp') setBagCursor((c) => Math.max(0, c - 1));
      else if (ok) { if (bagCursor === ITEM_IDS.length) setMode({ m: 'menu' }); else pickItem(ITEM_IDS[bagCursor]); }
      else if (back) setMode({ m: 'menu' });
      else return;
      playTick(0.1);
    } else if (mode.m === 'steps' && ok) {
      // Skip ahead, like pressing A on a message.
      setMode({ ...mode, at: mode.at + 1 });
    } else return;
    e.preventDefault();
  };

  const share = async () => {
    if (!run) return;
    const text = huntShareText({ date: today, defeated: run.defeated, damage: run.damage, marks: run.marks, streak: streak || getHuntStreak(today) });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!run || !dict) {
    return <main className="gb-root"><p className="gb-loading">Loading the word list…</p></main>;
  }

  const p = run.predator;
  const foe = p.name.toUpperCase();
  const left = Math.max(0, turnEnds - now);
  const total = turnSeconds(run.index) * 1000;
  const step = mode.m === 'steps' ? mode.steps[mode.at] : null;
  const fxKind = mode.m === 'steps' ? fx?.kind : undefined;
  const frozen = mode.m === 'results' || fxKind === 'freeze' || (mode.m === 'steps' && mode.after === 'results' && mode.steps.slice(0, mode.at + 1).some((s) => s.fx === 'freeze'));
  const fainted = mode.m === 'steps' && mode.after === 'next' && mode.steps.slice(0, mode.at + 1).some((s) => s.fx === 'foeFaint');
  const message =
    mode.m === 'menu' ? `What will\n${me} do?` :
    mode.m === 'announce' ? `${foe}: "${mode.rules.map((r) => r.line).join(' ')}"` :
    mode.m === 'bag' ? (bagCursor < ITEM_IDS.length ? ITEMS[ITEM_IDS[bagCursor]].about : 'Close the bag.') :
    step?.text ?? lastText(mode);
  const chain = rules.rules.some((r) => r.id === 'chain') && run.prev ? run.prev.at(-1)!.toUpperCase() : null;

  return (
    <main ref={rootRef} className="gb-root" tabIndex={-1} onKeyDown={onKey} aria-label="Daily Hunt" data-mode={mode.m}>
      <div className="gb-frame" style={{ width: W * scale, height: H * scale }}>
        <div className={`gb-screen ${fxKind === 'meHit' && !reduced ? 'gb-quake' : ''}`} style={{ transform: `scale(${scale})` }}>
          <div className="gb-sky" aria-hidden="true" />
          <div className="gb-flakes" aria-hidden="true" />

          {/* The wild predator and its name box. */}
          <div className="gb-pad gb-pad-foe" aria-hidden="true" />
          <div
            key={`foe-${run.index}`}
            className={`gb-foe ${fxKind === 'appear' ? 'gb-slide-in' : ''} ${fxKind === 'foeHit' ? 'gb-blink' : ''} ${fxKind === 'foeAttack' ? 'gb-lunge' : ''} ${fainted ? 'gb-faint' : ''} ${mode.m === 'announce' && beat % 2 === 0 ? 'gb-bop' : ''}`}
            aria-hidden="true"
          >
            <PredatorSprite kind={p.kind} size={64} />
          </div>
          <section className="gb-box gb-box-foe" aria-label={`${p.name}, level ${p.level + START_LEVEL - 1}`}>
            <div className="gb-row"><span>{foe}</span><span>Lv{p.level + START_LEVEL - 1}</span></div>
            <Hp hp={view.foeHp} max={p.maxHp} label={`${p.name} health`} />
          </section>
          <ul className="gb-tags" aria-label="Its rules">
            {p.rules.map((r) => <li key={r.id} data-relaxed={rules.relaxed.includes(r) || undefined}>{r.label}</li>)}
          </ul>

          {/* The sheep from behind, and its box with HP and EXP. */}
          <div className="gb-pad gb-pad-me" aria-hidden="true" />
          <div className={`gb-me ${fxKind === 'go' ? 'gb-pop-in' : ''} ${fxKind === 'meHit' ? 'gb-blink' : ''} ${fxKind === 'meAttack' ? 'gb-nudge' : ''}`} aria-hidden="true">
            <SheepBackSprite size={64} frozen={frozen} />
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
          {run.peppered && choosing && <div className="gb-pepper" aria-hidden="true">🌶</div>}

          {/* The predator's song: the stage darkens, arrows light on the beat, each rule pops up as a sign. */}
          {mode.m === 'announce' && (
            <div className="gb-announce" aria-hidden="true">
              <div className="gb-arrows">{ARROWS.map((a, i) => <span key={a} data-lit={beat % 4 === i || undefined}>{a}</span>)}</div>
              <div className="gb-signs">
                {mode.rules.map((r, i) => (
                  <div key={r.id} className="gb-sign" style={{ animationDelay: `${(BEAT * (2 + i * 3) * speed) | 0}ms` }}>
                    <b>{mode.enraged ? 'NEW RULE!' : 'RULE'}</b>{r.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* The text box, and the menu, move or bag panel beside it. */}
          <div className="gb-bottom">
            {mode.m === 'fight' ? (
              <>
                <div className="gb-panel gb-moves" onClick={() => ghost.current?.focus()}>
                  <div className="gb-typed">
                    <span className="gb-arrow">▶</span>{typed ? typed.toUpperCase() : <span className="gb-placeholder">{hint ? hint.toUpperCase() : chain ? `${chain}...` : 'TYPE A WORD'}</span>}<span className="gb-caret" />
                  </div>
                  <div className="gb-note">{note || (rules.relaxed.length ? `${rules.relaxed[0].label}: let slide` : rules.rules.map((r) => r.label).join(' · ') || 'Anything goes!')}</div>
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
                <div className={`gb-text ${mode.m === 'menu' || mode.m === 'bag' ? 'gb-text-half' : ''}`} onClick={() => { if (mode.m === 'steps') setMode({ ...mode, at: mode.at + 1 }); }}>
                  <Typewriter key={message} text={message} />
                </div>
                {mode.m === 'menu' && (
                  <div className="gb-panel gb-menu" role="menu" aria-label="What will you do?">
                    {['FIGHT', 'BAG', 'RULES', 'RUN'].map((label, i) => (
                      <button key={label} role="menuitem" data-on={cursor === i || undefined} onClick={() => choose(i)} onPointerEnter={() => setCursor(i)}>{label}</button>
                    ))}
                  </div>
                )}
                {mode.m === 'bag' && (
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

          {mode.m === 'results' && (
            <Results run={run} practice={practice} streak={streak} copied={copied} onShare={share} onPractice={() => { setRun(null); openHunt(true); }} onClose={close} />
          )}
        </div>
      </div>
      <button className="gb-quit" onClick={close} aria-label="Leave the hunt">✕</button>
      <p className="gb-help" aria-hidden="true">Arrow keys move · Enter picks · Esc goes back · type your word in FIGHT</p>
    </main>
  );
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

function Results({ run, practice, streak, copied, onShare, onPractice, onClose }: {
  run: Run; practice: boolean; streak: number; copied: boolean; onShare: () => void; onPractice: () => void; onClose: () => void;
}) {
  return (
    <div className="gb-results" role="dialog" aria-label="Hunt over">
      <h2>{practice ? 'PRACTICE HUNT OVER' : 'DAILY HUNT OVER'}</h2>
      <dl>
        <div><dt>BEATEN</dt><dd>{run.defeated}</dd></div>
        <div><dt>DAMAGE</dt><dd>{run.damage}</dd></div>
        <div><dt>LEVEL</dt><dd>{run.level}</dd></div>
        <div><dt>WORDS</dt><dd>{run.used.length}</dd></div>
        {run.best && <div className="gb-wide"><dt>BEST WORD</dt><dd>{run.best.word.toUpperCase()} ({run.best.damage})</dd></div>}
        {!practice && streak > 0 && <div className="gb-wide"><dt>STREAK</dt><dd>{streak} DAY{streak === 1 ? '' : 'S'}</dd></div>}
      </dl>
      <div className="gb-actions">
        {!practice && <button onClick={onShare} autoFocus>{copied ? 'COPIED!' : 'SHARE'}</button>}
        <button onClick={onPractice} autoFocus={practice}>PRACTICE</button>
        <button onClick={onClose}>FARM</button>
      </div>
    </div>
  );
}
