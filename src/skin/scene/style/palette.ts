/**
 * The diorama scenery's palette and size ladder (docs/diorama/PLAN.md, sections 3.1 to 3.3). Every scenery colour is a
 * token here or a token's value step; every scenery mesh is built at one cell size of the ladder. The style lint
 * (scene/__tests__/style.test.ts) holds both.
 *
 * The values are the plan's starting values, sampled from Brian's reference sheet; they wait for his approval of the
 * swatches (?preview=palette, milestone D0). `lin()` desaturates every one by DESATURATE, as it does all paint.
 */
import { Color } from 'three';

/** The size ladder, metres per cell (3.1). L is 1 m beyond 60 m from the farm's middle. */
export const LADDER = { L: 0.5, Lfar: 1, M: 0.1, S: 0.05, XS: 0.025 } as const;
export type Step = keyof typeof LADDER;
export const LADDER_SIZES: readonly number[] = Object.values(LADDER);

/** Winter is the default (plan question 1); summer is the reference's own colours. */
export type Season = 'winter' | 'summer';
export const SEASON: Season = 'winter';

/** A token's two values: [summer (the reference), winter]. One value means both. */
const T = (summer: string, winter: string = summer) => ({ summer, winter });
export const TOKENS = {
  'ground.top': T('#8DBB4E', '#F1F2EE'),
  'ground.side': T('#6E9A3C', '#E2E4E1'),
  soil: T('#6B4A2E'),
  'soil-1': T('#53392A'),
  path: T('#B08A5A', '#D8CCB8'),
  barn: T('#C0392B'),
  'barn-1': T('#A93226'),
  trim: T('#F1ECE2'),
  roof: T('#5A4033'),
  wood: T('#8A5F3B'),
  'wood-1': T('#6B4527'),
  hay: T('#E2C26A'),
  leaf: T('#7BAE45', '#4F7A4A'),
  'leaf-1': T('#5E8E36', '#3F6640'),
  trunk: T('#7A5434'),
  stone: T('#A8A29A'),
  'stone-1': T('#8A847C'),
  water: T('#6FAFCB', '#BFDDEB'),
  'crop.carrot': T('#E8833A'),
  'crop.corn': T('#E9C440'),
  'crop.wheat': T('#D9B860'),
  studio: T('#ECEBE6'),
  // The season's decorations (6.8): flat reds, greens and golds.
  'festive.red': T('#C8372D'),
  'festive.green': T('#2F6B3A'),
  'festive.gold': T('#E2B53E'),
} as const;
export type Token = keyof typeof TOKENS;
export const TOKEN_NAMES = Object.keys(TOKENS) as Token[];

/**
 * The colours allowed outside the tokens, each with its reason (3.2). Empty until Brian answers question 2 (snow drift
 * shading); the night sky, the aurora and the water are drawn by their own shaders, not by voxels.
 */
export const EXCEPTIONS: readonly { hex: string; why: string }[] = [];

/** One value step: 6% lighter (+) or darker (-) per step, in HSL lightness (3.2). */
export const VALUE_STEP = 0.06;

const c = new Color();
const hsl = { h: 0, s: 0, l: 0 };
/** The hex of a token in a season, `step` value steps lighter (positive) or darker (negative). */
export function hexOf(token: Token, step = 0, season: Season = SEASON): string {
  c.set(TOKENS[token][season]);
  if (step) {
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l * (1 + VALUE_STEP * step))));
  }
  return `#${c.getHexString()}`;
}
