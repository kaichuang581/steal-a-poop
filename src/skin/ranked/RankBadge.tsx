import { rankOf } from '../../lib/ranked';
import { pixelRects } from '../components/pixels';
import { TIERS } from '../../lib/ranked';
import { BADGE_H, BADGE_W, badgeArt } from './badge';

/** Zenith's aura: two sets of pixel rays round the rosette (centre 11, 10), drawn past the badge's box. */
const CX = 11, CY = 10;
const ray = (dx: number, dy: number, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => [CX + dx * (from + k), CY + dy * (from + k)] as const);
const LONG = [[0, -1], [1, 0], [0, 1], [-1, 0]].flatMap(([dx, dy]) => ray(dx, dy, 10, 13));
const SHORT = [[1, -1], [1, 1], [-1, 1], [-1, -1]].flatMap(([dx, dy]) => ray(dx, dy, 8, 9));

/** One rank's badge, drawn at `size` pixels wide. `tier` is 0 (Wood) to 7 (Zenith). */
export function TierBadge({ tier, size = 40, className }: { tier: number; size?: number; className?: string }) {
  const art = badgeArt(tier);
  return (
    <svg className={className} width={size} height={Math.round((size * BADGE_H) / BADGE_W)} viewBox={`0 0 ${BADGE_W} ${BADGE_H}`} shapeRendering="crispEdges" aria-hidden="true" style={tier >= TIERS.length - 1 ? { overflow: 'visible' } : undefined}>
      {tier >= TIERS.length - 1 && (
        <>
          <g className="sk-zenith-rays" fill="#FFE38A">{LONG.map(([x, y]) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} />)}</g>
          <g className="sk-zenith-rays" fill="#FFFFFF">{SHORT.map(([x, y]) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} />)}</g>
        </>
      )}
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
