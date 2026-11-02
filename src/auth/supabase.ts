import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, authEnabled } from './config';

let client: SupabaseClient | null = null;

/**
 * The browser's Supabase client. It keeps the login in this browser and refreshes it before it expires.
 * The library is loaded only when real sign-in is on, so a build without it does not ship it to players.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!authEnabled()) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}

/** For tests: use a stand-in client. */
export function setSupabaseForTests(c: SupabaseClient | null) {
  client = c;
}
