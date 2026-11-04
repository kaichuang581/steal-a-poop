import { useEffect, useState } from 'react';
import { useReduceMotion } from '../../ui/useReduceMotion';
import { hourFor, seasonFor } from '../model/clock';
import type { Hour, Season } from '../model/types';

/** 'reduced' from the OS setting or the existing Reduce motion setting (useReduceMotion already combines both). */
export function useMotionLevel(): 'full' | 'reduced' {
  return useReduceMotion() ? 'reduced' : 'full';
}

/** The device clock's hour band, re-checked once a minute. ?hour=night (etc.) pins it, for screenshots. */
export function useHour(): Hour {
  const pinned = new URLSearchParams(location.search).get('hour') as Hour | null;
  const [hour, setHour] = useState<Hour>(() => pinned ?? hourFor());
  useEffect(() => {
    if (pinned) return;
    const id = setInterval(() => setHour(hourFor()), 60_000);
    return () => clearInterval(id);
  }, [pinned]);
  return hour;
}

export function useSeason(): Season {
  const pinned = new URLSearchParams(location.search).get('season') as Season | null;
  return pinned ?? seasonFor();
}
