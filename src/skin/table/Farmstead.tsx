import { FESTIVE } from '../../config';
import { useFrame, useThree } from '@react-three/fiber';
import { useLoadingHold } from '../components/BarnDoors';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Sphere, Vector3 } from 'three';
import type { BufferGeometry, DirectionalLight, Frustum, Mesh, PerspectiveCamera } from 'three';
import { buildCountrysideSteps, lowDrops } from '../scene/countryside';
import type { Countryside, CountryPart } from '../scene/countryside';
import { buildFarmFestive } from '../scene/festive';
import { MICRO_RANGE } from '../scene/farmMicro';
import type { FarmMicro } from '../scene/farmMicro';
import { buildFarmsteadSteps } from '../scene/farmstead';
import type { Farmstead as Built } from '../scene/farmstead';
import { pinnedPov, POV_SHOTS } from '../scene/homePov';
import { FLOCK_DOG, HEN_Y, LIVESTOCK } from '../scene/livestock';
import { Sheepdog } from './places';
import { dropBuild, queueBuild, rush } from '../scene/slices';
import type { Steps } from '../scene/slices';
import { animalModel } from '../voxel/animals';
import { bakeShade } from '../voxel/groundShade';
import { voxelMaterial } from '../voxel/material';
import { PADDOCK_SHOT, shadowSeen, shotAt, viewsOf } from '../voxel/unseen';
import { Festive } from './Festive';
import { Sheep } from './Sheep';
import { fineWorldReady, promoteWorld, retire, startFineWorld } from './BarnTable';
import type { World } from './BarnTable';
import { getTier, rememberedTier, subscribeTier, useTier } from '../perf/tier';
import { coarseDevice, coarseFor, inDetail } from '../voxel/refine';
import { holdDpr } from './Rendering';

let built: Built | null = null;
/** Whether `built` is the touch detail (voxel/refine.ts). */
let builtCoarse = false;
/** The farm at the desktop's detail, built in the background for High (plan file 17, change 15); see `swapFine`. */
let fineFarm: Built | null = null;
let fineSteps: Steps<Built> | null = null;
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
  if (!built) {
    const coarse = coarseFor(getTier());
    queueBuild(inDetail(coarse, buildFarmsteadSteps()), (b) => { built = b; builtCoarse = coarse; changed(); }, { around: holdDpr });
  }
  landSteps = buildCountrysideSteps(wanted);
  queueBuild(landSteps, (c) => {
    land = c;
    changed();
    // The opening shot is whole: a device that earned High last time (or is on it now) builds the desktop's detail
    // behind it, so it is ready for the dip where High is earned.
    if (getTier() === 'high' || rememberedTier() === 'high') startFine();
  }, { part: (p) => { landPart = p; changed(); }, around: holdDpr });
}

/** The desktop's detail of the farm and of the world, in the background slices, where this device has one and it is not on screen. */
function startFine() {
  startFineWorld();
  if (!built || !builtCoarse || fineFarm || fineSteps || coarseDevice() || getTier() === 'low') return;
  fineSteps = inDetail(false, buildFarmsteadSteps());
  queueBuild(fineSteps, (b) => { fineSteps = null; fineFarm = b; }, { around: holdDpr });
}

/**
 * Puts the desktop's detail on screen, the farm and the world together, once the tier is High and both are built.
 * Called only in a dip (a cut of the tour, made in the dark), when the tier changes (which is only ever in a dip or at
 * a scene change) and when Home mounts (a scene change), so no shot is seen changing or part-built.
 */
function swapFine(): boolean {
  if (getTier() !== 'high' || !fineFarm || !fineWorldReady()) return false;
  promoteWorld();
  const old = built;
  built = fineFarm;
  builtCoarse = false;
  fineFarm = null;
  changed();
  if (old) retire(old, built);
  return true;
}

subscribeTier(() => {
  const t = getTier();
  if (t === 'high') { startFine(); swapFine(); }
  if (t === 'low') {
    if (fineSteps) dropBuild(fineSteps);
    fineSteps = null;
    if (fineFarm) retire(fineFarm, built);
    fineFarm = null;
  }
});

/** The sun's heading, read off the scene's shadow-casting light; null until it is there. */
function sunOf(scene: { traverse: (f: (o: unknown) => void) => void }): Vector3 | null {
  let sun: Vector3 | null = null;
  scene.traverse((o) => {
    const light = o as DirectionalLight;
    if (light.isDirectionalLight && light.castShadow) sun = light.target.getWorldPosition(new Vector3()).sub(light.getWorldPosition(new Vector3())).normalize();
  });
  return sun;
}

