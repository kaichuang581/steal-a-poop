import { expect, test } from '@playwright/test';

const run = String(Date.now() % 100000);

test('a held message reaches the moderator screen and a person clears it', async ({ browser }) => {
  const name = `Pat${run}`;
  // --- A player trips the filter in a room chat
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await pctx.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  const player = await pctx.newPage();
  await player.goto('./');
  await player.getByPlaceholder('You').fill(name);
  await player.getByRole('button', { name: /^Play with others/ }).click();
  await expect(player.getByText(`Online as ${name}`)).toBeVisible();
  await player.getByRole('button', { name: 'Create', exact: true }).click();
  await player.getByRole('button', { name: 'I understand and agree' }).click();
  await player.getByLabel('Chat message').fill('what the sh1t');
  await player.getByRole('button', { name: 'Send' }).click();
  await expect(player.getByRole('alert')).toContainText('suspended');

  // --- A moderator signs in at #/mod; ordinary players are refused
  const mctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const mod = await mctx.newPage();
  await mod.goto('./#/mod');
  await mod.getByLabel('Moderator token').fill(`dev:${name}`);
  await mod.getByRole('button', { name: 'Sign in' }).click();
  await expect(mod.getByRole('alert')).toContainText('not_a_moderator');
  await mod.evaluate(() => sessionStorage.clear());
  await mod.reload();
  await mod.getByLabel('Moderator token').fill('dev:Mona');
  await mod.getByRole('button', { name: 'Sign in' }).click();

  // --- The item appears once the review pass has handed it to a person (every 5s)
  const list = mod.getByLabel('Waiting for a person');
  await expect(async () => {
    await mod.getByRole('button', { name: 'Refresh' }).click();
    await expect(list).toContainText('sh1t', { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await list.getByRole('button', { name: /sh1t/ }).first().click();
  await expect(mod.getByTestId('held-text')).toHaveText('what the sh1t');
  await expect(mod.getByLabel('Item')).toContainText('suspended until');

  // --- Deciding needs a reason; then it leaves the queue
  const clear = mod.getByRole('button', { name: 'clear', exact: true });
  await expect(clear).toBeDisabled();
  await mod.getByLabel(/^Reason/).fill('quoting a song, not abuse');
  await clear.click();
  await expect(mod.getByLabel('Item')).toHaveCount(0);
  await expect(list).not.toContainText('what the sh1t');
  await pctx.close();
  await mctx.close();
});
