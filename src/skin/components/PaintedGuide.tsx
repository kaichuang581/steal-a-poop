import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../state/store';
import { BASICS, FAQ, GLOSSARY } from '../../ui/guideContent';
import { ClockIcon, CloseIcon, PlayIcon, SnowflakeIcon, TrophyIcon, WolfIcon } from './Icons';
import { WoolBall } from './Lives';
import { Chip, ClothButton, WoodButton } from './Materials';
import { MiniTile, RulesCard } from './RulesCard';
import { SnowCap } from './SnowCap';

const TABS = ['Basics', 'Rules', 'Words', 'Questions'] as const;
type Tab = (typeof TABS)[number];

/** A small picture for each basic, in the same tiles and pixel icons as the table. */
const ART: ReactNode[] = [
  <span key="chain" className="flex items-center gap-1"><MiniTile ch="c" /><MiniTile ch="a" /><MiniTile ch="t" hot /></span>,
  <span key="wool" className="flex gap-0.5"><WoolBall full size={22} /><WoolBall full size={22} /><WoolBall full size={22} /></span>,
  <WolfIcon key="steal" size={34} />,
  <span key="trap" className="flex gap-0.5"><MiniTile ch="x" /><MiniTile ch="z" /><MiniTile ch="q" /><MiniTile ch="j" /></span>,
  <ClockIcon key="clock" size={30} />,
  <TrophyIcon key="win" size={30} />,
];

/** How to play, in the farm's own look: a paper book under a snowy wooden header, with tabs like bookmarks. */
export function PaintedGuide({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="How to play" className="sk-guide" onClick={(e) => e.stopPropagation()}>
        <div className="sk-guide-head">
          <SnowCap className="sk-guide-snow" />
          <h2>How to play</h2>
          <Chip ref={closeRef} className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="flex gap-2 px-4 pt-3">
          <ClothButton disabled={!ready} onClick={() => startTour('menu')} className="inline-flex flex-1 items-center justify-center gap-2">
            <PlayIcon size={14} /> Interactive tour
          </ClothButton>
          <WoodButton disabled={!ready} onClick={() => start('practice')} className="flex-1">Practice game</WoodButton>
        </div>
        <div role="tablist" aria-label="Guide sections" className="sk-guide-tabs">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <div role="tabpanel" tabIndex={0} className="sk-guide-body">
          {tab === 'Basics' && (
            <ol className="flex flex-col gap-2.5">
              {BASICS.map((b, i) => (
                <li key={b.title} className="sk-guide-basic">
                  <span className="sk-guide-art" aria-hidden="true">{ART[i] ?? <SnowflakeIcon size={28} />}</span>
                  <div>
                    <h3>{i + 1}. {b.title}</h3>
                    <p>{b.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {tab === 'Rules' && <RulesCard />}
          {tab === 'Words' && (
            <dl className="flex flex-col gap-2">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="sk-guide-basic block">
                  <dt>{g.term}</dt>
                  <dd>{g.def}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === 'Questions' && (
            <div className="flex flex-col gap-2">
              {FAQ.map((f) => (
                <details key={f.q} className="sk-guide-faq">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
