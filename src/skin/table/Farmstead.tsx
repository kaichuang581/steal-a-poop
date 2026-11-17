import { useFrame, useThree } from '@react-three/fiber';
import { useLoadingHold } from '../components/BarnDoors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sphere, Vector3 } from 'three';
import type { BufferGeometry, DirectionalLight, Frustum, Mesh, PerspectiveCamera } from 'three';
import type { Animal } from '../avatars/catalog';
import { buildCountryside } from '../scene/countryside';
import type { Countryside } from '../scene/countryside';
import { buildFarmFestive } from '../scene/festive';
import { buildFarmstead } from '../scene/farmstead';
import type { Farmstead as Built } from '../scene/farmstead';
import { POV_SHOTS } from '../scene/homePov';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { PADDOCK_SHOT, shadowSeen, shotAt, viewsOf } from '../voxel/unseen';
import { Festive } from './Festive';
import { Sheep } from './Sheep';
import type { SheepState } from './Sheep';
import type { World } from './BarnTable';

let built: Built | null = null;
let land: Countryside | null = null;
/** Whether the farm and the land round it are already built this session (coming back to Home: no wait, no fade). */
export const farmReady = () => !!built && !!land;

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
  const [farm, setFarm] = useState(built);
  const [country, setCountry] = useState(land);
  const mat = useMemo(() => voxelMaterial(), []);
  useEffect(() => {
    if (built) return;
    const id = setTimeout(() => { built ??= buildFarmstead(); setFarm(built); }, 0);
    return () => clearTimeout(id);
  }, []);
  // After the farm, in its own step, so the page never stalls for both at once.
  useEffect(() => {
    if (land || !farm) return;
    const id = setTimeout(() => { land ??= buildCountryside(); setCountry(land); }, 0);
    return () => clearTimeout(id);
  }, [farm]);
  useEffect(() => () => mat.dispose(), [mat]);
  // The first time Home opens, the loading screen stays up until the farm and the land round it are built, so nothing
  // pops in after the doors open. Both are kept for the session, so coming back to Home never waits.
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
              {[...country.woods, ...country.scrub].map((g, i) => <mesh key={`c${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
              {country.forest.map((g, i) => <mesh key={`w${i}`} geometry={g} material={mat} receiveShadow />)}
              {country.drifts.map((g, i) => <mesh key={`d${i}`} geometry={g} material={mat} receiveShadow />)}
              <mesh geometry={country.tracks} material={mat} receiveShadow />
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
function ShotCasters({ world, farm, country, phone }: { world: World; farm: Built | null; country: Countryside | null; phone: boolean }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const st = useRef({ meshes: [] as { mesh: Mesh; ball: Sphere }[], sun: null as Vector3 | null, shown: -2, aspect: 0 });
  useEffect(() => {
    const scenery = new Set<BufferGeometry>([
      ...world.barn.static, ...world.barn.doorLeaves.map((d) => d.geo), ...world.yard.chunks, world.yard.snowman,
      ...(farm ? [farm.shell, ...farm.props, ...farm.fine] : []), ...(country ? [...country.woods, ...country.scrub] : []),
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
