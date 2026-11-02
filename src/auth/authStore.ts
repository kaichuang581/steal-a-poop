import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { apiBase, appUrl, authEnabled } from './config';
import { getSupabase } from './supabase';

export interface Profile {
  nickname: string;
  country: string | null;
  consentStatus: 'not_required' | 'pending' | 'granted' | 'refused' | 'withdrawn';
  createdAt: number;
}

/**
 * off: this build has no real sign-in (development).
 * loading: checking for a saved login.
 * signedOut: no login.
 * needsProfile: logged in, but nickname, date of birth and country are not set yet.
 * ready: fully signed up.
 * error: the game server could not be reached.
 */
export type AuthStatus = 'off' | 'loading' | 'signedOut' | 'needsProfile' | 'ready' | 'error';

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  /** Set when the person arrived from a password-reset email and must choose a new password. */
  recovery: boolean;
  /** A short message for the screen: "check your email", and so on. */
  notice: string | null;
  email: string | null;
  init(): void;
  signUp(email: string, password: string, captchaToken?: string): Promise<void>;
  signIn(email: string, password: string, captchaToken?: string): Promise<void>;
  signInWith(provider: 'google' | 'facebook'): Promise<void>;
  requestReset(email: string, captchaToken?: string): Promise<void>;
  setNewPassword(password: string): Promise<void>;
  finishProfile(input: { nickname: string; dateOfBirth: string; country: string; parentEmail?: string; captchaToken?: string }): Promise<{ parentMailed: boolean }>;
  refreshProfile(): Promise<void>;
  resendConsent(): Promise<void>;
  signOut(): Promise<void>;
  signOutEverywhere(): Promise<void>;
  deleteAccount(password?: string): Promise<void>;
  clearNotice(): void;
}

async function api<T>(method: 'GET' | 'POST', path: string, token: string | null, body?: unknown): Promise<T> {
  const base = apiBase();
  if (!base) throw new ApiError('no_server', 0);
  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(json.error ?? `http_${res.status}`, res.status);
  return json;
}
export { api };

