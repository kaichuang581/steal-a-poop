import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Object3D, PCFShadowMap, SRGBColorSpace, Vector3 } from 'three';
import type { Group, PerspectiveCamera, PointLight, SpotLight } from 'three';
import type { Hour } from '../model/types';
import { HOME_CAMERA, pinnedPov, POV_SHOTS, povAt } from '../scene/homePov';
import { sceneShift } from '../home/layout';
import type { PovShot } from '../scene/homePov';
import { BARN } from '../scene/layout';
import { Sky } from '../scene/Sky';
import { Farm, useWorld } from './BarnTable';
import { DevStats } from './DevStats';
import { Farmstead, farmReady } from './Farmstead';
import { doorsShut } from '../components/BarnDoors';
import { Wendigo } from './Wendigo';
import { AdaptiveCanvas, Atmosphere, Effects, FOG, holdDpr, Lights, MarkDrawn, noteNewShot, setShotLight, shotLight, sunEveryFrameFor, yawToward } from './Rendering';
import { applyPendingTier, getTier, setExemptShot } from '../perf/tier';
import { PADDOCK_SHOT } from '../voxel/unseen';
import { SceneBoundary } from '../perf/SceneBoundary';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { animalModel } from '../voxel/animals';
import { useAvatar } from '../avatars/store';
import { BarnGame } from './BarnGame';
import { Sheep } from './Sheep';
import { LOOK } from '../look';

/** With the roof on, lanterns at their full height shine out through the shingles, so here they hang lower. */
const lowerLamp = (_: number, lamp: PointLight | null) => { if (lamp) lamp.position.y = 2.5; };

interface Props {
  hour: Hour;
  reduced: boolean;
  /** The Daily Table is played for today: the sheep doze. */
  sleepy: boolean;
  phone: boolean;
  /** Where the hero looks (radians, clamped by the sheep): follows the pointer on desktop. A ref is read as the hero is drawn, with no render. */
  heroYaw?: number | { readonly current: number };
  /** Where the pointer is over Home, x and y from -1 to 1 (y up), or null before it has moved: the hero looks at it. */
  heroGaze?: { readonly current: readonly [number, number] | null };
  /** Bump to make the hero hop (the name field took focus). */
  hopKey?: number;
  /** A full page (the Trading Post) covers the farm: stop drawing it until the page closes. */
  paused?: boolean;
  /** How many pictures a second the farm is drawn at (the frame governor); none given is the full rate. */
  fps?: number;
}

