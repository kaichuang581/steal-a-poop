import { FESTIVE } from '../../config';
import { Bomb } from './Bomb';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, MeshPhongMaterial, Object3D, PCFShadowMap, PointLight, SpotLight, SRGBColorSpace, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { BufferGeometry } from 'three';
import type { Hour } from '../model/types';
import { buildBarnSteps, CAT_SPOT, ROBIN_SPOT } from '../scene/barn';
import type { Barn } from '../scene/barn';
import { buildDistanceSteps } from '../scene/distance';
import type { Distance } from '../scene/distance';
import { buildFestive } from '../scene/festive';
import { BARN, boardHang, CAMERA, HEAP, homeShot, SEAT_RING, SHEEP_SCALE, SPEAKER_CAMERA, seatPosition, speakerShot, swoopCrop } from '../scene/layout';
import type { SpeakerBody } from '../scene/layout';
import type { Shot } from '../scene/layout';
import { ChimneySmoke, Sky, Windmill } from '../scene/Sky';
import { buildYardSteps } from '../scene/yard';
import type { Yard } from '../scene/yard';
import { dropBuild, queueBuild } from '../scene/slices';
import { coarseDevice, coarseFor, inDetail } from '../voxel/refine';
import { getTier, subscribeTier } from '../perf/tier';
import type { Steps } from '../scene/slices';
import { bonkStar } from '../dream/bonk';
import { tuftGeometry } from '../voxel/characters';
import { voxelMaterial } from '../voxel/material';
import { T } from '../voxel/palette';
import { BOARD, boardFontReady, letterBoardGeometry, pileGeometry, pileWidth, PLATFORM_HEIGHT, platformGeometry } from '../voxel/table';
import { DevStats } from './DevStats';
import { ScreenAnchor, SlipLayer, useSlipRefs } from './Anchors';
import { Festive } from './Festive';
import { AdaptiveCanvas, Atmosphere, Effects, holdDpr, LANTERN_LIGHT, lanternIntensity, Lights, MarkDrawn } from './Rendering';
import { SceneBoundary } from '../perf/SceneBoundary';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { isTallPhoto } from '../avatars/photos';
import { byId } from '../avatars/catalog';
import { animalModel, heightRatio } from '../voxel/animals';
import { anchorsOf } from '../voxel/animals/anchors';
import { getKaiyanLook, pictureHeight, useLooksVersion } from '../avatars/kaiyanLook';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';
import { LOOK } from '../look';

export interface BarnSeat {
  seat: number;
  index: number;
  level: WoolLevel;
  state: SheepState;
  stateKey: number;
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
  /**
   * The beat after a bomb has gone off, when nobody has the floor: `dazed` is the seat it went off beside (the camera
   * stays on it, stars circle its head, everyone looks at it), then `upNext` is the seat whose fuse is about to be
   * lit (the camera swings there, so it has arrived when the turn starts).
   */
  dazed?: number | null;
  upNext?: number | null;
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
  /** How many pictures a second the table is drawn at (the frame governor): 0 once the podium covers it whole. */
  fps?: number;
}

export type { Props as BarnTableProps };

/** World-static voxel content, built once per page and shared by the table and the Home backdrop. */
export interface World {
  barn: Barn; yard: Yard; distance: Distance; festive: ReturnType<typeof buildFestive>;
  /** Built at the touch detail (voxel/refine.ts): Medium and Low on every device, and every tier on a touch screen. */
  coarse: boolean;
  /** From the start of the build to its end, in ms, the page's turns in between included. */
  ms: number;
}
/** The world on screen. */
let world: World | null = null;
// The world is built once a page and held here. A hot update on a development server runs this file again with no
// world and lets the screen keep waiting for the old one: only the sky showed, the tour dipping over it (Brian,
// 2026-11-20: "the transition is transitioning from a white screen to a white screen"). Reload the page instead.
if (import.meta.hot) import.meta.hot.on('vite:beforeUpdate', ({ updates }) => { if (updates.some((u) => u.type === 'js-update')) location.reload(); });
/**
 * The world at the desktop's detail, built in the background slices while the session is not on High (plan file 17,
 * change 15): shown from the next dip or scene change once the tier is High, never part-built.
 */
let fineWorld: World | null = null;
let fineSteps: Steps<World> | null = null;
/** Built at the detail it is told (run it under `inDetail`). */
function* buildWorldSteps(coarse: boolean): Steps<World> {
  const t0 = performance.now();
  const barn = yield* buildBarnSteps();
  const yard = yield* buildYardSteps();
  const distance = yield* buildDistanceSteps();
  const festive = buildFestive();
  return { barn, yard, distance, festive, coarse, ms: performance.now() - t0 };
}

