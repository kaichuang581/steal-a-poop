import { Blast } from './Blast';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ACESFilmicToneMapping, BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, PCFSoftShadowMap, PointLight, SpotLight, SRGBColorSpace, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { BufferGeometry } from 'three';
import type { Hour } from '../model/types';
import { buildBarn, CAT_SPOT, ROBIN_SPOT } from '../scene/barn';
import { buildDistance } from '../scene/distance';
import { BARN, CAMERA, HEAP, homeShot, SEAT_RING, SHEEP_SCALE, SPEAKER_CAMERA, seatPosition, speakerShot } from '../scene/layout';
import type { Shot } from '../scene/layout';
import { ChimneySmoke, Sky, Windmill } from '../scene/Sky';
import { buildYard } from '../scene/yard';
import { shearsModel, tuftGeometry, wolfEyes, wolfModel } from '../voxel/characters';
import { BOMB_FUSE_LENGTH, BOMB_NECK_Y, bombModel } from '../voxel/bomb';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { BOARD, letterBoardGeometry, pileGeometry, pileWidth, PLATFORM_HEIGHT, platformGeometry } from '../voxel/table';
import { DevStats } from './DevStats';
import { Atmosphere, Effects, LANTERN_LIGHT, Lights } from './Rendering';
import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { animalModel, heightRatio } from '../voxel/animals';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

export interface BarnSeat {
  seat: number;
  index: number;
  level: WoolLevel;
  state: SheepState;
  stateKey: number;
  coldFor?: number;
  dimmed: boolean;
  scarf: boolean;
  /** A bot on its turn: the sheep thinks whenever it has nothing else to do. */
  thinking: boolean;
  /** The avatar this player wears (src/avatars/ids.ts): its coin stands in the sheep's place. Null: the sheep. */
  avatar?: string | null;
  label: ReactNode;
}

/** One-shot moments the table animates, each restarted by a new key. */
export interface BarnMoments {
  /** Valid word: a tuft flies from the speaker to the pile; the pile spot and tag pulse. */
  tuftIn?: { key: number; from: number };
  /** Bank: the pile's wool flies onto the banker's back. */
  tuftOut?: { key: number; to: number };
  /** Successful steal: the wolf runs door, pile, stealer, door. */
  wolf?: { key: number; to: number };
  /** Failed steal: shears come down on the stealer and tufts fly off. */
  shears?: { key: number; at: number };
  /** Time out: a cold gust blows a tuft off the sheep and out of the back door. */
  gust?: { key: number; at: number };
  /** Last life lost: lantern flames dim to 40% for the freeze, and the camera stays on the frozen sheep. */
  freeze?: { key: number; at: number };
}

interface Props {
  seats: BarnSeat[];
  pile: number;
  /** Seat index (as in BarnSeat.index) whose turn it is: that sheep steps toward the pile. */
  speaker: number | null;
  /** 0..1 of the turn left (the icicle's length). */
  fraction: number;
  /** Seconds left on the clock, shown under the letter board. */
  secondsLeft: number | null;
  letter: string;
  isTrap: boolean;
  stealOpen: boolean;
  hour: Hour;
  reduced: boolean;
  phone: boolean;
  blizzard: boolean;
  moments: BarnMoments;
  /** Extra 3D content for a mode's place (pen lanterns, the sheepdog). */
  children?: ReactNode;
}

/** World-static voxel content, built once per page and shared by the table and the Home backdrop. */
export type World = ReturnType<typeof buildWorld>;
let world: World | null = null;
function buildWorld() {
  const t0 = performance.now();
  const barn = buildBarn();
  const yard = buildYard();
  const distance = buildDistance();
  const ms = performance.now() - t0;
  return { barn, yard, distance, ms };
}

/** The world, built on the first call after paint so the page is not blank-blocked while it builds. */
export function useWorld(): World | null {
  const [w, setW] = useState(world);
  useEffect(() => {
    if (world) return;
    const id = setTimeout(() => { world ??= buildWorld(); setW(world); }, 0);
    return () => clearTimeout(id);
  }, []);
  return w;
}

