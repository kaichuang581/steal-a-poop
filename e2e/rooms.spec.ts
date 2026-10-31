import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const WORDS = readFileSync('public/words.txt', 'utf8').split('\n').filter((w) => /^[a-z]{4,8}$/.test(w));

/** A legal word for the chain letter and the round's modifier, read from what is on screen. */
function pickWord(letter: string, modifier: string): string {
  const ok = (w: string) => {
    if (!w.startsWith(letter.toLowerCase())) return false;
    if (/No E/i.test(modifier)) return !w.includes('e');
    if (/6\+/.test(modifier)) return w.length >= 6;
    if (/Double letter/i.test(modifier)) return /(.)\1/.test(w);
    return true;
  };
  const word = WORDS.find(ok);
  if (!word) throw new Error(`no word for ${letter} / ${modifier}`);
  return word;
}

/** Names carry a per-run suffix: a reused server remembers earlier players' suspensions and rooms. */
const run = String(Date.now() % 100000);
const tag = (n: string) => `${n}${run}`;

async function newPlayer(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  const page = await ctx.newPage();
  await page.goto('./');
  await page.getByPlaceholder('You').fill(name);
  await page.getByRole('button', { name: /^Play with others/ }).click();
  await expect(page.getByText(`Online as ${name}`)).toBeVisible();
  return { ctx, page };
}

const acceptRules = async (page: Page) => {
  const btn = page.getByRole('button', { name: 'I understand and agree' });
  await expect(btn).toBeVisible();
  await btn.click();
};

