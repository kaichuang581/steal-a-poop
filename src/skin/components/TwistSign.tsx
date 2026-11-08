import type { ReactNode } from 'react';
import { TWIST_TEXT } from '../model/types';
import type { TwistId } from '../model/types';
import { ChainIcon, CheckIcon, ClockIcon, CloseIcon, DoubleIcon, NoEIcon, RulerIcon } from './Icons';
import { Notice } from './Notice';

const ICON: Record<TwistId, ReactNode> = {
  noE: <NoEIcon size={18} />, sixPlus: <RulerIcon size={18} />, doubleLetter: <DoubleIcon size={18} />,
  noA: <CloseIcon size={18} />, noS: <CloseIcon size={18} />, fiveMax: <RulerIcon size={18} />,
  endsVowel: <ChainIcon size={18} />, hasO: <CheckIcon size={18} />,
  vowelDouble: null, doublePointsShort: <ClockIcon size={18} />,
};

/** This round's twist on a small snow-capped board hung on two ropes. Lowers in, swings slowly while hung. */
export function TwistSign({ twist, state, compact }: { twist: TwistId | null; state: 'lowering' | 'hung' | 'raised'; compact?: boolean }) {
  if (!twist || twist === 'vowelDouble') return null;
  const y = state === 'raised' ? '-160%' : '0%';
  return (
    <div
      className="pointer-events-none flex flex-col items-center"
      style={{ transform: `translateY(${y})`, transition: 'transform 900ms var(--ease-out)' }}
      data-tour="modifier"
    >
      <div className="flex w-full justify-between px-7" aria-hidden="true">
        <span className="kit-rope sk-twist-rope" />
        <span className="kit-rope sk-twist-rope" />
      </div>
      <div className={state === 'hung' ? 'sk-swing' : ''}>
        <Notice tone="wood" size={compact ? 'sm' : 'md'} icon={ICON[twist]} title={TWIST_TEXT[twist]} sub="this round" />
      </div>
    </div>
  );
}