export function worldBuildMs(): number | null {
  return world?.ms ?? null;
}

/** The static farm: barn, yard, distance and the lanterns' glow boxes. Shared by the table and the Home backdrop. */
export function Farm({ world: w, reduced, stealOpen }: { world: World; reduced: boolean; stealOpen: boolean }) {
  const { barn, yard, distance } = w;
  const voxMat = useMemo(() => voxelMaterial(), []);
  // Bright enough to pass the bloom threshold, so only the lanterns glow.
  const glowMat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 2.2 }), []);
  return (
    <>
      {barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      {barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}
      <mesh geometry={barn.lanterns} material={glowMat} />
      <mesh geometry={barn.tarp} material={voxMat} />
      <mesh geometry={barn.front} material={voxMat} receiveShadow />
      <Cat geo={barn.cat} reduced={reduced} frozen={stealOpen} mat={voxMat} />
      <Robin geo={barn.robin} reduced={reduced || stealOpen} mat={voxMat} />
      {yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      <ChimneySmoke from={yard.smokeFrom} />
      <mesh geometry={distance.hills} material={voxMat} receiveShadow />
      <mesh geometry={distance.backHills} material={voxMat} receiveShadow />
      <mesh geometry={distance.mountains} material={voxMat} />
      <Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />
    </>
  );
}

export function BarnTable(props: Props) {
  const cam = props.phone ? CAMERA.phone : CAMERA.desktop;
  const w = useWorld();
  const tagEl = useRef<HTMLDivElement>(null);
  const clockEl = useRef<HTMLDivElement>(null);
  const fadeEl = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState(false);
  const pulseKey = props.moments.tuftIn?.key;
  useEffect(() => {
    if (pulseKey === undefined) return;
    setPop(true);
    const id = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(id);
  }, [pulseKey]);
  if (!w) return <Building />;
  const { letter, isTrap, stealOpen, secondsLeft } = props;
  return (
    <div className="relative size-full">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={props.phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
        camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
        onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
      >
        <Scene {...props} world={w} anchors={{ tag: tagEl, clock: clockEl, fade: fadeEl }} />
      </Canvas>
      {/* Reduced motion: the camera cuts between speakers behind a 150 ms fade. */}
      <div ref={fadeEl} className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'var(--ink)', opacity: 0 }} aria-hidden="true" />
      {/* No points pile any more: the tag anchor stays (unused) so the projection code is unchanged. */}
      <div ref={tagEl} className="hidden" aria-hidden="true" />
      {/* The letter to start with, big and plain, hung just under the carved board, with the clock under it as a bar
          that drains green, amber, then red (the steal window). Readable from across the room at any camera angle. */}
      <div ref={clockEl} className="pointer-events-none absolute left-0 top-0 z-[25]" style={{ transform: 'translate3d(-9999px,0,0)', willChange: 'transform' }}>
        <div
          className={`sk-letter-card ${pop ? 'sk-letter-pop' : ''}`} data-steal={stealOpen || undefined} data-trap={isTrap || undefined}
          data-chain-tile data-tour="chain" aria-label={`Required starting letter ${letter.toUpperCase()}${isTrap ? ', a trap letter' : ''}`}
        >
          <span className="sk-letter-card-label">starts with</span>
          <span className="sk-letter-card-letter">{letter.toUpperCase()}</span>
          {secondsLeft !== null && (
            <span className="sk-letter-card-bomb" data-level={stealOpen ? 'red' : props.fraction > 0.45 ? 'ok' : 'warn'}>
              <b>{secondsLeft.toFixed(1)}s</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type Anchors = { tag: React.RefObject<HTMLDivElement | null>; clock: React.RefObject<HTMLDivElement | null>; fade: React.RefObject<HTMLDivElement | null> };

/** Projects the two anchor points every frame and moves their DOM elements; the tag stays `margin` px above the bottom edge. */
function Projection({ anchors, pileHeight, margin }: { anchors: Anchors; pileHeight: number; margin: number }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const place = (el: HTMLDivElement | null, x: number, y: number, z: number, clamp: boolean) => {
      if (!el) return;
      v.set(x, y, z).project(camera);
      let px = ((v.x + 1) / 2) * size.width;
      let py = ((1 - v.y) / 2) * size.height;
      if (clamp) py = Math.min(py, size.height - margin);
      // In a close-up the board can leave the frame: the letter card then waits at the nearest edge, always readable.
      if (!clamp) {
        if (v.z > 1) { px = size.width / 2; py = 90; }
        px = Math.min(Math.max(px, 70), size.width - 70);
        py = Math.min(Math.max(py, 96), size.height - margin - 40);
      }
      el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
    };
    place(anchors.tag.current, HEAP[0], PLATFORM_HEIGHT + pileHeight + 0.35, HEAP[2], true);
    place(anchors.clock.current, HEAP[0], BOARD.bottom - 0.22, 1.0, false);
  });
  return null;
}

export function Building() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="sk-paper sk-display px-4 py-2 text-lg">Raising the barn…</div>
    </div>
  );
}

