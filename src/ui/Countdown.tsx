import { useStore } from '../state/store';

/** The time left on a turn. `max` is the turn's length: before its fuse is lit (the beat after a bomb) the clock stands full. */
export function SecondsLeft({ endsAt, max = Infinity }: { endsAt: number; max?: number }) {
  const now = useStore((s) => s.now);
  return <>{(Math.min(max, Math.max(0, endsAt - now)) / 1000).toFixed(1)}s</>;
}
