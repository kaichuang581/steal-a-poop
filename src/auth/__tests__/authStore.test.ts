import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the Supabase client that records what the app asked it to do. */
function fakeSupabase() {
  const calls: [string, unknown][] = [];
  let listener: ((event: string, session: unknown) => void) | null = null;
  let session: { access_token: string; user: { email: string } } | null = null;
  const result = (extra: object = {}) => ({ data: { session, user: null, ...extra }, error: null as null | { message: string; status?: number } });
  const client = {
    auth: {
      onAuthStateChange: (cb: typeof listener) => ((listener = cb), { data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session } }),
      signUp: async (a: unknown) => (calls.push(['signUp', a]), result()),
      signInWithPassword: async (a: unknown) => {
        calls.push(['signInWithPassword', a]);
        session = { access_token: 'tok-fresh', user: { email: (a as { email: string }).email } };
        return result();
      },
      signInWithOAuth: async (a: unknown) => (calls.push(['signInWithOAuth', a]), result()),
      resetPasswordForEmail: async (e: string, o: unknown) => (calls.push(['reset', [e, o]]), result()),
      updateUser: async (a: unknown) => (calls.push(['updateUser', a]), result()),
      signOut: async (a: unknown) => (calls.push(['signOut', a]), (session = null), result()),
    },
  };
  return { client, calls, emit: (e: string, s: typeof session) => ((session = s), listener?.(e, s)), setSession: (s: typeof session) => (session = s) };
}

const fetchCalls: { url: string; method: string; auth: string | null; body: unknown }[] = [];
let respond: (url: string, method: string) => { status: number; json: unknown } = () => ({ status: 200, json: {} });

