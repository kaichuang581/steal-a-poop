import type { Material } from 'three';

/**
 * Rounded voxel corners, ON TRIAL (requested by Brian, 2026-11-09: "make all the voxels SLIGHTLY rounded on the corners
 * so everything doesnt feel so sharp ... i might ask to change it back"). To go back to sharp voxels, set
 * `ROUNDED_VOXELS` to false: the mesher then emits no `bevel` attribute and the materials compile exactly as before.
 * `?voxels=sharp` or `?voxels=round` on the URL overrides it for a side-by-side look.
 *
 * How it works: nothing about the geometry's shape changes (still axis-aligned voxels, same triangles, same
 * silhouettes). The mesher marks, per face, which of its four edges is an outer corner: no voxel beside it in that
 * direction and none diagonally out, so a flat wall of many voxels stays one smooth surface and only real edges round.
 * The voxel materials then bend the lighting normal toward that edge over the last `BEVEL.width` of the face, so both
 * faces meeting at a corner shade into each other like a small bevel.
 */
export const ROUNDED_VOXELS = true;

/** How far in from an edge the rounding starts (share of the voxel) and how far the normal bends at the very edge. */
export const BEVEL = { width: 0.16, strength: 1 } as const;

function fromUrl(): boolean | null {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('voxels');
    return q === 'sharp' ? false : q === 'round' ? true : null;
  } catch { return null; }
}

/** Whether voxels are rounded in this page. */
export const ROUND: boolean = fromUrl() ?? ROUNDED_VOXELS;

/** The four edges of a face, as bits of the `bevel` attribute's third value: -t1, +t1, -t2, +t2 (see mesher.ts). */
export const EDGE = { t1Lo: 1, t1Hi: 2, t2Lo: 4, t2Hi: 8 } as const;

const VERT_HEAD = /* glsl */ `
attribute vec3 bevel;
varying vec3 vBevel;
varying vec3 vBevelT1;
varying vec3 vBevelT2;
`;
// After defaultnormal_vertex: the face's two tangent axes, from its axis-aligned normal (x: y,z; y: x,z; z: x,y).
const VERT_BODY = /* glsl */ `
  vBevel = bevel;
  vBevelT1 = normalMatrix * ( abs( objectNormal.x ) > 0.5 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) );
  vBevelT2 = normalMatrix * ( abs( objectNormal.z ) > 0.5 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 0.0, 0.0, 1.0 ) );
`;
const FRAG_HEAD = /* glsl */ `
varying vec3 vBevel;
varying vec3 vBevelT1;
varying vec3 vBevelT2;
`;
// After normal_fragment_begin. A face with no rounded edges (mask 0, or a mesh without the attribute) is untouched.
const FRAG_BODY = /* glsl */ `
  if ( vBevel.z > 0.5 ) {
    float m = floor( vBevel.z + 0.5 );
    float e0 = mod( m, 2.0 ), e1 = mod( floor( m / 2.0 ), 2.0 ), e2 = mod( floor( m / 4.0 ), 2.0 ), e3 = mod( floor( m / 8.0 ), 2.0 );
    float bw = ${BEVEL.width.toFixed(3)};
    float bx = e1 * ( 1.0 - smoothstep( 0.0, bw, 1.0 - vBevel.x ) ) - e0 * ( 1.0 - smoothstep( 0.0, bw, vBevel.x ) );
    float by = e3 * ( 1.0 - smoothstep( 0.0, bw, 1.0 - vBevel.y ) ) - e2 * ( 1.0 - smoothstep( 0.0, bw, vBevel.y ) );
    normal = normalize( normal + ( normalize( vBevelT1 ) * bx + normalize( vBevelT2 ) * by ) * ${BEVEL.strength.toFixed(3)} );
  }
`;

/** Gives a voxel material the rounded edges (a no-op when they are off). Returns the same material. */
export function withRoundedEdges<M extends Material>(m: M): M {
  if (!ROUND) return m;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>\n${FRAG_BODY}`);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}|voxel-bevel`;
  return m;
}
