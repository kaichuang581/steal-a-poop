import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ACESFilmicToneMapping, MeshLambertMaterial, SRGBColorSpace } from 'three';
import type { OrthographicCamera } from 'three';
import { sheepdogModel } from '../voxel/characters';
import { withRoundedEdges } from '../voxel/rounded';

declare global {
  interface Window { __thumbReady?: boolean }
}

/**
 * ?preview=guide: the tutorial's sheepdog, sitting, alone on a clear background under the thumbnails' three
 * lights, for tools/renderGuide.mjs to bake into public/tour/sheepdog.webp (the picture on the guide's card). It is the
 * game's own voxel dog (voxel/characters.ts), the one that sits in the barn during the tutorial. Never shown to players.
 */
export default function GuideRender() {
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: 256, height: 256 }}>
      <Canvas
        orthographic dpr={1}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }}
      >
        <hemisphereLight args={['#FFF1DC', '#6A5648', 1.35]} />
        <directionalLight position={[-3, 5, 4]} color="#FFE2B8" intensity={2.4} />
        <directionalLight position={[4, 1.5, -2]} color="#BCD8FF" intensity={0.9} />
        <Dog />
      </Canvas>
    </div>
  );
}

/** The frame: where its middle is on the dog, how much of the dog it takes in (metres), and how the dog is turned.
 *  The whole dog, on purpose: a close-up of its head is a black block (its eyes are dark on dark fur), while the
 *  sitting shape with the bandana, the white chest and the tail's white tip reads as a collie at any size.
 *  ?mid= ?h= ?ry= ?rx= try other framings without editing this file. */
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const FRAME = { midY: num('mid', 0.44), height: num('h', 0.96), ry: num('ry', 0.6), rx: num('rx', 0.12) };

function Dog() {
  const m = useMemo(() => sheepdogModel(), []);
  const mat = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true })), []);
  const { camera, size } = useThree();
  const frames = useRef(0);
  useEffect(() => {
    const cam = camera as OrthographicCamera;
    cam.position.set(0, FRAME.midY, 10);
    cam.zoom = size.height / FRAME.height;
    cam.lookAt(0, FRAME.midY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  useFrame(() => { if (++frames.current === 6) window.__thumbReady = true; });
  return (
    <group position={[0, FRAME.midY, 0]} rotation={[FRAME.rx, FRAME.ry, 0]}>
      <group position={[0, -FRAME.midY, 0]}>
        <mesh geometry={m.body.geo} position={m.body.pivot} material={mat} />
        <mesh geometry={m.head.geo} position={m.head.pivot} material={mat} rotation={[0.08, 0, 0]} />
        {m.ears.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} />)}
        <mesh geometry={m.tail.geo} position={m.tail.pivot} material={mat} />
        {m.legs.map((p, i) => <mesh key={`l${i}`} geometry={p.geo} position={p.pivot} material={mat} />)}
      </group>
    </group>
  );
}
