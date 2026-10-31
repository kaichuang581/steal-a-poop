import { useEffect, useRef } from 'react';
import type { GameEvent } from '../engine';
import { useStore } from '../state/store';

/** Calls `handler` once for every engine event that appears after mount. */
export function useNewEvents(handler: (e: GameEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    let last = useStore.getState().game?.eventSeq ?? 0;
    return useStore.subscribe((s) => {
      const g = s.game;
      if (!g || g.eventSeq <= last) return;
      const fresh = g.events.filter((e) => e.id > last);
      last = g.eventSeq;
      fresh.forEach((e) => ref.current(e));
    });
  }, []);
}
