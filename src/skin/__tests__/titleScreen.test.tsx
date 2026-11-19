import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameMenu } from '../components/GameMenu';
import { TitleBoard } from '../components/TitleBoard';

describe('title screen', () => {
  it('the title is one wordmark: the name as the heading, the update over it, the tagline under it, and no letter tiles', () => {
    const html = renderToStaticMarkup(<TitleBoard title="Fleeced" tagline="Chain words." />);
    expect(html).toMatch(/<h1 class="sk-title-word\s*">Fleeced<\/h1>/);
    expect(html).toContain('<p class="sk-title-kicker">The Fleece Navidad update</p>');
    expect(html).toContain('<p class="sk-title-tagline">Chain words.</p>');
    expect(html).not.toMatch(/sk-title-tile|kit-tile|kit-plank|sk-update|<svg/);
    expect(html.indexOf('sk-title-kicker')).toBeLessThan(html.indexOf('sk-title-word'));
    expect(html.indexOf('sk-title-word')).toBeLessThan(html.indexOf('sk-title-tagline'));
  });

  it('the menu makes the first item the big one, starts on the first live item and shows its caption', () => {
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
    expect(html).toMatch(/class="sk-menu-item sk-menu-primary"[^>]*disabled/);
    expect(html).toMatch(/data-active="true"[^>]*>.*Practice/);
    expect(html).toContain('Easy bots');
  });
});
