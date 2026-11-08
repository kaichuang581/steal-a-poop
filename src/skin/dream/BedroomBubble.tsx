import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping, Color, MeshBasicMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Mesh, MeshLambertMaterial, PerspectiveCamera, PointLight } from 'three';
import { voxelMaterial } from '../voxel/material';
import { BEAM, BED, bedroomGeometry, CANDLE, CLOCK, farmerGeometry, farmerSitting, foldedQuilt, LAMP, quiltSat, roomOn, SITTING } from './bedroom';
import type { Phase, StageLive } from './DreamStage';
import { WAKE } from './stage';

/** From the foot of the bed on the lamp side: his face left of centre, the window and the nightstand to his right. */
const CAMERA = { position: [2.3, 1.4, 1.05] as const, target: [0.35, 1.0, -0.4] as const, fov: 29 };
/**
 * The results shot (V6 Part 6.4.3): the room from the foot of the bed, a little to the side, the headboard and the window
 * at the left, the nightstand beside him, the back window at the top right, the beam along the top edge. A phone looks
 * along the bed from its foot, the bed in the lower half.
 */
const RESULTS = {
  desktop: { position: [3.4, 1.65, 3.1] as const, target: [1.0, 1.05, -0.4] as const, fov: 40 },
  phone: { position: [2.8, 1.8, 1.9] as const, target: [0.3, 1.85, -0.45] as const, fov: 58 },
};
const EASE_MS = 900;
const NIGHT = '#141836';
/** The lamp's light turned low while he sleeps and up when he wakes, and its chimney's glow with it. */
const LAMP_LIGHT = { low: 1.1, high: 4.2 } as const;
const GLASS = { low: 0.35, high: 1.6 } as const;

/** The HTML that hangs in the room: the results board from the beam's hook, the paper slip from the headboard. */
export interface RoomAnchors { board: MutableRefObject<HTMLElement | null>; slip: MutableRefObject<HTMLElement | null> }

