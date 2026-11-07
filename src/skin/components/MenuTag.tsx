import type { ReactNode } from 'react';

export type TagTone = 'gold' | 'green' | 'gray' | 'flame';

/** A paper hang tag beside a menu item or a name: "daily", "new", "soon", a streak (V6 4.2, the kit's tag). */
export function MenuTag({ tone = 'gold', children, label }: { tone?: TagTone; children: ReactNode; label?: string }) {
  return <span className={`kit-tag kit-tag--${tone}`} aria-label={label}>{children}</span>;
}
