import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { SnowCap } from '../components/SnowCap';
import { CloseIcon } from '../components/Icons';

/*
 * The farm kit (docs/REDESIGN_PLAN_V6_UI.md Part 4). Every surface in the painted skin is one of these materials; the
 * recipes are in styles/kit.css. One file rather than one per material: each component is a few lines over its class.
 */

const join = (...c: (string | undefined | false | null)[]) => c.filter(Boolean).join(' ');
/** A small stable number from a string, so a board's knot or a paper's edge differs from its neighbour's but not between renders. */
export const seedOf = (s: string | number = 0) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 4;

type Div = HTMLAttributes<HTMLDivElement>;
type Btn = ComponentProps<'button'>;

/** Nails at a board's top corners (or all four). */
export function Nails({ all = false }: { all?: boolean }) {
  return <>
    <span className="kit-nail kit-nail--tl" /><span className="kit-nail kit-nail--tr" />
    {all && <><span className="kit-nail kit-nail--bl" /><span className="kit-nail kit-nail--br" /></>}
  </>;
}
/** Two ropes from a board's top edge up out of sight. */
export function Ropes({ hang = 40 }: { hang?: number }) {
  return <><span className="kit-rope kit-rope--l" style={{ '--hang': `${hang}px` } as CSSProperties} /><span className="kit-rope kit-rope--r" style={{ '--hang': `${hang}px` } as CSSProperties} /></>;
}

/** 4.1 A sawn plank. */
export function Board({ size = 'label', tone = 'wood', hang = 'none', snow = false, lit = false, swing = false, id, className, children, ...rest }: Div & {
  size?: 'heading' | 'label' | 'post' | 'panel'; tone?: 'wood' | 'light' | 'barn' | 'green'; hang?: 'nails' | 'ropes' | 'none';
  snow?: boolean; lit?: boolean; swing?: boolean;
}) {
  return (
    <div {...rest} id={id} data-knot={seedOf(id ?? className ?? size) + 1}
      className={join('kit-plank', `kit-plank--${size}`, tone !== 'wood' && `kit-plank--${tone}`, hang !== 'none' && (swing ? 'kit-plank--sway' : 'kit-plank--hung'), lit && 'kit-chalk-ring', className)}>
      {snow && <SnowCap className="kit-snow" />}
      {hang === 'nails' && <Nails />}
      {hang === 'ropes' && <Ropes />}
      {children}
    </div>
  );
}

/** 4.2 Paper, pinned or strung. */
export function Paper({ kind = 'note', pin = 'none', seed = 0, tilt = false, as: As = 'div', className, children, ...rest }: HTMLAttributes<HTMLElement> & {
  kind?: 'slip' | 'note' | 'sheet' | 'ticket'; pin?: 'top' | 'corner' | 'none'; seed?: number | string; tilt?: boolean; as?: 'div' | 'span';
}) {
  const s = seedOf(seed);
  return (
    <As {...rest} data-seed={s}
      className={join('kit-paper', `kit-paper--${kind === 'ticket' ? 'slip kit-ticket' : kind}`, tilt && `kit-paper--tilt-${s || 1}`, className)}>
      {pin !== 'none' && <span className={join('kit-pin', pin === 'corner' && 'kit-pin--corner')} />}
      {children}
    </As>
  );
}
/** A hang tag: paper tinted by tone, with a punched hole. */
export function Tag({ tone = 'gold', className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: 'gold' | 'green' | 'gray' | 'flame' }) {
  return <span {...rest} className={join('kit-tag', `kit-tag--${tone}`, className)} />;
}

