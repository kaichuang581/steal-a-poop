import { useState } from 'react';
import { ApiError, describeAuthError, useAuth } from '../../auth/authStore';

/** Inside Settings: who is signed in, log out (here or everywhere), delete the account. Shown only when real sign-in is on. */
export function AccountPanel({ onSignIn }: { onSignIn: () => void }) {
  const status = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const email = useAuth((s) => s.email);
  const a = useAuth.getState();
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const row = 'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-white/10 px-4 text-left font-bold hover:bg-white/15 disabled:opacity-40';

  if (status === 'off') return null;
  if (status !== 'ready' && status !== 'needsProfile') {
    return <button className={row} onClick={onSignIn}><span>Sign in or sign up</span><span aria-hidden="true">›</span></button>;
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(describeAuthError(e instanceof ApiError ? e.code : 'other'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Account" className="space-y-2 rounded-2xl border border-white/15 p-3">
      <p className="text-sm">Signed in as <b>{profile?.nickname ?? 'new player'}</b>{email ? <span className="text-white/60"> · {email}</span> : null}</p>
      {error && <p role="alert" className="rounded-lg bg-red-900/40 p-2 text-sm">{error}</p>}
      <button className={row} disabled={busy} onClick={() => void run(() => a.signOut())}><span>Log out</span></button>
      <button className={row} disabled={busy} onClick={() => void run(() => a.signOutEverywhere())}>
        <span>Log out on all devices</span>
      </button>
      {!confirming ? (
        <button className={`${row} text-red-300`} onClick={() => setConfirming(true)}><span>Delete my account</span></button>
      ) : (
        <div role="alertdialog" aria-label="Delete account" className="space-y-2 rounded-xl border-2 border-red-400 p-3 text-sm">
          <p>
            This deletes your login, your profile and your blocks. It cannot be undone. Records kept for safety and legal reasons, such as
            moderation records about messages that broke the rules, are not deleted.
          </p>
          <label className="block font-bold">Your password (to prove it is you)
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/30 bg-black/40 px-3" />
          </label>
          <label className="block font-bold">Type DELETE to confirm
            <input value={word} onChange={(e) => setWord(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/30 bg-black/40 px-3" />
          </label>
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-lg bg-red-400 font-black text-red-950 disabled:opacity-40" disabled={busy || word !== 'DELETE'}
              onClick={() => void run(() => a.deleteAccount(password || undefined))}>Delete forever</button>
            <button className="min-h-11 flex-1 rounded-lg bg-white/15 font-bold" onClick={() => { setConfirming(false); setWord(''); setPassword(''); }}>Cancel</button>
          </div>
          <p className="text-xs text-white/60">Signed in with Google or Meta and no password? Log out, sign in again, and delete straight away.</p>
        </div>
      )}
    </section>
  );
}
