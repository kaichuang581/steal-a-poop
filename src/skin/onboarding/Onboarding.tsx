import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { ApiError, describeAuthError, useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { countryOptions, guessCountry } from '../../auth/countries';
import { AGE_CHOICES, PARENT_AGREE, PARENT_DECLINE, PARENT_NOTICE, needsParent } from '../../lib/ageRules';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { useStore } from '../../state/store';
import { whenDoorsOpen } from '../components/BarnDoors';
import { Captcha, captchaAvailable } from '../../ui/auth/Captcha';
import { legalHref } from '../../ui/legal/legalLinks';
import { CloseIcon } from '../components/Icons';
import { Chip } from '../components/Materials';
import { SnowCap } from '../components/SnowCap';
import { ClothButton, WoodButton } from '../kit';
import { gateStep, loadAgeCheck, saveAgeCheck } from './gate';
import type { GateStep } from './gate';
import './onboarding.css';

/** The Log in button on Home opens the same form, as a dialog that can be closed. */
export const useSignInForm = create<{ open: boolean }>(() => ({ open: false }));
export const openSignInForm = () => useSignInForm.setState({ open: true });
const closeSignInForm = () => useSignInForm.setState({ open: false });

/** What the app shell mounts: the form while the player is not in yet, or while Log in has it open. */
export function OnboardingGate() {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const open = useSignInForm((s) => s.open);
  // The browser's answers are read again whenever the form reports it is done.
  const [checked, setChecked] = useState(0);
  const check = useMemo(() => loadAgeCheck(), [checked]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = gateStep(status, profile, check);
  // Signed in and set up: a Log in form that is still open has done its job.
  useEffect(() => { if (open && step === null && status === 'ready') closeSignInForm(); }, [open, step, status]);
  // On a first visit the card waits for the loading screen to lift, then eases in after Home's own entrance, instead of
  // sitting on top of the yarn (Brian, 2026-11-22: "the game pops outta nowhere").
  const [lifted, setLifted] = useState(false);
  useEffect(() => whenDoorsOpen(() => setLifted(true)), []);
  if (step === 'wait' || !lifted) return null; // a moment while the saved sign-in is checked; Home is behind
  if (step === null && !open) return null;
  return <Onboarding gate={step} blocking={step !== null} late={step !== null} onDone={() => { setChecked((n) => n + 1); closeSignInForm(); }} />;
}

type Way = 'choose' | 'guest' | 'email' | 'details' | 'parent' | 'declined';

/** Server answers that mean "something you typed needs changing": the form returns to the questions. */
const BACK_TO_DETAILS = new Set(['nickname_taken', 'bad_nickname', 'bad_age', 'bad_dob', 'bad_country', 'country_not_supported', 'captcha_failed']);
interface Answers { country: string; age: number | null; nickname: string }

function Onboarding({ gate, blocking, late = false, onDone }: { gate: GateStep | null; blocking: boolean; late?: boolean; onDone: () => void }) {
  const a = useAuth.getState();
  const status = useAuth((s) => s.status);
  const notice = useAuth((s) => s.notice);
  const localName = useStore((s) => s.settings.name);
  const remembered = loadAgeCheck();
  const [way, setWay] = useState<Way>('choose');
  const [answers, setAnswers] = useState<Answers>({ country: remembered?.country || guessCountry(), age: remembered?.age ?? null, nickname: localName });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The account steps come from the sign-in itself: a new account fills in its details, an older one its age.
  const account = gate === 'profile' || gate === 'age';
  const step: Way | 'refused' = gate === 'refused' ? 'refused' : account && way !== 'parent' && way !== 'declined' ? 'details' : way;

  useEffect(() => { panel.current?.querySelector<HTMLElement>('select, input, button.kit-btn')?.focus(); }, [step]);
  useEffect(() => {
    if (blocking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocking, onDone]);

  // A guest's questions are the `guest` step; an account's are `details`.
  const guestFlow = !account;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'other';
      // The server's rules can be stricter than this page's (a country raised on the server): ask the parent then.
      if (code === 'parent_consent_required') setWay('parent');
      else {
        setError(describeAuthError(code));
        // A problem with what was typed (a taken name, a country the game is not in) goes back to the questions, which is
        // where it is fixed. The parent's screen has nothing to fix. The bot check is used up once sent: it asks again.
        if (BACK_TO_DETAILS.has(code)) { setWay(guestFlow ? 'guest' : 'details'); setCaptcha(null); }
      }
    } finally {
      setBusy(false);
    }
  };

  /** The last step for everyone: keep the answers, and for an account, tell the server. */
  const finish = (parent: boolean) => run(async () => {
    const { country, age, nickname } = answers;
    if (age === null) return;
    if (gate === 'profile') await a.finishProfile({ nickname: nickname.trim(), country, age, parentConsent: parent, captchaToken: captcha ?? undefined });
    else if (gate === 'age') await a.confirmAge({ country, age, parentConsent: parent });
    saveAgeCheck({ country, age, parent, at: Date.now() });
    onDone();
  });

  /** Country and age are in: on to the parent if this country's rules say so, otherwise straight in. */
  const answered = () => {
    if (answers.age === null || !answers.country) return;
    if (needsParent(answers.age, answers.country)) setWay('parent');
    else void finish(false);
  };

  const title = step === 'parent' ? 'For a parent' : step === 'declined' ? 'Not yet' : step === 'refused' ? 'This account is closed' : step === 'details' ? 'About you' : step === 'email' ? 'Your account' : 'Welcome to the barn';

  let body;
  if (step === 'refused') {
    body = (
      <div className="sk-onb-stack">
        <p className="sk-onb-text">A parent said no to this account by email, so it cannot be used.</p>
        <WoodButton className="sk-onb-btn" onClick={() => void a.signOut()}>Sign out</WoodButton>
      </div>
    );
  } else if (step === 'choose') {
    body = (
      <div className="sk-onb-stack">
        <p className="sk-onb-text">How would you like to play?</p>
        {blocking && (
          <WoodButton className="sk-onb-way" onClick={() => setWay('guest')}>
            <span className="sk-onb-way-name">Play as a guest</span>
            <span className="sk-onb-way-sub">No account. Saved in this browser only.</span>
          </WoodButton>
        )}
        {authEnabled() && (
          <>
            <ClothButton className="sk-onb-way" onClick={() => setWay('email')}>
              <span className="sk-onb-way-name">Email and password</span>
              <span className="sk-onb-way-sub">Sign up or log in. Keeps your progress on every device.</span>
            </ClothButton>
            <ClothButton className="sk-onb-way" disabled={busy} onClick={() => void run(() => a.signInWith('google'))}>
              <span className="sk-onb-way-name">Continue with Google</span>
              <span className="sk-onb-way-sub">Use your Google account.</span>
            </ClothButton>
          </>
        )}
      </div>
    );
  } else if (step === 'email') {
    body = <EmailForm busy={busy} run={run} captcha={captcha} setCaptcha={setCaptcha} onBack={() => setWay('choose')} />;
  } else if (step === 'guest' || step === 'details') {
    const newAccount = step === 'details' && gate === 'profile';
    const nameProblem = newAccount ? usernameProblem(answers.nickname) : null;
    const nameTaken = newAccount && error === describeAuthError('nickname_taken');
    const ready = !!answers.country && answers.age !== null && !nameProblem && (!newAccount || !captchaAvailable() || !!captcha);
    body = (
      <form className="sk-onb-stack" onSubmit={(e) => { e.preventDefault(); if (ready) answered(); }}>
        <p className="sk-onb-text">{step === 'guest' ? 'Two questions before you play.' : gate === 'age' ? 'Two questions to finish setting up your account.' : 'Last step: your username, country and age.'}</p>
        {newAccount && (
          <label className="sk-onb-field">
            <span>Username</span>
            <input className="sk-onb-input" aria-label="Username" maxLength={MAX_NICKNAME} value={answers.nickname} autoComplete="nickname"
              onChange={(e) => setAnswers({ ...answers, nickname: e.target.value })} aria-invalid={!!(answers.nickname && nameProblem) || nameTaken} />
            <small className="sk-onb-help" data-bad={!!(answers.nickname && nameProblem) || undefined}>{(answers.nickname && nameProblem) || 'Other players will see this.'}</small>
          </label>
        )}
        <CountryAndAge answers={answers} onChange={setAnswers} />
        {newAccount && <Captcha onToken={setCaptcha} />}
        <WoodButton className="sk-onb-btn" disabled={busy || !ready}>Continue</WoodButton>
        {step === 'guest' && <button type="button" className="sk-onb-link" onClick={() => { setError(''); setWay('choose'); }}>Back</button>}
        {step === 'details' && <button type="button" className="sk-onb-link" onClick={() => void a.signOut()}>Sign out</button>}
      </form>
    );
  } else if (step === 'parent') {
    body = (
      <div className="sk-onb-stack">
        <p className="sk-onb-text"><b>Please hand this to a parent or guardian.</b> Because of the age and country given, a parent needs to agree before this player can play.</p>
        <ul className="sk-onb-notice">
          {PARENT_NOTICE.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="sk-onb-small">
          Read the <a href={legalHref('privacy')} target="_blank" rel="noopener">privacy policy</a> and the <a href={legalHref('terms')} target="_blank" rel="noopener">terms</a>.
        </p>
        <WoodButton className="sk-onb-btn sk-onb-agree" disabled={busy} onClick={() => void finish(true)}>{PARENT_AGREE}</WoodButton>
        <ClothButton className="sk-onb-btn" disabled={busy} onClick={() => setWay('declined')}>{PARENT_DECLINE}</ClothButton>
        <button type="button" className="sk-onb-link" disabled={busy} onClick={() => { setError(''); setWay(account ? 'details' : 'guest'); }}>
          ← Change my {account && gate === 'profile' ? 'username, country or age' : 'country or age'}
        </button>
      </div>
    );
  } else {
    body = (
      <div className="sk-onb-stack">
        <p className="sk-onb-text">Without a parent's OK this player can't play yet. Come back with a parent or guardian.</p>
        <WoodButton className="sk-onb-btn" onClick={() => { setError(''); setWay(account ? 'details' : 'guest'); }}>Back</WoodButton>
      </div>
    );
  }

  return (
    <div className="sk-post-scrim sk-onb-scrim" data-late={late || undefined} onClick={blocking ? undefined : onDone}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="sk-guide sk-post sk-onb" onClick={(e) => e.stopPropagation()}>
        <div className="sk-guide-head">
          <SnowCap className="sk-guide-snow" />
          <h2>{title}</h2>
          {!blocking && <Chip className="sk-icon-chip" onClick={onDone} aria-label="Close"><CloseIcon size={16} /></Chip>}
        </div>
        <div className="sk-guide-body">
          {notice && status !== 'ready' && <p role="status" className="sk-onb-note">{notice}</p>}
          {error && <p role="alert" className="sk-onb-note" data-bad>{error}</p>}
          {body}
        </div>
      </div>
    </div>
  );
}

function CountryAndAge({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const countries = useMemo(() => countryOptions(navigator.language || 'en'), []);
  return (
    <>
      <label className="sk-onb-field">
        <span>Country</span>
        <select className="sk-onb-input" aria-label="Country" required value={answers.country} onChange={(e) => onChange({ ...answers, country: e.target.value })}>
          <option value="" disabled>Choose your country</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      <label className="sk-onb-field">
        <span>Age</span>
        <select className="sk-onb-input" aria-label="Age" required value={answers.age ?? ''} onChange={(e) => onChange({ ...answers, age: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="" disabled>Choose your age</option>
          {AGE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
    </>
  );
}

function EmailForm({ busy, run, captcha, setCaptcha, onBack }: {
  busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void>; captcha: string | null; setCaptcha: (t: string | null) => void; onBack: () => void;
}) {
  const a = useAuth.getState();
  const [mode, setMode] = useState<'up' | 'in' | 'reset'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const onToken = useCallback((t: string | null) => setCaptcha(t), [setCaptcha]);
  const needsCaptcha = captchaAvailable() && !captcha;
  const submit = () => run(async () => {
    if (mode === 'up') await a.signUp(email, password, captcha ?? undefined);
    else if (mode === 'in') await a.signIn(email, password, captcha ?? undefined);
    else await a.requestReset(email, captcha ?? undefined);
    setCaptcha(null);
  });
  return (
    <form className="sk-onb-stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {mode !== 'reset' && (
        <div className="sk-onb-tabs" role="tablist" aria-label="Sign up or log in">
          {([['up', 'Sign up'], ['in', 'Log in']] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>{label}</button>
          ))}
        </div>
      )}
      {mode === 'reset' && <p className="sk-onb-text">We will email you a link to choose a new password.</p>}
      <label className="sk-onb-field">
        <span>Email</span>
        <input className="sk-onb-input" aria-label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'reset' && (
        <label className="sk-onb-field">
          <span>Password</span>
          <input className="sk-onb-input" aria-label="Password" type="password" minLength={8} required autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'up' && <small className="sk-onb-help">At least 8 characters. You pick a username, country and age next.</small>}
        </label>
      )}
      <Captcha key={mode} onToken={onToken} />
      <WoodButton className="sk-onb-btn" disabled={busy || needsCaptcha}>{mode === 'up' ? 'Create account' : mode === 'in' ? 'Log in' : 'Send the link'}</WoodButton>
      {mode === 'in' && <button type="button" className="sk-onb-link" onClick={() => setMode('reset')}>Forgot your password?</button>}
      {mode === 'reset' && <button type="button" className="sk-onb-link" onClick={() => setMode('in')}>Back to log in</button>}
      {mode === 'up' && (
        <p className="sk-onb-small">By signing up you agree to the <a href={legalHref('terms')} target="_blank" rel="noopener">terms</a> and the <a href={legalHref('privacy')} target="_blank" rel="noopener">privacy policy</a>.</p>
      )}
      <button type="button" className="sk-onb-link" onClick={onBack}>Back</button>
    </form>
  );
}

/** The username rules the server uses, checked as the player types. */
function usernameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > MAX_NICKNAME) return `Use ${MAX_NICKNAME} characters or fewer.`;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return 'Use letters, numbers, spaces, dots, dashes or underscores.';
  return checkNickname(name).ok ? null : 'Please pick a friendlier username.';
}
