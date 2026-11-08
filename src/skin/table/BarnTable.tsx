import { Bomb } from './Bomb';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ACESFilmicToneMapping, BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, PCFSoftShadowMap, PointLight, SpotLight, SRGBColorSpace, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { BufferGeometry } from 'three';
import type { Hour } from '../model/types';
import { buildBarn, CAT_SPOT, ROBIN_SPOT } from '../scene/barn';
import { buildDistance } from '../scene/distance';
import { buildFestive } from '../scene/festive';
import { BARN, CAMERA, HEAP, homeShot, SEAT_RING, SHEEP_SCALE, SPEAKER_CAMERA, seatPosition, speakerShot } from '../scene/layout';
import type { Shot } from '../scene/layout';
import { ChimneySmoke, Sky, Windmill } from '../scene/Sky';
import { buildYard } from '../scene/yard';
import { tuftGeometry } from '../voxel/characters';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { BOARD, boardFontReady, letterBoardGeometry, pileGeometry, pileWidth, PLATFORM_HEIGHT, platformGeometry } from '../voxel/table';
import { DevStats } from './DevStats';
import { LetterClock, ProjectAnchor, ScreenAnchor, SlipLayer, useSlipRefs } from './LetterClock';
import { plankY, stakeGeometry } from '../voxel/props';
import { Festive } from './Festive';
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
  /** Any time-out: the bomb goes off over that sheep. */
  boom?: { key: number; at: number; power?: number };
  /** Time out: a cold gust blows a tuft off the sheep and out of the back door. */
  gust?: { key: number; at: number };
  /** Last life lost: lantern flames dim to 40% for the freeze, and the camera stays on the frozen sheep. */
  freeze?: { key: number; at: number };
}

interface Props {
  /** How swollen the bomb is, 1 and up: it grows with every word and resets when it goes off. */
  bombSize?: number;
  seats: BarnSeat[];
  pile: number;
  /** Seat index (as in BarnSeat.index) whose turn it is: that sheep steps toward the pile. */
  speaker: number | null;
  /** 0..1 of the turn left (the icicle's length). */
  fraction: number;
  /** Seconds left on the clock, chalked on the slate under the letter board. */
  secondsLeft: number | null;
  letter: string;
  isTrap: boolean;
  hour: Hour;
  reduced: boolean;
  phone: boolean;
  blizzard: boolean;
  moments: BarnMoments;
  /** Extra 3D content for a mode's place (pen lanterns, the sheepdog). */
  children?: ReactNode;
}

export type { Props as BarnTableProps };

/** World-static voxel content, built once per page and shared by the table and the Home backdrop. */
export type World = ReturnType<typeof buildWorld>;
let world: World | null = null;
function buildWorld() {
  const t0 = performance.now();
  const barn = buildBarn();
  const yard = buildYard();
  const distance = buildDistance();
  const festive = buildFestive();
  const ms = performance.now() - t0;
  return { barn, yard, distance, festive, ms };
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
export function Farm({ world: w, reduced }: { world: World; reduced: boolean }) {
  const { barn, yard, distance, festive } = w;
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
      <Cat geo={barn.cat} reduced={reduced} mat={voxMat} />
      <Robin geo={barn.robin} reduced={reduced} mat={voxMat} />
      {yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      <mesh geometry={yard.snowman} material={voxMat} castShadow receiveShadow />
      <ChimneySmoke from={yard.smokeFrom} />
      <mesh geometry={distance.hills} material={voxMat} receiveShadow />
      <mesh geometry={distance.backHills} material={voxMat} receiveShadow />
      <mesh geometry={distance.mountains} material={voxMat} />
      <Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />
      <Festive geo={festive} reduced={reduced} />
    </>
  );
}

export function BarnTable(props: Props) {
  const cam = props.phone ? CAMERA.phone : CAMERA.desktop;
  const w = useWorld();
  const clockEl = useRef<HTMLDivElement>(null);
  const slipRef = useSlipRefs();
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
  const { letter, isTrap, secondsLeft } = props;
  return (
    <div className="relative size-full">
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        dpr={props.phone ? [1, 1.5] : [1, 2]}
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
        camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
        onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
      >
        <Scene {...props} world={w} anchors={{ clock: clockEl, fade: fadeEl, slip: slipRef }} />
      </Canvas>
      {/* Reduced motion: the camera cuts between speakers behind a 150 ms fade. */}
      <div ref={fadeEl} className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'var(--ink)', opacity: 0 }} aria-hidden="true" />
      <SlipLayer seats={props.seats} refFor={slipRef} />
      {/* The seconds on a mini slate hung under the carved board (V6 Part 5.2), anchored to it every frame. */}
      <div ref={clockEl} className="pointer-events-none absolute left-0 top-0 z-[25]" style={{ transform: 'translate3d(-9999px,0,0)', willChange: 'transform' }}>
        <LetterClock letter={letter} isTrap={isTrap} secondsLeft={secondsLeft} pop={pop} />
      </div>
    </div>
  );
}

