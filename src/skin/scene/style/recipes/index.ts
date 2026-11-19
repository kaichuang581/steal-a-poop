/**
 * Every diorama prop, one file each beside this one, holding only data (docs/diorama/PLAN.md, 5.2). A recipe is added
 * here when its reference sheet is in docs/diorama/reference/ and tools/propMatch.mjs passes it (milestone D2).
 */
import type { Recipe } from '../kit';

export const RECIPES: readonly Recipe[] = [];

export const recipeById = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);
