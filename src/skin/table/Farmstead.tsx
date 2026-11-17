import { useFrame, useThree } from '@react-three/fiber';
import { useLoadingHold } from '../components/BarnDoors';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Sphere, Vector3 } from 'three';
import type { BufferGeometry, DirectionalLight, Frustum, Mesh, PerspectiveCamera } from 'three';
import type { Animal } from '../avatars/catalog';
import { buildCountrysideSteps } from '../scene/countryside';
import type { Countryside, CountryPart } from '../scene/countryside';
import { buildFarmFestive } from '../scene/festive';
import { buildFarmsteadSteps } from '../scene/farmstead';
import type { Farmstead as Built } from '../scene/farmstead';
import { pinnedPov, POV_SHOTS } from '../scene/homePov';
import { queueBuild, rush } from '../scene/slices';
import type { Steps } from '../scene/slices';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { PADDOCK_SHOT, shadowSeen, shotAt, viewsOf } from '../voxel/unseen';
import { Festive } from './Festive';
import { Sheep } from './Sheep';
import type { SheepState } from './Sheep';
import type { World } from './BarnTable';
import { holdDpr } from './Rendering';

let built: Built | null = null;
let land: Countryside | null = null;
/** What the opening shot needs of the land, built before the rest (see `startBuild`). */
let landPart: CountryPart | null = null;
let landSteps: Steps<Countryside, CountryPart> | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const f of listeners) f(); };
/** Whether the farm and the land round it are already built this session (coming back to Home: no wait, no fade). */
export const farmReady = () => !!built && !!land;

/**
 * The farm, then the land round it, in slices (scene/slices.ts; plan file 17, change 14), once a page. Given `wanted`,
 * the land the opening shot needs (or its shadow) is built first and handed over as a part; the rest follows while that
 * shot is on screen. The builds are the page's: once started they run to the end, whatever screen is up.
 */
function startBuild(wanted?: (min: [number, number, number], max: [number, number, number]) => boolean) {
  if (landSteps || land) return;
  if (!built) queueBuild(buildFarmsteadSteps(), (b) => { built = b; changed(); }, { around: holdDpr });
  landSteps = buildCountrysideSteps(wanted);
  queueBuild(landSteps, (c) => { land = c; changed(); }, { part: (p) => { landPart = p; changed(); }, around: holdDpr });
}

/** The sun's heading, read off the scene's shadow-casting light; null until it is there. */
function sunOf(scene: { traverse: (f: (o: unknown) => void) => void }): Vector3 | null {
  let sun: Vector3 | null = null;
  scene.traverse((o) => {
    const light = o as DirectionalLight;
    if (light.isDirectionalLight && light.castShadow) sun = light.target.getWorldPosition(new Vector3()).sub(light.getWorldPosition(new Vector3())).normalize();
  });
  return sun;
}

/** Who lives on the farm: [animal, x, z, facing, state]. Phones keep the first few. */
export const LIVESTOCK: [Animal, number, number, number, SheepState][] = [
  ['cow', 15.2, 2.2, 2.4, 'grazing'],
  ['horse', 19.4, -1.2, -1.9, 'idle'],
  ['chicken', -12.6, 5.2, 0.5, 'grazing'],
  ['sheep', 14.2, -6.4, 0.9, 'grazing'],
  ['cow', 18.8, 3.6, -2.6, 'idle'],
  ['goat', 13.8, -1.8, 1.5, 'idle'],
  ['chicken', -10.6, 6.2, -0.9, 'idle'],
  ['chicken', -14.8, 6.4, 2.2, 'grazing'],
  ['pig', -15.6, -2.4, 1.1, 'grazing'],
  ['sheep', 17.8, -7.4, -0.8, 'idle'],
  // A few of the flock let out on the open ground.
  ['sheep', -24, 19, 0.6, 'grazing'],
  ['sheep', -27.5, 21.5, 2.4, 'idle'],
  ['sheep', -21.5, 23, -1.2, 'grazing'],
];

/**
 * Everything the start screen's farm has that the game's table does not: see scene/farmstead.ts. Built after the
 * first paint, like the world, and only ever mounted on the start screen.
 */
