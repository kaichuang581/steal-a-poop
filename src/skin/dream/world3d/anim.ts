import { AdditiveBlending, Color, ShaderMaterial } from 'three';
import type { BufferGeometry, Material, MeshLambertMaterial } from 'three';
import { Float32BufferAttribute } from 'three';
import { voxelMaterial } from '../../voxel/material';

/**
 * The dream's scenery is merged into one mesh a row (the game's rule), yet things in it move on their own: world 2's
 * islands bob in three groups and rise at lift-off, world 3's quilt squares pop up row by row behind a wave, its
 * buttons turn and drop down their threads, the fence's bulbs chase. Each vertex carries what it needs (`anim`, `spin`)
 * and a few uniforms move them all at once, in the vertex shader. With every uniform at rest nothing moves.
 *
 * anim: x the pivot height a part grows from or pops about (metres; -1000 for none), y how far it is lifted from the
 * ground in its world (lift-off brings it up from 0), z its row (the quilt's iz) or -1, w its bob phase (radians) or -1.
 * spin: x, z the axis a button turns about, and its number (-1 for none). bulb: its number along the strip, or -1.
 */
export interface AnimUniforms {
  uBeat: { value: number };
  /** Islands: 0 to 1, grown down from their top. */
  uGrow: { value: number };
  /** Islands: 0 at the ground, 1 at their height. */
  uLift: { value: number };
  /** Islands bob (1) or not (0). */
  uBob: { value: number };
  /** The gate the wave runs from, world x in metres; seconds since it began (1e4 at rest). */
  uGateX: { value: number };
  uWaveT: { value: number };
  /** Squares behind the wave pop up (1) or drop flat (-1); 0 none. */
  uPop: { value: number };
  /** New track bays rise 0.3 m into place as the wave reaches them (1). */
  uRise: { value: number };
  /** Show only where the wave has been (1), only where it has not (-1), or all (0). */
  uReveal: { value: number };
  /** Buttons: seconds since they began to drop (or to be pulled up, with uDropDir -1). */
  uDropT: { value: number };
  uDropDir: { value: number };
  /** The beat at which buttons turn: 1 to turn, 0 still. */
  uTurn: { value: number };
}
export const animUniforms = (): AnimUniforms => ({
  uBeat: { value: 0 }, uGrow: { value: 1 }, uLift: { value: 1 }, uBob: { value: 0 }, uGateX: { value: 0 }, uWaveT: { value: 1e4 },
  uPop: { value: 0 }, uRise: { value: 0 }, uReveal: { value: 0 }, uDropT: { value: 1e4 }, uDropDir: { value: 1 }, uTurn: { value: 0 },
});

const VERT_PARS = /* glsl */ `
attribute vec4 anim;
attribute vec3 spin;
uniform float uBeat, uGrow, uLift, uBob, uGateX, uWaveT, uPop, uRise, uReveal, uDropT, uDropDir, uTurn;
varying float vWorldX;
`;
const VERT = /* glsl */ `#include <begin_vertex>
{
  vec4 w0 = modelMatrix * vec4( transformed, 1.0 );
  // The wave from a gate, 16 m a second; a quilt row 40 ms after the one before it.
  float tw = uWaveT - abs( w0.x - uGateX ) / 16.0 - max( anim.z, 0.0 ) * 0.04;
  if ( anim.x > -999.0 ) {
    if ( uPop > 0.5 ) {
      float s = tw < 0.0 ? 0.0 : tw < 0.11 ? 1.15 * tw / 0.11 : tw < 0.22 ? 1.15 - 0.15 * ( tw - 0.11 ) / 0.11 : 1.0;
      transformed.y = anim.x + ( transformed.y - anim.x ) * s;
    } else if ( uPop < -0.5 ) {
      transformed.y = anim.x + ( transformed.y - anim.x ) * ( 1.0 - clamp( tw / 0.18, 0.0, 1.0 ) );
    } else if ( transformed.y < anim.x ) {
      transformed.y = anim.x + ( transformed.y - anim.x ) * uGrow;
    }
  }
  if ( uRise > 0.5 ) transformed.y -= 0.3 * ( 1.0 - clamp( tw / 0.12, 0.0, 1.0 ) );
  transformed.y -= anim.y * ( 1.0 - uLift );
  // The string of bulbs lies in one long wave travelling along the lane (v3/05, section 3): anim.w is 1000 + its bay's x.
  if ( anim.w > 500.0 ) { float xb = anim.w - 1000.0; transformed.y += uBob * 0.30 * ( sin( xb / 3.0 - 6.2831853 * uBeat / 8.0 ) - sin( xb / 3.0 ) ); }
  else if ( anim.w > -0.5 ) transformed.y += uBob * 0.18 * sin( 6.2831853 * uBeat / 8.0 + anim.w );
  if ( spin.z > -0.5 ) {
    // A button: a half turn about its thread over 300 ms on its beat (4k + n mod 4), and its drop down the thread.
    float n = floor( uBeat ), mine = mod( n - spin.z, 4.0 ) < 0.5 ? 1.0 : 0.0;
    float a = 3.14159265 * mine * uTurn * smoothstep( 0.0, 0.64, uBeat - n );
    vec2 d = transformed.xz - spin.xy;
    transformed.xz = spin.xy + vec2( d.x * cos( a ) - d.y * sin( a ), d.x * sin( a ) + d.y * cos( a ) );
    float td = uDropT - spin.z * 0.06;
    float k = uDropDir > 0.0 ? ( td < 0.0 ? 0.0 : td < 0.2 ? td / 0.2 * 1.08 : td < 0.32 ? 1.08 - 0.08 * ( td - 0.2 ) / 0.12 : 1.0 ) : 1.0 - clamp( uDropT / 0.6, 0.0, 1.0 );
    transformed.y += ( 1.0 - k ) * 9.0;
  }
  vWorldX = w0.x;
}`;
const FRAG_PARS = /* glsl */ `
uniform float uGateX, uWaveT, uReveal;
varying float vWorldX;
`;
const FRAG = /* glsl */ `
  if ( uReveal != 0.0 ) {
    float inside = abs( vWorldX - uGateX ) < uWaveT * 16.0 ? 1.0 : -1.0;
    if ( inside * uReveal < 0.0 ) discard;
  }
#include <clipping_planes_fragment>`;

