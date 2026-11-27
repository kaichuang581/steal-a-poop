import { BookIcon, CheckIcon, GearIcon, GustIcon, LanternIcon, LockIcon, PlayIcon, ResetIcon } from '../components/Icons';
import { useEffect, useRef, useState } from 'react';
import { resetTips } from '../../lib/tips';
import { useStore } from '../../state/store';
import { AccountPanel } from '../../ui/auth/AccountPanel';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { PaintedCredits } from '../components/PaintedCredits';
import { Switch } from '../kit';
import { Dialog, Group, Row, Scrim, Slab } from '../kit/modern';
import { useAuth } from '../../auth/authStore';
import { SaveCodeRow } from '../components/SaveCodeRow';
import '../components/hud-guide.css';

/**
 * Settings: the kit's dialog under its ribbon, the settings in four named groups, each on a raised tile with an icon
 * tile, its name and a line saying what it does; switches lit in lantern when on, small slabs for the rest. It grows
 * downward from a fixed top, so opening Paste moves nothing above it.
 */
export function PaintedSettings({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const ready = s.dictStatus === 'ready';
  const rows = useRef<HTMLDivElement>(null);
  const [tipsCleared, setTipsCleared] = useState(false);
  const [credits, setCredits] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const status = useAuth((a) => a.status);
  const signedOut = status !== 'ready' && status !== 'needsProfile';

  useEffect(() => {
    rows.current?.closest('.md-dialog')?.querySelector<HTMLElement>('.md-dialog-close')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Scrim onClose={onClose} className="hg-top">
      <Dialog title={<span id="settings-head">Settings</span>} icon={<GearIcon size={20} />} label="Settings" onClose={onClose} className="hg hg-settings" onClick={(e) => e.stopPropagation()}>
        <div ref={rows} className="hg-groups">
          <Group title="Account">
            {signedOut
              ? <Row icon={<LockIcon size={18} />} tone="pasture" label="Playing as a guest" hint="Sign in to keep your records on any device."><Slab size="sm" tone="lantern" onClick={() => setSignIn(true)}>Sign in</Slab></Row>
              : <div className="hg-account empty:hidden"><AccountPanel onSignIn={() => setSignIn(true)} /></div>}
          </Group>
          <Group title="Comfort">
            <Row icon={<GustIcon size={20} />} tone="dusk" label="Reduce motion" hint="Fewer moving things on screen."><Switch checked={s.reduceMotion} onChange={s.setReduceMotion} label="Reduce motion" /></Row>
            <Row icon={<span className="hg-aa">Aa</span>} tone="dusk" label="Larger text" hint="Bigger words in every game."><Switch checked={s.largeText} onChange={s.setLargeText} label="Larger text" /></Row>
          </Group>
          <Group title="Help">
            <Row icon={<PlayIcon size={18} />} tone="lantern" label="Tutorial" hint="Walk through a first game again.">
              <Slab size="sm" aria-label="Replay tutorial" disabled={!ready} onClick={() => s.startTour('menu')}>Replay</Slab>
            </Row>
            <Row icon={<LanternIcon size={20} />} tone="lantern" label="Gameplay tips" hint="Bring back the tips shown on your first games.">
              <Slab size="sm" aria-label="Show gameplay tips again" onClick={() => { resetTips(); setTipsCleared(true); }}>
                {tipsCleared ? <><CheckIcon size={14} /> Reset</> : <><ResetIcon size={16} /> Show again</>}
              </Slab>
            </Row>
          </Group>
          <Group title="Your records">
            <SaveCodeRow />
            <Row icon={<BookIcon size={20} />} tone="frost" label="Credits and licenses" hint="Who and what made the game.">
              <Slab size="sm" aria-label="Credits and licenses" onClick={() => setCredits(true)}>Open</Slab>
            </Row>
          </Group>
        </div>
      </Dialog>
      {credits && <PaintedCredits onClose={() => setCredits(false)} />}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </Scrim>
  );
}
