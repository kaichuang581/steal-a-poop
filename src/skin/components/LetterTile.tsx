interface Props {
  letter: string;
  isTrap: boolean;
  isVowel: boolean;
  /** 0..1 of the turn left; the ring drains clockwise. Omit for a static tile. */
  fraction?: number;
  stealOpen: boolean;
  secondsLeft?: number;
  size?: number;
}

const R = 46;
const C = 2 * Math.PI * R;

/** Wooden tile with the required starting letter and the turn clock as a ring around it. */
export function LetterTile({ letter, isTrap, isVowel, fraction, stealOpen, secondsLeft, size = 84 }: Props) {
  return (
    <div className="flex flex-col items-center gap-1" data-chain-tile data-tour="chain" title="Your word must start with this letter">
      <div className="relative" style={{ width: size + 16, height: size + 16 }}>
        {fraction !== undefined && (
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--paper-edge)" strokeWidth="5" />
            <circle
              cx="50" cy="50" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
              stroke={stealOpen ? 'var(--coral)' : 'var(--amber)'}
              strokeDasharray={C} strokeDashoffset={-C * (1 - Math.max(0, Math.min(1, fraction)))}
            />
          </svg>
        )}
        <div
          key={letter}
          className="sk-tile sk-pop absolute inset-2 flex items-center justify-center uppercase"
          style={{ fontSize: size * 0.5 }}
          data-trap={isTrap}
          data-vowel={isVowel}
          aria-label={`Required starting letter ${letter.toUpperCase()}${isTrap ? ', a trap letter' : ''}`}
        >
          {letter}
          {isTrap && (
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
              {[[8, 50], [92, 50], [50, 8], [50, 92], [20, 20], [80, 80]].map(([x, y]) => (
                <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="var(--bramble)" />
              ))}
            </svg>
          )}
        </div>
      </div>
      <div className="sk-hand text-sm" style={{ color: 'var(--ink)' }}>
        starts with{secondsLeft !== undefined ? <span className="sk-num"> · {secondsLeft.toFixed(1)}s</span> : null}
      </div>
    </div>
  );
}
