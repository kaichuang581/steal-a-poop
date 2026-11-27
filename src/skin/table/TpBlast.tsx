import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Vector3 } from 'three';
import { voxelMaterial } from '../voxel/material';
import { makeBurst, TOTAL_MS } from '../tp/burst';

/**
 * The worn burst (docs/trading-post-practice/T3) where the bomb went off: the pack's pieces flying out by 300 ms and
 * gone by 1,400 ms, turned to face the camera, sized to the bomb that burst (`scale`: the bomb's width over the
 * pack's 0.5 m). Nothing random. Reduced motion: the fullest moment held, then faded (makeBurst's rule).
 */
export function TpBlast({ boomKey, origin, burst, reduced, scale }: { boomKey: number | undefined; origin: () => Vector3 | null; burst: string; reduced: boolean; scale: number }) {
  const lit = useMemo(() => voxelMaterial({}), []);
  const b = useMemo(() => makeBurst(burst, { lit }), [burst, lit]);
  const st = useRef({ key: boomKey, at: -1e9 });
  useEffect(() => { b.at(-1); }, [b]);
  useFrame(({ camera }) => {
    if (boomKey !== st.current.key) {
      st.current = { key: boomKey, at: performance.now() };
      const o = origin();
      if (o) b.group.position.set(o.x, 0, o.z);
      b.group.rotation.set(0, Math.atan2(camera.position.x - b.group.position.x, camera.position.z - b.group.position.z), 0);
      b.group.scale.setScalar(scale);
    }
    const ms = performance.now() - st.current.at;
    b.at(ms <= TOTAL_MS ? ms : -1, reduced);
  });
  return <primitive object={b.group} />;
}
