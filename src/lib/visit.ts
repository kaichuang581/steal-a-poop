import { apiBase } from '../auth/config';
import { useAdmin } from './admin';

/**
 * Telling the server that someone has the game open, so the admin panel can count visits and who is on right now
 * (requested by Kai, 2026-11-15). It sends numbers and one random code made for this tab: nothing that says who you are.
 *
 *  - A tab says "I opened" once (the code is kept in sessionStorage, so a refresh is not a new visit).
 *  - A browser that has never been here before says so (`sap:seen`); that is how "new browsers" is counted.
 *  - While the tab is on screen it says "still here" every 45 s. A tab in the background says nothing.
 *  - The admin's own visits, and automated browsers (the tests), are not counted.
 * Without a game server there is nothing to tell, and nothing is sent. A failed send is ignored.
 */
export const PING_EVERY_MS = 45_000;
const TAB_KEY = 'sap:tab';
const SEEN_KEY = 'sap:seen';

function newCode(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What this tab is: its code, and whether it has just opened. */
export function tabState(): { code: string; opened: boolean; first: boolean } {
  let code = '';
  try { code = sessionStorage.getItem(TAB_KEY) ?? ''; } catch { /* storage blocked: every load counts as a new tab */ }
  const opened = !/^[0-9a-f]{24}$/.test(code);
  if (opened) {
    code = newCode();
    try { sessionStorage.setItem(TAB_KEY, code); } catch { /* ignore */ }
  }
  let first = true;
  try { first = localStorage.getItem(SEEN_KEY) === null; } catch { /* ignore */ }
  return { code, opened, first };
}

export function startVisitReports(): () => void {
  const base = apiBase();
  if (!base || typeof document === 'undefined' || navigator.webdriver) return () => undefined;
  const { code, opened, first } = tabState();
  const send = (open: boolean, firstEver: boolean) => {
    if (useAdmin.getState().admin) return;
    void fetch(`${base}/api/site/ping`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit', keepalive: true,
      body: JSON.stringify({ tab: code, open, first: firstEver }),
    }).catch(() => undefined);
  };
  // The "opened" message goes the first time the tab is on screen (a tab opened in the background has not been seen yet).
  let pendingOpen = opened;
  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    if (pendingOpen) {
      pendingOpen = false;
      send(true, first);
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    } else send(false, false);
  };
  tick();
  const timer = setInterval(tick, PING_EVERY_MS);
  document.addEventListener('visibilitychange', tick);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
}
