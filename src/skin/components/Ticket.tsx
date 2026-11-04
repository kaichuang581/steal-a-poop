import type { ReactNode } from 'react';

/** Paper mode ticket for Home: icon, title, one line. */
export function Ticket({ title, line, icon, disabled, onSelect, tone = 'paper' }: {
  title: ReactNode; line: ReactNode; icon: ReactNode; disabled?: boolean; onSelect: () => void; tone?: 'paper' | 'cloth';
}) {
  return (
    <button
      onClick={onSelect} disabled={disabled}
      className="sk-paper flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        transition: 'transform var(--t-fast) var(--ease-out)',
        borderLeft: tone === 'cloth' ? '8px solid var(--cloth-dark)' : '8px dashed var(--paper-edge)',
      }}
    >
      <span className="text-3xl" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="sk-display block text-xl leading-tight">{title}</span>
        <span className="block text-sm font-semibold" style={{ color: 'var(--ink-soft)' }}>{line}</span>
      </span>
    </button>
  );
}
