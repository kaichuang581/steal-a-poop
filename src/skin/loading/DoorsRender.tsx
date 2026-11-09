import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from 'three';
import type { DirectionalLight } from 'three';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { DOOR_BOXES, DOOR_PARTS, DOOR_VOXEL } from './doorsModel';
import type { DoorPart } from './doorsModel';

declare global {
  interface Window { __doorsBox?: { x0: number; y0: number; w: number; h: number }; __doorsReady?: boolean }
}

/**
 * ?preview=doors&part=leaves|lintel|sill: one part of the loading screen's doors, lit like the farm at night, framed
 * edge to edge with nothing around it, for tools/renderDoors.mjs to bake into an image. Never shown to players.
 */
export default function DoorsRender() {
  const part = (new URLSearchParams(location.search).get('part') ?? 'leaves') as DoorPart;
  // The frame is the part's fixed box, not its voxels' extent, so the images always line up on screen.
  const box = DOOR_BOXES[part];
  const geo = useMemo(() => buildGeometry(DOOR_PARTS[part]().map, DOOR_VOXEL), [part]);
  useEffect(() => { window.__doorsBox = box; }, [box]);
  const mat = useMemo(() => voxelMaterial(), []);
  const cx = (box.x0 + box.w / 2) * DOOR_VOXEL, cy = (box.y0 + box.h / 2) * DOOR_VOXEL;
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        orthographic shadows={{ type: PCFShadowMap }} dpr={1}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        camera={{ position: [cx, cy, 20], near: 0.1, far: 100 }}
      >
        <Frame width={box.w * DOOR_VOXEL} cx={cx} cy={cy} />
        <hemisphereLight args={['#B4C6EA', '#4A3424', 1.0]} />
        <Moon cx={cx} cy={cy} />
        {/* A lantern hanging off to the left, out of the picture: warm light falling across the doors. */}
        <pointLight position={[cx - 1.6, cy + 1.3, 1.6]} color="#FFB45A" intensity={9} distance={9} decay={1.6} />
        <mesh geometry={geo} material={mat} castShadow receiveShadow />
      </Canvas>
    </div>
  );
}

/** Points the camera at the part, so its width fills the canvas exactly, and says when a few frames have drawn. */
function Frame({ width, cx, cy }: { width: number; cx: number; cy: number }) {
  const { camera, size } = useThree();
  const frames = useRef(0);
  useEffect(() => {
    camera.zoom = size.width / width;
    camera.lookAt(cx, cy, 0);
    camera.updateProjectionMatrix();
  }, [camera, size, width, cx, cy]);
  useFrame(() => { if (++frames.current === 6) window.__doorsReady = true; });
  return null;
}

/** Cold moonlight from the upper left, casting the trim's, hinges' and wreath's shadows on the boards. */
function Moon({ cx, cy }: { cx: number; cy: number }) {
  const ref = useRef<DirectionalLight>(null);
  useEffect(() => {
    const l = ref.current!;
    l.target.position.set(cx, cy, 0);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -4; cam.right = 4; cam.top = 4; cam.bottom = -4; cam.near = 0.1; cam.far = 40;
    cam.updateProjectionMatrix();
  }, [cx, cy]);
  return (
    <directionalLight
      ref={ref} position={[cx - 3, cy + 4, 7]} color="#DDE7FF" intensity={2.4} castShadow
      shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.0004} shadow-normalBias={0.01}
    />
  );
}