/** Home's backdrop: the farm seen from the yard, the barn's open back doors glowing, the player's sheep in the doorway light. */
export function FarmBackdrop({ hour, reduced, sleepy, phone, heroYaw = 0, heroGaze, hopKey = 0, paused = false, fps }: Props) {
  const w = useWorld();
  const avatar = useAvatar();
  const cam = phone ? HOME_CAMERA.phone : HOME_CAMERA.desktop;
  const veil = useRef<HTMLDivElement>(null);
  const spot = useRef<SpotLight>(null);
  const bounce = useRef<PointLight>(null);
  // The farm fades in once it and the land round it are built, over a soft sky, so a load without the doors (a
  // refresh) never shows the scene going up piece by piece.
  const [ready, setReady] = useState(farmReady);
  // Behind the doors (a first load) the farm is shown at once, so they open onto it, not onto a fade still under way.
  const [instant, setInstant] = useState(farmReady);
  const onReady = useCallback((r: boolean) => { if (r) setInstant(doorsShut()); setReady(r); }, []);
  // The hop throws the hero's shadow about: the sun's map follows it every picture while it lasts, not ten times a second.
  // One hop, then back to standing: held as 'happy' it wagged for good, and its happy lids hid a one-row eye.
  const [hopping, setHopping] = useState(false);
  useEffect(() => {
    if (hopKey <= 0) return;
    sunEveryFrameFor(1500);
    setHopping(true);
    const id = setTimeout(() => setHopping(false), 1200);
    return () => clearTimeout(id);
  }, [hopKey]);
  // Leaving Home: the next Home starts outside the paddock's exemption until its own first shot says otherwise.
  useEffect(() => () => { setExemptShot(false); setShotLight(null); }, []);
  const sky = <div className="absolute inset-0" style={{ background: `linear-gradient(${FOG[hour]}, #DCE6F2)` }} />;
  if (!w) return sky;
  // The hero stands 1.2 m in front of the doors and faces the camera.
  const hero: [number, number, number] = [0, 0, BARN.maxZ + 1.2];
  const heroFacing = Math.atan2(cam.position[0] - hero[0], cam.position[2] - hero[2]);
  return (
    <>
    {sky}
    {/* Round the fade as well as the canvas: a farm that cannot be drawn never becomes ready, and its card must show. */}
    <SceneBoundary scene="the farm" place={phone ? 'top' : 'center'}>
    <div className="sk-farm-fade absolute inset-0" data-ready={ready || undefined} data-instant={instant || undefined}>
    <AdaptiveCanvas maxDpr={phone ? 1.5 : 2} memory="farm" frameloop={paused ? 'never' : 'demand'} fps={fps} judgeTier={ready}
      shadows={{ type: PCFShadowMap }}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, toneMappingExposure: 1, antialias: false /* the composer has its own 4x MSAA target */ }}
      camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
    >
      <Drift shots={phone ? POV_SHOTS.phone : POV_SHOTS.desktop} veil={veil} spot={spot} bounce={bounce} reduced={reduced} ready={ready} hour={hour} phone={phone} />
      <DoorGain hour={hour} />
      <Atmosphere hour={hour} />
      <MarkDrawn />
      <Lights hour={hour} phone={phone} viewYaw={yawToward(cam.position, cam.target)} lampRef={lowerLamp} place="home" />
      <DoorSpill spot={spot} bounce={bounce} />
      <Sky hour={hour} reduced={reduced} blizzard={false} home />
      <Farm world={w} reduced={reduced} />
      <Farmstead world={w} reduced={reduced} phone={phone} onReady={onReady} />
      <Wendigo reduced={reduced} />
      <Hero at={hero} facing={heroFacing} gaze={sleepy ? undefined : heroGaze} scale={1.5 * (isAdminAvatar(avatar) ? 1 : animalModel(byId(avatar)?.animal ?? 'sheep').drawScale)}>
        {(look) => isAdminAvatar(avatar)
          ? <AvatarDisc state={sleepy ? 'sleeping' : hopping ? 'happy' : 'idle'} stateKey={hopKey} reduced={reduced} yaw={sleepy ? 0 : heroYaw} avatar={avatar} />
          : <Sheep level={2} state={sleepy ? 'sleeping' : hopping ? 'happy' : 'idle'} stateKey={hopKey} reduced={reduced} lookAt={sleepy ? undefined : look}
              model={byId(avatar) ? animalModel(byId(avatar)!.animal) : undefined} />}
      </Hero>
      <BarnGame reduced={reduced} phone={phone} sleepy={sleepy} />
      <Effects tiltShift={0.15} home />
      <DevStats />
    </AdaptiveCanvas>
    </div>
    </SceneBoundary>
    <div ref={veil} className="pointer-events-none absolute inset-0 bg-[#0b0806] opacity-0" />
    </>
  );
}

/**
 * The camera travels along each scene's `push` for a few seconds, with a slight 0.25 m by 0.12 m drift over 40 s, then
 * dips to dark to cut to the next. Under reduced motion it stays still on the first scene.
 */
