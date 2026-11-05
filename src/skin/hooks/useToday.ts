import { useEffect, useState } from 'react';

/** Date key in the device's own time zone, e.g. 2026-10-31: the day rolls over at local midnight, not UTC. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's local date key, re-checked once a minute so a screen left open rolls over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    // Setting the same string is a no-op for React, so this only re-renders when the day actually changes.
    const id = setInterval(() => setToday(localDateKey(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
