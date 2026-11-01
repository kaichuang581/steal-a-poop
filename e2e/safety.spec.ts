import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

const run = String(Date.now() % 100000);
const tag = (n: string) => `${n}${run}`;

async function newPlayer(browser: Browser, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  const page = await ctx.newPage();
  await page.goto('./');
  await page.getByPlaceholder('You').fill(name);
  await page.getByRole('button', { name: /^Play with others/ }).click();
  await expect(page.getByText(`Online as ${name}`)).toBeVisible();
  return { ctx, page };
}
const say = async (p: Page, text: string) => {
  await p.getByLabel('Chat message').fill(text);
  await p.getByRole('button', { name: 'Send' }).click();
};

test('four players: block, host mute, host kick', async ({ browser }) => {
  const names = ['Ana', 'Ben', 'Cy', 'Di'].map(tag);
  const players = [];
  for (const n of names) players.push(await newPlayer(browser, n));
  const [ana, ben, cy, di] = players.map((p) => p.page);
  const [, benName, , diName] = names;

  // A private room, so it never shows up in other tests' room lists
  await ana.getByRole('button', { name: 'Private' }).click();
  await ana.getByRole('button', { name: 'Create', exact: true }).click();
  const code = (await ana.locator('[data-room-code]').innerText()).trim();
  for (const p of [ben, cy, di]) {
    await p.getByLabel('Room code').fill(code);
    await p.getByLabel('Join with a code').getByRole('button', { name: 'Join' }).click();
    await expect(p.locator('[data-room-code]')).toHaveText(code);
  }
  for (const p of [ana, ben, cy, di]) await p.getByRole('button', { name: 'I understand and agree' }).click();
  await expect(ana.getByLabel('Players')).toContainText('4/10');

  // --- Block: Cy blocks Ben; Ben's later messages reach Ana and Di but never Cy
  await say(ben, 'hello everyone');
  for (const p of [ana, cy, di]) await expect(p.getByRole('log')).toContainText('hello everyone');
  await cy.getByRole('button', { name: `Block ${benName}` }).click();
  await expect(cy.getByRole('log')).not.toContainText('hello everyone'); // already-seen messages disappear too
  await expect(cy.getByText('Blocked people (1)')).toBeVisible();
  await say(ben, 'can you see this');
  for (const p of [ana, di]) await expect(p.getByRole('log')).toContainText('can you see this');
  await say(di, 'marker from di');
  await expect(cy.getByRole('log')).toContainText('marker from di'); // proves messages were flowing
  await expect(cy.getByRole('log')).not.toContainText('can you see this');
  // blocking is one way: Ben still sees Cy
  await say(cy, 'cy talking');
  await expect(ben.getByRole('log')).toContainText('cy talking');

  // --- Host mute of one player
  await ana.getByLabel('Players').getByRole('button', { name: `Mute ${diName}` }).click();
  await expect(di.getByLabel('Chat message')).toBeDisabled();
  await expect(di.getByText('The host has muted you in this room.')).toBeVisible();
  await expect(ben.getByLabel('Chat message')).toBeEnabled();
  await ana.getByLabel('Players').getByRole('button', { name: `Unmute ${diName}` }).click();
  await expect(di.getByLabel('Chat message')).toBeEnabled();

  // --- Host pauses chat for the whole room; the host can still talk
  await ana.getByRole('button', { name: 'Pause chat for everyone' }).click();
  for (const p of [ben, cy, di]) await expect(p.getByLabel('Chat message')).toBeDisabled();
  await expect(ana.getByLabel('Chat message')).toBeEnabled();
  await say(ana, 'host only for now');
  await expect(di.getByRole('log')).toContainText('host only for now');
  await ana.getByRole('button', { name: 'Resume chat for everyone' }).click();
  await expect(ben.getByLabel('Chat message')).toBeEnabled();

  // --- A non-host has no such controls
  await expect(ben.getByRole('button', { name: /^Mute / })).toHaveCount(0);
  await expect(ben.getByRole('button', { name: 'Pause chat for everyone' })).toHaveCount(0);

  // --- Unblock restores Ben's messages for Cy
  await cy.getByText('Blocked people (1)').click();
  await cy.getByRole('button', { name: `Unblock ${benName}` }).click();
  await say(ben, 'after unblock');
  await expect(cy.getByRole('log')).toContainText('after unblock');

  // --- Host kick (two clicks): Di is back in the lobby, told why, and cannot rejoin with the code
  await ana.getByLabel('Players').getByRole('button', { name: `Remove ${diName}` }).click();
  await ana.getByLabel('Players').getByRole('button', { name: `Confirm: remove ${diName}` }).click();
  await expect(di.getByRole('heading', { name: 'Play with others' })).toBeVisible();
  await expect(ana.getByLabel('Players')).toContainText('3/10');
  await di.getByLabel('Room code').fill(code);
  await di.getByLabel('Join with a code').getByRole('button', { name: 'Join' }).click();
  await expect(di.getByText('The host removed you from that room.')).toBeVisible();
  await expect(di.locator('[data-room-code]')).toHaveCount(0);

  for (const p of players) await p.ctx.close();
});
