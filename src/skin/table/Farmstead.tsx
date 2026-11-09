import { useLoadingHold } from '../components/BarnDoors';
import { useEffect, useMemo, useState } from 'react';
import type { Animal } from '../avatars/catalog';
import { buildCountryside } from '../scene/countryside';
import type { Countryside } from '../scene/countryside';
import { buildFarmFestive } from '../scene/festive';
import { buildFarmstead } from '../scene/farmstead';
import type { Farmstead as Built } from '../scene/farmstead';
import { animalModel } from '../voxel/animals';
import { voxelMaterial } from '../voxel/material';
import { Festive } from './Festive';
import { Sheep } from './Sheep';
import type { SheepState } from './Sheep';
import type { World } from './BarnTable';

let built: Built | null = null;
let land: Countryside | null = null;
/** Whether the farm and the land round it are already built this session (coming back to Home: no wait, no fade). */
export const farmReady = () => !!built && !!land;

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
  // A few of the flock let out on the open ground.
  ['sheep', -24, 19, 0.6, 'grazing'],
  ['sheep', -27.5, 21.5, 2.4, 'idle'],
  ['sheep', -21.5, 23, -1.2, 'grazing'],
];

/**
 * Everything the start screen's farm has that the game's table does not: see scene/farmstead.ts. Built after the
 * first paint, like the world, and only ever mounted on the start screen.
 */
export function Farmstead({ world, reduced, phone, onReady }: { world: World; reduced: boolean; phone: boolean; onReady?: (ready: boolean) => void }) {
  const [farm, setFarm] = useState(built);
  const [country, setCountry] = useState(land);
  const mat = useMemo(() => voxelMaterial(), []);
  useEffect(() => {
    if (built) return;
    const id = setTimeout(() => { built ??= buildFarmstead(); setFarm(built); }, 0);
    return () => clearTimeout(id);
  }, []);
  // After the farm, in its own step, so the page never stalls for both at once.
  useEffect(() => {
    if (land || !farm) return;
    const id = setTimeout(() => { land ??= buildCountryside(); setCountry(land); }, 0);
    return () => clearTimeout(id);
  }, [farm]);
  useEffect(() => () => mat.dispose(), [mat]);
  // The first time Home opens, the loading screen stays up until the farm and the land round it are built, so nothing
  // pops in after the doors open. Both are kept for the session, so coming back to Home never waits.
  // Joins the first load's doors (never brings them down itself: a refresh has none, and the farm fades in instead).
  useLoadingHold('farm', !farm || !country, 'Building the farm', true, false);
  useEffect(() => { onReady?.(!!farm && !!country); }, [farm, country, onReady]);
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
          <Festive geo={buildFarmFestive()} reduced={reduced} />
          {country && (
            <>
              {[...country.woods, ...country.scrub].map((g, i) => <mesh key={`c${i}`} geometry={g} material={mat} castShadow receiveShadow />)}
              {country.forest.map((g, i) => <mesh key={`w${i}`} geometry={g} material={mat} receiveShadow />)}
              {country.drifts.map((g, i) => <mesh key={`d${i}`} geometry={g} material={mat} receiveShadow />)}
              <mesh geometry={country.tracks} material={mat} receiveShadow />
            </>
          )}
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
