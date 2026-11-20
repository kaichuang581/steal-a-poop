/** Who lives on the farm and where (the start screen draws them: table/Farmstead.tsx). Here, with no drawing code, so the scenery's builders can read it. */
import type { Animal } from '../avatars/catalog';
import type { SheepState } from '../table/Sheep';

/** The hens stand on the straw of their run, whose top is 0.10 m up; at 0 their feet were in it. */
export const HEN_Y = 0.1;
/**
 * Who lives on the farm: [animal, x, z, facing, state]. Phones keep the first few. The paddock's animals stand where the
 * paddock shot (POV_SHOTS.desktop[2], which never moves) frames each of them whole, right of the menu and clear of the
 * wendigo (plan file 04, section 4.3; scene/__tests__/homePov.test.ts).
 */
export const LIVESTOCK: [Animal, number, number, number, SheepState][] = [
  ['cow', 15.8, -1, 2.4, 'grazing'],
  ['horse', 13.5, -8.2, -1.1, 'idle'],
  ['chicken', -13.4, 11.7, 0.5, 'grazing'],
  ['sheep', 14.2, -6.4, 0.9, 'grazing'],
  ['cow', 14.6, -3.9, -0.8, 'idle'],
  ['goat', 13.8, -1.8, 1.5, 'idle'],
  ['chicken', -11.9, 12.4, -0.9, 'idle'],
  ['chicken', -14.4, 13, 2.2, 'grazing'],
  ['pig', -12.8, 4.4, 1.1, 'grazing'],
  ['sheep', 15.5, -7.6, -1.2, 'idle'],
  // A few of the flock out in the pasture, by the trough.
  ['sheep', 9.4, 18.2, 2.6, 'grazing'],
  ['sheep', 12.6, 20.4, -2.2, 'idle'],
  ['sheep', 6.4, 21.6, 0.9, 'grazing'],
];
