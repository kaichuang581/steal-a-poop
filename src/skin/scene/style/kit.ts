/**
 * The diorama kit (docs/diorama/PLAN.md, 5.2): a recipe is a prop written as data, its parts are boxes in whole cells
 * of one ladder step, each one palette token (or a token's value step). The builders below only make parts; nothing
 * here picks a colour at random or bevels an edge. `buildRecipe` meshes a recipe, one geometry per step it uses.
 */
import type { BufferGeometry } from 'three';
import { buildGeometry } from '../../voxel/mesher';
import { lin } from '../../voxel/palette';
import { Grid } from '../../voxel/primitives';
import { hexOf, LADDER, TOKENS } from './palette';
import type { Step, Token } from './palette';

export type V3 = readonly [number, number, number];
/** What a prop stands on, as the placement list says it (scene/placed.ts). */
export type Support = 'floor' | 'beam' | 'bedding' | 'post';

/** One box of a recipe: `at` its low corner and `size` its extent, in cells of `step` (the recipe's when unset). */
export interface Part {
  name: string;
  at: V3;
  size: V3;
  token: Token;
  /** Value steps lighter (+) or darker (-) than the token (3.2). */
  value?: number;
  step?: Step;
}

export interface Recipe {
  id: string;
  /** The step its structure is built at; a part may use a finer one for detail. */
  step: Step;
  parts: Part[];
  /** Width (x) and depth (z) of what it stands on, in metres; its parts are centred on x = 0, z = 0 and stand on y = 0. */
  footprint: readonly [number, number];
  support: Support;
  /** The most XS parts it may have (3.4.2). */
  detail: number;
  /** Where its reference sheet is: docs/diorama/reference/<reference>-34.png, -front, -side, -top. */
  reference: string;
}

/** The token one darker step of a pair, when the palette has one ("barn" and "barn-1"), else the token one value darker. */
function darker(token: Token): { token: Token; value: number } {
  const pair = `${token}-1`;
  return pair in TOKENS ? { token: pair as Token, value: 0 } : { token, value: -1 };
}

// ---------------------------------------------------------------------------------------------------------------------
// The builders: each returns parts, in cells of the step it is given
// ---------------------------------------------------------------------------------------------------------------------

export const slab = (name: string, at: V3, size: V3, token: Token, value = 0, step?: Step): Part => ({ name, at, size, token, value, step });

/** A wall of upright boards `board` cells wide, alternating the token and its darker step, along x or z. */
export function boardWall(name: string, at: V3, size: V3, token: Token, board = 2, step?: Step): Part[] {
  const along = size[0] >= size[2] ? 0 : 2, out: Part[] = [], dark = darker(token);
  for (let i = 0, k = 0; i < size[along]; i += board, k++) {
    const w = Math.min(board, size[along] - i);
    const a: [number, number, number] = [...at], s: [number, number, number] = [...size];
    a[along] += i; s[along] = w;
    out.push(k % 2 ? { name: `${name}.${k}`, at: a, size: s, token: dark.token, value: dark.value, step } : { name: `${name}.${k}`, at: a, size: s, token, step });
  }
  return out;
}

/** An upright post, `w` cells square. */
export const post = (name: string, at: V3, height: number, token: Token, w = 1, step?: Step): Part => ({ name, at, size: [w, height, w], token, step });

/** A rail `length` cells long along x or z, `t` cells thick and tall. */
export const rail = (name: string, at: V3, length: number, along: 'x' | 'z', token: Token, t = 1, step?: Step): Part =>
  ({ name, at, size: along === 'x' ? [length, t, t] : [t, t, length], token, step });

/**
 * A gable roof over a `width` (x) by `depth` (z) footprint, ridge along z: slabs one cell tall, each `inset` cells in
 * from the one under it on both sides, until it closes, and every top a snow cap in winter if `snow`.
 */
export function gableRoof(name: string, at: V3, width: number, depth: number, token: Token, inset = 1, snow = false, step?: Step): Part[] {
  const out: Part[] = [];
  for (let k = 0, w = width; w > 0; k++, w -= 2 * inset) {
    out.push({ name: `${name}.${k}`, at: [at[0] + k * inset, at[1] + k, at[2]], size: [w, 1, depth], token, step });
    if (snow) out.push({ name: `${name}.${k}.snow`, at: [at[0] + k * inset, at[1] + k + 1, at[2]], size: [Math.min(w, inset), 1, depth], token: 'ground.top', step }, { name: `${name}.${k}.snow'`, at: [at[0] + k * inset + w - Math.min(w, inset), at[1] + k + 1, at[2]], size: [Math.min(w, inset), 1, depth], token: 'ground.top', step });
  }
  return out;
}

/** A box canopy on a trunk: the canopy one token, its bottom ring one step darker (an orchard tree). */
export function boxCanopy(name: string, at: V3, trunk: number, canopy: V3, step?: Step): Part[] {
  const cx = at[0] + Math.floor(canopy[0] / 2), cz = at[2] + Math.floor(canopy[2] / 2);
  return [
    post(`${name}.trunk`, [cx, at[1], cz], trunk + 1, 'trunk', 1, step),
    { name: `${name}.under`, at: [at[0], at[1] + trunk, at[2]], size: [canopy[0], 1, canopy[2]], token: 'leaf-1', step },
    { name: `${name}.canopy`, at: [at[0], at[1] + trunk + 1, at[2]], size: [canopy[0], canopy[1] - 1, canopy[2]], token: 'leaf', step },
  ];
}

