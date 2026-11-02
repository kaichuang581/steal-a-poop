import { useEffect, useState } from 'react';
import { ApiError, api } from '../../auth/authStore';
import { legalHref } from '../legal/legalLinks';

type Info = { state: 'open' | 'expired' | 'granted' | 'refused' | 'withdrawn'; childNickname: string };

/**
 * The page a parent opens from the email: #/consent/<token> to say yes or no, and
 * #/consent/manage/<token> to withdraw an earlier yes. No account or login is needed; the link is the key.
 */
export default function ConsentPage({ token, manage }: { token: string; manage: boolean }) {
  const [info, setInfo] = useState<Info | null | 'missing'>(null);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Parental permission · Steal a Poop';
    if (manage) return; // the manage link has no preview; the button is all there is
    api<Info>('GET', `/api/consent/${encodeURIComponent(token)}`, null)
      .then(setInfo)
      .catch((e) => setInfo(e instanceof ApiError && e.status === 404 ? 'missing' : 'missing'));
  }, [token, manage]);

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      const out = await api<{ state: string }>('POST', path, null, body);
      setResult(out.state);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'other';
      setError(code === 'expired' ? 'This link has expired. Ask your child to send a new email from the game.'
        : code === 'already_decided' ? 'This request was already answered.'
        : code === 'rate_limited' ? 'Too many tries. Please wait a little and try again.'
        : code === 'not_found' ? 'This link is not valid.'
        : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const box = 'mx-auto mt-6 max-w-lg rounded-3xl border-2 border-wood-light bg-[#1a1145] p-5 text-white';
  const btn = 'min-h-12 w-full rounded-xl font-black disabled:opacity-40';
  const links = (
    <p className="mt-4 text-xs text-white/70">
      Read the <a className="underline" href={legalHref('privacy')} target="_blank" rel="noopener">privacy policy</a>,{' '}
      <a className="underline" href={legalHref('terms')} target="_blank" rel="noopener">terms</a> and{' '}
      <a className="underline" href={legalHref('child-safety')} target="_blank" rel="noopener">child safety</a> first if you like.
    </p>
  );

  if (result) {
    const text = result === 'granted' ? 'Thank you. Your child can now chat, and their results are saved. You can withdraw permission at any time with the link in the confirmation email we are sending you.'
      : result === 'refused' ? 'Understood. Chat stays off for this account, and we keep nothing more than the record of your answer.'
      : 'Permission withdrawn. Chat and saved results stop straight away.';
    return <main className={box}><h1 className="text-2xl font-black text-amber-300">Done</h1><p role="status" className="mt-2">{text}</p></main>;
  }

  if (manage) {
    return (
      <main className={box}>
        <h1 className="text-2xl font-black text-amber-300">Withdraw permission</h1>
        <p className="mt-2">This stops your child's chat and the saving of their results right away.</p>
        {error && <p role="alert" className="mt-2 rounded-lg bg-red-900/40 p-2">{error}</p>}
        <button className={`${btn} mt-4 bg-red-400 text-red-950`} disabled={busy} onClick={() => void act(`/api/consent/manage/${encodeURIComponent(token)}/withdraw`)}>Withdraw permission</button>
        {links}
      </main>
    );
  }

  if (info === null) return <main className={box}><p>Loading…</p></main>;
  if (info === 'missing') return <main className={box}><h1 className="text-2xl font-black text-amber-300">Link not valid</h1><p className="mt-2">This link is not valid, or it was already used. If you expected a request, ask your child to send it again from the game.</p></main>;
  if (info.state !== 'open') {
    const why = info.state === 'expired' ? 'This link has expired. Ask your child to send a new email from the game.' : `This request was already answered (${info.state}).`;
    return <main className={box}><h1 className="text-2xl font-black text-amber-300">No action needed</h1><p className="mt-2">{why}</p></main>;
  }
  return (
    <main className={box}>
      <h1 className="text-2xl font-black text-amber-300">Permission for a child's account</h1>
      <p className="mt-2">Your child asked to play <b>Steal a Poop</b> under the nickname <b>{info.childNickname}</b>.</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li>It is a free word game. Players can join rooms with other people and use a chat.</li>
        <li>Every chat message is checked before anyone sees it, and messages that break the rules are held and reviewed by a person.</li>
        <li>We keep the nickname, the child's email address, date of birth and country, and game results.</li>
        <li>Until you agree, the account can play but cannot chat, and results are not saved.</li>
        <li>You can withdraw permission at any time.</li>
      </ul>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-900/40 p-2">{error}</p>}
      <div className="mt-4 space-y-2">
        <button className={`${btn} bg-emerald-500 text-emerald-950`} disabled={busy} onClick={() => void act(`/api/consent/${encodeURIComponent(token)}`, { decision: 'grant' })}>I agree</button>
        <button className={`${btn} bg-white/15`} disabled={busy} onClick={() => void act(`/api/consent/${encodeURIComponent(token)}`, { decision: 'refuse' })}>I do not agree</button>
      </div>
      {links}
    </main>
  );
}
