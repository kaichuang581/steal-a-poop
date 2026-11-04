/** A paper lantern whose size and glow follow the points it holds. Used on Home and in the streak string. */
export function Lantern({ points, state, sizeCap }: { points: number; state: 'unlit' | 'lit'; sizeCap?: number }) {
  const width = Math.min(sizeCap ?? Infinity, 72 + Math.min(80, points) * 1.1);
  const lit = state === 'lit';
  return (
    <svg
      viewBox="0 0 60 80" width={width} height={width * (4 / 3)} aria-hidden="true"
      className={lit ? 'sk-bob' : undefined}
      style={{ transition: 'width var(--t-feedback) var(--ease-spring), height var(--t-feedback) var(--ease-spring)', overflow: 'visible' }}
    >
      {lit && <circle cx="30" cy="44" r={26 + Math.min(80, points) * 0.15} fill="var(--glow)" opacity="0.45" />}
      <rect x="24" y="6" width="12" height="6" rx="2" fill="var(--wood-dark)" />
      <ellipse cx="30" cy="44" rx="22" ry="28" fill={lit ? 'var(--amber)' : 'var(--paper-edge)'} />
      {[-12, 0, 12].map((dx) => (
        <path key={dx} d={`M${30 + dx} 17 Q${30 + dx * 1.6} 44 ${30 + dx} 71`} stroke="var(--wood)" strokeWidth="1.2" fill="none" opacity="0.6" />
      ))}
      <rect x="24" y="70" width="12" height="5" rx="2" fill="var(--wood-dark)" />
    </svg>
  );
}

/** Seven small lanterns for the last seven days; today (the last) is ringed. */
export function StreakString({ days }: { days: boolean[] }) {
  return (
    <div className="flex items-end justify-center gap-1.5" aria-label={`Daily streak: ${days.filter(Boolean).length} of the last 7 days played`}>
      {days.map((on, i) => (
        <div
          key={i} className="rounded-full p-0.5"
          style={{ boxShadow: i === days.length - 1 ? '0 0 0 2px var(--cloth)' : undefined }}
        >
          <Lantern points={0} state={on ? 'lit' : 'unlit'} sizeCap={20} />
        </div>
      ))}
    </div>
  );
}
