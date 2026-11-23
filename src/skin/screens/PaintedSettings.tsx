import { CheckIcon, PlayIcon, ResetIcon } from '../components/Icons';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { resetTips } from '../../lib/tips';
import { useStore } from '../../state/store';
import { AccountPanel } from '../../ui/auth/AccountPanel';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { PaintedCredits } from '../components/PaintedCredits';
import { Switch } from '../kit';
import { Dialog, Scrim, Slab } from '../kit/modern';
import { SaveCodeRow } from '../components/SaveCodeRow';
import '../components/hud-guide.css';

/** One setting: a raised tile (the pen's rows), its name on the left and its control on the right. */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="hg-tile rc-tile"><span className="hg-label">{label}</span><span className="hg-end">{children}</span></div>
);

/**
 * Settings: the modern kit's dialog (the pen's board), each setting on its own raised tile, switches lit in lantern when
 * on, small wool slabs for the rest. It grows downward from a fixed top, so opening Paste moves nothing above it.
 */
export function PaintedSettings({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const ready = s.dictStatus === 'ready';
  const rows = useRef<HTMLDivElement>(null);
  const [tipsCleared, setTipsCleared] = useState(false);
  const [credits, setCredits] = useState(false);
  const [signIn, setSignIn] = useState(false);

  useEffect(() => {
    rows.current?.closest('.md-dialog')?.querySelector<HTMLElement>('.md-dialog-close')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Scrim onClose={onClose} className="hg-top">
      <Dialog title={<span id="settings-head">Settings</span>} label="Settings" onClose={onClose} className="hg hg-settings" onClick={(e) => e.stopPropagation()}>
        <div ref={rows} className="hg-list">
          <div className="hg-account empty:hidden"><AccountPanel onSignIn={() => setSignIn(true)} /></div>
          <Row label="Reduce motion"><Switch checked={s.reduceMotion} onChange={s.setReduceMotion} label="Reduce motion" /></Row>
          <Row label="Larger text"><Switch checked={s.largeText} onChange={s.setLargeText} label="Larger text" /></Row>
          <Row label="Tutorial">
            <Slab size="sm" aria-label="Replay tutorial" disabled={!ready} onClick={() => s.startTour('menu')}><PlayIcon size={14} /> Replay</Slab>
          </Row>
          <Row label="Gameplay tips">
            <Slab size="sm" aria-label="Show gameplay tips again" onClick={() => { resetTips(); setTipsCleared(true); }}>
              {tipsCleared ? <><CheckIcon size={14} /> Reset</> : <><ResetIcon size={16} /> Show again</>}
            </Slab>
          </Row>
          <SaveCodeRow />
          <Row label="Credits and licenses">
            <Slab size="sm" aria-label="Credits and licenses" onClick={() => setCredits(true)}>Open</Slab>
          </Row>
        </div>
      </Dialog>
      {credits && <PaintedCredits onClose={() => setCredits(false)} />}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </Scrim>
  );
}
