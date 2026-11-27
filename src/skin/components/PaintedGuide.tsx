import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../state/store';
import { BASICS, FAQ, GLOSSARY } from '../../ui/guideContent';
import { Dialog, IconTile, Scrim, Slab } from '../kit/modern';
import type { TileTone } from '../kit/modern';
import { ScrollBox } from '../kit/surfaces';
import { ClockIcon, HelpIcon, PlayIcon, SnowflakeIcon, TrophyIcon } from './Icons';
import { MiniTile, RulesCard } from './RulesCard';
import './hud-guide.css';

/**
 * The text is shared with the old look. Where this game differs, it says its own: Counting Sheep took the Daily
 * Table's place, and there is a save code and a Trading Post to speak of.
 */
export const GUIDE_WORDS = GLOSSARY.map((g) => (g.term === 'Daily Table'
  ? { term: 'Counting Sheep', def: 'One dream a night, new at midnight, with the same fences for everyone. Each fence shows the start of a word: type any real word that begins with those letters and the sheep jumps it. The first bump wakes the farmer.' }
  : g));
export const GUIDE_QUESTIONS = FAQ.map((f) => (f.q === 'Is my progress saved?'
  ? { q: f.q, a: 'Your name, settings, bests and dream streak are kept in this browser, so clearing site data erases them. A save code (in Settings) carries them to another browser. If you sign in, your account keeps your name, Wool Coins, Trading Post items, rank and friends.' }
  : f));

const TABS = ['Basics', 'Rules', 'Words', 'Questions'] as const;
const STEP_TONE: TileTone[] = ['dusk', 'barn', 'lantern', 'pasture'];
type Tab = (typeof TABS)[number];

/** A small picture for each basic, as the rules card draws them: the letter tiles, the name tag's dots, pixel icons. */
const ART: ReactNode[] = [
  <span key="chain" className="hb-tiles"><MiniTile ch="c" /><MiniTile ch="a" /><MiniTile ch="t" hot /></span>,
  <span key="wool" className="np-lives"><i /><i /><i /></span>,
  <ClockIcon key="clock" size={20} />,
  <TrophyIcon key="win" size={20} />,
];

/**
 * How to play: the modern kit's dialog (the pen's board), the two ways to learn as slabs, the sections as joined slabs
 * with the open one in lantern (the pen's Game length), each part on a raised tile in a list that scrolls inside itself.
 * The dialog keeps one size, so changing section moves nothing.
 */
export function PaintedGuide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('Basics');
  const acts = useRef<HTMLDivElement>(null);
  const startTour = useStore((s) => s.startTour);
  const start = useStore((s) => s.start);
  const ready = useStore((s) => s.dictStatus === 'ready');
  const reduced = useStore((s) => s.reduceMotion);

  useEffect(() => {
    acts.current?.closest('.md-dialog')?.querySelector<HTMLElement>('.md-dialog-close')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Scrim onClose={onClose}>
      <Dialog title="How to play" icon={<HelpIcon size={20} />} onClose={onClose} className="hg hg-guide" onClick={(e) => e.stopPropagation()}>
        <div ref={acts} className="md-row">
          <Slab disabled={!ready} onClick={() => startTour('menu')}><PlayIcon size={14} /> Tutorial</Slab>
          <Slab tone="lantern" disabled={!ready} onClick={() => start('practice')}>Practice game</Slab>
        </div>
        <div role="tablist" aria-label="Guide sections" className="hg-tabs">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`hg-tab hm-slab hm-knit ${tab === t ? 'hm-slab--lantern' : ''}`}><span>{t}</span></button>
          ))}
        </div>
        <ScrollBox className="hg-panel" reduced={reduced} role="tabpanel" tabIndex={0}>
          {tab === 'Basics' && (
            <ol className="hg-list">
              {BASICS.map((b, i) => (
                <li key={b.title} className="md-rowtile hg-basic rc-tile">
                  <IconTile tone={STEP_TONE[i % STEP_TONE.length]}><b className="hg-num">{i + 1}</b></IconTile>
                  <div className="md-rowtext">
                    <h3>{b.title}</h3>
                    <p>{b.text}</p>
                  </div>
                  <span className="hg-art" aria-hidden="true">{ART[i] ?? <SnowflakeIcon size={20} />}</span>
                </li>
              ))}
            </ol>
          )}
          {tab === 'Rules' && <RulesCard />}
          {tab === 'Words' && (
            <dl className="hg-list">
              {GUIDE_WORDS.map((g) => (
                <div key={g.term} className="hg-tile hg-def rc-tile">
                  <dt>{g.term}</dt>
                  <dd>{g.def}</dd>
                </div>
              ))}
            </dl>
          )}
          {tab === 'Questions' && (
            <div className="hg-list">
              {GUIDE_QUESTIONS.map((f) => (
                <details key={f.q} className="hg-tile hg-faq rc-tile">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </ScrollBox>
      </Dialog>
    </Scrim>
  );
}
