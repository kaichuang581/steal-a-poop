import { Color, MeshLambertMaterial } from 'three';
import { withRoundedEdges } from './rounded';

/**
 * The one material every voxel mesh uses (plan V3 Part 4.2, V3.1 Part 1.1): plain Lambert with the baked vertex
 * colours and ambient occlusion from the mesher. No map, no outline: coplanar faces of one colour render as one
 * unbroken surface, and the cubes show only at silhouettes and real steps.
 */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string } = {}) {
  // Only the parameters that are set: three warns about every one given as undefined, and that was thousands a load.
  return withRoundedEdges(new MeshLambertMaterial({
    vertexColors: true,
    ...(opts.emissive ? { emissive: new Color(opts.emissive) } : {}),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    ...(opts.color ? { color: opts.color } : {}),
  }));
}
