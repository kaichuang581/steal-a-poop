/**
 * What each bomb skin does while it sits beside a sheep (drawn by table/BombAura.tsx and table/Bomb.tsx; cosmetic only),
 * so a skin is its own thing and not the ice bomb in another colour (Brian, 2026-11-13: "add effects to the cooler
 * bombs, like diamond just looks like the default snowy bomb ... everything needs to be differentiated"). The rarer
 * the skin, the more it does. Its own voxel model is voxel/bombSkins.ts. No three here: the server reads the catalogue.
 *
 * bits: what comes off it. `vapour` is the ice bomb's cold air, sinking and spreading on the floor; `embers` rise
 * off a coal; `motes` hang and drift up; `dust` falls off gold; `sparkle` flashes in the air round a gem; `rings`
 * roll out along the floor as a bell rings; `wisps` are a small aurora waving over it.
 */
export type AuraBits = 'vapour' | 'embers' | 'motes' | 'dust' | 'sparkle' | 'rings' | 'wisps';
export interface BombAura {
  bits: AuraBits;
  /** The bits' colours, how many a second (a ring: how many seconds apart) and how big each is, in metres. */
  colors: string[]; rate: number; size: number;
  /** Stars that flash on its surface: how many a second, their colours, and how big they are beside the others' (1 unless given). */
  glints?: { rate: number; colors: string[]; size?: number };
  /** Its glowing parts: their light (several are passed through in turn, `every` seconds each), how bright, and how far and fast it throbs. */
  glow?: { colors: string[]; every?: number; base: number; pulse: number; speed: number };
  /** The light it casts on the floor, the glow of the mark it leaves there (the mark itself is its model's `ground`), and the puff where it lands. */
  light: string; ring: { emissive: string }; puff: string;
  /** Its fuse (two colours, by turns) and the fuse's glow; its spark (edge and core) and the spark's glow; its digits and their glow. */
  fuse: [string, string]; fuseGlow: string; spark: [string, string]; sparkGlow: string; digits: [string, string];
  /** A bell rocks on the floor: how far, in radians. */
  rock?: number;
  /** How far in front of its middle the digits stand, in metres: 0.21, the ice bomb's, unless the skin is wider or slimmer where they are. */
  face?: number;
}

const RAINBOW = ['#ffffff', '#ffd6f0', '#d6f0ff', '#fff6c8', '#d6ffe8', '#e0d6ff'];

