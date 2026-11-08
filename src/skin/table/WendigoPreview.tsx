import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { Wendigo, WENDIGO_AT } from './Wendigo';

/** The wendigo close up under a cold moon, for ?preview=wendigo. */
export function PreviewCanvas() {
  const [x, y, z] = WENDIGO_AT;
  return (
    <Canvas gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [x + 1.6, y + 2.2, z + 6.2] }}
      onCreated={({ camera }) => camera.lookAt(x, y + 1.8, z)}>
      <color attach="background" args={['#0B1220']} />
      <fog attach="fog" args={['#0B1220', 6, 16]} />
      <hemisphereLight args={['#9DB4D8', '#1A2230', 0.7]} />
      <directionalLight position={[x - 4, y + 8, z + 6]} intensity={1.4} color="#C8D8F0" />
      <mesh position={[x, y - 0.05, z]}><boxGeometry args={[12, 0.1, 12]} /><meshStandardMaterial color="#D8E2EE" /></mesh>
      <Wendigo reduced={false} />
    </Canvas>
  );
}
