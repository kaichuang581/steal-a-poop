import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping, Color, MeshBasicMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Mesh, MeshLambertMaterial, PerspectiveCamera, PointLight } from 'three';
import { voxelMaterial } from '../voxel/material';
import { BEAM, BED, bedroomGeometry, CANDLE, CLOCK, drowsyAt, EYE_TOP, farmerGeometry, farmerRubArm, farmerSitting, foldedQuilt, HEAD_PIVOT, HIP, LAMP, quiltSat, roomOn, settleAt, SHOULDER, SITTING, smooth, STIR_MS, stirAt } from './bedroom';
import type { Phase, StageLive } from './DreamStage';
import { STUMBLE_MS } from '../../dream/dream';
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
/** The lamp's light turned low while he sleeps and up once he is propped up in the room, and its chimney's glow with it. */
const LAMP_LIGHT = { low: 1.1, high: 4.2 } as const;
const GLASS = { low: 0.35, high: 1.6 } as const;

/** The HTML that hangs in the room: the results board from the beam's hook, the paper slip from the headboard. */
export interface RoomAnchors { board: MutableRefObject<HTMLElement | null>; slip: MutableRefObject<HTMLElement | null> }

/**
 * The farmer's bubble (V4.1 Part 7): a small canvas of its own, masked to a cloud, so he is always framed whatever the
 * dream camera does. It reads the run's clock and never writes it. The z's float over it as HTML. When the dream is over
 * the bubble opens to the whole screen and is the same bedroom seen whole (V6 Part 6.4): the camera comes down to the
 * bed, the lamp is turned up if a bump stirred him, and the results hang from the beam. A bump never wakes him outright:
 * he stirs in the bubble (`stirAt`) and is propped up, drowsy, in the room (`drowsyAt`). `data-woke` marks a stirred night.
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
      <span className="dr-bubble-zs" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="dream-z" data-i={i}>z</span>)}</span>
      <span className="dr-bubble-bang" aria-hidden="true">hm?</span>
    </div>
  );
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** A lid scaled to nothing is hidden, so the open eye shows clean. */
const setLid = (m: Mesh | null, v: number) => { if (m) { m.visible = v > 0.03; m.scale.y = Math.max(0.03, v); } };

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
  const r = useMemo(() => (room ? { sitting: farmerSitting(), arm: farmerRubArm(), quilt: quiltSat(), folds: [foldedQuilt(0), foldedQuilt(1)] } : null), [room]);
  const sitting = room && live.current.asleepAt === null;
  const bump = useRef<Group>(null);
  const clock = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const asleep = useRef<Mesh>(null);
  const awake = useRef<Mesh>(null);
  const lidA = useRef<Mesh>(null);
  const lidB = useRef<Mesh>(null);
  const lieHead = useRef<Group>(null);
  const lieBody = useRef<Group>(null);
  const sitLean = useRef<Group>(null);
  const sitHead = useRef<Group>(null);
  const sitLidA = useRef<Mesh>(null);
  const sitLidB = useRef<Mesh>(null);
  const rubArm = useRef<Group>(null);
  const lampLight = useRef<PointLight>(null);
  const candle = useRef<PointLight>(null);
  const shot = phone ? RESULTS.phone : RESULTS.desktop;
  const cam = useMemo(() => ({ at: -1, from: new Vector3(), look: new Vector3(), p: new Vector3(), lamp: 0 }), []);
  useEffect(() => { scene.background = new Color(NIGHT); }, [scene]);
  useEffect(() => () => { vox.dispose(); glassMat.dispose(); selfLit.dispose(); }, [vox, glassMat, selfLit]);
  useFrame(({ clock: ck }, dt) => {
    const t = ck.elapsedTime, L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    // A bump never wakes him: he stirs. The last bump plays the whole stir and leaves him peeking, drowsy; a bump short
    // of the last (none while the night has one life) stirs him and lets him settle back. Reduced motion holds the peek.
    const stumbleMs = L.t - (L.stumbleUntil - STUMBLE_MS);
    const stirring = since >= 0 || (L.stumbleUntil > 0 && stumbleMs >= 0 && stumbleMs < 1700);
    const st = since >= 0 ? stirAt(reduced ? STIR_MS : since) : stirring ? (reduced ? settleAt(0) : settleAt(stumbleMs)) : null;
    if (asleep.current) asleep.current.visible = !st;
    if (awake.current) awake.current.visible = !!st;
    setLid(lidA.current, st ? st.lidA : 0);
    setLid(lidB.current, st ? st.lidB : 0);
    // Breathing: the quilt rises and falls, and his head and shoulders ride it.
    const breath = reduced ? 0 : 0.5 - 0.5 * Math.cos((t / 3.8) * Math.PI * 2);
    if (bump.current) bump.current.scale.y = 1 + 0.035 * breath + 0.07 * (st?.heave ?? 0);
    if (lieHead.current) { lieHead.current.rotation.y = st?.roll ?? 0; lieHead.current.rotation.x = (st?.nod ?? 0) - 0.03 * breath; }
    if (lieBody.current) { lieBody.current.rotation.y = 0.4 * (st?.roll ?? 0); }
    // The lamp: low through the night; turned up, slowly, once he has propped himself up in the room.
    const up = phase === 'results' && L.asleepAt === null;
    cam.lamp = reduced ? (up ? 1 : 0) : Math.min(1, Math.max(0, cam.lamp + (up ? dt * 0.7 : -dt * 1.5)));
    const lamp = smooth(cam.lamp);
    const flicker = reduced ? 1 : 1 + 0.05 * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 7.3 + 1.7);
    if (lampLight.current) lampLight.current.intensity = (LAMP_LIGHT.low + (LAMP_LIGHT.high - LAMP_LIGHT.low) * lamp) * flicker;
    (glassMat as MeshLambertMaterial).emissiveIntensity = (GLASS.low + (GLASS.high - GLASS.low) * lamp) * flicker;
    if (candle.current) candle.current.intensity = 0.5 * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 17.3) + 0.08 * Math.sin(t * 5.1));
    // The clock rattles with the alarm as the dream pops, swelling in and dying away; that is what makes him peek.
    const rang = since - WAKE.pop, ringing = !room && rang >= 0 && rang < 500;
    if (clock.current) clock.current.rotation.z = !reduced && ringing ? Math.sin(t * 30 * Math.PI * 2) * ((3 * Math.PI) / 180) * Math.sin((rang / 500) * Math.PI) : 0;
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
    // Propped up, drowsy: he pushes himself up as the camera comes down, rubs his eye, blinks slowly, nods off and catches himself.
    const dz = drowsyAt(t - cam.at, reduced);
    if (sitLean.current) sitLean.current.rotation.z = dz.lean;
    if (sitHead.current) { sitHead.current.rotation.x = dz.droop; sitHead.current.rotation.z = dz.tilt; }
    setLid(sitLidA.current, dz.lid);
    setLid(sitLidB.current, dz.lid);
    if (rubArm.current) { rubArm.current.rotation.x = dz.rub[1]; rubArm.current.rotation.z = dz.rub[0]; }
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
        // Propped up against the headboard from his hips, turned toward the room, half-lidded, rubbing one eye, his nightcap askew.
        <group ref={sitLean} position={[SITTING.x, SITTING.y - HIP, SITTING.z]}>
          <group position={[0, HIP, 0]} rotation={[0, SITTING.turn, 0]}>
            <mesh geometry={r.sitting} material={vox} />
            <group ref={sitHead}>
              <group ref={rubArm} position={SHOULDER}><mesh geometry={r.arm} material={vox} position={[-SHOULDER[0], -SHOULDER[1], -SHOULDER[2]]} /></group>
              <mesh geometry={f.awake} material={vox} />
              <mesh ref={sitLidA} geometry={f.lidA} material={vox} position={[0, EYE_TOP, 0]} />
              <mesh ref={sitLidB} geometry={f.lidB} material={vox} position={[0, EYE_TOP, 0]} />
              <mesh geometry={f.cap} material={vox} rotation={[0, 0, -0.12]} position={[0.01, 0.01, 0]} />
            </group>
          </group>
        </group>
      ) : (
        // The farmer: built standing, laid down on the pillow, propped toward the foot of the bed so his face reads.
        <group position={[0.34, BED.pillowTop + 0.05, -0.02]} rotation={[0.3, -0.35, -0.95]}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <group ref={lieBody}><mesh geometry={f.body} material={vox} /></group>
              <group ref={lieHead} position={[0, HEAD_PIVOT, 0]}>
                <group position={[0, -HEAD_PIVOT, 0]}>
                  <mesh ref={asleep} geometry={f.asleep} material={vox} />
                  <mesh ref={awake} geometry={f.awake} material={vox} visible={false} />
                  <mesh ref={lidA} geometry={f.lidA} material={vox} position={[0, EYE_TOP, 0]} visible={false} />
                  <mesh ref={lidB} geometry={f.lidB} material={vox} position={[0, EYE_TOP, 0]} visible={false} />
                  <mesh geometry={f.cap} material={vox} />
                </group>
              </group>
            </group>
          </group>
        </group>
      )}
    </>
  );
}
