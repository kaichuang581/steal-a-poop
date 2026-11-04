import { useStore } from '../state/store';

export function SecondsLeft({ endsAt }: { endsAt: number }) {
  const now = useStore((s) => s.now);
  return <>{(Math.max(0, endsAt - now) / 1000).toFixed(1)}s</>;
}