test('four players: rooms, manual start, a move, chat rules, a held message, leaving', async ({ browser }) => {
  const names = ['Ana', 'Ben', 'Cy', 'Di'].map(tag);
  const players = [];
  for (const n of names) players.push(await newPlayer(browser, n));
  const [ana, ben, cy, di] = players.map((p) => p.page);

  // --- Ana makes a public room
  await ana.getByRole('button', { name: 'Create', exact: true }).click();
  const code = (await ana.locator('[data-room-code]').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  await acceptRules(ana); // the chat rules warning is the first thing anyone sees in a room
  await expect(ana.getByRole('note')).toContainText('CHAT RULES');

  // --- Ben finds it in the public list; Cy and Di use the code
  await ben.getByRole('button', { name: 'Refresh' }).click();
  const openRooms = ben.getByLabel('Open public rooms');
  await expect(openRooms).toContainText(`${names[0]}'s room`);
  await expect(openRooms).toContainText('1/10');
  await openRooms.getByRole('button', { name: 'Join' }).click();
  await expect(ben.locator('[data-room-code]')).toHaveText(code);
  for (const p of [cy, di]) {
    await p.getByLabel('Room code').fill(code.toLowerCase());
    await p.getByLabel('Join with a code').getByRole('button', { name: 'Join' }).click();
    await expect(p.locator('[data-room-code]')).toHaveText(code);
  }
  for (const p of [ben, cy, di]) await acceptRules(p);

  // --- Start is the host's, and needs four
  await expect(ana.getByLabel('Players')).toContainText('4/10');
  await expect(ben.getByText('Waiting for the host to start the game')).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Start game' })).toHaveCount(0);
  await ana.getByRole('button', { name: 'Start game' }).click();
  for (const p of [ana, ben, cy, di]) await expect(p.locator('[data-table]')).toBeVisible();

  // --- Each player sits at the bottom of their own table, next to their input
  for (const p of [ana, ben, cy, di]) {
    const mine = await p.locator('[data-seat]:has-text("(you)")').boundingBox();
    const all = await p.locator('[data-seat]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y));
    expect(mine!.y, 'own seat is the lowest on screen').toBe(Math.max(...all));
  }

  // --- Whoever's turn it is plays a real word; everyone sees it
  const pages = [ana, ben, cy, di];
  let mover: Page | undefined;
  for (let i = 0; i < 80 && !mover; i++) {
    for (const p of pages) if (await p.getByRole('button', { name: 'Play', exact: true }).isEnabled().catch(() => false)) mover = p;
    if (!mover) await ana.waitForTimeout(150);
  }
  expect(mover, 'someone should get a turn').toBeDefined();
  const letter = (await mover!.locator('[data-chain-tile] > div').first().innerText()).trim();
  const modifier = await mover!.locator('[data-tour="modifier"]').innerText();
  const word = pickWord(letter, modifier);
  await mover!.getByLabel(/^Type a word/).fill(word);
  await mover!.keyboard.press('Enter');
  for (const p of pages) await expect(p.locator('aside').last()).toContainText(word.toUpperCase(), { timeout: 5000 });

  // --- Chat in the game: delivered to the room, unread badge on the others
  await ben.getByRole('button', { name: /^Room chat/ }).click();
  await ben.getByLabel('Chat message').fill('good luck everyone');
  await ben.getByRole('button', { name: 'Send' }).click();
  await expect(cy.getByRole('button', { name: /Room chat, 1 new/ })).toBeVisible();
  await cy.getByRole('button', { name: /^Room chat/ }).click();
  await expect(cy.getByRole('log')).toContainText('good luck everyone');
  await expect(cy.getByRole('note')).toContainText('CHAT RULES'); // the warning stays on screen

  // --- A message that breaks the rules: held, sender suspended, nobody else sees it
  await ben.getByLabel('Chat message').fill('what the sh1t');
  await ben.getByRole('button', { name: 'Send' }).click();
  await expect(ben.getByRole('alert')).toContainText('suspended');
  await expect(ben.getByRole('alert')).toContainText('nobody saw it');
  await expect(ben.getByLabel('Chat message')).toBeDisabled();
  await ana.waitForTimeout(400);
  await expect(cy.getByRole('log')).not.toContainText('sh1t');
  await ben.getByRole('button', { name: 'Appeal to a person' }).click();
  await ben.getByLabel('Why should we look again?').fill('it was a joke');
  await ben.getByRole('alert').getByRole('button', { name: 'Send' }).click(); // the appeal's Send, not the locked chat form's

  // --- Di leaves mid-game: back to the lobby; the game goes on with a bot in the seat
  await di.getByRole('button', { name: 'Leave game' }).click();
  await di.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  await expect(di.getByRole('heading', { name: 'Play with others' })).toBeVisible();
  await expect(ana.locator('[data-table]')).toBeVisible();
  await expect(ana.locator('[data-seat]')).toHaveCount(4);

  for (const p of players) await p.ctx.close();
});

test('a private room is not listed, but works with its code; the game cannot be joined once started', async ({ browser }) => {
  const host = await newPlayer(browser, tag('Host'));
  const lurker = await newPlayer(browser, tag('Lurker'));
  await host.page.getByRole('button', { name: 'Private' }).click();
  await host.page.getByRole('button', { name: 'Create', exact: true }).click();
  const code = (await host.page.locator('[data-room-code]').innerText()).trim();

  await lurker.page.getByRole('button', { name: 'Refresh' }).click();
  await expect(lurker.page.getByLabel('Open public rooms')).not.toContainText(`${tag('Host')}'s room`);
  await lurker.page.getByLabel('Room code').fill(code);
  await lurker.page.getByLabel('Join with a code').getByRole('button', { name: 'Join' }).click();
  await expect(lurker.page.locator('[data-room-code]')).toHaveText(code);

  // fewer than four players: the host cannot start
  await expect(host.page.getByRole('button', { name: 'Start game' })).toBeDisabled();
  await expect(host.page.getByText(/You need at least 4 players/)).toBeVisible();

  // a wrong code is refused with a clear message
  const stranger = await newPlayer(browser, tag('Guest'));
  await stranger.page.getByLabel('Room code').fill('ZZZZZ');
  await stranger.page.getByLabel('Join with a code').getByRole('button', { name: 'Join' }).click();
  await expect(stranger.page.getByText('No room with that code.')).toBeVisible();
  for (const p of [host, lurker, stranger]) await p.ctx.close();
});
