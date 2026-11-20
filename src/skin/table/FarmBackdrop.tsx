import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { ACESFilmicToneMapping, Object3D, PCFShadowMap, SRGBColorSpace } from 'three';
import type { PerspectiveCamera, PointLight, SpotLight } from 'three';
import type { Hour } from '../model/types';
import { HOME_CAMERA, pinnedPov, POV_SHOTS, povAt } from '../scene/homePov';
import type { PovShot } from '../scene/homePov';
import { BARN } from '../scene/layout';
import { Sky } from '../scene/Sky';
import { Farm, useWorld } from './BarnTable';
import { DevStats } from './DevStats';
import { Farmstead, farmReady } from './Farmstead';
import { doorsShut } from '../components/BarnDoors';
import { Wendigo } from './Wendigo';
import { AdaptiveCanvas, Atmosphere, Effects, FOG, holdDpr, Lights, MarkDrawn, noteNewShot, sunEveryFrameFor, yawToward } from './Rendering';
import { applyPendingTier, setExemptShot } from '../perf/tier';
import { PADDOCK_SHOT } from '../voxel/unseen';
import { SceneBoundary } from '../perf/SceneBoundary';
import { isAdminAvatar } from '../../avatars/ids';
import { AvatarDisc } from '../avatars/AvatarDisc';
import { byId } from '../avatars/catalog';
import { animalModel } from '../voxel/animals';
import { useAvatar } from '../avatars/store';
import { Sheep } from './Sheep';

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
  /** Bump to make the hero hop (the name field took focus). */
  hopKey?: number;
  /** A full page (the Trading Post) covers the farm: stop drawing it until the page closes. */
  paused?: boolean;
  /** How many pictures a second the farm is drawn at (the frame governor); none given is the full rate. */
  fps?: number;
}

/** Home's backdrop: the farm seen from the yard, the barn's open back doors glowing, the player's sheep in the doorway light. */
export function FarmBackdrop({ hour, reduced, sleepy, phone, heroYaw = 0, hopKey = 0, paused = false, fps }: Props) {
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
  useEffect(() => { if (hopKey > 0) sunEveryFrameFor(1500); }, [hopKey]);
  // Leaving Home: the next Home starts outside the paddock's exemption until its own first shot says otherwise.
  useEffect(() => () => setExemptShot(false), []);
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
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: false /* the composer has its own 4x MSAA target */ }}
      camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
    >
      <Drift shots={phone ? POV_SHOTS.phone : POV_SHOTS.desktop} veil={veil} spot={spot} bounce={bounce} reduced={reduced} ready={ready} />
      <Atmosphere hour={hour} />
      <MarkDrawn />
      <Lights hour={hour} phone={phone} viewYaw={yawToward(cam.position, cam.target)} lampRef={lowerLamp} place="home" />
      <DoorSpill spot={spot} bounce={bounce} />
      <Sky hour={hour} reduced={reduced} blizzard={false} />
      <Farm world={w} reduced={reduced} />
      <Farmstead world={w} reduced={reduced} phone={phone} onReady={onReady} />
      <Wendigo reduced={reduced} />
      <group position={hero} rotation={[0, heroFacing, 0]} scale={1.5}>
        {isAdminAvatar(avatar)
          ? <AvatarDisc state={sleepy ? 'sleeping' : hopKey > 0 ? 'happy' : 'idle'} stateKey={hopKey} reduced={reduced} yaw={sleepy ? 0 : heroYaw} avatar={avatar} />
          : <Sheep level={2} state={sleepy ? 'sleeping' : hopKey > 0 ? 'happy' : 'idle'} stateKey={hopKey} reduced={reduced} headYaw={sleepy ? 0 : heroYaw}
              model={byId(avatar) ? animalModel(byId(avatar)!.animal) : undefined} />}
      </group>
      {/* A second sheep half inside the doorway, head down in the hay by the bales. */}
      <group position={[2.2, 0, BARN.maxZ - 1.4]} rotation={[0, Math.PI / 2, 0]} scale={1.5}>
        <Sheep level={3} state={sleepy ? 'sleeping' : 'grazing'} reduced={reduced} />
      </group>
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
function Drift({ shots, veil, spot, bounce, reduced, ready }: {
  shots: PovShot[]; veil: RefObject<HTMLDivElement | null>;
  spot: RefObject<SpotLight | null>; bounce: RefObject<PointLight | null>; reduced: boolean; ready: boolean;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
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
    const shot = shots[pov.index];
    if (pov.index !== shown.current) {
      shown.current = pov.index;
      // The cut is made in the dark of the dip: a tier the frames earned comes in here, the paddock's exemption (the
      // wendigo's shot is today's light, fog, shadows, bloom and tilt-shift on every tier) begins or ends, and the
      // sun's map is drawn again for the new shot.
      applyPendingTier();
      setExemptShot(pov.index === PADDOCK_SHOT);
      noteNewShot();
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      const spill = shot.spill ?? 1;
      if (spot.current) spot.current.intensity = DOOR_LIGHT.spot * spill;
      if (bounce.current) {
        bounce.current.intensity = DOOR_LIGHT.bounce * spill;
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
  });
  return null;
}

const DOOR_LIGHT = { spot: 120, bounce: 14, bounceAt: [-1.5, 1.6, BARN.maxZ + 3.6] as const };

/** Warm light from inside the doorway, pointed down the path, so it lies on the snow in front of the doors. */
function DoorSpill({ spot, bounce }: { spot: RefObject<SpotLight | null>; bounce: RefObject<PointLight | null> }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <>
      <primitive object={target} position={[0, 0, BARN.maxZ + 7]} />
      <spotLight ref={spot} position={[0, 3.2, BARN.maxZ - 0.4]} target={target} color="#FFC278" intensity={DOOR_LIGHT.spot} angle={0.55} penumbra={0.6} distance={16} decay={2} />
      {/* A little of that light bounced back off the snow, so the hero's face is not a silhouette. */}
      <pointLight ref={bounce} position={[...DOOR_LIGHT.bounceAt]} color="#FFC278" intensity={DOOR_LIGHT.bounce} distance={7} decay={2} />
    </>
  );
}
