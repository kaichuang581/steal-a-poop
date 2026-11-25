import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { BUBBLE_FPS } from '../perf/governor';
import { SceneBoundary } from '../perf/SceneBoundary';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Color, MeshBasicMaterial, SRGBColorSpace, Vector3 } from 'three';
import type { Group, Mesh, MeshLambertMaterial, PerspectiveCamera, PointLight } from 'three';
import { FIELD } from '../../dream/dream';
import { BLEND_MS, blendPose, breathAt, POSES } from './farmer';
import type { Pose, PoseName } from './farmer';
import type { FarmerHandle } from './FarmerFigure';
import { FarmerInBed } from './FarmerInBed';
import { voxelMaterial } from '../voxel/material';
import { BEAM, BED, bedroomGeometry, CANDLE, CLOCK, foldedQuilt, LAMP, roomOn, smooth, stripWall } from './bedroom';
import { stripCamera, stripExtent } from './frame';
import type { DreamFrame, StripCamera } from './frame';
import type { Phase, StageLive } from './DreamStage';
import { WAKE } from './stage';
import { LOOK } from '../look';

/**
 * The results shot (V6 Part 6.4.3): the room from the foot of the bed, a little to the side, the headboard and the window
 * at the left, the nightstand beside him, the back window at the top right, the beam along the top edge. A phone looks
 * along the bed from its foot, the bed in the lower half.
 */
const RESULTS = {
  desktop: { position: [3.4, 1.65, 3.1] as const, target: [1.0, 1.05, -0.4] as const, fov: 40 },
  phone: { position: [2.8, 1.8, 1.9] as const, target: [0.3, 1.85, -0.45] as const, fov: 58 },
};
/**
 * The strip's light (docs/dream/01-farmer.md, section 4): the candle and a little moonlight. The room is dim, so the
 * dream above is the bright thing, and his face is lit, so he reads.
 */
const STRIP_LIGHT = { fill: 0.5, face: 1.5, moon: 0.7, lamp: 0.45, candle: 1.1 } as const;
const EASE_MS = 900;
const NIGHT = '#141836';
/** The lamp's light turned low while he sleeps and up once he is propped up in the room, and its chimney's glow with it. */
const LAMP_LIGHT = { low: 1.1, high: 4.2 } as const;
const GLASS = { low: 0.35, high: 1.6 } as const;

/** The HTML that hangs in the room: the results board from the beam's hook. */
export interface RoomAnchors { board: MutableRefObject<HTMLElement | null> }

/**
 * The bed strip (docs/dream/01-farmer.md, section 4): the farmer's bedroom in a canvas of its own along the bottom of the
 * screen, seen from the bed's side through the camera `bedSide` (frame.ts `stripCamera`: it looks straight at the bed's
 * long side, and the strip is a wide slice of what it sees, so the wall and the window stay square to the screen). It
 * reads the run's clock and never writes it. When the dream is over the canvas opens to the whole screen and is the
 * same bedroom seen whole (V6 Part 6.4): the camera goes to the foot of the bed, the lamp is turned up if a bump woke
 * him, and the results hang from the beam. The farmer is farmer.ts: he sleeps
 * (`bedSleep`, or `bedDeep` once the fences ask three letters or he is out cold), stirs as an unanswered fence comes
 * close (`bedStir`), starts up on a bump (`bedJolt`) and sits up, grumpy, in the room (`bedUpright`). `data-woke` marks a
 * night that woke him.
 */