/** The current access token, or null. The game connection asks for this each time it connects. */
export async function getAccessToken(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Plain-language text for the errors the screens can show. */
export function describeAuthError(code: string): string {
  switch (code) {
    case 'captcha_failed': return 'The bot check did not pass. Please try again.';
    case 'rate_limited': return 'Too many tries. Please wait a while and try again.';
    case 'profile_exists': return 'This account is already set up.';
    case 'email_required': return 'Your sign-in did not share an email address. Use email sign-up instead.';
    case 'bad_nickname': return 'Choose a different nickname: 2 to 12 letters, numbers, spaces, dots, dashes or underscores, and nothing rude.';
    case 'nickname_taken': return 'That nickname is taken. Try another.';
    case 'bad_dob': return 'Enter a real date of birth.';
    case 'bad_country': return 'Choose your country.';
    case 'country_not_supported': return 'Sorry, the game is not available in your country yet.';
    case 'cannot_create_account': return 'We could not create this account.';
    case 'parent_email_required': return 'Because of your age, a parent or guardian must agree first. Enter their email address.';
    case 'parent_email_invalid': return 'That parent email address does not look right.';
    case 'parent_email_same': return 'The parent email must be a different address from yours.';
    case 'consent_unavailable': return 'We cannot ask a parent for permission right now. Please try again later.';
    case 'reauth_required': return 'For safety, sign in again and then delete the account right away.';
    case 'network': case 'no_server': return 'Cannot reach the game server. Check your connection and try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

export const useAuth = create<AuthState>((set, get) => {
  const token = () => get().session?.access_token ?? null;

  async function loadProfile() {
    try {
      const { profile } = await api<{ profile: Profile | null }>('GET', '/api/account/me', token());
      set({ profile, status: profile ? 'ready' : 'needsProfile' });
    } catch (e) {
      // A refused login means the saved session is dead; anything else is a connection problem.
      if (e instanceof ApiError && e.status === 401) {
        await (await getSupabase())?.auth.signOut({ scope: 'local' });
        set({ session: null, profile: null, status: 'signedOut' });
      } else {
        set({ status: 'error' });
      }
    }
  }

  const failOnError = (error: { message?: string; status?: number } | null) => {
    if (error) throw new ApiError(error.status === 429 ? 'rate_limited' : (error.message ?? 'auth_error'), error.status ?? 400);
  };

  return {
    status: authEnabled() ? 'loading' : 'off',
    session: null,
    profile: null,
    recovery: false,
    notice: null,
    email: null,

    init() {
      void (async () => {
      const sb = await getSupabase();
      if (!sb) return set({ status: 'off' });
      sb.auth.onAuthStateChange((event, session) => {
        set({ session, email: session?.user.email ?? null });
        if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
        if (event === 'SIGNED_OUT' || !session) set({ profile: null, status: 'signedOut' });
        // Called inside Supabase's lock: do the network work after it returns.
        else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(() => void loadProfile(), 0);
      });
      })();
    },

    async signUp(email, password, captchaToken) {
      const sb = (await getSupabase())!;
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl(), captchaToken } });
      failOnError(error);
      // With email confirmation on, there is no session until the link in the email is opened.
      if (!data.session) set({ notice: 'Check your email and open the link we sent to finish signing up.' });
    },

    async signIn(email, password, captchaToken) {
      const { error } = await (await getSupabase())!.auth.signInWithPassword({ email, password, options: { captchaToken } });
      failOnError(error);
    },

    async signInWith(provider) {
      const { error } = await (await getSupabase())!.auth.signInWithOAuth({ provider, options: { redirectTo: appUrl() } });
      failOnError(error);
    },

    async requestReset(email, captchaToken) {
      const { error } = await (await getSupabase())!.auth.resetPasswordForEmail(email, { redirectTo: appUrl(), captchaToken });
      failOnError(error);
      // Same message whether or not the address has an account, so it cannot be used to find out who plays.
      set({ notice: 'If that address has an account, we sent a link to choose a new password.' });
    },

    async setNewPassword(password) {
      const { error } = await (await getSupabase())!.auth.updateUser({ password });
      failOnError(error);
      set({ recovery: false, notice: 'Password changed.' });
    },

    async finishProfile(input) {
      const out = await api<{ profile: Profile; parentMailed: boolean }>('POST', '/api/account/profile', token(), input);
      set({ profile: out.profile, status: 'ready' });
      return { parentMailed: out.parentMailed };
    },

    async refreshProfile() {
      await loadProfile();
    },

    async resendConsent() {
      await api('POST', '/api/account/consent/resend', token());
      set({ notice: 'We sent your parent another email.' });
    },

    async signOut() {
      // Tell the game server first, so this login stops working there at once, even if it is copied elsewhere.
      await api('POST', '/api/account/logout', token()).catch(() => undefined);
      await (await getSupabase())?.auth.signOut({ scope: 'local' });
      set({ session: null, profile: null, status: 'signedOut' });
    },

    async signOutEverywhere() {
      await api('POST', '/api/account/logout-all', token()).catch(() => undefined);
      await (await getSupabase())?.auth.signOut({ scope: 'global' }); // also ends the refresh tokens on every device
      set({ session: null, profile: null, status: 'signedOut' });
    },

    async deleteAccount(password) {
      const sb = (await getSupabase())!;
      // Deleting needs a login from the last few minutes, so ask for the password again and start a fresh session.
      if (password && get().email) {
        const { error } = await sb.auth.signInWithPassword({ email: get().email!, password });
        failOnError(error);
        const { data } = await sb.auth.getSession();
        set({ session: data.session });
      }
      await api('POST', '/api/account/delete', token(), { confirm: 'DELETE' });
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
      set({ session: null, profile: null, status: 'signedOut', notice: 'Your account was deleted.' });
    },

    clearNotice() {
      set({ notice: null });
    },
  };
});
