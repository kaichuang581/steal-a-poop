import { CloseIcon } from './Icons';
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

  const chip = (on: boolean) => `kit-patch min-h-11 ${on ? 'kit-patch--pressed kit-patch--cream' : ''}`;
  return (
    <div role="dialog" aria-modal="true" aria-label="Send feedback" className="fixed inset-0 z-50 grid place-items-center p-3" style={{ background: 'color-mix(in srgb, var(--ink) 50%, transparent)' }} onClick={onClose}>
      <div className="sk-framed kit-paper max-h-[92vh] w-full max-w-md overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="kit-clipboard-title">Send feedback</h2>
          <button className="kit-peg kit-peg--light kit-peg--sm" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={16} /></button>
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
              <input ref={first} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="sk-field mt-1 w-full" />
            </label>
            <label className="mb-1 block text-sm font-bold">What happened?
              <textarea value={message} maxLength={1500} rows={5} onChange={(e) => setMessage(e.target.value)} className="kit-paper kit-paper--sheet mt-1 w-full" />
            </label>
            <p className="mb-3 text-xs">{message.length}/1500</p>
            {state === 'error' && <p role="alert" className="mb-2 text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>That did not send. Please try again in a moment.</p>}
            <button type="submit" disabled={!valid || state === 'sending'} className="kit-btn kit-brass w-full">{state === 'sending' ? 'Sending…' : 'Send'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
