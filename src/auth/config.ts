import { getServerUrl } from '../net/config';

/**
 * Real sign-in is on only when the build has a Supabase project address and its PUBLISHABLE key
 * (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Those two are meant to be public. The secret keys
 * (service role, JWT secret) must never be given to the browser.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || '';
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

export const authEnabled = () => !!(SUPABASE_URL && SUPABASE_KEY);

/** The game server's HTTP address, derived from its WebSocket address. */
export function apiBase(): string | null {
  const ws = getServerUrl();
  return ws ? ws.replace(/^ws/, 'http').replace(/\/+$/, '') : null;
}

/** Where Supabase sends people back after an email link or Google/Meta sign-in. */
export const appUrl = () => `${location.origin}${import.meta.env.BASE_URL}`;
