import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { ACESFilmicToneMapping, DoubleSide, MeshBasicMaterial, Shape, SRGBColorSpace } from 'three';
import type { OrthographicCamera } from 'three';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { isSackId } from './sacks';
import type { SackId } from './sacks';
import { crateGrid, sackInCrate, STALL_VOXEL, stallGrid, stallLanternGrid, valanceGrid } from './stallModels';
import { CRATE, CRATE_BOX, CRATE_TILT, frame, LANTERN_BOX, STALL_PITCH, STALLS, valanceBox } from './stallPlan';
import type { StallSize } from './stallPlan';

declare global {
  interface Window { __stallBox?: { w: number; h: number }; __stallReady?: boolean }
}
/** A picture's edges: voxels across from `x`, rows up from `bottom`. */
interface Box { x: number; bottom: number; w: number; h: number }

/**
 * ?preview=stall&size=wide|low|mid|narrow&layer=back|valance|crate-<sack>|sack-<sack>|lantern: one layer of the Feed
 * Sacks' market stall, seen from the front and a little above, under the thumbnails' own three lights, framed edge to
 * edge on its box (stallPlan.ts), for tools/renderStall.mjs to bake into public/shop/stall. Never shown to players.
 */
export default function StallRender() {
  const q = new URLSearchParams(location.search);
  const size = (q.get('size') ?? 'wide') as StallSize, layer = q.get('layer') ?? 'back';
  const p = STALLS[size] ?? STALLS.wide;
  const sack = layer.includes('-') && isSackId(layer.split('-')[1]) ? (layer.split('-')[1] as SackId) : null;
  const box: Box = layer === 'back' ? { x: 0, bottom: frame(p).bottom, w: p.w, h: frame(p).h }
    : layer === 'valance' ? { x: 0, bottom: valanceBox(p).bottom, w: p.w, h: valanceBox(p).h }
    : layer === 'lantern' ? { x: -LANTERN_BOX.w / 2, bottom: LANTERN_BOX.above - LANTERN_BOX.h, w: LANTERN_BOX.w, h: LANTERN_BOX.h }
    : { x: -CRATE_BOX.w / 2, bottom: -CRATE_BOX.below, w: CRATE_BOX.w, h: CRATE_BOX.h };
  useEffect(() => { window.__stallBox = { w: box.w, h: box.h }; }, [box.w, box.h]);
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        orthographic dpr={1}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
        camera={{ position: [0, 0, 20], near: 0.1, far: 100 }}
      >
        <Frame box={box} />
        {/* The thumbnails' lights (ThumbRender), so a sack in its crate is lit as the cards under the stall are. */}
        <hemisphereLight args={['#FFF1DC', '#6A5648', 1.25]} />
        <directionalLight position={[-3, 5, 4]} color="#FFE2B8" intensity={2.4} />
        <directionalLight position={[4, 1.5, -2]} color="#BCD8FF" intensity={0.7} />
        {/* The lantern's light: two flat, hard-edged rings of warm colour behind it, facing the camera. No soft glow. */}
        {layer === 'lantern' && [[5, 0.1], [3.4, 0.2]].map(([r, opacity]) => (
          <mesh key={r} position={[0.5 * STALL_VOXEL, -5.4 * STALL_VOXEL, -1]} rotation={[0, 0, Math.PI / 8]}>
            <circleGeometry args={[r * STALL_VOXEL, 8]} />
            <meshBasicMaterial color="#ffb43c" transparent opacity={opacity} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        <group rotation={[STALL_PITCH, 0, 0]}>
          {layer === 'back' && <Voxels grid={() => stallGrid(p)} />}
          {layer === 'valance' && <Voxels grid={() => valanceGrid(p)} />}
          {layer === 'lantern' && <Voxels grid={stallLanternGrid} unlit />}
          {sack && <Crate sack={sack} part={layer.startsWith('sack') ? 'sack' : 'crate'} />}
        </group>
      </Canvas>
    </div>
  );
}

/** Points the camera square at the box, so it fills the canvas exactly, and says when a few frames have drawn. */
function Frame({ box }: { box: Box }) {
  const { camera, size } = useThree();
  const frames = useRef(0);
  useEffect(() => {
    const cam = camera as OrthographicCamera, cx = (box.x + box.w / 2) * STALL_VOXEL, cy = (box.bottom + box.h / 2) * STALL_VOXEL;
    cam.position.set(cx, cy, 20);
    cam.zoom = size.width / (box.w * STALL_VOXEL);
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, box]);
  useFrame(() => { if (++frames.current === 6) window.__stallReady = true; });
  return null;
}

function Voxels({ grid, unlit, hidden }: { grid: () => { map: Parameters<typeof buildGeometry>[0]; size: number }; unlit?: boolean; hidden?: boolean }) {
  const geo = useMemo(() => { const g = grid(); return buildGeometry(g.map, g.size); }, [grid]);
  // `hidden` draws nothing but still stands in the way: the crate in front of its sack, in the sack's own picture.
  const mat = useMemo(() => (hidden ? new MeshBasicMaterial({ colorWrite: false }) : unlit ? new MeshBasicMaterial({ vertexColors: true }) : voxelMaterial()), [unlit, hidden]);
  return <mesh geometry={geo} material={mat} renderOrder={hidden ? -1 : 0} />;
}

/**
 * One sack's crate, its front foot on the origin, leaning toward the buyer. `crate` is the crate, its grain and the hard
 * shadow it throws on the plank; `sack` is the sack alone, cut off where the crate and the grain stand in front of it,
 * so the page can lay it over the crate's picture and wobble it by itself.
 */
function Crate({ sack, part }: { sack: SackId; part: 'crate' | 'sack' }) {
  const crate = useMemo(() => () => crateGrid(sack), [sack]);
  const inside = useMemo(() => () => sackInCrate(sack), [sack]);
  const shadow = useMemo(() => {
    // On the plank, seen from above: x across, the shape's y toward the buyer. The key light is at the upper left front,
    // so the crate's shadow falls to its right and behind it; a thin dark line shows along its front foot.
    const half = CRATE.w / 2, s = new Shape();
    s.moveTo(-half - 0.3, 1.2); s.lineTo(half + 0.3, 1.2); s.lineTo(half + 2.6, -1.6); s.lineTo(half + 4.4, -CRATE.d + 1); s.lineTo(-half - 0.3, -CRATE.d + 1);
    s.closePath();
    return s;
  }, []);
  const dark = useMemo(() => new MeshBasicMaterial({ color: '#2a1608', transparent: true, opacity: 0.5, depthWrite: false, side: DoubleSide }), []);
  return (
    <>
      {part === 'crate' && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} scale={STALL_VOXEL} material={dark} renderOrder={-2}>
          <shapeGeometry args={[shadow]} />
        </mesh>
      )}
      <group rotation={[CRATE_TILT, 0, 0]}>
        <group position={[0, 0, -CRATE.d * STALL_VOXEL]}>
          <Voxels grid={crate} hidden={part === 'sack'} />
          {part === 'sack' && <Voxels grid={inside} />}
        </group>
      </group>
    </>
  );
}
