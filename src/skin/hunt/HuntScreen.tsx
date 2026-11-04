import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { playSound, playTick } from '../../audio/sound';
import { utcDateKey } from '../../engine';
import { getHuntStreak, huntShareText, markHuntStarted, recordHunt } from '../../hunt/daily';
import { activeRules, attack, dailySeed, HEAL_ON_WIN, nextPredator, startRun, timeOut, turnSeconds } from '../../hunt/hunt';
import type { Outcome, Run } from '../../hunt/hunt';
import type { Rule } from '../../hunt/rules';
import { useStore } from '../../state/store';
import { useMotionLevel } from '../hooks/useAmbient';
import { PredatorSprite, SheepBackSprite } from './sprites';
import { useHuntUi } from './huntStore';
import './hunt.css';

/**
 * The Daily Hunt battle screen: a retro, turn-based fight in the snow. The predator stands top right, the sheep bottom
 * left, each with a status box, and a dialog box runs along the bottom. Each stage below is timed; the run itself
 * lives in src/hunt (pure), and this screen only plays it out.
 */
type Stage =
  | { s: 'intro' }
  | { s: 'announce'; rules: Rule[]; enraged: boolean }
  | { s: 'player' }
  | { s: 'hit'; out: Extract<Outcome, { kind: 'hit' }> }
  | { s: 'miss'; out: Extract<Outcome, { kind: 'broke' | 'timeout' }> }
  | { s: 'counter'; amount: number; then: 'announce' | 'player' | 'dead'; enraged: Rule | null }
  | { s: 'faint' }
  | { s: 'win' }
  | { s: 'dead' }
  | { s: 'results' };

const BEAT = 480; // ms: the predators' song is about 125 bpm
const ARROWS = ['←', '↓', '↑', '→'];

