import { byId } from '../../avatars/catalog';
import type { Animal } from '../../avatars/catalog';
import { sheepModel } from '../sheep';
import { chickenModel } from './chicken';
import { cowModel } from './cow';
import { goatModel } from './goat';
import { horseModel } from './horse';
import { pigModel } from './pig';
import type { VoxelMap } from '../mesher';
import type { AnimalModel } from './rig';
import { statsOf } from './rig';
import { wornItem } from './worn';

export type { Animal } from '../../avatars/catalog';
export type { AnimalModel } from './rig';

/** The sheep as an `AnimalModel`: its own model, untouched (V5 Part 10). */
function sheepAsAnimal(): AnimalModel {
  const m = sheepModel();
  const c = (p: { cells?: VoxelMap } | undefined): VoxelMap => p?.cells ?? new Map();
  // The sheep's torso is its fleece: the wool at the normal coat, as the proportion sheet measures it (V5.1 Part 4.1).
  const cells = {
    body: c(m.wools[2]), head: c(m.head), hood: c(m.hood), eye0: c(m.eyes[0]), eye1: c(m.eyes[1]), ear0: c(m.ears[0]), ear1: c(m.ears[1]),
    leg0: c(m.legs[0]), leg1: c(m.legs[1]), leg2: c(m.legs[2]), leg3: c(m.legs[3]), tail: c(m.tail), collar: c(m.collar), bell: c(m.bell),
  };
  const parts = [m.wools[2], m.head, m.hood, m.tail, ...m.eyes, ...m.ears, ...m.legs, m.collar, m.bell];
  return { ...m, species: 'sheep', bodyAlways: false, signature: [], height: 1.0, length: 0.9, drawScale: 1, stats: statsOf(parts, []), cells, coatCells: { 0: new Map(), 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map() } };
}

const BUILDERS: Partial<Record<Animal, (c: NonNullable<ReturnType<typeof byId>>) => AnimalModel>> = { pig: pigModel, cow: cowModel, horse: horseModel, goat: goatModel, chicken: chickenModel };
const cache = new Map<Animal, AnimalModel>();

/** The model for an animal avatar (its character's colours), built once each and shared. Unbuilt species fall back to the sheep. */
export function animalModel(animal: Animal): AnimalModel {
  const hit = cache.get(animal);
  if (hit) return hit;
  const ch = byId(animal);
  const build = BUILDERS[animal];
  const m = animal === 'sheep' || !ch || !build ? sheepAsAnimal() : build(ch);
  if (ch?.worn) {
    const box = m.head.geo.boundingBox ?? (m.head.geo.computeBoundingBox(), m.head.geo.boundingBox);
    m.worn = wornItem(ch.worn, box ? box.max.x - box.min.x : 0.4, ch.wornColor ?? ch.colors.pop);
  }
  cache.set(animal, m);
  return m;
}

/** How tall the animal stands against the sheep, for the speaker camera's aim. */
export function heightRatio(animal: Animal): number {
  return animalModel(animal).height / animalModel('sheep').height;
}