/** Who is waiting for the world, and whether its build has been started. */
const waiting = new Set<(w: World) => void>();
/** Every mounted `useWorld`, told when the desktop's detail takes over. */
const holders = new Set<(w: World) => void>();
let started = false;

/** Every geometry an object holds, however deep (a world or a farm). */
export function geometriesOf(o: unknown, out = new Set<BufferGeometry>(), seen = new Set<object>()): Set<BufferGeometry> {
  if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || seen.has(o)) return out;
  seen.add(o);
  if ((o as BufferGeometry).isBufferGeometry) { out.add(o as BufferGeometry); return out; }
  for (const v of Object.values(o)) geometriesOf(v, out, seen);
  return out;
}
/** Frees the graphics memory of what `old` had that `kept` does not, once the screen has let go of it. */
export function retire(old: unknown, kept: unknown): void {
  const keep = geometriesOf(kept);
  const gone = [...geometriesOf(old)].filter((g) => !keep.has(g));
  setTimeout(() => { for (const g of gone) g.dispose(); }, 1000);
}

/**
 * Starts the desktop's detail of the world in the background slices, if this device has one and the world on screen
 * is not it. Called when the tier becomes High, and early (after Home's opening shot is whole) on a device that
 * earned High last time (`sap:gfx`).
 */
export function startFineWorld(): void {
  if (!world || !world.coarse || fineWorld || fineSteps || coarseDevice() || getTier() === 'low') return;
  fineSteps = inDetail(false, buildWorldSteps(false));
  queueBuild(fineSteps, (w) => { fineSteps = null; fineWorld = w; }, { around: holdDpr });
}
/** Whether the world at the desktop's detail is on screen or ready to be. */
export const fineWorldReady = (): boolean => !!fineWorld || (!!world && !world.coarse);
/**
 * Puts the desktop's detail on screen if the tier is High and it is built. Only in a dip or at a scene change: the
 * tier itself only changes there, and Home and the screens that mount the world call it only there.
 */
export function promoteWorld(): boolean {
  if (!fineWorld || getTier() !== 'high') return false;
  const old = world, w = fineWorld;
  fineWorld = null;
  world = w;
  for (const f of holders) f(w);
  if (old) retire(old, w);
  return true;
}

subscribeTier(() => {
  const t = getTier();
  if (t === 'high') startFineWorld();
  if (t === 'low') {
    // Low never goes back up this session: what was built ahead for High is let go.
    if (fineSteps) dropBuild(fineSteps);
    fineSteps = null;
    if (fineWorld) retire(fineWorld, world);
    fineWorld = null;
  }
});

/**
 * The world, built after paint in slices (scene/slices.ts), so the page is never frozen while it builds. The build is
 * the page's, not the screen's: once started it runs to its end, whoever is still waiting for it. It is built at the
 * session's tier's detail (Medium, the touch detail, unless `?gfx=high`); a screen mounting is a scene change, so the
 * desktop's detail, once earned and built, is taken up there.
 */