function Drift({ shots, veil, spot, bounce, reduced, ready, hour, phone = false }: {
  shots: PovShot[]; veil: RefObject<HTMLDivElement | null>;
  spot: RefObject<SpotLight | null>; bounce: RefObject<PointLight | null>; reduced: boolean; ready: boolean; hour: Hour; phone?: boolean;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const shifted = useRef('');
  const pinned = useMemo(() => pinnedPov(location.search, shots.length), [shots]);
  const shown = useRef(-1);
  // The tour starts when the farm is shown, not when the canvas mounts: until then the camera holds the opening shot,
  // so a slow build never skips it (and no paddock visit nobody saw counts toward the wendigo).
  const startedAt = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (ready && startedAt.current === null) startedAt.current = clock.elapsedTime;
    // A pause (the Trading Post over the farm) restarts the clock at 0: the tour starts again from its first shot.
    if (startedAt.current !== null && clock.elapsedTime < startedAt.current) { startedAt.current = clock.elapsedTime; }
    const still = reduced || pinned !== null || startedAt.current === null;
    const pov = still ? { index: pinned ?? 0, progress: 0, veil: 0 } : povAt(clock.elapsedTime - startedAt.current!, shots.length);
    const shot = DEV_CAM ?? shots[pov.index];
    if (pov.index !== shown.current) {
      shown.current = pov.index;
      // The cut is made in the dark of the dip: a tier the frames earned comes in here, the paddock's exemption (the
      // wendigo's shot is today's light, fog, shadows, bloom and tilt-shift on every tier) begins or ends, and the
      // sun's map is drawn again for the new shot.
      applyPendingTier();
      setExemptShot(pov.index === PADDOCK_SHOT);
      // The shot's own haze, exposure, sun and shadow box (docs/miniature/02): set here, in the dark, with everything else.
      setShotLight(shotLight(shot, hour, { paddock: pov.index === PADDOCK_SHOT, low: getTier() === 'low', aspect: camera.aspect }));
      noteNewShot();
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      const spill = shot.spill ?? 1;
      if (spot.current) spot.current.intensity = DOOR_LIGHT.spot * spill * DOOR_GAIN.now;
      if (bounce.current) {
        bounce.current.intensity = DOOR_LIGHT.bounce * spill * DOOR_GAIN.now;
        bounce.current.position.set(...(shot.bounce ?? DOOR_LIGHT.bounceAt));
      }
    }
    if (veil.current) veil.current.style.opacity = String(pov.veil);
    // In a dip the shot changes under the dark: its frames, and the first half second of the new shot's, say nothing
    // about the steady cost (see the resolution judge in Rendering).
    if (pov.veil > 0) holdDpr(500);
    const t = (clock.elapsedTime / 40) * Math.PI * 2;
    const dx = reduced ? 0 : Math.cos(t) * 0.25;
    const dy = reduced ? 0 : Math.sin(t) * 0.12;
    const k = pov.progress;
    camera.position.set(shot.position[0] + dx + shot.push[0] * k, shot.position[1] + dy + shot.push[1] * k, shot.position[2] + shot.push[2] * k);
    camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
    // Home's panel covers the left (home/layout.ts): the picture slides right so the shot's subject sits in the middle
    // of what is left open. Never on the paddock shot (the wendigo's frame is frozen) and not on a phone.
    const d = phone || pov.index === PADDOCK_SHOT || DEV_CAM ? 0 : sceneShift(size.width, size.height);
    const key = `${d} ${size.width} ${size.height}`;
    if (key !== shifted.current) {
      shifted.current = key;
      if (d) camera.setViewOffset(size.width, size.height, -d, 0, size.width, size.height); else camera.clearViewOffset();
    }
  });
  return null;
}

const ray = new Vector3();
/**
 * The hero in the doorway. It looks at the pointer: the point its head turns to lies on the pointer's line from the
 * camera, 2.5 m nearer the camera than the hero stands. Past what its neck allows (the sheep clamps that) the body turns
 * too, up to 1.1 rad either way. With the camera behind it (the shot from inside the barn) it stands as it was put.
 */
