import { Color, MeshLambertMaterial } from 'three';
import { COLOR_RANGE } from './mesher';
import { withRoundedEdges } from './rounded';
import { SHADE_UNIFORMS, shadeFor } from './groundShade';

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
 * The ground's shade map (voxel/groundShade.ts; docs/miniature/04, section 5): where a face lies in the world and
 * whether it looks up, handed to the fragment shader, which darkens ground-level top faces by the map. A scene with no
 * map reads a white texel and nothing changes.
 */
const SHADE_VERTEX_PARS = /* glsl */ `#include <common>
varying vec3 vShadeAt;
varying float vShadeUp;`;
const SHADE_VERTEX = /* glsl */ `#include <project_vertex>
{
  vec4 shadeAt = vec4( transformed, 1.0 );
  vec3 shadeUp = normal;
  #ifdef USE_INSTANCING
    shadeAt = instanceMatrix * shadeAt;
    shadeUp = mat3( instanceMatrix ) * shadeUp;
  #endif
  vShadeAt = ( modelMatrix * shadeAt ).xyz;
  vShadeUp = normalize( mat3( modelMatrix ) * shadeUp ).y;
}`;
const SHADE_FRAGMENT_PARS = /* glsl */ `#include <common>
uniform sampler2D uGroundShade;
uniform vec2 uShadeOrigin;
uniform vec2 uShadeSize;
varying vec3 vShadeAt;
varying float vShadeUp;
vec3 groundShade = vec3( 1.0 );`;
/**
 * In shade the ground is lit by the sky, so the shade is a little blue. Only the ground, drifts and dents: under 0.26 m.
 * The map holds how bright the ground is, 0.6 (the deepest) to 1 (open ground): about 0.75 along the foot of a long
 * wall and 0.9 round a post, which is what the plan says the snow is there. So the stored value is the brightness, in
 * the plan's own shade colour (its 0.78, 0.83, 0.93, scaled so its red is the value): the plan's line, mixing toward
 * that colour by the stored value, darkened a wall's foot by 5% and nothing else that could be seen.
 * It is worked out here and laid over the lit colour after the shoulder (STUDIO_SHOULDER): snow in the sun is lit far past
 * white and eased back to it, so a shade taken off its colour before the light was eased away to nothing.
 */
const SHADE_FRAGMENT = /* glsl */ `#include <color_fragment>
if ( vShadeUp > 0.5 && vShadeAt.y < 0.26 ) {
  float shade = texture2D( uGroundShade, ( vShadeAt.xz - uShadeOrigin ) / uShadeSize ).r;
  groundShade = mix( vec3( 0.60, 0.64, 0.715 ), vec3( 1.0 ), clamp( ( shade - 0.6 ) / 0.4, 0.0, 1.0 ) );
}`;

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
/**
 * The wrap and self-fill as shared uniforms (docs/depth/DEPTH-PLAN.md, A1): set just before each draw from the scene's
 * `userData.studio`, so Home's golden afternoon can use its own while a scene that sets nothing keeps STUDIO's (or a
 * development URL's `?wrap=` / `?fill=`).
 */
const WRAP = { value: STUDIO.wrap };
const FILL = { value: STUDIO.fill };
function studioFor(scene: { userData: Record<string, unknown> }, base: { wrap: number; fill: number }) {
  const s = scene.userData.studio as { wrap: number; fill: number } | undefined;
  WRAP.value = s?.wrap ?? base.wrap;
  FILL.value = s?.fill ?? base.fill;
}
const STUDIO_PARS = /* glsl */ `#include <lights_lambert_pars_fragment>
uniform float uStudio;
uniform float uShoulder;
uniform float uWrap;
uniform float uFill;
#undef RE_Direct
#define RE_Direct RE_Direct_Studio
void RE_Direct_Studio( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float wrap = uWrap * uStudio;
  float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + wrap ) / ( 1.0 + wrap ) );
  reflectedLight.directDiffuse += dotNL * directLight.color * BRDF_Lambert( material.diffuseColor );
}`;
const STUDIO_FILL = /* glsl */ `#include <lights_fragment_end>
  reflectedLight.indirectDiffuse += material.diffuseColor * ( uFill * uStudio );`;
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
    outgoingLight = lit * groundShade + totalEmissiveRadiance;
  }
  #include <opaque_fragment>`;

/**
 * The one material every voxel mesh uses (plan V3 Part 4.2, V3.1 Part 1.1): Lambert with the baked vertex colours and
 * ambient occlusion from the mesher, shaded softly (STUDIO). No map, no outline: coplanar faces of one colour render as
 * one unbroken surface, and the cubes show only at silhouettes and real steps. `always`: the soft shading stays on in
 * a scene that asks for plain light (the animals).
 */
export function voxelMaterial(opts: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; color?: string; always?: boolean; homeGlow?: boolean } = {}) {
  const base = studioFromUrl();
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
    shader.uniforms.uWrap = WRAP;
    shader.uniforms.uFill = FILL;
    Object.assign(shader.uniforms, SHADE_UNIFORMS);
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', UNPACK).replace('#include <common>', SHADE_VERTEX_PARS).replace('#include <project_vertex>', SHADE_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', SHADE_FRAGMENT_PARS)
      .replace('#include <color_fragment>', SHADE_FRAGMENT)
      .replace('#include <lights_lambert_pars_fragment>', STUDIO_PARS)
      .replace('#include <lights_fragment_end>', STUDIO_FILL)
      .replace('#include <opaque_fragment>', STUDIO_SHOULDER);
  };
  // The switch is read from the scene being drawn, just before this material's uniforms go to the card.
  // A lamp named for it (`homeGlow`) burns as much brighter as the scene asks (`userData.glow`; Home by day, A3).
  const lit = m.emissiveIntensity;
  m.onBeforeRender = (_renderer, scene) => {
    if (!opts.always) { STUDIO_SWITCH.value = scene.userData.plainLight ? 0 : 1; shadeFor(scene); }
    studioFor(scene, base);
    if (opts.homeGlow) m.emissiveIntensity = lit * ((scene.userData.glow as number | undefined) ?? 1);
  };
  m.customProgramCacheKey = () => 'voxel-color16-studio-uniform-shoulder-shade4';
  return withRoundedEdges(m);
}

/** The farm animals' material: the voxel material, softly shaded in every scene. */
export function animalMaterial() {
  const m = voxelMaterial({ always: true });
  m.toneMapped = studioFromUrl().toneMapped;
  return m;
}
