// The gate's fixed shots (plan file 16, section 4.1 d): the twelve pictures every pull request is compared on, head
// against base, and the wendigo's mask pair (file 16, section 5, item 3; file 04, section 4.1, step 7).
//
// Names are fixed once used. A shot's id is its file's name in the cache (<id>.png), its row in noise.json and its
// name in tools/gate/milestones.json, which lists the ids a milestone may change. pictures.mjs fails when the twelve
// ids here and the twelve there are not the same list, so a shot is never renamed, dropped or added in one place only.
//
// What a shot is: one of the places in lib/painted.mjs, opened in a context of its own under the pinned clock, the
// pinned dice, reduced motion and the cached fonts (lib/README.md). Nothing about how a place is reached is decided
// here; this file only says which place, at which size, with which switches.
//
// The size: 1280 x 800, a computer, unless the id ends in @<width>x<height>. A size in the id is a phone: the
// context has touch, the page matches (pointer: coarse) and the game builds its touch detail, which is what a
// 390 x 844 screen is given in real life (a narrow window on a computer is a different picture).
import { bazaarSacks, dream, duel, home, profile, table, tableResults } from './lib/painted.mjs';

const PLACES = { home, table, tableResults, duel, dream, bazaarSacks, profile };

/** The size every shot has unless its id says otherwise. */
export const COMPUTER = Object.freeze({ width: 1280, height: 800 });

/** The size and kind of device an id asks for: `table-turn@390x844` is a 390 x 844 phone; no size is a computer. */
export function deviceOf(id) {
  const m = /@(\d+)x(\d+)$/.exec(id);
  return m
    ? { viewport: { width: Number(m[1]), height: Number(m[2]) }, touch: true }
    : { viewport: { ...COMPUTER }, touch: false };
}

const shot = (id, scene, place, args, what) => Object.freeze({ id, scene, place, args: Object.freeze(args), what, ...deviceOf(id) });

/**
 * The twelve, in the plan's order. `scene` names the 3D scene the picture is of (a change to one scene's props must
 * change that scene's shots and no others); `place` is the function of lib/painted.mjs that opens it; `args` are that
 * function's own options.
 */
export const SHOTS = Object.freeze([
  shot('home-pov0-day', 'farm', 'home', { pov: 0, hour: 'day' }, 'Home, the avatar in the barn doorway, by day'),
  shot('home-pov1-day', 'farm', 'home', { pov: 1, hour: 'day' }, 'Home, the whole farm from over the orchard, by day'),
  shot('home-pov3-night', 'farm', 'home', { pov: 3, hour: 'night' }, 'Home, out at the yard from inside the barn, at night'),
  shot('home-pov0-day@390x844', 'farm', 'home', { pov: 0, hour: 'day' }, 'Home on a phone, the avatar in the doorway, by day'),
  shot('table-turn', 'barn', 'table', {}, 'The barn table on your turn (Create lobby, Sit down)'),
  shot('table-turn@390x844', 'barn', 'table', {}, 'The barn table on your turn, on a phone'),
  shot('table-results', 'podium', 'tableResults', {}, 'A finished game: the results board over the podium'),
  shot('duel-start', 'ice', 'duel', {}, 'Practice: the start of a run on the ice, your turn'),
  shot('dream-ready', 'dream', 'dream', {}, "Counting Sheep at its ready sign, tonight's dream"),
  shot('dream-ready@390x844', 'dream', 'dream', {}, 'Counting Sheep at its ready sign, on a phone'),
  shot('bazaar-sacks', 'farm', 'bazaarSacks', {}, 'The Trading Post, Feed Sacks tab (the farm dimmed behind it)'),
  shot('profile', 'farm', 'profile', {}, 'The profile page (the farm dimmed behind it)'),
]);

/** The lowest overlap the wendigo's mask may have with the base's: intersection over union, plan file 16, section 5. */
export const WENDIGO_MIN_IOU = 0.98;

/**
 * The wendigo's pair: the paddock shot with `?wendigoDebug`, which paints the figure an unlit magenta, by day and at
 * night, on a computer only (on a phone it stands above the frame). These two are not compared as pictures: only the
 * magenta shape is, by its overlap with the base's. They are in no milestone's list, because no milestone may move it.
 */
export const WENDIGO_MASKS = Object.freeze([
  shot('wendigo-mask-day', 'farm', 'home', { pov: 2, hour: 'day', extraQuery: { wendigoDebug: '' } }, 'The paddock shot by day, the wendigo painted magenta'),
  shot('wendigo-mask-night', 'farm', 'home', { pov: 2, hour: 'night', extraQuery: { wendigoDebug: '' } }, 'The paddock shot at night, the wendigo painted magenta'),
]);

/** Every picture a run takes of one build: the twelve, then the wendigo's pair. */
export const ALL = Object.freeze([...SHOTS, ...WENDIGO_MASKS]);

/** A shot's file name in the cache. */
export const fileOf = (id) => `${id}.png`;

/**
 * Opens one shot's place in a fresh context of `browser`, on the build served at `url`, and resolves what the place
 * resolves: { context, page, errors, timings }, drawn and ready for shoot(page). Close the context after.
 */
export function openShot(browser, s, { url, ...more } = {}) {
  const open = PLACES[s.place];
  if (!open) throw new Error(`shot ${s.id} names a place lib/painted.mjs does not have: ${s.place}`);
  const args = { ...s.args };
  if (args.extraQuery) args.extraQuery = { ...args.extraQuery };
  return open(browser, { ...more, ...args, url, viewport: { ...s.viewport }, touch: s.touch });
}
