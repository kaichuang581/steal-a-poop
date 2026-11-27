import type { ModelData } from './models.gen';

/**
 * The seconds on a bomb's face, as cubes (Brian, 2026-11-26: "can u make the bomb numbers not so ai?"). They were the
 * display face drawn smooth on a canvas and laid over the face as a picture: soft serif type on a model made of cubes,
 * which is what read as machine-made. Each numeral is now drawn here by hand on a grid of half the bomb's cube and
 * built as cubes standing half a cube proud of the face, so the number is part of the model and is lit like it.
 *
 * Two sets, both with upright strokes one whole bomb cube thick:
 * - `BIG`, 6 x 10: one digit alone (9 down to 0, the seconds that matter most), as tall as the face allows;
 * - `SMALL`, 5 x 7 (the 1 is 3 wide): two digits side by side. 10 to 19 are 9 wide; 20 to 99 are 11, the face's 12.
 *
 * Pure: no three. bomb.ts meshes what `secondsModel` returns.
 */
const BIG: Record<string, readonly string[]> = {
  0: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  1: ['..XX..', '.XXX..', 'XXXX..', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..', 'XXXXXX', 'XXXXXX'],
  2: ['.XXXX.', 'XXXXXX', 'XX..XX', '....XX', '...XX.', '..XX..', '.XX...', 'XX....', 'XXXXXX', 'XXXXXX'],
  3: ['XXXXX.', 'XXXXXX', '....XX', '....XX', '.XXXX.', '.XXXX.', '....XX', '....XX', 'XXXXXX', 'XXXXX.'],
  4: ['XX..XX', 'XX..XX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXXXXX', '....XX', '....XX', '....XX', '....XX'],
  5: ['XXXXXX', 'XXXXXX', 'XX....', 'XX....', 'XXXXX.', 'XXXXXX', '....XX', '....XX', 'XXXXXX', 'XXXXX.'],
  6: ['.XXXX.', 'XXXXXX', 'XX....', 'XX....', 'XXXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  7: ['XXXXXX', 'XXXXXX', '....XX', '....XX', '...XX.', '...XX.', '..XX..', '..XX..', '..XX..', '..XX..'],
  8: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', '.XXXX.', '.XXXX.', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  9: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXXX', '....XX', '....XX', 'XXXXXX', '.XXXX.'],
};
const SMALL: Record<string, readonly string[]> = {
  0: ['.XXX.', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX', '.XXX.'],
  1: ['.XX', 'XXX', '.XX', '.XX', '.XX', '.XX', '.XX'],
  2: ['.XXX.', 'XX.XX', '...XX', '..XX.', '.XX..', 'XX...', 'XXXXX'],
  3: ['XXXX.', '...XX', '...XX', '.XXX.', '...XX', '...XX', 'XXXX.'],
  4: ['XX.XX', 'XX.XX', 'XX.XX', 'XXXXX', '...XX', '...XX', '...XX'],
  5: ['XXXXX', 'XX...', 'XXXX.', '...XX', '...XX', 'XX.XX', '.XXX.'],
  6: ['.XXX.', 'XX...', 'XXXX.', 'XX.XX', 'XX.XX', 'XX.XX', '.XXX.'],
  7: ['XXXXX', '...XX', '..XX.', '..XX.', '.XX..', '.XX..', '.XX..'],
  8: ['.XXX.', 'XX.XX', 'XX.XX', '.XXX.', 'XX.XX', 'XX.XX', '.XXX.'],
  9: ['.XXX.', 'XX.XX', 'XX.XX', 'XX.XX', '.XXXX', '...XX', '.XXX.'],
};

/** The rows of a number of seconds, top row first, `X` where a cube stands: one big digit, or small digits a column apart. */
export function secondsRows(n: number): string[] {
  const s = String(Math.max(0, Math.min(99, Math.round(n))));
  if (s.length === 1) return [...BIG[s]];
  const glyphs = [...s].map((d) => SMALL[d]);
  return glyphs[0].map((_, j) => glyphs.map((g) => g[j]).join('.'));
}

/** How many of the grid's cells the face is across: six bomb cubes, in half cubes. */
export const FACE_ACROSS = 12;

/**
 * A number of seconds as a model: one cell deep, `cell` metres a cell, colour 0 of whatever colour list it is meshed
 * with. Its origin is its bottom left; `w` and `h` are its size in cells, to centre it on the face.
 */
export function secondsModel(n: number, cell: number): { data: ModelData; w: number; h: number } {
  const rows = secondsRows(n), h = rows.length, w = rows[0].length;
  const boxes: number[][] = [];
  rows.forEach((row, j) => { for (const run of row.matchAll(/X+/g)) boxes.push([run.index, h - 1 - j, 0, run.index + run[0].length, h - j, 1, 0, 0, 0]); });
  return { data: { cell, size: [w * cell, h * cell, cell], bounds: [0, 0, 0, w, h, 1], lights: [], boxes }, w, h };
}
