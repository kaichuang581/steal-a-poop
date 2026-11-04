import { useMemo } from 'react';

type Kind = 'petals' | 'leaf' | 'fireflies' | 'rain' | 'snow';

const COLOR: Record<Kind, string> = {
  petals: 'var(--blush)', leaf: 'var(--sprout)', fireflies: 'var(--glow)', rain: 'var(--mist)', snow: 'var(--paper)',
};

/** A short burst of small particles from `origin` (percent of the parent box). Renders once; remount to replay. */
export function Particles({ kind, origin = { x: 50, y: 50 }, count = 12 }: { kind: Kind; origin?: { x: number; y: number }; count?: number }) {
  const bits = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ dx: Math.cos((i / count) * 6.28) * (30 + (i % 3) * 18), dy: -20 - (i % 4) * 14, d: i * 25 })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            left: `${origin.x}%`, top: `${origin.y}%`,
            width: kind === 'rain' ? 2 : 7, height: kind === 'rain' ? 10 : 5,
            borderRadius: kind === 'rain' ? 1 : '60% 40% 60% 40%',
            background: COLOR[kind],
            animation: `sk-fall 0.7s var(--ease-out) ${b.d}ms forwards`,
            translate: `${b.dx}px ${b.dy}px`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
