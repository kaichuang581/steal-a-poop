import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping, Group, Object3D, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import type { PerspectiveCamera } from 'three';
import { FIELD, jumpHeight } from '../../dream/dream';
import { BARN } from '../scene/layout';
import { Building, useWorld } from '../table/BarnTable';
import type { World } from '../table/BarnTable';
import { Effects, LANTERN_LIGHT } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { voxelMaterial } from '../voxel/material';
import { DreamSky, DriftingLanterns, SleepZs } from './DreamSky';
import { dreamShot, farmApron, fenceCentreX, FARM_BASE, FILLER_BASES, fillerChunk, fillerClouds, jumpFence, LANE_Z, PX, ringX, scrollOf, SHEEP_SCALE } from './stage';

const SLOTS = 4;

/** What the stage reads every frame; the screen owns the state and only this view of it is shared. */
export interface StageLive {
  dist: number;
  t: number;
  jumpAt: number | null;
  crashAt: number | null;
  fences: { index: number; x: number; locked: boolean; passed: boolean }[];
}

/** One fence's sign, as React sees it (changes seldom); positions come from the live ref. */
export interface FenceView { index: number; label: string; locked: boolean; hot: boolean; wrong: boolean }

interface Props {
  live: MutableRefObject<StageLive>;
  fences: FenceView[];
  /** The latest sheep counted, to pop over the sheep. */
  pop: { n: number; key: number } | null;
  /** Standing, galloping, mid-leap, or bumped. */
  sheepState: SheepState;
  reduced: boolean;
  phone: boolean;
}

/**
 * The dream, full screen: the winter farm adrift in a violet dream sky (src/skin/dream/DreamSky.tsx), and the player's
 * sheep galloping on the spot along a lane in front of the barn's open side while the whole farm rolls past, loops
 * round, and comes by again. The whole floating world breathes a little under the camera.
 */
export function DreamStage(props: Props) {
  const w = useWorld();
  const shot = dreamShot(props.phone);
  if (!w) return <Building />;
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }} dpr={props.phone ? [1, 1.5] : [1, 2]}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
      camera={{ fov: shot.fov, position: [...shot.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(...shot.target)}
    >
      <Scene {...props} world={w} />
    </Canvas>
  );
}

