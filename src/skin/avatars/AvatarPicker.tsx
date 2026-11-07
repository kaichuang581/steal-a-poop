import { CloseIcon } from '../components/Icons';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { AvatarIcon } from './AvatarIcon';
import { CHARACTERS } from './catalog';
import { setAvatar, useAvatar } from './store';

/** Six animals, one each. Free to pick, free to change; only for show. */
export function AvatarPicker({ onClose }: { onClose: () => void }) {
  const current = useAvatar();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={onClose}>
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
