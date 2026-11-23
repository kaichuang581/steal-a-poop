import { isAdminAvatar } from '../../avatars/ids';
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

/** A picked avatar at `size` px: the animal's pixel head, or an admin's photo. Nothing for an unknown id. */
/** Brian's sheep head (his sheet of six, 2026-11-09): the sheep for anyone with no avatar on, wherever a sheep is shown. */
export function SheepHead({ size = 30, label = '' }: { size?: number; label?: string }) {
  return <img src={HEADS.sheep} width={size} height={size} alt={label} draggable={false} className="sk-avatar-head" />;
}

export function AvatarIcon({ id, size = 30, label }: { id: string; size?: number; label?: string }) {
  if (isAdminAvatar(id)) return <PhotoAvatar size={size} label={label} avatar={id} />;
  const c = byId(id);
  if (!c) return null;
  return <img src={HEADS[c.animal]} width={size} height={size} alt={label ?? c.name} draggable={false} className="sk-avatar-head" />;
}

const PX_HEADS = import.meta.glob('../assets/heads/px/*.png', { eager: true, import: 'default', query: '?no-inline' }) as Record<string, string>;
/**
 * An avatar drawn at a whole multiple of its own pixel size (docs/pen/PEN-PLAN-V3.md, 2.3.6): the same heads, cut back
 * to one image pixel an art pixel (assets/heads/px, recovered from the sheet's cells), shown at the largest whole
 * multiple that fits `box` CSS pixels, never smoothed. The admin's photo is drawn as AvatarIcon draws it.
 */
export function PixelHead({ id, box, label = '' }: { id: string; box: number; label?: string }) {
  if (isAdminAvatar(id)) return <PhotoAvatar size={box} label={label} avatar={id} />;
  const animal = byId(id)?.animal ?? 'sheep';
  const src = PX_HEADS[`../assets/heads/px/${animal}.png`];
  return <img src={src} alt={label} draggable={false} className="sk-pixel-head" data-box={box} style={{ imageRendering: 'pixelated' }}
    onLoad={(e) => { const im = e.currentTarget, k = Math.max(1, Math.floor(box / Math.max(im.naturalWidth, im.naturalHeight))); im.style.width = `${im.naturalWidth * k}px`; im.style.height = `${im.naturalHeight * k}px`; }} />;
}
