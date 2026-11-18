import { FESTIVE } from '../config';

// The season's words (plan file 13, change 7; ruling M17): they show only while `FESTIVE` in src/config.ts is true.
// While it is, every line here is exactly as it shipped. Off, the words are the plan's season-off copy (file 13,
// section 8). The update's own name, UPDATE_NAME, is not the season's to take away.

/** What the table shouts when your word lands. */
export const CHEERS: readonly string[] = FESTIVE
  ? ['Nice one!', 'Ho ho ho!', 'Jolly good!', 'Fa la la la baa!', 'Merry and bright!']
  : ['Nice one!', 'Good word!', 'Well played!'];

/** The title of a practice run's board when it is not a new best. */
export const RUN_OVER_TITLE = FESTIVE ? 'Baa humbug!' : 'Run over';

/** Home's rotating tips that belong to the season: they leave the rotation when it is over. */
export const SEASON_TIPS: readonly string[] = FESTIVE
  ? [
      'Fleece Navidad: the whole farm is dressed for the season, hats and all.',
      'Have yourself a merry little word chain.',
      'Deck the stalls with bows of holly. Fa la la la baa.',
    ]
  : [];
