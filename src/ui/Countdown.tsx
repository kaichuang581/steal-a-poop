import { useStore } from '../state/store';

interface Props { endsAt: number; durationMs: number; stroke?: number }

const VIEW = 64;

export function ringColor(fraction: number, remainingMs: number): string {
  if (remainingMs <= 3000 || fraction <= 0.25) return '#ef4444';
  if (fraction <= 0.5) return '#facc15';
  return '#4ade80';
}

/** Circular ring that drains with the turn timer. Reads the shared frame clock. */
export function Countdown({ endsAt, durationMs, stroke = 4 }: Props) {
  const size = VIEW;
  const now = useStore((s) => s.now);
  const remaining = Math.max(0, endsAt - now);
  const fraction = Math.min(1, remaining / durationMs);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const urgent = remaining <= 3000 && remaining > 0;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`absolute inset-0 size-full -rotate-90 ${urgent ? 'ring-pulse' : ''}`}
      aria-hidden="true"
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeLinecap="round" strokeWidth={stroke}
        stroke={ringColor(fraction, remaining)} strokeDasharray={c} strokeDashoffset={c * (1 - fraction)}
      />
    </svg>
  );
}

export function SecondsLeft({ endsAt }: { endsAt: number }) {
  const now = useStore((s) => s.now);
  return <>{(Math.max(0, endsAt - now) / 1000).toFixed(1)}s</>;
}