function Scene({ seats, pile, speaker, fraction, letter, isTrap, stealOpen, hour, reduced, phone, blizzard, moments, children, world: w, anchors }: Props & { world: World; anchors: Anchors }) {
  const lamps = useRef<(PointLight | null)[]>([]);
  const n = seats.length;

  // The freeze dims the lanterns to 40% for 2.4 s.
  const freezeAt = useRef(-10);
  const freezeKey = moments.freeze?.key;
  useEffect(() => { if (freezeKey !== undefined) freezeAt.current = performance.now() / 1000; }, [freezeKey]);
  useFrame(({ clock }) => {
    const dim = performance.now() / 1000 - freezeAt.current < 2.4 ? 0.4 : 1;
    const flicker = reduced || stealOpen ? 1 : 1 + Math.sin(clock.elapsedTime * 7.3) * 0.05;
    for (const l of lamps.current) if (l) l.intensity = LANTERN_LIGHT.intensity * dim * flicker;
  });

  // The camera aims at the speaker's head, wherever the animal it wears carries it (a hen low, a horse high).
  const speakerHeadY = useMemo(() => {
    const a = seats.find((s) => s.index === speaker)?.avatar;
    const c = byId(a);
    return SPEAKER_CAMERA.headY * (c ? heightRatio(c.animal) : 1);
  }, [seats, speaker]);

  // Attention (plan V3.3 Part 3.3): every sheep looks at the speaker's head; the speaker looks at the camera.
  const speakerHead = useMemo((): [number, number, number] | undefined => {
    if (speaker === null) return undefined;
    const p = seatPosition(speaker, n);
    const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
    return [p.x + (dx / len) * 0.35, 0.85 * SHEEP_SCALE, p.z + (dz / len) * 0.35];
  }, [speaker, n]);

  return (
    <>
      <SpeakerCamera speaker={speaker} n={n} phone={phone} reduced={reduced} stealOpen={stealOpen} moments={moments} fade={anchors.fade} headY={speakerHeadY} />
      <Atmosphere hour={hour} />
      <Lights hour={hour} phone={phone} viewYaw={0} lampRef={(i, l) => { lamps.current[i] = l; }} />
      <Sky hour={hour} reduced={reduced} blizzard={blizzard} />
      <Farm world={w} reduced={reduced} stealOpen={stealOpen} />
      <Pile pile={pile} pulseKey={moments.tuftIn?.key} reduced={reduced} />
      <LetterBoard letter={letter} isTrap={isTrap} stealOpen={stealOpen} reduced={reduced} />
      <Projection anchors={anchors} pileHeight={pileHeightFor(pile)} margin={phone ? 140 : 120} />
      <Bomb speaker={speaker} n={n} fraction={fraction} red={stealOpen} reduced={reduced} boomKey={moments.gust?.key} />
      {stealOpen && <WolfEyes />}
      {seats.map((s) => {
        const p = seatPosition(s.index, n);
        return (
          <SeatGroup key={s.seat} index={s.index} n={n} active={s.index === speaker} reduced={reduced} drawScale={s.avatar === ADMIN_AVATAR_ID ? 1 : animalModel(byId(s.avatar)?.animal ?? 'sheep').drawScale}>
            {s.avatar === ADMIN_AVATAR_ID ? (
              <AvatarDisc state={s.thinking && s.state === 'idle' ? 'thinking' : s.state} stateKey={s.stateKey} dimmed={s.dimmed} reduced={reduced} still={stealOpen} speaking={s.index === speaker} />
            ) : (
              <Sheep level={s.level} state={s.state} stateKey={s.stateKey} coldFor={s.coldFor} dimmed={s.dimmed} reduced={reduced} still={stealOpen} scarf={s.scarf}
                gustFrom={[0, 0.8, -6]} lookAt={s.index === speaker ? 'camera' : speakerHead} speaking={s.index === speaker} thinking={s.thinking}
                model={byId(s.avatar) ? animalModel(byId(s.avatar)!.animal) : undefined} />
            )}
            <Html position={[p.x >= 0 ? 0.95 : -0.95, 0.75, 0]} center zIndexRange={[20, 0]} rotation={[0, -p.yaw, 0]}>{s.label}</Html>
          </SeatGroup>
        );
      })}
      <Moments moments={moments} n={n} reduced={reduced} />
      {children}
      <Effects />
      <DevStats />
    </>
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** A point's angle, radius and height about the pile, so a move swings round the ring instead of cutting through it. */
const polar = (p: readonly number[]) => ({ a: Math.atan2(p[0] - SEAT_RING.cx, -(p[2] - SEAT_RING.cz)), r: Math.hypot(p[0] - SEAT_RING.cx, p[2] - SEAT_RING.cz), y: p[1] });

/**
 * The speaker camera (plan V3.3 Part 4): at every turn it moves to frame the speaker (the home shot on your turn) in
 * one 650 ms ease-in-out swing round the pile, then holds with a 0.05 m drift. No move starts in a steal window; the
 * wolf run is always seen from home and a freeze is watched to the end. Reduced motion cuts behind a 150 ms fade.
 */
function SpeakerCamera({ speaker, n, phone, reduced, stealOpen, moments, fade, headY }: { speaker: number | null; n: number; phone: boolean; reduced: boolean; stealOpen: boolean; moments: BarnMoments; fade: Anchors['fade']; headY: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const st = useMemo(() => ({
    key: '', at: -10, from: null as Shot | null, to: null as Shot | null, cur: null as Shot | null,
    wolfKey: undefined as number | undefined, wolfAt: -10, freezeKey: undefined as number | undefined, freezeAt: -10, freezeSeat: 0,
  }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moments.wolf && moments.wolf.key !== st.wolfKey) { st.wolfKey = moments.wolf.key; st.wolfAt = t; }
    if (moments.freeze && moments.freeze.key !== st.freezeKey) { st.freezeKey = moments.freeze.key; st.freezeAt = t; st.freezeSeat = moments.freeze.at; }
    const wolf = t - st.wolfAt < 1.3;
    let seat: number | null = speaker;
    if (t - st.freezeAt < 2.4) seat = st.freezeSeat;
    // The wolf's run and the gaps between turns are seen from the wide home shot; every turn zooms on its speaker.
    const home = wolf || seat === null;
    const key = home ? `home/${phone}` : `${seat}/${n}/${phone}/${headY.toFixed(2)}`;
    // A new shot starts only outside the steal window (the wolf's run is the window's own ending).
    if (key !== st.key && (!stealOpen || wolf)) {
      const to = home ? homeShot(phone) : speakerShot(seat!, n, phone, headY);
      const cut = reduced || !st.cur;
      st.from = cut ? to : st.cur;
      st.to = to;
      st.at = t;
      st.key = key;
      if (reduced && st.cur) fade.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out' });
    }
    const { from, to } = st;
    if (!from || !to) return;
    const u = easeInOut(Math.min(1, (t - st.at) / 0.65));
    const p0 = polar(from.position), p1 = polar(to.position);
    let da = p1.a - p0.a;
    da = Math.atan2(Math.sin(da), Math.cos(da)); // the short way round
    const ang = p0.a + da * u, r = p0.r + (p1.r - p0.r) * u, y = p0.y + (p1.y - p0.y) * u;
    const lerp = (i: number, k: 'target') => from[k][i] + (to[k][i] - from[k][i]) * u;
    st.cur = {
      position: [SEAT_RING.cx + Math.sin(ang) * r, y, SEAT_RING.cz - Math.cos(ang) * r],
      target: [lerp(0, 'target'), lerp(1, 'target'), lerp(2, 'target')],
      fov: from.fov + (to.fov - from.fov) * u,
    };
    // While a sheep has the floor the camera breathes on a slow 0.05 m ellipse.
    const drift = !reduced && !home && u >= 1 ? 0.05 : 0;
    const w = (t / 9) * Math.PI * 2;
    camera.position.set(st.cur.position[0] + Math.cos(w) * drift, st.cur.position[1] + Math.sin(w) * drift * 0.5, st.cur.position[2]);
    camera.lookAt(st.cur.target[0], st.cur.target[1], st.cur.target[2]);
    if (Math.abs(camera.fov - st.cur.fov) > 0.01) { camera.fov = st.cur.fov; camera.updateProjectionMatrix(); }
  });
  return null;
}

/** A seat: the sheep faces the pile and, on its turn, steps 0.35 m toward it. */
function SeatGroup({ index, n, active, reduced, drawScale = 1, children }: { index: number; n: number; active: boolean; reduced: boolean; drawScale?: number; children: ReactNode }) {
  const g = useRef<Group>(null);
  const p = seatPosition(index, n);
  const want = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    if (!g.current) return;
    const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const step = active ? 0.35 : 0;
    want.set(p.x + (dx / len) * step, 0, p.z + (dz / len) * step);
    g.current.position.lerp(want, reduced ? 1 : 1 - Math.exp(-dt * 4));
  });
  // Each species is drawn at its own scale against the sheep (V5 Part 4.6: the hen a little larger, the horse as is).
  return <group ref={g} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={SHEEP_SCALE * drawScale}>{children}</group>;
}

