import { Px } from '../skin/components/PixelIcons';
import { useEffect, useRef } from 'react';
import pkg from '../../package.json';
import { GAME_TITLE } from '../config';

/** Licenses are those of the packages' own published terms. The versions come from package.json. */
const LICENSES: Record<string, { name: string; license: string }> = {
  react: { name: 'React', license: 'MIT' },
  'react-dom': { name: 'React DOM', license: 'MIT' },
  zustand: { name: 'Zustand', license: 'MIT' },
  'framer-motion': { name: 'Framer Motion', license: 'MIT' },
  tailwindcss: { name: 'Tailwind CSS', license: 'MIT' },
  vite: { name: 'Vite', license: 'MIT' },
  vitest: { name: 'Vitest', license: 'MIT' },
  typescript: { name: 'TypeScript', license: 'Apache-2.0' },
};

const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
const used = Object.entries(LICENSES).filter(([id]) => id in deps);

export function Credits({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Credits"
        tabIndex={0} className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border-2 border-wood-light bg-[#1a1145] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black text-amber-300">Credits</h2>
          <button ref={closeRef} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close" title="Close"><Px e="✕" /></button>
        </div>
        <p className="mb-3 text-sm text-white/80">{GAME_TITLE} v{pkg.version}</p>

        <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">Word list</h3>
        <p className="mb-3 mt-1 text-sm text-white/80">
          ENABLE (Enhanced North American Benchmark Lexicon), a public-domain word list, as published at{' '}
          <a className="underline" href="https://github.com/dolph/dictionary" target="_blank" rel="noreferrer">github.com/dolph/dictionary</a>.
        </p>

        <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">Software</h3>
        <ul className="mb-3 mt-1 space-y-1 text-sm">
          {used.map(([id, info]) => (
            <li key={id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5">
              <span>{info.name} <span className="text-white/50">{String(deps[id]).replace('^', '')}</span></span>
              <span className="text-white/70">{info.license}</span>
            </li>
          ))}
        </ul>

        <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">Fonts and sound</h3>
        <p className="mt-1 text-sm text-white/80">
          Text uses your device’s built-in fonts, so no font files are bundled. All sounds are generated in
          your browser; there are no audio files.
        </p>
      </div>
    </div>
  );
}
