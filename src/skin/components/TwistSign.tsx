import type { ReactNode } from 'react';
import { TWIST_TEXT } from '../model/types';
import type { TwistId } from '../model/types';
import { ChainIcon, CheckIcon, ClockIcon, CloseIcon, DoubleIcon, NoEIcon, RulerIcon } from './Icons';

const ICON: Record<TwistId, ReactNode> = {
  noE: <NoEIcon size={18} />, sixPlus: <RulerIcon size={18} />, doubleLetter: <DoubleIcon size={18} />,
  noA: <CloseIcon size={18} />, noS: <CloseIcon size={18} />, fiveMax: <RulerIcon size={18} />,
  endsVowel: <ChainIcon size={18} />, hasO: <CheckIcon size={18} />,
  vowelDouble: null, doublePointsShort: <ClockIcon size={18} />,
};

/**
 * This round's twist, stitched onto the bottom of the round tab in the top-left corner (PaintedGame's .sk-hud-tab):
 * its icon, the rule in gold, "this round" under it. It slides down out of the tab when the round starts.
 */
export function TwistSign({ twist, state, compact }: { twist: TwistId | null; state: 'lowering' | 'hung' | 'raised'; compact?: boolean }) {
  if (!twist || twist === 'vowelDouble' || state === 'raised') return null;
  return (
    <div className="sk-hud-twist" data-compact={compact || undefined} data-tour="modifier">
      <span className="sk-hud-twist-icon" aria-hidden="true">{ICON[twist]}</span>
      <span><b>{TWIST_TEXT[twist]}</b><small>this round</small></span>
    </div>
  );
}
