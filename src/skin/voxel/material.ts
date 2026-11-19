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
 * The soft shading every voxel takes (Brian, 2026-11-19: "the sheep are glowing. either match the scenery to that glow
 * or tone down the sheep glow"; his farm picture is lit like a soft studio). Light wraps round each face (`wrap`: a big
 * soft key, so a side turned from the sun is lit, not black), and a little of the surface's own colour comes back as
 * fill (`fill`: the light the snow and the sky bounce back), so white reads white and shadows stay open. Scenery and
 * animals take the same amounts, so neither glows against the other.
 *
 * `STUDIO_SWITCH` turns it off (0) for a scene that asks: a scene with `userData.plainLight` set is drawn in plain
 * Lambert, as the game was before. Home sets it on the wendigo's paddock shot, which keeps the light it had.
 */
export const STUDIO = { wrap: 0.35, fill: 0.22, toneMapped: true };
const STUDIO_SWITCH = { value: 1 };
const ALWAYS = { value: 1 };
function studioFromUrl() {
  if (!import.meta.env.DEV || typeof location === 'undefined') return STUDIO;
  const q = new URLSearchParams(location.search);
  const n = (k: string, d: number) => (q.get(k) === null ? d : Number(q.get(k)));
  return { wrap: n('wrap', STUDIO.wrap), fill: n('fill', STUDIO.fill), toneMapped: STUDIO.toneMapped };
}
const STUDIO_PARS = (wrap: number) => /* glsl */ `#include <lights_lambert_pars_fragment>
uniform float uStudio;
uniform float uShoulder;
#undef RE_Direct
#define RE_Direct RE_Direct_Studio
void RE_Direct_Studio( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float wrap = ${wrap.toFixed(3)} * uStudio;
  float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + wrap ) / ( 1.0 + wrap ) );
  reflectedLight.directDiffuse += dotNL * directLight.color * BRDF_Lambert( material.diffuseColor );
}`;
const STUDIO_FILL = (fill: number) => /* glsl */ `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse += material.diffuseColor * ( ${fill.toFixed(3)} * uStudio );`;
/**
 * No lit voxel is brighter than white (Brian, 2026-11-19: "the sheep are glowing"): what the lights make of a surface
 * is eased off toward `SHOULDER.knee + SHOULDER.over`, which is under the bloom's threshold (BLOOM_THRESHOLD in
 * table/Rendering.tsx), so wool under a spotlight and snow by a lamp stay white and never bloom. What glows of itself
 * (a material's own emissive: lanterns, bulbs) is left out of it and still blooms. Off where the scene asks for plain
 * light (the wendigo's paddock shot).
 */
export const SHOULDER = { knee: 0.95, over: 0.09 };
const STUDIO_SHOULDER = /* glsl */ `{
    vec3 lit = outgoingLight - totalEmissiveRadiance;
    float peak = max( lit.r, max( lit.g, lit.b ) ), past = peak - ${SHOULDER.knee.toFixed(3)};
    if ( uShoulder > 0.5 && past > 0.0 ) lit *= ( ${SHOULDER.knee.toFixed(3)} + past / ( 1.0 + past / ${SHOULDER.over.toFixed(3)} ) ) / peak;
    outgoingLight = lit + totalEmissiveRadiance;
  }
  #include <opaque_fragment>`;

/**
 * The one material every voxel mesh uses (plan V3 Part 4.2, V3.1 Part 1.1): Lambert with the baked vertex colours and
 * ambient occlusion from the mesher, shaded softly (STUDIO). No map, no outline: coplanar faces of one colour render as
 * one unbroken surface, and the cubes show only at silhouettes and real steps. `always`: the soft shading stays on in
 * a scene that asks for plain light (the animals).
 */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string; always?: boolean } = {}) {
  const { wrap, fill } = studioFromUrl();
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
    shader.uniforms.uStudio = opts.always ? ALWAYS : STUDIO_SWITCH;
    shader.uniforms.uShoulder = STUDIO_SWITCH; // the scene's, for the animals too
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', UNPACK);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_lambert_pars_fragment>', STUDIO_PARS(wrap))
      .replace('#include <lights_fragment_end>', STUDIO_FILL(fill))
      .replace('#include <opaque_fragment>', STUDIO_SHOULDER);
  };
  // The switch is read from the scene being drawn, just before this material's uniforms go to the card.
  if (!opts.always) m.onBeforeRender = (_renderer, scene) => { STUDIO_SWITCH.value = scene.userData.plainLight ? 0 : 1; };
  m.customProgramCacheKey = () => `voxel-color16-studio-${wrap}-${fill}-shoulder`;
  return withRoundedEdges(m);
}

/** The farm animals' material: the voxel material, softly shaded in every scene. */
export function animalMaterial() {
  const m = voxelMaterial({ always: true });
  m.toneMapped = studioFromUrl().toneMapped;
  return m;
}
