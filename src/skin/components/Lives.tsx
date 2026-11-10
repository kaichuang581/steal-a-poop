import { useEffect, useRef, useState } from 'react';

/**
 * A sheep's lives, as small balls of wool: one per wool ball it has, wound tight, with an empty dashed ring for each
 * one it has lost (up to the most it started with). A ball that is lost unravels: it shrinks and spins off with a
 * loose strand. A ball that is gained (from a trap) pops in. Lives come from engine state only.
 */
export function Lives({ lives, max = 3, size = 14 }: { lives: number; max?: number; size?: number }) {
  const prev = useRef(lives);
  const [change, setChange] = useState<{ kind: 'lost' | 'gained'; at: number } | null>(null);
  useEffect(() => {
    if (lives === prev.current) return;
    setChange({ kind: lives < prev.current ? 'lost' : 'gained', at: lives < prev.current ? lives : lives - 1 });
    prev.current = lives;
    const id = setTimeout(() => setChange(null), 600);
    return () => clearTimeout(id);
  }, [lives]);
  const slots = Math.max(max, lives);
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" role="img" aria-label={`${lives} wool ball${lives === 1 ? '' : 's'} left`} data-lives={lives}>
      {Array.from({ length: slots }, (_, i) => (
        <WoolBall key={i} full={i < lives} size={size} anim={change?.at === i ? change.kind : null} />
      ))}
    </span>
  );
}

/** One ball of yarn: a cream ball with wound strands and a loose end, or an empty ring once it is gone. */
export function WoolBall({ full, size = 14, anim = null }: { full: boolean; size?: number; anim?: 'lost' | 'gained' | null }) {
  if (!full && anim !== 'lost') {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
        <circle cx="8" cy="8" r="5.6" fill="rgba(59,48,40,0.08)" stroke="rgba(122,106,88,0.6)" strokeWidth="1" strokeDasharray="1.6 1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible' }}
      className={anim === 'lost' ? 'sk-wool-lost' : anim === 'gained' ? 'sk-wool-gained' : undefined}>
      <defs>
        <radialGradient id="sk-wool-shade" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#FFFDF7" />
          <stop offset="0.5" stopColor="#F6E6C8" />
          <stop offset="1" stopColor="#D8B486" />
        </radialGradient>
        <clipPath id="sk-wool-clip"><circle cx="8" cy="8" r="6.4" /></clipPath>
      </defs>
      <ellipse cx="8.3" cy="14.6" rx="5.6" ry="1.3" fill="rgba(59,40,20,0.28)" />
      <circle cx="8" cy="8" r="6.6" fill="url(#sk-wool-shade)" />
      {/* Two crossing bands of wound yarn, clipped to the ball, then the outline over them. */}
      <g clipPath="url(#sk-wool-clip)" fill="none" strokeLinecap="round">
        <g stroke="#C08A55" strokeWidth="0.95">
          <path d="M-1 5.6 Q8 1.8 17 6.2" /><path d="M-1 8.2 Q8 4.4 17 8.8" /><path d="M-1 10.8 Q8 7 17 11.4" />
        </g>
        <g stroke="#A8743F" strokeWidth="0.9" opacity="0.85">
          <path d="M5.2 -1 Q2.4 8 6.2 17" /><path d="M8 -1 Q5.4 8 9 17" />
        </g>
        <path d="M3.6 4.6 Q6.4 2.8 9.4 3.4" stroke="#FFFFFF" strokeWidth="1.3" opacity="0.9" />
      </g>
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="#6B4423" strokeWidth="1.2" />
      {/* The loose end, with a little curl. */}
      <path d="M13.4 11 Q15.8 12.2 15 14.2 Q14.4 15.4 13.2 14.8" stroke="#6B4423" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Ice over a frozen player's card: pale ice, a white edge, two cracks, and the word "frozen". The score stays readable. */
export function IceOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit', background: 'color-mix(in srgb, var(--ice-light) 60%, transparent)', boxShadow: 'inset 0 0 0 2px var(--paper)' }}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <path d="M8 4 L18 16 L13 22 L24 36" stroke="var(--ice-dark)" strokeWidth="1.4" fill="none" />
        <path d="M74 2 L66 14 L78 20 L70 30" stroke="var(--ice-dark)" strokeWidth="1.4" fill="none" />
      </svg>
      <span className="sk-hand absolute bottom-0 left-1 text-xs" style={{ color: 'var(--ink)' }}>frozen</span>
    </div>
  );
}