export { HEN_Y, LIVESTOCK } from '../scene/livestock';

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
    swapFine(); // coming back to Home is a scene change
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
  const lastShot = useRef(-2);
  useFrame(() => {
    const now = shotAt(shots, camera.position.x, camera.position.y, camera.position.z);
    // A cut to another shot is made in the dark: the one place the desktop's detail may come in on Home.
    if (now !== lastShot.current) { if (lastShot.current !== -2 && now >= 0 && fineFarm) swapFine(); lastShot.current = now; }
    if (whole || !landPart) return;
    if (now === open) { seenOpen.current = true; return; }
    if (!seenOpen.current || now < 0) return;
    if (!land && landSteps) rush(landSteps);
    setWhole(true);
  });
  useEffect(() => () => mat.dispose(), [mat]);
  const farm = built;
  const landNow: CountryPart | null = whole ? land ?? landPart : landPart ?? land;
  // Low leaves out the scrub and drifts far from the wendigo that its shot cannot see (countryside.ts, `lowDrops`).
  const tier = useTier();
  const size = useThree((s) => s.size);
  const dropped = useMemo(() => {
    const sun = tier === 'low' && landNow ? sunOf(scene) : null;
    if (!sun || !landNow) return null;
    const paddock = phone ? POV_SHOTS.phone[PADDOCK_SHOT] : POV_SHOTS.desktop[PADDOCK_SHOT];
    // A window a little wider than this one, as for the opening shot: a resize never brings a dropped piece into view.
    const { views, pad } = viewsOf(paddock, (size.width / Math.max(1, size.height)) * 1.3);
    const ball = new Sphere();
    return lowDrops(landNow, (c, r) => shadowSeen(ball.set(new Vector3(...c), r), sun, views, pad));
  }, [tier, landNow, scene, phone, size.width, size.height]);
  // A piece left out is a hole in its list, as a piece still to come is: the others keep their keys.
  const country: CountryPart | null = useMemo(() => {
    if (!landNow || !dropped?.size) return landNow;
    const keep = (g: BufferGeometry | undefined) => (g && dropped.has(g) ? undefined : g);
    return { ...landNow, scrub: landNow.scrub.map(keep), drifts: landNow.drifts.map(keep) };
  }, [landNow, dropped]);
  // The first time Home opens, the loading screen stays up until the farm and the land its first shot needs are built,
  // so nothing pops in after the doors open. Both are kept for the session, so coming back to Home never waits.
  // Joins the first load's doors (never brings them down itself: a refresh has none, and the farm fades in instead).
  useLoadingHold('farm', !farm || !country, 'Building the farm', true, false);
  useEffect(() => { onReady?.(!!farm && !!country); }, [farm, country, onReady]);
  // The ground's shade map, from what the yard, the farm, the micro layer and the land have told it stands where
  // (voxel/groundShade.ts). Baked again only when one of them has built something new.
  useEffect(() => { if (farm && country) bakeShade(tier === 'low'); }, [farm, country, tier]);
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
          {tier !== 'low' && <Micro micro={farm.micro} phone={phone} />}
          {FESTIVE && <Festive geo={buildFarmFestive()} reduced={reduced} />}
          {country && (
            <>
              {/* A piece still to come is a hole in its list: the others keep their keys when it arrives. */}
              {[...country.woods, ...country.scrub].map((g, i) => g && <mesh key={`c${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
              {country.forest.map((g, i) => g && <mesh key={`w${i}`} geometry={g} material={mat} receiveShadow />)}
              {country.drifts.map((g, i) => g && <mesh key={`d${i}`} geometry={g} material={mat} receiveShadow />)}
            </>
          )}
        </>
      )}
      {(phone ? LIVESTOCK.slice(0, 3) : LIVESTOCK).map(([animal, x, z, facing, state], i) => (
        <group key={i} position={[x, animal === 'chicken' ? HEN_Y : 0, z]} rotation={[0, facing, 0]} scale={1.5 * animalModel(animal).drawScale}> {/* one uniform scale: each species at its lineup size */}
          <Sheep level={2} state={state} reduced={reduced} model={animal === 'sheep' ? undefined : animalModel(animal)} />
        </group>
      ))}
      {!phone && <Sheepdog reduced={reduced} at={[FLOCK_DOG[0], 0, FLOCK_DOG[1]]} yaw={FLOCK_DOG[2]} scale={1.5} />}
    </>
  );
}

/**
 * The micro layer (scene/farmMicro.ts; docs/miniature/04, section 4): one mesh a cluster. A cluster is drawn on a shot
 * only if it is within 40 m of the camera at the start or the end of that shot's push (further off a 0.05 m block is
 * under two pixels and would only shimmer), casts a shadow only within 25 m, and is never drawn on the paddock shot.
 * Decided when the camera arrives on a shot, which is in the dark. Low does not draw the layer at all.
 */
function Micro({ micro, phone }: { micro: FarmMicro; phone: boolean }) {
  const camera = useThree((s) => s.camera);
  const mat = useMemo(() => voxelMaterial(), []);
  // The lanterns' glass, as the farmhouse's panes are drawn (BarnTable.tsx): lit from inside, no light cast.
  const glassMat = useMemo(() => voxelMaterial({ emissive: '#FFB84A', emissiveIntensity: 0.85, homeGlow: true }), []);
  useEffect(() => () => { mat.dispose(); glassMat.dispose(); }, [mat, glassMat]);
  const meshes = useRef<(Mesh | null)[]>([]), glass = useRef<Mesh>(null), shown = useRef(-2);
  useEffect(() => { shown.current = -2; }, [micro]);
  useFrame(() => {
    const shots = phone ? POV_SHOTS.phone : POV_SHOTS.desktop, at = camera.position;
    const now = shotAt(shots, at.x, at.y, at.z);
    if (now === shown.current) return;
    shown.current = now;
    micro.clusters.forEach((c, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      // Off every shot (a camera stood by hand with ?cam=), the camera's own place decides.
      const ends = now < 0 ? [[at.x, at.y, at.z]] : [shots[now].position, shots[now].position.map((v, k) => v + shots[now].push[k])];
      const d = Math.min(...ends.map((e) => Math.hypot(e[0] - c.centre[0], e[1] - c.centre[1], e[2] - c.centre[2])));
      mesh.visible = now !== PADDOCK_SHOT && d <= MICRO_RANGE.draw;
      mesh.castShadow = mesh.visible && d <= MICRO_RANGE.cast;
    });
    if (glass.current) glass.current.visible = now !== PADDOCK_SHOT && meshes.current.some((m) => m?.visible);
  });
  return (
    <>
      {micro.clusters.map((c, i) => <mesh key={c.name} ref={(m) => { meshes.current[i] = m; }} geometry={c.geo} material={mat} castShadow receiveShadow />)}
      {micro.glass && <mesh ref={glass} geometry={micro.glass} material={glassMat} />}
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
  const st = useRef({ meshes: [] as { mesh: Mesh; ball: Sphere }[], light: null as DirectionalLight | null, shown: -2, aspect: 0 });
  useEffect(() => {
    const scenery = new Set<BufferGeometry>([
      ...world.barn.static, ...world.barn.doorLeaves.map((d) => d.geo), ...world.yard.chunks, world.yard.snowman,
      ...(farm ? [farm.shell, ...farm.props, ...farm.fine] : []), ...(country ? [...country.woods, ...country.scrub].filter((g): g is BufferGeometry => !!g) : []),
    ]);
    const meshes: { mesh: Mesh; ball: Sphere }[] = [];
    let sun: DirectionalLight | null = null;
    scene.updateMatrixWorld();
    scene.traverse((o) => {
      const light = o as DirectionalLight;
      if (light.isDirectionalLight && light.castShadow) sun = light;
      const mesh = o as Mesh;
      // Marked the first time it is met, while it still casts: later it may be one this has switched off.
      if (!mesh.isMesh || !scenery.has(mesh.geometry) || !(mesh.castShadow || mesh.userData.shotCaster)) return;
      mesh.userData.shotCaster = true;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      meshes.push({ mesh, ball: new Sphere().copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld) });
    });
    st.current = { meshes, light: sun, shown: -2, aspect: 0 };
    return () => { for (const { mesh } of meshes) mesh.castShadow = true; };
  }, [scene, world, farm, country]);
  useFrame(() => {
    const s = st.current, shots = phone ? POV_SHOTS.phone : POV_SHOTS.desktop;
    const now = shotAt(shots, camera.position.x, camera.position.y, camera.position.z);
    if (now === s.shown && camera.aspect === s.aspect) return;
    s.shown = now;
    s.aspect = camera.aspect;
    let views: Frustum[] | null = null, pad = 0;
    // The sun's own direction as it stands on this shot (each shot's look sets it in the dip: `shotLight` in Rendering.tsx).
    const sun = s.light ? s.light.target.position.clone().sub(s.light.position).normalize() : null;
    if (now >= 0 && now !== PADDOCK_SHOT && sun) ({ views, pad } = viewsOf(shots[now], camera.aspect));
    for (const { mesh, ball } of s.meshes) mesh.castShadow = !views || shadowSeen(ball, sun!, views, pad);
  });
  return null;
}
