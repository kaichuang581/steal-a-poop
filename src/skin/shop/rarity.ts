import type { Item, Rarity } from './catalog';

/**
 * Rarity, in one table (docs/PLAN_TRADING_POST_REFINE.md Part 3): the order, the words, the colours, and which frame an
 * item's picture hangs in. A frame is a material as well as a colour, so a legendary is told from a common at a glance
 * and without colour: plain plank, plank with a green painted edge, blue-roped corners, gilded with a glint. Items with
 * no rarity (starter, mission, Bell Shelf) have frames of their own.
 */
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };
/** The odds bar, the pips and the machine's lights. */
export const RARITY_COLOR: Record<Rarity, string> = { common: '#a8a29a', uncommon: '#4caf6a', rare: '#4a8fe0', legendary: '#f2b632' };
/** The paper hang tag's tint (the kit's tag, V6 4.2). */
export const RARITY_TINT: Record<Rarity, string> = { common: '#DCD6CB', uncommon: '#CDE3BF', rare: '#C9DDF0', legendary: '#F2D58C' };

export type Frame = Rarity | 'starter' | 'mission' | 'bells';
export const frameOf = (item: Item): Frame => item.rarity ?? (item.source === 'bells' ? 'bells' : item.source === 'mission' ? 'mission' : 'starter');
