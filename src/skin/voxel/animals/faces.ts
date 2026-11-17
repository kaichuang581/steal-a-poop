/**
 * The face switches (plan file 03, change 4.11): each milestone 6 row a named constant in its species file, all false,
 * so today's faces are built. Brian ticks rows on the face sheet (4.10, `?preview=faces`); milestone 6 flips the ticked
 * constants and nothing else.
 *
 * A builder reads a switch as `CONSTANT || faces.has(name)`. `faces` is empty in the game. The face sheet builds each
 * species twice, today and with all its switches on (`animalModelWith`). In development only, `?preview=...&faces=a,b`
 * turns switches on for the preview pages; the production build has no such reading (DEV is false there, so
 * `devFaces` is never called and falls out of the bundle).
 */
export type FaceSwitch =
  | 'sheepEyes' | 'sheepFleece'
  | 'cowNoGlint'
  | 'goatMouth' | 'goatHorns'
  | 'horseNose' | 'horseEyes' | 'horseNeck'
  | 'chickenTail';
export type Faces = ReadonlySet<FaceSwitch>;

export const NO_FACES: Faces = new Set();

/** Each species' rows, in the order the face sheet lists them. The pig has none: its row is the shape switch alone. */
export const SPECIES_FACES = {
  sheep: ['sheepFleece', 'sheepEyes'], pig: [], cow: ['cowNoGlint'], horse: ['horseNose', 'horseEyes', 'horseNeck'],
  goat: ['goatMouth', 'goatHorns'], chicken: ['chickenTail'],
} as const satisfies Record<string, readonly FaceSwitch[]>;

function devFaces(): Faces {
  if (typeof location === 'undefined') return NO_FACES;
  const ALL = new Set<string>(Object.values(SPECIES_FACES).flat());
  const q = new URLSearchParams(location.search);
  if (!q.get('preview')) return NO_FACES;
  return new Set((q.get('faces') ?? '').split(',').filter((f): f is FaceSwitch => ALL.has(f)));
}

/** What the builders read by default: nothing in the game, `?faces=` on a development preview page. */
export const DEFAULT_FACES: Faces = import.meta.env.DEV ? devFaces() : NO_FACES;

/** A stable key for a set of switches (the model caches). */
export const facesKey = (f: Faces) => [...f].sort().join(',');
