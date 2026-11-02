import { expect, test } from '@playwright/test';

test('the legal pages open, are marked draft, and are linked from the start screen and chat rules', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  await page.goto('./');
  const footer = page.locator('footer');
  for (const [name, slug] of [['Privacy policy', 'privacy'], ['Terms of service', 'terms'], ['Child safety', 'child-safety']] as const) {
    const link = footer.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', new RegExp(`#/legal/${slug}$`));
    await expect(link).toHaveAttribute('target', '_blank'); // opens in a new tab so a game is not lost
  }

  await page.goto('./#/legal/terms');
  await expect(page.getByRole('heading', { name: /Terms of service/ })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('DRAFT');
  await expect(page.getByRole('note')).toContainText('still to be filled in');
  expect(await page.locator('mark[data-placeholder]').count()).toBeGreaterThan(3);
  await expect(page.getByText('No racial slurs or other hateful language.')).toBeVisible();

  // moving between pages needs no reload
  await page.getByRole('navigation', { name: 'Legal pages' }).getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page.getByRole('heading', { name: /Privacy policy/ })).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();

  await page.goto('./#/legal/nope');
  await expect(page.getByText('That page does not exist.')).toBeVisible();

  // and back to the game
  await page.getByRole('link', { name: /Back to the game/ }).click();
  await expect(page.getByRole('button', { name: /Quick game|Play/ }).first()).toBeVisible();
});
