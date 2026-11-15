import { rankOf } from '../../lib/ranked';
import { pixelRects } from '../components/pixels';
import { BADGE_H, BADGE_W, badgeArt } from './badge';

/** One rank's badge, drawn at `size` pixels wide. `tier` is 0 (Lamb) to 7 (Golden Fleece). */
export function TierBadge({ tier, size = 40, className }: { tier: number; size?: number; className?: string }) {
  const art = badgeArt(tier);
  return (
    <svg className={className} width={size} height={Math.round((size * BADGE_H) / BADGE_W)} viewBox={`0 0 ${BADGE_W} ${BADGE_H}`} shapeRendering="crispEdges" aria-hidden="true">
      {pixelRects(art.rows, art.colors)}
    </svg>
  );
}

/**
 * A player's rank from their rating: the badge, with the division as one, two or three pips under it (none in the
 * last rank, which has no divisions). The label is read out; the picture is decoration.
 */
export function RankBadge({ rating, size = 40, className }: { rating: number; size?: number; className?: string }) {
  const rank = rankOf(rating);
  return (
    <span className={`sk-rank-badge ${className ?? ''}`} role="img" aria-label={rank.label} title={rank.label}>
      <TierBadge tier={rank.tier} size={size} />
      {rank.division !== null && (
        <span className="sk-rank-pips" aria-hidden="true">{[1, 2, 3].map((d) => <i key={d} data-on={d <= rank.division! || undefined} />)}</span>
      )}
    </span>
  );
}
