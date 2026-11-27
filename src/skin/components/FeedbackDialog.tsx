import { ChatIcon, CheckIcon } from './Icons';
import { Dialog, Row, Scrim, Slab } from '../kit/modern';
import './hud-guide.css';
import { useEffect, useRef, useState } from 'react';
import { apiBase } from '../../auth/config';

const KINDS = [['bug', 'Something broke'], ['idea', 'An idea'], ['other', 'Something else']] as const;
type Kind = (typeof KINDS)[number][0];
type State = 'idle' | 'sending' | 'sent' | 'error';

/** The feedback form as a window over the game: it posts to the game server, which files the issue on GitHub. Nothing leaves the page. */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('That did not send. Please try again in a moment.');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = title.trim().length >= 3 && message.trim().length >= 10;
  const send = async () => {
    if (!valid || state === 'sending') return;
    const base = apiBase();
    if (!base) {
      setError('Feedback is not switched on in this copy of the game.');
      return setState('error');
    }
    setState('sending');
    try {
      const res = await fetch(`${base}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, title: title.trim(), message: message.trim() }) });
      if (res.ok) return setState('sent');
      if (res.status === 503) setError('Feedback is not switched on for this server yet.');
      else setError('That did not send. Please try again in a moment.');
      setState('error');
    } catch {
      setError('That did not send. Please try again in a moment.');
      setState('error');
    }
  };

  return (
    <Scrim onClose={onClose}>
      <Dialog title="Send feedback" icon={<ChatIcon size={20} />} label="Send feedback" onClose={onClose} className="hg hg-feedback" onClick={(e) => e.stopPropagation()}>
        {state === 'sent' ? (
          <Row icon={<CheckIcon size={18} />} tone="pasture" label="Sent. Your issue will be looked after." hint="Thank you for telling us." role="status" />
        ) : (
          <form className="hg-stack" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div className="hg-field">
              <span>What is it about?</span>
              <div className="hg-tabs" role="group" aria-label="What is it about?">
                {KINDS.map(([k, label]) => <button type="button" key={k} aria-pressed={kind === k} className={`hg-tab hm-slab hm-knit ${kind === k ? 'hm-slab--lantern' : ''}`} onClick={() => setKind(k)}><span>{label}</span></button>)}
              </div>
            </div>
            <label className="hg-field"><span>Short title</span>
              <input ref={first} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="hg-input" />
            </label>
            <label className="hg-field"><span>What happened?</span>
              <textarea value={message} maxLength={1500} rows={5} onChange={(e) => setMessage(e.target.value)} className="hg-input hg-message" />
            </label>
            <p className="hg-small hg-count">{message.length}/1500</p>
            {state === 'error' && <p role="alert" className="hg-sub" data-bad>{error}</p>}
            <Slab type="submit" tone="lantern" disabled={!valid || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</Slab>
          </form>
        )}
      </Dialog>
    </Scrim>
  );
}