function Scene({ live, fences, pop, sheepState, reduced, phone, world: w }: Props & { world: World }) {
  const voxMat = useMemo(() => voxelMaterial(), []);
  const glowMat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 2.2 }), []);
  const apron = useMemo(() => farmApron(), []);
  const fillers = useMemo(() => FILLER_BASES.map((_, i) => ({ land: fillerChunk(i + 1), clouds: fillerClouds(i + 1) })), []);
  const fenceGeo = useMemo(() => jumpFence(), []);
  const farm = useRef<Group>(null);
  const fill = useRef<(Group | null)[]>([]);
  const sheep = useRef<Group>(null);
  const world = useRef<Group>(null);
  // Four fence slots, never unmounted while the dream runs (a drei Html root must not unmount mid-render): fence
  // `index` lives in slot index % 4, which is unique since at most four fences are ever in play.
  const slots = useRef<(Group | null)[]>([]);

  useFrame(({ clock }) => {
    const L = live.current;
    const scroll = scrollOf(L.dist);
    // The world floats: it rises and settles and rolls a hair, the sheep and fences with it.
    if (world.current) {
      const t = reduced ? 0 : clock.elapsedTime;
      world.current.position.y = Math.sin(t * 0.45) * 0.1;
      world.current.rotation.z = Math.sin(t * 0.3 + 1) * 0.006;
    }
    if (farm.current) farm.current.position.x = ringX(FARM_BASE, scroll);
    fill.current.forEach((g, i) => { if (g) g.position.x = ringX(FILLER_BASES[i], scroll); });
    // The sheep: in the air on a jump, knocked back a little on a bump.
    if (sheep.current) {
      const air = L.jumpAt === null ? 0 : jumpHeight(L.t - L.jumpAt) * PX;
      const back = L.crashAt !== null ? Math.min(0.3, (L.t - L.crashAt) / 600) : 0;
      sheep.current.position.set(back, air, LANE_Z);
      sheep.current.rotation.z = L.crashAt !== null ? Math.min(0.25, (L.t - L.crashAt) / 1200) : 0;
    }
    const used = new Set<number>();
    for (const f of L.fences) {
      const g = slots.current[f.index % SLOTS];
      if (!g) continue;
      used.add(f.index % SLOTS);
      g.visible = true;
      g.position.x = fenceCentreX(f.x);
      // The fence the sheep ran into tips over.
      const hit = L.crashAt !== null && !f.passed && !f.locked && f.x < FIELD.sheepX + FIELD.sheepW;
      g.rotation.z = hit ? Math.min(1.1, (L.t - L.crashAt!) / 350) : 0;
    }
    slots.current.forEach((g, i) => { if (g && !used.has(i)) g.visible = false; });
  });

  return (
    <>
      <DreamCamera phone={phone} reduced={reduced} live={live} />
      <DreamSky reduced={reduced} />
      <hemisphereLight args={['#CBB6F2', '#4E3A78', 0.6]} />
      {/* A rose fill from the moon's side, and the cool key light that casts the shadows. */}
      <directionalLight position={[-60, 40, 200]} color="#F2B6D8" intensity={0.35} />
      <directionalLight
        position={[-30, 26, -40]} color="#E6DBFF" intensity={0.8} castShadow
        shadow-mapSize={phone ? [2048, 2048] : [4096, 4096]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={160}
      />
      {/* A warm dream-glow travels with the sheep, so the hero never reads as a silhouette against the snow. */}
      <pointLight position={[-0.6, 2.4, LANE_Z - 2.2]} color="#FFD9A0" intensity={16} distance={9} decay={2} />

      <group ref={world}>
      {/* The farm, whole, on the ring: the barn with its lanterns lit, the yard, the farmhouse with the farmer's Zs
          coming out of its chimney, and paper lanterns drifting up out of the yard. */}
      <group ref={farm}>
        {w.barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
        {w.barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}
        <mesh geometry={w.barn.lanterns} material={glowMat} />
        <mesh geometry={w.barn.tarp} material={voxMat} />
        <mesh geometry={w.barn.front} material={voxMat} receiveShadow />
        {BARN.lanterns.map((p, i) => (
          <pointLight key={i} position={[p[0], p[1] - 0.3, p[2]]} color={LANTERN_LIGHT.color} intensity={LANTERN_LIGHT.intensity} distance={LANTERN_LIGHT.distance} decay={LANTERN_LIGHT.decay} />
        ))}
        {w.yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
        <SleepZs from={w.yard.smokeFrom} reduced={reduced} />
        <DriftingLanterns reduced={reduced} />
        <mesh geometry={apron} material={voxMat} receiveShadow />
      </group>
      {fillers.map((g, i) => (
        <group key={i} ref={(el) => { fill.current[i] = el; }}>
          <mesh geometry={g.land} material={voxMat} castShadow receiveShadow />
          <mesh geometry={g.clouds} material={voxMat} />
        </group>
      ))}

      {/* The fences, each with its sign: the letters to use, or the word that cleared it. */}
      {Array.from({ length: SLOTS }, (_, slot) => {
        const f = fences.find((v) => v.index % SLOTS === slot);
        return (
          <group key={slot} ref={(el) => { slots.current[slot] = el; }} position={[200, 0, LANE_Z]} visible={false}>
            <mesh geometry={fenceGeo} material={voxMat} castShadow receiveShadow />
            <Html position={[0, FIELD.fenceH * PX + 0.55, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              {f && <span className="dr-sign sk-display" data-locked={f.locked || undefined} data-hot={f.hot || undefined} data-wrong={f.wrong || undefined}>{f.label}</span>}
            </Html>
          </group>
        );
      })}

      {/* The sheep faces -x (screen right) and runs on the spot; the world does the moving. */}
      <group ref={sheep} position={[0, 0, LANE_Z]}>
        <group rotation={[0, -Math.PI / 2, 0]} scale={SHEEP_SCALE}>
          <Sheep level={2} state={sheepState} reduced={reduced} gustFrom={[0, 0.8, -4]} />
        </group>
        <Html position={[-0.2, 1.7, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          {pop && <span key={pop.key} className="dr-pop sk-display">{pop.n}</span>}
        </Html>
      </group>
      </group>
      <Effects />
    </>
  );
}

/** The camera holds its side view, breathing a little, and jolts when the sheep hits a fence. */
function DreamCamera({ phone, reduced, live }: { phone: boolean; reduced: boolean; live: MutableRefObject<StageLive> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const shot = useMemo(() => dreamShot(phone, size.width / Math.max(1, size.height)), [phone, size.width, size.height]);
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
  }, [camera, shot]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const L = live.current;
    const drift = reduced ? 0 : 0.06;
    const since = L.crashAt !== null ? (L.t - L.crashAt) / 1000 : 9;
    const jolt = !reduced && since < 0.45 ? Math.sin(since * 60) * 0.08 * (1 - since / 0.45) : 0;
    camera.position.set(shot.position[0] + Math.cos(t / 7) * drift + jolt, shot.position[1] + Math.sin(t / 9) * drift * 0.5, shot.position[2]);
    target.position.set(shot.target[0], shot.target[1] + jolt * 0.5, shot.target[2]);
    camera.lookAt(target.position);
  });
  return null;
}
