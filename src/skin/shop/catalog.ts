/**
 * The Barn Bazaar's catalogue. Everything here is cosmetic: it changes how the bomb looks, how its burst looks, or how
 * its fuse ticks, never a turn, a word, the clock or who wins. Prices are fixed and shown; nothing is random.
 *
 * `source` says how an item is had: `free` (everyone owns it), `coins` (bought with Wool Coins at `price`), or
 * `streak` (given for reaching a Counting Sheep streak of `streak` nights; kept for good once given).
 */
export type Kind = 'bomb' | 'blast' | 'tick';
export const KINDS: Kind[] = ['bomb', 'blast', 'tick'];
export const KIND_LABEL: Record<Kind, string> = { bomb: 'Bomb skins', blast: 'Bursts', tick: 'Fuse sounds' };

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  blurb: string;
  source: 'free' | 'coins' | 'streak';
  price?: number;
  streak?: number;
  /** Two or three colours for the swatch in the shop (bomb and burst items). */
  swatch: string[];
}

export const CATALOG: readonly Item[] = [
  // Bomb skins: a tint over the ice bomb's shell.
  { id: 'bomb-ice', kind: 'bomb', name: 'Ice', blurb: 'The classic frozen bomb.', source: 'free', swatch: ['#bfe6ff', '#3f97d6'] },
  { id: 'bomb-ember', kind: 'bomb', name: 'Ember', blurb: 'A bomb that glows like a stove.', source: 'coins', price: 400, swatch: ['#ffb37a', '#d9542b'] },
  { id: 'bomb-mint', kind: 'bomb', name: 'Peppermint', blurb: 'Cool, green and minty.', source: 'coins', price: 400, swatch: ['#b8f5d6', '#2fa77a'] },
  { id: 'bomb-plum', kind: 'bomb', name: 'Plum', blurb: 'Deep purple, like a winter evening.', source: 'coins', price: 500, swatch: ['#d9b8f5', '#7a3fb8'] },
  { id: 'bomb-gold', kind: 'bomb', name: 'Gold', blurb: 'For sheep who mean business.', source: 'coins', price: 900, swatch: ['#ffe9a3', '#c99a1f'] },
  { id: 'bomb-aurora', kind: 'bomb', name: 'Aurora', blurb: 'For 7 nights of Counting Sheep in a row.', source: 'streak', streak: 7, swatch: ['#9ff5d0', '#7a7af0'] },
  // Bursts: the colours of the blast when a turn runs out.
  { id: 'blast-frost', kind: 'blast', name: 'Frost', blurb: 'White, ice blue and deep cold blue.', source: 'free', swatch: ['#ffffff', '#5fb8f5', '#173f8f'] },
  { id: 'blast-confetti', kind: 'blast', name: 'Confetti', blurb: 'Every colour at once.', source: 'coins', price: 500, swatch: ['#ff6b6b', '#ffd93d', '#6bcB77'] },
  { id: 'blast-ember', kind: 'blast', name: 'Ember', blurb: 'Gold, orange and red.', source: 'coins', price: 450, swatch: ['#fff2b0', '#ff9a2a', '#c8321a'] },
  { id: 'blast-bubblegum', kind: 'blast', name: 'Bubblegum', blurb: 'Pink and lilac.', source: 'coins', price: 450, swatch: ['#ffe0f0', '#ff7ac0', '#a35ad6'] },
  { id: 'blast-starlight', kind: 'blast', name: 'Starlight', blurb: 'For 30 nights of Counting Sheep in a row.', source: 'streak', streak: 30, swatch: ['#fffbe0', '#a8b8ff', '#4a3f9f'] },
  // Fuse sounds: how the bomb beeps each second.
  { id: 'tick-chime', kind: 'tick', name: 'Ice chime', blurb: 'The bright beep the bomb always had.', source: 'free', swatch: ['#bfe6ff'] },
  { id: 'tick-8bit', kind: 'tick', name: '8-bit', blurb: 'Square-wave beeps, like an old console.', source: 'coins', price: 350, swatch: ['#a3e635'] },
  { id: 'tick-wood', kind: 'tick', name: 'Wood block', blurb: 'A short knock, like a clock in the barn.', source: 'coins', price: 350, swatch: ['#c08a52'] },
  { id: 'tick-lullaby', kind: 'tick', name: 'Lullaby', blurb: 'For 100 nights of Counting Sheep in a row.', source: 'streak', streak: 100, swatch: ['#f5d9ff'] },
];

export const DEFAULTS: Record<Kind, string> = { bomb: 'bomb-ice', blast: 'blast-frost', tick: 'tick-chime' };

export const itemById = (id: string): Item | undefined => CATALOG.find((i) => i.id === id);

/** The shell tint and glow of each bomb skin. White leaves the ice bomb's own colours alone. */
export const BOMB_TINT: Record<string, { color: string; emissive: string }> = {
  'bomb-ice': { color: '#ffffff', emissive: '#3f97d6' },
  'bomb-ember': { color: '#ffb08a', emissive: '#d9542b' },
  'bomb-mint': { color: '#b8f5d6', emissive: '#2fa77a' },
  'bomb-plum': { color: '#d4b0f2', emissive: '#7a3fb8' },
  'bomb-gold': { color: '#ffe08a', emissive: '#c99a1f' },
  'bomb-aurora': { color: '#b8f0e0', emissive: '#7a7af0' },
};

/** The burst's flame colours (hot to cool) and its sparks. */
export const BLAST_PALETTE: Record<string, { flame: string[]; spark: string[] }> = {
  'blast-frost': { flame: ['#ffffff', '#bfe9ff', '#5fb8f5', '#2f7fd6', '#173f8f'], spark: ['#ffffff', '#e6f8ff', '#b6e6ff'] },
  'blast-confetti': { flame: ['#ffffff', '#ffd93d', '#ff6b6b', '#6bcb77', '#4d96ff'], spark: ['#ff6bd6', '#ffd93d', '#4d96ff'] },
  'blast-ember': { flame: ['#fff2b0', '#ffd04a', '#ff9a2a', '#ff5a1e', '#c8321a'], spark: ['#ffffff', '#ffe08a', '#ffb04a'] },
  'blast-bubblegum': { flame: ['#ffffff', '#ffe0f0', '#ff9ad0', '#d66ad6', '#7a3fb8'], spark: ['#ffffff', '#ffd0ea', '#e0b8ff'] },
  'blast-starlight': { flame: ['#ffffff', '#fffbe0', '#d0d8ff', '#8a8af0', '#3a2f8f'], spark: ['#ffffff', '#fff6c8', '#c8d0ff'] },
};

/** The bomb's tick voices, read by src/audio/sound.ts (see `TickVoice` there). */
export const TICK_VOICE: Record<string, 'chime' | 'square' | 'wood' | 'lullaby'> = {
  'tick-chime': 'chime', 'tick-8bit': 'square', 'tick-wood': 'wood', 'tick-lullaby': 'lullaby',
};
