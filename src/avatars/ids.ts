/**
 * The avatars a player can choose: six farm animals, one each. The server only checks that an id is on this list; the art
 * and the descriptions are in src/skin/avatars/catalog.ts, which has a test that keeps the two in step. The animals' names
 * are just the animals'. The one exception is the admin avatar: Brian's own photo, equipped only from the admin panel
 * (src/skin/components/AdminPanel.tsx) and never offered in the picker; it is on this list so the others in a room see it.
 */
export const ANIMAL_AVATAR_IDS = ['sheep', 'pig', 'cow', 'goat', 'horse', 'chicken'] as const;
export const ADMIN_AVATAR_ID = 'kaiyan';
/** The second admin avatar (requested by Brian, 2026-11-20): another photo, flat and plain (no stretched forehead, no glare). */
export const ADMIN2_AVATAR_ID = 'admin2';
/** Every admin-only avatar: equipped only from the admin panel and never offered in the picker. */
/** The third admin avatar (requested by Brian, 2026-11-21): another photo with Kaiyan's long forehead and glare, each adjustable. */
export const ADMIN3_AVATAR_ID = 'admin3';
/** The fourth admin avatar (requested by Brian, 2026-11-21): a tall photo whose sliders go to 12x, with an age slider (darker and wrinklier, 0 to 12x). */
export const ADMIN4_AVATAR_ID = 'admin4';
export const ADMIN_AVATAR_IDS = [ADMIN_AVATAR_ID, ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID, ADMIN4_AVATAR_ID] as const;
export const AVATAR_IDS = [...ANIMAL_AVATAR_IDS, ...ADMIN_AVATAR_IDS] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
export const isAvatarId = (v: unknown): v is AvatarId => typeof v === 'string' && (AVATAR_IDS as readonly string[]).includes(v);

/**
 * Juan's orange amount reaches other players on the avatar they are shown: the server writes `admin2~12` for Juan at 60%
 * (twentieths, 1 to 20; none at 0) in a room's member list. A browser never sends that form: it sends the plain id and the
 * amount apart, and the server builds this one. Everything that reads an id for what it IS goes through `baseAvatarId`.
 */
export const ORANGE_STEPS = 20;
/** The avatar without any orange suffix. */
export const baseAvatarId = (v: string | null | undefined): string | null => (typeof v === 'string' ? v.split('~', 1)[0] : null);
/** Juan's id with an orange amount (0 to 1, in twentieths) on it; any other id comes back as it was. */
export function withOrange(id: string, orange: unknown): string {
  if (id !== ADMIN2_AVATAR_ID || typeof orange !== 'number' || !Number.isFinite(orange)) return id;
  const n = Math.min(ORANGE_STEPS, Math.max(0, Math.round(orange * ORANGE_STEPS)));
  return n > 0 ? `${id}~${n}` : id;
}
/** The fourth avatar's age amount (0 to 12, in halves) on his id, like Juan's orange: `admin4~24` is 12x. */
export const AGE_STEPS = 24;
export function withAge(id: string, age: unknown): string {
  if (id !== ADMIN4_AVATAR_ID || typeof age !== 'number' || !Number.isFinite(age)) return id;
  const n = Math.min(AGE_STEPS, Math.max(0, Math.round(age * 2)));
  return n > 0 ? `${id}~${n}` : id;
}
export function ageOf(id: string | null | undefined): number | null {
  if (typeof id !== 'string') return null;
  const m = /^admin4~(\d{1,2})$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= AGE_STEPS ? n / 2 : null;
}

/** The orange amount (0 to 1) an avatar id carries, or null when it carries none. */
export function orangeOf(id: string | null | undefined): number | null {
  if (typeof id !== 'string') return null;
  const m = /^admin2~(\d{1,2})$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= ORANGE_STEPS ? n / ORANGE_STEPS : null;
}

/** True for the admin-only photo avatars (with or without an orange amount). */
export const isAdminAvatar = (v: unknown): boolean => typeof v === 'string' && (ADMIN_AVATAR_IDS as readonly string[]).includes(baseAvatarId(v) as string);
