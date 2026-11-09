import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, FogExp2, HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import type { PointLight } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Hour } from '../model/types';
import { BARN } from '../scene/layout';

/** The look, applied once and globally (plan V3.1 Part 1.3). */
export const FOG: Record<Hour, string> = { dawn: '#F3C9B5', day: '#BFE1F3', dusk: '#D08AA2', night: '#273B66' };
const SUN: Record<Hour, { color: string; intensity: number }> = {
  dawn: { color: '#FFD3A8', intensity: 1.4 },
  day: { color: '#FFF1D6', intensity: 1.6 },
  dusk: { color: '#FFD3A8', intensity: 1.6 },
  night: { color: '#AFC3DE', intensity: 0.65 }, // moonlight; the lanterns carry the barn
};
// Physical falloff (decay 2) needs candela-scale intensity; 40 here lands where the plan's nominal 2.0 reads on screen.
export const LANTERN_LIGHT = { color: '#FFB45A', intensity: 32, distance: 12, decay: 2 };

/** Exponential fog in the hour's colour; the sky dome, stars and aurora ignore it (their materials have fog off). */
export function Atmosphere({ hour }: { hour: Hour }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new FogExp2(FOG[hour], 0.012);
    scene.background = new Color(FOG[hour]);
  }, [scene, hour]);
  return null;
}

/**
 * One warm sun 20 degrees up and 35 degrees to the side of the camera (`viewYaw` is the camera's horizontal heading,
 * so shadows fall across the view), a cool sky fill, and the two lantern point lights.
 */
export function Lights({ hour, phone, viewYaw, lampRef }: { hour: Hour; phone: boolean; viewYaw: number; lampRef?: (i: number, l: PointLight | null) => void }) {
  const sun = SUN[hour];
  const az = viewYaw + Math.PI + (35 * Math.PI) / 180;
  const el = (20 * Math.PI) / 180;
  const pos: [number, number, number] = [Math.sin(az) * Math.cos(el) * 60, Math.sin(el) * 60, Math.cos(az) * Math.cos(el) * 60];
  return (
    <>
      <hemisphereLight args={['#9FB7D6', '#5B6B7A', hour === 'night' ? 0.45 : 0.55]} />
      <directionalLight
        position={pos} color={sun.color} intensity={sun.intensity} castShadow
        shadow-mapSize={phone ? [2048, 2048] : [4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={1} shadow-camera-far={160}
      />
      {BARN.lanterns.map((p, i) => (
        <pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]} color={LANTERN_LIGHT.color} intensity={LANTERN_LIGHT.intensity} distance={LANTERN_LIGHT.distance} decay={LANTERN_LIGHT.decay} />
      ))}
    </>
  );
}

/** A light tilt-shift: a vertical blur that only touches the top and bottom fifth of the frame. */
const TiltShiftShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.15 }, texelY: { value: 1 / 1080 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform float texelY; varying vec2 vUv;
    void main() {
      float band = smoothstep(0.2, 0.0, vUv.y) + smoothstep(0.8, 1.0, vUv.y);
      float r = band * strength * 40.0;
      vec4 sum = vec4(0.0); float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float w = 1.0 - abs(float(i)) / 7.0;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, float(i) * r / 6.0 * texelY)) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

/**
 * The composer: the scene into a multisampled half-float target, bloom for the lanterns and windows only
 * (threshold 0.85), the optional tilt-shift, then tone mapping and sRGB in the output pass.
 */
export function Effects({ tiltShift = 0 }: { tiltShift?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(size.width, size.height, { type: HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    // Bloom at half resolution: it only has to catch the lanterns, and the full-size blur chain costs most of a frame.
    c.addPass(new UnrealBloomPass(new Vector2(Math.ceil(size.width / 2), Math.ceil(size.height / 2)), 0.35, 0.4, 0.85));
    if (tiltShift > 0) {
      const pass = new ShaderPass(TiltShiftShader);
      pass.uniforms.strength.value = tiltShift;
      pass.uniforms.texelY.value = 1 / size.height;
      c.addPass(pass);
    }
    c.addPass(new OutputPass());
    return c;
    // The size is applied by the effect below; recreating on every resize would drop frames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, tiltShift]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    for (const p of composer.passes) if (p instanceof ShaderPass && p.uniforms.texelY) p.uniforms.texelY.value = 1 / size.height;
  }, [composer, gl, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  // The composer is several draws; counting across all of them keeps the dev overlay's triangle count honest.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);
  useFrame(() => {
    gl.info.reset();
    composer.render();
  }, 1);
  return null;
}

/** The camera's horizontal heading (0 = looking toward +z) from a position and a target. */
export function yawToward(from: readonly number[], to: readonly number[]): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

/** Marks the canvas once the scene has drawn a few frames, so the barn doors (BarnDoors) open onto a finished picture. */
export function MarkDrawn() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 3) gl.domElement.setAttribute('data-drawn', '');
  });
  useEffect(() => () => gl.domElement.removeAttribute('data-drawn'), [gl]);
  return null;
}
