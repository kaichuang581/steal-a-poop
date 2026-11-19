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

/**
 * The farm animals' material (Brian, 2026-11-18: the Blender renders of his sheets "look better by far" than the
 * game's): the voxel material shaded like a soft studio. Light wraps round each face (`wrap`: a big soft key, as
 * Blender's area light, so a side turned from the sun is lit, not black); a little of the animal's own colour comes
 * back as fill (`fill`: the light the floor and the world bounce back in Blender), so a white coat reads white and a
 * brown stays its own brown instead of greying. Development pages can try other amounts with ?wrap=, ?fill= and ?tm=0
 * (tone mapping off).
 */
// Tone mapping stays on: off, a white animal under the practice spotlight and its bloom burns out to a white blur.
export const STUDIO = { wrap: 0.35, fill: 0.25, toneMapped: true };
function studioFromUrl() {
  if (!import.meta.env.DEV || typeof location === 'undefined') return STUDIO;
  const q = new URLSearchParams(location.search);
  const n = (k: string, d: number) => (q.get(k) === null ? d : Number(q.get(k)));
  return { wrap: n('wrap', STUDIO.wrap), fill: n('fill', STUDIO.fill), toneMapped: q.get('tm') === '0' ? false : q.get('tm') === '1' ? true : STUDIO.toneMapped };
}
export function animalMaterial() {
  const { wrap, fill, toneMapped } = studioFromUrl();
  const m = voxelMaterial();
  m.toneMapped = toneMapped;
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    inner.call(m, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_lambert_pars_fragment>', `#include <lights_lambert_pars_fragment>
#undef RE_Direct
#define RE_Direct RE_Direct_Studio
void RE_Direct_Studio( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + ${wrap.toFixed(3)} ) / ${(1 + wrap).toFixed(3)} );
  reflectedLight.directDiffuse += dotNL * directLight.color * BRDF_Lambert( material.diffuseColor );
}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse += material.diffuseColor * ${fill.toFixed(3)};`);
  };
  const key = m.customProgramCacheKey;
  m.customProgramCacheKey = () => `${key.call(m)}-studio-${wrap}-${fill}`;
  return m;
}
