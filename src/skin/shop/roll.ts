import type { Rarity } from './catalog';
import { poolFor, poolOf, RARITIES, SACK } from './sacks';
import type { SackId } from './sacks';

/** Sacks opened since the last rare-or-better, and since the last legendary. Never reset by time. */
export interface Pity { sinceRare: number; sinceLegendary: number }
export const freshPity = (): Pity => ({ sinceRare: 0, sinceLegendary: 0 });

export interface Roll {
  itemId: string;
  tier: Rarity;
  duplicate: boolean;
  /** Wool Coins back for a duplicate, else 0. */
  refund: number;
  counters: Pity;
}

/** A number in [0, 1) that can't be predicted: the browser's or Node's crypto, never a seed. */
export function cryptoRand(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

/** The rarity a plain roll gives, from the odds table. */
export function tierFor(r: number): Rarity {
  let acc = 0;
  for (const t of RARITIES) {
    acc += SACK.odds[t] / 100;
    if (r < acc) return t;
  }
  return 'common';
}

/** The tier this sack must give, if a guarantee is due: legendary on the 40th, rare-or-better on the 10th. */
export function forcedTier(c: Pity, r: number): Rarity | null {
  if (c.sinceLegendary >= SACK.pity.legendary - 1) return 'legendary';
  if (c.sinceRare >= SACK.pity.rare - 1) return r < SACK.pityOdds.legendary / 100 ? 'legendary' : 'rare';
  return null;
}

/** True when every item in this sack is owned: it can't be opened. */
export const sackComplete = (sack: SackId, owned: readonly string[]) => poolFor(sack).every((i) => owned.includes(i.id));

/**
 * One sack of the given kind. `rand` is called twice: the tier, then the item within it (each item in a tier equally likely). A rare
 * or legendary roll never gives a duplicate: with every item of that tier owned, it moves down to the next tier with
 * one unowned (and up, if none below has). Commons and uncommons may repeat, for a refund. Null if the pool is complete.
 */
export function rollSack(sack: SackId, owned: readonly string[], counters: Pity, rand: () => number): Roll | null {
  if (sackComplete(sack, owned)) return null;
  const has = new Set(owned);
  let tier = forcedTier(counters, rand()) ?? tierFor(rand());
  if (tier === 'rare' || tier === 'legendary') {
    const unowned = (t: Rarity) => poolOf(sack, t).some((i) => !has.has(i.id));
    if (!unowned(tier)) {
      const at = RARITIES.indexOf(tier);
      const down = RARITIES.slice(0, at).reverse().find(unowned);
      tier = down ?? RARITIES.slice(at + 1).find(unowned) ?? tier;
    }
  }
  const nonDup = tier === 'rare' || tier === 'legendary';
  const choices = poolOf(sack, tier).filter((i) => !nonDup || !has.has(i.id));
  const item = choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
  const duplicate = has.has(item.id);
  const gotRare = tier === 'rare' || tier === 'legendary';
  return {
    itemId: item.id, tier, duplicate, refund: duplicate ? SACK.refund[tier] : 0,
    counters: { sinceRare: gotRare ? 0 : counters.sinceRare + 1, sinceLegendary: tier === 'legendary' ? 0 : counters.sinceLegendary + 1 },
  };
}
