/**
 * The diorama style lint (docs/diorama/PLAN.md, 5.5): arithmetic only. It fails when a recipe leaves the size ladder or
 * the palette, has more than six colour tokens, exceeds its detail budget or has no footprint or support, and when a
 * file of the new style picks a colour at random.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gridsOf, stepsOf } from '../style/kit';
import type { Recipe } from '../style/kit';
import { LADDER, LADDER_SIZES, TOKENS } from '../style/palette';
import { RECIPES } from '../style/recipes';

/** The scenery builders already rebuilt from recipes; each joins this list in its milestone (D3 to D8). */
const REBUILT: string[] = [];
const STYLE_DIR = 'src/skin/scene/style';
const RANDOM_COLOUR = /\b(rng|hash3|pick|snowPaint|snowAt)\s*\(/;

/** Everything wrong with one recipe, in words. */
export function lint(r: Recipe): string[] {
  const out: string[] = [];
  if (!(r.step in LADDER)) out.push(`${r.id}: step ${r.step} is not on the ladder`);
  for (const p of r.parts) {
    if (p.step && !(p.step in LADDER)) out.push(`${r.id} ${p.name}: step ${p.step} is not on the ladder`);
    if (!(p.token in TOKENS)) out.push(`${r.id} ${p.name}: ${p.token} is not a palette token`);
    if (p.value !== undefined && (!Number.isInteger(p.value) || Math.abs(p.value) > 3)) out.push(`${r.id} ${p.name}: value ${p.value} is not a whole step within 3`);
    if (p.size.some((v) => !Number.isInteger(v) || v < 1) || p.at.some((v) => !Number.isInteger(v))) out.push(`${r.id} ${p.name}: not whole cells, or under one cell`);
  }
  const tokens = new Set(r.parts.map((p) => p.token));
  if (tokens.size > 6) out.push(`${r.id}: ${tokens.size} colour tokens (at most 6)`);
  const xs = r.parts.filter((p) => (p.step ?? r.step) === 'XS').length;
  if (xs > r.detail) out.push(`${r.id}: ${xs} XS parts over its detail budget of ${r.detail}`);
  if (!(r.footprint?.[0] > 0 && r.footprint?.[1] > 0)) out.push(`${r.id}: no footprint`);
  if (!r.support) out.push(`${r.id}: no support`);
  if (!r.reference) out.push(`${r.id}: no reference sheet named`);
  for (const g of gridsOf(r).values()) if (!LADDER_SIZES.includes(g.size)) out.push(`${r.id}: a mesh at ${g.size} m, off the ladder`);
  return out;
}

describe('the diorama style lint (plan 5.5)', () => {
  it('passes every recipe', () => {
    expect(RECIPES.flatMap(lint)).toEqual([]);
    expect(new Set(RECIPES.map((r) => r.id)).size, 'recipe ids are unique').toBe(RECIPES.length);
  });

  it('finds no random colour in the style files or a rebuilt builder', () => {
    const files = [...readdirSync(STYLE_DIR, { recursive: true }).map((f) => join(STYLE_DIR, String(f))).filter((f) => /\.tsx?$/.test(f)), ...REBUILT];
    const bad = files.filter((f) => RANDOM_COLOUR.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('catches what it is meant to (its own check)', () => {
    const good: Recipe = { id: 'fixture', step: 'S', footprint: [0.5, 0.5], support: 'floor', detail: 1, reference: 'fixture',
      parts: [{ name: 'a', at: [0, 0, 0], size: [2, 2, 2], token: 'wood' }, { name: 'b', at: [0, 0, 0], size: [1, 1, 1], token: 'trim', step: 'XS' }] };
    expect(lint(good)).toEqual([]);
    expect(stepsOf(good)).toEqual(['S', 'XS']);
    const many = ['wood', 'trim', 'hay', 'roof', 'barn', 'stone', 'leaf'] as const;
    const bad: Recipe = { ...good, detail: 0, footprint: [0, 0.5], parts: many.map((token, i) => ({ name: `p${i}`, at: [i, 0, 0], size: [1, 1, 1], token, step: i ? undefined : 'XS' })) };
    const said = lint(bad).join('\n');
    expect(said).toMatch(/7 colour tokens/);
    expect(said).toMatch(/over its detail budget/);
    expect(said).toMatch(/no footprint/);
    expect(lint({ ...good, parts: [{ name: 'c', at: [0, 0, 0], size: [1.5, 1, 1], token: 'wood' }] }).join()).toMatch(/whole cells/);
    expect(RANDOM_COLOUR.test('const c = pick(T.snow, r);')).toBe(true);
  });
});
