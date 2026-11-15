import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DIVISION_POINTS, TIERS, TOP_FLOOR } from '../../../lib/ranked';
import { RankGuideBody } from '../RankGuide';

// The profile's "How ranks work" (Brian, 2026-11-14: "put a button there that explains the ranked system, all the ranks
// consecutively").
describe('how ranks work', () => {
  const html = (mine: number | null = null) => renderToStaticMarkup(<RankGuideBody mine={mine} />);

  it('lists every rank, in order, highest first (numbered 8 down to 1), with the points each covers', () => {
    const page = html();
    let at = -1;
    for (const t of [...TIERS].reverse()) {
      const i = page.indexOf(`<b>${t.name}</b>`);
      expect(i, t.name).toBeGreaterThan(at);
      at = i;
    }
    expect(page.match(/class="sk-rg-rung"/g)).toHaveLength(TIERS.length);
    expect(page).toContain(`0 to ${(3 * DIVISION_POINTS - 1).toLocaleString('en-US')} points`);
    expect(page).toContain(`${TOP_FLOOR.toLocaleString('en-US')} points and up`);
  });

  it('marks your own rank, and none when you have none', () => {
    expect(html(3).match(/data-you="true"/g)).toHaveLength(1);
    expect(html(3)).toMatch(/data-you="true"[^]*?<b>Gold<\/b><span class="sk-rg-you">you<\/span>/);
    expect(html(null)).not.toContain('data-you');
  });

  it('says how points are won and lost, with no middle dots', () => {
    const page = html();
    for (const h of ['Climbing', 'Points', 'Easy at the start', 'The games']) expect(page).toContain(`<h3>${h}</h3>`);
    expect(page).not.toContain('·');
  });

  it('opens from a button on the profile\'s ranked card, and Ranked is found under Queue', () => {
    const card = readFileSync('src/skin/ranked/ProfileRank.tsx', 'utf8');
    expect(card).toContain('How ranks work</WoodButton>');
    expect(card).toContain('<RankGuide ');
    expect(card).not.toContain('under Play');
  });
});
