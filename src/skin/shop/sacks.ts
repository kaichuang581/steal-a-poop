import { CATALOG, KINDS } from './catalog';
import { RARITIES, RARITY_LABEL } from './rarity';
import type { Item, Kind, Rarity } from './catalog';

/**
 * Feed Sacks (docs/PLAN_TRADING_POST_V2.md Part 3): the one place the odds, pity, refunds and the season's pool are
 * written down. The roll (roll.ts) and the screen both read this file, so the odds shown are the odds used.
 */
export { RARITIES, RARITY_COLOR, RARITY_LABEL, RARITY_TINT } from './rarity';

export const SACK = {
  /** Wool Coins only, one at a time. */
  price: 250,
  /** The chance of each rarity, in percent. */
  odds: { common: 62, uncommon: 28, rare: 8, legendary: 2 } as Record<Rarity, number>,
  /** Rare or better at least every `rare` sacks; legendary at least every `legendary` sacks. */
  pity: { rare: 10, legendary: 40 },
  /** When the rare pity forces the roll: rare 80%, legendary 20%. */
  pityOdds: { rare: 80, legendary: 20 },
  /** Wool Coins back for an item already owned. */
  refund: { common: 60, uncommon: 120, rare: 250, legendary: 600 } as Record<Rarity, number>,
  season: 'Winter',
} as const;

/**
 * Three sacks, one kind of item each, never mixed: the Oat Sack holds bomb skins, the Corn Sack bursts, the Barley Sack
 * fuse sounds. Each has its own pool, odds, pity counters and log. A sack is a farm feed sack, its burlap and stencil
 * telling them apart on the shelf.
 */
export type SackId = Kind;
export const SACK_IDS: readonly SackId[] = KINDS;
export const SACKS: Record<SackId, { name: string; holds: string; burlap: string; shade: string; print: string }> = {
  bomb: { name: 'Oat Sack', holds: 'Bomb skins only', burlap: '#c9a66b', shade: '#a8824a', print: '#5a7a9a' },
  blast: { name: 'Corn Sack', holds: 'Bursts only', burlap: '#d6b45a', shade: '#b08c3a', print: '#a8461e' },
  tick: { name: 'Barley Sack', holds: 'Fuse sounds only', burlap: '#bfae86', shade: '#9a8a62', print: '#4a6a3a' },
};
export const isSackId = (v: unknown): v is SackId => typeof v === 'string' && (SACK_IDS as readonly string[]).includes(v);

/** This season's items, by sack: every `sack` item of that kind. Sacks are the only way to get them. */
export const POOL: readonly Item[] = CATALOG.filter((i) => i.source === 'sack' && !!i.rarity);
export const poolFor = (sack: SackId) => POOL.filter((i) => i.kind === sack);
export const poolOf = (sack: SackId, r: Rarity) => poolFor(sack).filter((i) => i.rarity === r);

/** "Common 62% · Uncommon 28% · Rare 8% · Legendary 2%" */
export const oddsLine = () => RARITIES.map((r) => `${RARITY_LABEL[r]} ${SACK.odds[r]}%`).join(' · ');
