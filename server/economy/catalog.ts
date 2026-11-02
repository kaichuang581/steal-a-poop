/**
 * What coins can buy. Everything here is cosmetic: it changes how a player looks, never how they score, how long they get, or who
 * wins. Items are fixed lists (a color, a title, a badge), never text a player types, so nothing here needs the chat filter.
 */
export type Slot = 'color' | 'title' | 'badge' | 'theme';
export const SLOTS: readonly Slot[] = ['color', 'title', 'badge', 'theme'];

export interface ShopItem {
  id: string;
  slot: Slot;
  name: string;
  price: number;
  /** color: a CSS color. title: the words shown after the name. badge: an emoji. theme: a table color. */
  value: string;
}

export const CATALOG: readonly ShopItem[] = [
  { id: 'color-gold', slot: 'color', name: 'Gold name', price: 150, value: '#fbbf24' },
  { id: 'color-mint', slot: 'color', name: 'Mint name', price: 100, value: '#6ee7b7' },
  { id: 'color-sky', slot: 'color', name: 'Sky name', price: 100, value: '#7dd3fc' },
  { id: 'color-rose', slot: 'color', name: 'Rose name', price: 100, value: '#fda4af' },
  { id: 'color-violet', slot: 'color', name: 'Violet name', price: 100, value: '#c4b5fd' },
  { id: 'title-thief', slot: 'title', name: 'The Thief', price: 200, value: 'the Thief' },
  { id: 'title-wizard', slot: 'title', name: 'Word Wizard', price: 300, value: 'Word Wizard' },
  { id: 'title-keeper', slot: 'title', name: 'Pile Keeper', price: 250, value: 'Pile Keeper' },
  { id: 'title-quick', slot: 'title', name: 'Quick Fingers', price: 250, value: 'Quick Fingers' },
  { id: 'badge-crown', slot: 'badge', name: 'Crown', price: 400, value: '👑' },
  { id: 'badge-fire', slot: 'badge', name: 'Fire', price: 200, value: '🔥' },
  { id: 'badge-brain', slot: 'badge', name: 'Brain', price: 200, value: '🧠' },
  { id: 'badge-poop', slot: 'badge', name: 'The pile', price: 50, value: '💩' },
  { id: 'theme-night', slot: 'theme', name: 'Night table', price: 250, value: '#12163a' },
  { id: 'theme-forest', slot: 'theme', name: 'Forest table', price: 250, value: '#0f3d2a' },
  { id: 'theme-plum', slot: 'theme', name: 'Plum table', price: 250, value: '#3b1250' },
];

export const itemById = (id: string): ShopItem | undefined => CATALOG.find((i) => i.id === id);

export type { Cosmetics } from '../../src/net/protocol';
import type { Cosmetics } from '../../src/net/protocol';
export const publicCosmetics = (equipped: Partial<Record<Slot, string>>): Cosmetics => {
  const out: Cosmetics = {};
  const v = (slot: Slot) => (equipped[slot] ? itemById(equipped[slot]!)?.value : undefined);
  if (v('color')) out.color = v('color');
  if (v('title')) out.title = v('title');
  if (v('badge')) out.badge = v('badge');
  return out;
};
