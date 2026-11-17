/** The speaker's body for the board search and the framing tests: an animal's measured box and plate (a test helper, not a test). */
import { anchorsOf } from '../../voxel/animals/anchors';
import { animalModel } from '../../voxel/animals';
import type { Animal } from '../../avatars/catalog';
import { SHEEP_SCALE } from '../layout';
import type { SpeakerBody } from '../layout';

export function bodyOf(animal: Animal = 'sheep'): SpeakerBody {
  const m = animalModel(animal), a = anchorsOf(m);
  return { min: a.bounds.min, max: a.bounds.max, plate: a.plate, scale: SHEEP_SCALE * m.drawScale, ratio: m.height / animalModel('sheep').height };
}
