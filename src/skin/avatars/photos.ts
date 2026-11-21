import { ADMIN2_AVATAR_ID, ADMIN3_AVATAR_ID, isAdminAvatar } from '../../avatars/ids';
import admin2Photo from '../assets/admin2-forehead.png';
import admin3Photo from '../assets/admin3-forehead.png';
import kaiyanPhoto from '../assets/kaiyan-forehead.png';
import { pictureHeight } from './kaiyanLook';

/**
 * The admin-only photo avatars (src/avatars/ids.ts): Kaiyan's, the second (Juan) and the third. All three are the same
 * kind of picture: tall (512 x 1339), made of three slices (hair, a forehead band that stretches, the face), each with
 * its own forehead length and glare (src/skin/avatars/kaiyanLook.ts), and Juan's with an orange slider besides
 * (src/skin/avatars/orange.ts). `AvatarDisc` draws them at the table and `PhotoAvatar` in the interface.
 */

/** Every admin avatar wears a tall picture. */
export const isTallPhoto = (id: string | null | undefined): boolean => isAdminAvatar(id);

/** The picture file an admin avatar wears. */
export const photoUrlFor = (id: string | null | undefined): string => (id === ADMIN2_AVATAR_ID ? admin2Photo : id === ADMIN3_AVATAR_ID ? admin3Photo : kaiyanPhoto);

/** How tall the picture stands at the table, in metres (`length` is that avatar's forehead setting). */
export const photoHeight = (_id: string | null | undefined, length: number): number => pictureHeight(length);