/** The mound's height for a pile of `points`: 0.3 m at the smallest, 0.8 m at the largest. */
function pileHeightFor(points: number): number {
  return 0.3 + ((pileWidth(points) - 0.9) / 1.3) * 0.5;
}

/**
 * The hero: the mound of wool on its wooden platform under its own spotlight, with the count on a paper tag anchored
 * above it (plan V3.2 Part 3). The spot brightens and the tag pops on an accepted word.
 */
function Pile({ pile, pulseKey, reduced }: { pile: number; pulseKey?: number; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const platform = useMemo(() => platformGeometry(), []);
  const width = pileWidth(pile);
  const mound = useMemo(() => pileGeometry(width), [width]);
  const spot = useRef<SpotLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const pulseAt = useRef(-10);
  useEffect(() => { if (pulseKey !== undefined) pulseAt.current = performance.now() / 1000; }, [pulseKey]);
  useFrame(() => {
    if (!spot.current) return;
    const e = performance.now() / 1000 - pulseAt.current;
    spot.current.intensity = 90 * (e < 0.4 && !reduced ? 1.25 : 1);
  });
  return (
    <group position={[HEAP[0], 0, HEAP[2]]}>
      <mesh geometry={platform} material={mat} castShadow receiveShadow />
      <mesh geometry={mound} material={mat} position={[0, PLATFORM_HEIGHT, 0]} castShadow receiveShadow />
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight ref={spot} position={[0, 6.0, 0]} target={target} color="#FFD9A0" intensity={90} angle={0.42} penumbra={0.7} distance={9} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    </group>
  );
}

/**
 * The starting letter carved on a board hanging from the beam above the pile (an ice block for trap letters),
 * swinging a little with the wind, with the seconds on a chip just under it (plan V3.2 Part 4).
 */
function LetterBoard({ letter, isTrap, stealOpen, reduced }: { letter: string; isTrap: boolean; stealOpen: boolean; reduced: boolean }) {
  const geo = useMemo(() => letterBoardGeometry(letter, isTrap, BARN.beamY), [letter, isTrap]);
  // A little warmth of its own, so the board still reads when the speaker camera sees its unlit side of the room.
  const boardMat = useMemo(() => voxelMaterial({ emissive: '#3A2A1C', emissiveIntensity: 1 }), []);
  const iceGeo = useMemo(() => new BoxGeometry(BOARD.width, BOARD.height, 0.24), []);
  const iceMat = useMemo(() => new MeshPhongMaterial({ color: T.ice[1], transparent: true, opacity: 0.5, shininess: 80, depthWrite: false }), []);
  const g = useRef<Group>(null);
  // The board hangs from one hook, so it turns to face the camera wherever the speaker camera stands.
  useFrame(({ clock, camera }, dt) => {
    if (!g.current) return;
    g.current.rotation.z = reduced || stealOpen ? 0 : (Math.sin(clock.elapsedTime * 0.7) * 1.5 * Math.PI) / 180;
    const want = Math.atan2(-(camera.position.x - HEAP[0]), -(camera.position.z - 1.0));
    const d = Math.atan2(Math.sin(want - g.current.rotation.y), Math.cos(want - g.current.rotation.y));
    g.current.rotation.y += d * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  });
  const pivotY = BARN.beamY - 0.15;
  const boardMid = BOARD.bottom + BOARD.height / 2 - pivotY;
  return (
    <group ref={g} position={[HEAP[0], pivotY, 1.0]}>
      <mesh geometry={geo} material={boardMat} castShadow />
      {isTrap && <mesh geometry={iceGeo} material={iceMat} position={[0, boardMid, 0]} />}
    </group>
  );
}

/** The timer: an icicle hanging from the beam beside the letter board, shrinking with the clock, red in the steal window. */
/**
 * The bomb: a voxel bomb floats over the sheep who holds it, bobbing, with the fuse burning shorter as the turn runs
 * out (red once others can steal). When the turn changes it arcs across the barn to the next sheep.
 */
function Bomb({ speaker, n, fraction, red, reduced, boomKey }: { speaker: number | null; n: number; fraction: number; red: boolean; reduced: boolean; boomKey: number | undefined }) {
  const m = useMemo(() => bombModel(), []);
  const body = useMemo(() => voxelMaterial(), []);
  const fuseMat = useMemo(() => voxelMaterial(), []);
  const sparkMat = useMemo(() => voxelMaterial({ emissive: '#ffb23a', emissiveIntensity: 1.4 }), []);
  const group = useRef<Group>(null);
  const fuse = useRef<Group>(null);
  const spark = useRef<Mesh>(null);
  const flight = useRef({ from: new Vector3(), to: new Vector3(), t: 1, started: false });
  const lastBoom = useRef({ key: boomKey, at: -9999 });
  if (boomKey !== lastBoom.current.key) lastBoom.current = { key: boomKey, at: performance.now() };
  // Where the bomb was when it went off: its spot before the turn moved on.
  const goneFrom = useRef(new Vector3());
  const goneAt = useRef(-9999);
  const origin = useRef((): Vector3 | null => {
    if (performance.now() - goneAt.current < 800) return goneFrom.current;
    const f = flight.current;
    return f.t < 1 ? f.from : (group.current?.position ?? null);
  });
  const target = useMemo(() => {
    if (speaker === null) return null;
    const p = seatPosition(speaker, n);
    return new Vector3(p.x, 1.1 * SHEEP_SCALE + 0.45, p.z);
  }, [speaker, n]);
  useEffect(() => {
    if (!target || !group.current) return;
    const f = flight.current;
    const justExploded = performance.now() - lastBoom.current.at < 600;
    if (justExploded) { goneFrom.current.copy(group.current.position); goneAt.current = performance.now(); }
    if (!f.started || reduced || justExploded) {
      group.current.position.copy(target);
      f.started = true;
      f.t = 1;
    } else {
      f.from.copy(group.current.position);
      f.t = 0;
    }
    f.to.copy(target);
  }, [target, reduced]);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g || !target) return;
    const f = flight.current;
    const now = clock.elapsedTime;
    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / 0.5);
      const e = easeInOut(f.t);
      g.position.lerpVectors(f.from, f.to, e);
      g.position.y += Math.sin(Math.PI * e) * 1.1;
      g.rotation.z = Math.sin(Math.PI * e) * 0.6;
    } else {
      g.position.copy(f.to);
      g.position.y += reduced ? 0 : Math.sin(now * 3) * 0.04;
      g.rotation.z = red && !reduced ? Math.sin(now * 40) * 0.08 : 0;
    }
    body.color.set(red ? '#ff8a78' : '#ffffff');
    if (fuse.current) fuse.current.scale.y = Math.max(0.02, Math.min(1, fraction));
    if (spark.current) {
      spark.current.position.y = BOMB_FUSE_LENGTH * Math.max(0.02, Math.min(1, fraction));
      spark.current.visible = reduced || Math.sin(now * 30) > -0.5;
    }
  });
  if (!target) return null;
  return (
    <>
    <Blast boomKey={boomKey} origin={origin.current} reduced={reduced} />
    <group ref={group} scale={1.5} visible>
      <mesh geometry={m.body} material={body} castShadow />
      <group ref={fuse} position={[0, BOMB_NECK_Y, 0]}>
        <mesh geometry={m.fuse} material={fuseMat} />
        <mesh ref={spark} geometry={m.spark} material={sparkMat} />
      </group>
    </group>
    </>
  );
}

