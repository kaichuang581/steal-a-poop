import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeAuthError, useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { forgetGuest, saveGuest, useGuest } from '../../auth/guest';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { useStore } from '../../state/store';
import { legalHref } from '../legal/legalLinks';
import { Captcha, captchaAvailable } from './Captcha';

type Mode = 'in' | 'up' | 'reset';
type Step = 'main' | 'guest';
type Run = (fn: () => Promise<unknown>) => Promise<void>;

const input = 'min-h-11 w-full rounded-lg border border-white/30 bg-black/40 px-3';
const primary = 'min-h-12 w-full rounded-xl bg-amber-400 text-lg font-black text-amber-950 disabled:opacity-40';
const secondary = 'min-h-12 w-full rounded-xl bg-white/10 font-bold hover:bg-white/15 disabled:opacity-40';

/** Sign in, sign up, reset a password, and finish the profile. Closes itself once the person is fully signed up. */
export function AuthDialog({ onClose }: { onClose: () => void }) {
  const status = useAuth((s) => s.status);
  const recovery = useAuth((s) => s.recovery);
  const notice = useAuth((s) => s.notice);
  const profile = useAuth((s) => s.profile);
  const a = useAuth.getState();
  const guest = useGuest();
  const [step, setStep] = useState<Step>('main');
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus(), [mode, status, recovery]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Done: a profile exists and, for a child, the parent has been asked.
  const done = status === 'ready' && profile && (profile.consentStatus === 'not_required' || profile.consentStatus === 'granted' || profile.consentStatus === 'unconfirmed');
  const onToken = useCallback((t: string | null) => setCaptcha(t), []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(describeAuthError(e instanceof ApiError ? e.code : 'other'));
    } finally {
      setBusy(false);
      setCaptcha(null);
    }
  };

  let body;
  if (recovery) {
    body = (
      <form onSubmit={(e) => { e.preventDefault(); void run(() => a.setNewPassword(password)); }} className="space-y-3">
        <h3 className="text-lg font-black">Choose a new password</h3>
        <label className="block text-sm font-bold">New password
          <input ref={first} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </label>
        <button className={primary} disabled={busy || password.length < 8}>Save password</button>
      </form>
    );
  } else if (status === 'needsProfile') {
    body = <UsernameForm run={run} busy={busy} first={first} />;
  } else if (status === 'ready' && profile && !done) {
    body = <WaitingForParent run={run} busy={busy} onClose={onClose} />;
  } else if (status === 'loading') {
    body = <p>Checking your sign-in…</p>;
  } else if (status === 'error') {
    body = <p role="alert">{describeAuthError('network')}</p>;
  } else if (step === 'guest' || !authEnabled()) {
    body = <GuestForm first={first} onBack={authEnabled() ? () => setStep('main') : onClose} onDone={onClose} existing={guest?.nickname} />;
  } else {
    const needsCaptcha = mode !== 'in';
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => (mode === 'in' ? a.signIn(email, password, captcha ?? undefined) : mode === 'up' ? a.signUp(email, password, captcha ?? undefined) : a.requestReset(email, captcha ?? undefined)));
        }}
        className="space-y-3"
      >
        <p className="text-sm text-white/80">An account only saves your progress, so you can pick up where you left off.</p>
        <div className="flex gap-2" role="tablist" aria-label="Sign in or sign up">
          {([['in', 'Sign in'], ['up', 'Sign up']] as const).map(([m, label]) => (
            <button type="button" role="tab" key={m} aria-selected={mode === m} onClick={() => { setMode(m); setError(''); a.clearNotice(); }}
              className={`min-h-11 flex-1 rounded-lg font-bold ${mode === m ? 'bg-amber-400 text-amber-950' : 'bg-white/10'}`}>{label}</button>
          ))}
        </div>
        {mode === 'reset' && <h3 className="text-lg font-black">Reset your password</h3>}
        <label className="block text-sm font-bold">Email
          <input ref={first} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        {mode !== 'reset' && (
          <label className="block text-sm font-bold">Password
            <input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </label>
        )}
        {mode === 'up' && <p className="text-xs text-white/70">You will choose a username next. We do not send a confirmation email.</p>}
        {(needsCaptcha || mode === 'in') && <Captcha onToken={onToken} />}
        <button className={primary} disabled={busy || (needsCaptcha && captchaAvailable() && !captcha)}>
          {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
        </button>
        {mode === 'in' && <button type="button" className="min-h-11 text-sm underline" onClick={() => { setMode('reset'); setError(''); }}>Forgot your password?</button>}
        {mode === 'reset' && <button type="button" className="min-h-11 text-sm underline" onClick={() => setMode('in')}>Back to sign in</button>}
        {mode === 'up' && (
          <p className="text-xs text-white/70">
            By signing up you agree to the{' '}
            <a className="underline" href={legalHref('terms')} target="_blank" rel="noopener">terms</a> and the{' '}
            <a className="underline" href={legalHref('privacy')} target="_blank" rel="noopener">privacy policy</a>.
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-white/60" aria-hidden="true"><hr className="flex-1 border-white/20" />or<hr className="flex-1 border-white/20" /></div>
        <button type="button" className={secondary} disabled={busy} onClick={() => void run(() => a.signInWith('google'))}>Continue with Google</button>
        <button type="button" className={secondary} disabled={busy} onClick={() => { setStep('guest'); setError(''); a.clearNotice(); }}>Play as a guest</button>
        <p className="text-xs text-white/60">A guest has no account. Everything is saved in this browser, on this one device.</p>
      </form>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 p-3" onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-label="Account" className="classic-panel w-full max-w-sm rounded-3xl border-2 border-wood-light bg-[#1a1145] p-4 text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="classic-panel-title text-xl font-black text-amber-300">Your account</h2>
          <button onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">Close</button>
        </div>
        {notice && <p role="status" className="mb-3 rounded-lg border border-sky-300/50 bg-sky-900/40 p-2 text-sm">{notice}</p>}
        {error && <p role="alert" className="mb-3 rounded-lg border border-red-400 bg-red-900/40 p-2 text-sm">{error}</p>}
        {done ? (
          <div className="space-y-3"><p>You are signed in as <b>{profile!.nickname}</b>.</p><button className={primary} onClick={onClose}>Continue</button></div>
        ) : body}
      </div>
    </div>
  );
}

/** One field with a live check, so a rude or too-short name is caught before anything is sent. */
function usernameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > MAX_NICKNAME) return `Use ${MAX_NICKNAME} characters or fewer.`;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return 'Use letters, numbers, spaces, dots, dashes or underscores.';
  const ok = checkNickname(name);
  return ok.ok ? null : 'Please pick a friendlier username.';
}

