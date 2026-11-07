import type { Part } from './rig';

/**
 * Worn items (V5 Part 4.8): the catalogue's `worn` id maps to a voxel accessory on the head or neck, built once per
 * item. Items not yet built fall back to nothing, never to a placeholder: today none is built, so every id maps to
 * nothing and the catalogue carries none. The ids are the plan's table, kept here so the catalogue stays typed.
 */
export const WORN_IDS = ['scarf', 'strawHat', 'sunHat', 'cap', 'topHat', 'chefHat', 'nightCap', 'flowerCrown', 'bow', 'crown', 'headphones', 'shades', 'goggles', 'helmet', 'rosette', 'hood', 'stripe'] as const;
export type WornId = (typeof WORN_IDS)[number];

const BUILT: Partial<Record<WornId, (headWidth: number, colour: string) => Part>> = {};

/** The worn item's part for a species' head width, or nothing when the item is unknown or not yet built. */
export function wornItem(worn: string | undefined, headWidth: number, colour: string): Part | undefined {
  if (!worn || !(WORN_IDS as readonly string[]).includes(worn)) return undefined;
  const build = BUILT[worn as WornId];
  return build ? build(headWidth, colour) : undefined;
}
