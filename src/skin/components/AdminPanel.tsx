import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { useAdmin } from '../../lib/admin';
import { PhotoAvatar } from '../avatars/PhotoAvatar';
import { pokeAvatar, setAvatar, useAvatar } from '../avatars/store';
import { CloseIcon, LockIcon } from './Icons';
import { Chip, ClothButton, PaperPanel, WoodButton } from './Materials';
import { Brass, Lever, RopeSlider } from '../kit';
import { GLARE, LENGTH, setKaiyanLook, useKaiyanLook } from '../avatars/kaiyanLook';
import { previewEnd } from '../admin/endPreview';
import type { EndPreview } from '../admin/endPreview';

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
          <h2 className="sk-display flex items-center gap-2 text-xl"><span className="kit-peg kit-peg--light kit-peg--sm" style={{ width: 30, height: 30, cursor: 'default' }}><LockIcon size={16} /></span> Admin access</h2>
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
            <AdminCoins />
            <KaiyanSliders />
            {/* Jump straight to the end of a game to see the results screens; nothing is recorded. */}
            <section className="sk-paper mt-3 p-2" aria-label="See the end screens">
              <b className="sk-display block text-base">Skip to the end</b>
              <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>Deal a game and jump to its results. Nothing counts toward your stats.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {([['won', 'Win a game'], ['lost', 'Lose a game'], ['run', 'Practice run over']] as [EndPreview, string][]).map(([kind, label]) => (
                  <ClothButton key={kind} className="sk-btn" onClick={() => { if (previewEnd(kind)) onClose(); }}>{label}</ClothButton>
                ))}
              </div>
            </section>
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
              <Brass type="submit" disabled={!password || busy} className="flex-1">Unlock</Brass>
            </div>
          </form>
        )}
      </PaperPanel>
    </div>
  );
}

/** How long Kaiyan's forehead is and how hard it shines, on this device (src/skin/avatars/kaiyanLook.ts). */
function KaiyanSliders() {
  const { length, glare } = useKaiyanLook();
  const row = (label: string, value: number, r: { min: number; max: number; step: number }, set: (v: number) => void) => (
    <label className="mt-1 flex items-center gap-2">
      <span className="sk-hand w-20 shrink-0 text-sm" style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <RopeSlider className="min-w-0 flex-1" min={r.min} max={r.max} step={r.step} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
      <span className="sk-hand w-10 shrink-0 text-right text-sm">×{value.toFixed(1)}</span>
    </label>
  );
  return (
    <section className="sk-paper mt-3 p-2" aria-label="Kaiyan's head">
      <div className="flex items-center justify-between gap-2">
        <b className="sk-display block text-base">Kaiyan’s head</b>
        <ClothButton className="sk-btn" onClick={() => setKaiyanLook(null)}>Reset</ClothButton>
      </div>
      {row('Forehead', length, LENGTH, (v) => setKaiyanLook({ length: v }))}
      {row('Glare', glare, GLARE, (v) => setKaiyanLook({ glare: v }))}
    </section>
  );
}

/** The Trading Post's unlimited Wool Coins, for trying sacks: this browser only, never the account's wallet. */
function AdminCoins() {
  const coins = useAdmin((s) => s.coins);
  const setCoins = useAdmin((s) => s.setCoins);
  return (
    <section className="sk-paper mt-3 flex items-center gap-3 p-2" aria-label="Admin coins">
      <div className="min-w-0 flex-1">
        <b className="sk-display block text-base">Unlimited Wool Coins</b>
        <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>
          {coins ? 'On: Feed Sacks cost nothing here. Your real coins come back when you turn it off.' : 'Off. This browser only, never the account’s wallet.'}
        </p>
      </div>
      <Lever checked={coins} onChange={setCoins} label="Unlimited Wool Coins" />
    </section>
  );
}
