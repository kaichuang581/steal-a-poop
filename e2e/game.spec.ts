import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ready = (page: Page, label: string) =>
  page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes(t) && !b.disabled),
    label,
  );

const skipTourFlag = (page: Page) => page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));

/**
 * One word per letter, for games with no Hint button. Long, so that swapping two letters leaves exactly one word a single
 * edit away and the game offers a clear typo fix: a short word like PLANT is one edit from PAINT and PLEAT as well.
 */
const WORD_FOR: Record<string, string> = {
  a: 'airplane', b: 'blanket', c: 'chimney', d: 'dolphin', e: 'elephant', f: 'fountain', g: 'goldfish', h: 'hospital', i: 'iceberg', j: 'jungle',
  k: 'kitchen', l: 'lantern', m: 'mountain', n: 'necklace', o: 'octopus', p: 'pumpkin', q: 'question', r: 'rainbow', s: 'sandwich', t: 'triangle',
  u: 'umbrella', v: 'volcano', w: 'whistle', x: 'xylophone', y: 'yesterday', z: 'zeppelin',
};
const chainWord = async (page: Page) => {
  const label = await page.getByLabel(/^Type a word/).getAttribute('aria-label');
  return WORD_FOR[label!.slice(-1).toLowerCase()];
};

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
  const input = page.getByLabel(/^Type a word/);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 20_000 });

  await input.fill('qqqq');
  await input.press('Enter');
  await expect(page.locator('[data-typo-fix]')).toHaveCount(0); // not a typo: just bounces, free
  await expect(input).toHaveValue('qqqq');

  const word = await chainWord(page);
  let typed = '';
  // Two neighbouring letters swapped: an added letter is rarely clear, since swapping it for an S makes a plural.
  for (let i = 1; i < word.length - 1 && !typed; i++) {
    if (word[i] === word[i + 1]) continue;
    const slip = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    await input.fill(slip);
    await input.press('Enter');
    if (await page.locator('[data-typo-fix]').count()) typed = slip;
  }
  expect(typed, 'the word should give an unambiguous typo').not.toBe('');
  await expect(page.locator('[data-typo-fix]')).toContainText('submit again to confirm');
  await input.press('Enter'); // confirm
  await expect(page.locator('aside').last()).toContainText(word.toUpperCase());
  await expect(page.locator('[aria-label="Scoreboard"] li').filter({ hasText: 'You' })).toContainText('0');
});

test('practice: the run ends when your clock runs out, and shows your score', async ({ page }) => {
  await skipTourFlag(page);
  await page.addInitScript(() => localStorage.setItem('sap:settings', JSON.stringify({ practice: { clock: 5, difficulty: 'easy' } })));
  await page.goto('./');
  await ready(page, 'Practice');
  await page.getByRole('button', { name: /^Practice/ }).click();
  await expect(page.getByText('Run over: 0 words')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Rematch' }).click();
  await expect(page.getByText('Run over: 0 words')).toHaveCount(0);
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
