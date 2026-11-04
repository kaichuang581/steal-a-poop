import { useEffect, useRef, useState } from 'react';

/**
 * Small flames for a player's lives (plan V3 Part 9), one per life the game started with. A flame that goes out plays
 * a 300 ms puff (it grows, fades and leaves a grey smoke voxel) and then shows only a dark wick. Lives come from
 * engine state only; a game with unlimited lives shows no flames.
 */
export function Lives({ lives, max = 3, size = 14 }: { lives: number; max?: number; size?: number }) {
  const MAX = max;
  const prev = useRef(lives);
  const [puff, setPuff] = useState<number | null>(null);
  useEffect(() => {
    if (lives < prev.current) {
      setPuff(lives); // the flame at index `lives` just went out
      const id = setTimeout(() => setPuff(null), 300);
      prev.current = lives;
      return () => clearTimeout(id);
    }
    prev.current = lives;
  }, [lives]);
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={`${lives} of ${MAX} lives`} data-lives={lives}>
      {Array.from({ length: MAX }, (_, i) => (
        <Flame key={i} lit={i < lives} puffing={puff === i} size={size} />
      ))}
    </span>
  );
}

function Flame({ lit, puffing, size }: { lit: boolean; puffing: boolean; size: number }) {
  return (
    <svg viewBox="0 0 10 14" width={size * (10 / 14)} height={size} aria-hidden="true" style={{ overflow: 'visible' }}>
      <rect x="4.5" y="9" width="1" height="5" fill="var(--wood-ink)" />
      {(lit || puffing) && (
        <g className={puffing ? 'sk-puff' : 'sk-flicker'} style={{ transformOrigin: '5px 10px' }}>
          <path d="M5 1 C8 5 9 8 5 11 C1 8 2 5 5 1 Z" fill="var(--flame-dark)" />
          <path d="M5 4 C7 6.5 7.5 8.5 5 10.4 C2.5 8.5 3 6.5 5 4 Z" fill="var(--flame-mid)" />
          <path d="M5 6.5 C6 7.8 6.2 9 5 10 C3.8 9 4 7.8 5 6.5 Z" fill="var(--flame-light)" />
        </g>
      )}
      {puffing && <rect className="sk-smoke" x="3.5" y="2" width="3" height="3" fill="var(--ink-soft)" />}
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
