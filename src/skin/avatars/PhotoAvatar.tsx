import { isPlainPhoto, photoUrlFor } from './photos';

/**
 * The admin avatars: the photo and nothing else, the picture itself never touched: no ring, no frame. It has no thickness,
 * the same photo on both faces, and it wiggles, hops now and then, and every so often turns right round (or turns when pointed at). The motion
 * is all CSS (`.sk-photo` in skin.css) and stops under reduce-motion.
 */
export function PhotoAvatar({ size = 30, label, still, avatar }: { size?: number; label?: string; still?: boolean; avatar?: string | null }) {
  const plain = isPlainPhoto(avatar);
  const photo = photoUrlFor(avatar);
  return (
    <span className="sk-photo" style={{ '--s': `${size}px` } as React.CSSProperties} role="img" aria-label={label ?? (plain ? 'Admin' : 'Kaiyan')} data-lively={still ? undefined : ''} data-plain={plain ? '' : undefined}>
      <span className="sk-photo-jump"><span className="sk-photo-wiggle"><span className="sk-photo-spin">
        <img className="sk-photo-face" src={photo} alt="" draggable={false} />
        <img className="sk-photo-face sk-photo-back" src={photo} alt="" draggable={false} />
      </span></span></span>
    </span>
  );
}
