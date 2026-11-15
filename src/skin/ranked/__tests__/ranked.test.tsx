import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TIERS } from '../../../lib/ranked';
import { describeError } from '../../../net/protocol';
import { enterOnline, onlinePlay } from '../../rooms/enterOnline';
import { BADGE_H, BADGE_W, badgeArt } from '../badge';
import { PlayChooser } from '../PlayChooser';
import { RankBadge } from '../RankBadge';

const noop = () => undefined;
const chooser = (rank: 'play' | 'signin') => renderToStaticMarkup(<PlayChooser rank={rank} busy={false} onClose={noop} onCasual={noop} onRanked={noop} onSignIn={noop} />);

describe('the rank badges', () => {
  it('there is one for each of the eight ranks, all the same size, every pixel painted', () => {
    for (let t = 0; t < TIERS.length; t++) {
      const { rows, colors } = badgeArt(t);
      expect(rows).toHaveLength(BADGE_H);
      for (const row of rows) {
        expect(row).toHaveLength(BADGE_W);
        for (const ch of row) if (ch !== '.') expect(colors[ch], `rank ${t}: ${ch}`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('no two are the same shape, and no two the same colours: never one badge in another paint', () => {
    const shapes = TIERS.map((_, t) => badgeArt(t).rows.join('\n'));
    expect(new Set(shapes).size).toBe(TIERS.length);
    const rings = TIERS.map((_, t) => badgeArt(t).colors.R);
    expect(new Set(rings).size).toBe(TIERS.length);
  });

  it('the first rank is the plainest badge and the last the most elaborate', () => {
    const painted = TIERS.map((_, t) => badgeArt(t).rows.join('').replace(/\./g, '').length);
    expect(Math.min(...painted)).toBe(painted[0]);
    expect(Math.max(...painted)).toBe(painted[TIERS.length - 1]);
    expect(painted[TIERS.length - 1]).toBeGreaterThan(painted[0] * 1.3);
  });

  it('shows the division as pips, and none in the last rank', () => {
    const pips = (rating: number) => (renderToStaticMarkup(<RankBadge rating={rating} />).match(/data-on/g) ?? []).length;
    expect(pips(0)).toBe(1);
    expect(pips(150)).toBe(2);
    expect(pips(1199)).toBe(3);
    expect(renderToStaticMarkup(<RankBadge rating={2100} />)).not.toContain('sk-rank-pips');
    expect(renderToStaticMarkup(<RankBadge rating={964} />)).toContain('aria-label="Ram I"');
  });
});

describe('what Play opens', () => {
  it('two cards, Casual and Ranked, each with one way in', () => {
    const html = chooser('play');
    expect(html).toContain('data-mode="casual"');
    expect(html).toContain('data-mode="ranked"');
    expect(html).toContain('Find a game');
    expect(html).toContain('Find a ranked game');
    expect(html).toContain('play/casual.webp');
    expect(html).toContain('play/ranked.webp');
  });

  it('says plainly what each is: farm sheep fill a casual table, a ranked one is people only', () => {
    const html = chooser('play');
    expect(html).toMatch(/farm sheep take the empty seats/);
    expect(html).toMatch(/2 to 4 players, no farm sheep/);
    expect(html).toMatch(/Leaving a game counts as a loss/);
  });

  it('shows the whole ladder on the Ranked card, lowest rank first', () => {
    const html = chooser('play');
    expect(html).toContain(`The ranks, lowest first: ${TIERS.map((t) => t.name).join(', ')}`);
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(TIERS.length);
  });

  it('asks a player with no account to sign in before ranked, and never offers them the queue', () => {
    const html = chooser('signin');
    expect(html).toContain('Sign in to play ranked');
    expect(html).not.toContain('Find a ranked game');
    expect(html).toContain('Find a game'); // casual needs no account
  });

  it('has its two pictures', () => {
    for (const f of ['public/play/casual.webp', 'public/play/ranked.webp']) expect(readFileSync(f).length).toBeGreaterThan(5000);
  });
});

describe('Quick play and Play are for real people', () => {
  const home = readFileSync('src/skin/screens/PaintedHome.tsx', 'utf8');
  const item = (id: string) => home.slice(home.indexOf(`{ id: '${id}'`), home.indexOf('\n', home.indexOf(`{ id: '${id}'`)));

  it('neither menu item can start a table of farm sheep', () => {
    expect(item('start')).toContain("online({ t: 'quick' })");
    expect(item('start')).not.toMatch(/go\('quick'\)|start\(/);
    expect(item('play')).toContain('setChooser(true)');
    expect(item('play')).not.toMatch(/go\('quick'\)|setStep\('setup'\)/);
  });

  it('the farm sheep are in the lobby you make: Custom game is no longer a menu item of its own', () => {
    expect(home).not.toContain("id: 'custom'");
    expect(home).not.toContain("label: ready ? 'Custom game'");
    const lobby = home.slice(home.indexOf("{ id: 'lobby', label: 'Create lobby'"), home.indexOf("{ id: 'lobby', label: 'Create lobby'") + 400);
    expect(lobby).toMatch(/add farm sheep \(bots\), invite friends/);
    expect(lobby).toContain("online({ t: 'create', visibility: 'private', ...lobbyBots() })");
  });

  it('the profile is the box with your name, not a menu item', () => {
    expect(home).not.toContain("id: 'profile'");
    expect(home).toMatch(/className=\{`sk-plate sk-plate-open[^`]*`\} onClick=\{\(\) => setProfile\(true\)\}/);
    expect(home).toContain('· Profile</span>');
  });

  it('with no game server to reach, going online says why instead of dealing a bot game', () => {
    expect(onlinePlay()).toBe(false); // the tests are built without a server address
    expect(enterOnline({ t: 'quick' })).toMatch(/needs the game server/);
    expect(enterOnline({ t: 'ranked' })).toMatch(/needs the game server/);
  });

  it('the game after the tutorial is the real-people queue, not a bot table', () => {
    const tour = readFileSync('src/skin/tour/PaintedTour.tsx', 'utf8');
    expect(tour).toContain("enterOnline({ t: 'quick' })");
    expect(tour).not.toContain("endTour('quick')");
  });

  it('the server\'s refusals for ranked are put in words', () => {
    expect(describeError('account_required')).toMatch(/account/i);
    expect(describeError('ranked_room')).toMatch(/ranked/i);
    expect(describeError('ranked_unavailable')).toMatch(/ranked/i);
  });
});
