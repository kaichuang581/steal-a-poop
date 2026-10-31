import { useReducedMotion } from 'framer-motion';
import { useStore } from '../state/store';

/** True when the OS asks for reduced motion or the player turned it on in Settings. */
export function useReduceMotion(): boolean {
  const os = useReducedMotion();
  const pref = useStore((s) => s.reduceMotion);
  return !!os || pref;
}