export const BOMB_AURA: Record<string, BombAura> = {
  // The ice bomb, exactly as it was: the hex values are the old numbers.
  'bomb-ice': {
    bits: 'vapour', colors: ['#ceeaff'], rate: 14, size: 0.09,
    light: '#8fd8ff', ring: { emissive: '#bfe6ff' }, puff: '#edf9ff',
    fuse: ['#9cc6e4', '#e4f4ff'], fuseGlow: '#9fd8ff', spark: ['#7fdcff', '#e8fbff'], sparkGlow: '#5fd0ff', digits: ['#e6f6ff', '#8fe4ff'],
  },
  // A hot coal: its cracks throb, embers climb off it, it scorches the floor.
  'bomb-ember': {
    bits: 'embers', colors: ['#ffd86a', '#ff9a2a', '#ff5a1e'], rate: 9, size: 0.05,
    glow: { colors: ['#ff4a10'], base: 0.55, pulse: 0.75, speed: 2.4 },
    light: '#ff8a3a', ring: { emissive: '#4a1608' }, puff: '#ffb46a',
    fuse: ['#3a2c26', '#6a4a3a'], fuseGlow: '#ff7a2a', spark: ['#ff9a2a', '#fff0b0'], sparkGlow: '#ff8a2a', digits: ['#fff0c8', '#ffb04a'],
    face: 0.225,
  },
  // A peppermint: cool mint air and the odd glint of sugar.
  'bomb-mint': {
    bits: 'vapour', colors: ['#d8fff0'], rate: 8, size: 0.08,
    glints: { rate: 0.5, colors: ['#ffffff', '#d8fff0'] },
    light: '#8fe8c0', ring: { emissive: '#8fd8b8' }, puff: '#e6fff4',
    fuse: ['#ffffff', '#e8475a'], fuseGlow: '#ffd0d6', spark: ['#b8f5d6', '#ffffff'], sparkGlow: '#8fe8c0', digits: ['#c8243a', '#d83a4e'],
  },
  // A plum at dusk: slow motes in the evening's colours, a first star now and then.
  'bomb-plum': {
    bits: 'motes', colors: ['#e6ccff', '#c8a0f0', '#ffd0ea'], rate: 5, size: 0.05,
    glints: { rate: 0.45, colors: ['#ffffff', '#e6ccff'] },
    light: '#a070e0', ring: { emissive: '#3a1a5e' }, puff: '#e0c8ff',
    fuse: ['#6b4a2a', '#8a6a3a'], fuseGlow: '#caa070', spark: ['#c8a0f0', '#ffffff'], sparkGlow: '#b48aff', digits: ['#f4e6ff', '#c8a0f0'],
  },
  // Gold: it glints all over, its studs shine, and gold dust falls off it.
  'bomb-gold': {
    bits: 'dust', colors: ['#fff0b0', '#f0c84a', '#ffffff'], rate: 7, size: 0.045,
    glints: { rate: 3, colors: ['#ffffff', '#fff0b0'], size: 1.4 },
    glow: { colors: ['#ffc23a'], base: 0.5, pulse: 0.6, speed: 3 },
    light: '#ffd070', ring: { emissive: '#c9981f' }, puff: '#fff0b0',
    fuse: ['#f0c84a', '#a87a1f'], fuseGlow: '#ffd86a', spark: ['#ffd86a', '#ffffff'], sparkGlow: '#ffd86a', digits: ['#fffdf0', '#ffe9a0'],
    face: 0.25,
  },
  // A cut diamond: it flashes every colour, its edges shine through the spectrum, the air round it sparkles.
  'bomb-diamond': {
    bits: 'sparkle', colors: RAINBOW, rate: 24, size: 0.06,
    glints: { rate: 4.5, colors: RAINBOW, size: 1.9 },
    glow: { colors: ['#6fd0ff', '#ff9ae0', '#ffe070', '#7affc0', '#a890ff'], every: 0.9, base: 0.3, pulse: 0.4, speed: 4 },
    light: '#cfeeff', ring: { emissive: '#b4e2fa' }, puff: '#ffffff',
    fuse: ['#ffffff', '#b4e2fa'], fuseGlow: '#dff4ff', spark: ['#d6f0ff', '#ffffff'], sparkGlow: '#ffffff', digits: ['#0626a8', '#0a30d8'],
    face: 0.25,
  },
  // The barn bell: it rocks, rings roll out along the floor, the polish catches the light.
  'bomb-brass': {
    bits: 'rings', colors: ['#f8e2a0', '#c9973a'], rate: 1.6, size: 0.05,
    glints: { rate: 0.9, colors: ['#fff6d8', '#f8e2a0'] },
    light: '#f0c070', ring: { emissive: '#6e4c14' }, puff: '#f8e2a0',
    fuse: ['#b8935a', '#8a6a3a'], fuseGlow: '#d0a868', spark: ['#ffcf6a', '#fff3c8'], sparkGlow: '#ffb84a', digits: ['#fff3c8', '#ffcf6a'],
    rock: 0.1, face: 0.18,
  },
  // A night sky in a ball: its bands pass from green to violet and a small aurora waves over it.
  'bomb-aurora': {
    bits: 'wisps', colors: ['#5fffb0', '#3fd6c8', '#7a8af8', '#b48aff'], rate: 16, size: 0.06,
    glints: { rate: 0.7, colors: ['#ffffff', '#c8fff0'] },
    glow: { colors: ['#1fd07a', '#1fb8a8', '#5a5ae0', '#8a40e0'], every: 1.6, base: 0.5, pulse: 0.3, speed: 1.4 },
    light: '#5fffb0', ring: { emissive: '#2fb890' }, puff: '#c8fff0',
    fuse: ['#9ff5d0', '#5fc8c0'], fuseGlow: '#9ff5d0', spark: ['#9ff5d0', '#ffffff'], sparkGlow: '#5fffb0', digits: ['#eafff6', '#9ff5d0'],
    face: 0.25,
  },
};
export const auraOf = (id: string): BombAura => BOMB_AURA[id] ?? BOMB_AURA['bomb-ice'];
