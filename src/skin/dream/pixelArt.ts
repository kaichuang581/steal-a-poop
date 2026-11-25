/**
 * Counting Sheep's pixel art (docs/dream/data/pixel-art.json, copied; a test holds the two equal): one character an art
 * pixel, `.` clear, `px` the plan's pixels to an art pixel. Drawn with the kit's `Pix`, always at a whole multiple.
 */
export interface Art { px: number; rows: readonly string[] }
export const ART_GRIDS = {
  z: { px: 2, rows: ["XXXXX", "...X.", "..X..", ".X...", "XXXXX"] },
  bang: { px: 3, rows: [".X.", ".X.", ".X.", ".X.", ".X.", "...", ".X."] },
  question: { px: 3, rows: [".XXX.", "X...X", "....X", "...X.", "..X..", ".....", "..X.."] },
  'puff-1': { px: 2, rows: ["........", "........", "...XX...", "..XXXX..", "..XXXX..", "...XX...", "........", "........"] },
  'puff-2': { px: 2, rows: ["........", "..XXXX..", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "..XXXX..", "........"] },
  'puff-3': { px: 2, rows: [".XX..XX.", "X..XX..X", "X......X", ".X....X.", ".X....X.", "X......X", "X..XX..X", ".XX..XX."] },
  'return-key': { px: 2, rows: ["......XX", "......XX", "......XX", "..X...XX", ".XX...XX", "XXXXXXXX", ".XX.....", "..X....."] },
  'bump-star': { px: 2, rows: ["....X....", "....X....", "..XXXXX..", "XXXXXXXXX", "..XXXXX..", "..XX.XX..", ".XX...XX.", ".X.....X."] },
  'star-plus': { px: 1, rows: ["..X..", "..X..", "XXXXX", "..X..", "..X.."] },
  'button-4': { px: 2, rows: ["..XXX..", ".XXXXX.", "XX.X.XX", "XXXXXXX", "XX.X.XX", ".XXXXX.", "..XXX.."] },
  'button-2': { px: 2, rows: ["..XXX..", ".XXXXX.", "XXXXXXX", "XX.X.XX", "XXXXXXX", ".XXXXX.", "..XXX.."] },
  feather: { px: 2, rows: ["......XX.", "...XXXXX.", ".XXXXXX..", "XXXXX....", ".X......."] },
  'sheep-shadow': { px: 2, rows: ["..XXXXXX....", ".XXXXXXXX.XX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", "XXXXXXXXX.X.", ".XXXXXXXX...", ".X.X..X.X...", ".X.X..X.X..."] },
  candle: { px: 2, rows: ["...XX...", "..XXX...", "..XXXX..", "...XX...", "...X....", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", ".XXXXXX.", "XXXXXXXX", "XXXXXXXX"] },
  'yarn-ball': { px: 2, rows: ["....XXXX....", "..XX--XXXX..", ".XXXX--XXXX.", ".X-XXXX--XX.", "XXX--XXXX-XX", "XXXXX--XXXXX", "X--XXXX--XXX", "XXX--XXXX-XX", ".XXXX--XXXX.", ".XX-XXX--XX.", "..XXXXXXXX..", "....XXXX...."] },
  island: { px: 2, rows: ["............", "....X.......", "...XXX......", "....X...XX..", "XXXXXXXXXXXX", "XXXXXXXXXXXX", ".XXXXXXXXXX.", "..XXXXXXXX..", "...XXXXXX...", "....XXXX....", ".....XX.....", "............"] },
  'moon-small': { px: 2, rows: ["..XXX...", ".XXX....", "XXX.....", "XXX.....", "XXX.....", "XXXX...X", ".XXXXXX.", "..XXXX.."] },
  'arrow-right': { px: 2, rows: ["....X...", "....XX..", "XXXXXXX.", "XXXXXXXX", "XXXXXXX.", "....XX..", "....X...", "........"] },
  // Version 3's grids (docs/dream/v3/data/pixel-art.json), beside the ones above that the flat scenery still draws.
  'sheep-head': { px: 2, rows: ["...XXXXX...", "..XXXXXXX..", ".XXXXXXXXX.", "ppXpppppXpp", "..XpopopX..", "..XpppppX..", "...ppopp...", "...ppppp...", "....ppp...."] },
  'sheep-side': { px: 2, rows: ["..XXXXXX....", ".XXXXXXXX.XX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", "XXXXXXXXX.X.", ".XXXXXXXX...", ".X.X..X.X...", ".X.X..X.X..."] },
  fence: { px: 2, rows: [".X...X...X..", "XXXXXXXXXXX.", ".X...X...X..", "XXXXXXXXXXX.", ".X...X...X..", ".X...X...X.."] },
  'moon-full': { px: 2, rows: ["..XXXX..", ".XXXXXX.", "XXoXXXXX", "XXXXXXXX", "XXXXXoXX", "XXXXXXXX", ".XXXXXX.", "..XXXX.."] },
  check: { px: 2, rows: [".......X", "......XX", "X....XX.", "XX..XX..", ".XXXX...", "..XX...."] },
  // Not in the pack: the close button's cross, 14 px with 2 px strokes (v3/08, section 3).
  cross: { px: 2, rows: ["X.....X", ".X...X.", "..X.X..", "...X...", "..X.X..", ".X...X.", "X.....X"] },
} as const satisfies Record<string, Art>;
export type ArtName = keyof typeof ART_GRIDS;
