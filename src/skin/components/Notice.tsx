import type { ReactNode } from 'react';
import { SnowCap } from './SnowCap';

export type NoticeTone = 'wood' | 'steal' | 'ice' | 'cold' | 'gold';

/** Each moment's paint on the kit's plank (V6 Part 4.1): a steal is barn red, your turn the lantern's gold. */
const TONE: Record<NoticeTone, string> = { wood: '', steal: 'kit-plank--barn', ice: 'kit-plank--ice', cold: 'kit-plank--cold', gold: 'kit-plank--gold' };

/**
 * A hanging signboard for the moments over the table (a steal, a freeze, time's up, the round's twist): the kit's
 * `Board heading`, a sawn plank with grain, two nails and a snow cap, painted per moment. Big carved text, an optional
 * pixel icon, and a small hand-lettered line under it.
 */
export function Notice({ tone = 'wood', icon, title, sub, size = 'md', snow = true, className }: {
  tone?: NoticeTone; icon?: ReactNode; title: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg'; snow?: boolean; className?: string;
}) {
  return (
    <div className={`kit-plank kit-plank--heading ${TONE[tone]} sk-notice sk-notice-${tone} sk-notice-${size} ${className ?? ''}`}>
      {snow && <SnowCap className="kit-snow" />}
      <span className="kit-nail sk-nail sk-notice-nail-l" />
      <span className="kit-nail sk-nail sk-notice-nail-r" />
      <span className="sk-notice-title">{icon && <span className="sk-notice-icon">{icon}</span>}{title}</span>
      {sub && <span className="sk-notice-sub">{sub}</span>}
    </div>
  );
}
