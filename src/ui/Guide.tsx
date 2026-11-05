import { useEffect, useRef, useState } from 'react';
import { GAME_TITLE } from '../config';
import { useStore } from '../state/store';
import { BASICS, FAQ, GLOSSARY } from './guideContent';
import { ScoringTable } from './ScoringTable';

const TABS = ['Basics', 'Rules', 'Glossary', 'FAQ'] as const;
type Tab = (typeof TABS)[number];

/** Rules hub: quick basics, rules card, glossary, FAQ, plus entry points to the tour and practice. */
export function Guide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('Basics');
  const closeRef = useRef<HTMLButtonElement>(null);
  const startTour = useStore((s) => s.startTour);
  const start = useStore((s) => s.start);
  const ready = useStore((s) => s.dictStatus === 'ready');

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="How to play"
        className="flex max-h-full w-full max-w-xl flex-col rounded-3xl border-2 border-wood-light bg-[#1a1145]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <h2 className="text-xl font-black text-amber-300 sm:text-2xl">How to play {GAME_TITLE}</h2>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">✕</button>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          <button
            disabled={!ready} onClick={() => startTour('menu')}
            className="min-h-11 flex-1 rounded-xl bg-fuchsia-700 px-3 font-black disabled:opacity-40"
          >
            ▶ Interactive tour
          </button>
          <button
            disabled={!ready} onClick={() => start('practice')}
            className="min-h-11 flex-1 rounded-xl bg-emerald-500 px-3 font-black text-emerald-950 disabled:opacity-40"
          >
            Practice game
          </button>
        </div>
        <div role="tablist" aria-label="Guide sections" className="flex gap-1 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${tab === t ? 'bg-amber-400 text-amber-950' : 'bg-white/10 hover:bg-white/15'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'Basics' && (
            <ol className="space-y-3">
              {BASICS.map((s, i) => (
                <li key={s.title} className="flex gap-3 rounded-2xl bg-white/5 p-3">
                  <div className="flex w-24 shrink-0 items-center justify-center rounded-xl bg-black/30 p-2 text-center text-lg font-black">
                    <span aria-hidden="true">{s.art}</span>
                  </div>
                  <div>
                    <h3 className="font-black">{i + 1}. {s.title}</h3>
                    <p className="text-sm text-white/80">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {tab === 'Rules' && <ScoringTable />}
          {tab === 'Glossary' && (
            <dl className="space-y-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="rounded-xl bg-white/5 p-3">
                  <dt className="font-black text-amber-200">{g.term}</dt>
                  <dd className="text-sm text-white/80">{g.def}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === 'FAQ' && (
            <div className="space-y-2">
              {FAQ.map((f) => (
                <details key={f.q} className="rounded-xl bg-white/5 p-3">
                  <summary className="cursor-pointer font-bold">{f.q}</summary>
                  <p className="mt-2 text-sm text-white/80">{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
