import { Color, MeshLambertMaterial } from 'three';
import { COLOR_RANGE } from './mesher';
import { withRoundedEdges } from './rounded';

/**
 * A packed geometry's colour (`packGeometry` in mesher.ts) is 16-bit at 1 / COLOR_RANGE of its value with a fourth
 * number, so three compiles it with USE_COLOR_ALPHA; this multiplies it back. A geometry with plain float colours
 * (every animal, prop and model that is not scenery) has three numbers, compiles without it and is untouched.
 */
const UNPACK = /* glsl */ `#include <color_vertex>
#ifdef USE_COLOR_ALPHA
  vColor.rgb *= ${COLOR_RANGE.toFixed(1)};
#endif`;

/**
 * The one material every voxel mesh uses (plan V3 Part 4.2, V3.1 Part 1.1): plain Lambert with the baked vertex
 * colours and ambient occlusion from the mesher. No map, no outline: coplanar faces of one colour render as one
 * unbroken surface, and the cubes show only at silhouettes and real steps.
 */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string } = {}) {
  // Only the parameters that are set: three warns about every one given as undefined, and that was thousands a load.
  const m = new MeshLambertMaterial({
    vertexColors: true,
    ...(opts.emissive ? { emissive: new Color(opts.emissive) } : {}),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    ...(opts.color ? { color: opts.color } : {}),
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', UNPACK);
  };
  m.customProgramCacheKey = () => 'voxel-color16';
  return withRoundedEdges(m);
}