function WolfEyes() {
  const geo = useMemo(() => wolfEyes(), []);
  const mat = useMemo(() => voxelMaterial({ emissive: '#FFE066', emissiveIntensity: 1 }), []);
  return <mesh geometry={geo} material={mat} position={[BARN.minX + 0.15, 1.2, BARN.sideDoor.z]} rotation={[0, Math.PI / 2, 0]} />;
}

function Cat({ geo, reduced, frozen, mat }: { geo: { body: BufferGeometry; tail: BufferGeometry; tailPivot: [number, number, number] }; reduced: boolean; frozen: boolean; mat: MeshLambertMaterial }) {
  const body = useRef<Mesh>(null);
  const tail = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (reduced || frozen) return;
    const t = clock.elapsedTime;
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 1.4) * 0.02;
    if (tail.current) tail.current.rotation.z = Math.sin(t * 0.8) * 0.15;
  });
  return (
    <group position={CAT_SPOT}>
      <mesh ref={body} geometry={geo.body} material={mat} castShadow />
      <mesh ref={tail} geometry={geo.tail} material={mat} position={geo.tailPivot} castShadow />
    </group>
  );
}

function Robin({ geo, reduced, mat }: { geo: BufferGeometry; reduced: boolean; mat: MeshLambertMaterial }) {
  const r = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!r.current || reduced) return;
    const t = clock.elapsedTime % 12;
    r.current.position.y = ROBIN_SPOT[1] + (t < 0.4 ? Math.sin((t / 0.4) * Math.PI) * 0.12 : 0);
    r.current.position.x = ROBIN_SPOT[0] + (t < 0.4 ? t * 0.4 : 0.16) * (Math.floor(Date.now() / 12000) % 2 ? 1 : -1);
  });
  return <mesh ref={r} geometry={geo} material={mat} position={ROBIN_SPOT} castShadow />;
}

