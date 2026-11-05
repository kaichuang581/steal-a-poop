import { CheckIcon, CloseIcon, PlayIcon, ResetIcon, SpeakerIcon } from '../components/Icons';
import { useEffect, useRef, useState } from 'react';
import { resetTips } from '../../lib/tips';
import { useStore } from '../../state/store';
import { AccountPanel } from '../../ui/auth/AccountPanel';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { PaintedCredits } from '../components/PaintedCredits';
import { Chip, PaperPanel } from '../components/Materials';

/** The existing settings, unchanged, in a paper panel. No new settings. */
export function PaintedSettings({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const ready = s.dictStatus === 'ready';
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tipsCleared, setTipsCleared] = useState(false);
  const [credits, setCredits] = useState(false);
  const [signIn, setSignIn] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const row = 'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left font-bold disabled:opacity-45';
  const rowStyle = { background: 'var(--paper-edge)' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      <PaperPanel role="dialog" aria-modal="true" aria-label="Settings" className="w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="sk-display text-2xl">Settings</h2>
          <Chip ref={closeRef} className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="space-y-2">
          {/* The account panel is written light-on-dark; it sits on an ink card. */}
          <div className="rounded-xl p-1 empty:hidden" style={{ background: 'var(--ink)', color: 'var(--button-text)' }}>
            <AccountPanel onSignIn={() => setSignIn(true)} />
          </div>
          <button className={row} style={rowStyle} onClick={s.toggleMute} aria-pressed={s.muted}>
            <span>Sound</span><span className="flex items-center gap-2"><SpeakerIcon size={16} muted={s.muted} />{s.muted ? 'Off' : 'On'}</span>
          </button>
          <label className={`${row} cursor-pointer`} style={rowStyle}>
            <span>Volume</span>
            <input
              type="range" min={0} max={100} value={Math.round(s.volume * 100)}
              onChange={(e) => s.setVolume(Number(e.target.value) / 100)}
              aria-label="Volume" className="h-6 w-32" style={{ accentColor: 'var(--amber)' }}
            />
          </label>
          <button className={row} style={rowStyle} onClick={() => s.setReduceMotion(!s.reduceMotion)} aria-pressed={s.reduceMotion}>
            <span>Reduce motion</span><span>{s.reduceMotion ? 'On' : 'Off'}</span>
          </button>
          <button className={row} style={rowStyle} onClick={() => s.setLargeText(!s.largeText)} aria-pressed={s.largeText}>
            <span>Larger text</span><span>{s.largeText ? 'On' : 'Off'}</span>
          </button>
          <button className={row} style={rowStyle} disabled={!ready} onClick={() => s.startTour('menu')}>
            <span>Replay tutorial</span><PlayIcon size={14} />
          </button>
          <button className={row} style={rowStyle} onClick={() => { resetTips(); setTipsCleared(true); }}>
            <span>Show gameplay tips again</span><span className="flex items-center gap-1">{tipsCleared ? <><CheckIcon size={14} /> Reset</> : <ResetIcon size={16} />}</span>
          </button>
          <button className={row} style={rowStyle} onClick={() => setCredits(true)}>
            <span>Credits and licenses</span><span aria-hidden="true" className="sk-display text-xl leading-none">›</span>
          </button>
        </div>
      </PaperPanel>
      {credits && <PaintedCredits onClose={() => setCredits(false)} />}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </div>
  );
}
