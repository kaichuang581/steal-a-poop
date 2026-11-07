import { useEffect, useMemo, useState } from 'react';
import type { Animal } from '../avatars/catalog';
import { buildFarmstead } from '../scene/farmstead';
import type { Farmstead as Built } from '../scene/farmstead';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { Sheep } from './Sheep';
import type { SheepState } from './Sheep';
import type { World } from './BarnTable';

let built: Built | null = null;

/** Who lives on the farm: [animal, x, z, facing, state]. Phones keep the first few. */
const LIVESTOCK: [Animal, number, number, number, SheepState][] = [
  ['cow', 15.2, 2.2, 2.4, 'grazing'],
  ['horse', 19.4, -1.2, -1.9, 'idle'],
  ['chicken', -12.6, 5.2, 0.5, 'grazing'],
  ['sheep', 14.2, -6.4, 0.9, 'grazing'],
  ['cow', 18.8, 3.6, -2.6, 'idle'],
  ['goat', 13.8, -1.8, 1.5, 'idle'],
  ['chicken', -10.6, 6.2, -0.9, 'idle'],
  ['chicken', -14.8, 6.4, 2.2, 'grazing'],
  ['pig', -15.6, -2.4, 1.1, 'grazing'],
  ['sheep', 17.8, -7.4, -0.8, 'idle'],
];

/**
 * Everything the start screen's farm has that the game's table does not: see scene/farmstead.ts. Built after the
 * first paint, like the world, and only ever mounted on the start screen.
 */
export function Farmstead({ world, reduced, phone }: { world: World; reduced: boolean; phone: boolean }) {
  const [farm, setFarm] = useState(built);
  const mat = useMemo(() => voxelMaterial(), []);
  useEffect(() => {
    if (built) return;
    const id = setTimeout(() => { built ??= buildFarmstead(); setFarm(built); }, 0);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <>
      {/* The range the yard looks at, turned round to stand behind the barn as well. */}
      <mesh geometry={world.distance.mountains} material={mat} rotation={[0, Math.PI, 0]} />
      {farm && (
        <>
          <mesh geometry={farm.shell} material={mat} castShadow receiveShadow />
          {farm.props.map((g, i) => <mesh key={`p${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
          {farm.fine.map((g, i) => <mesh key={`f${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
          <mesh geometry={farm.terrain} material={mat} receiveShadow />
        </>
      )}
      {(phone ? LIVESTOCK.slice(0, 3) : LIVESTOCK).map(([animal, x, z, facing, state], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, facing, 0]} scale={1.5}>
          <Sheep level={2} state={state} reduced={reduced} model={animal === 'sheep' ? undefined : animalModel(animal)} />
        </group>
      ))}
    </>
  );
}
