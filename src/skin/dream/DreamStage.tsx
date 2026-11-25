import { AdaptiveCanvas, MarkDrawn } from '../table/Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { useFrame, useThree } from '@react-three/fiber';
import { createRef, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { PCFShadowMap, SRGBColorSpace } from 'three';
import type { Group, Mesh } from 'three';
import { FIELD, JUMP_MS, takeoffDistance } from '../../dream/dream';
import type { Obstacle } from '../../dream/dream';
import { ScreenAnchor } from '../table/Anchors';
import { DevStats, devOn } from '../table/DevStats';
import { isAdminAvatar } from '../../avatars/ids';
import { byId } from '../avatars/catalog';
import { useAvatar } from '../avatars/store';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { useKaiyanLook } from '../avatars/kaiyanLook';
import { photoHeight } from '../avatars/photos';
import { animalModel } from '../voxel/animals';
import { Sheep } from '../table/Sheep';
import type { SheepState } from '../table/Sheep';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { bonkStar } from './bonk';
import { ART, DISC_MAX_H, drawnLift, dreamView, leapPitch, PX, RECOIL, SHEEP_ART, SHEEP_CENTRE, SHEEP_SCALE, WAKE, worldX } from './stage';
import { PLAN_M } from './camera';
import type { DreamWorldState } from './world3d/state';
// The voxel worlds and their models load with the dream, in their own chunk (docs/dream/v3/03, section 2).
const DreamWorld = lazy(() => import('./world3d/DreamWorld').then((m) => ({ default: m.DreamWorld })));
import { FESTIVE } from '../../config';
import { LOOK } from '../look';

const LAND_MS = 200;
const SX = FIELD.sheepX, SW = FIELD.sheepW, FW = FIELD.fenceW;
/** The photo leans into the leap less than the sheep's nose rises: it is a tall flat picture pivoting at its foot. */
const DISC_PITCH = 0.35;
/** The sheep's middle, metres above its feet as drawn: what it rolls about in the air. */
const ROLL_ABOUT = (ART * SHEEP_ART.hat * PX) / 2 * 0.82;

/** What the stage reads every frame; the screen owns the state and only this view of it is shared. */
export interface StageLive {
  dist: number;
  t: number;
  jumpAt: number | null;
  crashAt: number | null;
  /** A bump short of the last one holds the sheep until this time, and the farmer stirs. */
  stumbleUntil: number;
  /** When the dream ended with the farmer still asleep (a bump he slept through). */
  asleepAt: number | null;
  /** When he went out cold (the night's fence mark): from then on he sleeps deep. */
  deepAt?: number | null;
  speed: number;
  fences: { index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; knockedAt: number | null }[];
}

/** One fence's sign, as React sees it (changes seldom); positions come from the live ref. */
export interface FenceView { index: number; kind: Obstacle; letters: readonly string[]; word: string; locked: boolean; hot: boolean; wrong: boolean }

export type Phase = 'ready' | 'running' | 'crashed' | 'drifting' | 'results';

interface Props {
  live: MutableRefObject<StageLive>;
  /** The latest sheep counted, to pop over the sheep. */
  pop: { n: number; key: number } | null;
  phase: Phase;
  reduced: boolean;
  phone: boolean;
  /** How many pictures a second the sheep is drawn at (the frame governor): 0 once the bedroom covers the dream whole. */
  fps?: number;
  /** Which world, where the gates are, the moon show: the dream's loop says (world3d/DreamWorld.tsx). */
  world: MutableRefObject<DreamWorldState>;
  seed: string;
  low: boolean;
}

/**
 * The sheep, running on the spot in the dream (docs/dream/, 2026-11-24). The dream's world is flat pixel art on the
 * canvas behind this one (scene/, drawn by Fx.tsx); this canvas is see-through and holds only the voxel sheep (or the
 * avatar worn), side on, through the same orthographic camera the rules' side view has always had (plan file 09, 4.2).
 * The count pops over it as HTML, pinned by ScreenAnchor.
 */
export function DreamStage(props: Props) {
  const pop = useMemo(() => createRef<HTMLDivElement>(), []);
  return (
    <>
    <SceneBoundary scene="the dream">
    <AdaptiveCanvas maxDpr={props.phone ? 1.5 : 2} memory="dream" fps={props.fps} shadows={{ type: PCFShadowMap }}
      gl={{ alpha: false, outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: true }}
      camera={{ manual: true, position: [0, 2.4, 16], near: 1, far: 600, fov: 30 }}
    >
      <Scene {...props} tag={pop} />
      <MarkDrawn />
      <DevStats />
    </AdaptiveCanvas>
    </SceneBoundary>
    <div className="dr-tags" aria-hidden="true">
      <div ref={pop} className="dr-tag">{props.pop && <span key={props.pop.key} className="dr-pop sk-display">{props.pop.n}</span>}</div>
    </div>
    </>
  );
}

function Scene({ live, phase, reduced, phone, tag, world, seed, low }: Props & { tag: RefObject<HTMLDivElement | null> }) {
  const size = useThree((s) => s.size);
  const view = useMemo(() => dreamView(Math.max(1, size.width), Math.max(1, size.height), phone), [size.width, size.height, phone]);
  const glowMat = useMemo(() => voxelMaterial({ emissive: T.lantern[0], emissiveIntensity: 1.2 }), []);
  const star = useMemo(() => bonkStar(), []);
  const sheep = useRef<Group>(null);
  const roll = useRef<Group>(null);
  const stars = useRef<(Mesh | null)[]>([]);
  const [sheepState, setSheepState] = useState<SheepState>('grazing');
  // The worn avatar runs the dream (V5.1 Part 6.7), drawn at its own scale. The admin's photo runs too (Brian,
  // 2026-11-09), trotting and leaping as a picture facing the camera (discPose's dream states).
  const avatar = useAvatar();
  const admin = isAdminAvatar(avatar);
  const runner = !admin && byId(avatar) ? animalModel(byId(avatar)!.animal) : undefined;
  const { length } = useKaiyanLook(avatar);
  const discScale = Math.min(SHEEP_SCALE, DISC_MAX_H / photoHeight(avatar, length));
  // The bonk stars circle the head and the count pops beside it, so both rise with a tall picture.
  const headY = admin ? photoHeight(avatar, length) * discScale + 0.08 : 0.95;
  const [stateKey, setStateKey] = useState(0);
  const [pace, setPace] = useState(0);
  const paceRef = useRef(0);
  const anim = useMemo(() => ({ state: 'grazing' as SheepState, landUntil: -1, wasAir: false }), []);

  useFrame(({ clock }) => {
    const L = live.current, t = clock.elapsedTime;
    // The sheep: which state it is in, how high (the rules' arc drawn ART times taller), and knocked back on the bonk.
    const air = L.jumpAt === null ? 0 : drawnLift(L.t - L.jumpAt) * PX;
    const ahead = L.fences.find((fe) => !fe.passed && fe.x + FW > SX);
    const about = !!ahead && ahead.locked && !ahead.jumped && L.jumpAt === null && ahead.x - (SX + SW) <= takeoffDistance(L.speed) + L.speed * 0.08;
    let want: SheepState = 'run';
    const stumbling = L.t < L.stumbleUntil;
    if (phase === 'ready') want = 'grazing';
    else if (L.asleepAt !== null) want = 'sleeping';
    else if (L.crashAt !== null || stumbling) want = 'bonk';
    else if (L.jumpAt !== null || about) want = 'jump';
    else if (anim.wasAir || L.t < anim.landUntil) { if (anim.wasAir) anim.landUntil = L.t + LAND_MS; want = 'land'; }
    anim.wasAir = L.jumpAt !== null;
    if (want !== anim.state) { anim.state = want; setSheepState(want); setStateKey((k) => k + 1); }
    const p = Math.round(Math.min(1, Math.max(0, (L.speed - 58) / 42)) * 10) / 10;
    if (p !== paceRef.current) { paceRef.current = p; setPace(p); }
    if (sheep.current) {
      const back = L.crashAt !== null ? -RECOIL.m * Math.min(1, (L.t - L.crashAt) / RECOIL.ms) : stumbling ? -0.12 : 0;
      sheep.current.position.set(worldX(SHEEP_CENTRE) + back, air, 0);
      // The leap in the body: a crouch before take-off, a stretch at the push and the reach, and a squash that gives on
      // the landing. The model's own legs do the rest.
      const j = L.jumpAt === null ? -1 : Math.min(1, (L.t - L.jumpAt) / JUMP_MS);
      let pitch = 0, tall = 1, long = 1;
      if (!reduced) {
        if (j >= 0) {
          pitch = leapPitch(j);
          const s = Math.abs(2 * j - 1);
          tall = 0.97 + 0.08 * s;
          long = 1.03 - 0.05 * s;
        } else if (about) { tall = 0.84; long = 1.09; pitch = 0.08; }
        else if (L.t < anim.landUntil) {
          const k = (anim.landUntil - L.t) / LAND_MS;
          tall = 1 - 0.2 * k * k;
          long = 1 + 0.12 * k * k;
          pitch = -0.14 * k;
        }
      }
      // The roll (06, section 3): in the air the sheep turns once, head first, about its body's middle, like a ball of
      // wool; the turn takes exactly the time in the air. The rules' box does not turn, and the photo only leans.
      const rolling = j >= 0 && !reduced && !admin && JUMP_MS >= 300;
      sheep.current.rotation.z = admin ? pitch * DISC_PITCH : rolling ? 0 : pitch;
      sheep.current.scale.set(long, tall, 1);
      if (roll.current) roll.current.rotation.z = rolling ? -Math.PI * 2 * j : 0;
    }
    // Bonk stars orbit 0.25 m above the head from 350 ms.
    const since = L.crashAt !== null ? L.t - L.crashAt : -1;
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = (since >= WAKE.stir || stumbling) && !reduced;
      const a = (t / 1.1) * Math.PI * 2 + (i / 3) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.25, headY + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.25);
    });
  });

  return (
    <>
      <DevLive live={live} />
      {/* The dream itself: the voxel worlds, their sky and light, what the sheep jumps, the gates (docs/dream/v3). */}
      <Suspense fallback={null}><DreamWorld live={live} state={world} view={view} festive={FESTIVE} low={low} reduced={reduced} phone={phone} seed={seed} /></Suspense>
      {/* The sheep faces +x and runs on the spot; the world does the moving. It stands on the rules' box centre, drawn
          ART times its size about its feet, its own drawn middle on that centre (plan file 09, 4.2). The dream is in
          the plan's metres; the sheep, in the game's, is scaled into them. */}
      <group scale={1 / PLAN_M}>
      <group ref={sheep}>
        <group ref={roll} position={[0, ROLL_ABOUT, 0]}>
        <group position={[0, -ROLL_ABOUT, 0]} scale={ART}>
          {admin ? (
            // Facing the camera, which looks straight across the lane.
            <group scale={discScale}>
              <AvatarDisc state={sheepState} stateKey={stateKey} reduced={reduced} pace={pace} avatar={avatar} />
            </group>
          ) : (
            <group position={[-SHEEP_ART.mid * PX, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={SHEEP_SCALE * (runner ?? animalModel('sheep')).drawScale}>
              <Sheep level={2} state={sheepState} stateKey={stateKey} reduced={reduced} gustFrom={[0, 0.8, -4]} pace={pace} model={runner} contact={false} />
            </group>
          )}
          {[0, 1, 2].map((i) => <mesh key={i} ref={(el) => { stars.current[i] = el; }} geometry={star} material={glowMat} visible={false} />)}
        </group>
        </group>
        {/* The count pops at the sheep's upper right. */}
        <ScreenAnchor el={tag} position={[0.62, ART * headY - 0.05, 0]} cull={false} />
      </group>
      </group>
    </>
  );
}

/** Development only: the run, on window, for the capture scripts. */
function DevLive({ live }: { live: MutableRefObject<StageLive> }) {
  useEffect(() => { if (devOn()) Object.assign(window, { __dreamLive: live }); }, [live]);
  return null;
}
