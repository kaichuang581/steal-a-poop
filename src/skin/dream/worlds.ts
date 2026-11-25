/**
 * Which world the dream is in (docs/dream/v3/01-endless-and-a-best-score.md, section 5). Nothing on screen announces it.
 * While the sign shows one letter it is world 1, two letters world 2; from the first fence with three letters (`F3`,
 * read from the rules, never typed) world 3 for WORLD_LENGTH fences, then the worlds go round, WORLD_LENGTH each.
 */
export const WORLD_LENGTH = 15;
/** letters: how many letters fence f's sign shows, read from the game. F3: the first fence with three letters. */
export function worldAt(f: number, letters: 1 | 2 | 3, F3: number): 1 | 2 | 3 {
  if (letters < 3) return letters;
  return ([3, 1, 2] as const)[Math.floor((f - F3) / WORLD_LENGTH) % 3];
}
/** 1 for the first time round; 2 from the first return to world 1; and so on. */
export function lapAt(f: number, F3: number): number {
  return f < F3 + WORLD_LENGTH ? 1 : 2 + Math.floor((f - F3 - WORLD_LENGTH) / (3 * WORLD_LENGTH));
}
