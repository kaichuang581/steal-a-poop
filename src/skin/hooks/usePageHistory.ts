import { useEffect, useRef } from 'react';

/** The history.back() a closing page has queued; a remount straight after (StrictMode) cancels it. */
let pendingBack: ReturnType<typeof setTimeout> | undefined;

/**
 * A full page opened over Home in the same tab (the Trading Post, the profile): it takes a history entry, so the
 * browser's Back closes it instead of leaving the game, and Esc closes it too unless `escBlocked()` says a dialog of
 * its own is open on top. The history.back() on close is deferred a tick and cancelled by a remount: StrictMode
 * mounts, unmounts and remounts at once in dev, and an immediate back() there fired a popstate that closed the page
 * as it opened.
 */
export function usePageHistory(key: string, onClose: () => void, escBlocked: () => boolean = () => false): void {
  const close = useRef(onClose);
  close.current = onClose;
  const blocked = useRef(escBlocked);
  blocked.current = escBlocked;
  useEffect(() => {
    let popped = false;
    clearTimeout(pendingBack);
    if (!history.state?.[key]) { try { history.pushState({ ...(history.state ?? {}), [key]: true }, ''); } catch { /* sandboxed frame */ } }
    const pop = () => { popped = true; close.current(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !blocked.current()) { e.preventDefault(); close.current(); } };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', esc);
      if (!popped) pendingBack = setTimeout(() => { if (history.state?.[key]) { try { history.back(); } catch { /* ignore */ } } });
    };
  }, [key]);
}
