/**
 * The avatars a player can choose: six farm animals, one each. The server only checks that an id is on this list; the art
 * and the descriptions are in src/skin/avatars/catalog.ts, which has a test that keeps the two in step. The animals' names
 * are just the animals'. The one exception is the admin avatar: Brian's own photo, equipped only from the admin panel
 * (src/skin/components/AdminPanel.tsx) and never offered in the picker; it is on this list so the others in a room see it.
 */
export const ANIMAL_AVATAR_IDS = ['sheep', 'pig', 'cow', 'goat', 'horse', 'chicken'] as const;
export const ADMIN_AVATAR_ID = 'kaiyan';
export const AVATAR_IDS = [...ANIMAL_AVATAR_IDS, ADMIN_AVATAR_ID] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];
export const isAvatarId = (v: unknown): v is AvatarId => typeof v === 'string' && (AVATAR_IDS as readonly string[]).includes(v);