beforeEach(() => {
  vi.resetModules();
  fetchCalls.length = 0;
  respond = () => ({ status: 200, json: {} });
  vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
  vi.stubEnv('VITE_SERVER_URL', 'ws://game.test');
  vi.stubGlobal('location', { origin: 'https://site.test' });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    fetchCalls.push({ url, method: init.method ?? 'GET', auth: headers.authorization ?? null, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = respond(url, init.method ?? 'GET');
    return { ok: r.status < 400, status: r.status, json: async () => r.json } as Response;
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  const sb = fakeSupabase();
  const { setSupabaseForTests } = await import('../supabase');
  setSupabaseForTests(sb.client as never);
  const store = await import('../authStore');
  return { sb, ...store };
}
const flush = () => new Promise((r) => setTimeout(r, 5));

describe('auth store', () => {
  it('is off in a build without Supabase settings', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const { useAuth } = await load();
    expect(useAuth.getState().status).toBe('off');
  });

  it('a saved login with no profile goes to "needs profile"; with a profile, to "ready"', async () => {
    const { useAuth, sb } = await load();
    useAuth.getState().init();
    await flush();
    respond = () => ({ status: 200, json: { profile: null } });
    sb.emit('INITIAL_SESSION', { access_token: 'tok1', user: { email: 'a@x.org' } });
    await flush();
    expect(useAuth.getState().status).toBe('needsProfile');
    expect(fetchCalls[0]).toMatchObject({ url: 'http://game.test/api/account/me', method: 'GET', auth: 'Bearer tok1' });
    respond = () => ({ status: 200, json: { profile: { nickname: 'Ana', consentStatus: 'not_required', country: 'CA', createdAt: 1 } } });
    await useAuth.getState().refreshProfile();
    expect(useAuth.getState()).toMatchObject({ status: 'ready', email: 'a@x.org' });
  });

  it('a login the server refuses is dropped; a server that is down is an error, not a sign-out', async () => {
    const { useAuth, sb } = await load();
    useAuth.getState().init();
    await flush();
    respond = () => ({ status: 401, json: { error: 'not_signed_in' } });
    sb.emit('SIGNED_IN', { access_token: 'dead', user: { email: 'a@x.org' } });
    await flush();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(sb.calls).toContainEqual(['signOut', { scope: 'local' }]);
    respond = () => ({ status: 503, json: {} });
    sb.emit('SIGNED_IN', { access_token: 'ok', user: { email: 'a@x.org' } });
    await flush();
    expect(useAuth.getState().status).toBe('error');
  });

  it('sign-up asks Supabase with the CAPTCHA token and the site address, and tells the person to check their email', async () => {
    const { useAuth, sb } = await load();
    await useAuth.getState().signUp('a@x.org', 'password1', 'cap');
    expect(sb.calls[0]).toEqual(['signUp', { email: 'a@x.org', password: 'password1', options: { emailRedirectTo: expect.stringContaining('https://site.test'), captchaToken: 'cap' } }]);
    expect(useAuth.getState().notice).toMatch(/check your email/i);
  });

  it('password reset gives the same message for any address', async () => {
    const { useAuth } = await load();
    await useAuth.getState().requestReset('nobody@x.org', 'cap');
    expect(useAuth.getState().notice).toMatch(/if that address has an account/i);
  });

  it('Google and Meta sign-in use the right provider names', async () => {
    const { useAuth, sb } = await load();
    await useAuth.getState().signInWith('google');
    await useAuth.getState().signInWith('facebook');
    expect(sb.calls.map((c) => (c[1] as { provider: string }).provider)).toEqual(['google', 'facebook']);
  });

  it('turns a Supabase rate-limit answer into our own "too many tries" code', async () => {
    const { useAuth, sb } = await load();
    sb.client.auth.signInWithPassword = async () => ({ data: { session: null, user: null }, error: { message: 'x', status: 429 } }) as never;
    await expect(useAuth.getState().signIn('a@x.org', 'pw')).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('finishing the profile sends it to the server and marks the person ready', async () => {
    const { useAuth, sb } = await load();
    useAuth.getState().init();
    await flush();
    sb.setSession({ access_token: 'tok1', user: { email: 'a@x.org' } });
    sb.emit('TOKEN_REFRESHED', { access_token: 'tok1', user: { email: 'a@x.org' } });
    respond = () => ({ status: 201, json: { profile: { nickname: 'Kiddo', consentStatus: 'pending', country: 'CA', createdAt: 1 }, parentMailed: true } });
    const out = await useAuth.getState().finishProfile({ nickname: 'Kiddo', dateOfBirth: '2018-01-01', country: 'CA', parentEmail: 'mum@x.org', captchaToken: 'cap' });
    expect(out).toEqual({ parentMailed: true });
    expect(fetchCalls.at(-1)).toMatchObject({ method: 'POST', url: 'http://game.test/api/account/profile', auth: 'Bearer tok1', body: { parentEmail: 'mum@x.org', captchaToken: 'cap' } });
    expect(useAuth.getState().profile?.consentStatus).toBe('pending');
  });

  it('turns server error codes into plain sentences', async () => {
    const { describeAuthError } = await load();
    for (const code of ['captcha_failed', 'rate_limited', 'nickname_taken', 'bad_dob', 'parent_email_required', 'country_not_supported', 'reauth_required', 'network', 'whatever']) {
      expect(describeAuthError(code).length).toBeGreaterThan(10);
    }
    expect(describeAuthError('cannot_create_account')).not.toMatch(/ban/i); // never reveals why
  });

  it('log out tells the server first, then signs out here only', async () => {
    const { useAuth, sb } = await load();
    useAuth.setState({ session: { access_token: 'tok1' } as never, status: 'ready' });
    await useAuth.getState().signOut();
    expect(fetchCalls[0]).toMatchObject({ url: 'http://game.test/api/account/logout', method: 'POST', auth: 'Bearer tok1' });
    expect(sb.calls.at(-1)).toEqual(['signOut', { scope: 'local' }]);
    expect(useAuth.getState().status).toBe('signedOut');
  });

  it('"log out on all devices" ends them on the server and asks Supabase to end every refresh token', async () => {
    const { useAuth, sb } = await load();
    useAuth.setState({ session: { access_token: 'tok1' } as never, status: 'ready' });
    await useAuth.getState().signOutEverywhere();
    expect(fetchCalls[0].url).toBe('http://game.test/api/account/logout-all');
    expect(sb.calls.at(-1)).toEqual(['signOut', { scope: 'global' }]);
  });

  it('logs out locally even if the game server cannot be reached', async () => {
    const { useAuth, sb } = await load();
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    useAuth.setState({ session: { access_token: 'tok1' } as never, status: 'ready' });
    await useAuth.getState().signOut();
    expect(sb.calls.at(-1)).toEqual(['signOut', { scope: 'local' }]);
  });

  it('deleting asks for the password again so the login is fresh, then deletes, then signs out', async () => {
    const { useAuth, sb } = await load();
    useAuth.setState({ session: { access_token: 'old' } as never, status: 'ready', email: 'a@x.org' });
    await useAuth.getState().deleteAccount('secret-pw');
    expect(sb.calls[0]).toEqual(['signInWithPassword', { email: 'a@x.org', password: 'secret-pw' }]);
    expect(fetchCalls[0]).toMatchObject({ url: 'http://game.test/api/account/delete', method: 'POST', auth: 'Bearer tok-fresh', body: { confirm: 'DELETE' } });
    expect(sb.calls.at(-1)).toEqual(['signOut', { scope: 'local' }]);
    expect(useAuth.getState().status).toBe('signedOut');
  });

  it('a failed delete leaves the person signed in', async () => {
    const { useAuth } = await load();
    useAuth.setState({ session: { access_token: 'old' } as never, status: 'ready', email: 'a@x.org' });
    respond = () => ({ status: 403, json: { error: 'reauth_required' } });
    await expect(useAuth.getState().deleteAccount()).rejects.toMatchObject({ code: 'reauth_required' });
    expect(useAuth.getState().status).toBe('ready');
  });

  it('getAccessToken returns the current login token or null', async () => {
    const { getAccessToken, sb } = await load();
    expect(await getAccessToken()).toBeNull();
    sb.setSession({ access_token: 'tok9', user: { email: 'a@x.org' } });
    expect(await getAccessToken()).toBe('tok9');
  });
});
