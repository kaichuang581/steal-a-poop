/** The fox that dashes across the table when a pile is stolen (1.3 s). */
export function Fox({ from, running }: { from: 'left' | 'right'; running: boolean }) {
  if (!running) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-[38%] left-0 z-30"
      style={{ animation: `${from === 'left' ? 'sk-dash' : 'sk-dash-left'} 1.3s var(--ease-out) forwards` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 150 80" width="150" height="80">
        <path d="M32 42 Q4 30 2 50 Q10 62 34 52 Z" fill="var(--fox)" />
        <path d="M6 46 Q2 50 6 54 Q12 52 12 48 Z" fill="var(--keeper-belly)" />
        <ellipse cx="78" cy="48" rx="40" ry="18" fill="var(--fox)" />
        {[50, 64, 92, 106].map((x) => (
          <path key={x} d={`M${x} 60 L${x - 2} 76`} stroke="var(--fox-dark)" strokeWidth="5" strokeLinecap="round" />
        ))}
        <circle cx="116" cy="38" r="15" fill="var(--fox)" />
        <path d="M106 28 L108 12 L117 24 Z" fill="var(--fox-dark)" />
        <path d="M120 24 L128 10 L130 27 Z" fill="var(--fox-dark)" />
        <ellipse cx="126" cy="44" rx="9" ry="6" fill="var(--keeper-belly)" />
        <circle cx="120" cy="35" r="2" fill="var(--ink)" />
        <circle cx="134" cy="43" r="2" fill="var(--ink)" />
      </svg>
    </div>
  );
}
