import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { exportLog, readLog } from '../../hunt/log';
import { useAdmin } from '../../lib/admin';
import { PhotoAvatar } from '../avatars/PhotoAvatar';
import { pokeAvatar, setAvatar, useAvatar } from '../avatars/store';
import { CloseIcon, LockIcon } from './Icons';
import { Chip, ClothButton, PaperPanel, WoodButton } from './Materials';

/**
 * The admin lock: a small paper dialog off the lock button by the avatar. One password, no username; the right one
 * unlocks admin on this device (the night's dream can then be played again and again). Unlocked, the same dialog
 * says so, offers the admin avatar (Brian's photo, equipped and taken off only here) and offers to lock up again,
 * which takes the photo off too.
 */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const admin = useAdmin((s) => s.admin);
  const unlock = useAdmin((s) => s.unlock);
  const lock = useAdmin((s) => s.lock);
  const avatar = useAvatar();
  const wearing = avatar === ADMIN_AVATAR_ID;
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [logCopied, setLogCopied] = useState(false);
  // The Hunt's run log (plan v7 Part 3.2): copied by hand, never sent anywhere.
  const copyLog = async () => {
    const text = exportLog();
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy the hunt log:', text); }
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 2000);
  };
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const ok = await unlock(password);
    setBusy(false);
    if (ok) { setPassword(''); setError(''); }
    else { setError('That is not the password.'); field.current?.select(); }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={onClose}>
      <PaperPanel role="dialog" aria-modal="true" aria-label="Admin access" className="w-full max-w-xs p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="sk-display flex items-center gap-2 text-xl"><LockIcon size={20} /> Admin access</h2>
          <Chip className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        {admin ? (
          <>
            <p className="sk-hand text-lg" style={{ color: 'var(--cloth-dark)' }}>Unlocked on this device.</p>
            <ul className="mt-1 list-disc pl-5 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <li>Counting Sheep: play tonight’s dream as often as you like.</li>
              <li>Stays unlocked until you lock it here.</li>
            </ul>
            <section className="sk-paper mt-3 flex items-center gap-3 p-2" aria-label="Admin avatar">
              <PhotoAvatar size={72} label="Kaiyan, the admin avatar" />
              <div className="min-w-0 flex-1">
                <b className="sk-display block text-base">Admin avatar</b>
                <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>{wearing ? 'On. The others in a room see it too.' : 'Only here, only for admin.'}</p>
                {wearing
                  ? <WoodButton onClick={() => setAvatar(null)} className="sk-btn mt-1" aria-pressed>Unequip</WoodButton>
                  : <ClothButton onClick={() => setAvatar(ADMIN_AVATAR_ID)} className="sk-btn mt-1">Equip</ClothButton>}
              </div>
            </section>
            <div className="mt-3 flex items-center gap-2">
              <ClothButton onClick={copyLog} className="sk-btn">{logCopied ? 'Copied' : 'Copy hunt log'}</ClothButton>
              <span className="sk-hand text-sm" style={{ color: 'var(--ink-soft)' }}>{readLog().length} runs on this device</span>
            </div>
            <div className="mt-3 flex gap-2">
              <WoodButton onClick={() => { if (wearing) setAvatar(null); lock(); pokeAvatar(); setError(''); }} className="sk-btn flex-1">Lock</WoodButton>
              <ClothButton onClick={onClose} className="sk-btn flex-1">Done</ClothButton>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="sk-hand block text-lg" htmlFor="admin-password" style={{ color: 'var(--ink-soft)' }}>Password</label>
            <input
              ref={field} id="admin-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password" className="sk-field mt-1 w-full" aria-invalid={error ? true : undefined} aria-describedby={error ? 'admin-error' : undefined}
            />
            {error && <p id="admin-error" role="alert" className="sk-hand mt-1 text-base" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
            <div className="mt-3 flex gap-2">
              <WoodButton type="button" onClick={onClose} className="sk-btn flex-1">Cancel</WoodButton>
              <ClothButton type="submit" disabled={!password || busy} className="sk-btn flex-1">Unlock</ClothButton>
            </div>
          </form>
        )}
      </PaperPanel>
    </div>
  );
}
