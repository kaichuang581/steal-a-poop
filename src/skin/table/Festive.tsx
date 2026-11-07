import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BULB_COLORS } from '../scene/festive';
import type { FestiveGeometry } from '../scene/festive';
import { voxelMaterial } from '../voxel/material';

/** The decorations, with each colour of bulb twinkling a beat behind the last (steady under reduced motion). */
export function Festive({ geo, reduced }: { geo: FestiveGeometry; reduced: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => BULB_COLORS.map((c) => voxelMaterial({ emissive: c, emissiveIntensity: 0.9 })), []);
  useEffect(() => () => { mat.dispose(); glow.forEach((m) => m.dispose()); }, [mat, glow]);
  useFrame(({ clock }) => {
    if (reduced) return;
    glow.forEach((m, i) => { m.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 2.2 + i * 2.1) * 0.45; });
  });
  return (
    <>
      <mesh geometry={geo.decor} material={mat} castShadow receiveShadow />
      {geo.bulbs.map((g, i) => <mesh key={i} geometry={g} material={glow[i]} />)}
    </>
  );
}
