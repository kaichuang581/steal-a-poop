import { byId } from '../../avatars/catalog';
import type { Animal } from '../../avatars/catalog';
import { sheepModel } from '../sheep';
import { chickenModel } from './chicken';
import { cowModel } from './cow';
import { goatModel } from './goat';
import { horseModel } from './horse';
import { pigModel } from './pig';
import type { AnimalModel } from './rig';
import { wornItem } from './worn';

export type { Animal } from '../../avatars/catalog';
export type { AnimalModel } from './rig';

/** The sheep as an `AnimalModel`: its own model, untouched (V5 Part 10). */
function sheepAsAnimal(): AnimalModel {
  const m = sheepModel();
  return { ...m, species: 'sheep', bodyAlways: false, signature: [], height: 1.0, length: 0.9, drawScale: 1, stats: { voxels: m.voxels, triangles: 0, colours: 0, parts: 0 }, cells: {}, coatCells: { 0: new Map(), 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map() } };
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