/** 4.3 A carved letter tile. */
export function Tile({ size = 'md', hung, lit, trap, done, bad, className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & {
  size?: 'mini' | 'sm' | 'md' | 'lg'; hung?: boolean; lit?: boolean; trap?: boolean; done?: boolean; bad?: boolean;
}) {
  return (
    <span {...rest} className={join('kit-tile', `kit-tile--${size}`, hung && 'kit-tile--hung', lit && 'kit-tile--lit', bad && 'kit-tile--bad', done && 'kit-tile--done', trap && 'kit-ice', className)}>
      {hung && <span className="kit-tile-rope" />}
      {children}
    </span>
  );
}

/** 4.4 A framed slate, chalk on it. */
export function Slate({ size = 'plaque', tone = 'chalk', className, children, ...rest }: Div & { size?: 'mini' | 'plaque' | 'board'; tone?: 'chalk' | 'coral' | 'amber' }) {
  return (
    <div {...rest} className={join('kit-slate', `kit-slate--${size}`, tone !== 'chalk' && `kit-slate--${tone}`, className)}>
      <div className="kit-slate-face">{children}</div>
    </div>
  );
}
/** Tally strokes for wool balls: one stroke a ball, lost ones faint. */
export function Tally({ have, of }: { have: number; of: number }) {
  return <span className="kit-tally" aria-label={`${have} of ${of}`}>{Array.from({ length: of }, (_, i) => <i key={i} data-lost={i >= have || undefined} />)}</span>;
}

/** 4.5 A stitched burlap patch. */
export function Patch({ tone = 'burlap', icon, pressed, small, as = 'span', className, children, ...rest }: Btn & {
  tone?: 'burlap' | 'cream' | 'gold' | 'green' | 'gray' | 'flame'; icon?: ReactNode; pressed?: boolean; small?: boolean; as?: 'span' | 'button';
}) {
  const cls = join('kit-patch', tone !== 'burlap' && `kit-patch--${tone}`, small && 'kit-patch--small', pressed && 'kit-patch--pressed', className);
  if (as === 'button') return <button {...rest} aria-pressed={pressed} className={cls}>{icon}{children}</button>;
  return <span {...(rest as HTMLAttributes<HTMLSpanElement>)} className={cls}>{icon}{children}</span>;
}

/** 4.6 A knitted band: progress (segments, filled) or the week's stitches. */
export function Knit({ a, b, height = 14, segments, filled = 0, stitches, className }: {
  a?: string; b?: string; height?: 14 | 20; segments?: number; filled?: number; className?: string;
  stitches?: ('played' | 'missed' | 'blanket' | 'repair' | 'today')[];
}) {
  if (stitches) return (
    <span className={join('kit-stitches', className)}>
      {stitches.map((s, i) => <span key={i} className="kit-stitch" data-status={s === 'today' ? 'played' : s} data-today={s === 'today' || undefined} />)}
    </span>
  );
  const style = { '--knit-h': `${height}px`, ...(a && { '--a': a }), ...(b && { '--b': b }) } as CSSProperties;
  if (!segments) return <div className={join('kit-knit', className)} style={style} />;
  return (
    <div className={join('kit-knit-row', className)} style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: segments }, (_, i) => <div key={i} className="kit-knit" style={{ ...style, flex: 1, opacity: i < filled ? 1 : 0.35 }} />)}
    </div>
  );
}

/** 4.8 The primary action: an engraved brass plate with four screws. */
export function Brass({ barn, className, children, ...rest }: Btn & { barn?: boolean }) {
  return (
    <button {...rest} className={join('kit-btn kit-brass', barn && 'kit-brass--barn', className)}>
      <span className="kit-screw kit-screw--tl" /><span className="kit-screw kit-screw--tr" /><span className="kit-screw kit-screw--bl" /><span className="kit-screw kit-screw--br" />
      {children}
    </button>
  );
}
export function WoodButton({ className, ...rest }: Btn) { return <button {...rest} className={join('kit-btn kit-btn-wood', className)} />; }
export function ClothButton({ className, ...rest }: Btn) { return <button {...rest} className={join('kit-btn kit-btn-cloth', className)} />; }
/** A round wooden knob for icon buttons. */
export function Peg({ light, small, className, ...rest }: Btn & { light?: boolean; small?: boolean }) {
  return <button {...rest} className={join('kit-peg', light && 'kit-peg--light', small && 'kit-peg--sm', className)} />;
}

/** 4.9 Every dialog: paper held by a brass clip on a light board, with paper index tabs. */
export function Clipboard({ title, onClose, tabs, tab, onTab, className, children, ...rest }: Div & {
  title?: ReactNode; onClose?: () => void; tabs?: { id: string; label: ReactNode }[]; tab?: string; onTab?: (id: string) => void;
}) {
  return (
    <div role="dialog" aria-modal="true" {...rest} className={join('kit-clipboard', className)}>
      <span className="kit-clip" />
      {onClose && <Peg small light className="kit-clipboard-close" aria-label="Close" onClick={onClose}><CloseIcon size={18} /></Peg>}
      {tabs && (
        <div className="kit-index-tabs" role="tablist">
          {tabs.map((t) => <button key={t.id} role="tab" aria-selected={t.id === tab} className="kit-index-tab" onClick={() => onTab?.(t.id)}>{t.label}</button>)}
        </div>
      )}
      <Paper kind="sheet" className="kit-clipboard-sheet">
        {title && <h2 className="kit-clipboard-title">{title}</h2>}
        {children}
      </Paper>
    </div>
  );
}
/** Planks for settings rows. */
export function Panel({ className, ...rest }: Div) { return <div {...rest} className={join('kit-panel', className)} />; }
export function PanelRow({ label, children, className }: { label: ReactNode; children?: ReactNode; className?: string }) {
  return <div className={join('kit-panel-row', className)}><Paper kind="slip" as="span">{label}</Paper><span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{children}</span></div>;
}
/** A toggle: a wooden lever on a brass pivot, with a lamp. */
export function Lever({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="kit-lever" onClick={() => onChange(!checked)}>
      <span className="kit-lever-arm" /><span className="kit-lever-pivot" /><span className="kit-lever-lamp" />
    </button>
  );
}
export function RopeSlider({ className, ...rest }: ComponentProps<'input'>) { return <input type="range" {...rest} className={join('kit-rope-slider', className)} />; }

/** 4.10 Ice: penalties, the trap and the frozen overlay. */
export function Ice({ className, ...rest }: Div) { return <div {...rest} className={join('kit-ice', className)} />; }
