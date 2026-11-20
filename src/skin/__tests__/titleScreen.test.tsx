import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameMenu } from '../components/GameMenu';
import { HomeTitle, WORD_CHAINS } from '../home/HomeParts';

describe('title screen (HOME-UI-PLAN, 2026-11-20)', () => {
  it('the title is the name in wool blocks, one heading named for the game, the last block fleeced, the tagline under it', () => {
    const html = renderToStaticMarkup(<HomeTitle title="Fleeced" tagline="Chain words." />);
    expect(html).toMatch(/<h1 class="hm-blocks" aria-label="Fleeced">/);
    expect(html.match(/class="hm-block-l/g)).toHaveLength(7);
    expect(html.match(/hm-fleeced/g)).toHaveLength(1);
    expect(html.match(/class="hm-tuft"/g)).toHaveLength(3);
    expect(html).toContain('<p class="hm-tagline">Chain words.</p>');
    expect(html).not.toMatch(/rack|hm-board|kit-plank/);
  });

  it('the menu makes the first item the big lantern block, starts on the first live item and describes it', () => {
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
    expect(html).toMatch(/class="sk-menu-item hm-slab hm-knit sk-menu-primary hm-slab--lantern"[^>]*disabled/);
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
