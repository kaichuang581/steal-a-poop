import { useEffect, useRef, useState } from 'react';

/**
 * A sheep's lives, as small balls of wool: one per wool ball it has, wound tight, with an empty dashed ring for each
 * one it has lost (up to the most it started with). A ball that is lost unravels: it shrinks and spins off with a
 * loose strand. A ball that is gained (a steal, a trap) pops in. Lives come from engine state only.
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
        <radialGradient id="sk-wool-shade" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFFDF6" />
          <stop offset="0.55" stopColor="#F4E2C2" />
          <stop offset="1" stopColor="#D9B98E" />
        </radialGradient>
      </defs>
      <circle cx="8.4" cy="8.8" r="6.8" fill="rgba(59,40,20,0.35)" />
      <circle cx="8" cy="8" r="6.6" fill="url(#sk-wool-shade)" stroke="#6B4423" strokeWidth="1.3" />
      {/* Wound strands round the ball, and a loose end trailing off. */}
      <path d="M2.6 6.4 Q8 3.4 13.4 6.8 M2 9.4 Q8 6 14 9.8 M3.4 12.4 Q8.6 9.4 12.8 12.6" stroke="#B57F4A" strokeWidth="1.25" fill="none" strokeLinecap="round" />
      <path d="M6.2 1.8 Q3.8 8 6.6 14.2" stroke="#C9935C" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M5 4 Q6.6 3 8.4 3.4" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M13.6 10.8 Q16 12.4 14.8 15.2" stroke="#6B4423" strokeWidth="1.1" fill="none" strokeLinecap="round" />
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
