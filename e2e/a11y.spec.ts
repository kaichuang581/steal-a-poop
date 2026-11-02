import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fakeBackends, fakeCommunity, fakeGameServer } from './fakes';
import type { CommunityState } from './fakes';

// Automated accessibility checks (WCAG 2 A and AA rules) and a small-phone layout check on every main screen. Automated tools find roughly a third
// of real problems, so a pass here is not proof that people using screen readers or switches are well served.
const PHONE = { width: 360, height: 640 };
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(RULES).analyze();
  const bad = results.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
      return `${v.id} (${v.impact}): ${n.target.join(' ')}${d.contrastRatio ? ` ratio ${d.contrastRatio} (${d.fgColor} on ${d.bgColor})` : ''}`;
    }),
  );
  expect(bad, `${name} has accessibility problems`).toEqual([]);
}
async function noSideways(page: Page, name: string) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${name} scrolls sideways on a small phone`).toBeLessThanOrEqual(1);
}
async function smallTargets(page: Page, name: string) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]), select, summary, [role=tab]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && (r.height < 40 || r.width < 40) && !(el.tagName === 'A' && el.closest('p, li, span'))
          // a small checkbox is fine when the label around it (which is what a thumb hits) is big enough
          && !(el instanceof HTMLInputElement && el.type === 'checkbox' && (el.closest('label')?.getBoundingClientRect().height ?? 0) >= 40);
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
  );
  expect(small, `${name} has controls too small to tap`).toEqual([]);
}

test.describe('main build (no accounts)', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173/steal-a-poop/' });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', PHONE]] as const) {
    test(`start screen, guide and settings: ${label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
      await page.goto('./');
      await expect(page.getByRole('heading', { name: 'Steal a Poop' })).toBeVisible();
      await audit(page, 'start screen');
      if (label === 'phone') await noSideways(page, 'start screen');
      await page.getByRole('button', { name: 'How to Play' }).click();
      await audit(page, 'how to play');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Settings' }).click();
      await audit(page, 'settings');
      if (label === 'phone') await noSideways(page, 'settings');
    });
    test(`legal pages and the parent page: ${label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const slug of ['privacy', 'terms', 'child-safety']) {
        await page.goto(`./#/legal/${slug}`);
        await expect(page.getByRole('article')).toBeVisible();
        await audit(page, `legal ${slug}`);
        if (label === 'phone') await noSideways(page, `legal ${slug}`);
      }
    });
  }
  test('a practice game on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
    await page.goto('./');
    await page.getByRole('button', { name: /^Practice/ }).click();
    await expect(page.locator('[data-table]')).toBeVisible();
    await audit(page, 'game table');
    await noSideways(page, 'game table');
  });
});

test.describe('build with accounts', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', PHONE]] as const) {
    test(`sign in, profile, parent page and Community: ${label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await fakeBackends(page, { profile: null, consent: { state: 'open', childNickname: 'Kiddo' } }); // no profile yet: the sign-up form
      await fakeGameServer(page);
      await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
      await page.goto('./');
      await page.getByRole('button', { name: /^Play with others/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Account' });
      await expect(dlg).toBeVisible();
      await audit(page, 'sign in');
      await dlg.getByRole('tab', { name: 'Sign up' }).click();
      await audit(page, 'sign up');
      if (label === 'phone') await noSideways(page, 'sign up');
      await dlg.getByRole('tab', { name: 'Sign in' }).click();
      await dlg.getByLabel('Email').fill('ana@example.org');
      await dlg.getByLabel('Password').fill('correct-horse-9');
      await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(dlg.getByRole('heading', { name: 'One more step' })).toBeVisible();
      await audit(page, 'profile form');
      await page.goto('./#/consent/tok-1');
      await expect(page.getByRole('heading', { name: /Permission for a child/ })).toBeVisible();
      await audit(page, 'parent page');
      if (label === 'phone') await noSideways(page, 'parent page');
    });

    test(`friends, boards and shop: ${label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const st: CommunityState = { balance: 120, friends: [{ userId: 'f1', name: 'Fay', online: true, cosmetics: { badge: '🔥' } }], incoming: [{ userId: 'f2', name: 'Gus', online: false }], owned: new Set(['badge-fire']), worn: {}, visible: true };
      await fakeBackends(page, { profile: { nickname: 'Ana', country: 'CA', consentStatus: 'not_required', createdAt: 1 } });
      await fakeCommunity(page, st);
      await fakeGameServer(page);
      await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
      await page.goto('./');
      await page.getByRole('button', { name: /^Play with others/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Account' });
      await dlg.getByLabel('Email').fill('ana@example.org');
      await dlg.getByLabel('Password').fill('correct-horse-9');
      await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
      await dlg.getByRole('button', { name: 'Continue', exact: true }).click();
      await audit(page, 'start screen signed in');
      if (label === 'phone') await noSideways(page, 'start screen signed in');
      for (const [button, ready] of [['👥 Friends', 'Friends'], ['🏆 Boards', 'Leaderboard'], ['🛍️ Shop', 'Badges']] as const) {
        await page.getByRole('button', { name: button }).click();
        const hub = page.getByRole('dialog', { name: 'Friends, boards and shop' });
        await expect(hub.getByRole(ready === 'Leaderboard' ? 'list' : 'region', { name: ready })).toBeVisible();
        await audit(page, `community ${button}`);
        if (label === 'phone') {
          await noSideways(page, `community ${button}`);
          await smallTargets(page, `community ${button}`);
        }
        await hub.getByRole('button', { name: 'Close' }).click();
      }
    });
  }
});
