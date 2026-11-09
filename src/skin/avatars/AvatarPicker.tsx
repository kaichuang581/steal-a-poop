import { useEffect, useRef } from 'react';
import { CloseIcon } from '../components/Icons';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { AvatarIcon } from './AvatarIcon';
import { CHARACTERS } from './catalog';
import { setAvatar, useAvatar } from './store';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Every control the browser will tab to inside the dialog, in tab order. */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Six animals, one each. Free to pick, free to change; only for show. */
export function AvatarPicker({ onClose }: { onClose: () => void }) {
  const current = useAvatar();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Move focus into the picker on open, close on Escape, and put focus back on the Avatar button afterwards.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    openerRef.current = active && active !== document.body ? active : null;
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const opener = openerRef.current;
      const target = opener?.isConnected ? opener : document.querySelector<HTMLElement>('button[aria-label="Avatar"]');
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Keep Tab and Shift+Tab inside the dialog, including when focus starts on the dialog container itself.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const items = focusableIn(root);
    if (items.length === 0) {
      e.preventDefault();
      root.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === root || !root.contains(active)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (active === last || !root.contains(active)) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  return (
    <div tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown} className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={onClose}>
      <PaperPanel role="dialog" aria-modal="true" aria-label="Choose your avatar" className="w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="sk-display text-xl">Choose your avatar</h2>
          <Chip className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <p className="sk-hand mb-3 text-base" style={{ color: 'var(--ink-soft)' }}>Only for show: it never changes how the game plays.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CHARACTERS.map((c) => (
            <button key={c.id} type="button" aria-pressed={current === c.id} aria-label={c.name} onClick={() => setAvatar(c.id)} className="sk-avatar-choice">
              <AvatarIcon id={c.id} size={48} label="" />
              <b className="sk-display block text-base">{c.name}</b>
              <span className="sk-hand block text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>{c.blurb}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" aria-pressed={current === null} aria-label="The plain sheep" onClick={() => setAvatar(null)} className="sk-avatar-choice sk-avatar-choice-row">
            <SheepIcon size={28} /><span className="sk-hand text-base">The plain sheep (no avatar)</span>
          </button>
          <WoodButton onClick={onClose} className="sk-btn ml-auto">Done</WoodButton>
        </div>
      </PaperPanel>
    </div>
  );
}
