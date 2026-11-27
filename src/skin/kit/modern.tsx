import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { CloseIcon } from '../components/Icons';
import { BoardFrame, SnowCap } from './surfaces';
import '../home/home.css';
import './modern.css';

/**
 * The game's current look for its screens' pieces (Brian, 2026-11-23: "address all of the outdated ui ... the ai
 * generated wood textures ... the tip is just a plain white card, the buttons in the corner"): built only from the
 * recipes he approved, Home's slab (home.css) and the pen and leaderboard's board, tile, well and ink card
 * (kit/surfaces.css), and the name tag's small dark label (kit/NamePlate). No planks, nails, paper, stitching or hand
 * font. Each piece brings Home's tokens with it (`hm rc`), so it can sit on any screen.
 */

type Btn = ButtonHTMLAttributes<HTMLButtonElement>;
const join = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** A slab button: wool (the default), lantern (the one thing to press) or night (on a dark board, quiet). */
export const Slab = forwardRef<HTMLButtonElement, Btn & { tone?: 'wool' | 'lantern' | 'night'; size?: 'sm' | 'md' }>(
  function Slab({ tone = 'wool', size = 'md', className, type = 'button', ...rest }, ref) {
    return <button ref={ref} type={type} {...rest} className={join('md-slab hm-slab hm-knit', tone !== 'wool' && `hm-slab--${tone}`, `md-slab--${size}`, className)} />;
  },
);

/** A square slab with an icon, as Home's corner buttons are. */
export const IconSlab = forwardRef<HTMLButtonElement, Btn>(function IconSlab({ className, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type} {...rest} className={join('md-icon hm-slab hm-slab--sm hm-square', className)} />;
});

/** A row of corner buttons with Home's tokens: the game's top right. */
export function Corner({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={join('md-corner hm rc', className)}>{children}</div>;
}

export type TileTone = 'dusk' | 'lantern' | 'barn' | 'pasture' | 'frost';
const TILE: Record<TileTone, string> = { dusk: 'var(--hm-dusk)', lantern: 'var(--hm-lantern-lip)', barn: 'var(--hm-barn)', pasture: 'var(--hm-pasture)', frost: 'var(--hm-night-3)' };
/** A coloured square with an icon in it (the profile's section tiles): what a row or a section is about, at a glance. */
export function IconTile({ tone = 'dusk', children, className }: { tone?: TileTone; children: ReactNode; className?: string }) {
  return <span className={join('md-itile', className)} style={{ ['--tile' as string]: TILE[tone] }} aria-hidden="true">{children}</span>;
}

/** A dialog's title: the profile's lantern ribbon, hung over the board's left edge, an icon and the name on it. */
export function Ribbon({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <h2 className="md-ribbon"><i className="md-ribbon-face" aria-hidden="true" />{icon && <span className="md-ribbon-icon" aria-hidden="true">{icon}</span>}<span>{children}</span></h2>;
}

/**
 * A dialog: the pen's board (felt, inner frame and brackets, snow with icicles), its title on the lantern ribbon and a
 * square close slab. `onClose` absent: no close button (the caller's buttons close it). Every snowy board in the game
 * is this one or built from its parts (Brian, 2026-11-25: "all that snowy blue ui is meant to look similar").
 */
export function Dialog({ title, icon, onClose, closeLabel = 'Close', label, className, children, wide = false, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode; icon?: ReactNode; onClose?: () => void; closeLabel?: string; label?: string; wide?: boolean;
}) {
  return (
    <div {...rest} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)}
      className={join('md-dialog hm rc rc-board', wide && 'md-dialog--wide', className)}>
      <BoardFrame corners={['bl', 'br']} />
      <SnowCap icicles />
      {(title || onClose) && (
        <header className="md-dialog-head">
          {title && <Ribbon icon={icon}>{title}</Ribbon>}
          {onClose && <IconSlab onClick={onClose} aria-label={closeLabel} title={closeLabel} className="md-dialog-close"><CloseIcon size={14} /></IconSlab>}
        </header>
      )}
      <div className="md-dialog-body">{children}</div>
    </div>
  );
}

/** A group of rows under a small heading (Settings' "Comfort", "Help"). */
export function Group({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return <section className={join('md-group', className)}><h3 className="md-group-title">{title}</h3><div className="md-group-rows">{children}</div></section>;
}

/**
 * One row of a board: a raised tile with an icon tile, a name, a line under it saying what it does, and its control on
 * the right. The line is what makes a row readable without guessing; give it whenever the name alone is not the whole story.
 */
export function Row({ icon, tone, label, hint, children, className, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { icon?: ReactNode; tone?: TileTone; label: ReactNode; hint?: ReactNode }) {
  return (
    <div {...rest} className={join('md-rowtile rc-tile', className)}>
      {icon && <IconTile tone={tone}>{icon}</IconTile>}
      <span className="md-rowtext"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      {children && <span className="md-rowend">{children}</span>}
    </div>
  );
}

/** The dim behind a dialog; a click on it closes. */
export function Scrim({ onClose, className, children, style }: { onClose?: () => void; className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={join('md-scrim', className)} style={style} onClick={onClose}>{children}</div>;
}

export type CardTone = 'lantern' | 'frost' | 'barn' | 'pasture';
/**
 * A small dark card over the scene (a notice, a tip, a tutorial step): the ink face with two-pixel corners, a coloured
 * bar down its left (lantern by default; frost for cold, barn for bad news, pasture for good), an icon, a title in
 * Fraunces and a line in Nunito.
 */
export function InkCard({ tone = 'lantern', icon, title, sub, size = 'md', className, children, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: CardTone; icon?: ReactNode; title?: ReactNode; sub?: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div {...rest} className={join('md-card hm rc', `md-card--${size}`, className)} data-tone={tone}>
      {icon && <span className="md-card-icon">{icon}</span>}
      <span className="md-card-text">
        {title && <span className="md-card-title">{title}</span>}
        {sub && <span className="md-card-sub">{sub}</span>}
        {children}
      </span>
    </div>
  );
}

/** A small dark label (the name tag's look): a fact, a key, a rule. */
export function Tag({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest} className={join('md-tag', className)} />;
}
