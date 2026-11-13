/**
 * A balance, written one way everywhere (docs/PLAN_TRADING_POST_REFINE.md Part 3): 1,250. `short` is for small pegs and
 * badges, where a number above 99,999 would not fit: 100k, 999k, 1.2M.
 */
export function formatCoins(n: number, short = false): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (!short || v <= 99_999) return v.toLocaleString('en-US');
  if (v < 1_000_000) return `${Math.floor(v / 1000)}k`;
  return `${(Math.floor(v / 100_000) / 10).toFixed(1).replace(/\.0$/, '')}M`;
}
