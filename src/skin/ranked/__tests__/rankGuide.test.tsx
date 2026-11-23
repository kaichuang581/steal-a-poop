import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DIVISION_POINTS, TIERS, TOP_FLOOR } from '../../../lib/ranked';
import { RankGuideBody } from '../RankGuide';

// The profile's "How ranks work" (Brian, 2026-11-14: "put a button there that explains the ranked system, all the ranks
// consecutively").
describe('how ranks work', () => {
  const html = (mine: number | null = null) => renderToStaticMarkup(<RankGuideBody mine={mine} />);

  it('lists every rank, highest first, as one Tile each with the points it covers and at most one tag', () => {
    const page = html(0);
    let at = -1;
    for (const t of [...TIERS].reverse()) {
      const i = page.indexOf(`<b>${t.name}`);
      expect(i, t.name).toBeGreaterThan(at);
      at = i;
    }
    expect(page.match(/class="pf-rg-tile"/g)).toHaveLength(TIERS.length);
    expect(page).toContain(`0–${(3 * DIVISION_POINTS - 1).toLocaleString('en-US')} points`);
    expect(page).toContain(`${TOP_FLOOR.toLocaleString('en-US')} points and up`);
    for (const tag of ['Top rank', 'Losses ¾', 'Losses ½', 'Losses free']) expect(page).toContain(tag);
    expect(page).not.toMatch(/>I<\/i>|>II<\/i>/);
  });

  it('shows where an unranked player starts', () => {
    expect(html(null)).toContain('Start here');
    expect(html(null)).toContain('0–299 points · losses are free');
  });

  it('marks your own rank, and none when you have none', () => {
    expect(html(3).match(/data-you="true"/g)).toHaveLength(1);
    expect(html(3)).toMatch(/data-you="true"[^]*?<b>Gold<span class="pf-pennant">You<\/span><\/b>/);
    expect(html(null)).not.toContain('data-you');
  });

  it('says how points are won and lost, in four rules', () => {
    const page = html();
    for (const h of ['Climbing', 'Points', 'A gentle start', 'The games']) expect(page).toMatch(new RegExp(`</span>${h}</h3>`));
    for (const c of ['2–4 players', 'Same rules for all', 'Account needed', 'Leaving counts as a loss']) expect(page).toContain(c);
  });

  it('opens from a button on the profile\'s ranked card, and Ranked is found under Queue', () => {
    const card = readFileSync('src/skin/ranked/ProfileRank.tsx', 'utf8');
    expect(card).toContain('How ranks work\n        </button>');
    expect(card).toContain('<RankGuide ');
    expect(card).not.toContain('under Play');
  });
});
