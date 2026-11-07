import { ADMIN_AVATAR_ID } from '../../avatars/ids';
import { byId } from './catalog';
import { PhotoAvatar } from './PhotoAvatar';
import { PORTRAIT } from './portraits';

/** A picked avatar at `size` px: an animal's pixel portrait, or the admin's photo. Nothing for an unknown id. */
export function AvatarIcon({ id, size = 30, label }: { id: string; size?: number; label?: string }) {
  if (id === ADMIN_AVATAR_ID) return <PhotoAvatar size={size} label={label} />;
  const c = byId(id);
  if (!c) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" role="img" aria-label={label ?? `${c.name}`}>
      {PORTRAIT[c.animal].map(([x, y, w, h, k], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c.colors[k]} />)}
    </svg>
  );
}
