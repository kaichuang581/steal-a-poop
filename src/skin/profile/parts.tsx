import type { CSSProperties, ReactNode } from 'react';

/** The icon tiles' colours (the profile plan v2, section 2.3): Home's palette, one per section. */
export type TileTone = 'dusk' | 'lantern' | 'barn' | 'pasture' | 'night';
const TONE: Record<TileTone, string> = { dusk: 'var(--hm-dusk)', lantern: 'var(--hm-lantern-lip)', barn: 'var(--hm-barn)', pasture: 'var(--hm-pasture)', night: 'var(--hm-night)' };

/** A coloured square holding an icon at 24: a lit top step and a darker bottom step, as Home's menu tiles. */
export function IconTile({ tone, size = 36, children }: { tone: TileTone; size?: 32 | 36; children: ReactNode }) {
  return <span className="pf-itile" data-size={size} style={{ '--tile': TONE[tone] } as CSSProperties} aria-hidden="true">{children}</span>;
}

/**
 * A section (the profile plan v2, section 2.2): one raised card with its title inside it, the icon tile, the title and
 * anything on its right on one 36-high row, then a groove, then the content. `grow` lets the card stretch so both columns
 * end level, its content taking the extra height.
 */
export function Section({ id, tone, icon, title, tools, className, grow = false, children }: {
  id: string; tone: TileTone; icon: ReactNode; title: string; tools?: ReactNode; className?: string; grow?: boolean; children: ReactNode;
}) {
  return (
    <section className={`pf-card pf-sec ${className ?? ''}`} data-grow={grow || undefined} aria-labelledby={id}>
      <div className="pf-sec-head">
        <IconTile tone={tone}>{icon}</IconTile>
        <h3 id={id}>{title}</h3>
        {tools && <span className="pf-sec-tools">{tools}</span>}
      </div>
      <i className="pf-groove" aria-hidden="true" />
      <div className="pf-sec-body">{children}</div>
    </section>
  );
}

/** Kept for any older caller: a section header row alone. */
export function SectionHead({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="pf-sec-head">
      <span className="pf-sec-icon" aria-hidden="true">{icon}</span>
      <h3 id={id}>{title}</h3>
      {children && <span className="pf-sec-tools">{children}</span>}
    </div>
  );
}