type Anchors = { clock: React.RefObject<HTMLDivElement | null>; fade: React.RefObject<HTMLDivElement | null>; slip: (seat: number) => React.RefObject<HTMLDivElement | null> };

export function Building() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="sk-paper sk-display px-4 py-2 text-lg">Raising the barn…</div>
    </div>
  );
}

function Scene({ bombSize, seats, pile, speaker, fraction, secondsLeft, letter, isTrap, hour, reduced, phone, blizzard, moments, children, world: w, anchors }: Props & { world: World; anchors: Anchors }) {
  const lamps = useRef<(PointLight | null)[]>([]);
  const n = seats.length;
  const stake = useMemo(() => stakeGeometry(), []);
  const stakeMat = useMemo(() => voxelMaterial(), []);

  // The freeze dims the lanterns to 40% for 2.4 s.
  const freezeAt = useRef(-10);
  const freezeKey = moments.freeze?.key;
  useEffect(() => { if (freezeKey !== undefined) freezeAt.current = performance.now() / 1000; }, [freezeKey]);
  useFrame(({ clock }) => {
    const dim = performance.now() / 1000 - freezeAt.current < 2.4 ? 0.4 : 1;
    const flicker = reduced ? 1 : 1 + Math.sin(clock.elapsedTime * 7.3) * 0.05;
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
      <SpeakerCamera speaker={speaker} n={n} phone={phone} reduced={reduced} moments={moments} fade={anchors.fade} headY={speakerHeadY} />
      <Atmosphere hour={hour} />
      <Lights hour={hour} phone={phone} viewYaw={0} lampRef={(i, l) => { lamps.current[i] = l; }} />
      <Sky hour={hour} reduced={reduced} blizzard={blizzard} />
      <Farm world={w} reduced={reduced} />
      <Pile pile={pile} pulseKey={moments.tuftIn?.key} reduced={reduced} />
      <LetterBoard letter={letter} isTrap={isTrap} reduced={reduced} />
      <ProjectAnchor el={anchors.clock} at={[HEAP[0], BOARD.bottom - 0.02, 1.0]} board={[HEAP[0], BOARD.bottom + BOARD.height / 2, 1.0]} margin={phone ? 140 : 120} />
      <Bomb speaker={speaker} n={n} fraction={fraction} red={false} reduced={reduced} boomKey={moments.boom?.key} secondsLeft={secondsLeft} size={bombSize ?? 1} power={moments.boom?.power ?? 1} />
      {seats.map((s) => {
        return (
          <SeatGroup key={s.seat} index={s.index} n={n} active={s.index === speaker} reduced={reduced} drawScale={s.avatar === ADMIN_AVATAR_ID ? 1 : animalModel(byId(s.avatar)?.animal ?? 'sheep').drawScale}>
            {s.avatar === ADMIN_AVATAR_ID ? (
              <AvatarDisc state={s.thinking && s.state === 'idle' ? 'thinking' : s.state} stateKey={s.stateKey} dimmed={s.dimmed} reduced={reduced} speaking={s.index === speaker} />
            ) : (
              <Sheep level={s.level} state={s.state} stateKey={s.stateKey} coldFor={s.coldFor} dimmed={s.dimmed} reduced={reduced} scarf={s.scarf}
                gustFrom={[0, 0.8, -6]} lookAt={s.index === speaker ? 'camera' : speakerHead} speaking={s.index === speaker} thinking={s.thinking}
                model={byId(s.avatar) ? animalModel(byId(s.avatar)!.animal) : undefined} />
            )}
          </SeatGroup>
        );
      })}
      {/* A name stake planted in the hay beside each seat (V6 Part 5.3), its plank turned to the room, the slips pinned to it. */}
      {seats.map((s) => {
        const p = seatPosition(s.index, n);
        return (
          <group key={`stake-${s.seat}`} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]}>
            <group position={[(p.x >= 0 ? 0.95 : -0.95) * SHEEP_SCALE, 0, 0]} rotation={[0, -p.yaw, 0]}>
              <mesh geometry={stake} material={stakeMat} castShadow receiveShadow />
              <ScreenAnchor el={anchors.slip(s.seat)} position={[0, plankY(), -0.12]} />
            </group>
          </group>
        );
      })}
      <Moments moments={moments} n={n} />
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
 * one 650 ms ease-in-out swing round the pile, then holds with a 0.05 m drift. A freeze is watched to the end.
 * Reduced motion cuts behind a 150 ms fade.
 */
function SpeakerCamera({ speaker, n, phone, reduced, moments, fade, headY }: { speaker: number | null; n: number; phone: boolean; reduced: boolean; moments: BarnMoments; fade: Anchors['fade']; headY: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const st = useMemo(() => ({
    key: '', at: -10, from: null as Shot | null, to: null as Shot | null, cur: null as Shot | null,
    freezeKey: undefined as number | undefined, freezeAt: -10, freezeSeat: 0,
  }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moments.freeze && moments.freeze.key !== st.freezeKey) { st.freezeKey = moments.freeze.key; st.freezeAt = t; st.freezeSeat = moments.freeze.at; }
    let seat: number | null = speaker;
    if (t - st.freezeAt < 2.4) seat = st.freezeSeat;
    // The gaps between turns are seen from the wide home shot; every turn zooms on its speaker.
    const home = seat === null;
    const key = home ? `home/${phone}` : `${seat}/${n}/${phone}/${headY.toFixed(2)}`;
    if (key !== st.key) {
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
 * swinging a little with the wind, with the seconds on a slate just under it (V6 Part 5.2). `beamY` sets how long its
 * ropes are and `hook` where they hang from (the practice duel hangs it from a signpost on the ice).
 */
export function LetterBoard({ letter, isTrap, reduced, beamY = BARN.beamY, hook = [HEAP[0], BARN.beamY - 0.15, 1.0] }: {
  letter: string; isTrap: boolean; reduced: boolean; beamY?: number; hook?: readonly [number, number, number];
}) {
  // The letter is cut in the title's face; until that has loaded the board uses the bitmap font, then rebuilds.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => { let live = true; void boardFontReady().then(() => live && setFontReady(true)); return () => { live = false; }; }, []);
  const geo = useMemo(() => letterBoardGeometry(letter, isTrap, beamY), [letter, isTrap, beamY, fontReady]);
  // A little warmth of its own, so the board still reads when the speaker camera sees its unlit side of the room.
  const boardMat = useMemo(() => voxelMaterial({ emissive: '#3A2A1C', emissiveIntensity: 1 }), []);
  const iceGeo = useMemo(() => new BoxGeometry(BOARD.width, BOARD.height, 0.24), []);
  const iceMat = useMemo(() => new MeshPhongMaterial({ color: T.ice[1], transparent: true, opacity: 0.5, shininess: 80, depthWrite: false }), []);
  const g = useRef<Group>(null);
  // The board hangs from one hook, so it turns to face the camera wherever the speaker camera stands.
  useFrame(({ clock, camera }, dt) => {
    if (!g.current) return;
    g.current.rotation.z = reduced ? 0 : (Math.sin(clock.elapsedTime * 0.7) * 1.5 * Math.PI) / 180;
    const want = Math.atan2(-(camera.position.x - hook[0]), -(camera.position.z - hook[2]));
    const d = Math.atan2(Math.sin(want - g.current.rotation.y), Math.cos(want - g.current.rotation.y));
    g.current.rotation.y += d * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  });
  const boardMid = BOARD.bottom + BOARD.height / 2 - (beamY - 0.15);
  return (
    <group ref={g} position={[hook[0], hook[1], hook[2]]}>
      <mesh geometry={geo} material={boardMat} castShadow />
      {isTrap && <mesh geometry={iceGeo} material={iceMat} position={[0, boardMid, 0]} />}
    </group>
  );
}

function Cat({ geo, reduced, mat }: { geo: { body: BufferGeometry; tail: BufferGeometry; tailPivot: [number, number, number] }; reduced: boolean; mat: MeshLambertMaterial }) {
  const body = useRef<Mesh>(null);
  const tail = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (reduced) return;
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

/** Tufts and the gust, each a short one-shot from its key. */
function Moments({ moments, n }: { moments: BarnMoments; n: number }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const tuft = useMemo(() => tuftGeometry(3), []);
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
      g.visible = e < len;
      if (g.visible) fn(e, g);
    };
    const arc = (g: Group, a: readonly number[], b: readonly number[], p: number, h: number) =>
      g.position.set(a[0] + (b[0] - a[0]) * p, 0.9 + Math.sin(p * Math.PI) * h + (a[1] + (b[1] - a[1]) * p), a[2] + (b[2] - a[2]) * p);
    run('tuftIn', 0.8, (e, g) => arc(g, seat(moments.tuftIn!.from), pileTop, Math.min(1, e / 0.8), 1.2));
    run('tuftOut', 1.1, (e, g) => arc(g, pileTop, seat(moments.tuftOut!.to), Math.min(1, e / 1.1), 1.6));
    run('gust', 0.9, (e, g) => arc(g, seat(moments.gust!.at), [0, 1.2, BARN.maxZ + 2], Math.min(1, e / 0.9), 0.6));
  });

  return (
    <>
      <group ref={set('tuftIn')} visible={false}><mesh geometry={tuft} material={mat} /></group>
      <group ref={set('tuftOut')} visible={false}>
        {[0, 1, 2].map((i) => <mesh key={i} geometry={tuft} material={mat} position={[i * 0.12 - 0.12, i * 0.05, 0]} />)}
      </group>
      <group ref={set('gust')} visible={false}><mesh geometry={tuft} material={mat} /></group>
    </>
  );
}
