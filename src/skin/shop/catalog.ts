import type { TickVoice } from '../../audio/sound';
/**
 * The Trading Post's catalogue. Everything here is cosmetic: it changes how the bomb looks, how its burst looks, or how
 * its fuse ticks, never a turn, a word, the clock or who wins. Wool Coins buy only Feed Sacks (Brian, 2026-11-12).
 *
 * `source` says how an item is had: `free` (everyone owns it), `sack` (only from that kind's Feed Sack, with a `rarity`),
 * `bells` (bought on the Bell Shelf for `price` Golden Bells), or `mission` (given for finishing `mission`, MISSIONS in
 * economy.ts; kept for good once given). Wool Coins buy only sacks; Golden Bells buy only Bell Shelf items.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Kind = 'bomb' | 'blast' | 'tick';
export const KINDS: Kind[] = ['bomb', 'blast', 'tick'];
export const KIND_LABEL: Record<Kind, string> = { bomb: 'Bomb skins', blast: 'Bursts', tick: 'Fuse sounds' };
export const KIND_ONE: Record<Kind, string> = { bomb: 'Bomb skin', blast: 'Burst', tick: 'Fuse sound' };

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  blurb: string;
  source: 'free' | 'sack' | 'bells' | 'mission';
  /** Golden Bells, for `bells` items. */
  price?: number;
  rarity?: Rarity;
  /** The mission that gives it (`mission` items). */
  mission?: string;
}

export const CATALOG: readonly Item[] = [
  // Bomb skins: a tint over the ice bomb's shell.
  { id: 'bomb-ice', kind: 'bomb', name: 'Ice', blurb: 'The classic frozen bomb.', source: 'free' },
  { id: 'bomb-ember', rarity: 'common', kind: 'bomb', name: 'Ember', blurb: 'A hot coal: its cracks glow and embers climb off it.', source: 'sack' },
  { id: 'bomb-mint', rarity: 'common', kind: 'bomb', name: 'Peppermint', blurb: 'A striped peppermint in its wrapper, cool and minty.', source: 'sack' },
  { id: 'bomb-plum', rarity: 'uncommon', kind: 'bomb', name: 'Plum', blurb: 'A plum with its leaf, the colour of a winter dusk.', source: 'sack' },
  { id: 'bomb-gold', rarity: 'rare', kind: 'bomb', name: 'Gold', blurb: 'Strapped, studded and crowned. It glints all over.', source: 'sack' },
  { id: 'bomb-diamond', rarity: 'legendary', kind: 'bomb', name: 'Diamond', blurb: 'A cut diamond that flashes every colour.', source: 'sack' },
  { id: 'bomb-brass', kind: 'bomb', name: 'Brass Bell', blurb: 'The barn bell in polished brass. It rocks and rings.', source: 'bells', price: 30 },
  { id: 'bomb-aurora', kind: 'bomb', name: 'Aurora', blurb: 'For 7 nights of Counting Sheep in a row.', source: 'mission', mission: 'streak-7' },
  // Bursts: the colours of the blast when a turn runs out.
  { id: 'blast-frost', kind: 'blast', name: 'Frost', blurb: 'The ice bomb\'s own blast, white to deep blue.', source: 'free' },
  { id: 'blast-hay', rarity: 'common', kind: 'blast', name: 'Hay', blurb: 'A haystack pops up and throws its straw.', source: 'sack' },
  { id: 'blast-snowfall', rarity: 'common', kind: 'blast', name: 'Snowfall', blurb: 'A snow cloud floats up and snows.', source: 'sack' },
  { id: 'blast-confetti', rarity: 'uncommon', kind: 'blast', name: 'Harvest Fair', blurb: 'Balloons float off and pop into confetti.', source: 'sack' },
  { id: 'blast-ember', rarity: 'uncommon', kind: 'blast', name: 'Ember', blurb: 'A campfire, crackling for a moment.', source: 'sack' },
  { id: 'blast-bubblegum', rarity: 'uncommon', kind: 'blast', name: 'Heather', blurb: 'Heather springs up and sheds its petals.', source: 'sack' },
  { id: 'blast-northern', rarity: 'rare', kind: 'blast', name: 'Northern Lights', blurb: 'An aurora unfurls overhead and waves.', source: 'sack' },
  { id: 'blast-solstice', rarity: 'legendary', kind: 'blast', name: 'Solstice', blurb: 'A little sun rises and shines on the barn.', source: 'sack' },
  { id: 'blast-lantern', kind: 'blast', name: 'Lantern Glow', blurb: 'Paper lanterns let go, drifting up.', source: 'bells', price: 40 },
  { id: 'blast-starlight', kind: 'blast', name: 'Starlight', blurb: 'Stars come out one by one and twinkle.', source: 'mission', mission: 'streak-30' },
  // Fuse sounds: how the bomb beeps each second.
  { id: 'tick-chime', kind: 'tick', name: 'Ice chime', blurb: 'The bright beep the bomb always had.', source: 'free' },
  { id: 'tick-8bit', rarity: 'common', kind: 'tick', name: 'Tin toy', blurb: 'Bright little beeps, like a wind-up tin toy.', source: 'sack' },
  { id: 'tick-wood', rarity: 'common', kind: 'tick', name: 'Wood block', blurb: 'A short knock, like a clock in the barn.', source: 'sack' },
  { id: 'tick-cowbell', rarity: 'uncommon', kind: 'tick', name: 'Cowbell', blurb: 'The bell on the dairy cow\'s collar.', source: 'sack' },
  { id: 'tick-sleigh', rarity: 'uncommon', kind: 'tick', name: 'Sleigh bells', blurb: 'A jingle from the sled by the pond.', source: 'sack' },
  { id: 'tick-owl', rarity: 'rare', kind: 'tick', name: 'Barn owl', blurb: 'A soft hoo from the hayloft rafters.', source: 'sack' },
  { id: 'tick-musicbox', rarity: 'legendary', kind: 'tick', name: 'Music box', blurb: 'The farmer\'s music box, one note a second.', source: 'sack' },
  { id: 'tick-lullaby', kind: 'tick', name: 'Lullaby', blurb: 'For 100 nights of Counting Sheep in a row.', source: 'mission', mission: 'streak-100' },
];

