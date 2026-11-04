import { TWIST_TEXT } from '../model/types';
import type { TwistId } from '../model/types';

const ICON: Record<TwistId, string> = { noE: '🚫', sixPlus: '📏', doubleLetter: '👯', vowelDouble: '✨', doublePointsShort: '⚡' };

/** Wooden sign on two ropes with this round's twist, hand lettered. Lowers in, swings slowly while hung. */
export function TwistSign({ twist, state, compact }: { twist: TwistId | null; state: 'lowering' | 'hung' | 'raised'; compact?: boolean }) {
  if (!twist) return null;
  const y = state === 'raised' ? '-140%' : '0%';
  return (
    <div
      className="pointer-events-none flex flex-col items-center"
      style={{ transform: `translateY(${y})`, transition: 'transform 900ms var(--ease-out)' }}
      data-tour="modifier"
    >
      <div className="flex w-full justify-between px-6" aria-hidden="true">
        <span className="block h-4 w-0.5" style={{ background: 'var(--wood-ink)' }} />
        <span className="block h-4 w-0.5" style={{ background: 'var(--wood-ink)' }} />
      </div>
      <div
        className={`sk-hand ${state === 'hung' ? 'sk-swing' : ''} relative rounded-xl px-4 py-1.5 text-center leading-tight`}
        style={{ background: 'var(--wood-dark)', color: 'var(--button-text)', boxShadow: 'inset 0 3px 0 var(--wood), var(--shadow-warm)', fontSize: compact ? 15 : 19 }}
      >
        {/* Snow cap along the top edge, uneven like the drifts on the barn's beams. */}
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-x-0 -top-1.5 h-3 w-full" aria-hidden="true">
          <path d="M0 10 L0 5 Q8 0 16 4 Q26 1 34 5 Q44 0 55 4 Q64 1 72 5 Q84 0 92 4 L100 3 L100 10 Z" fill="var(--paper)" />
        </svg>
        <span aria-hidden="true">{ICON[twist]} </span>{TWIST_TEXT[twist]}
      </div>
    </div>
  );
}
