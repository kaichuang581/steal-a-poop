import { useEffect, useRef } from 'react';
import { ANIMALS, CHARACTERS } from './catalog';
import { AvatarIcon } from './AvatarIcon';
import { setAvatar, useAvatar } from './store';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Every control the browser will tab to inside the dialog, in tab order. */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

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
    <div role="dialog" aria-modal="true" aria-label="Choose your avatar" tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 outline-none" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-[var(--paper,#f6efe0)] p-4 text-[#2b221d]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Choose your avatar</h2>
          <button className="min-h-11 min-w-11 rounded-lg px-3 font-bold" onClick={onClose}>Done</button>
        </div>
        <p className="mb-3 text-sm">Free to pick, free to change. It is only for show: it never changes how the game plays.</p>
        {ANIMALS.map((a) => (
          <section key={a} className="mb-3">
            <h3 className="mb-1 text-sm font-bold capitalize">{a}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CHARACTERS.filter((c) => c.animal === a).map((c) => (
                <button key={c.id} aria-pressed={current === c.id} aria-label={`${c.name} the ${a}`}
                  onClick={() => setAvatar(c.id)}
                  className={`flex min-h-11 items-start gap-2 rounded-lg border-2 p-2 text-left ${current === c.id ? 'border-[#c0792b] bg-white' : 'border-transparent bg-white/60'}`}>
                  <AvatarIcon id={c.id} size={40} label="" />
                  <span className="text-xs">
                    <b className="block text-sm">{c.name}</b>
                    {c.blurb}
                    <span className="mt-1 block opacity-80">{c.pack.name}: {c.pack.items.join(', ')}</span>
                    <span className="block opacity-80">Skill: {c.skill}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <button className="min-h-11 rounded-lg px-3 text-sm underline" onClick={() => setAvatar(null)}>Use the default sheep</button>
      </div>
    </div>
  );
}
