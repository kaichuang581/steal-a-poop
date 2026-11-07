import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ready = (page: Page, label: string) =>
  page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent?.includes(t) && !b.disabled),
    label,
  );

const skipTourFlag = (page: Page) => page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));

/** One everyday word per letter, for games with no Hint button. */
const WORD_FOR: Record<string, string> = {
  a: 'apple', b: 'bread', c: 'chair', d: 'dance', e: 'eagle', f: 'flame', g: 'grape', h: 'house', i: 'image', j: 'judge', k: 'knife', l: 'lemon', m: 'mouse',
  n: 'night', o: 'ocean', p: 'plant', q: 'queen', r: 'river', s: 'stone', t: 'train', u: 'uncle', v: 'voice', w: 'water', x: 'xenon', y: 'youth', z: 'zebra',
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

test('a quick game: a steal needs a typed word, then takes the turn', async ({ page }) => {
  test.setTimeout(240_000); // how soon a bot opens a usable steal window is random
  await skipTourFlag(page);
  await page.goto('./');
  await ready(page, 'Quick Game');
  await page.getByRole('button', { name: /^Quick Game/ }).click();
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
      await input.fill(await chainWord(page));
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
