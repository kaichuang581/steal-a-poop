import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping, Color, MeshBasicMaterial, SRGBColorSpace } from 'three';
import type { Group, Mesh } from 'three';
import { buildBubbleFestive } from '../scene/festive';
import { Festive } from '../table/Festive';
import { voxelMaterial } from '../voxel/material';
import { BED, bedroomGeometry, farmerGeometry, LAMP, WINDOW } from './bedroom';
import type { Phase, StageLive } from './DreamStage';
import { WAKE } from './stage';

/** The foot of the bed, a little to the side: the farmer's face left of centre, the headboard and window behind him. */
const CAMERA = { position: [2.35, 1.3, 0.95] as const, target: [0.62, 0.86, -0.22] as const, fov: 27 };
const WALL = '#1E1A33';
const PANE = '#4A4080';

/**
 * The farmer's bubble (V4.1 Part 7): a small canvas of its own, masked to a cloud, so he is always framed whatever the
 * dream camera does. It reads the run's clock and never writes it. The z's float over it as HTML.
 */
export function BedroomBubble({ live, phase, reduced, phone }: { live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean; phone: boolean }) {
  const woke = phase === 'crashed' || (phase === 'results' && live.current.asleepAt === null);
  return (
    <div className="dr-bubble" data-woke={woke || undefined}>
      <div className="dr-bubble-rim" />
      <div className="dr-bubble-view">
        <Canvas
          dpr={phone ? [1, 1.5] : [1, 2]} flat={false}
          gl={{ antialias: true, alpha: false, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
          camera={{ fov: CAMERA.fov, position: [...CAMERA.position], near: 0.1, far: 20 }}
          onCreated={({ camera }) => camera.lookAt(...CAMERA.target)}
        >
          <Room live={live} phase={phase} reduced={reduced} />
        </Canvas>
      </div>
      {[0, 1, 2].map((i) => <span key={i} className="dream-z" data-i={i} aria-hidden="true">z</span>)}
      <span className="dr-bubble-bang" aria-hidden="true">!</span>
    </div>
  );
}

function Room({ live, phase, reduced }: { live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean }) {
  const scene = useThree((s) => s.scene);
  const b = useMemo(() => bedroomGeometry(), []);
  const f = useMemo(() => farmerGeometry(), []);
  const vox = useMemo(() => voxelMaterial(), []);
  const lampMat = useMemo(() => voxelMaterial({ emissive: '#FFD9A0', emissiveIntensity: 1.3 }), []);
  const wallMat = useMemo(() => new MeshBasicMaterial({ color: WALL, toneMapped: false }), []);
  const paneMat = useMemo(() => new MeshBasicMaterial({ color: PANE, toneMapped: false }), []);
  const moonMat = useMemo(() => new MeshBasicMaterial({ color: '#FFF1B8', toneMapped: false }), []);
  const bump = useRef<Group>(null);
  const clock = useRef<Group>(null);
  const asleep = useRef<Mesh>(null);
  const awake = useRef<Mesh>(null);
  useEffect(() => { scene.background = new Color(WALL); }, [scene]);
  useFrame(({ clock: ck }) => {
    const t = ck.elapsedTime, L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    // A bump short of the last only stirs him: awake for 600 ms, then asleep again.
    const stirred = L.t < L.stumbleUntil - 100;
    const woke = since >= WAKE.stir || stirred || (phase === 'results' && L.asleepAt === null);
    if (asleep.current) asleep.current.visible = !woke;
    if (awake.current) awake.current.visible = woke;
    if (bump.current) bump.current.scale.y = reduced || woke ? 1 : 1 + 0.035 * (0.5 + 0.5 * Math.sin((t / 3.6) * Math.PI * 2));
    if (clock.current) clock.current.rotation.z = !reduced && since >= WAKE.stir && since < WAKE.stir + 600 ? Math.sin(t * 30 * Math.PI * 2) * ((2 * Math.PI) / 180) : 0;
  });
  return (
    <>
      <hemisphereLight args={['#A09AC8', '#4A3A40', 1.3]} />
      {/* The moon through the window falls cool on the pillow and the right of his face; the lamp warms the left. */}
      <pointLight position={[WINDOW.x + 0.5, WINDOW.y - 0.1, WINDOW.z + 0.5]} color="#CFD8FF" intensity={1.3} distance={5} decay={2} />
      <pointLight position={[LAMP.x + 0.55, LAMP.y + 0.2, LAMP.z - 0.35]} color="#FFC98A" intensity={2.6} distance={2.5} decay={2} />
      <mesh material={wallMat} position={[-0.17, 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[12, 8]} /></mesh>
      <mesh material={wallMat} position={[2, 2, -1.8]}><planeGeometry args={[12, 8]} /></mesh>
      <mesh material={paneMat} position={[WINDOW.x, WINDOW.y, WINDOW.z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[WINDOW.w, WINDOW.h]} /></mesh>
      <mesh material={moonMat} position={[WINDOW.x + 0.005, WINDOW.y - 0.24, WINDOW.z + 0.2]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.125, 20]} /></mesh>
      <mesh geometry={b.windowFrame} material={vox} />
      <mesh geometry={b.floor} material={vox} />
      <Festive geo={buildBubbleFestive()} reduced={reduced} />
      <mesh geometry={b.rug} material={vox} />
      <mesh geometry={b.slippers} material={vox} />
      <mesh geometry={b.bed} material={vox} />
      <mesh geometry={b.pillow} material={vox} />
      <mesh geometry={b.quiltFlat} material={vox} />
      <group ref={bump} position={[0, BED.mattress.top, 0]}><mesh geometry={b.quiltBump} material={vox} position={[0, -BED.mattress.top, 0]} /></group>
      <mesh geometry={b.table} material={vox} />
      <mesh geometry={b.lamp} material={vox} />
      <mesh geometry={b.lampGlow} material={lampMat} />
      <group ref={clock} position={[0.2, 0.6, BED.mattress.w / 2 + 0.42]}><mesh geometry={b.clock} material={vox} /></group>
      {/* The farmer: built standing, laid down on the pillow, propped toward the foot of the bed so his face reads. */}
      <group position={[0.34, BED.pillowTop + 0.06, -0.02]} rotation={[0.18, 0, -0.95]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh ref={asleep} geometry={f.asleep} material={vox} />
            <mesh ref={awake} geometry={f.awake} material={vox} visible={false} />
            <mesh geometry={f.cap} material={vox} />
            <mesh geometry={f.body} material={vox} />
          </group>
        </group>
      </group>
    </>
  );
}
