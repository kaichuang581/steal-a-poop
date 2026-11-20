import { CheckIcon, CloseIcon, PlayIcon, ResetIcon } from '../components/Icons';
import { useEffect, useRef, useState } from 'react';
import { resetTips } from '../../lib/tips';
import { useStore } from '../../state/store';
import { AccountPanel } from '../../ui/auth/AccountPanel';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { PaintedCredits } from '../components/PaintedCredits';
import { Switch, PanelRow, WoodButton } from '../kit';
import { Chip } from '../components/Materials';
import { SnowCap } from '../components/SnowCap';
import { SaveCodeRow } from '../components/SaveCodeRow';

/**
 * The existing settings: a panel of planks under a nailed heading (V6 6.2). Each setting sits on its own
 * plank, its label on a slip of paper; toggles are levers, the volume a rope slider. The save code is plan v7 Part 6.
 */
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'color-mix(in srgb, var(--ink) 45%, transparent)' }} onClick={onClose}>
      {/* The same header as How to play: the title and the close button inside the card. A sign standing over the card
          ran into the menu behind it on a phone (2026-11-20). */}
      <div role="dialog" aria-modal="true" aria-label="Settings" className="sk-guide sk-settings" onClick={(e) => e.stopPropagation()}>
        <div className="sk-guide-head">
          <SnowCap className="sk-guide-snow" />
          <h2 id="settings-head">Settings</h2>
          <Chip ref={closeRef} className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="sk-settings-rows">
          {/* The account panel is written light-on-dark; it sits on a cranberry patch. */}
          <div className="kit-panel-row sk-account-row empty:hidden"><AccountPanel onSignIn={() => setSignIn(true)} /></div>
          <PanelRow label="Reduce motion"><Switch checked={s.reduceMotion} onChange={s.setReduceMotion} label="Reduce motion" /></PanelRow>
          <PanelRow label="Larger text"><Switch checked={s.largeText} onChange={s.setLargeText} label="Larger text" /></PanelRow>
          <PanelRow label="Tutorial">
            <WoodButton className="kit-btn--sm flex items-center gap-2" aria-label="Replay tutorial" disabled={!ready} onClick={() => s.startTour('menu')}><PlayIcon size={14} /> Replay</WoodButton>
          </PanelRow>
          <PanelRow label="Gameplay tips">
            <WoodButton className="kit-btn--sm flex items-center gap-2" aria-label="Show gameplay tips again" onClick={() => { resetTips(); setTipsCleared(true); }}>
              {tipsCleared ? <><CheckIcon size={14} /> Reset</> : <><ResetIcon size={16} /> Show again</>}
            </WoodButton>
          </PanelRow>
          <SaveCodeRow />
          <PanelRow label="Credits and licenses">
            <WoodButton className="kit-btn--sm" aria-label="Credits and licenses" onClick={() => setCredits(true)}>Open</WoodButton>
          </PanelRow>
        </div>
      </div>
      {credits && <PaintedCredits onClose={() => setCredits(false)} />}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </div>
  );
}
