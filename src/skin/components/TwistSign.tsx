import { TWIST_TEXT } from '../model/types';
import type { TwistId } from '../model/types';
import './hud-overlays.css';

/**
 * This round's twist, under the round in the top-left corner (PaintedGame's .sk-hud-tab): the rule chip's small label
 * (the word bar's `.sk-rule`) with the rule in lantern, "this round" small beside it. It slides down when the round starts.
 */
export function TwistSign({ twist, state, compact }: { twist: TwistId | null; state: 'lowering' | 'hung' | 'raised'; compact?: boolean }) {
  if (!twist || twist === 'vowelDouble' || state === 'raised') return null;
  return (
    <div className="sk-hud-twist" data-compact={compact || undefined} data-tour="modifier">
      <b className="sk-hud-twist-chip">{TWIST_TEXT[twist]}</b>
      <small>this round</small>
    </div>
  );
}
