import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, Fog, NoToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import type { Hour } from '../model/types';
import { BARN } from '../scene/layout';
import { Sky } from '../scene/Sky';
import { Farm, useWorld } from './BarnTable';
import { Sheep } from './Sheep';

const FOG: Record<Hour, string> = { dawn: '#F3C9B5', day: '#BFE1F3', dusk: '#D08AA2', night: '#273B66' };

/** Home's backdrop: the farm seen from the yard, the barn's open back doors glowing, two sheep waiting outside. */
export function FarmBackdrop({ hour, reduced, sleepy }: { hour: Hour; reduced: boolean; sleepy: boolean }) {
  const w = useWorld();
  if (!w) return <div className="absolute inset-0" style={{ background: `linear-gradient(${FOG[hour]}, var(--snow, #DCE6F2))` }} />;
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: NoToneMapping, antialias: true }}
      camera={{ fov: 44, position: [-7.5, 4.0, 15.5], near: 0.1, far: 900 }}
      onCreated={({ camera }) => camera.lookAt(-1.5, 2.2, BARN.maxZ)}
    >
      <FogAndSky hour={hour} />
      <Sky hour={hour} reduced={reduced} blizzard={false} />
      <Farm world={w} hour={hour} reduced={reduced} stealOpen={false} />
      <group position={[4.2, 0, BARN.maxZ + 3.2]} rotation={[0, Math.PI + 0.5, 0]} scale={1.5}>
        <Sheep level={2} state={sleepy ? 'sleeping' : 'idle'} reduced={reduced} />
      </group>
      <group position={[-3.8, 0, BARN.maxZ + 2.4]} rotation={[0, Math.PI - 0.7, 0]} scale={1.5}>
        <Sheep level={3} state={sleepy ? 'sleeping' : 'idle'} reduced={reduced} />
      </group>
    </Canvas>
  );
}

function FogAndSky({ hour }: { hour: Hour }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new Fog(FOG[hour], 30, 210);
    scene.background = new Color(FOG[hour]);
  }, [scene, hour]);
  return null;
}
