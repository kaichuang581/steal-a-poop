import { Group, Mesh, MeshBasicMaterial } from 'three';
import type { Material } from 'three';
import { meshModel, toGeometry } from '../dream/models';
import type { MeshOptions, ModelMesh } from '../dream/models';
import { COLOURS, GLOW, MODELS as CORE, PARTS } from './models.gen';
import type { ModelData } from './models.gen';

/**
 * The Trading Post and Practice models (docs/trading-post-practice, T2 to T5 and P1 to P3): the pack's boxes, cell for
 * cell, meshed by the dream's grid mesher (dream/models.ts) with the dream's glows. Nothing here is modelled by hand.
 */
export { COLOURS, PARTS };
/** Every model loaded so far: the bombs ship with the game; the market and the rink add theirs when their screens load. */
export const MODELS: Record<string, ModelData> = { ...CORE };
export function addModels(more: Record<string, ModelData>): void { Object.assign(MODELS, more); }

/** A part's bit, for `MeshOptions.parts`. */
export const partBit = (...names: string[]): number => names.reduce((m, n) => { const i = PARTS.indexOf(n); return i < 0 ? m : m | (1 << i); }, 0);

/** A model meshed once for a set of options (shared by every placement). */
export function tpMesh(id: string, o: MeshOptions = { festive: true }): ModelMesh {
  const m = MODELS[id];
  if (!m) throw new Error(`no Trading Post model "${id}"`);
  return meshModel(`tp:${id}`, m, COLOURS, GLOW, o);
}

/** Unlit vertex colours: the mesher has the face light in them already. One material for every lit mesh, one for glows. */
export const flatLit: Material = new MeshBasicMaterial({ vertexColors: true });
export const flatGlow: Material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/** A model as a group: its lit mesh, and its glowing boxes drawn unshaded. `lit` lets a scene with real lights pass its own material. */
export function tpObject(id: string, o: MeshOptions = { festive: true }, lit: Material = flatLit): Group {
  const mm = tpMesh(id, o), g = new Group();
  g.name = id;
  if (mm.lit.idx.length) g.add(new Mesh(toGeometry(mm.lit), lit));
  if (mm.glow.idx.length) g.add(new Mesh(toGeometry(mm.glow), flatGlow));
  return g;
}
