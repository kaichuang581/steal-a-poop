import { Color, MeshLambertMaterial } from 'three';

/**
 * The one material every voxel mesh uses (plan V3 Part 4.2, V3.1 Part 1.1): plain Lambert with the baked vertex
 * colours and ambient occlusion from the mesher. No map, no outline: coplanar faces of one colour render as one
 * unbroken surface, and the cubes show only at silhouettes and real steps.
 */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string } = {}) {
  return new MeshLambertMaterial({
    vertexColors: true,
    emissive: opts.emissive ? new Color(opts.emissive) : undefined,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    color: opts.color,
  });
}