function Hero({ at, facing, scale, gaze, children }: { at: [number, number, number]; facing: number; scale: number; gaze?: { readonly current: readonly [number, number] | null }; children: (look: [number, number, number]) => React.ReactNode }) {
  const group = useRef<Group>(null);
  const look = useMemo<[number, number, number]>(() => [at[0] + Math.sin(facing) * 9, 1.2, at[2] + Math.cos(facing) * 9], [at[0], at[2], facing]); // eslint-disable-line react-hooks/exhaustive-deps
  const turn = useRef(0);
  const camera = useThree((st) => st.camera);
  useFrame((_, dt) => {
    const g = group.current, p = gaze?.current;
    if (!g) return;
    let body = 0;
    if (p) {
      ray.set(p[0], p[1], 0.5).unproject(camera).sub(camera.position).normalize();
      const reach = Math.max(1, Math.hypot(camera.position.x - at[0], camera.position.y - 1.2, camera.position.z - at[2]) - 2.5);
      look[0] = camera.position.x + ray.x * reach; look[1] = camera.position.y + ray.y * reach; look[2] = camera.position.z + ray.z * reach;
      const want = ((Math.atan2(look[0] - at[0], look[2] - at[2]) - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(want) < 2) body = Math.max(-1.1, Math.min(1.1, want - Math.max(-0.5, Math.min(0.5, want))));
    }
    if (Math.abs(body - turn.current) > 0.01) sunEveryFrameFor(200); // its shadow turns with it, every picture
    turn.current += (body - turn.current) * (1 - Math.exp(-dt / 0.3));
    g.rotation.y = facing + turn.current;
  });
  return <group ref={group} position={at} rotation={[0, facing, 0]} scale={scale}>{children(look)}</group>;
}

/**
 * A camera for looking round the farm on a development server: ?cam=x,y,z,tx,ty,tz[,fov] stands the Home camera there,
 * still, in place of the tour's shot. Never in a build players load.
 */
const DEV_CAM: PovShot | null = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
  if (!v || v.length < 6 || v.some((n) => !Number.isFinite(n))) return null;
  return { position: [v[0], v[1], v[2]], target: [v[3], v[4], v[5]], fov: v[6] ?? 40, push: [0, 0, 0], spill: 0.4 };
})();
const DOOR_LIGHT = { spot: 120, bounce: 14, bounceAt: [-1.5, 1.6, BARN.maxZ + 3.6] as const };
/**
 * How much of the doorway's lamp light shows at each hour: under the diorama's daylight (table/Rendering.tsx) the full
 * lamp burned the snow and the avatar out, so by day it is a warm hint and only at night the pool it was.
 */
const DOOR_GAIN = { dawn: 0.45, day: 0.22, dusk: 0.55, night: 1, now: 0.22 };

/** Warm light from inside the doorway, pointed down the path, so it lies on the snow in front of the doors. */
/** Sets the doorway lamp's share for the hour (read where the tour sets the lamp for each shot). */
function DoorGain({ hour }: { hour: Hour }) {
  DOOR_GAIN.now = DOOR_GAIN[hour];
  return null;
}

function DoorSpill({ spot, bounce }: { spot: RefObject<SpotLight | null>; bounce: RefObject<PointLight | null> }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <>
      <primitive object={target} position={[0, 0, BARN.maxZ + 7]} />
      <spotLight ref={spot} position={[0, 3.2, BARN.maxZ - 0.4]} target={target} color="#FFC278" intensity={DOOR_LIGHT.spot * DOOR_GAIN.now} angle={0.55} penumbra={0.6} distance={16} decay={2} />
      {/* A little of that light bounced back off the snow, so the hero's face is not a silhouette. */}
      <pointLight ref={bounce} position={[...DOOR_LIGHT.bounceAt]} color="#FFC278" intensity={DOOR_LIGHT.bounce * DOOR_GAIN.now} distance={7} decay={2} />
    </>
  );
}
