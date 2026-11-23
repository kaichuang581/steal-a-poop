import type { ReactNode } from 'react';

/** A section's header: its icon at 24, the title, and anything on its right. */
export function SectionHead({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="pf-sec-head">
      <span className="pf-sec-icon" aria-hidden="true">{icon}</span>
      <h3 id={id}>{title}</h3>
      {children && <span className="pf-sec-tools">{children}</span>}
    </div>
  );
}