/** A pine of stacked square tiers, each two cells narrower and `tier` cells tall, on a trunk; tiers alternate leaf tones. */
export function tierPine(name: string, at: V3, base: number, tiers: number, tier = 2, trunk = 2, snow = false, step?: Step): Part[] {
  const c = at[0] + Math.floor(base / 2), out: Part[] = [post(`${name}.trunk`, [c, at[1], at[2] + Math.floor(base / 2)], trunk + 1, 'trunk', 1, step)];
  for (let k = 0, w = base; k < tiers && w > 0; k++, w -= 2) {
    const o = (base - w) / 2, y = at[1] + trunk + k * tier;
    out.push({ name: `${name}.tier${k}`, at: [at[0] + o, y, at[2] + o], size: [w, tier, w], token: k % 2 ? 'leaf-1' : 'leaf', step });
    if (snow) out.push({ name: `${name}.tier${k}.snow`, at: [at[0] + o, y + tier, at[2] + o], size: [w, 1, w], token: 'ground.top', step });
  }
  return out;
}

/** A hay bale: a box with two straps one cell proud round its middle thirds. */
export function bale(name: string, at: V3, size: V3, step?: Step): Part[] {
  const third = Math.max(1, Math.floor(size[0] / 3));
  return [
    { name: `${name}.body`, at, size, token: 'hay', step },
    ...[third, size[0] - third - 1].map((x, i): Part => ({ name: `${name}.strap${i}`, at: [at[0] + x, at[1], at[2] - 1], size: [1, size[1] + 1, size[2] + 2], token: 'hay', value: -2, step })),
  ];
}

/** A crate: a wood box with a darker band round its top and bottom. */
export function crate(name: string, at: V3, size: V3, step?: Step): Part[] {
  return [
    { name: `${name}.body`, at: [at[0], at[1] + 1, at[2]], size: [size[0], size[1] - 2, size[2]], token: 'wood', step },
    { name: `${name}.foot`, at, size: [size[0], 1, size[2]], token: 'wood-1', step },
    { name: `${name}.lid`, at: [at[0], at[1] + size[1] - 1, at[2]], size: [size[0], 1, size[2]], token: 'wood-1', step },
  ];
}

/** A rock: a stone box with a smaller, lighter top, one cell in on every side. */
export function rock(name: string, at: V3, size: V3, step?: Step): Part[] {
  return [
    { name: `${name}.body`, at, size, token: 'stone-1', step },
    { name: `${name}.top`, at: [at[0] + 1, at[1] + size[1], at[2] + 1], size: [Math.max(1, size[0] - 2), 1, Math.max(1, size[2] - 2)], token: 'stone', step },
  ];
}

/** A diorama base (3.6): a top layer of ground, one of ground side, then soil layers alternating, squared, under y = 0. */
export function tileBase(name: string, w: number, d: number, soil = 2, step?: Step): Part[] {
  const x0 = -Math.floor(w / 2), z0 = -Math.floor(d / 2);
  return [
    { name: `${name}.top`, at: [x0, -1, z0], size: [w, 1, d], token: 'ground.top', step },
    { name: `${name}.side`, at: [x0, -2, z0], size: [w, 1, d], token: 'ground.side', step },
    ...Array.from({ length: soil }, (_, k): Part => ({ name: `${name}.soil${k}`, at: [x0, -3 - k, z0], size: [w, 1, d], token: k % 2 ? 'soil-1' : 'soil', step })),
  ];
}

/** A flat snow layer on top of a part, the same footprint, `t` cells thick, in the same grid (so it can never hover). */
export const snowCap = (on: Part, t = 1): Part => ({ name: `${on.name}.snow`, at: [on.at[0], on.at[1] + on.size[1], on.at[2]], size: [on.size[0], t, on.size[2]], token: 'ground.top', step: on.step });

// ---------------------------------------------------------------------------------------------------------------------
// Meshing
// ---------------------------------------------------------------------------------------------------------------------

/** The steps a recipe's parts use. */
export const stepsOf = (r: Recipe): Step[] => [...new Set(r.parts.map((p) => p.step ?? r.step))];

/** A recipe as voxel grids, one per step, with each part's flat colour. Later parts overwrite earlier ones. */
export function gridsOf(r: Recipe): Map<Step, Grid> {
  const out = new Map<Step, Grid>();
  for (const p of r.parts) {
    const step = p.step ?? r.step;
    let g = out.get(step);
    if (!g) out.set(step, (g = new Grid(LADDER[step])));
    const c = lin(hexOf(p.token, p.value ?? 0));
    for (let x = 0; x < p.size[0]; x++) for (let y = 0; y < p.size[1]; y++) for (let z = 0; z < p.size[2]; z++) g.set(p.at[0] + x, p.at[1] + y, p.at[2] + z, c);
  }
  return out;
}

/** A recipe's meshes, one per step, in metres, standing on y = 0. */
export function buildRecipe(r: Recipe): { step: Step; geo: BufferGeometry }[] {
  return [...gridsOf(r)].map(([step, g]) => ({ step, geo: buildGeometry(g.map, g.size) }));
}
