/**
 * The ground-contact patch (plan file 02, change 5): on the Low tier an animal casts no shadow, so it stands on this
 * instead, an opaque, stepped, dark voxel ellipse that goes wherever the animal goes. Built like `shadowDisc`
 * (dream/world.ts): voxels on the characters' 0.04 m grid in the hoof tone, one voxel thick, its top 0.005 above the
 * ground the hooves stand on, so no face of it lies in the ground's plane. Not transparent and not blurred.
 *
 * Sized from the model's own feet: the box round the bottom row of every leg at rest, grown by PATCH_MARGIN each way,
 * and the ellipse drawn through that box's corners, so every hoof is inside it with a margin. Built once per model
 * (one per species and look) and shared by every animal wearing it: one draw an animal. Model units, the animal's
 * root at the origin, as the Sheep component lays its parts out.
 */
import { Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { anchorsOf } from './animals/anchors';
import type { AnimalModel } from './animals/rig';
import { buildGeometry } from './mesher';
import { lin, T } from './palette';
import { Grid } from './primitives';
import type { SheepModel } from './sheep';

/** The characters' grid. */
export const PATCH_VOXEL = 0.04;
/** How far the patch's top stands over the ground (DreamStage's shadow disc sits there too). */
export const PATCH_LIFT = 0.005;
/** How far past the feet the patch reaches, each way. */
export const PATCH_MARGIN = 0.04;

export interface FootBounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** The box (x and z) round the bottom voxel row of every leg at rest, in model units. */
export function footBounds(model: SheepModel | AnimalModel): FootBounds {
  const floor = anchorsOf(model).feet[1];
  const b: FootBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const v = new Vector3();
  for (const leg of model.legs) {
    const p = leg.geo.getAttribute('position');
    if (!p) continue;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y + leg.pivot[1] > floor + PATCH_VOXEL + 1e-6) continue;
      const x = v.x + leg.pivot[0], z = v.z + leg.pivot[2];
      b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
      b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
    }
  }
  return b;
}

/** The patch's cells (x, z indices on the 0.04 m grid) for a model. */
export function patchCells(model: SheepModel | AnimalModel): [number, number][] {
  const f = footBounds(model);
  const cx = (f.minX + f.maxX) / 2, cz = (f.minZ + f.maxZ) / 2;
  // The ellipse through the corners of the grown box: semi-axes sqrt(2) times its half sides.
  const a = ((f.maxX - f.minX) / 2 + PATCH_MARGIN) * Math.SQRT2, c = ((f.maxZ - f.minZ) / 2 + PATCH_MARGIN) * Math.SQRT2;
  const s = PATCH_VOXEL, out: [number, number][] = [];
  for (let x = Math.floor((cx - a) / s) - 1; x <= Math.ceil((cx + a) / s) + 1; x++)
    for (let z = Math.floor((cz - c) / s) - 1; z <= Math.ceil((cz + c) / s) + 1; z++)
      if ((((x + 0.5) * s - cx) / a) ** 2 + (((z + 0.5) * s - cz) / c) ** 2 <= 1) out.push([x, z]);
  return out;
}

const made = new WeakMap<object, BufferGeometry>();

/** The patch for a model, built on first use and shared after. */
export function contactPatch(model: SheepModel | AnimalModel): BufferGeometry {
  const hit = made.get(model);
  if (hit) return hit;
  const g = new Grid(PATCH_VOXEL);
  const tone = lin(T.hoof[2]);
  for (const [x, z] of patchCells(model)) g.set(x, 0, z, tone);
  // No underside (it lies on the ground and casts nothing), and the flat top drawn as rectangles where it can be.
  const geo = buildGeometry(g.map, PATCH_VOXEL, { merge: true, unseen: (axis, sign) => axis === 1 && sign < 0 });
  geo.translate(0, anchorsOf(model).feet[1] + PATCH_LIFT - PATCH_VOXEL, 0);
  geo.computeBoundingSphere();
  made.set(model, geo);
  return geo;
}
