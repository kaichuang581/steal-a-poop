/** Who lives on the farm and where (the start screen draws them: table/Farmstead.tsx). Here, with no drawing code, so the scenery's builders can read it. */
import type { Animal } from '../avatars/catalog';
import type { SheepState } from '../table/Sheep';

/** The hens stand on the straw of their run, whose top is 0.10 m up; at 0 their feet were in it. */
export const HEN_Y = 0.1;
/**
 * Who lives on the farm: [animal, x, z, facing, state]. Phones keep the first three. The paddock holds the cow, the goat
 * and the horse, each where the paddock shot (POV_SHOTS.desktop[2], which never moves) shows its face: the goat nearest
 * on the left, the cow in the middle, the horse looking over the hay rack (Brian, 2026-11-20: "they are all stacked so
 * near each other that u cant tell where any of them are cuz u cant see their faces"). All three stand right of the menu
 * and clear of the wendigo (scene/__tests__/homePovFrame.test.ts). The sheep and the second cow that stood among them
 * are out in the pasture with the flock.
 */
export const LIVESTOCK: [Animal, number, number, number, SheepState][] = [
  ['cow', 15.8, -0.9, 1.12, 'idle'],
  ['horse', 13.7, -8.0, 0.43, 'idle'],
  ['chicken', -13.4, 11.7, 0.5, 'grazing'],
  ['goat', 15.6, 0.5, 0.82, 'idle'],
  ['chicken', -11.9, 12.4, -0.9, 'idle'],
  ['chicken', -14.4, 13, 2.2, 'grazing'],
  ['pig', -12.8, 4.4, 1.1, 'grazing'],
  // The flock out in the pasture, by the trough and down toward the pond.
  ['sheep', 9.4, 18.2, 2.6, 'grazing'],
  ['sheep', 12.6, 20.4, -2.2, 'idle'],
  ['sheep', 6.4, 21.6, 0.9, 'grazing'],
  ['sheep', 16.8, 22.6, -0.6, 'grazing'],
  // 1.2 m back from the pond: at 12.4, 25.6 it stood in the bank's raised snow (pondD 1.02, the rim runs to 1.18) and
  // its legs were sunk to the knee (Brian, 2026-11-21: "one of the sheeps in the pond area's legs are glitched into the ground").
  ['sheep', 11.6, 23.9, 1.9, 'idle'],
  ['cow', 10.6, 17.0, -1.9, 'idle'],
  ['sheep', 7.6, 24.4, -1.3, 'idle'],
  ['sheep', 8.8, 30.6, 0.4, 'grazing'],
];
/** The sheepdog that minds the flock: sitting just inside the pasture by the lane's fence, turned to the sheep. [x, z, facing]. */
export const FLOCK_DOG = [3.4, 23, 1.87] as const;
