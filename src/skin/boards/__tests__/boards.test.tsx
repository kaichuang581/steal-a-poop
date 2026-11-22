import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { fmt, Leaderboards, levelSheet, rankedSheet, screenOf, winsSheet } from '../Leaderboards';

const src = (path: string) => readFileSync(path, 'utf8');
/** `text` split at `sep` where no bracket is open (a shadow's parts, a list of shadows). */
function split(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** A file without its comments: what the rules below judge is the code, not the words about it. */
const code = (path: string) => src(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('a board, as the page lists it', () => {
  it('the ranked ladder: points as the big figure, the games behind them, and your place among everyone ranked', () => {
    const s = rankedSheet({
      top: [{ place: 1, name: 'Ann', rating: 1310, games: 12, wins: 7, you: false }, { place: 2, name: 'Bo', rating: 240, games: 4, wins: 1, you: true }],
      you: { place: 2, of: 1204 },
    });
    expect(s.lines).toEqual([
      { place: 1, name: 'Ann', score: 1310, extra: 12, you: false },
      { place: 2, name: 'Bo', score: 240, extra: 4, you: true },
    ]);
    expect(s.place).toBe(2);
    expect(rankedSheet({ top: [], you: null })).toEqual({ lines: [], place: null });
  });

  it('the level board: XP as the big figure, the level beside it, and your place and XP past the list', () => {
    const top = [{ place: 1, name: 'Ann', xp: 98000, level: 42, you: false }, { place: 2, name: 'Bo', xp: 300, level: 2, you: true }];
    expect(levelSheet({ top, players: 9, you: { place: 2, xp: 300 } }).lines).toEqual([
      { place: 1, name: 'Ann', score: 98000, extra: 42, you: false }, { place: 2, name: 'Bo', score: 300, extra: 2, you: true },
    ]);
    const far = levelSheet({ top: [], players: 20000, you: { place: 101, xp: 5 } });
    expect(far.place).toBe(101);
    expect(far.mine).toEqual({ score: 5, extra: 1 });
    expect(levelSheet({ top, players: 9, you: null }).place).toBeNull();
  });

  it('online wins: the public board has no ids, so you are the line with your own name', () => {
    const rows = [{ rank: 1, name: 'Cy', value: 12, games: 30 }, { rank: 2, name: 'Ann', value: 1, games: 1 }];
    const signedIn = winsSheet({ rows }, 'Ann');
    expect(signedIn.lines).toEqual([
      { place: 1, name: 'Cy', score: 12, extra: 30, you: false },
      { place: 2, name: 'Ann', score: 1, extra: 1, you: true },
    ]);
    expect(signedIn.place).toBe(2);
    const guest = winsSheet({ rows }, null);
    expect(guest.lines.some((l) => l.you)).toBe(false);
    expect(guest.place).toBeNull();
  });

  it('numbers are grouped in the game\'s language, figures of one width', () => {
    expect(fmt(96000)).toBe('96,000');
    expect(src('src/skin/boards/boards.css')).toMatch(/font-variant-numeric: lining-nums tabular-nums/);
  });

  it('the layout: a computer\'s while the stage the board leaves is 360 wide or more, else a phone\'s at scale 1', () => {
    expect(screenOf(1280, 720)).toEqual({ desk: true, u: 1 });
    expect(screenOf(1920, 1080)).toEqual({ desk: true, u: 1.5 });
    expect(screenOf(1440, 900).desk).toBe(true);
    expect(screenOf(390, 844)).toEqual({ desk: false, u: 1 });
    expect(screenOf(768, 1024)).toEqual({ desk: false, u: 1 });
    expect(screenOf(1024, 768)).toEqual({ desk: true, u: 0.8 });
    expect(screenOf(360, 740)).toEqual({ desk: false, u: 1 });
  });
});

// The screen as Brian asked for it on 2026-11-21 (docs/leaderboards/LEADERBOARDS-PLAN.md, version 2): Home's slabs over
// the sky, nothing flat, no wood. Rendered without a browser: the stage (three.js) is lazy and draws nothing here, and no
// board has come in yet, so the list is six empty tiles.
describe('the leaderboards page', () => {
  const page = renderToStaticMarkup(<Leaderboards onClose={() => undefined} />);
  const source = code('src/skin/boards/Leaderboards.tsx');
  const css = code('src/skin/boards/boards.css');
  const stage = code('src/skin/boards/BoardStage.tsx');
  const island = code('src/skin/boards/island.ts');

  it('is a bar with the title tag, three tabs and the way out, over the sky, and one board with its ribbon', () => {
    expect(page).toMatch(/class="lb"/);
    expect(page).toContain('class="lb-bar"');
    expect(page).toContain('lb-titletag hm-slab hm-knit lb-static');
    expect(page.match(/role="tab"/g)).toHaveLength(3);
    for (const label of ['Ranked', 'Wins', 'Level']) expect(page).toContain(`>${label}</span>`);
    expect(page).toMatch(/data-tab="ranked" aria-selected="true"/);
    expect(page).toMatch(/lb-tab hm-slab hm-knit hm-slab--lantern/);
    expect(page).toContain('aria-label="Close"');
    expect(page).toContain('class="lb-board"');
    expect(page).toContain('class="lb-ribbon"');
    expect(page).toContain('Ranked ladder');
    expect(page).toContain('By ranked points');
  });

  it('before a board is in: six empty tiles, the column heads, and your row with how to get a place', () => {
    expect(page.match(/lb-tile lb-tile--loading/g)).toHaveLength(6);
    expect(page).toContain('lb-cols lb-well');
    for (const h of ['#', 'Player', 'Rank', 'Points']) expect(page).toContain(`<span>${h}</span>`);
    expect(page).toContain('lb-you hm-slab hm-knit lb-static');
    expect(page).toContain('lb-pennant');
    expect(page).toContain('Play a ranked game to get a place.');
  });

  it('has no wood, paper, rope, nail, peg or brass, and none of the old beam, plank board or wool slates', () => {
    for (const text of [page, source, css]) {
      expect(text).not.toMatch(/kit-paper|kit-beam|kit-wall|kit-plank|kit-drift|kit-peg|kit-lit|\bPeg\b|WoodButton|\bRopes\b|\bNails\b|\bBrass\b|rm-panel|rm-tab|sk-lb-/);
    }
    expect(source).not.toMatch(/from '\.\.\/kit'/);
  });

  it('keeps the plan\'s banned list in its stylesheet: no gradient, blur, glow, rounded corner, dashed or stitched border, no hand font', () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/border-radius:\s*(?!0)/);
    expect(css).not.toMatch(/\b(dashed|dotted)\b|border:\s*\d/);
    expect(css).not.toMatch(/blur\(|backdrop-filter/);
    // Every shadow is hard: no blur radius in any box-shadow or drop shadow.
    for (const m of css.matchAll(/box-shadow:\s*([^;}]+)/g)) for (const one of split(m[1], ',')) {
      const parts = split(one.trim().replace(/^inset\s+/, ''), ' ');
      expect(parts[2], one).toBe('0');
    }
    expect(css).toMatch(/drop-shadow\(0 calc\(4 \* var\(--u\)\) 0 rgba\(14, 21, 40, 0\.38\)\)/);
    for (const f of css.matchAll(/font(?:-family)?:[^;]*var\(--skin-font-(\w+)\)/g)) expect(f[1]).toMatch(/^(display|body)$/);
  });

  it('the stage: the podium\'s crates on one snowy island, no clouds, a straight-on long lens, loaded after the page', () => {
    const frame = src('src/skin/boards/frame.ts'), poses = src('src/skin/boards/poses.ts');
    expect(source).toContain("lazy(() => import('./BoardStage'))");
    // Brian, 2026-11-22: the stage's own podiums (podium.ts), gold, silver and bronze; the victory screen keeps its crates.
    expect(stage).toMatch(/import \{ podiumGeometry[^}]*\} from '.\/podium'/);
    expect(stage).not.toMatch(/blockGeometry|carvedGeometry|trophyGeometry/);
    expect(frame).toMatch(/export const PITCH = \(10 \* Math\.PI\) \/ 180, FOV = 28/);
    expect(frame).toMatch(/FILL = \{ desk: 0\.66, phone: 0\.92 \}/);
    expect(stage).toContain('islandGeometry(layout)');
    expect(stage).toContain('farIsland(');
    expect(stage + island).not.toMatch(/cloudSea|cloudGrid|island\('windmill'|Puffs|whiten|wisp\(/);
    // The sky is a festival night (Brian, 2026-11-22: "go more for the vibe of like those anime festivals while still
    // being somewhat cohesive"): painted bands behind the picture, a moon, stars, clouds lit from beneath, sky lanterns
    // and fireworks, all in FestivalSky.tsx; no voxel clouds.
    const sky = src('src/skin/boards/FestivalSky.tsx');
    expect(stage).toContain('<FestivalSky place={place}');
    expect(stage).not.toMatch(/<Dome\b|PartySky/);
    for (const part of ['backdrop()', 'moonTexture()', 'cloudTexture(', 'lanternTexture()', 'KINDS', 'STARS']) expect(sky).toContain(part);
    expect(sky).not.toMatch(/Grid\(|buildGeometry/);
    // Version 3 (Brian, 2026-11-22): the stage's own three poses, handed to the Sheep component whole.
    for (const name of ["'lbChampion'", "'lbGoodSport'", "'lbNap'"]) expect(poses).toContain(`name: ${name}`);
    expect(stage).toContain('rig={rig}');
    expect(stage).not.toMatch(/'lounge'|'perch'|'flop'/);
    expect(stage).toContain('<AdaptiveCanvas');
    expect(stage).toContain('<MarkDrawn />');
    expect(stage).not.toMatch(/useWorld|Snowfall|<Sky\b|bloom|EffectComposer|TiltShift/i);
    // The champion's wool is not lit by a light of the cup's own: the one point light is the lantern's, inside its glass.
    expect(stage.match(/<pointLight/g)).toHaveLength(1);
    expect(stage).toContain('<pointLight position={geo.lamp}');
    // The plates are put on their crates when the window or the camera changes, never each frame.
    expect(stage).not.toMatch(/ScreenAnchor/);
    expect(stage).toContain('new ResizeObserver(fit)');
    expect(stage.split('useFrame(').slice(1).join('')).not.toMatch(/anchors\[|--crate-w/);
  });

  it('the victory screen is as it was before the leaderboards: only two builders exported, the second with a lift', () => {
    const podium = src('src/skin/table/Podium.tsx');
    expect(podium).not.toMatch(/PodiumShot|vacant|plates = true|memory = 'podium'/);
    expect(podium).toContain('memory="podium"');
    expect(podium).toContain('export function blockGeometry(place: number, lift = 0)');
    expect(podium).toContain('export function carvedGeometry(place: number)');
  });

  it('has no Daily Table, no friends, no Today, and no dots between phrases', () => {
    expect(page).not.toMatch(/Daily Table|Friends|metric=points|>Today</);
    for (const text of [page, source, stage]) expect(text).not.toContain('·');
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

  it('the start screen opens the leaderboards from the trophy in its top bar (the "Word chain" Home), and has no friends button', () => {
    const home = src('src/skin/screens/PaintedHome.tsx');
    expect(home).toContain('<Leaderboards onClose=');
    expect(home).toMatch(/onClick=\{\(\) => setBoards\(true\)\} aria-label="Leaderboards"/);
    expect(home).not.toContain("id: 'boards'");
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
