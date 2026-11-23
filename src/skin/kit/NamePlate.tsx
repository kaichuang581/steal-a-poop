import type { ReactNode } from 'react';
import './nameplate.css';

/**
 * The one name tag over an animal, in every place a player stands: the barn table (Quick play, rooms, the daily table),
 * practice on the ice, the tutorial, the pen and the winning podium (Brian, 2026-11-23: "make the nametags more
 * consistent across all the gamemodes ... the nametags for the coregameplay and this are completely different").
 * Home's slab, not a button: a knitted wool face, ink name in Fraunces, a side and a hard shadow (docs/pen/PEN-PLAN-V3.md
 * 9.3). Yours is lantern; the animal whose turn it is is barn red (the table's old berry), and that wins over yours.
 * `lead` sits before the name (the host's crown, a bot's badge), `trail` after it (the wool balls); `over` is laid on
 * top (a frozen animal's ice). It needs Home's tokens: wrap it in `.hm.rc` where the page has none (`tokens`).
 */
export function NamePlate({ name, you = false, turn = false, lead, trail, over, frozen = false, tokens = false, className = '' }: {
  name: string; you?: boolean; turn?: boolean; lead?: ReactNode; trail?: ReactNode; over?: ReactNode; frozen?: boolean;
  /** Bring Home's tokens along (a page that is not drawn in Home's slabs: the table, the podium). */ tokens?: boolean;
  className?: string;
}) {
  const tone = turn ? 'turn' : you ? 'you' : 'wool';
  const plate = (
    <span className={`np-plate hm-slab hm-knit rc-static ${tone === 'you' ? 'hm-slab--lantern' : ''} ${className}`} data-tone={tone} data-you={you || undefined} data-frozen={frozen || undefined}>
      {lead}<b className="np-name">{name}</b>{you && <span className="np-sr">(you)</span>}{trail && <span className="np-trail">{trail}</span>}{over}
    </span>
  );
  return tokens ? <span className="np hm rc">{plate}</span> : plate;
}
