import type { ReactNode } from 'react';
import { SnowCap } from './SnowCap';

export type NoticeTone = 'wood' | 'ice' | 'cold' | 'gold';

/**
 * A hanging signboard for the moments over the table (a freeze, time's up, the round's twist): the same
 * nailed, wood-grained, snow-capped boards as the title, painted per moment. Big carved text, an optional pixel icon,
 * and a small hand-lettered line under it.
 */
export function Notice({ tone = 'wood', icon, title, sub, size = 'md', snow = true, className }: {
  tone?: NoticeTone; icon?: ReactNode; title: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg'; snow?: boolean; className?: string;
}) {
  return (
    <div className={`sk-notice sk-notice-${tone} sk-notice-${size} ${className ?? ''}`}>
      {snow && <SnowCap className="sk-notice-snow" />}
      <span className="sk-nail sk-notice-nail-l" />
      <span className="sk-nail sk-notice-nail-r" />
      <span className="sk-notice-title">{icon && <span className="sk-notice-icon">{icon}</span>}{title}</span>
      {sub && <span className="sk-notice-sub">{sub}</span>}
    </div>
  );
}
