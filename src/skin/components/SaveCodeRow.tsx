import { useState } from 'react';
import { applyImport, exportSave, planImport } from '../../lib/savecode';
import type { ImportPlan } from '../../lib/savecode';
import { Slab } from '../kit/modern';
import './hud-guide.css';

const CHANGE: Record<string, string> = { new: 'added', merged: 'merged', same: 'already here', kept: 'kept yours' };

/**
 * Settings' save code row (plan v7 Part 6): Copy puts every record in one code to paste into another browser; Paste
 * shows what would change (a dry run) before Restore writes it. The page reloads after a restore so every screen
 * reads the restored records.
 */
export function SaveCodeRow() {
  const [copied, setCopied] = useState<number | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [done, setDone] = useState('');

  const copy = async () => {
    const code = exportSave();
    try { await navigator.clipboard.writeText(code); } catch { window.prompt('Copy your save code:', code); }
    setCopied(code.length);
    setTimeout(() => setCopied(null), 3000);
  };
  const restore = () => {
    const result = applyImport(text);
    if (!result.ok) { setPlan(result); return; }
    setDone(`${result.summary} Reloading…`);
    setTimeout(() => location.reload(), 900);
  };

  return (
    <section className="hg-tile hg-save rc-tile" aria-label="Save code">
      <div className="hg-save-head">
        <span className="hg-label">Save code</span>
        <span className="hg-end">
          <Slab size="sm" className="hg-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Slab>
          <Slab size="sm" onClick={() => { setPasting((p) => !p); setPlan(null); setDone(''); }} aria-expanded={pasting}>Paste</Slab>
        </span>
      </div>
      <p className="hg-sub">
        {copied ? `Copied: ${copied.toLocaleString()} characters. Paste it into Settings on your other browser.` : 'Carry your records to another browser: your bests, your dream streak, your name and avatar.'}
      </p>
      {pasting && (
        <div className="hg-paste">
          <textarea
            className="hg-input hg-code" rows={3} value={text} placeholder="FTW1.…" aria-label="Paste a save code" spellCheck={false}
            onChange={(e) => { setText(e.target.value); setPlan(e.target.value.trim() ? planImport(e.target.value) : null); setDone(''); }}
          />
          {plan && !plan.ok && <p role="alert" className="hg-sub" data-bad>{plan.reason}</p>}
          {plan?.ok && (
            <div className="hg-plan">
              <p className="hg-label">{plan.summary}</p>
              <ul className="hg-sub">
                {plan.rows.map((r) => <li key={r.key}>{r.label}: {CHANGE[r.change]}</li>)}
              </ul>
              {done ? <p className="hg-label" role="status">{done}</p> : (
                <Slab size="sm" tone="lantern" onClick={restore} disabled={!plan.rows.some((r) => r.change === 'new' || r.change === 'merged')}>Restore</Slab>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
