import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../auth/config';

const REPO_ISSUES = 'https://github.com/kaichuang581/steal-a-poop/issues/new';
const KINDS = [['bug', 'Something broke'], ['idea', 'An idea'], ['other', 'Something else']] as const;
type Kind = (typeof KINDS)[number][0];
type State = 'idle' | 'sending' | 'sent' | 'error' | 'github';

/** The feedback form as a window over the game: it posts to the game server, which files the issue on GitHub. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = title.trim().length >= 3 && message.trim().length >= 10;
  const toGithub = () => {
    const q = new URLSearchParams({ title: `[${kind}] ${title.trim()}`, body: message.trim() });
    window.open(`${REPO_ISSUES}?${q}`, '_blank', 'noopener');
    setState('github');
  };
  const send = async () => {
    if (!valid || state === 'sending') return;
    const base = apiBase();
    if (!base) return toGithub(); // no game server in this build: the old way
    setState('sending');
    try {
      const res = await fetch(`${base}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title: title.trim(), message: message.trim() }) });
      if (res.ok) return setState('sent');
      if (res.status === 503) return toGithub(); // the server has no GitHub key set up
      setState('error');
    } catch {
      setState('error');
    }
  };

  const chip = (on: boolean) => `min-h-11 rounded-lg border-2 px-3 text-sm font-bold ${on ? 'border-[#c0792b] bg-white' : 'border-transparent bg-white/60'}`;
  return (
    <div role="dialog" aria-modal="true" aria-label="Send feedback" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--paper,#f6efe0)] p-4 text-[#2b221d]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Send feedback</h2>
          <button className="min-h-11 min-w-11 rounded-lg px-3 font-bold" onClick={onClose} aria-label="Close" title="Close">Close</button>
        </div>
        {state === 'sent' ? (
          <p role="status" className="py-6 text-center font-bold">Thank you. Your message was sent.</p>
        ) : state === 'github' ? (
          <p role="status" className="py-6 text-center font-bold">A GitHub page opened with your message filled in. Press "Submit new issue" there to send it.</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="What is it about?">
              {KINDS.map(([k, label]) => <button type="button" key={k} aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>{label}</button>)}
            </div>
            <label className="mb-3 block text-sm font-bold">Short title
              <input ref={first} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#c9b896] bg-white px-3 font-normal" />
            </label>
            <label className="mb-1 block text-sm font-bold">What happened?
              <textarea value={message} maxLength={1500} rows={5} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-lg border-2 border-[#c9b896] bg-white p-3 font-normal" />
            </label>
            <p className="mb-3 text-xs">{message.length}/1500. This is posted publicly on GitHub, so please do not write your name, email, school or where you live.</p>
            {state === 'error' && <p role="alert" className="mb-2 text-sm font-bold text-[#a02a1a]">That did not send. Please try again in a moment.</p>}
            <button type="submit" disabled={!valid || state === 'sending'} className="min-h-11 w-full rounded-lg bg-[#c0792b] px-3 font-bold text-white disabled:opacity-50">{state === 'sending' ? 'Sending…' : 'Send'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
