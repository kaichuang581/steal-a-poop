/** The dream's worlds, 1 to 3: his farm, the farm in the air, his bed (docs/dream/v3). */
export type StageN = 1 | 2 | 3;
/** The looks an obstacle's box can take: four fences and the bale. Each world has its own model for each. */
export const FENCE_LOOKS = ['rail', 'picket', 'wall', 'log'] as const;
export type Look = (typeof FENCE_LOOKS)[number] | 'bale';
/** The look of the obstacle at `index`: a bale is a bale; fences take the four looks in turn. Cosmetic only. */
export const lookOf = (kind: 'fence' | 'bale', index: number): Look => (kind === 'bale' ? 'bale' : FENCE_LOOKS[index % FENCE_LOOKS.length]);
