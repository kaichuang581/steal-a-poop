import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Leaderboards, levelSheet, rankedSheet, winsSheet } from '../Leaderboards';

const src = (path: string) => readFileSync(path, 'utf8');

describe('a board, as the page lists it', () => {
  it('the ranked ladder: rating in big letters, the rank it earns beside it, and your place among everyone ranked', () => {
    const s = rankedSheet({
      top: [{ place: 1, name: 'Ann', rating: 1310, games: 12, wins: 7, you: false }, { place: 2, name: 'Bo', rating: 240, games: 4, wins: 1, you: true }],
      you: { place: 2, of: 1204 },
    });
    expect(s.lines).toEqual([
      { place: 1, name: 'Ann', score: '1,310', note: 'Bellwether II', rating: 1310, you: false },
      { place: 2, name: 'Bo', score: '240', note: 'Lamb III', rating: 240, you: true },
    ]);
    expect(s.standing).toBe('#2 of 1,204');
    expect(rankedSheet({ top: [], you: null })).toEqual({ lines: [], standing: null });
  });

  it('the level board: the level in big letters, the XP beside it, a place on it or a share below it', () => {
    const top = [{ place: 1, name: 'Ann', xp: 98000, level: 42, you: false }, { place: 2, name: 'Bo', xp: 300, level: 2, you: true }];
    expect(levelSheet({ top, players: 9, you: { place: 2, xp: 300 } })).toEqual({
      lines: [{ place: 1, name: 'Ann', score: 'Level 42', note: '98,000 XP', you: false }, { place: 2, name: 'Bo', score: 'Level 2', note: '300 XP', you: true }],
      standing: '#2',
    });
    expect(levelSheet({ top: [], players: 20000, you: { place: 101, xp: 5 } }).standing).toBe('Top 0.51%');
    expect(levelSheet({ top, players: 9, you: null }).standing).toBeNull();
  });

  it('online wins: the public board has no ids, so you are the line with your own name', () => {
    const rows = [{ rank: 1, name: 'Cy', value: 12, games: 30 }, { rank: 2, name: 'Ann', value: 1, games: 1 }];
    const signedIn = winsSheet({ rows }, 'Ann');
    expect(signedIn.lines).toEqual([
      { place: 1, name: 'Cy', score: '12', note: 'in 30 games', you: false },
      { place: 2, name: 'Ann', score: '1', note: 'in 1 game', you: true },
    ]);
    expect(signedIn.standing).toBe('#2');
    const guest = winsSheet({ rows }, null);
    expect(guest.lines.some((l) => l.you)).toBe(false);
    expect(guest.standing).toBeNull();
  });
});

