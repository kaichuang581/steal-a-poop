import { ANIMALS, CHARACTERS } from './catalog';
import { AvatarIcon } from './AvatarIcon';
import { setAvatar, useAvatar } from './store';

export function AvatarPicker({ onClose }: { onClose: () => void }) {
  const current = useAvatar();
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose your avatar" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" onClick={onClose}>
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
