import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ready = (page: Page, label: string) =>
  page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes(t) && !b.disabled),
    label,
  );

const skipTourFlag = (page: Page) => page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));

test('first visit opens the tutorial by itself, and it does not come back', async ({ page }) => {
  await page.goto('./');
  const tour = page.locator('[aria-label="Tutorial"]');
  await expect(tour.locator('h2')).toHaveText('Welcome');
  await tour.getByRole('button', { name: 'Exit tour' }).click();
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible();
  await page.reload();
  await ready(page, 'Quick Game');
  await expect(tour).toHaveCount(0);
});

test('practice: a clear typo is suggested, confirmed by submitting again, and costs nothing', async ({ page }) => {
  await skipTourFlag(page);
  await page.goto('./');
  await ready(page, 'Practice');
  await page.getByRole('button', { name: /^Practice/ }).click();
  const hint = page.getByRole('button', { name: 'Hint' });
  await expect(hint).toBeEnabled({ timeout: 20_000 });
  const input = page.getByLabel(/^Type a word/);

  await input.fill('qqqq');
  await input.press('Enter');
  await expect(page.locator('[data-typo-fix]')).toHaveCount(0); // not a typo: just bounces, free
  await expect(input).toHaveValue('qqqq');

  await hint.click();
  const words = (await page.locator('[aria-label="Word ideas"] button').allInnerTexts()).map((w) => w.trim().toLowerCase());
  let typed = '';
  let word = '';
  search: for (const w of words) {
    for (const filler of ['q', 'j', 'z', 'x', 'v', 'k']) {
      await input.fill(w + filler);
      await input.press('Enter');
      if (await page.locator('[data-typo-fix]').count()) {
        typed = w + filler;
        word = w;
        break search;
      }
    }
  }
  expect(typed, 'one hint word should give an unambiguous typo').not.toBe('');
  await expect(page.locator('[data-typo-fix]')).toContainText('submit again to confirm');
  await input.press('Enter'); // confirm
  await expect(page.locator('aside').last()).toContainText(word.toUpperCase());
  await expect(page.locator('[aria-label="Scoreboard"] li').filter({ hasText: 'You' })).toContainText('0');
});

test('practice: a steal needs a typed word, then takes the turn', async ({ page }) => {
  await skipTourFlag(page);
  await page.goto('./');
  await ready(page, 'Practice');
  await page.getByRole('button', { name: /^Practice/ }).click();
  const stealBtn = page.locator('[data-tour="steal"]');
  await expect(stealBtn).toBeVisible({ timeout: 90_000 });
  const input = page.getByLabel(/^Type a word/);

  await stealBtn.click(); // empty: nothing happens
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: 'Hint' }).click();
  await page.locator('[aria-label="Word ideas"] button').first().click();
  await stealBtn.click();
  await expect(page.locator('aside').last()).toContainText('STEAL', { timeout: 5_000 });
});

test('a full game reaches the end screen', async ({ browser }) => {
  // Speed the game clock up 20x so a three-round game finishes in about 30 seconds.
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('sap:tourDone', 'true');
    const real = performance.now.bind(performance);
    const t0 = real();
    performance.now = () => t0 + (real() - t0) * 20;
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/steal-a-poop/');
  await ready(page, 'Quick Game');
  await page.getByRole('button', { name: 'hard' }).click();
  await page.locator('fieldset:has-text("Players") button', { hasText: /^4$/ }).click();
  await page.getByRole('button', { name: 'Quick Game' }).click();
  await expect(page.locator('[aria-label="Game over"]')).toBeAttached({ timeout: 100_000 });
  await context.close();
});