export function useWorld(): World | null {
  const [w, setW] = useState(world);
  useLayoutEffect(() => {
    holders.add(setW);
    promoteWorld();
    if (world) { setW(world); return () => { holders.delete(setW); }; }
    waiting.add(setW);
    if (!started) {
      started = true;
      const coarse = coarseFor(getTier());
      queueBuild(inDetail(coarse, buildWorldSteps(coarse)), (built) => {
        world = built;
        for (const f of waiting) f(built);
        waiting.clear();
        if (getTier() === 'high') startFineWorld();
      }, { around: holdDpr });
    }
    return () => { waiting.delete(setW); holders.delete(setW); };
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
  // The hills and the range lose every tie with what stands on or against them (voxel/material.ts, `layer`).
  const farMat = useMemo(() => voxelMaterial({ layer: 2 }), []);
  // Bright enough to pass the bloom threshold, so only the lanterns glow.
  const glowMat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 2.2, homeGlow: true }), []);
  // The farmhouse's windows, lit from inside: warm by day, the brightest thing in the yard at night.
  const paneMat = useMemo(() => voxelMaterial({ emissive: '#FFB84A', emissiveIntensity: 0.85, homeGlow: true }), []);
  return (
    <>
      {barn.static.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow receiveShadow />)}
      {barn.doorLeaves.map((d, i) => <mesh key={i} geometry={d.geo} material={voxMat} position={d.hinge} rotation={[0, d.openYaw, 0]} castShadow receiveShadow />)}
      <mesh geometry={barn.lanterns} material={glowMat} />
      <mesh geometry={barn.tarp} material={voxMat} />
      <mesh geometry={barn.front} material={voxMat} receiveShadow />
      <Cat geo={barn.cat} reduced={reduced} mat={voxMat} />
      <Robin geo={barn.robin} reduced={reduced} mat={voxMat} />
      {/* A flat piece of ground cannot cast a shadow (see `castsShadow` in scene/yard.ts), so it is not asked to. */}
      {yard.chunks.map((g, i) => <mesh key={i} geometry={g} material={voxMat} castShadow={yard.casts[i]} receiveShadow />)}
      <mesh geometry={yard.snowman} material={voxMat} castShadow receiveShadow />
      <mesh geometry={yard.panes} material={paneMat} />
      <ChimneySmoke from={yard.smokeFrom} />
      <mesh geometry={distance.hills} material={farMat} receiveShadow />
      <mesh geometry={distance.backHills} material={farMat} receiveShadow />
      <mesh geometry={distance.mountains} material={farMat} />
      <Windmill body={distance.windmillBody} blades={distance.windmillBlades} hub={distance.bladesHub} />
      {FESTIVE && <Festive geo={festive} reduced={reduced} />}
    </>
  );
}

export function BarnTable(props: Props) {
  const cam = props.phone ? CAMERA.phone : CAMERA.desktop;
  const w = useWorld();
  const slipRef = useSlipRefs();
  const fadeEl = useRef<HTMLDivElement>(null);
  // Whether the game swooped in is settled when the table comes up: changing the motion setting mid-game must not reframe it.
  const [swooped] = useState(!props.reduced);
  if (!w) return <Building />;
  return (
    <div className="relative size-full">
      <SceneBoundary scene="the table">
      <AdaptiveCanvas maxDpr={props.phone ? 1.5 : 2} memory="table" fps={props.fps}
        shadows={{ type: PCFShadowMap }}
       
        gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: false /* the composer has its own 4x MSAA target */ }}
        camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
        onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
      >
        <MarkDrawn />
        <SwoopCrop ran={swooped} />
        <Scene {...props} world={w} anchors={{ fade: fadeEl, slip: slipRef }} />
      </AdaptiveCanvas>
      </SceneBoundary>
      {/* Reduced motion: the camera cuts between speakers behind a 150 ms fade. */}
      <div ref={fadeEl} className="pointer-events-none absolute inset-0 z-[4]" style={{ background: 'var(--ink)', opacity: 0 }} aria-hidden="true" />
      <SlipLayer seats={props.seats} refFor={slipRef} />
    </div>
  );
}

type Anchors = { fade: React.RefObject<HTMLDivElement | null>; slip: (seat: number) => React.RefObject<HTMLDivElement | null> };

/**
 * Keeps the table's picture as it was while its canvas was measured too big (see `SWOOP_CROP` in scene/layout.ts): the
 * camera's view is offset to the same top-left part of each shot, again at every new canvas size. The name plates are
 * placed through this camera (`ScreenAnchor`), so they stay over their heads. The ice and the pen never had the fault.
 */
function SwoopCrop({ ran }: { ran: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    swoopCrop(camera, size.width, size.height, ran);
    return () => camera.clearViewOffset();
  }, [camera, size.width, size.height, ran]);
  return null;
}

export function Building() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="sk-paper sk-display px-4 py-2 text-lg">Raising the barn…</div>
    </div>
  );
}

