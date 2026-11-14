import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { ACESFilmicToneMapping, Box3, SRGBColorSpace, Vector3 } from 'three';
import type { Group, OrthographicCamera } from 'three';
import { itemById } from './catalog';
import { BombModel3d, GridModel3d } from './models3d';

declare global {
  interface Window { __thumbReady?: boolean }
}

/**
 * ?preview=thumb&id=<item id>: one Trading Post item alone on a clear background,
 * lit by a warm key light at a three-quarter angle, for tools/renderThumbs.mjs to bake into public/shop. A bomb skin is
 * the game's own bomb in that skin's tint, exactly as the table draws it. Never shown to players.
 */
export default function ThumbRender() {
  const id = new URLSearchParams(location.search).get('id') ?? 'bomb-ice';
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: 256, height: 256 }}>
      <Canvas
        orthographic dpr={1}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }}
      >
        <hemisphereLight args={['#FFF1DC', '#6A5648', 1.25]} />
        <directionalLight position={[-3, 5, 4]} color="#FFE2B8" intensity={2.4} />
        <directionalLight position={[4, 1.5, -2]} color="#BCD8FF" intensity={0.7} />
        <Subject id={id} />
      </Canvas>
    </div>
  );
}

/** The thing itself, turned to a three-quarter view and framed to fill the picture. */
function Subject({ id }: { id: string }) {
  const group = useRef<Group>(null);
  const { camera, size } = useThree();
  const frames = useRef(0);
  const kind = itemById(id)?.kind ?? 'bomb';
  // Everything is seen from the upper right under the one warm key light from the upper left. (The sacks are not
  // here: they are baked standing in their crates on the stall, by tools/renderStall.mjs.)
  const turn: [number, number, number] = kind === 'blast' ? [0.32, -0.5, 0] : kind === 'bomb' ? [0.34, -0.55, 0] : [0.3, -0.5, 0];

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g), c = box.getCenter(new Vector3()), s = box.getSize(new Vector3());
    const cam = camera as OrthographicCamera;
    cam.position.set(c.x, c.y, 10);
    cam.zoom = (size.width * 0.9) / Math.max(s.x, s.y);
    cam.lookAt(c.x, c.y, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, id, kind]);
  useFrame(() => { if (++frames.current === 6) window.__thumbReady = true; });

  return <group ref={group} rotation={turn}>{kind === 'bomb' ? <BombModel3d id={id} sparkles={turn} /> : <GridModel3d id={id} kind={kind as 'blast' | 'tick'} />}</group>;
}
