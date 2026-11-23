import type { ReactNode } from 'react';
import { InkCard } from '../kit/modern';
import type { CardTone } from '../kit/modern';

export type NoticeTone = 'wood' | 'ice' | 'cold' | 'gold';

/** Each moment's colour: the bar down the card's left. Time's up is bad news (barn), a freeze is ice (frost). */
const TONE: Record<NoticeTone, CardTone> = { wood: 'lantern', gold: 'lantern', cold: 'barn', ice: 'frost' };

/**
 * A moment over the table (time's up, a freeze, a pass, a new letter, whose turn it is): the modern kit's small dark
 * card (kit/modern InkCard), an icon, the title in Fraunces and a line in Nunito (Brian, 2026-11-23: the old hanging
 * plank with nails and snow was "ai generated wood textures"). `snow` is kept for callers and no longer draws anything.
 */
export function Notice({ tone = 'wood', icon, title, sub, size = 'md', className }: {
  tone?: NoticeTone; icon?: ReactNode; title: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg'; snow?: boolean; className?: string;
}) {
  return <InkCard tone={TONE[tone]} icon={icon} title={title} sub={sub} size={size} className={`sk-notice sk-notice-${tone} ${className ?? ''}`} />;
}
