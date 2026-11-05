import type { ReactNode } from 'react';

export type PixelTone = 'gold' | 'green' | 'gray' | 'flame' | 'ice';

/** A small pixel-art tag (a framed chip in the pixel font): "daily", "new", "soon", a streak count. */
export function PixelTag({ tone = 'gold', children, label }: { tone?: PixelTone; children: ReactNode; label?: string }) {
  return <span className="sk-pixel-tag" data-tone={tone} aria-label={label}>{children}</span>;
}
