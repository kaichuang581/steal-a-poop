import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ready = (page: Page, label: string) =>
  page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes(t) && !b.disabled),
    label,
  );

const skipTourFlag = (page: Page) => page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));

test('first visit lands on the homepage; the Tutorial button opens the tour', async ({ page }) => {
  await page.goto('./');
  await ready(page, 'Tutorial');
  const tour = page.locator('[aria-label="Tutorial"]');
  await expect(tour).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(tour.locator('h2')).toHaveText('Welcome');
  await tour.getByRole('button', { name: 'Exit tour' }).click();
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible();
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
  test.setTimeout(240_000); // how soon a bot opens a usable steal window is random
  await skipTourFlag(page);
  await page.goto('./');
  await ready(page, 'Practice');
  await page.getByRole('button', { name: /^Practice/ }).click();
  const stealBtn = page.locator('[data-tour="steal"]');
  const input = page.getByLabel(/^Type a word/);

  // A steal window can be very short (a bot that answers late in its turn leaves a fraction of a
  // second), so a missed window just means waiting for the next one, as a real player would.
  let stole = false;
  let checkedEmpty = false;
  for (let attempt = 0; attempt < 8 && !stole; attempt++) {
    await expect(stealBtn).toBeVisible({ timeout: 90_000 });
    try {
      if (!checkedEmpty) {
        await stealBtn.click({ timeout: 2000 }); // empty: nothing happens
        await expect(input).toHaveValue('', { timeout: 1000 });
        checkedEmpty = true;
      }
      await page.getByRole('button', { name: 'Hint' }).click({ timeout: 2000 });
      await page.locator('[aria-label="Word ideas"] button').first().click({ timeout: 2000 });
      await stealBtn.click({ timeout: 2000 });
      await expect(page.locator('aside').last()).toContainText('STEAL', { timeout: 2000 });
      stole = true;
    } catch {
      await page.waitForTimeout(1500); // window closed under us: wait for the next one
    }
  }
  expect(stole, 'a steal should land within a few windows').toBe(true);
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
