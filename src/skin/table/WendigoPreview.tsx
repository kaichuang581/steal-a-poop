import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { groundAt } from '../scene/countryside';
import { Wendigo, WENDIGO_AT } from './Wendigo';

/** The wendigo close up on a snowy night, for ?preview=wendigo (dev only). `&side` looks from the side. */
export function PreviewCanvas() {
  const [x, z] = WENDIGO_AT, y = groundAt(x, z);
  const side = new URLSearchParams(location.search).has('side');
  // Looking at it from the farm's side, the way it faces.
  const cam: [number, number, number] = side ? [x + 6, y + 2.2, z + 1] : [x + 3.6, y + 2.4, z + 5.8];
  return (
    <Canvas gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 34, position: cam }}
      onCreated={({ camera }) => camera.lookAt(x, y + 1.9, z)}>
      <color attach="background" args={['#0B1220']} />
      <fog attach="fog" args={['#0B1220', 7, 18]} />
      <hemisphereLight args={['#9DB4D8', '#1A2230', 1.4]} />
      <directionalLight position={[x + 4, y + 8, z + 6]} intensity={3.2} color="#C8D8F0" />
      <mesh position={[x, y - 0.05, z]}><boxGeometry args={[12, 0.1, 12]} /><meshStandardMaterial color="#D8E2EE" /></mesh>
      <Wendigo reduced={false} anywhere />
    </Canvas>
  );
}
