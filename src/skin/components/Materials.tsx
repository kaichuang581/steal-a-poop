import type { ComponentProps, HTMLAttributes } from 'react';

type Btn = ComponentProps<'button'>;
const join = (...c: (string | undefined | false)[]) => c.filter(Boolean).join(' ');

export function PaperPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={join('sk-paper', className)} />;
}

export function WoodButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn sk-wood', className)} />;
}

export function ClothButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn sk-cloth', className)} />;
}

export function CoralButton({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-btn sk-coral', className)} />;
}

export function Chip({ className, ...rest }: Btn) {
  return <button {...rest} className={join('sk-chip', className)} />;
}
