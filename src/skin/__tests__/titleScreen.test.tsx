import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameMenu } from '../components/GameMenu';
import { HomeTitle, WORD_CHAINS } from '../home/HomeParts';

describe('title screen ("Word chain", 2026-11-20)', () => {
  it('the title is the name in letter tiles on a rack: one heading named for the game, a tile a letter, the tagline under it', () => {
    const html = renderToStaticMarkup(<HomeTitle title="Fleeced" tagline="Chain words." />);
    expect(html).toMatch(/<h1 class="hm-tiles" aria-label="Fleeced">/);
    expect(html.match(/class="hm-tile"/g)).toHaveLength(7);
    expect(html).toContain('>F</span>');
    expect(html).toContain('class="hm-rack hm-board"');
    expect(html).toContain('<p class="hm-tagline">Chain words.</p>');
    expect(html.indexOf('hm-tiles')).toBeLessThan(html.indexOf('hm-tagline'));
  });

  it('the menu makes the first item the big one, starts on the first live item and describes it', () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      <GameMenu
        label="Main menu"
        items={[
          { id: 'play', label: 'Play', caption: 'Off to the barn', onSelect: noop, disabled: true },
          { id: 'practice', label: 'Practice', caption: 'Easy bots', onSelect: noop },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Main menu"');
    expect(html).toMatch(/class="sk-menu-item hm-board sk-menu-primary"[^>]*disabled/);
    expect(html).toMatch(/data-active="true"[^>]*>.*Practice/);
    expect(html).toContain('Easy bots');
  });

  it('every word chain behind the menu keeps the rule, all the way round, in real words', () => {
    const words = new Set(readFileSync('public/words.txt', 'utf8').split('\n').map((w) => w.trim()));
    for (const row of WORD_CHAINS) {
      row.forEach((w, i) => {
        expect(words.has(w.toLowerCase()), w).toBe(true);
        const next = row[(i + 1) % row.length];
        expect(next[0], `${w} then ${next}`).toBe(w.at(-1));
      });
    }
  });
});
