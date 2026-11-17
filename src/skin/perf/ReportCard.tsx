import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ClothButton, Paper, WoodButton } from '../kit';
import { copyDeviceReport, deviceReport, measureDisplayHz } from './report';

/*
 * The cards of docs/visual-overhaul/17-performance-and-stability.md, changes 2 and 8: what a player reads when a scene
 * or the whole game could not be drawn, and the device report at ?report=1. Plain kit paper and the kit's two buttons;
 * every size and place is set here, inline, so a card looks the same wherever a boundary puts it.
 */

const TITLE: CSSProperties = { margin: 0, fontFamily: 'var(--skin-font-display)', fontWeight: 800, fontSize: 18, lineHeight: 1.2 };
const BUTTONS: CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 14px', padding: '2px 4px 6px' };

/** "Copy device report": the text goes to the clipboard and nowhere else. Its width does not change when it says Copied. */
export function CopyReportButton() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <ClothButton type="button" className="kit-btn--sm" style={{ minWidth: '12em' }} onClick={() => { void copyDeviceReport().then(setCopied); }}>
      {copied ? 'Copied' : 'Copy device report'}
    </ClothButton>
  );
}

/**
 * The loading doors open once a scene's canvas has drawn (BarnDoors reads `canvas[data-engine][data-drawn]`). A scene
 * that will never draw says so the same way, with a canvas of nothing, so the doors open on the card instead of
 * standing shut over it until they give up. It comes a moment after the card, to count as new to doors already up.
 */
function DoorsRelease() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 60);
    return () => clearTimeout(t);
  }, []);
  return on ? <canvas data-engine="none" data-drawn="" hidden aria-hidden="true" width={1} height={1} /> : null;
}

/**
 * What is shown in place of something that failed. `fill: 'box'` lies over the failed scene's own box and nothing
 * else (the menus round it still work); `fill: 'screen'` is the whole page, for when the screen itself is gone;
 * `fill: 'window'` stands over the screen in place of a window that could not open, and `onClose` puts it away.
 * `size: 'note'` is the one line alone, for a box too small for buttons.
 */
export function FailCard({ title, note, fill = 'box', place = 'center', size = 'card', onClose }: {
  title: string; note?: ReactNode; fill?: 'box' | 'screen' | 'window'; place?: 'center' | 'top'; size?: 'card' | 'note'; onClose?: () => void;
}) {
  useEffect(() => measureDisplayHz(), []);
  const root: CSSProperties = fill === 'box'
    ? { position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: place === 'top' ? 'start center' : 'center', padding: place === 'top' ? '72px 12px 12px' : 12, pointerEvents: 'none' }
    : { position: 'fixed', inset: 0, zIndex: fill === 'screen' ? 80 : 85, display: 'grid', placeItems: 'center', padding: 16, background: fill === 'screen' ? '#1B1730' : 'rgba(27, 23, 48, 0.6)' };
  return (
    <div style={root} data-scene-failed="">
      <DoorsRelease />
      {size === 'note' ? (
        <Paper kind="slip" role="alert" style={{ pointerEvents: 'auto', maxWidth: '100%', textAlign: 'center' }}>{title}</Paper>
      ) : (
        <Paper kind="note" role="alert" style={{ pointerEvents: 'auto', width: 'min(340px, 100%)', display: 'grid', gap: 10, textAlign: 'center' }}>
          <p style={TITLE}>{title}</p>
          {note && <p style={{ margin: 0 }}>{note}</p>}
          <div style={BUTTONS}>
            <WoodButton type="button" className="kit-btn--sm" onClick={() => location.reload()}>Reload</WoodButton>
            <CopyReportButton />
            {onClose && <WoodButton type="button" className="kit-btn--sm" onClick={onClose}>Close</WoodButton>}
          </div>
        </Paper>
      )}
    </div>
  );
}

/** The device report on its own card, over whatever is on screen (the doors included): the page at ?report=1. */
export function ReportCard({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(() => deviceReport());
  useEffect(() => {
    measureDisplayHz();
    // The frame rates fill in as the scene behind draws: the text follows them.
    const t = setInterval(() => setText(deviceReport()), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 95, width: 'min(600px, calc(100vw - 24px))' }}>
      <Paper kind="note" role="dialog" aria-label="Device report" style={{ display: 'grid', gap: 10 }}>
        <h2 style={TITLE}>Device report</h2>
        <p style={{ margin: 0 }}>This is what your device told the game. It is not sent anywhere. Copy it and paste it to whoever asked for it.</p>
        <textarea
          readOnly value={text} rows={13} aria-label="The device report" spellCheck={false} onFocus={(e) => e.currentTarget.select()}
          style={{ width: '100%', resize: 'none', padding: 8, fontFamily: 'var(--skin-font-body)', fontSize: 13, lineHeight: 1.4, color: 'var(--ink)', background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--ink-soft)', borderRadius: 2, whiteSpace: 'pre', overflow: 'auto' }}
        />
        <div style={BUTTONS}>
          <CopyReportButton />
          <WoodButton type="button" className="kit-btn--sm" onClick={onClose}>Close</WoodButton>
        </div>
      </Paper>
    </div>
  );
}
