import { ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID, isAdminAvatar } from '../../avatars/ids';
import admin2Photo from '../assets/admin2.png';
import admin3Photo from '../assets/admin3-forehead.png';
import kaiyanPhoto from '../assets/kaiyan-forehead.png';
import { pictureHeight } from './kaiyanLook';

/**
 * The admin-only photo avatars (src/avatars/ids.ts): Kaiyan's and the third one, each with a stretched forehead and glare
 * (src/skin/avatars/kaiyanLook.ts), and the second one (requested by Brian, 2026-11-20), the plain photo: a flat
 * square circle-cropped picture, no stretch and no glare, nothing but the picture. Both are drawn by `AvatarDisc`
 * at the table and `PhotoAvatar` in the interface.
 */

/** The plain photo is a 512 x 512 circle; at the table it stands this many metres across and tall. */
export const PLAIN_PHOTO = { size: 1.2 } as const;

export const isPlainPhoto = (id: string | null | undefined): boolean => id === ADMIN2_AVATAR_ID;

/** Kaiyan's and the third avatar's pictures are tall: hair, a forehead band that stretches, then the face (512 x 1339,
 *  the same three slices), each with its own forehead length and glare (src/skin/avatars/kaiyanLook.ts). */
export const isTallPhoto = (id: string | null | undefined): boolean => id !== null && id !== undefined && id !== ADMIN2_AVATAR_ID && isAdminAvatar(id);

/** The picture file an admin avatar wears. */
export const photoUrlFor = (id: string | null | undefined): string => (id === ADMIN2_AVATAR_ID ? admin2Photo : id === ADMIN3_AVATAR_ID ? admin3Photo : kaiyanPhoto);

/** How tall the picture stands at the table, in metres (`length` is that avatar's forehead setting, which the plain photo ignores). */
export const photoHeight = (id: string | null | undefined, length: number): number => (isPlainPhoto(id) ? PLAIN_PHOTO.size : pictureHeight(length));
