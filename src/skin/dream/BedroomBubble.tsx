import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping, Color, MeshBasicMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Mesh, PerspectiveCamera } from 'three';
import { buildBubbleFestive } from '../scene/festive';
import { Festive } from '../table/Festive';
import { voxelMaterial } from '../voxel/material';
import { BEAM, BED, bedroomGeometry, bedroomRoom, farmerGeometry, farmerSitting, foldedQuilt, LAMP, quiltSat, roomOn, ROOM_WINDOW, SITTING, WINDOW } from './bedroom';
import type { Phase, StageLive } from './DreamStage';
import { WAKE } from './stage';

/** The foot of the bed, a little to the side: the farmer's face left of centre, the headboard and window behind him. */
const CAMERA = { position: [2.35, 1.3, 0.95] as const, target: [0.62, 0.86, -0.22] as const, fov: 27 };
/**
 * The results shot (V6 Part 6.4.3): the bed seen side on from the room, the headboard at the left, the window at the
 * top right, the beam along the top edge. A phone looks along the bed from its foot, the bed in the lower half.
 */
const RESULTS = {
  desktop: { position: [1.19, 1.8, 3.5] as const, target: [1.19, 1.36, 0] as const, fov: 34 },
  phone: { position: [2.75, 1.7, 2.15] as const, target: [0.7, 1.25, -0.3] as const, fov: 64 },
};
const EASE_MS = 900;
const WALL = '#1E1A33';
const PANE = '#4A4080';

/** The HTML that hangs in the room: the results board from the beam's hook, the paper slip from the headboard. */
export interface RoomAnchors { board: MutableRefObject<HTMLElement | null>; slip: MutableRefObject<HTMLElement | null> }

/**
 * The farmer's bubble (V4.1 Part 7): a small canvas of its own, masked to a cloud, so he is always framed whatever the
 * dream camera does. It reads the run's clock and never writes it. The z's float over it as HTML. When the dream is over
 * the bubble opens to the whole screen and becomes his bedroom (V6 Part 6.4): the walls, the window and the beam come
 * in, the camera comes down to the bed, and the results hang from the beam.
 */
