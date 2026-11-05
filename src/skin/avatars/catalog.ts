import { AVATAR_IDS } from '../../avatars/ids';
import type { AvatarId } from '../../avatars/ids';

export type Animal = 'sheep' | 'pig' | 'cow' | 'goat' | 'horse';
export const ANIMALS: Animal[] = ['sheep', 'pig', 'cow', 'goat', 'horse'];

/** Sits on the portrait. One per character: the main piece of its Pack. */
export type Worn =
  | 'scarf' | 'strawHat' | 'shades' | 'headphones' | 'crown' | 'flowerCrown' | 'bow' | 'goggles' | 'cap' | 'collar'
  | 'topHat' | 'helmet' | 'chefHat' | 'nightCap' | 'rosette' | 'sunHat' | 'hood' | 'stripe';

export interface Character {
  id: AvatarId;
  animal: Animal;
  name: string;
  /** One line about their personality. */
  blurb: string;
  /** What the character does for show (the effects are not built yet: this is the description). */
  skill: string;
  pack: { name: string; items: [string, string, string] };
  colors: { body: string; shade: string; face: string; accent: string; mane: string; nose: string };
  worn: Worn;
  wornColor: string;
}

const C = (c: Character): Character => c;

export const CHARACTERS: Character[] = [
  C({ id: 'sheep-dash', animal: 'sheep', name: 'Dash', blurb: 'Quick-footed and always first to the pile.', skill: 'Leaves a streak across the screen on a good turn.',
    pack: { name: 'Stage Pack', items: ['Sparkly jacket', 'Microphone', 'Spotlight'] },
    colors: { body: '#f4efe6', shade: '#d8d0c2', face: '#4a3b34', accent: '#2f2622', mane: '#f4efe6', nose: '#e9a6a0' }, worn: 'collar', wornColor: '#c04fd8' }),
  C({ id: 'sheep-velvet', animal: 'sheep', name: 'Velvet', blurb: 'Soft, calm and never in a hurry.', skill: 'Floats gently while it is their turn.',
    pack: { name: 'Cozy Pack', items: ['Knitted scarf', 'Lantern', 'Mittens'] },
    colors: { body: '#e6dcf0', shade: '#c9bcd9', face: '#5a4a6a', accent: '#3a2f48', mane: '#e6dcf0', nose: '#e9a6a0' }, worn: 'scarf', wornColor: '#d9534f' }),
  C({ id: 'sheep-pebble', animal: 'sheep', name: 'Pebble', blurb: 'Stubborn, proud and farm-tough.', skill: 'Stomps the snow when a fence goes up.',
    pack: { name: 'Farmhand Pack', items: ['Straw hat', 'Pitchfork', 'Bucket'] },
    colors: { body: '#d9d2c4', shade: '#b8b0a0', face: '#3f342e', accent: '#2b221d', mane: '#d9d2c4', nose: '#d99a94' }, worn: 'strawHat', wornColor: '#e0b865' }),

  C({ id: 'pig-truffle', animal: 'pig', name: 'Truffle', blurb: 'Sniffs out the long words.', skill: 'Sparkles near a long word.',
    pack: { name: 'Garden Pack', items: ['Flower crown', 'Watering can', 'Wellies'] },
    colors: { body: '#f5b5c0', shade: '#e393a2', face: '#f5b5c0', accent: '#e393a2', mane: '#f5b5c0', nose: '#e88a9c' }, worn: 'flowerCrown', wornColor: '#fff3a8' }),
  C({ id: 'pig-bramble', animal: 'pig', name: 'Bramble', blurb: 'Bouncy, loud and always up to something.', skill: 'Does a little hop when stealing.',
    pack: { name: 'Skate Pack', items: ['Skateboard', 'Headphones', 'Cap'] },
    colors: { body: '#f0a3b0', shade: '#d98393', face: '#f0a3b0', accent: '#d98393', mane: '#f0a3b0', nose: '#e0788c' }, worn: 'cap', wornColor: '#3a8fd9' }),
  C({ id: 'pig-pudding', animal: 'pig', name: 'Pudding', blurb: 'Sleepy, lovable, always cosy.', skill: 'Blows a bubble while waiting for a turn.',
    pack: { name: 'Snug Pack', items: ['Pyjamas', 'Teddy bear', 'Night cap'] },
    colors: { body: '#f7c3cb', shade: '#e9a2ae', face: '#f7c3cb', accent: '#e9a2ae', mane: '#f7c3cb', nose: '#eb97a6' }, worn: 'nightCap', wornColor: '#7a8ff0' }),

  C({ id: 'cow-clover', animal: 'cow', name: 'Clover', blurb: 'Cheerful and fond of a picnic.', skill: 'Hums along to the turn timer.',
    pack: { name: 'Picnic Pack', items: ['Picnic hamper', 'Blanket', 'Sun hat'] },
    colors: { body: '#f6f1e8', shade: '#3b332e', face: '#f6f1e8', accent: '#e8d6a8', mane: '#f6f1e8', nose: '#f0b3ae' }, worn: 'sunHat', wornColor: '#f2c14e' }),
  C({ id: 'cow-mae', animal: 'cow', name: 'Moo-Moo Mae', blurb: 'A bit of a show-off, in the best way.', skill: 'Does a twirl when she banks.',
    pack: { name: 'Dance Pack', items: ['Sequin cape', 'Disco ball', 'Glow sticks'] },
    colors: { body: '#f2ece2', shade: '#6b3a8a', face: '#f2ece2', accent: '#e8d6a8', mane: '#f2ece2', nose: '#f0b3ae' }, worn: 'collar', wornColor: '#d94fc0' }),
  C({ id: 'cow-biscuit', animal: 'cow', name: 'Biscuit', blurb: 'Calm, kind and a very good baker.', skill: 'Nods whenever a word is right.',
    pack: { name: 'Baker Pack', items: ['Chef hat', 'Rolling pin', 'Mixing bowl'] },
    colors: { body: '#e7c9a0', shade: '#a36d3d', face: '#e7c9a0', accent: '#caa070', mane: '#e7c9a0', nose: '#e8a79a' }, worn: 'chefHat', wornColor: '#fbfbf7' }),

  C({ id: 'goat-rocket', animal: 'goat', name: 'Rocket', blurb: 'Climbs anything, fences included.', skill: 'Kicks up a dust trail when a turn starts.',
    pack: { name: 'Mountain Pack', items: ['Climbing rope', 'Helmet', 'Compass'] },
    colors: { body: '#cfc6b8', shade: '#a89f90', face: '#cfc6b8', accent: '#6b5b4a', mane: '#8c8274', nose: '#8a7f72' }, worn: 'helmet', wornColor: '#e94f37' }),
  C({ id: 'goat-gizmo', animal: 'goat', name: 'Gizmo', blurb: 'Tinkers with everything.', skill: 'A small spark when a new pile starts.',
    pack: { name: 'Inventor Pack', items: ['Goggles', 'Wrench', 'Tool belt'] },
    colors: { body: '#e3d8c4', shade: '#bdb09a', face: '#e3d8c4', accent: '#8a6b3f', mane: '#a58a62', nose: '#9a8a74' }, worn: 'goggles', wornColor: '#5fc3d9' }),
  C({ id: 'goat-mischief', animal: 'goat', name: 'Mischief', blurb: 'Cheeky, with a wink for everyone.', skill: 'Winks at the other players now and then.',
    pack: { name: 'Trickster Pack', items: ['Top hat', 'Playing cards', 'Magic wand'] },
    colors: { body: '#b9aec3', shade: '#948aa3', face: '#b9aec3', accent: '#554a63', mane: '#6f6480', nose: '#8a7f98' }, worn: 'topHat', wornColor: '#2b2433' }),

  C({ id: 'horse-comet', animal: 'horse', name: 'Comet', blurb: 'Fast and graceful.', skill: 'A light trail follows a steal.',
    pack: { name: 'Racer Pack', items: ['Racing helmet', 'Racing stripes', 'Trophy'] },
    colors: { body: '#b8793d', shade: '#8f5a28', face: '#b8793d', accent: '#5b3a1e', mane: '#3d2713', nose: '#6b4423' }, worn: 'stripe', wornColor: '#f2f2f2' }),
  C({ id: 'horse-sable', animal: 'horse', name: 'Sable', blurb: 'Dark, quiet and mysterious.', skill: 'A quiet glow when a trap is set.',
    pack: { name: 'Night Rider Pack', items: ['Cloak', 'Lantern', 'Riding boots'] },
    colors: { body: '#3f3a46', shade: '#2b2731', face: '#3f3a46', accent: '#25212c', mane: '#1d1a22', nose: '#6a6272' }, worn: 'hood', wornColor: '#5a3f8a' }),
  C({ id: 'horse-sunny', animal: 'horse', name: 'Sunny', blurb: 'The cheerleader of the barn.', skill: 'Tosses confetti when someone wins.',
    pack: { name: 'Show Pack', items: ['Rosette', 'Ribbons', 'Bow'] },
    colors: { body: '#e8c26a', shade: '#c79d45', face: '#e8c26a', accent: '#a37a2c', mane: '#f7e6a8', nose: '#b58a3a' }, worn: 'bow', wornColor: '#e94f7a' }),
];

export const byId = (id: string | null | undefined): Character | undefined => CHARACTERS.find((c) => c.id === id);
export const ids = (): readonly string[] => AVATAR_IDS;