export const DEFAULTS: Record<Kind, string> = { bomb: 'bomb-ice', blast: 'blast-frost', tick: 'tick-chime' };

export const itemById = (id: string): Item | undefined => CATALOG.find((i) => i.id === id);

/** The glow of each bomb skin (its emissive colour). The shell's own colours are BOMB_SHELL's (shells.ts). */
export const BOMB_TINT: Record<string, { emissive: string }> = {
  'bomb-ice': { emissive: '#3f97d6' },
  'bomb-ember': { emissive: '#ff6a1e' },
  'bomb-mint': { emissive: '#2fa77a' },
  'bomb-plum': { emissive: '#7a3fb8' },
  'bomb-gold': { emissive: '#c99a1f' },
  'bomb-diamond': { emissive: '#7ad8ff' },
  'bomb-brass': { emissive: '#a87a2a' },
  'bomb-aurora': { emissive: '#4a52c8' },
};

/** The burst's flame colours (hot to cool) and its sparks. */
export const BLAST_PALETTE: Record<string, { flame: string[]; spark: string[] }> = {
  'blast-frost': { flame: ['#ffffff', '#bfe9ff', '#5fb8f5', '#2f7fd6', '#173f8f'], spark: ['#ffffff', '#e6f8ff', '#b6e6ff'] },
  'blast-confetti': { flame: ['#ffffff', '#ffd93d', '#ff6b6b', '#6bcb77', '#4d96ff'], spark: ['#ff6bd6', '#ffd93d', '#4d96ff'] },
  'blast-ember': { flame: ['#fff2b0', '#ffd04a', '#ff9a2a', '#ff5a1e', '#c8321a'], spark: ['#ffffff', '#ffe08a', '#ffb04a'] },
  'blast-bubblegum': { flame: ['#ffffff', '#ffe0f0', '#ff9ad0', '#d66ad6', '#7a3fb8'], spark: ['#ffffff', '#ffd0ea', '#e0b8ff'] },
  'blast-northern': { flame: ['#ffffff', '#c8ffe0', '#3fd69a', '#5a8af0', '#7a4ad6'], spark: ['#ffffff', '#b8ffd8', '#d0b8ff'] },
  'blast-solstice': { flame: ['#ffffff', '#fff6d0', '#ffc83d', '#ff8a2a', '#d6582a'], spark: ['#ffffff', '#fff0a8', '#ffd070'] },
  'blast-lantern': { flame: ['#ffffff', '#fff3c8', '#f2c46a', '#e08a2a', '#9a5a1f'], spark: ['#ffffff', '#ffe8a8', '#f2c46a'] },
  'blast-hay': { flame: ['#fff6d8', '#f2d58c', '#d9a84a', '#a8763a', '#6b4a2a'], spark: ['#fff6d8', '#f2d58c', '#e0c070'] },
  'blast-snowfall': { flame: ['#ffffff', '#f4f6f8', '#dfe4ea', '#c4ccd6', '#9aa4b2'], spark: ['#ffffff', '#f4f6f8', '#e6ebf0'] },
  'blast-starlight': { flame: ['#ffffff', '#fffbe0', '#d0d8ff', '#8a8af0', '#3a2f8f'], spark: ['#ffffff', '#fff6c8', '#c8d0ff'] },
};

/**
 * What each burst is in the game (table/Blast.tsx, table/burstActs.ts), so a burst is its own thing and not a recolour,
 * and is not an explosion unless it is the frost ball (Brian, 2026-11-12: "it feels weird for an aurora to be
 * exploding"): a haystack that throws its straw, a snow cloud that snows, balloons, a campfire, heather springing up,
 * an aurora unfurling overhead, a little sun, paper lanterns, stars coming out. Cosmetic only: the bang is the same moment.
 */
export type BurstShape = 'ball' | 'haystack' | 'snowcloud' | 'balloons' | 'campfire' | 'heather' | 'aurora' | 'sun' | 'lanterns' | 'stars';
export const BURST_SHAPE: Record<string, BurstShape> = {
  'blast-frost': 'ball', 'blast-hay': 'haystack', 'blast-snowfall': 'snowcloud', 'blast-confetti': 'balloons', 'blast-ember': 'campfire',
  'blast-bubblegum': 'heather', 'blast-northern': 'aurora', 'blast-solstice': 'sun', 'blast-lantern': 'lanterns', 'blast-starlight': 'stars',
};
/** Only the frost ball is an explosion; every other burst is something that appears where the bomb was. */
export const burstExplodes = (id: string): boolean => (BURST_SHAPE[id] ?? 'ball') === 'ball';

/** Which fuse voice each fuse sound is. The voices themselves, what each second sounds like, are in src/audio/fuseVoices.ts. */
export const TICK_VOICE: Record<string, TickVoice> = {
  'tick-chime': 'chime', 'tick-8bit': 'square', 'tick-wood': 'wood', 'tick-lullaby': 'lullaby',
  'tick-cowbell': 'cowbell', 'tick-sleigh': 'sleigh', 'tick-owl': 'owl', 'tick-musicbox': 'musicbox',
};
