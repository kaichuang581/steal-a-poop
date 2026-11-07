import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { API, CORS, fakeBackends, json } from './fakes';

// The app here is built with real sign-in on, pointed at made-up addresses. Everything it would send to Supabase,
// Cloudflare or the game server is answered by this file, so these tests check the SCREENS and what they send.
// They do not talk to the real Supabase, and passing them says nothing about a real sign-in working.
test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });

async function openAccountDialog(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  await page.goto('./');
  await page.getByRole('button', { name: /^Play with others/ }).click();
  return page.getByRole('dialog', { name: 'Account' });
}

test('a new player signs up with an email and password, then only picks a username', async ({ page }) => {
  const seen = await fakeBackends(page);
  const dlg = await openAccountDialog(page);

  // Sign up: needs the bot check and asks Supabase with that token. (Supabase is set not to send a confirmation email;
  // this fake answers without a session, which is what a project that still confirms would do.)
  await dlg.getByRole('tab', { name: 'Sign up' }).click();
  await dlg.getByLabel('Email').fill('kid@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await expect(dlg.getByRole('button', { name: 'Create account' })).toBeEnabled(); // the bot check finished
  await dlg.getByRole('button', { name: 'Create account' }).click();
  const signup = seen.find((s) => s.url.includes('/auth/v1/signup'))!;
  expect(signup.body).toMatchObject({ email: 'kid@example.org', gotrue_meta_security: { captcha_token: 'cf-test-token' } });

  await dlg.getByRole('tab', { name: 'Sign in' }).click();
  await dlg.getByLabel('Email').fill('kid@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();

  // No profile yet: one field, a username. No date of birth, country or parent's email.
  await expect(dlg.getByRole('heading', { name: 'One more step' })).toBeVisible();
  await expect(dlg.getByLabel('Date of birth')).toHaveCount(0);
  await expect(dlg.getByLabel(/parent or guardian/i)).toHaveCount(0);
  await dlg.getByLabel('Choose a username').fill('fuck');
  await expect(dlg.getByText('Please pick a friendlier username.')).toBeVisible(); // a rude name is caught before anything is sent
  await expect(dlg.getByRole('button', { name: 'Start playing' })).toBeDisabled();
  await dlg.getByLabel('Choose a username').fill('Kiddo');
  await dlg.getByRole('button', { name: 'Start playing' }).click();

  await expect(dlg.getByText('You are signed in as')).toContainText('Kiddo');
  const made = seen.find((s) => s.url === '/api/account/username')!;
  expect(made.auth).toMatch(/^Bearer .+\..+\..+$/); // the server is sent the login token
  expect(made.body).toEqual({ nickname: 'Kiddo', captchaToken: 'cf-test-token' });
  expect(seen.some((s) => s.url === '/api/account/profile')).toBe(false); // the old age-and-parent form is not used
  await dlg.getByRole('button', { name: 'Continue' }).click();
  await expect(dlg).toHaveCount(0);
});

test('a guest needs no account: a username, saved in the browser, and nothing sent anywhere', async ({ page }) => {
  const seen = await fakeBackends(page);
  const dlg = await openAccountDialog(page);
  await dlg.getByRole('button', { name: 'Play as a guest' }).click();
  await dlg.getByLabel('Choose a username').fill('Hitler');
  await expect(dlg.getByRole('button', { name: 'Start playing' })).toBeDisabled();
  await dlg.getByLabel('Choose a username').fill('Sheepy');
  await dlg.getByRole('button', { name: 'Start playing' }).click();
  await expect(dlg).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sap:guest') ?? 'null')?.nickname)).toBe('Sheepy');
  expect(seen.filter((s) => s.url.includes('/auth/') || s.url.startsWith('/api/account'))).toHaveLength(0);
});

test('an existing player signs in, and can log out, log out everywhere, and delete the account', async ({ page }) => {
  const seen = await fakeBackends(page);
  const dlg = await openAccountDialog(page);
  await dlg.getByLabel('Email').fill('ana@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dlg.getByLabel('Choose a username').fill('Ana');
  await dlg.getByRole('button', { name: 'Start playing' }).click();
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
  await page.route(`${API}/api/account/username`, (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : json(r, { error: 'nickname_taken' }, 409)));
  const dlg = await openAccountDialog(page);
  await dlg.getByLabel('Email').fill('ana@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dlg.getByLabel('Choose a username').fill('Taken');
  await dlg.getByRole('button', { name: 'Start playing' }).click();
  await expect(dlg.getByRole('alert')).toContainText('That nickname is taken');
  await expect(dlg.getByLabel('Choose a username')).toHaveValue('Taken'); // what was typed is still there
});