export function Farmstead({ world, reduced, phone, onReady }: { world: World; reduced: boolean; phone: boolean; onReady?: (ready: boolean) => void }) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const mat = useMemo(() => voxelMaterial(), []);
  const shots = phone ? POV_SHOTS.phone : POV_SHOTS.desktop;
  // The shot the camera opens on (the tour's first, or the one `?pov=` holds): the only one seen before the first dip.
  const open = useMemo(() => pinnedPov(location.search, shots.length) ?? 0, [shots]);
  useEffect(() => {
    listeners.add(bump);
    if (!land) {
      // What the opening shot sees over its whole travel, or sees the shadow of, at a window a little wider than this one.
      const sun = sunOf(scene);
      let wanted: Parameters<typeof startBuild>[0];
      if (sun) {
        const { views, pad } = viewsOf(shots[open], camera.aspect * 1.3);
        const ball = new Sphere();
        wanted = (min, max) => {
          ball.center.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
          ball.radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
          return shadowSeen(ball, sun, views, pad);
        };
      }
      startBuild(wanted);
    }
    bump();
    return () => { listeners.delete(bump); };
  }, [scene, camera, shots, open]);
  // The rest of the land goes up at the first dip: the cut to another shot is made in the dark. If it is not built by
  // then (a slow device), it is finished there and then, so no shot (the paddock's above all, with the wendigo's stand
  // and the trees round its view) is ever seen with a piece missing.
  const [whole, setWhole] = useState(() => !!land); // coming back to Home: all of it at once
  const seenOpen = useRef(false);
  useFrame(() => {
    if (whole || !landPart) return;
    const now = shotAt(shots, camera.position.x, camera.position.y, camera.position.z);
    if (now === open) { seenOpen.current = true; return; }
    if (!seenOpen.current || now < 0) return;
    if (!land && landSteps) rush(landSteps);
    setWhole(true);
  });
  useEffect(() => () => mat.dispose(), [mat]);
  const farm = built;
  const country: CountryPart | null = whole ? land ?? landPart : landPart ?? land;
  // The first time Home opens, the loading screen stays up until the farm and the land its first shot needs are built,
  // so nothing pops in after the doors open. Both are kept for the session, so coming back to Home never waits.
  // Joins the first load's doors (never brings them down itself: a refresh has none, and the farm fades in instead).
  useLoadingHold('farm', !farm || !country, 'Building the farm', true, false);
  useEffect(() => { onReady?.(!!farm && !!country); }, [farm, country, onReady]);
  return (
    <>
      <ShotCasters world={world} farm={farm} country={country} phone={phone} />
      {/* The range the yard looks at, turned round to stand behind the barn as well. */}
      <mesh geometry={world.distance.mountains} material={mat} rotation={[0, Math.PI, 0]} />
      {farm && (
        <>
          <mesh geometry={farm.shell} material={mat} castShadow receiveShadow />
          {farm.props.map((g, i) => <mesh key={`p${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
          {farm.fine.map((g, i) => <mesh key={`f${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
          <mesh geometry={farm.terrain} material={mat} receiveShadow />
          <Festive geo={buildFarmFestive()} reduced={reduced} />
          {country && (
            <>
              {/* A piece still to come is a hole in its list: the others keep their keys when it arrives. */}
              {[...country.woods, ...country.scrub].map((g, i) => g && <mesh key={`c${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
              {country.forest.map((g, i) => g && <mesh key={`w${i}`} geometry={g} material={mat} receiveShadow />)}
              {country.drifts.map((g, i) => g && <mesh key={`d${i}`} geometry={g} material={mat} receiveShadow />)}
              {country.tracks && <mesh geometry={country.tracks} material={mat} receiveShadow />}
            </>
          )}
        </>
      )}
      {(phone ? LIVESTOCK.slice(0, 3) : LIVESTOCK).map(([animal, x, z, facing, state], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, facing, 0]} scale={1.5}>
          <Sheep level={2} state={state} reduced={reduced} model={animal === 'sheep' ? undefined : animalModel(animal)} />
        </group>
      ))}
    </>
  );
}

/**
 * Each scene of the tour asks only the scenery whose shadow it can see to cast one (plan file 17, change 13, step 3).
 * The sun's shadow map is drawn again every frame from everything that casts, and on a close scene most of that falls
 * where the camera never looks. So when the camera arrives on a scene (the cut is made in the dark), every piece of
 * the still scenery whose shadow cannot reach anything that scene sees, over its whole travel, stops casting until the
 * next cut. What is seen is the same; the shadow map holds less. The scene is read from where the camera stands, so
 * this cannot fall out of step with the tour. Animals, the season's decorations and the wendigo are never touched,
 * and on the paddock scene, and wherever the camera is on no scene at all, everything casts as it always did.
 */
function ShotCasters({ world, farm, country, phone }: { world: World; farm: Built | null; country: CountryPart | null; phone: boolean }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const st = useRef({ meshes: [] as { mesh: Mesh; ball: Sphere }[], sun: null as Vector3 | null, shown: -2, aspect: 0 });
  useEffect(() => {
    const scenery = new Set<BufferGeometry>([
      ...world.barn.static, ...world.barn.doorLeaves.map((d) => d.geo), ...world.yard.chunks, world.yard.snowman,
      ...(farm ? [farm.shell, ...farm.props, ...farm.fine] : []), ...(country ? [...country.woods, ...country.scrub].filter((g): g is BufferGeometry => !!g) : []),
    ]);
    const meshes: { mesh: Mesh; ball: Sphere }[] = [];
    let sun: Vector3 | null = null;
    scene.updateMatrixWorld();
    scene.traverse((o) => {
      const light = o as DirectionalLight;
      if (light.isDirectionalLight && light.castShadow) sun = light.target.getWorldPosition(new Vector3()).sub(light.getWorldPosition(new Vector3())).normalize();
      const mesh = o as Mesh;
      // Marked the first time it is met, while it still casts: later it may be one this has switched off.
      if (!mesh.isMesh || !scenery.has(mesh.geometry) || !(mesh.castShadow || mesh.userData.shotCaster)) return;
      mesh.userData.shotCaster = true;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      meshes.push({ mesh, ball: new Sphere().copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld) });
    });
    st.current = { meshes, sun, shown: -2, aspect: 0 };
    return () => { for (const { mesh } of meshes) mesh.castShadow = true; };
  }, [scene, world, farm, country]);
  useFrame(() => {
    const s = st.current, shots = phone ? POV_SHOTS.phone : POV_SHOTS.desktop;
    const now = shotAt(shots, camera.position.x, camera.position.y, camera.position.z);
    if (now === s.shown && camera.aspect === s.aspect) return;
    s.shown = now;
    s.aspect = camera.aspect;
    let views: Frustum[] | null = null, pad = 0;
    if (now >= 0 && now !== PADDOCK_SHOT && s.sun) ({ views, pad } = viewsOf(shots[now], camera.aspect));
    for (const { mesh, ball } of s.meshes) mesh.castShadow = !views || shadowSeen(ball, s.sun!, views, pad);
  });
  return null;
}
