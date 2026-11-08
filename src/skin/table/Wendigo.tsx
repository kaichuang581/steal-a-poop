import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, Box3, CanvasTexture, Color, DoubleSide, Raycaster, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Object3D, Sprite } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { landHeight } from '../scene/farmstead';
import { POV_SHOTS } from '../scene/homePov';

/**
 * Lore (Brian, 2026-11-08): a wendigo standing in among the pines on the slope behind the paddock, watching the farm.
 * Brian's own model (public/models/wendigo.glb: his Wendigo2.glb with the ribs taken off, doubled parts dropped and every
 * piece simplified, about 56k triangles, merged into one mesh per colour). It is the one thing in the game that is not
 * voxels, on purpose. Its hide is given a mottled, leathery texture in the shader (no UVs needed), and its eyes glow.
 * It barely moves: a slow breath, and now and then it leans, very slowly. It stands between the trunks so that only the
 * paddock camera (POV_SHOTS.desktop[2]) catches it, top right, and even then it is easy to miss.
 */
export const WENDIGO_AT: [number, number] = [-9.6, -30.9];
const HEIGHT = 3.4;
/** The red eyes in the source model's own frame (they were taken out of the mesh and are drawn glowing instead). */
const EYES_SRC: [number, number, number][] = [[0.011, 0.179, 0.352], [-0.019, 0.177, 0.352]];

/** A hide shader: mottled dark and pale patches, darker veins and a bumpy, leathery surface, all from world position. */
function hide(color: string, scale = 18, bump = 0.18, veins = 0.6) {
  // Both sides: some of the source parts were mirrored, so their faces wind the other way.
  const m = new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side: DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uScale = { value: scale }; sh.uniforms.uBump = { value: bump }; sh.uniforms.uVeins = { value: veins };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWp; uniform float uScale; uniform float uBump; uniform float uVeins;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p) { return vn(p) * 0.5 + vn(p * 2.1) * 0.27 + vn(p * 4.3) * 0.15 + vn(p * 9.1) * 0.08; }
float skinH(vec3 p) { float n = fbm(p * uScale); float vein = 1.0 - smoothstep(0.0, 0.06, abs(vn(p * uScale * 0.6) - 0.5)); return n * 0.8 + vein * 0.35; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float n = fbm(vWp * uScale); float blotch = fbm(vWp * uScale * 0.25);
  diffuseColor.rgb *= mix(0.55, 1.25, n) * mix(0.75, 1.15, blotch);
  float vein = 1.0 - smoothstep(0.0, 0.05, abs(vn(vWp * uScale * 0.6) - 0.5));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.42, 0.42), vein * uVeins); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ float hh = skinH(vWp); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hh), dhy = dFdy(hh);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - grad * uBump); }`);
  };
  return m;
}

/** A soft round glow for the eyes, drawn additive so it blooms against the dark trees. */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,230,200,1)'); r.addColorStop(0.18, 'rgba(255,90,40,0.9)'); r.addColorStop(0.5, 'rgba(200,20,10,0.3)'); r.addColorStop(1, 'rgba(120,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

/** Only the paddock camera sees it: it is there while the camera is near that shot (desktop or phone), gone otherwise.
 *  The Home tour cross-fades between shots, so it never pops in view. */
const WATCHERS = [POV_SHOTS.desktop[2].position, POV_SHOTS.phone[2].position].map((p) => new Vector3(...p));
const isInside = (o: Object3D, root: Object3D) => { for (let p: Object3D | null = o; p; p = p.parent) if (p === root) return true; return false; };

let cached: Promise<Object3D> | null = null;
const loadModel = () => (cached ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/wendigo.glb`).then((g) => g.scene));

/** `?wendigoDebug` paints it magenta, to check from which cameras it can be seen. */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('wendigoDebug');