function Scene({ bombSize, seats, pile, speaker, dazed = null, upNext = null, fraction, secondsLeft, letter, isTrap, hour, reduced, phone, blizzard, moments, children, world: w, anchors }: Props & { world: World; anchors: Anchors }) {
  // Who the table is turned to: the speaker, or in the beat after a bomb the dazed sheep and then the one up next.
  const focus = speaker ?? dazed ?? upNext;
  useLooksVersion(); // the admin avatars' name plates follow the forehead's length
  const lamps = useRef<(PointLight | null)[]>([]);
  const n = seats.length;

  // The freeze dims the lanterns to 40% for 2.4 s.
  const freezeAt = useRef(-10);
  const freezeKey = moments.freeze?.key;
  useEffect(() => { if (freezeKey !== undefined) freezeAt.current = performance.now() / 1000; }, [freezeKey]);
  useFrame(({ clock }) => {
    const dim = performance.now() / 1000 - freezeAt.current < 2.4 ? 0.4 : 1;
    const flicker = reduced ? 1 : 1 + Math.sin(clock.elapsedTime * 7.3) * 0.05;
    for (const l of lamps.current) if (l) l.intensity = lanternIntensity(hour) * dim * flicker;
  });

  // The camera aims at the speaker's head, wherever the animal it wears carries it (a hen low, a horse high).
  const speakerHeadY = useMemo(() => {
    const a = seats.find((s) => s.index === focus)?.avatar;
    const c = byId(a);
    return SPEAKER_CAMERA.headY * (c ? heightRatio(c.animal) : 1);
  }, [seats, focus]);

  // The letter board hangs where this turn's shot sees all of it, clear of the speaker and its plate (`boardHang`).
  const hang = useMemo(() => boardHang(focus, n, phone, speakerBody(seats.find((s) => s.index === focus)?.avatar)), [focus, n, phone, seats]);

  // Attention (plan V3.3 Part 3.3): every sheep looks at the speaker's head; the speaker looks at the camera.
  const speakerHead = useMemo((): [number, number, number] | undefined => {
    if (focus === null) return undefined;
    const p = seatPosition(focus, n);
    const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
    return [p.x + (dx / len) * 0.35, 0.85 * SHEEP_SCALE, p.z + (dz / len) * 0.35];
  }, [focus, n]);

  return (
    <>
      <SpeakerCamera speaker={focus} n={n} phone={phone} reduced={reduced} moments={moments} fade={anchors.fade} headY={speakerHeadY} />
      <Atmosphere hour={hour} />
      <Lights hour={hour} phone={phone} viewYaw={0} lampRef={(i, l) => { lamps.current[i] = l; }} />
      <Sky hour={hour} reduced={reduced} blizzard={blizzard} />
      <Farm world={w} reduced={reduced} />
      <Pile world={w} pile={pile} pulseKey={moments.tuftIn?.key} reduced={reduced} />
      <LetterBoard letter={letter} isTrap={isTrap} reduced={reduced} beamY={BARN.beamY + hang.drop} hook={hang.at} />
      <Bomb speaker={speaker} n={n} phone={phone} fraction={fraction} red={false} reduced={reduced} boomKey={moments.boom?.key} secondsLeft={secondsLeft} size={bombSize ?? 1} power={moments.boom?.power ?? 1} />
      {seats.map((s) => {
        return (
          <SeatGroup key={s.seat} index={s.index} n={n} active={s.index === focus || s.index === dazed} reduced={reduced} drawScale={isAdminAvatar(s.avatar) ? 1 : animalModel(byId(s.avatar)?.animal ?? 'sheep').drawScale}>
            {isAdminAvatar(s.avatar) ? (
              <AvatarDisc state={s.thinking && s.state === 'idle' ? 'thinking' : s.state} stateKey={s.stateKey} dimmed={s.dimmed} reduced={reduced} speaking={s.index === speaker} avatar={s.avatar} />
            ) : (
              <Sheep level={s.level} state={s.state} stateKey={s.stateKey} dimmed={s.dimmed} reduced={reduced} scarf={s.scarf}
                gustFrom={[0, 0.8, -6]} lookAt={s.index === focus ? 'camera' : speakerHead} speaking={s.index === speaker} thinking={s.thinking}
                model={byId(s.avatar) ? animalModel(byId(s.avatar)!.animal) : undefined} />
            )}
            {/* The name plate (and the speaker's speech bubble) stands over the head, so it follows the step and the scale. */}
            <ScreenAnchor el={anchors.slip(s.seat)} position={platePoint(s.avatar)} above />
            {!reduced && <DazeStars on={s.index === dazed} at={platePoint(s.avatar)} scale={seatScale(s.avatar)} />}
          </SeatGroup>
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
 * one 650 ms ease-in-out swing round the pile, then holds with a 0.05 m drift. A freeze is watched to the end. In the
 * beat after a bomb has gone off `speaker` is the dazed sheep and then the one up next (see Props), so the bang is
 * watched where it happened and the camera has arrived when the next fuse is lit. Reduced motion cuts behind a 150 ms fade.
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

/**
 * The stars round a dazed animal's head: three of them circling just over it, bobbing, for as long as it is dazed. The
 * dream's own bonk stars (dream/bonk.ts), with the lanterns' glow. Mounted in every seat (hidden), so the first bang
 * builds nothing. Inside the seat's group, at its plate point (`platePoint`, model units), so they follow the step;
 * `scale` is the group's, so the circle and the stars keep their size in metres.
 */
function DazeStars({ on, at, scale }: { on: boolean; at: readonly [number, number, number]; scale: number }) {
  const geo = useMemo(() => bonkStar(), []);
  const mat = useMemo(() => voxelMaterial({ emissive: LANTERN_LIGHT.color, emissiveIntensity: 2.2, homeGlow: true }), []);
  const stars = useRef<(Mesh | null)[]>([]);
  const since = useRef(0);
  useFrame(({ clock }, dt) => {
    since.current = on ? since.current + dt : 0;
    const t = clock.elapsedTime, grow = Math.min(1, since.current / 0.25), k = 1 / scale;
    stars.current.forEach((m, i) => {
      if (!m) return;
      m.visible = on;
      if (!on) return;
      const a = (t / 1.1) * Math.PI * 2 + (i / 3) * Math.PI * 2;
      m.position.set(at[0] + Math.cos(a) * 0.42 * k, at[1] + Math.sin(a * 2) * 0.05 * k, at[2] + Math.sin(a) * 0.42 * k);
      m.rotation.y = -a;
      m.scale.setScalar(1.6 * grow * k);
    });
  });
  return <>{[0, 1, 2].map((i) => <mesh key={i} ref={(el) => { stars.current[i] = el; }} geometry={geo} material={mat} visible={false} />)}</>;
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
function Pile({ world, pile, pulseKey, reduced }: { world: World; pile: number; pulseKey?: number; reduced: boolean }) {
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
  useSpotCasters(spot, world);
  return (
    <group position={[HEAP[0], 0, HEAP[2]]}>
      <mesh geometry={platform} material={mat} castShadow receiveShadow />
      <mesh geometry={mound} material={mat} position={[0, PLATFORM_HEIGHT, 0]} castShadow receiveShadow />
      <primitive object={target} position={[0, 0, 0]} />
      <spotLight ref={spot} position={[0, 6.0, 0]} target={target} color="#FFD9A0" intensity={90} angle={0.42} penumbra={0.7} distance={9} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    </group>
  );
}

/** The layer the pile's spot draws its shadow map from (three's layer 1). The animals' shadow stand-ins (Sheep.tsx, PROXY_LAYER) are on it too, and the sun's and the duel's casting lights draw layers 0 and 1 (SHADOW_LAYERS in Rendering.tsx). */
const SPOT_LAYER = 1;
const spotClear = new WeakMap<BufferGeometry, boolean>();

/**
 * The pile's spot draws its own shadow map every frame, and three hands it everything that casts and comes near: the
 * barn's walls, the bales, the door leaves, pieces of the yard, about 280,000 triangles, most of which its light can
 * never touch. Its shadow camera is put on a layer of its own, and every thing in the scene is on that layer too
 * except the still scenery that lies wholly outside the cone the spot lights (with half a metre to spare): that can
 * shadow nothing the spot lights, so the picture is the same. Whatever moves or comes later (animals, the bomb, the
 * board, a mode's own props) is put on the layer each frame before it is drawn, so it casts as it always did.
 * (The plan asked for the pile and the animals alone. But the beam, the letter board and the straw on the floor stand
 * in that cone too, and their shadows under the spot are part of the picture.)
 */
function useSpotCasters(spot: React.RefObject<SpotLight | null>, world: World) {
  const scene = useThree((s) => s.scene);
  const apart = useRef(new WeakSet<Object3D>());
  useEffect(() => {
    const light = spot.current;
    if (!light) return;
    scene.updateMatrixWorld();
    const apex = light.getWorldPosition(new Vector3()), axis = light.target.getWorldPosition(new Vector3()).sub(apex).normalize();
    // The shadow map is square: its corners reach further out than the cone it is drawn for.
    const spread = Math.SQRT2 * Math.tan(light.angle), far = (light.distance || 500) + 0.5, ROOM = 0.5;
    const p = new Vector3(), along = new Vector3();
    const inLight = (x: number, y: number, z: number, r: number) => {
      const d = p.set(x, y, z).sub(apex).dot(axis);
      return d > -ROOM - r && d < far + r && p.sub(along.copy(axis).multiplyScalar(d)).length() <= spread * Math.max(0, d) + ROOM + r;
    };
    const still = new Set<BufferGeometry>([...world.barn.static, ...world.barn.doorLeaves.map((d) => d.geo), ...world.yard.chunks, world.yard.snowman]);
    const set = new WeakSet<Object3D>();
    const v = new Vector3();
    scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !still.has(m.geometry)) return;
      let clear = spotClear.get(m.geometry);
      if (clear === undefined) {
        const ball = m.geometry.boundingSphere!, c = v.copy(ball.center).applyMatrix4(m.matrixWorld);
        clear = !inLight(c.x, c.y, c.z, ball.radius);
        if (!clear) {
          // Its ball reaches the light: look at every corner (its faces are far smaller than the room left).
          const pos = m.geometry.getAttribute('position');
          clear = true;
          for (let i = 0; i < pos.count && clear; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); clear = !inLight(v.x, v.y, v.z, 0); }
        }
        spotClear.set(m.geometry, clear); // each of these is mounted in one place only
      }
      if (clear) { set.add(m); m.layers.disable(SPOT_LAYER); }
    });
    apart.current = set;
    light.shadow.camera.layers.set(SPOT_LAYER);
  }, [scene, spot, world]);
  useFrame(() => { scene.traverse((o) => { if (!apart.current.has(o)) o.layers.enable(SPOT_LAYER); }); });
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
    // A new hook along the beam (`boardHang`): the board slides there as the camera swings to the turn.
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 6);
    g.current.position.x += (hook[0] - g.current.position.x) * ease;
    g.current.position.y = hook[1];
    g.current.position.z += (hook[2] - g.current.position.z) * ease;
    const want = Math.atan2(-(camera.position.x - hook[0]), -(camera.position.z - hook[2]));
    const d = Math.atan2(Math.sin(want - g.current.rotation.y), Math.cos(want - g.current.rotation.y));
    g.current.rotation.y += d * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  });
  const boardMid = BOARD.bottom + BOARD.height / 2 - (beamY - 0.15);
  // Where it first hangs; after that the frame loop moves it to each new hook.
  const [start] = useState<[number, number, number]>(() => [hook[0], hook[1], hook[2]]);
  return (
    <group ref={g} position={start}>
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

/**
 * Where a seat's name plate stands: just over the hat of the animal it wears (a hen's low, a horse's high), measured
 * from the model (`anchorsOf(...).plate`, file 03, 4.7), at the scale the table draws it. The daze stars circle here too.
 */
export function nameplateY(avatar: string | null | undefined): number {
  // Over the photo's top, but never higher than the head stood on 2026-11-08: a forehead stretched far up would carry the
  // plate and the speech bubble off the screen.
  if (isTallPhoto(avatar)) return (Math.min(pictureHeight(getKaiyanLook(avatar).length), pictureHeight(1)) + 0.14) * SHEEP_SCALE;
  const m = animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep');
  return anchorsOf(m).plate[1] * SHEEP_SCALE * m.drawScale;
}

/** How the table scales a seat's group: the sheep's scale times the animal's own (the admin's picture at 1). */
export function seatScale(avatar: string | null | undefined): number {
  return SHEEP_SCALE * (isAdminAvatar(avatar) ? 1 : animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep').drawScale);
}

/**
 * Where a seat's name plate stands in its group's own space (plan file 06, 4.7): the measured plate point over the
 * head's centre (`anchorsOf(...).plate`), so a plate placed inside the group follows the step toward the pile and the
 * group's scale. The admin's picture has no head to measure: over its middle, at the height `nameplateY` gives it.
 */
export function platePoint(avatar: string | null | undefined): [number, number, number] {
  if (isAdminAvatar(avatar)) return [0, nameplateY(avatar) / seatScale(avatar), 0];
  const p = anchorsOf(animalModel(byId(avatar ?? undefined)?.animal ?? 'sheep')).plate;
  return [p[0], p[1], p[2]];
}

/** The speaker's measured body for the board's search (`boardHang`): the admin's picture is searched as the sheep. */
function speakerBody(avatar: string | null | undefined): SpeakerBody {
  const m = animalModel(isAdminAvatar(avatar) ? 'sheep' : byId(avatar ?? undefined)?.animal ?? 'sheep');
  const a = anchorsOf(m);
  return { min: a.bounds.min, max: a.bounds.max, plate: a.plate, scale: SHEEP_SCALE * m.drawScale, ratio: heightRatio(m.species ?? 'sheep') };
}
