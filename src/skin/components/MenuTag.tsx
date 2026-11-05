import type { ReactNode } from 'react';

export type TagTone = 'gold' | 'green' | 'gray' | 'flame';

/** A small soft tag beside a menu item or a name: "daily", "new", "soon", a streak. */
export function MenuTag({ tone = 'gold', children, label }: { tone?: TagTone; children: ReactNode; label?: string }) {
  return <span className="sk-soft-tag" data-tone={tone} aria-label={label}>{children}</span>;
}
