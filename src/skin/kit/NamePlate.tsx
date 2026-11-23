import type { ReactNode } from 'react';
import './nameplate.css';

/**
 * The one name tag over an animal, in every place a player stands: the barn table (Quick play, rooms, the daily table),
 * practice on the ice, the tutorial, the pen and the winning podium (Brian, 2026-11-23: "make the nametags more
 * consistent across all the gamemodes"; then, of a wool slab: "less like a random white bar"; picked from mock-ups
 * as clean and quiet, "the 3 dots are really large ... same with all the text"). A small flat dark tag with a stepped
 * point at its animal: the name in cream Fraunces 700, 13; yours in lantern; the animal whose turn it is gets a lantern
 * tag a step bigger. Wool balls are small dots after the name (lost ones dimmed). `lead` sits before the name (the
 * host's crown, a bot's badge); `over` is laid on top (a frozen animal's ice). It needs Home's tokens: pass `tokens`
 * where the page has none (the table, the podium).
 */
export function NamePlate({ name, you = false, turn = false, lead, lives, over, frozen = false, tokens = false, className = '' }: {
  name: string; you?: boolean; turn?: boolean; lead?: ReactNode; lives?: { left: number; max: number }; over?: ReactNode; frozen?: boolean;
  /** Bring Home's tokens along (a page that is not drawn in Home's slabs: the table, the podium). */ tokens?: boolean;
  className?: string;
}) {
  const plate = (
    <span className={`np-plate ${className}`} data-tone={turn ? 'turn' : you ? 'you' : 'wool'} data-you={you || undefined} data-frozen={frozen || undefined}>
      {lead}<b className="np-name">{name}</b>{you && <span className="np-sr">(you)</span>}
      {lives && (
        <span className="np-lives" role="img" aria-label={`${lives.left} wool ball${lives.left === 1 ? '' : 's'} left`} data-lives={lives.left}>
          {Array.from({ length: Math.max(lives.max, lives.left) }, (_, i) => <i key={i} data-off={i >= lives.left || undefined} />)}
        </span>
      )}
      {over}
    </span>
  );
  return tokens ? <span className="np hm rc">{plate}</span> : plate;
}