export function BedroomBubble({ live, phase, reduced, phone, blankets = 0, anchors }: {
  live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean; phone: boolean; blankets?: number; anchors?: RoomAnchors;
}) {
  const woke = phase === 'crashed' || (phase === 'results' && live.current.asleepAt === null);
  const room = roomOn(phase);
  return (
    <div className="dr-bubble" data-woke={woke || undefined} data-room={room || undefined}>
      <div className="dr-bubble-rim" />
      <div className="dr-bubble-view">
        <Canvas
          dpr={phone ? [1, 1.5] : [1, 2]} flat={false}
          gl={{ antialias: true, alpha: false, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
          camera={{ fov: CAMERA.fov, position: [...CAMERA.position], near: 0.1, far: 20 }}
          onCreated={({ camera }) => camera.lookAt(...CAMERA.target)}
        >
          <Room live={live} phase={phase} reduced={reduced} phone={phone} blankets={blankets} anchors={anchors} />
        </Canvas>
      </div>
      {[0, 1, 2].map((i) => <span key={i} className="dream-z" data-i={i} aria-hidden="true">z</span>)}
      <span className="dr-bubble-bang" aria-hidden="true">!</span>
    </div>
  );
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function Room({ live, phase, reduced, phone, blankets, anchors }: { live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean; phone: boolean; blankets: number; anchors?: RoomAnchors }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const b = useMemo(() => bedroomGeometry(), []);
  const f = useMemo(() => farmerGeometry(), []);
  const vox = useMemo(() => voxelMaterial(), []);
  const lampMat = useMemo(() => voxelMaterial({ emissive: '#FFD9A0', emissiveIntensity: 1.3 }), []);
  const wallMat = useMemo(() => new MeshBasicMaterial({ color: WALL, toneMapped: false }), []);
  const paneMat = useMemo(() => new MeshBasicMaterial({ color: PANE, toneMapped: false }), []);
  const moonMat = useMemo(() => new MeshBasicMaterial({ color: '#FFF1B8', toneMapped: false }), []);
  const skyMat = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const room = roomOn(phase);
  const r = useMemo(() => (room ? { ...bedroomRoom(), sitting: farmerSitting(), quilt: quiltSat(), folds: [foldedQuilt(0), foldedQuilt(1)] } : null), [room]);
  const sitting = room && live.current.asleepAt === null;
  const bump = useRef<Group>(null);
  const clock = useRef<Group>(null);
  const asleep = useRef<Mesh>(null);
  const awake = useRef<Mesh>(null);
  const shot = phone ? RESULTS.phone : RESULTS.desktop;
  const cam = useMemo(() => ({ at: -1, from: new Vector3(), look: new Vector3(), p: new Vector3() }), []);
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
    // The clock rings on the wake-up, and once more as the camera arrives at the bed.
    const ring = (since >= WAKE.stir && since < WAKE.stir + 600) || (room && cam.at >= 0 && t - cam.at > EASE_MS / 1000 && t - cam.at < EASE_MS / 1000 + 0.6);
    if (clock.current) clock.current.rotation.z = !reduced && ring ? Math.sin(t * 30 * Math.PI * 2) * ((2 * Math.PI) / 180) : 0;

    // The camera: the bubble's shot until the dream is over, then down to the bed over 900 ms (a cut under reduced motion).
    if (!room) { cam.at = -1; return; }
    if (cam.at < 0) { cam.at = t; cam.from.copy(camera.position); }
    const k = reduced ? 1 : ease(((t - cam.at) * 1000) / EASE_MS);
    camera.position.lerpVectors(cam.from, cam.p.set(shot.position[0], shot.position[1], shot.position[2]), k);
    cam.look.set(CAMERA.target[0] + (shot.target[0] - CAMERA.target[0]) * k, CAMERA.target[1] + (shot.target[1] - CAMERA.target[1]) * k, CAMERA.target[2] + (shot.target[2] - CAMERA.target[2]) * k);
    if (camera.fov !== shot.fov) { camera.fov = CAMERA.fov + (shot.fov - CAMERA.fov) * k; camera.updateProjectionMatrix(); }
    camera.lookAt(cam.look);
    // The board hangs from the beam's hook and the slip is pinned to the headboard: project both every frame.
    const put = (el: HTMLElement | null | undefined, x: number, y: number, z: number) => {
      if (!el) return;
      const v = cam.p.set(x, y, z).project(camera);
      el.style.left = `${((v.x + 1) / 2) * size.width}px`;
      el.style.top = `${((1 - v.y) / 2) * size.height}px`;
    };
    // A phone's frame is too narrow to show the beam and the bed together: there the board hangs from the top edge.
    if (!phone) put(anchors?.board.current, BEAM.hookX + 0.05, BEAM.y, BEAM.z + 0.2);
    if (!phone) put(anchors?.slip.current, -0.05, 1.12, BED.mattress.w / 2);
  });
  return (
    <>
      <hemisphereLight args={['#A09AC8', '#4A3A40', 1.3]} />
      {/* The moon through the window falls cool on the pillow and the right of his face; the lamp warms the left. */}
      <pointLight position={[WINDOW.x + 0.5, WINDOW.y - 0.1, WINDOW.z + 0.5]} color="#CFD8FF" intensity={1.3} distance={5} decay={2} />
      <pointLight position={[LAMP.x + 0.55, LAMP.y + 0.2, LAMP.z - 0.35]} color="#FFC98A" intensity={2.6} distance={2.5} decay={2} />
      {r ? (
        <>
          {/* The room (Part 6.4.1 and 6.4.2): the candle stays the warm light, the window brings the cool one. */}
          <mesh geometry={r.room} material={vox} />
          <mesh geometry={r.fine} material={vox} />
          <mesh geometry={r.moon} material={skyMat} />
          <pointLight position={[(ROOM_WINDOW.x0 + ROOM_WINDOW.x1) / 2, ROOM_WINDOW.y0 + 0.3, -0.7]} color="#CFD8FF" intensity={1.0} distance={4} decay={2} />
          <pointLight position={[LAMP.x, LAMP.y + 0.15, LAMP.z]} color="#FFC24B" intensity={0.9} distance={3.5} decay={2} />
          {[0, 1].slice(0, blankets).map((i) => (
            <mesh key={i} geometry={r.folds[i]} material={vox} position={[1.72 + i * 0.03, BED.mattress.top + 0.1 + i * 0.12, -0.08 + i * 0.05]} rotation={[0, i ? 0.12 : -0.05, 0]} />
          ))}
        </>
      ) : (
        <>
          <mesh material={wallMat} position={[-0.17, 2, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[12, 8]} /></mesh>
          <mesh material={wallMat} position={[2, 2, -1.8]}><planeGeometry args={[12, 8]} /></mesh>
          <mesh material={paneMat} position={[WINDOW.x, WINDOW.y, WINDOW.z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[WINDOW.w, WINDOW.h]} /></mesh>
          <mesh material={moonMat} position={[WINDOW.x + 0.005, WINDOW.y - 0.24, WINDOW.z + 0.2]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.125, 20]} /></mesh>
          <mesh geometry={b.windowFrame} material={vox} />
          <mesh geometry={b.floor} material={vox} />
        </>
      )}
      <Festive geo={buildBubbleFestive()} reduced={reduced} />
      <mesh geometry={b.rug} material={vox} />
      <mesh geometry={b.slippers} material={vox} />
      <mesh geometry={b.bed} material={vox} />
      <mesh geometry={b.pillow} material={vox} />
      <mesh geometry={b.quiltFlat} material={vox} />
      {sitting && r ? <mesh geometry={r.quilt} material={vox} /> : (
        <group ref={bump} position={[0, BED.mattress.top, 0]}><mesh geometry={b.quiltBump} material={vox} position={[0, -BED.mattress.top, 0]} /></group>
      )}
      <mesh geometry={b.table} material={vox} />
      <mesh geometry={b.lamp} material={vox} />
      <mesh geometry={b.lampGlow} material={lampMat} />
      <group ref={clock} position={[0.2, 0.6, BED.mattress.w / 2 + 0.42]}><mesh geometry={b.clock} material={vox} /></group>
      {sitting && r ? (
        // Awake and sitting up against the headboard, turned toward the room, his nightcap knocked askew.
        <group position={[SITTING.x, SITTING.y, SITTING.z]} rotation={[0, SITTING.turn, 0]}>
          <mesh geometry={f.awake} material={vox} />
          <mesh geometry={f.cap} material={vox} rotation={[0, 0, -0.15]} position={[0.01, 0.01, 0]} />
          <mesh geometry={r.sitting} material={vox} />
        </group>
      ) : (
        // The farmer: built standing, laid down on the pillow, propped toward the foot of the bed so his face reads.
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
      )}
    </>
  );
}
