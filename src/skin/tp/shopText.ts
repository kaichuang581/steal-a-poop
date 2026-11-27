import { CATALOG, KIND_ONE } from '../shop/catalog';
import type { Item, Kind } from '../shop/catalog';
import { ACHIEVEMENTS, BELLS, MISSIONS, missionFor } from '../shop/economy';
import type { Wallet } from '../shop/economy';
import { SACKS } from '../shop/sacks';

/**
 * The words of the Bell Shelf, Missions and the Barn Book (docs/trading-post-practice/T6), read from the catalogue
 * and the economy's own fields, so a changed price or mission changes what is written.
 */

/** Where a not-found item comes from, in one line: "In the Oat Sack", "30 Bells, Bell Shelf", "Mission: 7 dream nights". */
export function whereFrom(item: Item): string {
  if (item.source === 'sack') return `In the ${SACKS[item.kind].name}`;
  if (item.source === 'bells') return `${item.price} Bells, Bell Shelf`;
  if (item.source === 'mission') { const m = missionFor(item.id); return m ? `Mission: ${m.need} dream nights` : 'Mission'; }
  return 'Starter';
}

/** The rarity word T7 section 7 shows beside its square. */
export function rarityWord(item: Item): string {
  if (item.rarity) return item.rarity[0].toUpperCase() + item.rarity.slice(1);
  return item.source === 'bells' ? 'Bell Shelf' : item.source === 'mission' ? 'Mission' : 'Starter';
}
/** T7 section 7's colours (the game's own where it has them). */
export const RARITY_SQUARE: Record<string, string> = {
  Common: '#8E8A84', Starter: '#8E8A84', Uncommon: '#4E9A6A', Rare: '#4F86C6', Legendary: '#D9A02E', 'Bell Shelf': '#C98A1E', Mission: '#C8643C',
};

/** Under an owned item: "Wearing", or "Found. Wear it". Null when not found. */
export function foundLine(item: Item, w: Wallet): string | null {
  if (!w.owned.includes(item.id)) return null;
  return w.equipped[item.kind] === item.id ? 'Wearing' : 'Found. Wear it';
}

/** A kind's items in the catalogue's order, and how many are found. */
export function bookPage(kind: Kind, w: Wallet): { items: Item[]; found: number } {
  const items = CATALOG.filter((i) => i.kind === kind);
  return { items, found: items.filter((i) => w.owned.includes(i.id)).length };
}
export const bookTotal = (w: Wallet) => ({ found: CATALOG.filter((i) => w.owned.includes(i.id)).length, all: CATALOG.length });

/** A mission slip (T6 section 2): seven or fewer, one stamp per night; more, a knitted row. */
export interface Slip { id: string; item: Item; kind: string; goal: string; have: number; need: number; stamps: boolean[] | null; done: boolean }
export function missionSlips(w: Wallet): Slip[] {
  const slips = MISSIONS.map((m) => {
    const item = CATALOG.find((i) => i.id === m.itemId)!;
    const have = Math.min(m.need, m.have(w));
    return { id: m.id, item, kind: KIND_ONE[item.kind], goal: m.label, have, need: m.need, stamps: m.need <= 7 ? Array.from({ length: m.need }, (_, i) => i < have) : null, done: w.owned.includes(item.id) || have >= m.need };
  });
  // A finished mission moves to the right end.
  return [...slips.filter((s) => !s.done), ...slips.filter((s) => s.done)];
}

/** A milestone row: its goal, progress, and the coins and Bells it pays once. */
export function milestoneRows(w: Wallet): { id: string; goal: string; have: number; need: number; coins: number; bells: number; paid: boolean }[] {
  return ACHIEVEMENTS.map((a) => ({ id: a.id, goal: a.label, have: Math.min(a.need, a.have(w)), need: a.need, coins: a.coins, bells: BELLS.achievement, paid: w.achieved.includes(a.id) }));
}

/** The Bell Shelf's note, from the code's numbers (T6 section 1). */
export const bellsNote = (): [string, string] => [`Golden Bells: +${BELLS.level} every level, +${BELLS.achievement} every milestone, +${BELLS.streak7} every 7 dream nights.`, 'Bells buy only what is on this shelf.'];

/** A Bell Shelf item's one tile (T6 section 1, item 3). */
export function bellTile(item: Item, w: Wallet): { label: string; can: boolean; wearing: boolean } {
  if (w.owned.includes(item.id)) return w.equipped[item.kind] === item.id ? { label: 'Wearing', can: false, wearing: true } : { label: 'Wear it', can: true, wearing: false };
  const short = (item.price ?? 0) - w.bells;
  return short > 0 ? { label: `${short} more Bells`, can: false, wearing: false } : { label: 'Buy', can: true, wearing: false };
}