export function Wendigo({ reduced, debug = DEBUG }: { reduced: boolean; debug?: boolean }) {
  const [model, setModel] = useState<{ root: Object3D; scale: number; offset: Vector3 } | null>(null);
  const mats = useMemo(() => ({
    skin: debug ? new MeshBasicMaterial({ color: '#ff00ff', fog: false, side: DoubleSide }) : hide('#5A4A40', 7, 0.22, 0.55),
    bone: hide('#C2B296', 5, 0.08, 0.12), teeth: new MeshStandardMaterial({ color: '#E9D9B8', roughness: 0.6, side: DoubleSide }),
    mouth: new MeshStandardMaterial({ color: '#3A0A14', roughness: 0.5, side: DoubleSide }), claw: hide('#A8987E', 9, 0.06, 0.1),
  }), [debug]);
  useEffect(() => {
    let live = true;
    // Loaded after the farm, off the critical path; if it fails the farm simply has no wendigo.
    loadModel().then((src) => {
      if (!live) return;
      const root = src.clone(true);
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const name = (m.material as MeshStandardMaterial).name;
        m.material = name.startsWith('skin') ? mats.skin : name.startsWith('mouth') ? mats.mouth : name === 'teeth' ? mats.teeth : name === 'claw' ? mats.claw : mats.bone;
      });
      const box = new Box3().setFromObject(root), size = box.getSize(new Vector3());
      setModel({ root, scale: HEIGHT / size.y, offset: new Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2) });
    }).catch(() => {});
    return () => { live = false; };
  }, [mats]);
  const glow = useMemo(() => new SpriteMaterial({ map: glowTexture(), color: new Color('#FF5A2A'), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }), []);
  const core = useMemo(() => new MeshBasicMaterial({ color: '#FFD9A0', fog: false }), []);
  const coreGeo = useMemo(() => new SphereGeometry(0.0045, 8, 6), []);
  const root = useRef<Group>(null), sway = useRef<Group>(null);
  const sprites = useRef<(Sprite | null)[]>([]);
  // Its feet go on the voxel ground itself: found by a ray straight down once the farm has built (the terrain's
  // columns stand a little above the smooth landHeight it is built from), with landHeight until then.
  const ground = useRef(landHeight(WENDIGO_AT[0], WENDIGO_AT[1]));
  const settled = useRef(false);
  const down = useMemo(() => new Raycaster(new Vector3(WENDIGO_AT[0], 80, WENDIGO_AT[1]), new Vector3(0, -1, 0)), []);
  // It faces the paddock camera, which is to say: you.
  const yaw = useMemo(() => Math.atan2(21 - WENDIGO_AT[0], 6 - WENDIGO_AT[1]), []);
  useFrame(({ clock, scene: sc, camera: cam }) => {
    const t = clock.elapsedTime;
    if (!settled.current && root.current) {
      down.camera = cam;
      const hit = down.intersectObjects(sc.children, true).find((i) => i.object.visible && !isInside(i.object, root.current!) && (i.object as Mesh).isMesh);
      if (hit) { ground.current = hit.point.y; settled.current = true; root.current.position.y = hit.point.y - 0.05; }
    }
    if (root.current) root.current.visible = WATCHERS.some((w) => w.distanceTo(cam.position) < 7);
    if (root.current) root.current.scale.y = 1 + (reduced ? 0 : Math.sin(t * 0.6) * 0.006); // a slow breath
    // Every 11 s it leans, slowly, toward the farm, and settles back.
    if (sway.current) sway.current.rotation.x = reduced ? 0 : Math.max(0, Math.sin((t / 11) * Math.PI * 2)) ** 3 * 0.06;
    // The eyes pulse a little and now and then flare.
    const k = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.7) + 0.6 * Math.max(0, Math.sin(t * 0.5)) ** 20;
    sprites.current.forEach((s) => { if (s) s.material.opacity = Math.min(1, k); });
  });
  if (!model) return null;
  return (
    <group ref={root} position={[WENDIGO_AT[0], ground.current - 0.05, WENDIGO_AT[1]]} rotation={[0, yaw, 0]}>
      <group ref={sway}>
        <group scale={model.scale}>
          <group position={model.offset}>
            <primitive object={model.root} />
            {EYES_SRC.map((p, i) => (
              <group key={i} position={p}>
                <mesh geometry={coreGeo} material={core} />
                <sprite ref={(el) => { sprites.current[i] = el; }} material={glow} scale={[0.038, 0.038, 1]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