function patch(src: { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> }, u: AnimUniforms) {
  Object.assign(src.uniforms, u);
  src.vertexShader = src.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', VERT);
  src.fragmentShader = src.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_PARS}`).replace('#include <clipping_planes_fragment>', FRAG);
}

/** The game's voxel material (lit, soft studio shading, haze), with the dream's motion. */
export function animLit(u: AnimUniforms, opts: { fog?: boolean } = {}): MeshLambertMaterial {
  const m = voxelMaterial() as MeshLambertMaterial;
  m.fog = opts.fog ?? true;
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => { base.call(m, shader, renderer); patch(shader, u); };
  m.customProgramCacheKey = () => 'dream-anim-lit';
  return m;
}

/**
 * What gives light: drawn in its own colour, never lit, tinted or hazed (v3/02, section 5). Bulbs (`bulb` >= 0) chase:
 * bulb i is at full glow when (i + whole beats) mod 4 is 0, at 45% otherwise, the chase running the other way on even
 * laps (`uChase` -1). `uGain` dims the whole mesh (an obstacle's lanterns before its word is taken).
 */
export function animGlow(u: AnimUniforms, extra: { uChase: { value: number }; uGain: { value: number } }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...u, ...extra },
    vertexColors: true,
    vertexShader: /* glsl */ `
      #include <common>
      attribute float bulb;
      uniform float uChase, uGain;
      varying vec3 vCol;
      ${VERT_PARS}
      void main() {
        vec3 transformed = position;
        ${VERT.replace('#include <begin_vertex>', '')}
        float b = floor( uBeat );
        float lit = bulb < -0.5 ? 1.0 : ( mod( bulb * uChase + b, 4.0 ) < 0.5 ? 1.0 : 0.45 );
        vCol = color * lit * uGain;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_PARS}
      varying vec3 vCol;
      void main() {
        ${FRAG.replace('#include <clipping_planes_fragment>', '')}
        gl_FragColor = vec4( vCol, 1.0 );
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Soft round glows (v3/02, section 5: an added sprite as wide as the light's radius, as strong as its strength), merged
 * into one mesh of flat quads facing the camera (it never turns). Added light, no haze; bulbs chase like their boxes.
 */
export function glowSprites(u: AnimUniforms, extra: { uChase: { value: number }; uGain: { value: number } }): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...u, ...extra },
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float bulb;
      attribute vec2 corner;
      attribute vec3 color;
      uniform float uChase, uGain;
      varying vec3 vCol;
      varying vec2 vUv;
      ${VERT_PARS}
      void main() {
        vec3 transformed = position;
        ${VERT.replace('#include <begin_vertex>', '')}
        float b = floor( uBeat );
        float lit = bulb < -0.5 ? 1.0 : ( mod( bulb * uChase + b, 4.0 ) < 0.5 ? 1.0 : 0.45 );
        vCol = color * lit * uGain;
        vUv = corner;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( transformed, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      ${FRAG_PARS}
      varying vec3 vCol;
      varying vec2 vUv;
      void main() {
        ${FRAG.replace('#include <clipping_planes_fragment>', '')}
        float r = length( vUv );
        float a = pow( max( 0.0, 1.0 - r ), 2.0 );
        // Light is added in linear terms, as the pack's renderer adds it: no sRGB curve on the glow itself, or a faint
        // glow over the dark night comes out several times brighter.
        gl_FragColor = vec4( vCol * a, 1.0 );
      }`,
  });
}

/** Fills a geometry's `anim`, `spin` and `bulb` attributes with "at rest" where they are missing. */
export function restAttributes(g: BufferGeometry): BufferGeometry {
  const n = g.getAttribute('position').count;
  if (!g.getAttribute('anim')) g.setAttribute('anim', new Float32BufferAttribute(new Float32Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? -1000 : i % 4 === 3 || i % 4 === 2 ? -1 : 0)), 4));
  if (!g.getAttribute('spin')) g.setAttribute('spin', new Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 2 ? -1 : 0)), 3));
  if (!g.getAttribute('bulb')) g.setAttribute('bulb', new Float32BufferAttribute(new Float32Array(n).fill(-1), 1));
  return g;
}

export const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b]; };
export type AnyMaterial = Material;
