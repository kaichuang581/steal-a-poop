import { FIELD } from '../../../dream/dream';
import { ART } from '../stage';

/**
 * The dream's scenery (docs/dream/03 to 05) is flat pixel art on the canvas behind the sheep. Everything is in "art px":
 * the plan's on-screen px at 1440 x 900, which scale with the dream's own art scale. `S0` is what one of the rules'
 * logical px is in them (the 1440 x 900 window is 1408 wide and shows 320).
 */
export const S0 = 4.4;
/** An obstacle's box as drawn: the rules' box, ART times its size about its middle and the ground line, in art px. */
export const BOX = { w: FIELD.fenceW * ART * S0, h: FIELD.fenceH * ART * S0 } as const;
/** The looks an obstacle's box can take: four fences and the bale. Each stage draws its own thing for each. */
export const FENCE_LOOKS = ['rail', 'picket', 'wall', 'log'] as const;
export type Look = (typeof FENCE_LOOKS)[number] | 'bale';
/** The look of the obstacle at `index`: a bale is a bale; fences take the four looks in turn. Cosmetic only. */
export const lookOf = (kind: 'fence' | 'bale', index: number): Look => (kind === 'bale' ? 'bale' : FENCE_LOOKS[index % FENCE_LOOKS.length]);

export type StageN = 1 | 2 | 3;

export interface SceneFence {
  index: number; look: Look;
  /** The stage whose thing it is: the letters a fence asks at its place in the night. */
  stage: StageN;
  /** The box's left edge, art px across the window. */
  x: number;
  /** Its word is taken: its lanterns are lit. */
  lit: boolean;
  /** Knocked over by a bump: how far it has tipped, radians. */
  tilt: number;
  /** Where its sign hangs: the post's middle and the board's top, art px. */
  signX: number; signTop: number;
}

/** One frame of the dream, as the scenery needs it. */
export interface SceneState {
  /** The window, and the lane's top down it, art px. */
  W: number; H: number; lane: number;
  /** How far the lane has run, art px; the dream's clock, ms; the beat's count. */
  scroll: number; t: number; beats: number;
  /** Art px to one CSS px: what the small things that keep their size on every screen (stars, snow) are sized by. */
  u: number;
  stage: StageN;
  /** The stage being left and how long ago the sheep passed its gate, ms; null between gates. */
  gate: { from: StageN; ms: number } | null;
  /** The gate standing on the lane, if one is near: which stage it opens, and its middle across the window, art px. */
  arch: { to: 2 | 3; x: number; since: number } | null;
  /** How far into the finale's swell the moon is, 0 to 1, and the sheep counted so far; 0 outside the finale. */
  finale: number; counted: number;
  seed: string;
  phone: boolean; low: boolean; reduced: boolean; festive: boolean;
  /** The farmer's breath, 0 to 1: his bedroom window on the farmhouse glows with it. */
  breath: number;
  fences: SceneFence[];
  /** The sheep: its middle across the window, how high its feet are off the lane, and its length, art px. */
  sheep: { x: number; lift: number; w: number; running: boolean };
}

/** What the scenery remembers between frames of one run: where the hooves came down. */
export interface SceneMemory {
  prints: { wx: number; t: number }[]; strideAt: number; squish: Map<number, number>; lastT: number;
  /** Where stage 2's strip of islands starts along its own scroll: set as the first gate opens, so that an island rises from where a building of the farm stands. */
  isles: number | null;
}
export const freshMemory = (): SceneMemory => ({ prints: [], strideAt: 0, squish: new Map(), lastT: 0, isles: null });
/** How long a gate lasts, ms: the first, "Lift-off"; the second, "Tucked in". Under reduced motion, a 200 ms cross-fade. */
export const GATE_MS = { 1: 1200, 2: 1000, reduced: 200 } as const;