export function BedroomBubble({ live, phase, reduced, phone, blankets = 0, anchors, depth = 1, frame }: {
  live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean; phone: boolean; blankets?: number; anchors?: RoomAnchors;
  /** How deep he sleeps: the letters on the fence's sign, 1 to 3 (plan file 00, section 4). */
  depth?: number;
  /** The screen's layout: where the strip is, and so where its camera stands. */
  frame: DreamFrame;
}) {
  const woke = phase === 'crashed' || (phase === 'results' && live.current.asleepAt === null);
  const room = roomOn(phase);
  const strip = useMemo(() => stripCamera(frame), [frame]);
  const { x: bx, y: by, w: bw, h: bh } = frame.room;
  return (
    <div className="dr-room" data-woke={woke || undefined} data-room={room || undefined} style={room ? undefined : { left: bx, top: by, width: bw, height: bh }}>
        <SceneBoundary scene="the bedroom" size="note">
        <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="bedroom"
          // A man asleep in a small cloud: BUBBLE_FPS pictures a second. The full rate as he is woken (the alarm clock
          // rattles thirty times a second, which a slow rate would show standing still) and once the bubble is the room.
          fps={phase === 'crashed' || room ? undefined : BUBBLE_FPS}
          flat={false}
          gl={{ antialias: true, alpha: false, outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1 }}
          camera={{ fov: 20, position: [...strip.position], near: 0.05, far: 60 }}
        >
          <Room live={live} phase={phase} reduced={reduced} phone={phone} blankets={blankets} anchors={anchors} depth={depth} strip={strip} frame={frame} />
          <MarkDrawn />
        </AdaptiveCanvas>
        </SceneBoundary>
    </div>
  );
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** An unanswered fence this many seconds off stirs him. */
const STIR_WITHIN_S = 1.5;
/** Deep asleep and stirring: the brows drop and the head comes round, but the arm stays hanging and the mouth open. */
const DEEP_STIR: Pose = { ...POSES.bedDeep, headTurn: POSES.bedStir.headTurn, brows: POSES.bedStir.brows, breath: POSES.bedStir.breath };

/** The pose the night calls for (docs/dream/01-farmer.md, section 3). */
export function poseFor(L: StageLive, phase: Phase, depth: number): PoseName | 'deepStir' {
  if (phase === 'results') return L.asleepAt !== null ? 'bedDeep' : 'bedUpright';
  if (L.crashAt !== null) return 'bedJolt';
  const deep = depth >= 3 || L.asleepAt !== null || (L.deepAt ?? null) !== null;
  if (phase === 'running') {
    const next = L.fences.find((fe) => !fe.passed && fe.x + FIELD.fenceW > FIELD.sheepX);
    if (next && !next.locked && L.speed > 0 && (next.x - (FIELD.sheepX + FIELD.sheepW)) / L.speed < STIR_WITHIN_S) return deep ? 'deepStir' : 'bedStir';
  }
  return deep ? 'bedDeep' : 'bedSleep';
}

function Room({ live, phase, reduced, phone, blankets, anchors, depth, strip, frame }: { live: MutableRefObject<StageLive>; phase: Phase; reduced: boolean; phone: boolean; blankets: number; anchors?: RoomAnchors; depth: number; strip: StripCamera; frame: DreamFrame }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const b = useMemo(() => bedroomGeometry(), []);
  // The strip sees further along the back wall than the room is long: more wall and floor, and the window it ends on.
  const extent = useMemo(() => stripExtent(frame, strip), [frame, strip]);
  const far = useMemo(() => stripWall(extent.x1, extent.windowX), [extent.x1, extent.windowX]);
  const vox = useMemo(() => voxelMaterial(), []);
  const glassMat = useMemo(() => voxelMaterial({ emissive: '#FFB45A', emissiveIntensity: GLASS.low }), []);
  const selfLit = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const room = roomOn(phase);
  const r = useMemo(() => (room ? { folds: [foldedQuilt(0), foldedQuilt(1)] } : null), [room]);
  const clock = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const farmer = useRef<FarmerHandle>(null);
  // Where he is between poses: the pose he left, the one he is going to, and when he set off (the scene's clock, s).
  const at = useMemo(() => ({ name: 'bedSleep' as PoseName | 'deepStir', from: POSES.bedSleep, now: POSES.bedSleep, since: 0, ms: 0 }), []);
  const lampLight = useRef<PointLight>(null);
  const candle = useRef<PointLight>(null);
  const shot = phone ? RESULTS.phone : RESULTS.desktop;
  const cam = useMemo(() => ({ at: -1, from: new Vector3(), look: new Vector3(), p: new Vector3(), lamp: 0, fov: 20, key: '' }), []);
  useEffect(() => { scene.background = new Color(NIGHT); }, [scene]);
  useEffect(() => () => { vox.dispose(); glassMat.dispose(); selfLit.dispose(); }, [vox, glassMat, selfLit]);
  useFrame(({ clock: ck }, dt) => {
    const t = ck.elapsedTime, L = live.current;
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    // His pose: the one the night calls for, eased into over that pose's own time (a cut under reduced motion). He goes
    // on breathing whatever the motion setting.
    const want = poseFor(L, phase, depth);
    if (want !== at.name) {
      const leaving = at.name === 'deepStir' ? 'bedStir' : at.name, going = want === 'deepStir' ? 'bedStir' : want;
      const calm = going === 'bedSleep' || going === 'bedDeep';
      at.from = at.now; at.name = want; at.since = t;
      at.ms = reduced ? 0 : calm ? BLEND_MS[leaving].out : BLEND_MS[going].in;
    }
    const to = at.name === 'deepStir' ? DEEP_STIR : POSES[at.name];
    at.now = at.ms <= 0 ? to : blendPose(at.from, to, smooth(((t - at.since) * 1000) / at.ms));
    farmer.current?.apply(at.now, breathAt(t, at.now.breath));
    // The lamp: low through the night; turned up, slowly, once he has propped himself up in the room.
    const up = phase === 'results' && L.asleepAt === null;
    cam.lamp = reduced ? (up ? 1 : 0) : Math.min(1, Math.max(0, cam.lamp + (up ? dt * 0.7 : -dt * 1.5)));
    const lamp = smooth(cam.lamp);
    const flicker = reduced ? 1 : 1 + 0.05 * Math.sin(t * 13.1) + 0.04 * Math.sin(t * 7.3 + 1.7);
    if (lampLight.current) lampLight.current.intensity = (room ? LAMP_LIGHT.low + (LAMP_LIGHT.high - LAMP_LIGHT.low) * lamp : STRIP_LIGHT.lamp) * flicker;
    (glassMat as MeshLambertMaterial).emissiveIntensity = (GLASS.low + (GLASS.high - GLASS.low) * lamp) * flicker;
    if (candle.current) candle.current.intensity = (room ? 0.5 : STRIP_LIGHT.candle) * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 17.3) + 0.08 * Math.sin(t * 5.1));
    // The clock rattles with the alarm as the dream pops, swelling in and dying away; that is what makes him peek.
    const rang = since - WAKE.pop, ringing = !room && rang >= 0 && rang < 500;
    if (clock.current) clock.current.rotation.z = !reduced && ringing ? Math.sin(t * 30 * Math.PI * 2) * ((3 * Math.PI) / 180) * Math.sin((rang / 500) * Math.PI) : 0;
    if (ring.current) ring.current.visible = ringing && (reduced || Math.floor(t * 8) % 2 === 0);

    // The camera: `bedSide` until the dream is over, then to the foot of the bed over 900 ms (a cut under reduced motion).
    if (!room) {
      // The strip is a wide slice of what `bedSide` sees: the camera looks straight along -z, and a view offset puts its
      // axis where the frame wants it. Set again whenever the canvas or the frame changes, and on coming back from the
      // results (Practice starts a new dream in place).
      const key = `${size.width}:${size.height}:${strip.axis[0]}:${strip.axis[1]}:${strip.focal}`;
      if (cam.key !== key || cam.at >= 0) {
        cam.key = key;
        camera.position.set(...strip.position);
        camera.rotation.set(0, 0, 0);
        cam.fov = camera.fov = (2 * Math.atan(size.height / 2 / strip.focal) * 180) / Math.PI;
        camera.setViewOffset(size.width, size.height, size.width / 2 - (strip.axis[0] - frame.room.x), size.height / 2 - (strip.axis[1] - frame.room.y), size.width, size.height);
      }
      cam.at = -1;
      return;
    }
    if (cam.at < 0) { cam.at = t; cam.key = ''; cam.from.copy(camera.position); camera.clearViewOffset(); }
    const k = reduced ? 1 : ease(((t - cam.at) * 1000) / EASE_MS);
    camera.position.lerpVectors(cam.from, cam.p.set(shot.position[0], shot.position[1], shot.position[2]), k);
    cam.look.set(cam.from.x + (shot.target[0] - cam.from.x) * k, cam.from.y + (shot.target[1] - cam.from.y) * k, shot.target[2] * k);
    if (camera.fov !== shot.fov) { camera.fov = cam.fov + (shot.fov - cam.fov) * k; camera.updateProjectionMatrix(); }
    camera.lookAt(cam.look);
    // The board hangs from the beam's hook: project it every frame.
    const put = (el: HTMLElement | null | undefined, x: number, y: number, z: number) => {
      if (!el) return;
      const v = cam.p.set(x, y, z).project(camera);
      el.style.left = `${((v.x + 1) / 2) * size.width}px`;
      el.style.top = `${((1 - v.y) / 2) * size.height}px`;
    };
    // A phone's frame is too narrow to show the beam and the bed together: there the board hangs from the top edge.
    if (!phone) put(anchors?.board.current, BEAM.hookX + 0.05, BEAM.y, BEAM.z + 0.2);
  });
  return (
    <>
      {/* Night in the room: a dim cool fill, moonlight falling in from the windows, the lamp and the candle warm. */}
      <hemisphereLight args={['#7A80C0', '#4A3A30', room ? 1.1 : STRIP_LIGHT.fill]} />
      {/* The lamp's glow from the room side, so his face reads whichever way he lies. */}
      <pointLight position={[1.4, 1.5, 0.9]} color="#FFD8B0" intensity={room ? 2.2 : STRIP_LIGHT.face} distance={4} decay={1.5} />
      <directionalLight position={[-1, 3, -3.5]} color="#A9BCFF" intensity={room ? 1.1 : STRIP_LIGHT.moon} />
      <pointLight ref={lampLight} position={[LAMP.x + 0.08, LAMP.y + 0.3, LAMP.z + 0.12]} color="#FFC48A" intensity={LAMP_LIGHT.low} distance={6} decay={1.6} />
      <pointLight ref={candle} position={[CANDLE.x, CANDLE.y + 0.25, CANDLE.z + 0.15]} color="#FFB060" intensity={0.5} distance={2.2} decay={2} />
      <mesh geometry={b.room} material={vox} />
      <mesh geometry={b.glow} material={selfLit} />
      <mesh geometry={far.solid} material={vox} />
      <mesh geometry={far.glow} material={selfLit} />
      <mesh geometry={b.lampGlass} material={glassMat} />
      <group ref={clock} position={[CLOCK.x, CLOCK.y + 0.025, CLOCK.z]} rotation={[0, CLOCK.turn, 0]}>
        <mesh geometry={b.clock} material={vox} />
        <mesh ref={ring} geometry={b.ring} material={selfLit} visible={false} />
      </group>
      {r && [0, 1].slice(0, blankets).map((i) => (
        <mesh key={i} geometry={r.folds[i]} material={vox} position={[1.62 + i * 0.03, BED.mattress.top + 0.05 + i * 0.12, -0.12 + i * 0.05]} rotation={[0, i ? 0.12 : -0.05, 0]} />
      ))}
      <FarmerInBed ref={farmer} material={vox} pose={POSES.bedSleep} />
    </>
  );
}