/** Tufts, the wolf run, the shears and the gust, each a short one-shot from its key. */
function Moments({ moments, n, reduced }: { moments: BarnMoments; n: number; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const tuft = useMemo(() => tuftGeometry(3), []);
  const wolf = useMemo(() => wolfModel(), []);
  const shears = useMemo(() => shearsModel(), []);
  const at = useRef<Record<string, { key: number; t0: number }>>({});
  const refs = useRef<Record<string, Group | null>>({});
  const set = (k: string) => (g: Group | null) => { refs.current[k] = g; };
  const seat = (i: number) => { const p = seatPosition(i, n); return [p.x, 0, p.z] as const; };
  const pileTop = [HEAP[0], PLATFORM_HEIGHT + 0.3, HEAP[2]] as const;

  useFrame(() => {
    const now = performance.now() / 1000;
    const run = (name: keyof BarnMoments, len: number, fn: (e: number, g: Group) => void) => {
      const m = moments[name];
      const g = refs.current[name];
      if (!g) return;
      if (!m) { g.visible = false; return; }
      if (at.current[name]?.key !== m.key) at.current[name] = { key: m.key, t0: now };
      const e = now - at.current[name].t0;
      g.visible = e < len && !(reduced && name === 'wolf');
      if (g.visible) fn(e, g);
    };
    const arc = (g: Group, a: readonly number[], b: readonly number[], p: number, h: number) =>
      g.position.set(a[0] + (b[0] - a[0]) * p, 0.9 + Math.sin(p * Math.PI) * h + (a[1] + (b[1] - a[1]) * p), a[2] + (b[2] - a[2]) * p);
    run('tuftIn', 0.8, (e, g) => arc(g, seat(moments.tuftIn!.from), pileTop, Math.min(1, e / 0.8), 1.2));
    run('tuftOut', 1.1, (e, g) => arc(g, pileTop, seat(moments.tuftOut!.to), Math.min(1, e / 1.1), 1.6));
    run('gust', 0.9, (e, g) => arc(g, seat(moments.gust!.at), [0, 1.2, BARN.maxZ + 2], Math.min(1, e / 0.9), 0.6));
    run('wolf', 1.3, (e, g) => {
      const door = [BARN.minX - 0.5, 0, BARN.sideDoor.z] as const;
      const to = seat(moments.wolf!.to);
      const pts = [door, HEAP, to, door];
      const p = Math.min(0.999, e / 1.3) * 3;
      const i = Math.floor(p), f = p - i;
      const a = pts[i], b = pts[i + 1];
      g.position.set(a[0] + (b[0] - a[0]) * f, Math.abs(Math.sin(p * Math.PI * 2)) * 0.12, a[2] + (b[2] - a[2]) * f);
      g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
    });
    run('shears', 0.9, (e, g) => {
      const s = seat(moments.shears!.at);
      g.position.set(s[0], 2.2 - Math.min(1, e / 0.35) * 1.0, s[2]);
      const blades = g.children;
      const snip = Math.abs(Math.sin(e * 18)) * 0.5;
      if (blades[0]) blades[0].rotation.y = snip;
      if (blades[1]) blades[1].rotation.y = -snip;
    });
  });

  return (
    <>
      <group ref={set('tuftIn')} visible={false}><mesh geometry={tuft} material={mat} /></group>
      <group ref={set('tuftOut')} visible={false}>
        {[0, 1, 2].map((i) => <mesh key={i} geometry={tuft} material={mat} position={[i * 0.12 - 0.12, i * 0.05, 0]} />)}
      </group>
      <group ref={set('gust')} visible={false}><mesh geometry={tuft} material={mat} /></group>
      <group ref={set('wolf')} visible={false} scale={1.4}>
        {[wolf.body, wolf.head, wolf.tail, wolf.eyes, ...wolf.legs].map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} castShadow />)}
        <mesh geometry={tuft} material={mat} position={[0, 0.75, 0.45]} scale={2.2} />
      </group>
      <group ref={set('shears')} visible={false} scale={1.4}>
        <mesh geometry={shears.bladeA.geo} position={shears.bladeA.pivot} material={mat} />
        <mesh geometry={shears.bladeB.geo} position={shears.bladeB.pivot} material={mat} />
      </group>
    </>
  );
}