// The page as Brian asked for it on 2026-11-14, third round: "dont make the scenery for this one a barn, maybe place
// them up on pedastals on the sky with nonchalant poses ... formatting issues is empty space, generic white cardboard
// looking like pieces, etc, find them all and redo". Rendered without a browser: the sky (three.js) is lazy and draws
// nothing here, and no board has come in yet.
describe('the leaderboards page', () => {
  const page = renderToStaticMarkup(<Leaderboards onClose={() => undefined} />);
  const source = src('src/skin/boards/Leaderboards.tsx');
  const css = src('src/skin/boards/boards.css');
  const stage = src('src/skin/boards/BoardStage.tsx');

  it('is a place, as the lobby is: a strapped beam with the three boards\' tabs, and one plank board of wool', () => {
    expect(page).toContain('class="rm-screen sk-lb"');
    expect(page).toContain('sk-lb-bar kit-beam kit-drift');
    expect(page.match(/class="kit-beam-strap"/g)).toHaveLength(2);
    expect(page.match(/role="tab"/g)).toHaveLength(3);
    for (const label of ['Ranked', 'Wins', 'Level']) expect(page).toContain(`<span>${label}</span>`);
    expect(page).toMatch(/data-tab="ranked" aria-selected="true"/);
    expect(page).toContain('rm-panel kit-wall kit-drift sk-lb-board');
    expect(page).toContain('Ranked ladder');
    expect(page).toContain('rm-wool sk-lb-list');
  });

  it('has no paper anywhere: no cream cards, no room dialog with a scrim', () => {
    for (const text of [page, source, css]) {
      expect(text).not.toMatch(/kit-paper|Paper\b/);
      expect(text).not.toMatch(/sk-room kit-wall|sk-post-scrim/);
    }
  });

  it('the sky: pedestals on islands, the podium\'s own blocks and numerals, the three lounging, loaded after the page', () => {
    expect(source).toContain("lazy(() => import('./BoardStage'))");
    expect(stage).not.toMatch(/<Podium\b|from '\.\.\/table\/Podium';\nimport \{ Podium/);
    expect(stage).toContain("import { blockGeometry, carvedGeometry } from '../table/Podium'");
    expect(stage).toMatch(/island\('windmill'/);
    expect(stage).toContain("import { Dome } from '../scene/Sky'");
    for (const pose of ["'lounge'", "'perch'", "'flop'"]) expect(stage).toContain(`state: ${pose}`);
    expect(stage).toContain('<AdaptiveCanvas');
    expect(stage).toContain('<MarkDrawn />');
    expect(stage).not.toMatch(/useWorld|Snowfall|<Sky\b/);
    // No barn: none of the victory screen's barn pieces.
    expect(stage).not.toMatch(/wallGeometry|doorsGeometry|floorGeometry|baleGeometry|#170D07/);
  });

  it('the victory screen is as it was before the leaderboards: only two builders exported, the second with a lift', () => {
    const podium = src('src/skin/table/Podium.tsx');
    expect(podium).not.toMatch(/PodiumShot|vacant|plates = true|memory = 'podium'/);
    expect(podium).toContain('memory="podium"');
    expect(podium).toContain('export function blockGeometry(place: number, lift = 0)');
    expect(podium).toContain('export function carvedGeometry(place: number)');
  });

  it('before a board is in: the wool says the barn is being asked, once, and your plate is there', () => {
    expect(page).not.toContain('data-free');
    expect(page.match(/class="sk-lb-rest"/g)).toHaveLength(1);
    expect(page).toContain('Asking the barn...');
    expect(page).toContain('sk-lb-you sk-ledger-turn');
    expect(page).toContain('No rank yet');
  });

  it('has no Daily Table, no friends, and no dots between phrases', () => {
    expect(page).not.toMatch(/Daily Table|Friends|metric=points/);
    expect(page).not.toContain('·');
    expect(source).not.toContain('·');
    expect(stage).not.toContain('·');
  });

  it('keeps the kit audit\'s rules in its stylesheet: no gradient, corners of 4 px at most, every font the skin\'s', () => {
    expect(css).not.toMatch(/gradient\(/);
    for (const r of css.matchAll(/border-radius:\s*(\d+)px/g)) expect(Number(r[1])).toBeLessThanOrEqual(4);
    for (const f of css.matchAll(/font-family:\s*([^;}]+)/g)) expect(f[1].trim()).toMatch(/^var\(--skin-font-(display|hand|body)\)$/);
  });
});

// "remove friend feature" (Brian, 2026-11-14), then "add back the friends thing ... the friend code on their profile instead of on a
// separate tab/button" (Kai, 2026-11-14): friends are back for accounts and for guests, but only on the profile. The separate
// Friends tab and button, and room invites, stay gone.
describe('friends live on the profile', () => {
  it('the server and the browser have friends again, and the old tab and invite toast stay deleted', () => {
    for (const f of [
      'src/state/guestSocial.ts', 'src/lib/guestFriends.ts', 'src/skin/profile/FriendsSection.tsx',
      'server/routes/friends.ts', 'server/routes/guestFriends.ts', 'server/social/friends.ts', 'server/social/guestFriends.ts',
    ]) expect(existsSync(f), f).toBe(true);
    for (const f of ['src/ui/social/FriendsTab.tsx', 'src/ui/social/InviteToast.tsx']) expect(existsSync(f), f).toBe(false);
  });

  it('the friend code is on the profile page', () => {
    expect(src('src/skin/profile/Profile.tsx')).toContain('<FriendsSection');
    expect(src('src/skin/profile/FriendsSection.tsx')).toContain('Your friend code');
  });

  it('the start screen opens the leaderboards from the menu, under the Trading Post, and has no friends button', () => {
    const home = src('src/skin/screens/PaintedHome.tsx');
    expect(home).toContain('<Leaderboards onClose=');
    expect(home).toContain("id: 'boards', label: 'Leaderboards'");
    expect(home.indexOf("id: 'boards'")).toBeGreaterThan(home.indexOf("id: 'bazaar'"));
    expect(home).not.toContain('data-boards');
    expect(home).not.toMatch(/FriendsIcon|aria-label="Friends|social\/Hub/);
  });

  it('the Wins board offers This week and All time, no Today', () => {
    const lb = src('src/skin/boards/Leaderboards.tsx');
    expect(lb).toContain("const PERIODS: [Period, string][] = [['week', 'This week'], ['all', 'All time']];");
    expect(lb).not.toContain("'Today'");
  });

  it('a lobby is reached by its code or link: there is no friends list to invite from, in either look', () => {
    for (const f of ['src/skin/rooms/PaintedRoom.tsx', 'src/ui/RoomScreen.tsx']) {
      expect(src(f), f).not.toMatch(/Invite a friend<|Invite friends<|social\/Hub/);
      expect(src(f), f).toMatch(/Copy invite link/);
    }
  });

  it('the room connection and the server still know no invite message', () => {
    expect(src('src/net/protocol.ts')).not.toMatch(/'invite'|'invited'|'inviteResult'/);
    expect(src('src/state/roomStore.ts')).not.toMatch(/invites|acceptInvite/);
    expect(src('server/index.ts')).not.toMatch(/case 'invite'|areFriends/);
  });

  it('the server wires the friends service and the guest mailbox, and deleting an account clears the friend rows', () => {
    const main = src('server/main.ts');
    expect(main).toMatch(/new FriendsService/);
    expect(main).toMatch(/createFriendRoutes/);
    expect(main).toMatch(/createGuestFriendRoutes/);
    expect(main).toContain('friends.erase(id)');
  });
});
