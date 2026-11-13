import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Box3, SRGBColorSpace, Vector3 } from 'three';
import type { Group, PerspectiveCamera, PointLight } from 'three';
import { Blast } from '../table/Blast';
import { BombAura, useBombGlow } from '../table/BombAura';
import { BOMB_RADIUS } from '../voxel/bomb';
import { bombLook } from '../voxel/bombSkins';
import { voxelMaterial } from '../voxel/material';
import { auraOf } from './bombAura';
import { BLAST_PALETTE, BOMB_TINT, BURST_SHAPE } from './catalog';
import type { BurstShape, Item } from './catalog';
import { BombModel3d, GridModel3d } from './models3d';

/**
 * The Barn Book's live view of one item. A bomb skin or a fuse sound's object turns slowly on the spot, lit like the
 * thumbnails; a burst is the game's own Blast playing again and again, the item's own act in its colours, with the shell
 * of the bomb skin being worn (`wornBomb`) falling open. Loaded only when a preview opens. Its canvas must not sit under a
 * transformed element (the dream's canvas measured wrong that way).
 */
export default function PreviewStage({ item, playKey, wornBomb, still }: { item: Item; playKey: number; wornBomb: string; still: boolean }) {
  const burst = item.kind === 'blast';
  return (
    <Canvas
      dpr={[1, 2]} gl={{ antialias: true, alpha: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
      camera={burst ? { position: [0, 5, 24], fov: 38, near: 0.1, far: 200 } : { position: [0, 0.35, 3.1], fov: 26, near: 0.1, far: 50 }}
    >
      <hemisphereLight args={['#FFF1DC', '#6A5648', burst ? 1.1 : 1.25]} />
      <directionalLight position={[-3, 5, 4]} color="#FFE2B8" intensity={burst ? 1.9 : 2.4} />
      <directionalLight position={[4, 1.5, -2]} color="#BCD8FF" intensity={0.7} />
      {burst ? <BurstScene item={item} playKey={playKey} wornBomb={wornBomb} /> : <Turntable item={item} still={still} />}
    </Canvas>
  );
}

/**
 * The thing, sized to fill the view and standing on a soft shadow, turning once every ten seconds. A bomb skin does
 * here what it does at the table: its glow throbs, and its embers, glints or rings come off it (BombAura).
 */
function Turntable({ item, still }: { item: Item; still: boolean }) {
  const spin = useRef<Group>(null);
  const fit = useRef<Group>(null);
  const bomb = item.kind === 'bomb';
  const glow = useBombGlow(bomb ? item.id : 'bomb-ice');
  const lamp = useRef<PointLight>(null);
  // How much the model was scaled to fill the view: what it leaves on the floor is drawn to the same scale under it.
  const [fitted, setFitted] = useState(1);
  const ground = useMemo(() => (bomb ? bombLook(item.id).ground : null), [bomb, item.id]);
  const groundMat = useMemo(() => voxelMaterial({ emissive: auraOf(bomb ? item.id : 'bomb-ice').ring.emissive, emissiveIntensity: 0.25 }), [bomb, item.id]);
  const sees = useMemo(() => {
    const at = new Vector3();
    return { at: () => (fit.current ? fit.current.getWorldPosition(at) : null), radius: () => BOMB_RADIUS * (fit.current?.scale.x ?? 1), active: () => true };
  }, []);
  useEffect(() => {
    const g = fit.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g), c = box.getCenter(new Vector3()), s = box.getSize(new Vector3());
    const k = 1 / Math.max(s.x, s.y, s.z);
    g.scale.setScalar(k);
    g.position.set(-c.x * k, -box.min.y * k - 0.5, -c.z * k);
    setFitted(k);
  }, [item.id]);
  useFrame((_, dt) => { if (spin.current && !still) spin.current.rotation.y += dt * 0.63; });
  return (
    <>
      <group ref={spin} rotation={[0, -0.5, 0]}>
        <group ref={fit}>
          {item.kind === 'bomb' ? <BombModel3d id={item.id} fuse={0.7} glow={glow} /> : <GridModel3d id={item.id} kind="tick" />}
        </group>
      </group>
      {bomb && (
        <>
          {/* A bomb is seen in the dark, as at the table at night: what comes off it is drawn by adding light, which
              shows on something dark and solid and not on the cream mat (see BurstScene). Its own light, in its middle as at
              the table, falls on the floor round it. */}
          <color attach="background" args={['#1E130C']} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshLambertMaterial color="#4a3526" />
          </mesh>
          <pointLight ref={lamp} color={auraOf(item.id).light} intensity={1.4} distance={3} decay={2} position={[0, -0.2, 0]} />
          {ground && <mesh geometry={ground} material={groundMat} position={[0, -0.5, 0]} scale={fitted} />}
          <BombAura id={item.id} at={sees.at} radius={sees.radius} active={sees.active} floor={-0.5} glow={glow} light={lamp} reduced={still} />
        </>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]}>
        <circleGeometry args={[0.46, 40]} />
        <meshBasicMaterial color="#1a0f08" transparent opacity={0.32} />
      </mesh>
    </>
  );
}

/** Where the bomb was: on the floor, its middle a little above it. */
const ORIGIN = new Vector3(0, 0.45, 0);
/** How far back the camera stands for each burst, and the height it looks at: the frost ball is big, a campfire is not. */
const VIEW: Record<BurstShape, [number, number]> = {
  ball: [24, 4.2], haystack: [9, 1.9], snowcloud: [8.5, 2.1], balloons: [9.5, 2.5], campfire: [8.5, 1.6],
  heather: [8, 1.3], aurora: [19, 3.6], sun: [10.5, 2.4], lanterns: [9, 2.3], stars: [10.5, 2.5],
};
/** The real burst, on a dark floor, seen from across the barn. */
function BurstScene({ item, playKey, wornBomb }: { item: Item; playKey: number; wornBomb: string }) {
  const { camera } = useThree();
  const shape = BURST_SHAPE[item.id] ?? 'ball';
  useEffect(() => {
    const [back, look] = VIEW[shape];
    camera.position.set(0, look + back * 0.035, back);
    (camera as PerspectiveCamera).lookAt(0, look, 0);
  }, [camera, shape]);
  // The first one goes off once this scene is up: the canvas loads late, and a key that was already set when the
  // Blast mounted would not count as a change.
  const [first, setFirst] = useState(0);
  useEffect(() => { const t = setTimeout(() => setFirst(1), 250); return () => clearTimeout(t); }, []);
  const origin = useMemo(() => () => ORIGIN, []);
  const chunk = useMemo(() => bombLook(wornBomb).chunk, [wornBomb]);
  return (
    <>
      {/* The burst is drawn by adding light, as at the table, so it needs something dark and solid behind it: on a
          clear canvas each faded bit turned its pixel solid black. */}
      <color attach="background" args={['#1E130C']} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#4a3526" />
      </mesh>
      <Blast
        boomKey={first + playKey} origin={origin} reduced={false} power={1}
        palette={item.id === 'blast-frost' ? undefined : BLAST_PALETTE[item.id]} shape={shape}
        chunk={chunk} chunkGlow={(BOMB_TINT[wornBomb] ?? BOMB_TINT['bomb-ice']).emissive}
      />
    </>
  );
}
