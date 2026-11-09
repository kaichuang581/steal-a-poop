import type { ComponentProps, HTMLAttributes } from 'react';

/*
 * The old material names, now cut from the farm kit (docs/REDESIGN_PLAN_V6_UI.md Part 4), so every call site wears the
 * kit before it migrates to src/skin/kit itself. Each keeps its old class too, for the layout rules that hang off it.
 */
type Btn = ComponentProps<'button'>;
const join = (...c: (string | undefined | false)[]) => c.filter(Boolean).join(' ');

/** Now a Paper sheet. */
export function PaperPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={join('sk-paper kit-paper', className)} />;
}
export function WoodButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn kit-btn kit-btn-wood', className)} />;
}
export function ClothButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn kit-btn kit-btn-cloth', className)} />;
}
/** Retired (V6 4.8): a red action is a brass plate on a barn board. */
export function CoralButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn kit-btn kit-brass kit-brass--barn', className)} />;
}
/** Now a Patch. */
export function Chip({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-chip kit-patch', className)} />;
}