/**
 * The farmer's bubble (V4.1 Part 7): a small canvas of its own, masked to a cloud, so he is always framed whatever the
 * dream camera does. It reads the run's clock and never writes it. The z's float over it as HTML. When the dream is over
 * the bubble opens to the whole screen and is the same bedroom seen whole (V6 Part 6.4): the camera comes down to the
 * bed, the lamp is turned up if he woke, and the results hang from the beam.
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
          camera={{ fov: CAMERA.fov, position: [...CAMERA.position], near: 0.05, far: 20 }}
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
  const glassMat = useMemo(() => voxelMaterial({ emissive: '#FFB45A', emissiveIntensity: GLASS.low }), []);
  const selfLit = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const room = roomOn(phase);
  const r = useMemo(() => (room ? { sitting: farmerSitting(), quilt: quiltSat(), folds: [foldedQuilt(0), foldedQuilt(1)] } : null), [room]);
  const sitting = room && live.current.asleepAt === null;
  const bump = useRef<Group>(null);
  const clock = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const asleep = useRef<Mesh>(null);
  const awake = useRef<Mesh>(null);
  const sitAwake = useRef<Mesh>(null);
  const sitBlink = useRef<Mesh>(null);
  const lampLight = useRef<PointLight>(null);
  const candle = useRef<PointLight>(null);
  const shot = phone ? RESULTS.phone : RESULTS.desktop;
  const cam = useMemo(() => ({ at: -1, from: new Vector3(), look: new Vector3(), p: new Vector3(), lamp: 0 }), []);
  useEffect(() => { scene.background = new Color(NIGHT); }, [scene]);
  useEffect(() => () => { vox.dispose(); glassMat.dispose(); selfLit.dispose(); }, [vox, glassMat, selfLit]);
  useFrame(({ clock: ck }, dt) => {
    const t = ck.elapsedTime, L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    // A bump short of the last only stirs him: awake for 600 ms, then asleep again.
    const stirred = L.t < L.stumbleUntil - 100;
    const up = since >= WAKE.stir || (phase === 'results' && L.asleepAt === null);
    const woke = up || stirred;
    if (asleep.current) asleep.current.visible = !woke;
    if (awake.current) awake.current.visible = woke;
    // Sitting up he blinks, a quick shut every few seconds.
    const blink = !reduced && t % 3.3 < 0.14;
    if (sitAwake.current) sitAwake.current.visible = !blink;
    if (sitBlink.current) sitBlink.current.visible = blink;
    if (bump.current) bump.current.scale.y = reduced || woke ? 1 : 1 + 0.035 * (0.5 + 0.5 * Math.sin((t / 3.6) * Math.PI * 2));
    // The lamp: turned low through the night, up when he wakes for good.
    cam.lamp = reduced ? (up ? 1 : 0) : Math.min(1, Math.max(0, cam.lamp + (up ? dt * 2.5 : -dt * 2.5)));
    const flicker = reduced ? 1 : 1 + 0.05 * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 7.3 + 1.7);
    if (lampLight.current) lampLight.current.intensity = (LAMP_LIGHT.low + (LAMP_LIGHT.high - LAMP_LIGHT.low) * cam.lamp) * flicker;
    (glassMat as MeshLambertMaterial).emissiveIntensity = (GLASS.low + (GLASS.high - GLASS.low) * cam.lamp) * flicker;
    if (candle.current) candle.current.intensity = 0.5 * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 17.3) + 0.08 * Math.sin(t * 5.1));
    // The clock rings on the wake-up, and in bursts while he sits up in the lamplight.
    const arrived = room && cam.at >= 0 ? t - cam.at - EASE_MS / 1000 : -1;
    const ringing = (since >= WAKE.stir && since < WAKE.stir + 600) || (sitting && arrived >= 0 && arrived % 3.2 < 0.8);
    if (clock.current) clock.current.rotation.z = !reduced && ringing ? Math.sin(t * 30 * Math.PI * 2) * ((3 * Math.PI) / 180) : 0;
    if (ring.current) ring.current.visible = ringing && (reduced || Math.floor(t * 8) % 2 === 0);

    // The camera: the bubble's shot until the dream is over, then down to the bed over 900 ms (a cut under reduced motion).
    if (!room) {
      // Back from the results (Practice starts a new dream in place): put the bubble's own shot back.
      if (cam.at >= 0) {
        camera.position.set(...CAMERA.position);
        camera.fov = CAMERA.fov;
        camera.updateProjectionMatrix();
        camera.lookAt(...CAMERA.target);
      }
      cam.at = -1;
      return;
    }
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
      {/* Night in the room: a dim cool fill, moonlight falling in from the windows, the lamp and the candle warm. */}
      <hemisphereLight args={['#7A80C0', '#4A3A30', 1.1]} />
      {/* The lamp's glow from the room side, so his face reads whichever way he lies. */}
      <pointLight position={[1.4, 1.5, 0.9]} color="#FFD8B0" intensity={2.2} distance={4} decay={1.5} />
      <directionalLight position={[-1, 3, -3.5]} color="#A9BCFF" intensity={1.1} />
      <pointLight ref={lampLight} position={[LAMP.x + 0.08, LAMP.y + 0.3, LAMP.z + 0.12]} color="#FFC48A" intensity={LAMP_LIGHT.low} distance={6} decay={1.6} />
      <pointLight ref={candle} position={[CANDLE.x, CANDLE.y + 0.25, CANDLE.z + 0.15]} color="#FFB060" intensity={0.5} distance={2.2} decay={2} />
      <mesh geometry={b.room} material={vox} />
      <mesh geometry={b.glow} material={selfLit} />
      <mesh geometry={b.lampGlass} material={glassMat} />
      <group ref={clock} position={[CLOCK.x, CLOCK.y + 0.025, CLOCK.z]} rotation={[0, CLOCK.turn, 0]}>
        <mesh geometry={b.clock} material={vox} />
        <mesh ref={ring} geometry={b.ring} material={selfLit} visible={false} />
      </group>
      {r && [0, 1].slice(0, blankets).map((i) => (
        <mesh key={i} geometry={r.folds[i]} material={vox} position={[1.62 + i * 0.03, BED.mattress.top + 0.05 + i * 0.12, -0.12 + i * 0.05]} rotation={[0, i ? 0.12 : -0.05, 0]} />
      ))}
      {sitting && r ? <mesh geometry={r.quilt} material={vox} /> : (
        <group ref={bump} position={[0, BED.mattress.top, 0]}><mesh geometry={b.quiltBump} material={vox} position={[0, -BED.mattress.top, 0]} /></group>
      )}
      {sitting && r ? (
        // Awake and sitting up against the headboard, turned toward the room, blinking, his nightcap knocked askew.
        <group position={[SITTING.x, SITTING.y, SITTING.z]} rotation={[0, SITTING.turn, 0]}>
          <mesh ref={sitAwake} geometry={f.awake} material={vox} />
          <mesh ref={sitBlink} geometry={f.asleep} material={vox} visible={false} />
          <mesh geometry={f.cap} material={vox} rotation={[0, 0, -0.12]} position={[0.01, 0.01, 0]} />
          <mesh geometry={r.sitting} material={vox} />
        </group>
      ) : (
        // The farmer: built standing, laid down on the pillow, propped toward the foot of the bed so his face reads.
        <group position={[0.34, BED.pillowTop + 0.05, -0.02]} rotation={[0.3, -0.35, -0.95]}>
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
