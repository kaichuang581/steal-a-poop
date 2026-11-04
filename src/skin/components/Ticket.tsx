import type { ReactNode } from 'react';

/** Paper mode ticket for Home: icon, title, one line. Lifts 2 px on hover, sinks 1 px on press (skin.css). */
export function Ticket({ title, line, icon, disabled, onSelect, tone = 'paper' }: {
  title: ReactNode; line: ReactNode; icon: ReactNode; disabled?: boolean; onSelect: () => void; tone?: 'paper' | 'cloth';
}) {
  return (
    <button
      onClick={onSelect} disabled={disabled}
      className="sk-paper sk-ticket flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderLeft: tone === 'cloth' ? '8px solid var(--cloth-dark)' : '8px dashed var(--paper-edge)' }}
    >
      <span className="flex w-10 shrink-0 justify-center" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="sk-display block text-xl leading-tight">{title}</span>
        <span className="block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>{line}</span>
      </span>
    </button>
  );
}
