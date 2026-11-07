import { ANIMAL_AVATAR_IDS } from '../../avatars/ids';

export type Animal = (typeof ANIMAL_AVATAR_IDS)[number];
export const ANIMALS: readonly Animal[] = ANIMAL_AVATAR_IDS;

/** One avatar per animal: its portrait's colours and a line about it. Only for show: never changes how the game plays. */
export interface Character {
  id: Animal;
  animal: Animal;
  name: string;
  blurb: string;
  colors: { body: string; shade: string; dark: string; soft: string; pop: string };
}

export const CHARACTERS: readonly Character[] = [
  { id: 'sheep', animal: 'sheep', name: 'Sheep', blurb: 'Woolly, warm and never far from the pile.',
    colors: { body: '#F4EFE6', shade: '#D8D0C2', dark: '#5A4A44', soft: '#FFFFFF', pop: '#E9A6A0' } },
  { id: 'pig', animal: 'pig', name: 'Pig', blurb: 'Sniffs out the long words.',
    colors: { body: '#F5B5C0', shade: '#E393A2', dark: '#3A2A2A', soft: '#F9CBD3', pop: '#C8667A' } },
  { id: 'cow', animal: 'cow', name: 'Cow', blurb: 'Calm, kind and fond of a picnic.',
    colors: { body: '#F6F1E8', shade: '#3B332E', dark: '#3B332E', soft: '#F0B3AE', pop: '#E8D6A8' } },
  { id: 'goat', animal: 'goat', name: 'Goat', blurb: 'Climbs anything, fences included.',
    colors: { body: '#D9CFC0', shade: '#B8AC98', dark: '#3F342E', soft: '#8C8274', pop: '#6B5B4A' } },
  { id: 'horse', animal: 'horse', name: 'Horse', blurb: 'Fast, graceful, first out of the gate.',
    colors: { body: '#B8793D', shade: '#8F5A28', dark: '#2B1B10', soft: '#D9A066', pop: '#3D2713' } },
  { id: 'chicken', animal: 'chicken', name: 'Chicken', blurb: 'Pecks out a word a second.',
    colors: { body: '#F7F1E4', shade: '#DCCFB8', dark: '#2B2222', soft: '#E8A33A', pop: '#D9433B' } },
];

export const byId = (id: string | null | undefined): Character | undefined => CHARACTERS.find((c) => c.id === id);
