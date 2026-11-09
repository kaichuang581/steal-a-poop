import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import chicken from '../assets/heads/chicken.png';
import cow from '../assets/heads/cow.png';
import goat from '../assets/heads/goat.png';
import horse from '../assets/heads/horse.png';
import pig from '../assets/heads/pig.png';
import sheep from '../assets/heads/sheep.png';
import type { Animal } from '../voxel/animals';
import { byId } from './catalog';
import { PhotoAvatar } from './PhotoAvatar';

/** The animals' heads, pixel art from Brian (2026-11-09), cut from one sheet with their own transparency. */
const HEADS: Record<Animal, string> = { sheep, pig, cow, goat, horse, chicken };

/** A picked avatar at `size` px: the animal's pixel head, or the admin's photo. Nothing for an unknown id. */
export function AvatarIcon({ id, size = 30, label }: { id: string; size?: number; label?: string }) {
  if (id === ADMIN_AVATAR_ID) return <PhotoAvatar size={size} label={label} />;
  const c = byId(id);
  if (!c) return null;
  return <img src={HEADS[c.animal]} width={size} height={size} alt={label ?? c.name} draggable={false} className="sk-avatar-head" />;
}
