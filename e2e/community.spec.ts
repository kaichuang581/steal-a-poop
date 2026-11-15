import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fakeBackends, fakeCommunity, fakeGameServer } from './fakes';
import type { CommunityState } from './fakes';

test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });

const state = (over: Partial<CommunityState> = {}): CommunityState => ({
  balance: 120,
  owned: new Set(),
  worn: {},
  visible: true,
  ...over,
});

async function signedIn(page: Page, st: CommunityState) {
  await fakeBackends(page, { profile: { nickname: 'Ana', country: 'CA', consentStatus: 'not_required', createdAt: 1 } });
  const seen = await fakeCommunity(page, st); // registered last, so it answers first
  const game = await fakeGameServer(page);
  await page.addInitScript(() => localStorage.setItem('sap:tourDone', 'true'));
  await page.goto('./');
  await page.getByRole('button', { name: /^Play with others/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Account' });
  await dlg.getByLabel('Email').fill('ana@example.org');
  await dlg.getByLabel('Password').fill('correct-horse-9');
  await dlg.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dlg.getByText('You are signed in as')).toBeVisible();
  await dlg.getByRole('button', { name: 'Continue' }).click();
  return { seen, game };
}

test('boards and stats, and hiding yourself', async ({ page }) => {
  const st = state();
  const { seen } = await signedIn(page, st);
  await page.getByRole('button', { name: 'Boards' }).click();
  const hub = page.getByRole('dialog', { name: 'Boards and shop' });

  const list = hub.getByRole('list', { name: 'Leaderboard' });
  await expect(list).toContainText('Ben'); // the Daily Table is first
  await expect(list.locator('li').first()).toContainText('95');
  await hub.getByRole('tab', { name: 'This week' }).click();
  await hub.getByRole('tab', { name: 'Points' }).click();
  await expect(list).toContainText('Cy');
  await expect(list).toContainText('👑');
  expect(seen.some((s) => s.url === '/api/leaderboard/week?metric=points')).toBe(true);

  const stats = hub.getByRole('region', { name: 'Your stats' });
  await expect(stats).toContainText('410');
  await expect(stats).toContainText('ZEBRA');
  await stats.getByLabel('Show me on the leaderboards').click(); // the box changes once the server has answered
  await expect(stats.getByLabel('Show me on the leaderboards')).not.toBeChecked();
  await expect(stats.getByRole('status')).toContainText('hidden');
  expect(seen.find((s) => s.url === '/api/me/settings')!.body).toEqual({ leaderboardVisible: false });
});

test('the shop: buying with coins, being unable to afford more, wearing and taking off', async ({ page }) => {
  const st = state();
  const { seen } = await signedIn(page, st);
  await page.getByRole('button', { name: 'Shop' }).click();
  const hub = page.getByRole('dialog', { name: 'Boards and shop' });
  await expect(hub.locator('[data-balance]')).toHaveText('120');
  await expect(hub.getByText('cannot be bought with money')).toBeVisible();

  await expect(hub.getByRole('button', { name: 'Buy Gold name for 150 coins' })).toBeDisabled(); // 120 < 150
  await hub.getByRole('button', { name: 'Buy Mint name for 100 coins' }).click();
  await expect(hub.locator('[data-balance]')).toHaveText('20');
  await expect(hub.getByRole('status')).toContainText('Bought');
  expect(seen.find((s) => s.url === '/api/shop/buy')!.body).toEqual({ itemId: 'color-mint' });

  await hub.getByRole('button', { name: 'Wear Mint name' }).click();
  await expect(hub.getByRole('button', { name: 'Take off Mint name' })).toBeVisible();
  expect(seen.find((s) => s.url === '/api/shop/equip')!.body).toEqual({ slot: 'color', itemId: 'color-mint' });
  await hub.getByRole('button', { name: 'Take off Mint name' }).click();
  await expect(hub.getByRole('button', { name: 'Wear Mint name' })).toBeVisible();
});

// The friends list and its room invites are gone (Brian, 2026-11-14): a room is reached by its code or link.
test('in a room everyone sees what the others wear, and there is no friends list to invite from', async ({ page }) => {
  const st = state();
  const { game } = await signedIn(page, st);
  await expect.poll(() => game.received.some((m) => m.t === 'hello')).toBe(true); // connected in the background after sign-in
  expect(game.received.find((m) => m.t === 'hello').token).toMatch(/^.+\..+\..+$/); // with the real login token
  await expect(page.getByRole('button', { name: 'Friends' })).toHaveCount(0);

  const others = page.getByRole('button', { name: /^Play with others/ });
  if (await others.isVisible()) await others.click();
  game.push({
    t: 'room', serverNow: Date.now(), you: { userId: 'u1', seat: null },
    view: {
      code: 'ROOM5', name: "Fay's room", visibility: 'private', hostId: 'f1', phase: 'lobby', min: 4, max: 10, seatOf: {}, game: null, chatMuted: false, mutedIds: [],
      members: [{ userId: 'f1', name: 'Fay', cosmetics: { badge: '🔥', color: '#6ee7b7', title: 'the Thief' } }, { userId: 'u1', name: 'Ana' }],
    },
  });
  const players = page.getByLabel('Players');
  await expect(players).toContainText('Fay');
  await expect(players).toContainText('🔥');
  await expect(players).toContainText('the Thief'); // what they wear is shown to everyone in the room

  await page.getByRole('button', { name: 'I understand and agree' }).click(); // the chat rules come first in any room
  await expect(page.getByRole('button', { name: 'Copy invite link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite friends' })).toHaveCount(0);
  game.push({ t: 'invited', from: { userId: 'f1', name: 'Fay' }, code: 'OTHER', roomName: 'Another room' }); // an older server's message is ignored
  await expect(page.getByText('invites you to')).toHaveCount(0);
});

test('coins earned by a game update the balance', async ({ page }) => {
  const st = state();
  const { game } = await signedIn(page, st);
  await expect.poll(() => game.received.some((m) => m.t === 'hello')).toBe(true);
  game.push({ t: 'reward', coins: 35, parts: [{ label: 'Finished the game', coins: 10 }, { label: 'Won', coins: 25 }], balance: 155 });
  await expect(page.getByRole('group', { name: 'Community' })).toContainText('155');
});
