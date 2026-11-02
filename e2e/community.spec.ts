import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fakeBackends, fakeCommunity, fakeGameServer } from './fakes';
import type { CommunityState } from './fakes';

test.use({ baseURL: 'http://127.0.0.1:4174/steal-a-poop/' });

const state = (over: Partial<CommunityState> = {}): CommunityState => ({
  balance: 120,
  friends: [{ userId: 'f1', name: 'Fay', online: true, cosmetics: { badge: '🔥', color: '#6ee7b7' } }],
  incoming: [{ userId: 'f2', name: 'Gus', online: false }],
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

test('friends: your code, accepting a request, adding by code, removing', async ({ page }) => {
  const st = state();
  const { seen } = await signedIn(page, st);
  await expect(page.getByRole('group', { name: 'Community' })).toContainText('120'); // the coin balance
  await page.getByRole('button', { name: '👥 Friends' }).click();
  const hub = page.getByRole('dialog', { name: 'Friends, boards and shop' });

  await expect(hub.locator('[data-friend-code]')).toHaveText('ABCD2345');
  await expect(hub.getByRole('region', { name: 'Friends' })).toContainText('Fay');
  await expect(hub.getByLabel('Online')).toBeVisible();
  await expect(hub.getByRole('region', { name: 'Friend requests' })).toContainText('Gus');

  await hub.getByRole('button', { name: 'Accept Gus' }).click();
  await expect(hub.getByRole('region', { name: 'Friends' })).toContainText('Gus');
  await expect(hub.getByRole('region', { name: 'Friend requests' })).toHaveCount(0);

  await hub.getByLabel("Friend's code").fill('wxyz-2345');
  await hub.getByRole('button', { name: 'Add' }).click();
  await expect(hub.getByRole('status')).toContainText('Request sent');
  expect(seen.find((s) => s.url === '/api/friends/request')!.body).toEqual({ code: 'wxyz-2345' }); // the server cleans the code up

  await hub.getByLabel("Friend's code").fill('NOSUCH22');
  await hub.getByRole('button', { name: 'Add' }).click();
  await expect(hub.getByRole('alert')).toContainText('No player has that code');

  await hub.getByRole('button', { name: 'Remove Fay' }).click();
  await expect(hub.getByRole('region', { name: 'Friends' })).not.toContainText('Fay');
  await hub.getByRole('button', { name: 'Make a new code' }).click();
  await expect(hub.locator('[data-friend-code]')).toHaveText('ZZZZ9999');
});

test('boards and stats, and hiding yourself', async ({ page }) => {
  const st = state();
  const { seen } = await signedIn(page, st);
  await page.getByRole('button', { name: '🏆 Boards' }).click();
  const hub = page.getByRole('dialog', { name: 'Friends, boards and shop' });

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
  await page.getByRole('button', { name: '🛍️ Shop' }).click();
  const hub = page.getByRole('dialog', { name: 'Friends, boards and shop' });
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

test('a friend\'s invitation appears anywhere, joins the room, and friends can be invited from the room', async ({ page }) => {
  const st = state();
  const { game } = await signedIn(page, st);
  await expect.poll(() => game.received.some((m) => m.t === 'hello')).toBe(true); // connected in the background after sign-in
  expect(game.received.find((m) => m.t === 'hello').token).toMatch(/^.+\..+\..+$/); // with the real login token

  game.push({ t: 'invited', from: { userId: 'f1', name: 'Fay' }, code: 'ROOM5', roomName: "Fay's room" });
  const toast = page.getByRole('alert').filter({ hasText: 'Fay' });
  await expect(toast).toContainText("invites you to Fay's room");
  await toast.getByRole('button', { name: 'Join' }).click();
  await expect.poll(() => game.received.some((m) => m.t === 'join' && m.code === 'ROOM5')).toBe(true);

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
  await page.getByRole('button', { name: 'Invite friends' }).click();
  const hub = page.getByRole('dialog', { name: 'Friends, boards and shop' });
  await hub.getByRole('button', { name: 'Invite Fay' }).click();
  await expect.poll(() => game.received.find((m) => m.t === 'invite')?.userId).toBe('f1');
});

test('coins earned by a game update the balance', async ({ page }) => {
  const st = state();
  const { game } = await signedIn(page, st);
  await expect.poll(() => game.received.some((m) => m.t === 'hello')).toBe(true);
  game.push({ t: 'reward', coins: 35, parts: [{ label: 'Finished the game', coins: 10 }, { label: 'Won', coins: 25 }], balance: 155 });
  await expect(page.getByRole('group', { name: 'Community' })).toContainText('155');
});
