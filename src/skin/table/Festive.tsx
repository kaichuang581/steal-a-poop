import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BULB_COLORS, BULB_GROUPS } from '../scene/festive';
import type { FestiveGeometry } from '../scene/festive';
import { voxelMaterial } from '../voxel/material';
import { hash3 } from '../voxel/primitives';

/**
 * The decorations. Every bulb belongs to one of several groups per colour, scattered at random, and each group twinkles
 * at its own speed and moment with two waves on top of each other, so no two neighbours keep step and nothing flashes
 * in unison. The star holds steady. Under reduced motion every bulb holds steady.
 */
export function Festive({ geo, reduced }: { geo: FestiveGeometry; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const star = useMemo(() => voxelMaterial({ emissive: BULB_COLORS[2], emissiveIntensity: 1.1 }), []);
  const glow = useMemo(() => geo.bulbs.map((_, k) => ({
    mat: voxelMaterial({ emissive: BULB_COLORS[Math.floor(k / BULB_GROUPS)], emissiveIntensity: 0.9 }),
    speed: 0.9 + hash3(k, 1, 0, 401) * 2.6,
    phase: hash3(k, 2, 0, 403) * Math.PI * 2,
  })), [geo]);
  useEffect(() => () => { mat.dispose(); star.dispose(); glow.forEach((g) => g.mat.dispose()); }, [mat, star, glow]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    for (const g of glow) {
      const wave = Math.sin(t * g.speed + g.phase) * 0.6 + Math.sin(t * g.speed * 0.43 + g.phase * 1.7) * 0.4;
      g.mat.emissiveIntensity = 0.85 + wave * 0.5;
    }
  });
  return (
    <>
      <mesh geometry={geo.decor} material={mat} castShadow receiveShadow />
      <mesh geometry={geo.star} material={star} />
      {geo.bulbs.map((g, i) => <mesh key={i} geometry={g} material={glow[i].mat} />)}
    </>
  );
}
