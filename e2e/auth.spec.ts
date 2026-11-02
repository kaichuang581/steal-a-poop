import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

// The app here is built with real sign-in on, pointed at made-up addresses. Everything it would send to Supabase,
// Cloudflare or the game server is answered by this file, so these tests check the SCREENS and what they send.
// They do not talk to the real Supabase, and passing them says nothing about a real sign-in working.
test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });

const SB = 'http://127.0.0.1:8790';
const API = 'http://127.0.0.1:8788';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = () => `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600, session_id: 's1' })}.sig`;

interface Seen { url: string; method: string; auth?: string; body?: any } // eslint-disable-line @typescript-eslint/no-explicit-any

async function fakeBackends(page: Page, opts: { profile?: object | null; parentMailed?: boolean; consent?: object } = {}) {
  const seen: Seen[] = [];
  let profile: object | null = opts.profile ?? null;
  await page.route('https://challenges.cloudflare.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "window.turnstile={render:function(el,o){setTimeout(function(){o.callback('cf-test-token')},10);return 'w1'},remove:function(){}};" }));
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    seen.push({ url: url.pathname + url.search, method: req.method(), body });
    if (url.pathname.endsWith('/signup')) return json(route, { id: 'u1', email: body.email, aud: 'authenticated' }); // no session: email not confirmed yet
    if (url.pathname.endsWith('/token')) {
      return json(route, { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: { id: 'u1', email: body.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith('/recover')) return json(route, {});
    return json(route, {});
  });
  await page.route(`${API}/api/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    seen.push({ url: path, method: req.method(), auth: req.headers().authorization, body });
    if (path === '/api/account/me') return json(route, { profile });
    if (path === '/api/account/profile') {
      profile = { nickname: body.nickname, country: body.country, consentStatus: body.parentEmail ? 'pending' : 'not_required', createdAt: 1 };
      return json(route, { profile, parentMailed: opts.parentMailed ?? true }, 201);
    }
    if (path.startsWith('/api/consent/manage/')) return json(route, { state: 'withdrawn' });
    if (path.startsWith('/api/consent/')) {
      if (req.method() === 'GET') return opts.consent ? json(route, opts.consent) : json(route, { error: 'not_found' }, 404);
      return json(route, { state: body.decision === 'grant' ? 'granted' : 'refused' });
    }
    return json(route, { ok: true });
  });
  return seen;
}

async function openAccountDialog(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  await page.goto('./');
  await page.getByRole('button', { name: /^Play with others/ }).click();
  return page.getByRole('dialog', { name: 'Account' });
}

test('a child signs up: email check, profile with a parent\'s email, then waits for permission', async ({ page }) => {
  const seen = await fakeBackends(page);
  const dlg = await openAccountDialog(page);

  // Sign up: needs the bot check, asks Supabase with that token, and tells the person to check their email
  await dlg.getByRole('tab', { name: 'Sign up' }).click();
  await dlg.getByLabel('Email').fill('kid@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await expect(dlg.getByRole('button', { name: 'Create account' })).toBeEnabled(); // the bot check finished
  await dlg.getByRole('button', { name: 'Create account' }).click();
  await expect(dlg.getByRole('status')).toContainText('Check your email');
  const signup = seen.find((s) => s.url.includes('/auth/v1/signup'))!;
  expect(signup.body).toMatchObject({ email: 'kid@example.org', gotrue_meta_security: { captcha_token: 'cf-test-token' } });

  // Sign in (after the email link, in real life)
  await dlg.getByRole('tab', { name: 'Sign in' }).click();
  await dlg.getByLabel('Email').fill('kid@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();

  // The server says there is no profile yet: the "one more step" form
  await expect(dlg.getByRole('heading', { name: 'One more step' })).toBeVisible();
  await dlg.getByLabel('Nickname').fill('Kiddo');
  await dlg.getByLabel('Date of birth').fill('2018-01-01');
  await dlg.getByLabel('Country').selectOption('CA');
  await expect(dlg.getByLabel(/parent or guardian/i)).toBeVisible(); // asked because of the age
  await dlg.getByLabel(/parent or guardian/i).fill('mum@example.org');
  await dlg.getByRole('button', { name: 'Finish' }).click();

  await expect(dlg.getByRole('heading', { name: 'Waiting for your parent' })).toBeVisible();
  await expect(dlg.getByRole('status')).toContainText('We emailed your parent');
  const made = seen.find((s) => s.url === '/api/account/profile')!;
  expect(made.auth).toMatch(/^Bearer .+\..+\..+$/); // the server is sent the login token
  expect(made.body).toEqual({ nickname: 'Kiddo', dateOfBirth: '2018-01-01', country: 'CA', parentEmail: 'mum@example.org', captchaToken: 'cf-test-token' });

  await dlg.getByRole('button', { name: 'Send the email again' }).click();
  await expect.poll(() => seen.some((s) => s.url === '/api/account/consent/resend')).toBe(true);
  await dlg.getByRole('button', { name: 'Play' }).click();
  await expect(dlg).toHaveCount(0);
});

test('an adult is not asked for a parent, and can log out, log out everywhere, and delete the account', async ({ page }) => {
  const seen = await fakeBackends(page);
  const dlg = await openAccountDialog(page);
  await dlg.getByLabel('Email').fill('ana@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dlg.getByLabel('Nickname').fill('Ana');
  await dlg.getByLabel('Date of birth').fill('1990-05-05');
  await dlg.getByLabel('Country').selectOption('CA');
  await expect(dlg.getByLabel(/parent or guardian/i)).toHaveCount(0);
  await dlg.getByRole('button', { name: 'Finish' }).click();
  await expect(dlg.getByText('You are signed in as')).toContainText('Ana');
  await dlg.getByRole('button', { name: 'Continue' }).click();

  // Settings -> account
  await page.getByRole('button', { name: 'Settings' }).click();
  const panel = page.getByRole('region', { name: 'Account' });
  await expect(panel).toContainText('Signed in as Ana');

  await panel.getByRole('button', { name: 'Log out on all devices' }).click();
  await expect.poll(() => seen.some((s) => s.url === '/api/account/logout-all')).toBe(true);
  await expect.poll(() => seen.find((s) => s.url.includes('/auth/v1/logout'))?.url ?? '').toContain('scope=global'); // Supabase is asked to end every refresh token
  await expect(page.getByRole('button', { name: 'Sign in or sign up' })).toBeVisible();

  // sign back in and delete
  await page.getByRole('button', { name: 'Sign in or sign up' }).click();
  const dlg2 = page.getByRole('dialog', { name: 'Account' });
  await dlg2.getByLabel('Email').fill('ana@example.org');
  await dlg2.getByLabel('Password').fill('correct-horse-9');
  await dlg2.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dlg2.getByText('You are signed in as')).toBeVisible();
  await dlg2.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Settings' }).click().catch(() => undefined);
  const panel2 = page.getByRole('region', { name: 'Account' });
  await panel2.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete account' });
  await expect(confirm.getByRole('button', { name: 'Delete forever' })).toBeDisabled(); // the word has to be typed
  await confirm.getByLabel(/Your password/).fill('correct-horse-9');
  await confirm.getByLabel(/Type DELETE/).fill('DELETE');
  await confirm.getByRole('button', { name: 'Delete forever' }).click();
  await expect.poll(() => seen.some((s) => s.url === '/api/account/delete')).toBe(true);
  expect(seen.find((s) => s.url === '/api/account/delete')!.body).toEqual({ confirm: 'DELETE' });
  await expect(page.getByRole('button', { name: 'Sign in or sign up' })).toBeVisible();
});

test('the parent\'s page: read, agree, and later withdraw', async ({ page }) => {
  const seen = await fakeBackends(page, { consent: { state: 'open', childNickname: 'Kiddo' } });
  await page.goto('./#/consent/tok-abc');
  await expect(page.getByRole('heading', { name: /Permission for a child/ })).toBeVisible();
  await expect(page.getByText('Kiddo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', /#\/legal\/privacy$/);
  await page.getByRole('button', { name: 'I agree' }).click();
  await expect(page.getByRole('status')).toContainText('Your child can now chat');
  expect(seen.find((s) => s.method === 'POST' && s.url === '/api/consent/tok-abc')!.body).toEqual({ decision: 'grant' });

  await page.goto('./#/consent/manage/man-xyz');
  await page.getByRole('button', { name: 'Withdraw permission' }).click();
  await expect(page.getByRole('status')).toContainText('Permission withdrawn');
  expect(seen.some((s) => s.url === '/api/consent/manage/man-xyz/withdraw')).toBe(true);
});

test('the parent\'s page says so plainly for an unknown or used link', async ({ page }) => {
  await fakeBackends(page); // no consent configured: the server answers 404
  await page.goto('./#/consent/not-a-real-token');
  await expect(page.getByRole('heading', { name: 'Link not valid' })).toBeVisible();
});

test('a refused request is explained in plain words (nickname taken)', async ({ page }) => {
  await fakeBackends(page);
  await page.route(`${API}/api/account/profile`, (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : json(r, { error: 'nickname_taken' }, 409)));
  const dlg = await openAccountDialog(page);
  await dlg.getByLabel('Email').fill('ana@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dlg.getByLabel('Nickname').fill('Taken');
  await dlg.getByLabel('Date of birth').fill('1990-05-05');
  await dlg.getByLabel('Country').selectOption('CA');
  await dlg.getByRole('button', { name: 'Finish' }).click();
  await expect(dlg.getByRole('alert')).toContainText('That nickname is taken');
  await expect(dlg.getByLabel('Nickname')).toHaveValue('Taken'); // what was typed is still there
});
