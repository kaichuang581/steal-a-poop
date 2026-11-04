import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { ACESFilmicToneMapping, Object3D, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import type { Hour } from '../model/types';
import { BARN } from '../scene/layout';
import { Sky } from '../scene/Sky';
import { Farm, useWorld } from './BarnTable';
import { DevStats } from './DevStats';
import { Atmosphere, Effects, FOG, Lights, yawToward } from './Rendering';
import { Sheep } from './Sheep';

/** The diorama shot (plan V3.1 Part 2.2 and 2.4): a long lens from the yard, the open doorway on the right third. */
export const HOME_CAMERA = {
  desktop: { fov: 26, position: [-12.5, 7.0, 23.0] as const, target: [0.6, 1.6, 4.5] as const },
  // Phones: the hero has to sit between the title and the tickets, so the lens aims lower, at the sheep's feet.
  // A tall viewport makes the horizontal view narrow, so the phone lens is wider and aims below the hero's feet.
  phone: { fov: 46, position: [-6.5, 4.6, 21] as const, target: [0, -0.9, 8.2] as const },
};

interface Props {
  hour: Hour;
  reduced: boolean;
  /** The Daily Table is played for today: the sheep doze. */
  sleepy: boolean;
  phone: boolean;
  /** Where the hero looks (radians, clamped by the sheep): follows the pointer on desktop. */
  heroYaw?: number;
  /** Bump to make the hero hop (the name field took focus). */
  hopKey?: number;
}

/** Home's backdrop: the farm seen from the yard, the barn's open back doors glowing, the player's sheep in the doorway light. */
export function FarmBackdrop({ hour, reduced, sleepy, phone, heroYaw = 0, hopKey = 0 }: Props) {
  const w = useWorld();
  const cam = phone ? HOME_CAMERA.phone : HOME_CAMERA.desktop;
  if (!w) return <div className="absolute inset-0" style={{ background: `linear-gradient(${FOG[hour]}, #DCE6F2)` }} />;
  // The hero stands 1.2 m in front of the doors and faces the camera.
  const hero: [number, number, number] = [0, 0, BARN.maxZ + 1.2];
  const heroFacing = Math.atan2(cam.position[0] - hero[0], cam.position[2] - hero[2]);
  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }} dpr={phone ? [1, 1.5] : [1, 2]}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, antialias: true }}
      camera={{ fov: cam.fov, position: [...cam.position], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(cam.target[0], cam.target[1], cam.target[2])}
    >
      <Drift base={cam.position} target={cam.target} reduced={reduced} />
      <Atmosphere hour={hour} />
      <Lights hour={hour} phone={phone} viewYaw={yawToward(cam.position, cam.target)} />
      <DoorSpill />
      <Sky hour={hour} reduced={reduced} blizzard={false} />
      <Farm world={w} reduced={reduced} stealOpen={false} />
      <group position={hero} rotation={[0, heroFacing, 0]} scale={1.5}>
        <Sheep level={2} state={sleepy ? 'sleeping' : hopKey > 0 ? 'happy' : 'idle'} stateKey={hopKey} reduced={reduced} headYaw={sleepy ? 0 : heroYaw} />
      </group>
      {/* A second sheep half inside the doorway, head down in the hay by the bales. */}
      <group position={[2.6, 0, BARN.maxZ - 1.4]} rotation={[0, Math.PI / 2, 0]} scale={1.5}>
        <Sheep level={3} state={sleepy ? 'sleeping' : 'grazing'} reduced={reduced} />
      </group>
      <Effects tiltShift={0.15} />
      <DevStats />
    </Canvas>
  );
}

/** The camera drifts on a 0.25 m by 0.12 m ellipse over 40 s with the target fixed; still under reduced motion. */
function Drift({ base, target, reduced }: { base: readonly number[]; target: readonly number[]; reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime / 40) * Math.PI * 2;
    const dx = reduced ? 0 : Math.cos(t) * 0.25;
    const dy = reduced ? 0 : Math.sin(t) * 0.12;
    camera.position.set(base[0] + dx, base[1] + dy, base[2]);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

/** Warm light from inside the doorway, pointed down the path, so it lies on the snow in front of the doors. */
function DoorSpill() {
  const target = useMemo(() => new Object3D(), []);
  return (
    <>
      <primitive object={target} position={[0, 0, BARN.maxZ + 7]} />
      <spotLight position={[0, 3.2, BARN.maxZ - 0.4]} target={target} color="#FFC278" intensity={120} angle={0.55} penumbra={0.6} distance={16} decay={2} />
      {/* A little of that light bounced back off the snow, so the hero's face is not a silhouette. */}
      <pointLight position={[-1.5, 1.6, BARN.maxZ + 3.6]} color="#FFC278" intensity={14} distance={7} decay={2} />
    </>
  );
}
