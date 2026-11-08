import photo from '../assets/kaiyan-forehead.png';

/**
 * The admin avatar: the photo and nothing else, the picture itself never touched: no ring, no frame. It has no thickness,
 * the same photo on both faces, and it wiggles, hops now and then, and every so often turns right round (or turns when pointed at). The motion
 * is all CSS (`.sk-photo` in skin.css) and stops under reduce-motion.
 */
export function PhotoAvatar({ size = 30, label, still }: { size?: number; label?: string; still?: boolean }) {
  return (
    <span className="sk-photo" style={{ '--s': `${size}px` } as React.CSSProperties} role="img" aria-label={label ?? 'Kaiyan'} data-lively={still ? undefined : ''}>
      <span className="sk-photo-jump"><span className="sk-photo-wiggle"><span className="sk-photo-spin">
        <img className="sk-photo-face" src={photo} alt="" draggable={false} />
        <img className="sk-photo-face sk-photo-back" src={photo} alt="" draggable={false} />
      </span></span></span>
    </span>
  );
}
