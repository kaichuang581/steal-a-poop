import { useEffect, useRef, useState } from 'react';
import { resetTips } from '../lib/tips';
import { Credits } from './Credits';
import { useStore } from '../state/store';

export function Settings({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const muted = useStore((s) => s.muted);
  const toggleMute = useStore((s) => s.toggleMute);
  const startTour = useStore((s) => s.startTour);
  const ready = useStore((s) => s.dictStatus === 'ready');
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const reduceMotion = useStore((s) => s.reduceMotion);
  const setReduceMotion = useStore((s) => s.setReduceMotion);
  const largeText = useStore((s) => s.largeText);
  const setLargeText = useStore((s) => s.setLargeText);
  const [tipsCleared, setTipsCleared] = useState(false);
  const [credits, setCredits] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const row = 'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-white/10 px-4 text-left font-bold hover:bg-white/15 disabled:opacity-40';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Settings"
        className="w-full max-w-sm rounded-3xl border-2 border-wood-light bg-[#1a1145] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black text-amber-300">Settings</h2>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">✕</button>
        </div>
        <div className="space-y-2">
          <button className={row} onClick={toggleMute} aria-pressed={muted}>
            <span>Sound</span><span>{muted ? '🔇 Off' : '🔊 On'}</span>
          </button>
          <label className={`${row} cursor-pointer`}>
            <span>Volume</span>
            <input
              type="range" min={0} max={100} step={5} value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              aria-label="Volume" className="h-6 w-32 accent-amber-400"
            />
          </label>
          <button className={row} onClick={() => setReduceMotion(!reduceMotion)} aria-pressed={reduceMotion}>
            <span>Reduce motion</span><span>{reduceMotion ? 'On' : 'Off'}</span>
          </button>
          <button className={row} onClick={() => setLargeText(!largeText)} aria-pressed={largeText}>
            <span>Larger text</span><span>{largeText ? 'On' : 'Off'}</span>
          </button>
          <button className={row} disabled={!ready} onClick={() => startTour('menu')}>
            <span>Replay tutorial</span><span aria-hidden="true">▶</span>
          </button>
          <button
            className={row}
            onClick={() => { resetTips(); setTipsCleared(true); }}
          >
            <span>Show gameplay tips again</span><span>{tipsCleared ? '✓ Reset' : '↺'}</span>
          </button>
          <button className={row} onClick={() => setCredits(true)}>
            <span>Credits and licenses</span><span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      {credits && <Credits onClose={() => setCredits(false)} />}
    </div>
  );
}
