import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameMenu } from '../components/GameMenu';
import { TitleBoard } from '../components/TitleBoard';

describe('title screen', () => {
  it('the title board keeps the full title for screen readers and hangs the last word as tiles, the last one lit', () => {
    const html = renderToStaticMarkup(<TitleBoard title="Finish the Word" tagline="Chain words." />);
    expect(html).toContain('<h1 class="sr-only">Finish the Word</h1>');
    expect(html.match(/sk-title-tile[ "]/g)).toHaveLength(4);
    expect(html.match(/sk-title-tile-next/g)).toHaveLength(1);
    expect(html).toContain('FINISH THE');
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