function UsernameField({ value, onChange, first }: { value: string; onChange: (v: string) => void; first: React.RefObject<HTMLInputElement | null> }) {
  const problem = value ? usernameProblem(value) : null;
  return (
    <label className="block text-sm font-bold">Choose a username
      <input ref={first} required maxLength={MAX_NICKNAME} value={value} onChange={(e) => onChange(e.target.value)} className={input} autoComplete="nickname" aria-invalid={!!problem} aria-describedby="username-help" />
      <span id="username-help" className={`mt-1 block text-xs font-normal ${problem ? 'text-red-300' : 'text-white/70'}`}>
        {problem ?? 'Other players will see this. Keep it kind: no rude, hateful or grown-up words.'}
      </span>
    </label>
  );
}

function UsernameForm({ run, busy, first }: { run: Run; busy: boolean; first: React.RefObject<HTMLInputElement | null> }) {
  const a = useAuth.getState();
  const [nickname, setNickname] = useState('');
  const [cap, setCap] = useState<string | null>(null);
  const onCap = useCallback((t: string | null) => setCap(t), []);
  const ok = usernameProblem(nickname) === null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) void run(() => a.finishUsername(nickname.trim(), cap ?? undefined)); }} className="space-y-3">
      <h3 className="text-lg font-black">One more step</h3>
      <UsernameField value={nickname} onChange={setNickname} first={first} />
      <Captcha onToken={onCap} />
      <button className={primary} disabled={busy || !ok || (captchaAvailable() && !cap)}>Start playing</button>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => void a.signOut()}>Sign out</button>
    </form>
  );
}

function GuestForm({ first, onBack, onDone, existing }: { first: React.RefObject<HTMLInputElement | null>; onBack: () => void; onDone: () => void; existing?: string }) {
  const [nickname, setNickname] = useState('');
  const ok = usernameProblem(nickname) === null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        const g = saveGuest(nickname.trim());
        useStore.getState().setSettings({ name: g.nickname });
        onDone();
      }}
      className="space-y-3"
    >
      <h3 className="text-lg font-black">Play as a guest</h3>
      <p className="text-sm text-white/80">No email, no password. Everything you do is saved in this browser, on this one device.</p>
      <UsernameField value={nickname} onChange={setNickname} first={first} />
      <button className={primary} disabled={!ok}>Start playing</button>
      {existing && <p className="text-xs text-white/70">You are playing as <b>{existing}</b> on this device. <button type="button" className="underline" onClick={() => forgetGuest()}>Forget this guest</button></p>}
      <button type="button" className="min-h-11 text-sm underline" onClick={onBack}>{existing ? 'Close' : 'Back'}</button>
    </form>
  );
}

function WaitingForParent({ run, busy, onClose }: { run: Run; busy: boolean; onClose: () => void }) {
  const a = useAuth.getState();
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-black">Waiting for your parent</h3>
      <p className="text-sm">You can play now. Chat and saved results start once your parent says yes in the email we sent them.</p>
      <button className={secondary} disabled={busy} onClick={() => void run(() => a.resendConsent())}>Send the email again</button>
      <button className={secondary} onClick={() => void a.refreshProfile()}>I think they said yes: check</button>
      <button className={primary} onClick={onClose}>Play</button>
    </div>
  );
}
