import { useState } from 'react';
import { applyImport, exportSave, planImport } from '../../lib/savecode';
import type { ImportPlan } from '../../lib/savecode';
import { ClothButton, WoodButton } from './Materials';

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
    <section className="kit-panel-row sk-save-row" aria-label="Save code">
      <div className="sk-save-head">
        <span className="sk-save-label">Save code</span>
        <span className="flex gap-2">
          <ClothButton className="kit-btn--sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</ClothButton>
          <WoodButton className="kit-btn--sm" onClick={() => { setPasting((p) => !p); setPlan(null); setDone(''); }} aria-expanded={pasting}>Paste</WoodButton>
        </span>
      </div>
      <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>
        {copied ? `Copied: ${copied.toLocaleString()} characters. Paste it into Settings on your other browser.` : 'Carry your records to another browser: your bests, the bestiary, your dream streak.'}
      </p>
      {pasting && (
        <div className="mt-2">
          <textarea
            className="sk-field w-full font-mono text-xs" rows={3} value={text} placeholder="FTW1.…" aria-label="Paste a save code" spellCheck={false}
            onChange={(e) => { setText(e.target.value); setPlan(e.target.value.trim() ? planImport(e.target.value) : null); setDone(''); }}
          />
          {plan && !plan.ok && <p role="alert" className="sk-hand text-base" style={{ color: 'var(--coral-dark)' }}>{plan.reason}</p>}
          {plan?.ok && (
            <div className="sk-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              <p className="text-base" style={{ color: 'var(--ink)' }}>{plan.summary}</p>
              <ul className="list-disc pl-5">
                {plan.rows.map((r) => <li key={r.key}>{r.label}: {CHANGE[r.change]}</li>)}
              </ul>
              {done ? <p className="text-base" role="status">{done}</p> : (
                <ClothButton className="kit-btn--sm mt-1" onClick={restore} disabled={!plan.rows.some((r) => r.change === 'new' || r.change === 'merged')}>Restore</ClothButton>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