export function HuntScreen() {
  const dict = useStore((s) => s.dict);
  const practice = useHuntUi((s) => s.practice);
  const close = useHuntUi((s) => s.close);
  const openHunt = useHuntUi((s) => s.openHunt);
  const reduced = useMotionLevel() === 'reduced';
  const today = utcDateKey(new Date());
  const [run, setRun] = useState<Run | null>(null);
  const [stage, setStage] = useState<Stage>({ s: 'intro' });
  const [typed, setTyped] = useState('');
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState('');
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [beat, setBeat] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const speed = reduced ? 0.4 : 1;

  // Start the run once the word list is ready. The daily run counts as the day's attempt as soon as it starts.
  useEffect(() => {
    if (!dict || run) return;
    const seed = practice ? `practice:${Date.now()}` : dailySeed(today);
    if (!practice) markHuntStarted(today);
    setRun(startRun(dict, seed));
    setStage({ s: 'intro' });
  }, [dict, run, practice, today]);

  // Timed stages advance on their own.
  useEffect(() => {
    if (!run || !dict) return;
    const after = (ms: number, f: () => void) => { const id = setTimeout(f, ms * speed); return () => clearTimeout(id); };
    switch (stage.s) {
      case 'intro':
        return after(1900, () => setStage({ s: 'announce', rules: run.predator.rules, enraged: false }));
      case 'announce':
        return after(BEAT * (2 + stage.rules.length * 3), () => setStage({ s: 'player' }));
      case 'hit': {
        const o = stage.out;
        return after(1100, () => {
          if (o.defeated) setStage({ s: 'faint' });
          else setStage({ s: 'counter', amount: o.counter, then: o.dead ? 'dead' : o.enraged ? 'announce' : 'player', enraged: o.enraged });
        });
      }
      case 'miss':
        return after(1300, () => setStage({ s: 'counter', amount: stage.out.counter, then: stage.out.dead ? 'dead' : 'player', enraged: null }));
      case 'counter':
        return after(1000, () => {
          if (stage.then === 'dead') setStage({ s: 'dead' });
          else if (stage.then === 'announce' && stage.enraged) setStage({ s: 'announce', rules: [stage.enraged], enraged: true });
          else setStage({ s: 'player' });
        });
      case 'faint':
        return after(1300, () => { playSound('bank'); setStage({ s: 'win' }); });
      case 'win':
        return after(1700, () => { setRun((r) => (r ? nextPredator(r, dict) : r)); setStage({ s: 'intro' }); });
      case 'dead':
        return after(2600, () => setStage({ s: 'results' }));
    }
  }, [stage, run, dict, speed]);

  // The beat: the predator bops and the arrows light while it announces its rules (and, softly, all the time).
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setBeat((b) => b + 1), BEAT);
    return () => clearInterval(id);
  }, [reduced]);
  useEffect(() => { if (stage.s === 'announce' && beat % 3 === 2) playTick(0.2 + (beat % 4) * 0.1); }, [beat, stage.s]);

  // The sheep's turn: a clock, and focus on the input.
  useEffect(() => {
    if (stage.s !== 'player' || !run) return;
    setEndsAt(performance.now() + turnSeconds(run.index) * 1000);
    setTyped('');
    setNote('');
    inputRef.current?.focus();
  }, [stage.s, run?.index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stage.s !== 'player') return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage.s]);
  useEffect(() => {
    if (stage.s !== 'player' || !run || !endsAt || now < endsAt) return;
    const { run: next, outcome } = timeOut(run);
    if (outcome.kind !== 'timeout') return;
    setRun(next);
    playSound('fail');
    setStage({ s: 'miss', out: outcome });
  }, [now, endsAt, stage.s, run]);

  // The run is over: save it (once) and work out the streak.
  useEffect(() => {
    if (stage.s !== 'dead' || !run) return;
    playSound('roundEnd');
    if (practice) return;
    setStreak(recordHunt({ date: today, status: 'done', defeated: run.defeated, damage: run.damage, marks: run.marks, best: run.best }));
  }, [stage.s]); // eslint-disable-line react-hooks/exhaustive-deps

  const rules = useMemo(() => (run && dict ? activeRules(run, dict) : { rules: [], relaxed: [] }), [run, dict]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!run || !dict || stage.s !== 'player' || !typed.trim()) return;
    const { run: next, outcome } = attack(run, dict, typed);
    if (outcome.kind === 'invalid') {
      setShake((k) => k + 1);
      setNote(outcome.reason === 'notWord' ? 'Not in the word list.' : outcome.reason === 'used' ? 'Already used this hunt.' : outcome.reason === 'short' ? 'At least 3 letters.' : 'Letters only.');
      return;
    }
    setRun(next);
    if (outcome.kind === 'hit') { playSound(outcome.crit ? 'steal' : 'play'); setStage({ s: 'hit', out: outcome }); }
    else if (outcome.kind === 'broke') { playSound('trap'); setStage({ s: 'miss', out: outcome }); }
  };

  const share = async () => {
    if (!run) return;
    const text = huntShareText({ date: today, defeated: run.defeated, damage: run.damage, marks: run.marks, streak: streak || getHuntStreak(today) });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!run || !dict) {
    return <div className="hunt-root grid place-items-center"><p className="hunt-box px-6 py-4">Loading the word list…</p></div>;
  }

  const p = run.predator;
  const left = Math.max(0, endsAt - now);
  const total = turnSeconds(run.index) * 1000;
  const predatorName = p.name.toUpperCase();
  const fainted = stage.s === 'faint' || stage.s === 'win';
  const frozen = stage.s === 'dead' || stage.s === 'results';
  const message = dialogText(stage, run, predatorName);
  // The run already holds the counter-attack's damage; the bar only drops when the predator actually strikes.
  const shownHp = stage.s === 'hit' || stage.s === 'miss' ? run.hp + stage.out.counter : run.hp;

  return (
    <main className={`hunt-root ${stage.s === 'counter' && !reduced ? 'hunt-quake' : ''}`} data-stage={stage.s} aria-label="Daily Hunt">
      <div className="hunt-snow" aria-hidden="true" />
      <div className="hunt-hills" aria-hidden="true" />

      {/* Predator: status box top left, sprite on its snowy rise top right. */}
      <section className="hunt-status hunt-status-foe hunt-box" aria-label={`${p.name}, level ${p.level}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="hunt-name">{predatorName}{p.boss && <span className="hunt-boss">BOSS</span>}</span>
          <span className="hunt-level">Lv{p.level}</span>
        </div>
        <HpBar hp={p.hp} max={p.maxHp} label="Predator health" />
        <ul className="hunt-rules" aria-label="Its rules">
          {p.rules.map((r) => <li key={r.id} className={rules.relaxed.includes(r) ? 'hunt-rule-relaxed' : ''}>{r.label}</li>)}
        </ul>
      </section>
      <div className="hunt-rise hunt-rise-foe" aria-hidden="true" />
      <div
        className={`hunt-foe ${stage.s === 'intro' ? 'hunt-enter' : ''} ${stage.s === 'hit' ? 'hunt-hurt' : ''} ${stage.s === 'counter' ? 'hunt-lunge' : ''} ${fainted ? 'hunt-faint' : ''} ${!reduced && beat % 2 === 0 && !fainted ? 'hunt-bop' : ''}`}
        aria-hidden="true"
      >
        <PredatorSprite kind={p.kind} size={192} />
      </div>

      {/* Sheep: sprite bottom left, status box beside it. */}
      <div className="hunt-rise hunt-rise-sheep" aria-hidden="true" />
      <div className={`hunt-sheep ${stage.s === 'counter' ? 'hunt-hurt' : ''} ${stage.s === 'hit' && !reduced ? 'hunt-attack' : ''}`} aria-hidden="true">
        <SheepBackSprite size={192} frozen={frozen} />
        {frozen && <div className="hunt-iceblock" />}
      </div>
      <section className="hunt-status hunt-status-sheep hunt-box" aria-label="You">
        <div className="flex items-baseline justify-between gap-3">
          <span className="hunt-name">YOU</span>
          <span className="hunt-level">{run.defeated} beaten</span>
        </div>
        <HpBar hp={shownHp} max={run.maxHp} label="Your health" />
        <div className="hunt-hpnum">{shownHp} / {run.maxHp}</div>
      </section>

      {/* Damage and strike effects. */}
      {stage.s === 'hit' && (
        <>
          <div className="hunt-flyword" aria-hidden="true">{stage.out.word.toUpperCase()}</div>
          <div className={`hunt-pop hunt-pop-foe ${stage.out.crit ? 'hunt-pop-crit' : ''}`} aria-hidden="true">-{stage.out.damage}{stage.out.crit && <small>CRIT!</small>}</div>
        </>
      )}
      {stage.s === 'counter' && (
        <>
          <div className="hunt-slash" aria-hidden="true" />
          <div className="hunt-pop hunt-pop-sheep" aria-hidden="true">-{stage.amount}</div>
        </>
      )}
      {stage.s === 'win' && <div className="hunt-pop hunt-pop-heal" aria-hidden="true">+{HEAL_ON_WIN} HP</div>}

      {/* The predator's announcement: the stage darkens, it bops to the beat, and each rule card slams in on the down beat. */}
      {stage.s === 'announce' && (
        <div className="hunt-announce" aria-live="polite">
          <div className="hunt-arrows" aria-hidden="true">
            {ARROWS.map((a, i) => <span key={a} className={beat % 4 === i ? 'hunt-arrow-lit' : ''}>{a}</span>)}
          </div>
          <div className="hunt-cards">
            {stage.rules.map((r, i) => (
              <div key={r.id} className="hunt-card" style={{ animationDelay: `${(BEAT * (2 + i * 3) * speed) | 0}ms` }}>
                <span className="hunt-card-tag">{stage.enraged ? 'NEW RULE' : 'RULE'}</span>
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The dialog box: the story line, or the sheep's input during its turn. */}
      <section className="hunt-dialog hunt-box">
        {stage.s === 'player' ? (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <div className="hunt-timer" aria-hidden="true"><div style={{ width: `${(left / total) * 100}%` }} data-low={left < 4000 || undefined} /></div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="hunt-word">Your word</label>
              <input
                id="hunt-word" key={shake} ref={inputRef} value={typed} onChange={(e) => { setTyped(e.target.value.replace(/[^a-zA-Z]/g, '')); setNote(''); }}
                className={`hunt-input ${shake ? 'hunt-shake' : ''}`} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={24}
                placeholder={rules.rules.find((r) => r.id === 'chain') && run.prev ? `Starts with ${run.prev.at(-1)!.toUpperCase()}…` : 'Type a word to attack'}
              />
              <button type="submit" className="hunt-attack-btn" disabled={!typed.trim()}>Attack!</button>
            </div>
            <p className="hunt-note" role="status">
              {note || (rules.relaxed.length ? `${p.name} lets "${rules.relaxed.map((r) => r.label).join('", "')}" slide this turn.` : `${Math.ceil(left / 1000)}s · obey: ${rules.rules.map((r) => r.label).join(' · ') || 'anything goes'}`)}
            </p>
          </form>
        ) : stage.s === 'results' ? (
          <Results run={run} practice={practice} streak={streak} copied={copied} onShare={share} onPractice={() => { setRun(null); openHunt(true); }} onClose={close} />
        ) : (
          <Typewriter key={message} text={message} />
        )}
      </section>

      {stage.s !== 'results' && <button className="hunt-quit" onClick={close} aria-label="Leave the hunt">✕</button>}
    </main>
  );
}

function dialogText(stage: Stage, run: Run, name: string): string {
  const p = run.predator;
  switch (stage.s) {
    case 'intro': return p.boss ? `The ${name} steps out of the storm! It wants your wool.` : `A wild ${name} blocks the path!`;
    case 'announce': return `${name}: "${stage.rules.map((r) => r.line).join(' ')}"`;
    case 'hit': return stage.out.crit ? `A rare word! "${stage.out.word.toUpperCase()}" lands a critical hit!` : `"${stage.out.word.toUpperCase()}" hits for ${stage.out.damage}!`;
    case 'miss': return stage.out.kind === 'timeout' ? `Too slow! ${name} pounces!` : `${name}: "That breaks my rule: ${stage.out.rule.label}!"`;
    case 'counter': return `${name} strikes back for ${stage.amount}!`;
    case 'faint': return `${name} is beaten!`;
    case 'win': return `${name} runs off into the snow. You catch your breath: +${HEAL_ON_WIN} HP.`;
    case 'dead': return `The cold gets in... You froze after beating ${run.defeated} predator${run.defeated === 1 ? '' : 's'}.`;
    default: return '';
  }
}

function HpBar({ hp, max, label }: { hp: number; max: number; label: string }) {
  const f = Math.max(0, hp / max);
  return (
    <div className="hunt-hp" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}>
      <span className="hunt-hp-tag">HP</span>
      <div className="hunt-hp-track"><div className="hunt-hp-fill" data-level={f > 0.5 ? 'ok' : f > 0.2 ? 'warn' : 'low'} style={{ width: `${f * 100}%` }} /></div>
    </div>
  );
}

/** Retro dialog text that types itself out; a click shows it all at once. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((k) => k + 1), 18);
    return () => clearTimeout(id);
  }, [n, text]);
  return (
    <p className="hunt-line" onClick={() => setN(text.length)} aria-live="polite">
      <span>{text.slice(0, n)}</span><span className="hunt-line-rest" aria-hidden="true">{text.slice(n)}</span>
      {n >= text.length && <span className="hunt-caret" aria-hidden="true">▼</span>}
    </p>
  );
}

function Results({ run, practice, streak, copied, onShare, onPractice, onClose }: {
  run: Run; practice: boolean; streak: number; copied: boolean; onShare: () => void; onPractice: () => void; onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-2" role="dialog" aria-label="Hunt over">
      <h2 className="hunt-title">{practice ? 'Practice hunt over' : 'Daily Hunt over'}</h2>
      <dl className="hunt-stats">
        <div><dt>Predators beaten</dt><dd>{run.defeated}</dd></div>
        <div><dt>Damage</dt><dd>{run.damage}</dd></div>
        <div><dt>Words</dt><dd>{run.used.length}</dd></div>
        {run.best && <div><dt>Best word</dt><dd>{run.best.word.toUpperCase()} ({run.best.damage})</dd></div>}
        {!practice && streak > 0 && <div><dt>Streak</dt><dd>{streak} day{streak === 1 ? '' : 's'}</dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2">
        {!practice && <button className="hunt-attack-btn" onClick={onShare}>{copied ? 'Copied!' : 'Share'}</button>}
        <button className="hunt-btn" onClick={onPractice}>Practice hunt</button>
        <button className="hunt-btn" onClick={onClose}>Back to the farm</button>
      </div>
      {!practice && <p className="hunt-note">A new hunt opens tomorrow. Practice hunts don't count.</p>}
    </div>
  );
}
