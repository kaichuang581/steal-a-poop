import { useEffect, useRef } from 'react';
import pkg from '../../../package.json';
import { CloseIcon } from './Icons';
import { Chip } from './Materials';

const LICENSES: Record<string, { name: string; license: string }> = {
  react: { name: 'React', license: 'MIT' },
  'react-dom': { name: 'React DOM', license: 'MIT' },
  zustand: { name: 'Zustand', license: 'MIT' },
  three: { name: 'three.js', license: 'MIT' },
  '@react-three/fiber': { name: 'React Three Fiber', license: 'MIT' },
  '@react-three/drei': { name: 'drei', license: 'MIT' },
  tailwindcss: { name: 'Tailwind CSS', license: 'MIT' },
  vite: { name: 'Vite', license: 'MIT' },
  typescript: { name: 'TypeScript', license: 'Apache-2.0' },
};
const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
const used = Object.entries(LICENSES).filter(([id]) => id in deps);

/** Credits and licenses on a paper sheet. */
export function PaintedCredits({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ background: 'color-mix(in srgb, var(--ink) 55%, transparent)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Credits" className="sk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sk-sheet-head">
          <h2>Credits</h2>
          <Chip ref={closeRef} className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="sk-sheet-body sk-rules">
          <p className="sk-hand text-lg" style={{ color: 'var(--ink-soft)' }}>Finish the Word · v{pkg.version}</p>
          <section>
            <h3>Word list</h3>
            <p className="text-sm">ENABLE (Enhanced North American Benchmark Lexicon), a public-domain word list, as published at{' '}
              <a className="underline" href="https://github.com/dolph/dictionary" target="_blank" rel="noreferrer">github.com/dolph/dictionary</a>.</p>
          </section>
          <section>
            <h3>Software</h3>
            <ul>
              {used.map(([id, info]) => (
                <li key={id} className="sk-rule-row justify-between">
                  <span>{info.name} <span style={{ color: 'var(--ink-soft)' }}>{String(deps[id]).replace('^', '')}</span></span>
                  <span style={{ color: 'var(--ink-soft)' }}>{info.license}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Fonts and sound</h3>
            <p className="text-sm">Fraunces, Nunito, Patrick Hand and DotGothic16 from Google Fonts (SIL Open Font License), and Helvetiker from three.js (MIT).
              All sounds are made in your browser; there are no audio files.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
